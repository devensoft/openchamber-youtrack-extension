/**
 * A small in-memory YouTrack stand-in for the tracker test.
 *
 * It implements only the endpoints the provider calls, with just enough of
 * YouTrack's search syntax to exercise the query builder. It is not a YouTrack
 * emulator: it exists so the nine provider calls can be run end to end.
 */

export type FakeState = { id: string; name: string; isResolved: boolean; position: number };

export type FakeIssue = {
  id: string;
  idReadable: string;
  summary: string;
  description: string;
  created: number;
  updated: number;
  resolved: number | null;
  projectId: string;
  state: FakeState;
  priority: string;
  assignee: { login: string; fullName: string; avatarUrl: string } | null;
  reporter: { login: string; fullName: string } | null;
  type?: string;
  tags: Array<{ id: string; name: string; color: { id: string } }>;
  comments: Array<{ id: string; text: string; created: number; author: { login: string; fullName: string } | null }>;
};

type Project = {
  id: string;
  name: string;
  shortName: string;
  states: FakeState[];
  leader?: { id: string; login: string };
  team?: { users: Array<{ id: string; login: string }>; allUsersGroup: boolean };
};

const STATES: FakeState[] = [
  { id: 's-submitted', name: 'Submitted', isResolved: false, position: 0 },
  { id: 's-open', name: 'Open', isResolved: false, position: 1 },
  { id: 's-progress', name: 'In Progress', isResolved: false, position: 2 },
  { id: 's-fixed', name: 'Fixed', isResolved: true, position: 3 },
  { id: 's-verified', name: 'Verified', isResolved: true, position: 4 },
  { id: 's-wontfix', name: "Won't fix", isResolved: true, position: 5 },
  { id: 's-pending-deploy', name: 'Pending Deploy', isResolved: false, position: 6 },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const state = (name: string): FakeState => {
  const found = STATES.find((entry) => entry.name === name);
  if (!found) throw new Error(`unknown state ${name}`);
  return clone(found);
};

const makeIssue = (
  id: string,
  idReadable: string,
  summary: string,
  description: string,
  stateName: string,
  priority: string,
  options: Partial<FakeIssue> = {},
): FakeIssue => ({
  id,
  idReadable,
  summary,
  description,
  created: Date.UTC(2026, 9, 1, 9, 0, 0),
  updated: Date.UTC(2026, 9, 30, 9, 0, 0),
  resolved: null,
  projectId: idReadable.startsWith('OPS') ? 'p-ops' : 'p-proj',
  state: state(stateName),
  priority,
  assignee: { login: 'mona', fullName: 'Mona Teapot', avatarUrl: '/hub/api/rest/avatar/mona?s=48' },
  reporter: { login: 'mona', fullName: 'Mona Teapot' },
  type: options.type ?? 'Bug',
  tags: [],
  comments: [],
  ...options,
});

const PROJECTS: Project[] = [
  {
    id: 'p-proj',
    name: 'Probe Project',
    shortName: 'PROJ',
    states: STATES.map(clone),
    leader: { id: 'u-1', login: 'mona' },
    team: { users: [{ id: 'u-1', login: 'mona' }], allUsersGroup: false },
  },
  {
    id: 'p-ops',
    name: 'Operations',
    shortName: 'OPS',
    states: STATES.map(clone),
    team: { users: [{ id: 'u-2', login: 'alex' }], allUsersGroup: false },
  },
];

const ISSUES: FakeIssue[] = [
  makeIssue(
    '2-1',
    'PROJ-1',
    'Login fails on Safari',
    'Open the app in Safari and press sign in.',
    'Open',
    'Critical',
    {
      tags: [{ id: 't-bug', name: 'bug', color: { id: '#e5484d' } }],
      comments: [
        { id: 'c-1', text: 'Reproduced on 17.4.', created: Date.UTC(2026, 9, 30, 9, 10, 0), author: { login: 'octo', fullName: 'Octo Kettle' } },
      ],
      type: 'Bug',
    },
  ),
  makeIssue('2-2', 'PROJ-2', 'CSV export missing header', 'The export starts at the first data row.', 'In Progress', 'Normal', {
    type: 'Enhancement',
  }),
  makeIssue('2-3', 'PROJ-3', 'Slow workspace switch', 'Switching takes about eight seconds.', 'Fixed', 'Minor', {
    resolved: Date.UTC(2026, 9, 29, 12, 0, 0),
    type: 'Refactor',
  }),
  makeIssue('3-1', 'OPS-1', 'Rotate the deploy key', 'Quarterly rotation.', 'Open', 'Critical', {
    type: 'Task',
  }),
];

const findIssue = (idOrKey: string): FakeIssue | undefined => ISSUES.find(
  (issue) => issue.id === idOrKey || issue.idReadable.toLowerCase() === idOrKey.toLowerCase(),
);

/** One `key: value` clause of a YouTrack search string, up to the next `and`. */
const clause = (query: string, key: string): string | null => {
  const atStart = new RegExp(`^${key}:\\s*(.*?)(?=\\s+and\\s+|$)`, 'i');
  const afterAnd = new RegExp(`\\s+and\\s+${key}:\\s*(.*?)(?=\\s+and\\s+|$)`, 'i');
  return query.match(atStart)?.[1] ?? query.match(afterAnd)?.[1] ?? null;
};

const namesOf = (value: string): string[] => value
  .split(',')
  .map((part) => part.trim().replace(/^\{/, '').replace(/\}$/, ''))
  .filter(Boolean);

const matchesQuery = (issue: FakeIssue, raw: string | null): boolean => {
  if (!raw) return true;
  const query = raw.trim();
  if (!query) return true;

  if (query.includes('#Resolved') && issue.resolved === null) return false;
  if (query.includes('#Unresolved') && issue.resolved !== null) return false;

  const projectClause = clause(query, 'project');
  if (projectClause) {
    const project = PROJECTS.find((entry) => entry.id === issue.projectId);
    const names = namesOf(projectClause);
    if (!project || !names.some((name) => name === project.shortName || name === project.name)) return false;
  }

  const stateClause = clause(query, 'State');
  if (stateClause && !namesOf(stateClause).includes(issue.state.name)) return false;

  const priorityClause = clause(query, 'Priority');
  if (priorityClause && !namesOf(priorityClause).includes(issue.priority)) return false;

  if (query.includes('for: me') && issue.assignee?.login !== 'mona') return false;
  if (query.includes('created by: me') && issue.reporter?.login !== 'mona') return false;

  let rest = query;
  for (const key of ['project', 'State', 'Priority', 'for', 'created by']) {
    rest = rest.replace(new RegExp(`(?:^|\\s+and\\s+)${key}:\\s*.*?(?=\\s+and\\s+|$)`, 'gi'), '');
  }
  rest = rest.replace(/\band\b/gi, ' ').replace(/#\w+/g, ' ').replace(/\s+/g, ' ').trim();
  if (rest && !`${issue.summary} ${issue.description}`.toLowerCase().includes(rest.toLowerCase())) return false;

  return true;
};

const fieldsFor = (issue: FakeIssue) => ({
  id: issue.id,
  idReadable: issue.idReadable,
  summary: issue.summary,
  description: issue.description,
  created: issue.created,
  updated: issue.updated,
  resolved: issue.resolved,
  project: PROJECTS.find((project) => project.id === issue.projectId) ?? null,
  tags: issue.tags,
  customFields: [
    { name: 'State', value: { id: issue.state.id, name: issue.state.name, isResolved: issue.state.isResolved } },
    { name: 'Priority', value: { id: issue.priority.toLowerCase(), name: issue.priority } },
    ...(issue.type
      ? [{ name: 'Type', value: { id: issue.type.toLowerCase(), name: issue.type } }]
      : []),
    ...(issue.assignee
      ? [{ name: 'Assignee', value: { id: issue.assignee.login, name: issue.assignee.fullName, login: issue.assignee.login, avatarUrl: issue.assignee.avatarUrl } }]
      : []),
  ],
  comments: issue.comments.map((comment) => ({
    id: comment.id,
    text: comment.text,
    created: comment.created,
    author: comment.author ? { id: comment.author.login, login: comment.author.login, name: comment.author.fullName } : null,
  })),
});

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

export type FakeYouTrack = { origin: string; close: () => Promise<void>; issues: FakeIssue[] };

export const startFakeYouTrack = (
  token = 'demo',
  options: { emptyProjectFields?: boolean } = {},
): FakeYouTrack => {
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(request) {
      const url = new URL(request.url);

      // The probe runs without a credential.
      if (url.pathname === '/api/config' && request.method === 'GET') {
        return json({ version: '2024.3.0' });
      }

      if (request.headers.get('authorization') !== `Bearer ${token}`) {
        return json({ error: 'Unauthorized', error_description: 'The token is invalid.' }, 401);
      }

      if (url.pathname === '/api/users/me' && request.method === 'GET') {
        return json({ id: 'u-1', login: 'mona', name: 'Mona Teapot', fullName: 'Mona Teapot', email: 'mona@example.com', avatarUrl: '/hub/api/rest/avatar/mona?s=48' });
      }

      if (url.pathname === '/api/admin/projects' && request.method === 'GET') {
        return json(
          PROJECTS.map(({ id, name, shortName, leader, team }) => ({ id, name, shortName, leader, team })),
        );
      }

      const projectFields = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)\/customFields$/);
      if (projectFields && request.method === 'GET') {
        const project = PROJECTS.find((entry) => entry.id === projectFields[1]);
        if (!project) return json({ error: 'Not found' }, 404);
        if (options.emptyProjectFields) return json([]);
        return json([
          {
            id: 'cf-state',
            name: 'State',
            field: { name: 'State' },
            bundle: {
              values: project.states.map((entry) => ({ id: entry.id, name: entry.name, isResolved: entry.isResolved })),
            },
          },
        ]);
      }

      if (url.pathname === '/api/issues' && request.method === 'GET') {
        const matching = ISSUES.filter((issue) => matchesQuery(issue, url.searchParams.get('query')));
        const skip = Number(url.searchParams.get('$skip') ?? '0') || 0;
        const top = Number(url.searchParams.get('$top') ?? '40') || 40;
        return json(matching.slice(skip, skip + top).map(fieldsFor));
      }

      if (url.pathname === '/api/commands' && request.method === 'POST') {
        return json({ id: 'cmd-1' });
      }

      const comments = url.pathname.match(/^\/api\/issues\/([^/]+)\/comments$/);
      if (comments && request.method === 'POST') {
        const issue = findIssue(decodeURIComponent(comments[1]!));
        if (!issue) return json({ error: 'Not found' }, 404);
        const body = (await request.json()) as { text?: string };
        const comment = {
          id: `c-${issue.comments.length + 10}`,
          text: body.text ?? '',
          created: Date.now(),
          author: { login: 'mona', fullName: 'Mona Teapot' },
        };
        issue.comments.push(comment);
        return json({ id: comment.id, text: comment.text });
      }

      const issueMatch = url.pathname.match(/^\/api\/issues\/([^/]+)$/);
      if (issueMatch) {
        const issue = findIssue(decodeURIComponent(issueMatch[1]!));
        if (!issue) return json({ error: 'Not found' }, 404);

        if (request.method === 'GET') return json(fieldsFor(issue));

        if (request.method === 'POST') {
          const body = (await request.json()) as { customFields?: Array<{ name?: string; value?: { name?: string } }> };
          for (const field of body.customFields ?? []) {
            if (field.name !== 'State' || !field.value?.name) continue;
            const next = STATES.find((entry) => entry.name === field.value?.name);
            if (!next) return json({ error: 'Bad state' }, 400);
            issue.state = clone(next);
            issue.resolved = next.isResolved ? Date.now() : null;
            issue.updated = Date.now();
          }
          return json(fieldsFor(issue));
        }
      }

      return json({ error: 'Not found', error_description: `${request.method} ${url.pathname}` }, 404);
    },
  });

  return {
    origin: `http://127.0.0.1:${server.port}`,
    close: async () => {
      server.stop(true);
    },
    issues: ISSUES,
  };
};
