/**
 * YouTrack tracker provider for OpenChamber.
 *
 * OpenChamber posts each tracker call to POST /tracker on this service and
 * keeps the account, its token and the session records. This service only
 * translates between YouTrack's REST API and OpenChamber's neutral tracker
 * shapes. It never sees a credential: every request goes through OpenChamber's
 * outbound proxy with the call's handle.
 *
 * There is no rail panel. A host that supports repository scoping passes the
 * project's `directory` (and optionally its name) on
 * `items.list`/`containers.list`; the service reads that folder's git remote,
 * finds the issue whose description carries the matching fenced JSON, and
 * scopes the list to that issue's project.
 */
import http from 'node:http';

import {
  SESSION_EVENTS_PATH,
  TRACKER_PROVIDER_ERROR_MESSAGE_MAX,
  TRACKER_PROVIDER_PATH,
  TrackerOutboundError,
  createTrackerOutbound,
  readSessionEventRequest,
  readTrackerProviderRequest,
  type SourceControlJsonObject,
  type SourceControlOutboundResponse,
  type TrackerProviderContainer,
  type TrackerProviderDataByMethod,
  type TrackerProviderError,
  type TrackerProviderInputs,
  type TrackerProviderLiveSummary,
  type TrackerProviderMethod,
  type TrackerProviderResult,
  type TrackerProviderStateCategory,
  type TrackerProviderWorkflowState,
} from '@openchamber/sdk';

import {
  descriptionMatches,
  repoNameOf,
  type IssueMapping,
} from './mapping.ts';
import { scopeOf, type ProjectScope } from './project.ts';
import { latestSessionDirectory, rememberSessionDirectory } from './session-scope.ts';
import { createTtlCache } from './ttl-cache.ts';
import {
  categoryFallback,
  peopleFilterQuery,
  priorityFilterQuery,
  projectQuery,
  quoteTerm,
  stateNameQuery,
} from './query.ts';
import {
  ISSUE_FIELDS,
  ISSUE_FIELDS_WITH_COMMENTS,
  absolute,
  commonStateNames,
  isStateValue,
  stateOf,
  toContainer,
  toItem,
  toLiveSummary,
  toSummary,
  toWorkflowState,
  type YtComment,
  type YtFieldValue,
  type YtIssue,
  type YtProject,
  type YtProjectField,
  type YtUser,
} from './youtrack.ts';

const port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
const serviceToken = process.env.OPENCHAMBER_SERVICE_TOKEN ?? '';
if (!port || !serviceToken) {
  console.error('OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required');
  process.exit(1);
}

const outbound = createTrackerOutbound({ env: process.env });

// ---------------------------------------------------------------------------
// The service's calls to YouTrack.

/** One page of `items.list`. Kept under YouTrack's usual 42-entry collection cap. */
const PAGE_SIZE = 40;

/** Who a call is for: the server it reaches and the handle that reaches it. */
type Call = { instance: string; handle: string; accountId: string };

/**
 * Cache scope: the server and the account, never the server alone. A call
 * without an account gets a per-call scope, so it cannot reuse another
 * account's data.
 */
const cacheKey = (call: Call, ...parts: string[]): string =>
  [call.instance, call.accountId || `handle:${call.handle}`, ...parts].join('\u0000');

/** A failed call, answered as `{ ok: false, error }` with this status. */
class CallError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** A server 4xx or 5xx as a `CallError` with that status and the server's own message. */
const serverFailure = (response: SourceControlOutboundResponse): CallError => {
  if (response.status === 401) return new CallError('YouTrack refused the credential.', 401);
  let message = `YouTrack answered ${response.status}.`;
  try {
    const parsed: { error?: string; error_description?: string; message?: string } = JSON.parse(response.body);
    const detail = parsed.error_description ?? parsed.error ?? parsed.message;
    if (detail) message = `YouTrack answered ${response.status}: ${detail}`;
  } catch {
    // The status says enough.
  }
  return new CallError(message, response.status);
};

/** One request to YouTrack through OpenChamber's proxy, its JSON answer parsed. */
const api = async <T,>(
  call: Call,
  method: 'GET' | 'POST',
  path: string,
  options: { query?: Record<string, string>; body?: SourceControlJsonObject } = {},
): Promise<T> => {
  const response = await outbound.request(call.handle, {
    method,
    path,
    query: options.query,
    headers: options.body
      ? { accept: 'application/json', 'content-type': 'application/json' }
      : { accept: 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status >= 400) throw serverFailure(response);
  try {
    const data: T = JSON.parse(response.body);
    return data;
  } catch {
    throw new CallError('YouTrack answered with something other than JSON.', 502);
  }
};

/** The answer, or null when YouTrack has no such item. */
const orNull = async <T,>(request: Promise<T>): Promise<T | null> => {
  try {
    return await request;
  } catch (error) {
    if (error instanceof CallError && error.status === 404) return null;
    throw error;
  }
};

const seg = encodeURIComponent;

// ---------------------------------------------------------------------------
// The project list. The native mapping UI and the board read it; a failed read
// keeps the last good list, or answers none so no project filter is sent.

const PROJECTS_TTL_MS = 5 * 60_000;
const PROJECTS_RETRY_MS = 30_000;

const PROJECTS_CACHE = createTtlCache<TrackerProviderContainer[]>(PROJECTS_TTL_MS);
const PROJECTS_INFLIGHT = new Map<string, Promise<TrackerProviderContainer[]>>();
const ALL_CONTAINERS = new Map<string, TrackerProviderContainer[]>();

const readProjects = async (call: Call): Promise<TrackerProviderContainer[]> => {
  const projects = new Map<string, YtProject>();
  for (let skip = 0; skip < 5000; skip += 100) {
    const page = await api<YtProject[]>(
      call,
      'GET',
      '/api/admin/projects',
      {
        query: {
          fields: 'id,name,shortName',
          $top: '100',
          $skip: String(skip),
        },
      },
    );
    for (const project of page) {
      if (project.id) projects.set(project.id, project);
    }
    if (page.length < 100) break;
  }
  return [...projects.values()].map(toContainer);
};

const loadProjects = async (call: Call): Promise<TrackerProviderContainer[]> => {
  const key = cacheKey(call);
  const cached = PROJECTS_CACHE.get(key);
  if (cached !== undefined) return cached;

  const inflight = PROJECTS_INFLIGHT.get(key);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const all = await readProjects(call);
      PROJECTS_CACHE.set(key, all);
      ALL_CONTAINERS.set(key, all);
      return all;
    } catch (error) {
      console.error(
        `[youtrack] could not read the project list: ${error instanceof Error ? error.message : String(error)}`,
      );
      const fallback = PROJECTS_CACHE.get(key)
        ?? ALL_CONTAINERS.get(key)
        ?? [];
      PROJECTS_CACHE.set(key, fallback, PROJECTS_RETRY_MS);
      return fallback;
    } finally {
      PROJECTS_INFLIGHT.delete(key);
    }
  })();
  PROJECTS_INFLIGHT.set(key, request);
  return request;
};

const containerFilterQuery = async (call: Call, containerId: string): Promise<string> => {
  const key = cacheKey(call);
  const known = ALL_CONTAINERS.get(key) ?? [];
  let container = known.find((entry) => entry.id === containerId);
  if (!container) {
    await loadProjects(call);
    container = (ALL_CONTAINERS.get(key) ?? []).find((entry) => entry.id === containerId);
  }
  if (container) return `project: ${quoteTerm(container.key ?? container.name)}`;

  // The list may be unavailable (an issue-scoped token can be refused the
  // admin endpoint). Read the one project by id before giving up.
  try {
    const project = await orNull(api<YtProject>(
      call,
      'GET',
      `/api/admin/projects/${seg(containerId)}`,
      { query: { fields: 'id,name,shortName' } },
    ));
    if (project) return `project: ${quoteTerm(project.shortName ?? project.name ?? containerId)}`;
  } catch (error) {
    if (!(error instanceof CallError)) throw error;
  }
  throw new CallError(`Unknown YouTrack project ${containerId}.`, 404);
};

// ---------------------------------------------------------------------------
// The issue-description mapping. Folder and git probing live in project.ts.

/** How long an issue-description mapping is reused. */
const ISSUE_MAPPING_TTL_MS = 60_000;
const ISSUE_MAPPING_CACHE = createTtlCache<IssueMapping>(ISSUE_MAPPING_TTL_MS);

const issueMappingOf = async (
  call: Call,
  scope: ProjectScope,
): Promise<IssueMapping | null> => {
  if (scope.hints.length === 0) return null;
  const key = cacheKey(call, scope.directory ?? '', scope.projectName ?? '');
  const cached = ISSUE_MAPPING_CACHE.get(key);
  if (cached !== undefined) return cached;

  const values = scope.hints.map((hint) => hint.value).filter(Boolean);
  const terms = [...new Set(
    scope.hints
      .map((hint) => repoNameOf(hint.value) ?? hint.value.trim())
      .filter((term) => term.length >= 3),
  )];
  const projects = new Map<string, TrackerProviderContainer>();
  const matchedTerms = new Set<string>();

  for (const term of terms) {
    try {
      const issues = await api<YtIssue[]>(call, 'GET', '/api/issues', {
        query: {
          query: term,
          $top: '20',
          fields: 'id,idReadable,project(id,shortName,name),description',
        },
      });
      for (const issue of issues) {
        if (!issue.project?.id) continue;
        if (!descriptionMatches(issue.description, values)) continue;
        projects.set(issue.project.id, toContainer(issue.project));
        matchedTerms.add(term);
      }
    } catch (error) {
      if (error instanceof CallError && (error.status === 403 || error.status === 404)) continue;
      throw error;
    }
  }

  const value: IssueMapping = {
    projects: [...projects.values()],
    terms: [...matchedTerms],
  };
  ISSUE_MAPPING_CACHE.set(key, value);
  return value;
};

// ---------------------------------------------------------------------------
// Search filters. YouTrack has no neutral category names, so a category filter
// is resolved to this project's own state names.

const STATE_NAMES_CACHE = new Map<string, TrackerProviderWorkflowState[]>();

const loadStates = async (call: Call, containerId: string): Promise<TrackerProviderWorkflowState[]> => {
  const stateKey = cacheKey(call, containerId);
  const cached = STATE_NAMES_CACHE.get(stateKey);
  if (cached) return cached;

  // The project-fields endpoint is the precise answer, but it is an admin
  // endpoint and some issue-scoped tokens get an empty list (or 403) from it.
  let states: TrackerProviderWorkflowState[] = [];
  try {
    const fields = await api<YtProjectField[]>(
      call,
      'GET',
      `/api/admin/projects/${seg(containerId)}/customFields`,
      { query: { fields: 'id,name,field(name),bundle(values(id,name,isResolved))' } },
    );
    const stateField = fields.find((field) => (field.bundle?.values ?? []).some(isStateValue));
    states = (stateField?.bundle?.values ?? []).map((value, position) => toWorkflowState(value, position));
  } catch (error) {
    if (!(error instanceof CallError && (error.status === 403 || error.status === 404))) throw error;
  }

  if (states.length === 0) states = await observedStates(call, containerId);
  STATE_NAMES_CACHE.set(stateKey, states);
  return states;
};

/** Fallback for tokens that cannot read project fields: states seen on issues. */
const observedStates = async (
  call: Call,
  containerId: string,
): Promise<TrackerProviderWorkflowState[]> => {
  const container = (await loadProjects(call)).find((entry) => entry.id === containerId);
  if (!container) return [];

  const term = container.key ?? container.name;
  const issues = await api<YtIssue[]>(call, 'GET', '/api/issues', {
    query: {
      query: `project: ${/\s/.test(term) ? `{${term}}` : term}`,
      $top: '100',
      fields: 'id,customFields(name,value(id,name,isResolved))',
    },
  });

  const byName = new Map<string, YtFieldValue>();
  for (const issue of issues) {
    const value = stateOf(issue).value;
    if (value?.name) byName.set(value.name, value);
  }
  return [...byName.values()].map((value, position) => toWorkflowState(value, position));
};

/**
 * The workflow states of every visible project, a few projects at a time. One
 * unreadable workflow is left out; it must not fail the whole list.
 */
const MAX_STATE_CONTAINERS = 40;

const statesForAll = async (
  call: Call,
  containers: TrackerProviderContainer[],
): Promise<TrackerProviderWorkflowState[]> => {
  const queue = [...containers];
  const states: TrackerProviderWorkflowState[] = [];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) return;
      try {
        states.push(...await loadStates(call, next.id));
      } catch (error) {
        console.error(
          `[youtrack] could not read the workflow of ${next.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  });
  await Promise.all(workers);
  return states;
};

/**
 * A neutral category as the project's own state names.
 *
 * On an unscoped "All containers" list the board sends no `containerId`, so
 * the category is resolved across every visible project. The union is safe: a
 * state name keeps its category in every project that shares it, and the
 * project scope beside this clause already limits the answer to those
 * projects. Above 40 visible projects the common workflow names keep the read
 * to one query.
 */
const stateFilterQuery = async (
  call: Call,
  filter: string,
  containerId: string | null,
  containers: TrackerProviderContainer[] | null,
): Promise<string | null> => {
  if (filter === 'all') return null;
  if (filter === 'open') return '#Unresolved';
  if (filter === 'done') return '#Resolved';

  const categories: TrackerProviderStateCategory[] = ['triage', 'backlog', 'todo', 'in-progress', 'canceled'];
  const category = categories.find((value) => value === filter);
  if (!category) return '#Unresolved';

  if (containerId) {
    const states = await loadStates(call, containerId);
    const names = states.filter((state) => state.category === category).map((state) => state.name);
    return stateNameQuery(names) ?? categoryFallback(category);
  }

  const visible = containers ?? await loadProjects(call);
  if (visible.length > MAX_STATE_CONTAINERS) {
    return stateNameQuery(commonStateNames(category)) ?? categoryFallback(category);
  }

  const states = await statesForAll(call, visible);
  const names = [...new Set(
    states.filter((state) => state.category === category).map((state) => state.name),
  )];
  return stateNameQuery(names) ?? categoryFallback(category);
};

// ---------------------------------------------------------------------------
// One handler per call, typed against the SDK.

type Handlers = {
  [M in TrackerProviderMethod]: (
    call: Call,
    input: TrackerProviderInputs[M],
  ) => Promise<TrackerProviderDataByMethod[M]>;
};

const handlers: Handlers = {
  'auth.probe': async (call) => {
    // The probe carries no credential: any server that answers /api/config
    // like YouTrack is one this tracker can work with.
    const response = await outbound.request(call.handle, {
      method: 'GET',
      path: '/api/config',
      query: { fields: 'version' },
      headers: { accept: 'application/json' },
    });
    if (response.status !== 200) {
      return { supported: false, message: `${call.instance} answered ${response.status} to /api/config.` };
    }
    try {
      const config: { version?: unknown } = JSON.parse(response.body);
      return typeof config.version === 'string'
        ? { supported: true }
        : { supported: false, message: `${call.instance} does not look like a YouTrack server.` };
    } catch {
      return { supported: false, message: `${call.instance} did not answer with JSON.` };
    }
  },

  'auth.verify': async (call) => {
    const me = await api<YtUser>(
      call,
      'GET',
      '/api/users/me',
      { query: { fields: 'id,login,name,fullName,email,avatarUrl' } },
    );
    const account: TrackerProviderDataByMethod['auth.verify']['account'] = {
      id: me.id ?? me.login ?? 'me',
      login: me.login ?? null,
    };
    const name = me.fullName ?? me.name;
    if (name) account.name = name;
    const avatarUrl = absolute(call.instance, me.avatarUrl);
    if (avatarUrl) account.avatarUrl = avatarUrl;
    return { account };
  },

  'items.list': async (call, input) => {
    const skip = Math.max(0, Number(input.cursor ?? '0') || 0);
    const parts: string[] = [];

    // The host may pass the open folder. When it does not, the latest
    // top-level session event supplies it. A worktree is resolved to its main
    // checkout before its name becomes a mapping hint.
    const scope = await scopeOf(input, latestSessionDirectory());
    const mapping = await issueMappingOf(call, scope);
    // An explicit container read is the board's own scope. The repository
    // filter applies only to the all-containers list.
    const mapped = !input.containerId && mapping && mapping.projects.length > 0 ? mapping : null;

    if (input.containerId) {
      parts.push(await containerFilterQuery(call, input.containerId));
    } else if (mapped) {
      const scope = projectQuery(mapped.projects);
      if (scope) parts.push(scope);
    } else {
      const scope = projectQuery(await loadProjects(call));
      if (scope) parts.push(scope);
    }

    // Only the issues whose description carries the repo's JSON are repo
    // specific; the metadata issue's project is the scope, not every issue in
    // it. The search term narrows the server side; the description check
    // below is the explicit-schema gate.
    const metadataTerm = mapped
      ? mapped.terms.find((term) => !/\s/.test(term)) ?? mapped.terms[0] ?? null
      : null;
    if (metadataTerm) parts.push(metadataTerm);

    const stateQuery = await stateFilterQuery(
      call,
      input.state,
      input.containerId,
      input.containerId ? null : mapped?.projects ?? null,
    );
    if (stateQuery) parts.push(stateQuery);
    const peopleQuery = peopleFilterQuery(input.people);
    if (peopleQuery) parts.push(peopleQuery);
    const priorityQuery = priorityFilterQuery(input.priority);
    if (priorityQuery) parts.push(priorityQuery);
    if (input.query?.trim()) parts.push(input.query.trim());

    const query: Record<string, string> = {
      fields: ISSUE_FIELDS,
      $top: String(PAGE_SIZE),
      $skip: String(skip),
    };
    if (parts.length > 0) query.query = parts.join(' and ');

    const page = await api<YtIssue[]>(call, 'GET', '/api/issues', { query });
    const items = metadataTerm && scope.hints.length > 0
      ? page.filter((issue) => descriptionMatches(
          issue.description,
          scope.hints.map((hint) => hint.value),
        ))
      : page;
    const hasMore = page.length >= PAGE_SIZE;
    return {
      items: items.map((issue) => toSummary(call.instance, issue)),
      cursor: hasMore ? String(skip + page.length) : null,
      hasMore,
    };
  },

  'items.get': async (call, input) => {
    // The caller may pass the database id, or the readable key when
    // OpenChamber resolved a pasted link or identifier. YouTrack accepts both.
    const issue = await orNull(api<YtIssue>(
      call,
      'GET',
      `/api/issues/${seg(input.id)}`,
      { query: { fields: ISSUE_FIELDS_WITH_COMMENTS } },
    ));
    return { item: issue ? toItem(call.instance, issue) : null };
  },

  'items.updateState': async (call, input) => {
    const current = await api<YtIssue>(
      call,
      'GET',
      `/api/issues/${seg(input.id)}`,
      { query: { fields: `id,idReadable,${ISSUE_FIELDS}` } },
    );
    const field = stateOf(current);

    // Preferred: write the custom field directly. Understands the project's
    // own field name, so a workflow that calls it "Stage" still works.
    const updated = await api<YtIssue>(
      call,
      'POST',
      `/api/issues/${seg(input.id)}`,
      {
        query: { fields: ISSUE_FIELDS },
        body: { customFields: [{ name: field.name, value: { name: input.stateId } }] },
      },
    );

    if (stateOf(updated).value?.name === input.stateId) {
      return { item: toItem(call.instance, updated) };
    }

    // Fallback: a workflow rule may reject a direct field write. The command
    // API goes through the workflow engine.
    await api<unknown>(
      call,
      'POST',
      '/api/commands',
      {
        query: { fields: 'id' },
        body: {
          query: `${field.name} ${/\s/.test(input.stateId) ? `{${input.stateId}}` : input.stateId}`,
          issues: [{ idReadable: current.idReadable ?? input.id }],
        },
      },
    );
    const again = await api<YtIssue>(
      call,
      'GET',
      `/api/issues/${seg(input.id)}`,
      { query: { fields: ISSUE_FIELDS_WITH_COMMENTS } },
    );
    return { item: toItem(call.instance, again) };
  },

  'items.liveSummaries': async (call, input) => {
    // Up to 50 identifiers, each read directly. `items.get` accepts both the
    // database id and the readable key, so no query syntax is involved.
    const items: TrackerProviderLiveSummary[] = [];
    const queue = [...input.identifiers];
    const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        const issue = await orNull(api<YtIssue>(
          call,
          'GET',
          `/api/issues/${seg(next)}`,
          { query: { fields: ISSUE_FIELDS } },
        ));
        if (issue) items.push(toLiveSummary(call.instance, issue));
      }
    });
    await Promise.all(workers);
    return { items };
  },

  'states.list': async (call, input) => ({
    states: await loadStates(call, input.containerId),
  }),

  'containers.list': async (call, input) => {
    // The native mapping UI and the board both read this. A directory on the
    // call, or the latest session folder, warms the issue-description cache so
    // the following items.list does not repeat the search; the container list
    // itself stays complete.
    const scope = await scopeOf(input, latestSessionDirectory());
    if (scope.directory || scope.projectName) {
      try {
        await issueMappingOf(call, scope);
      } catch (error) {
        console.error(
          `[youtrack] could not resolve the project mapping: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { containers: await loadProjects(call) };
  },

  'comments.create': async (call, input) => {
    const comment = await orNull(api<YtComment>(
      call,
      'POST',
      `/api/issues/${seg(input.identifier)}/comments`,
      { query: { fields: 'id,text' }, body: { text: input.body } },
    ));
    return { comment: comment ? { id: comment.id } : null };
  },
};

// ---------------------------------------------------------------------------
// The loopback server OpenChamber talks to.

const failureOf = (error: Error): TrackerProviderError => {
  const failure: TrackerProviderError = {
    message: error.message.slice(0, TRACKER_PROVIDER_ERROR_MESSAGE_MAX) || 'Unexpected failure',
  };
  if (error instanceof TrackerOutboundError) {
    if (error.status >= 400 && error.status <= 599) failure.status = error.status;
    if (/^[A-Z_]{1,64}$/.test(error.code)) failure.code = error.code;
  } else if (error instanceof CallError) {
    failure.status = error.status;
  }
  return failure;
};

const answer = async <M extends TrackerProviderMethod>(
  method: M,
  call: Call,
  input: SourceControlJsonObject,
): Promise<TrackerProviderResult> => {
  try {
    // SAFETY: OpenChamber built and checked `input` for `method`; its shape is
    // `TrackerProviderInputs[M]`. `readTrackerProviderRequest` checks the envelope.
    const data = await handlers[method](call, input as TrackerProviderInputs[M]);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: failureOf(error instanceof Error ? error : new Error(String(error))) };
  }
};

const send = (
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = (req: http.IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => resolve(body));
  req.on('error', reject);
});

const server = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${serviceToken}`) {
    send(res, 401, { error: 'unauthorized' });
    return;
  }
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === '/health') {
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname === SESSION_EVENTS_PATH && req.method === 'POST') {
    readBody(req).then((body) => {
      const event = readSessionEventRequest(body);
      if (!event) {
        send(res, 400, { ok: false, error: 'not a session event this service understands' });
        return;
      }
      const directory = event.event.project.directory;
      const topLevel = event.event.session.parentId === null;
      if (
        topLevel
        && (event.event.type === 'turn-started' || event.event.type === 'session-created')
        && directory
      ) {
        rememberSessionDirectory(directory);
      }
      send(res, 200, { ok: true });
    }).catch(() => send(res, 500, { ok: false, error: 'could not read the event' }));
    return;
  }
  if (url.pathname !== TRACKER_PROVIDER_PATH || req.method !== 'POST') {
    send(res, 404, { error: 'not-found' });
    return;
  }
  readBody(req).then(async (body) => {
    const request = readTrackerProviderRequest(body);
    if (!request) {
      send(res, 400, { error: 'not a tracker call this service understands' });
      return;
    }
    send(res, 200, await answer(
      request.method,
      {
        instance: request.session.instance,
        handle: request.session.handle,
        accountId: request.session.account?.id ?? '',
      },
      request.input,
    ));
  }).catch(() => send(res, 500, { error: 'could not read the request' }));
});

server.listen(port, '127.0.0.1');
