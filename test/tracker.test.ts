import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawn, type ChildProcess } from 'node:child_process';
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
  tracker = startFakeYouTrack('demo');
  fallbackTracker = startFakeYouTrack('demo', { emptyProjectFields: true });
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

    // Verifying the account also fills the panel's project cache, so the panel
    // does not wait for the first board call.
    const panel = await (await serviceRequest('/projects')).json() as {
      mode: string;
      projects: Array<{ id: string }>;
      needsLoad: boolean;
    };
    expect(panel.mode).toBe('all');
    expect(panel.needsLoad).toBe(false);
    expect(panel.projects.length).toBeGreaterThan(0);

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

  test('selects projects through the panel service', async () => {
    await read('containers.list', {});

    const before = await (await serviceRequest('/projects')).json() as {
      instance: string | null;
      projects: Array<{ id: string; access: string }>;
      mode: string;
      selected: string[];
      user: { id: string; login: string | null } | null;
      needsLoad: boolean;
    };
    expect(before.instance).toBe(tracker.origin);
    expect(before.projects.map((project) => project.id)).toEqual(expect.arrayContaining(['p-proj', 'p-ops']));
    expect(before.projects.find((project) => project.id === 'p-proj')?.access).toBe('edit');
    expect(before.projects.find((project) => project.id === 'p-ops')?.access).toBe('read');
    expect(before.user).toMatchObject({ id: 'u-1', login: 'mona' });
    expect(before.mode).toBe('all');
    expect(before.selected).toEqual([]);
    expect(before.needsLoad).toBe(false);

    const saved = await serviceRequest('/projects', {
      method: 'PUT',
      body: JSON.stringify({ instance: before.instance, mode: 'selected', selected: ['p-proj'] }),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ mode: 'selected', selected: ['p-proj'] });

    const { containers } = await read('containers.list', {});
    expect(containers.map((container) => container.key)).toEqual(['PROJ']);

    const list = await read('items.list', LIST);
    expect(list.items.every((item) => item.container?.key === 'PROJ')).toBe(true);
    expect(list.items.map((item) => item.identifier)).toEqual(['PROJ-1', 'PROJ-2']);

    const explicit = await read('items.list', { ...LIST, containerId: 'p-ops' });
    expect(explicit.items.map((item) => item.identifier)).toEqual(['OPS-1']);

    const file = join(home, '.config', 'openchamber', 'youtrack-extension-projects.json');
    const persisted = JSON.parse(readFileSync(file, 'utf8')) as {
      modeByInstance: Record<string, string>;
      selectedByInstance: Record<string, string[]>;
    };
    expect(persisted.modeByInstance[tracker.origin]).toBe('selected');
    expect(persisted.selectedByInstance[tracker.origin]).toEqual(['p-proj']);

    // Show all is a visibility switch: the picked project stays selected so
    // the panel, and switching back, keep it.
    const showAll = await serviceRequest('/projects', {
      method: 'PUT',
      body: JSON.stringify({ instance: before.instance, mode: 'all', selected: ['p-proj'] }),
    });
    expect(showAll.status).toBe(200);
    expect(await showAll.json()).toMatchObject({ mode: 'all', selected: ['p-proj'] });

    const panel = await (await serviceRequest('/projects')).json() as {
      mode: string;
      selected: string[];
    };
    expect(panel).toMatchObject({ mode: 'all', selected: ['p-proj'] });

    const shownAll = await read('containers.list', {});
    expect(shownAll.containers.map((container) => container.key)).toEqual(
      expect.arrayContaining(['PROJ', 'OPS']),
    );
    // The unscoped list (what the composer picker asks for) follows the mode.
    const unscoped = await read('items.list', LIST);
    expect(unscoped.items.map((item) => item.identifier)).toEqual(['PROJ-1', 'PROJ-2', 'OPS-1']);

    const kept = JSON.parse(readFileSync(file, 'utf8')) as {
      modeByInstance: Record<string, string>;
      selectedByInstance: Record<string, string[]>;
    };
    expect(kept.modeByInstance[tracker.origin]).toBe('all');
    expect(kept.selectedByInstance[tracker.origin]).toEqual(['p-proj']);

    // Switching back restores only the saved project, with no restart and no
    // separate call to reload the containers.
    const showSelected = await serviceRequest('/projects', {
      method: 'PUT',
      body: JSON.stringify({ instance: before.instance, mode: 'selected', selected: ['p-proj'] }),
    });
    expect(showSelected.status).toBe(200);
    const restored = await read('containers.list', {});
    expect(restored.containers.map((container) => container.key)).toEqual(['PROJ']);
    const scoped = await read('items.list', LIST);
    expect(scoped.items.map((item) => item.identifier)).toEqual(['PROJ-1', 'PROJ-2']);

    const emptySelection = await serviceRequest('/projects', {
      method: 'PUT',
      body: JSON.stringify({ instance: before.instance, mode: 'selected', selected: [] }),
    });
    expect(emptySelection.status).toBe(400);

    const reset = await serviceRequest('/projects', {
      method: 'PUT',
      body: JSON.stringify({ instance: before.instance, mode: 'all', selected: [] }),
    });
    expect(reset.status).toBe(200);
    expect(await reset.json()).toMatchObject({ mode: 'all', selected: [] });

    const all = await read('containers.list', {});
    expect(all.containers.length).toBeGreaterThan(1);
  });

  test('hides the cached project list when the host account is disconnected', async () => {
    const accountPath = join(home, '.config', 'openchamber', 'tracker-accounts.json');
    const selection = await serviceRequest('/projects', {
      method: 'PUT',
      body: JSON.stringify({ instance: tracker.origin, mode: 'selected', selected: ['p-proj'] }),
    });
    expect(selection.status).toBe(200);

    writeFileSync(accountPath, JSON.stringify({
      trackers: {
        'ext-youtrack': { instance: tracker.origin, activeAccountId: null, accounts: [] },
      },
    }));
    const offline = await (await serviceRequest('/projects')).json() as {
      connected: boolean;
      instance: string | null;
      projects: unknown[];
      selected: string[];
      needsLoad: boolean;
    };
    expect(offline.connected).toBe(false);
    expect(offline.instance).toBeNull();
    expect(offline.projects).toEqual([]);
    expect(offline.selected).toEqual(['p-proj']);
    expect(offline.needsLoad).toBe(true);

    writeFileSync(accountPath, JSON.stringify({
      trackers: {
        'ext-youtrack': {
          instance: tracker.origin,
          activeAccountId: 'u-1',
          accounts: [{ id: 'u-1', status: 'valid' }],
        },
      },
    }));
    const back = await (await serviceRequest('/projects')).json() as {
      connected: boolean;
      instance: string | null;
      projects: Array<{ id: string }>;
      selected: string[];
      needsLoad: boolean;
    };
    expect(back.connected).toBe(true);
    expect(back.instance).toBe(tracker.origin);
    expect(back.projects.map((project) => project.id)).toEqual(
      expect.arrayContaining(['p-proj', 'p-ops']),
    );
    expect(back.selected).toEqual(['p-proj']);
    expect(back.needsLoad).toBe(false);

    rmSync(accountPath, { force: true });
    const reset = await serviceRequest('/projects', {
      method: 'PUT',
      body: JSON.stringify({ instance: tracker.origin, mode: 'all', selected: [] }),
    });
    expect(reset.status).toBe(200);
  });

  test('restores the saved mode and selection when the service starts', async () => {
    const restartHome = mkdtempSync(join(tmpdir(), 'youtrack-provider-restart-'));
    const configDir = join(restartHome, '.config', 'openchamber');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, 'youtrack-extension-projects.json'),
      JSON.stringify({
        modeByInstance: { 'https://youtrack.example.com': 'selected' },
        selectedByInstance: { 'https://youtrack.example.com': ['p-proj'] },
        knownProjects: {
          'https://youtrack.example.com': [
            { id: 'p-proj', key: 'PROJ', name: 'Project' },
            { id: 'p-ops', key: 'OPS', name: 'Operations' },
          ],
        },
        lastInstance: 'https://youtrack.example.com',
      }),
    );

    const restartPort = await freePort();
    const restartToken = randomBytes(16).toString('hex');
    const restarted = spawn('node', [serviceEntry], {
      env: {
        PATH: process.env.PATH,
        HOME: restartHome,
        OPENCHAMBER_SERVICE_PORT: String(restartPort),
        OPENCHAMBER_SERVICE_TOKEN: restartToken,
        [OPENCHAMBER_HOST_CALLBACK_URL]: `http://127.0.0.1:${callback.port}`,
      },
      stdio: 'ignore',
    });

    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        ready = await fetch(`http://127.0.0.1:${restartPort}/health`, {
          headers: { authorization: `Bearer ${restartToken}` },
        }).then((response) => response.ok).catch(() => false);
        if (ready) break;
        await Bun.sleep(50);
      }
      expect(ready).toBe(true);

      const answer = await fetch(`http://127.0.0.1:${restartPort}/projects`, {
        headers: { authorization: `Bearer ${restartToken}` },
      }).then((response) => response.json()) as {
        mode: string;
        selected: string[];
        needsLoad: boolean;
        projects: Array<{ id: string }>;
      };
      expect(answer.mode).toBe('selected');
      expect(answer.selected).toEqual(['p-proj']);
      expect(answer.needsLoad).toBe(false);
      expect(answer.projects.map((project) => project.id)).toEqual(['p-proj', 'p-ops']);
    } finally {
      restarted.kill();
      rmSync(restartHome, { recursive: true, force: true });
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
});
