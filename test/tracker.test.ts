import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  OPENCHAMBER_HOST_CALLBACK_URL,
  SOURCE_CONTROL_OUTBOUND_METHODS,
  TRACKER_OUTBOUND_PATH,
  TRACKER_PROVIDER_PATH,
  isTrackerProviderWriteMethod,
  type TrackerProviderDataByMethod,
  type TrackerProviderInputs,
  type TrackerProviderMethod,
} from '@openchamber/sdk';
import { trackerProviderSchemasV1 as schemas } from '@openchamber/sdk/schemas';

import { startFakeYouTrack, type FakeYouTrack } from './fake-youtrack.ts';

/**
 * Runs the checked-in service bundle the way OpenChamber does: a loopback port
 * and bearer, a callback listener that plays OpenChamber's outbound proxy
 * (handle → origin, token, allowed methods), and a fake YouTrack behind it.
 */

const serviceEntry = fileURLToPath(new URL('../service/main.js', import.meta.url));
const PROVIDER = 'ext-youtrack';
const READ_ONLY: readonly string[] = ['GET'];

const freePort = () => new Promise<number>((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const { port } = Object(server.address());
    server.close(() => resolve(Number(port)));
  });
});

let tracker: FakeYouTrack;
let fallbackTracker: FakeYouTrack;
let service: ChildProcess;
let servicePort: number;
const serviceToken = randomBytes(16).toString('hex');
const home = mkdtempSync(join(tmpdir(), 'youtrack-provider-'));
const handles = new Map<string, { origin: string; token: string | null; methods: readonly string[] }>();
let callback: ReturnType<typeof Bun.serve>;

beforeAll(async () => {
  tracker = startFakeYouTrack();
  fallbackTracker = startFakeYouTrack({ emptyProjectFields: true });
  callback = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      const grant = handles.get((request.headers.get('authorization') ?? '').replace(/^Bearer /, ''));
      if (new URL(request.url).pathname !== TRACKER_OUTBOUND_PATH || !grant) {
        return Response.json({ error: { message: 'Unknown handle', code: 'HANDLE_UNKNOWN' } }, { status: 403 });
      }
      const outbound = schemas.outboundRequest.safeParse(await request.json());
      if (!outbound.success) {
        return Response.json({ error: { message: 'Malformed request', code: 'BAD_REQUEST' } }, { status: 400 });
      }
      if (!grant.methods.includes(outbound.data.method)) {
        return Response.json(
          { error: { message: `A read's handle sends GET; ${outbound.data.method} is refused`, code: 'METHOD_NOT_ALLOWED' } },
          { status: 403 },
        );
      }
      const url = new URL(outbound.data.path, grant.origin);
      if (url.origin !== grant.origin) {
        return Response.json({ error: { message: 'Off the instance', code: 'OFF_ORIGIN' } }, { status: 403 });
      }
      for (const [key, value] of Object.entries(outbound.data.query ?? {})) url.searchParams.set(key, value);
      const headers = new Headers(outbound.data.headers);
      if (grant.token) headers.set('authorization', `Bearer ${grant.token}`);
      const answer = await fetch(url, {
        method: outbound.data.method,
        headers,
        body: outbound.data.body,
        redirect: 'manual',
      });
      return Response.json({
        status: answer.status,
        headers: { 'content-type': answer.headers.get('content-type') ?? '' },
        body: await answer.text(),
      });
    },
  });

  servicePort = await freePort();
  service = spawn('node', [serviceEntry], {
    env: {
      PATH: process.env.PATH,
      HOME: home,
      OPENCHAMBER_SERVICE_PORT: String(servicePort),
      OPENCHAMBER_SERVICE_TOKEN: serviceToken,
      [OPENCHAMBER_HOST_CALLBACK_URL]: `http://127.0.0.1:${callback.port}`,
    },
    stdio: 'ignore',
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await fetch(`http://127.0.0.1:${servicePort}/health`, {
      headers: { authorization: `Bearer ${serviceToken}` },
    }).then((response) => response.ok).catch(() => false);
    if (ready) return;
    await Bun.sleep(50);
  }
  throw new Error('the YouTrack provider service did not become ready');
});

afterAll(async () => {
  service?.kill();
  callback?.stop(true);
  await tracker?.close();
  await fallbackTracker?.close();
  rmSync(home, { recursive: true, force: true });
});

const ACCOUNT = { id: 'u-1', login: 'mona' };
let requests = 0;

type CallOptions<M extends TrackerProviderMethod> = {
  token: string | null;
  account?: { id: string; login: string | null } | null;
  input?: TrackerProviderInputs[M];
  methods?: readonly string[];
  origin?: string;
};

/** One forwarded call with a fresh handle, the way OpenChamber mints one per call. */
const call = async <M extends TrackerProviderMethod>(method: M, options: CallOptions<M>) => {
  const origin = options.origin ?? tracker.origin;
  const handle = randomBytes(16).toString('base64url');
  handles.set(handle, {
    origin,
    token: options.token,
    methods: options.methods ?? (isTrackerProviderWriteMethod(method) ? SOURCE_CONTROL_OUTBOUND_METHODS : READ_ONLY),
  });
  try {
    const response = await fetch(`http://127.0.0.1:${servicePort}${TRACKER_PROVIDER_PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${serviceToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        v: 1,
        requestId: `req-${requests += 1}`,
        method,
        provider: PROVIDER,
        session: { instance: origin, handle, account: options.account ?? null },
        input: options.input ?? {},
      }),
    });
    expect(response.status).toBe(200);
    return schemas.envelope.parse(await response.json());
  } finally {
    handles.delete(handle);
  }
};

/** A call as the connected account that must succeed; parsed the way OpenChamber parses it. */
const read = async <M extends TrackerProviderMethod>(
  method: M,
  input: TrackerProviderInputs[M],
  origin = tracker.origin,
) => {
  const result = await call(method, { token: 'demo', account: ACCOUNT, input, origin });
  if (!result.ok) throw new Error(`${method} failed: ${result.error.message}`);
  const parsed = schemas.data[method].safeParse(result.data);
  if (!parsed.success) throw new Error(`${method} does not match its schema: ${parsed.error.message}`);
  return parsed.data as TrackerProviderDataByMethod[M];
};

const serviceRequest = (path: string, init: RequestInit = {}) =>
  fetch(`http://127.0.0.1:${servicePort}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

const LIST: TrackerProviderInputs['items.list'] = { state: 'open', people: 'any', priority: 'all', containerId: null };

describe('YouTrack tracker provider', () => {
  test('probes without a token and verifies the account', async () => {
    expect(await call('auth.probe', { token: null })).toEqual({ ok: true, data: { supported: true } });

    const verified = await read('auth.verify', {});
    expect(verified.account).toMatchObject({ id: 'u-1', login: 'mona', name: 'Mona Teapot' });
    expect(verified.account.avatarUrl).toBe(`${tracker.origin}/hub/api/rest/avatar/mona?s=48`);

    const refused = await call('auth.verify', { token: 'wrong' });
    expect(refused).toMatchObject({ ok: false, error: { status: 401 } });
  });

  test('lists projects as containers', async () => {
    const { containers } = await read('containers.list', {});
    expect(containers.length).toBeGreaterThan(0);
    for (const container of containers) {
      expect(container.id).toEqual(expect.any(String));
      expect(container.name).toEqual(expect.any(String));
      expect(container.key === null || typeof container.key === 'string').toBe(true);
    }
    expect(containers.map((container) => container.key)).toEqual(expect.arrayContaining(['PROJ', 'OPS']));
  });

  test('scopes an items list to the issue JSON of the open folder', async () => {
    const mapped = startFakeYouTrack({ mappingProject: true });
    const gitFolder = mkdtempSync(join(tmpdir(), 'openchamber-git-'));

    try {
      execFileSync('git', ['init', gitFolder], { stdio: 'ignore' });
      execFileSync('git', ['-C', gitFolder, 'remote', 'add', 'origin',
        'https://github.com/acme/example.git'], { stdio: 'ignore' });

      const input = {
        ...LIST,
        directory: gitFolder,
        projectName: 'example',
      } as TrackerProviderInputs['items.list'];

      const listed = await read('items.list', input, mapped.origin);
      expect(listed.items.map((item) => item.identifier)).toEqual(['EXAMPLE-1']);

      // The native project mapping still sees every container; only the list
      // is scoped to the issue whose description names the repository.
      const { containers } = await read('containers.list', {}, mapped.origin);
      expect(containers.map((container) => container.key))
        .toEqual(expect.arrayContaining(['PROJ', 'OPS', 'EXAMPLE']));

      // Without the native directory the list keeps the native all-projects
      // behavior: EXAMPLE-2 is no longer excluded.
      const native = await read('items.list', LIST, mapped.origin);
      expect(native.items.map((item) => item.identifier))
        .toEqual(expect.arrayContaining(['PROJ-1', 'PROJ-2', 'OPS-1', 'EXAMPLE-2']));
    } finally {
      rmSync(gitFolder, { recursive: true, force: true });
      await mapped.close();
    }
  });

  test('reads the project workflow states and infers neutral categories', async () => {
    const { states } = await read('states.list', { containerId: 'p-proj' });
    expect(states.map((state) => [state.id, state.name, state.category])).toEqual([
      ['Submitted', 'Submitted', 'todo'],
      ['Open', 'Open', 'todo'],
      ['In Progress', 'In Progress', 'in-progress'],
      ['Fixed', 'Fixed', 'done'],
      ['Verified', 'Verified', 'done'],
      ["Won't fix", "Won't fix", 'canceled'],
      ['Pending Deploy', 'Pending Deploy', 'in-progress'],
    ]);
  });

  test('falls back to observed states when project fields are unavailable', async () => {
    const { states } = await read('states.list', { containerId: 'p-proj' }, fallbackTracker.origin);
    expect(states.map((state) => [state.name, state.category])).toEqual([
      ['Open', 'todo'],
      ['In Progress', 'in-progress'],
      ['Fixed', 'done'],
    ]);
  });

  test('lists unresolved, resolved, category, priority, and text filters', async () => {
    expect((await read('items.list', LIST)).items.map((item) => item.identifier)).toEqual([
      'PROJ-1',
      'PROJ-2',
      'OPS-1',
    ]);
    expect((await read('items.list', { ...LIST, state: 'done' })).items.map((item) => item.identifier)).toEqual(['PROJ-3']);
    expect(
      (await read('items.list', { ...LIST, state: 'in-progress', containerId: 'p-proj' })).items.map((item) => item.identifier),
    ).toEqual(['PROJ-2']);
    expect(
      (await read('items.list', { ...LIST, state: 'in-progress', containerId: 'p-ops' })).items.map((item) => item.identifier),
    ).toEqual([]);
    expect((await read('items.list', { ...LIST, priority: 'urgent' })).items.map((item) => item.identifier)).toEqual([
      'PROJ-1',
      'OPS-1',
    ]);
    expect((await read('items.list', { ...LIST, state: 'all', query: 'CSV' })).items.map((item) => item.identifier)).toEqual([
      'PROJ-2',
    ]);
  });

  test('builds a neutral item with state, priority, labels, assignee, container and comments', async () => {
    const { item } = await read('items.get', { id: 'PROJ-1' });
    expect(item).toMatchObject({
      id: '2-1',
      identifier: 'PROJ-1',
      title: 'Login fails on Safari',
      url: `${tracker.origin}/issue/PROJ-1`,
      state: { id: 's-open', name: 'Open', category: 'todo' },
      priority: 'urgent',
      labels: [{ id: 't-bug', name: 'bug', color: '#e5484d' }],
      assignee: { name: 'Mona Teapot', avatarUrl: `${tracker.origin}/hub/api/rest/avatar/mona?s=48` },
      container: { id: 'p-proj', key: 'PROJ', name: 'Probe Project' },
      description: 'Open the app in Safari and press sign in.',
    });
    expect(item?.comments).toEqual([
      {
        id: 'c-1',
        body: 'Reproduced on 17.4.',
        createdAt: '2026-10-30T09:10:00.000Z',
        author: { name: 'Octo Kettle', avatarUrl: null },
      },
    ]);
    expect(item && 'provider' in item).toBe(false);

    // A pasted database id resolves to the same issue as the readable key.
    const byId = await read('items.get', { id: '2-1' });
    expect(byId.item?.identifier).toBe('PROJ-1');
  });

  test('returns null for an unknown item', async () => {
    expect(await read('items.get', { id: 'PROJ-404' })).toEqual({ item: null });
  });

  test('reports live summaries and leaves unknown identifiers out', async () => {
    const { items } = await read('items.liveSummaries', { identifiers: ['PROJ-1', 'PROJ-404', 'OPS-1'] });
    expect(items.map((item) => item.identifier).sort()).toEqual(['OPS-1', 'PROJ-1']);
  });

  test('changes an item state and reads the new state back', async () => {
    const updated = await read('items.updateState', { id: 'PROJ-1', stateId: 'In Progress' });
    expect(updated.item?.state).toMatchObject({ name: 'In Progress', category: 'in-progress' });

    const reread = await read('items.get', { id: 'PROJ-1' });
    expect(reread.item?.state).toMatchObject({ name: 'In Progress', category: 'in-progress' });
  });

  test('posts a session comment', async () => {
    const result = await read('comments.create', {
      identifier: 'PROJ-1',
      body: '[OpenChamber session completed](https://example.com/?session=abc)',
    });
    expect(result.comment).toEqual({ id: 'c-11' });

    const reread = await read('items.get', { id: 'PROJ-1' });
    expect(reread.item?.comments?.at(-1)?.body)
      .toBe('[OpenChamber session completed](https://example.com/?session=abc)');
  });

  test('a write through a read handle is refused and surfaces as an error', async () => {
    const refused = await call('items.updateState', {
      token: 'demo',
      account: ACCOUNT,
      input: { id: 'PROJ-2', stateId: 'Fixed' },
      methods: READ_ONLY,
    });
    expect(refused).toMatchObject({ ok: false, error: { status: 403, code: 'METHOD_NOT_ALLOWED' } });
  });

  test('recognises only a YouTrack config at the probe', async () => {
    const notYoutrack = startFakeYouTrack({ config: { body: JSON.stringify({ name: 'not youtrack' }) } });
    const notJson = startFakeYouTrack({ config: { body: '<html>not json</html>' } });
    const failing = startFakeYouTrack({ config: { status: 500, body: '{}' } });

    try {
      expect(await call('auth.probe', { token: null, origin: notYoutrack.origin })).toMatchObject({
        ok: true,
        data: { supported: false, message: expect.stringContaining('does not look like a YouTrack server') },
      });
      expect(await call('auth.probe', { token: null, origin: notJson.origin })).toMatchObject({
        ok: true,
        data: { supported: false, message: expect.stringContaining('did not answer with JSON') },
      });
      expect(await call('auth.probe', { token: null, origin: failing.origin })).toMatchObject({
        ok: true,
        data: { supported: false, message: expect.stringContaining('answered 500 to /api/config') },
      });
    } finally {
      await Promise.all([notYoutrack.close(), notJson.close(), failing.close()]);
    }
  });

  test('pages a long item list with the cursor', async () => {
    const paged = startFakeYouTrack({ generatedIssues: 45 });
    try {
      const first = await read('items.list', LIST, paged.origin);
      expect(first.items).toHaveLength(40);
      expect(first.hasMore).toBe(true);
      expect(first.cursor).toBe('40');

      const cursor = first.cursor ?? '0';
      const second = await read('items.list', { ...LIST, cursor }, paged.origin);
      expect(second.items).toHaveLength(8);
      expect(second.hasMore).toBe(false);
      expect(second.cursor).toBeNull();

      const seen = new Set(first.items.map((item) => item.id));
      expect(second.items.every((item) => !seen.has(item.id))).toBe(true);
    } finally {
      await paged.close();
    }
  });

  test('filters by assignee and reporter', async () => {
    const people = startFakeYouTrack({
      extraIssues: [{
        identifier: 'PROJ-10',
        summary: 'Alex owns this',
        state: 'Open',
        assignee: { login: 'alex', fullName: 'Alex Doe' },
        reporter: { login: 'alex', fullName: 'Alex Doe' },
      }],
    });
    try {
      const mine = await read('items.list', { ...LIST, people: 'me' }, people.origin);
      expect(mine.items.map((item) => item.identifier)).toEqual(['PROJ-1', 'PROJ-2', 'OPS-1']);

      const created = await read('items.list', { ...LIST, people: 'created' }, people.origin);
      expect(created.items.map((item) => item.identifier)).toEqual(['PROJ-1', 'PROJ-2', 'OPS-1']);

      const any = await read('items.list', { ...LIST, people: 'any' }, people.origin);
      expect(any.items.map((item) => item.identifier)).toEqual(['PROJ-1', 'PROJ-2', 'OPS-1', 'PROJ-10']);
    } finally {
      await people.close();
    }
  });

  test('maps every priority level to its project names', async () => {
    const all = { ...LIST, state: 'all' };
    expect((await read('items.list', { ...all, priority: 'high' })).items).toEqual([]);
    expect((await read('items.list', { ...all, priority: 'medium' })).items.map((item) => item.identifier))
      .toEqual(['PROJ-2']);
    expect((await read('items.list', { ...all, priority: 'low' })).items.map((item) => item.identifier))
      .toEqual(['PROJ-3']);
    expect((await read('items.list', { ...all, priority: 'none' })).items).toHaveLength(4);
    // A category with no state in the project falls back to unresolved.
    expect(
      (await read('items.list', { ...LIST, state: 'triage', containerId: 'p-proj' })).items
        .map((item) => item.identifier),
    ).toEqual(['PROJ-1', 'PROJ-2']);
  });

  test('refuses an unknown project id instead of listing the wrong project', async () => {
    const refused = await call('items.list', {
      token: 'demo',
      account: ACCOUNT,
      input: { ...LIST, containerId: 'p-nope' },
    });
    expect(refused).toMatchObject({
      ok: false,
      error: { status: 404, message: expect.stringContaining('Unknown YouTrack project p-nope') },
    });
  });

  test('answers null for a comment on an unknown issue', async () => {
    expect(await read('comments.create', { identifier: 'PROJ-404', body: 'nothing to attach to' }))
      .toEqual({ comment: null });
  });

  test('writes the state through the command API when a workflow ignores the field write', async () => {
    const workflow = startFakeYouTrack({ ignoreDirectStateWrite: true });
    try {
      const updated = await read(
        'items.updateState',
        { id: 'PROJ-1', stateId: 'In Progress' },
        workflow.origin,
      );
      expect(updated.item?.state).toMatchObject({ name: 'In Progress', category: 'in-progress' });
      // The fallback runs through the workflow engine, bracing the spaced name.
      expect(workflow.commandQueries).toEqual(['State {In Progress}']);
    } finally {
      await workflow.close();
    }
  });

  test('falls back to observed states when project fields are forbidden', async () => {
    const forbidden = startFakeYouTrack({ projectFieldsStatus: 403 });
    try {
      const { states } = await read('states.list', { containerId: 'p-proj' }, forbidden.origin);
      expect(states.map((state) => [state.name, state.category])).toEqual([
        ['Open', 'todo'],
        ['In Progress', 'in-progress'],
        ['Fixed', 'done'],
      ]);
    } finally {
      await forbidden.close();
    }
  });

  test('refuses an unauthenticated or malformed service request', async () => {
    const serviceUrl = `http://127.0.0.1:${servicePort}`;

    expect((await fetch(`${serviceUrl}/health`)).status).toBe(401);
    expect(await fetch(`${serviceUrl}/health`, {
      headers: { authorization: `Bearer ${serviceToken}` },
    }).then((response) => response.status)).toBe(200);
    expect((await fetch(`${serviceUrl}/health`, {
      headers: { authorization: 'Bearer not-the-service-token' },
    })).status).toBe(401);

    expect((await serviceRequest(TRACKER_PROVIDER_PATH, {
      method: 'POST',
      body: JSON.stringify({ v: 1 }),
    })).status).toBe(400);
    expect((await serviceRequest(TRACKER_PROVIDER_PATH, { method: 'GET' })).status).toBe(404);
    expect((await serviceRequest('/not-a-route')).status).toBe(404);
  });
});
