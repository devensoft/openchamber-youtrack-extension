/**
 * YouTrack tracker provider for OpenChamber.
 *
 * OpenChamber posts each tracker call to POST /tracker on this service and
 * keeps the account, its token and the session records. This service only
 * translates between YouTrack's REST API and OpenChamber's neutral tracker
 * shapes. It never sees a credential: every request goes through OpenChamber's
 * outbound proxy with the call's handle.
 *
 * The service also owns the project selection used by the rail panel. The
 * selection is stored under the user's OpenChamber config directory; the host
 * calls /projects through its service proxy.
 *
 * The seven reads and two writes are documented in
 * .opencode/skills/openchamber-extensions/references/youtrack-feasibility.md.
 */
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  TRACKER_PROVIDER_ERROR_MESSAGE_MAX,
  TRACKER_PROVIDER_PATH,
  TrackerOutboundError,
  createTrackerOutbound,
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
  emptyPanelState,
  knownProjectsOf,
  modeOf,
  parseSelectionRequest,
  restrictSelection,
  visibleProjects,
  type PanelMode,
  type PanelProject,
  type PanelState,
  type PanelUser,
  type ProjectAccess,
} from './panel-state.ts';
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

// The rail panel's project selection. One list per YouTrack instance, so a
// later multi-account setup does not mix them. The last known project list is
// kept too, so the panel is usable right after a service restart without
// waiting for the board to call the provider again.
const CONFIG_DIR =
  process.platform === 'win32' && process.env.APPDATA
    ? join(process.env.APPDATA, 'openchamber')
    : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'openchamber');
const CONFIG_PATH = join(CONFIG_DIR, 'youtrack-extension-projects.json');
// OpenChamber's own tracker account store. The service reads only the account
// status from it, never the credential, to tell whether the disconnected panel
// is still showing a cached project list.
const TRACKER_ACCOUNTS_PATH = join(CONFIG_DIR, 'tracker-accounts.json');
const TRACKER_PROVIDER_ID = 'ext-youtrack';

type HostTrackerAccounts = {
  trackers?: Record<string, {
    instance?: string | null;
    accounts?: Array<{ status?: string | null }> | null;
  }>;
};

/**
 * Whether OpenChamber still has a valid account for `instance`. `null` means
 * the account store could not be read, so the cached project list is left
 * alone; a readable store with no valid account means disconnected.
 */
const hostAccountState = async (instance: string): Promise<boolean | null> => {
  try {
    const parsed = JSON.parse(
      await readFile(TRACKER_ACCOUNTS_PATH, 'utf8'),
    ) as HostTrackerAccounts;
    const tracker = parsed.trackers?.[TRACKER_PROVIDER_ID];
    if (!tracker) return false;
    const storedInstance = typeof tracker.instance === 'string' ? tracker.instance : null;
    if (storedInstance && storedInstance !== instance) return false;
    const accounts = Array.isArray(tracker.accounts) ? tracker.accounts : [];
    return accounts.some((account) => account && account.status !== 'invalid');
  } catch {
    return null;
  }
};

let panelState: PanelState = emptyPanelState();
try {
  const parsed = JSON.parse(await readFile(CONFIG_PATH, 'utf8')) as Partial<PanelState>;
  if (parsed && typeof parsed.selectedByInstance === 'object') {
    panelState = {
      selectedByInstance: parsed.selectedByInstance,
      modeByInstance:
        typeof parsed.modeByInstance === 'object' && parsed.modeByInstance ? parsed.modeByInstance : {},
      knownProjects: knownProjectsOf(parsed.knownProjects),
      currentUserByInstance:
        typeof parsed.currentUserByInstance === 'object' && parsed.currentUserByInstance
          ? parsed.currentUserByInstance
          : {},
      lastInstance: typeof parsed.lastInstance === 'string' ? parsed.lastInstance : null,
    };
  }
} catch {
  // First run: no selection file yet.
}

/** Older files have no mode; a non-empty selection means it was in use. */
const modeOfInstance = (instance: string): PanelMode => modeOf(panelState, instance);

const ALL_CONTAINERS = new Map<string, PanelProject[]>(
  Object.entries(panelState.knownProjects),
);
let lastInstance: string | null = panelState.lastInstance;
let savedStateJson = JSON.stringify(panelState);
let writeChain: Promise<void> = Promise.resolve();

const savePanelState = (): Promise<void> => {
  const serialized = JSON.stringify(panelState);
  if (serialized === savedStateJson) return writeChain;
  writeChain = writeChain.then(async () => {
    try {
      await mkdir(CONFIG_DIR, { recursive: true });
      await writeFile(CONFIG_PATH, `${serialized}\n`);
      savedStateJson = serialized;
    } catch (error) {
      console.error(`[youtrack] could not save the project selection: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return writeChain;
};

// ---------------------------------------------------------------------------
// The service's calls to YouTrack.

/** One page of `items.list`. Kept under YouTrack's usual 42-entry collection cap. */
const PAGE_SIZE = 40;

/** Who a call is for: the server it reaches and the handle that reaches it. */
type Call = { instance: string; handle: string };

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
// Search filters. YouTrack has no neutral category names, so a category filter
// is resolved to this project's own state names.

const STATE_NAMES_CACHE = new Map<string, TrackerProviderWorkflowState[]>();

const currentUserFor = async (call: Call): Promise<PanelUser> => {
  const known = panelState.currentUserByInstance[call.instance];
  if (known) return known;

  const me = await api<YtUser>(
    call,
    'GET',
    '/api/users/me',
    { query: { fields: 'id,login' } },
  );
  const user = { id: me.id ?? me.login ?? 'me', login: me.login ?? null };
  panelState.currentUserByInstance[call.instance] = user;
  return user;
};

const loadProjects = async (call: Call): Promise<PanelProject[]> => {
  const user = await currentUserFor(call);
  const projects = new Map<string, YtProject>();
  for (let skip = 0; skip < 5000; skip += 100) {
    const page = await api<YtProject[]>(
      call,
      'GET',
      '/api/admin/projects',
      {
        query: {
          fields: 'id,name,shortName,leader(id),team(allUsersGroup,users(id,login))',
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

  const all = [...projects.values()].map((project) => {
    const team = project.team;
    const isLeader = project.leader?.id === user.id;
    let access: ProjectAccess = 'unknown';
    if (isLeader) {
      access = 'edit';
    } else if (team && Array.isArray(team.users)) {
      access =
        team.allUsersGroup === true
        || team.users.some((member) => member.id === user.id || member.login === user.login)
          ? 'edit'
          : 'read';
    }
    return { ...toContainer(project), access };
  });

  ALL_CONTAINERS.set(call.instance, all);
  lastInstance = call.instance;
  panelState.knownProjects[call.instance] = all;
  panelState.lastInstance = call.instance;
  await savePanelState();
  return all;
};

const loadContainers = async (call: Call): Promise<TrackerProviderContainer[]> => {
  const all = await loadProjects(call);
  const visible = visibleProjects(
    all,
    modeOfInstance(call.instance),
    panelState.selectedByInstance[call.instance] ?? [],
  );
  return visible.map(({ id, key, name }) => ({ id, key, name }));
};

const containerFilterQuery = async (call: Call, containerId: string): Promise<string> => {
  if ((ALL_CONTAINERS.get(call.instance) ?? []).length === 0) {
    await loadContainers(call);
  }
  // Explicit container ids are not limited by the panel selection: a tracked
  // item or a deep link from another project still reads, while only the
  // unscoped list and the Group picker are filtered.
  const container = (ALL_CONTAINERS.get(call.instance) ?? []).find((entry) => entry.id === containerId);
  if (!container) throw new CallError(`Unknown YouTrack project ${containerId}.`, 404);
  return `project: ${quoteTerm(container.key ?? container.name)}`;
};

// ---------------------------------------------------------------------------
// The rail panel's project selector. The panel reads and writes through
// OpenChamber's service proxy; nothing here needs the YouTrack credential.

const projectsAnswer = async () => {
  const instance = lastInstance ?? Object.keys(panelState.selectedByInstance)[0] ?? null;
  const connected = instance ? await hostAccountState(instance) : false;
  if (connected === false) {
    // The account is gone: do not keep showing the last known projects.
    return {
      connected: false,
      instance: null,
      projects: [],
      mode: (instance ? modeOfInstance(instance) : 'all') as PanelMode,
      selected: instance ? panelState.selectedByInstance[instance] ?? [] : [],
      user: null,
      needsLoad: true,
    };
  }
  const projects = instance ? ALL_CONTAINERS.get(instance) ?? [] : [];
  return {
    connected: true,
    instance,
    projects,
    mode: (instance ? modeOfInstance(instance) : 'all') as PanelMode,
    selected: instance ? panelState.selectedByInstance[instance] ?? [] : [],
    user: instance ? panelState.currentUserByInstance[instance] ?? null : null,
    needsLoad: !instance || projects.length === 0,
  };
};

const saveProjects = async (
  body: string,
): Promise<{ instance: string; mode: PanelMode; selected: string[] } | null> => {
  const parsed = parseSelectionRequest(body, lastInstance);
  if (!parsed) return null;

  // The selection outlives the mode. "Show all" is a visibility switch, not a
  // reset: the projects the user picked are kept so switching back to
  // "selected" restores them, and the panel keeps showing them ticked.
  const valid = new Set(
    (ALL_CONTAINERS.get(parsed.instance) ?? []).map((container) => container.id),
  );
  const saved = restrictSelection(parsed, valid);
  if (!saved) return null;

  panelState.modeByInstance[saved.instance] = saved.mode;
  panelState.selectedByInstance[saved.instance] = saved.selected;
  await savePanelState();
  return { instance: saved.instance, mode: saved.mode, selected: saved.selected };
};


const loadStates = async (call: Call, containerId: string): Promise<TrackerProviderWorkflowState[]> => {
  const cacheKey = `${call.instance}\u0000${containerId}`;
  const cached = STATE_NAMES_CACHE.get(cacheKey);
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
  STATE_NAMES_CACHE.set(cacheKey, states);
  return states;
};

/** Fallback for tokens that cannot read project fields: states seen on issues. */
const observedStates = async (
  call: Call,
  containerId: string,
): Promise<TrackerProviderWorkflowState[]> => {
  const container = (await loadContainers(call)).find((entry) => entry.id === containerId);
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

const stateFilterQuery = async (
  call: Call,
  filter: string,
  containerId: string | null,
): Promise<string | null> => {
  if (filter === 'all') return null;
  if (filter === 'open') return '#Unresolved';
  if (filter === 'done') return '#Resolved';

  const categories: TrackerProviderStateCategory[] = ['triage', 'backlog', 'todo', 'in-progress', 'canceled'];
  const category = categories.find((value) => value === filter);
  if (!category) return '#Unresolved';

  if (!containerId) return categoryFallback(category);

  const states = await loadStates(call, containerId);
  const names = states.filter((state) => state.category === category).map((state) => state.name);
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
    // Use the handle from connecting the account to fill the panel's project
    // list. Without this, the panel has nothing to show until the board (or
    // another tracker call) asks for the containers at least once.
    panelState.currentUserByInstance[call.instance] = {
      id: me.id ?? me.login ?? 'me',
      login: me.login ?? null,
    };
    try {
      await loadContainers(call);
    } catch (error) {
      console.error(
        `[youtrack] could not preload projects: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

    if (input.containerId) {
      parts.push(await containerFilterQuery(call, input.containerId));
    } else {
      const scope = projectQuery(await loadContainers(call));
      if (scope) parts.push(scope);
    }
    const stateQuery = await stateFilterQuery(call, input.state, input.containerId);
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
    const hasMore = page.length >= PAGE_SIZE;
    return {
      items: page.map((issue) => toSummary(call.instance, issue)),
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

  'containers.list': async (call) => ({ containers: await loadContainers(call) }),

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
  if (url.pathname === '/projects') {
    if (req.method === 'GET') {
      projectsAnswer()
        .then((answer) => send(res, 200, answer))
        .catch(() => send(res, 500, { error: 'could not read the project list' }));
      return;
    }
    if (req.method === 'PUT') {
      readBody(req)
        .then(async (body) => {
          const saved = await saveProjects(body);
          if (!saved) {
            send(res, 400, { error: 'invalid-selection' });
            return;
          }
          send(res, 200, saved);
        })
        .catch(() => send(res, 500, { error: 'could not read the request' }));
      return;
    }
    send(res, 405, { error: 'method-not-allowed' });
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
      { instance: request.session.instance, handle: request.session.handle },
      request.input,
    ));
  }).catch(() => send(res, 500, { error: 'could not read the request' }));
});

server.listen(port, '127.0.0.1');
