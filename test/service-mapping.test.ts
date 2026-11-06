import { describe, expect, test } from 'bun:test';

import {
  absolute,
  categoryOf,
  iso,
  personOf,
  priorityOf,
  stateOf,
  toContainer,
  toItem,
  toLiveSummary,
  toSummary,
  toWorkflowState,
  type YtIssue,
} from '../service/youtrack.ts';

const INSTANCE = 'https://youtrack.example.com';

const issue = (overrides: Partial<YtIssue> = {}): YtIssue => ({
  id: '2-1',
  idReadable: 'PROJ-1',
  summary: 'Login fails on Safari',
  description: 'Open the app in Safari.',
  created: Date.UTC(2026, 9, 1, 9, 0, 0),
  updated: Date.UTC(2026, 9, 30, 9, 0, 0),
  project: { id: 'p-proj', name: 'Probe Project', shortName: 'PROJ' },
  customFields: [
    { name: 'State', value: { id: 's-open', name: 'Open', isResolved: false } },
    { name: 'Priority', value: { id: 'p-urgent', name: 'Critical' } },
    { name: 'Assignee', value: { login: 'mona', fullName: 'Mona Teapot', avatarUrl: '/avatar/mona' } },
  ],
  tags: [{ id: 't-bug', name: 'bug', color: { id: '#e5484d' } }],
  ...overrides,
});

describe('time and URL normalisation', () => {
  test('converts epoch milliseconds to ISO and leaves anything else null', () => {
    expect(iso(Date.UTC(2026, 9, 30, 9, 0, 0))).toBe('2026-10-30T09:00:00.000Z');
    expect(iso(null)).toBeNull();
    expect(iso(undefined)).toBeNull();
    expect(iso(Number.NaN)).toBeNull();
    expect(iso(Number.POSITIVE_INFINITY)).toBeNull();
  });

  test('keeps absolute URLs and roots relative ones at the instance', () => {
    expect(absolute(INSTANCE, 'https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
    expect(absolute(INSTANCE, '/hub/api/rest/avatar/mona')).toBe(`${INSTANCE}/hub/api/rest/avatar/mona`);
    expect(absolute(INSTANCE, 'hub/api/rest/avatar/mona')).toBe(`${INSTANCE}/hub/api/rest/avatar/mona`);
    expect(absolute(INSTANCE, null)).toBeNull();
    expect(absolute(INSTANCE, '')).toBeNull();
  });
});

describe('stateOf', () => {
  test('finds the state field under any project field name', () => {
    const found = stateOf(issue({ customFields: [
      { name: 'Stage', value: { id: 's-1', name: 'In Progress', isResolved: false } },
      { name: 'Priority', value: { name: 'Major' } },
    ] }));
    expect(found).toEqual({ name: 'Stage', value: { id: 's-1', name: 'In Progress', isResolved: false } });
  });

  test('picks the state element out of an array value', () => {
    const found = stateOf(issue({ customFields: [
      { name: 'State', value: [{ name: 'not a state' }, { id: 's-2', name: 'Fixed', isResolved: true }] },
    ] }));
    expect(found.value).toMatchObject({ id: 's-2', name: 'Fixed', isResolved: true });
  });

  test('falls back to the conventional name when there is no state field', () => {
    expect(stateOf(issue({ customFields: [] }))).toEqual({ name: 'State', value: null });
    expect(stateOf(issue({ customFields: [{ name: 'Priority', value: { name: 'Major' } }] })))
      .toEqual({ name: 'State', value: null });
  });
});

describe('categoryOf', () => {
  test('maps the project workflow names onto the neutral categories', () => {
    expect(categoryOf('Submitted', false)).toBe('todo');
    expect(categoryOf('Open', false)).toBe('todo');
    expect(categoryOf('In Progress', false)).toBe('in-progress');
    expect(categoryOf('In Review', false)).toBe('in-progress');
    expect(categoryOf('Pending Deploy', false)).toBe('in-progress');
    expect(categoryOf('QA', false)).toBe('in-progress');
    expect(categoryOf('Backlog', false)).toBe('backlog');
    expect(categoryOf('Triage', false)).toBe('triage');
    expect(categoryOf('Fixed', true)).toBe('done');
    expect(categoryOf('Verified', true)).toBe('done');
    expect(categoryOf("Won't fix", true)).toBe('canceled');
    expect(categoryOf('Duplicate', false)).toBe('canceled');
    expect(categoryOf('Rejected', false)).toBe('canceled');
  });

  test('lets the resolution flag decide an otherwise unknown name', () => {
    expect(categoryOf('Shipped', true)).toBe('done');
  });

  test('defaults an unresolved custom workflow to todo', () => {
    expect(categoryOf('Custom Gate', false)).toBe('todo');
    expect(categoryOf('Whatever The Project Called It', false)).toBe('todo');
  });

  test('has no category without a name or flag', () => {
    expect(categoryOf('', false)).toBeNull();
    expect(categoryOf('   ', undefined)).toBeNull();
    expect(categoryOf(null, null)).toBeNull();
  });

  test('ignores case and surrounding whitespace', () => {
    expect(categoryOf('  IN PROGRESS  ', false)).toBe('in-progress');
    expect(categoryOf('fixed', true)).toBe('done');
  });
});

describe('priorityOf', () => {
  test('maps the common YouTrack priority names', () => {
    expect(priorityOf('Show-stopper')).toBe('urgent');
    expect(priorityOf('Blocker')).toBe('urgent');
    expect(priorityOf('High')).toBe('high');
    expect(priorityOf('Major')).toBe('high');
    expect(priorityOf('Normal')).toBe('medium');
    expect(priorityOf('Minor')).toBe('low');
    expect(priorityOf('Low')).toBe('low');
    expect(priorityOf('No priority')).toBe('none');
  });

  test('is case-insensitive and defaults to none', () => {
    expect(priorityOf('  CRITICAL ')).toBe('urgent');
    expect(priorityOf('Sev-3')).toBe('none');
    expect(priorityOf(null)).toBe('none');
    expect(priorityOf(undefined)).toBe('none');
  });
});

describe('personOf', () => {
  test('prefers the full name, then the name field, then the login', () => {
    expect(personOf(INSTANCE, { login: 'mona', name: 'Mona', fullName: 'Mona Teapot' }))
      .toEqual({ name: 'Mona Teapot', avatarUrl: null });
    expect(personOf(INSTANCE, { login: 'mona', name: 'Mona' }))
      .toEqual({ name: 'Mona', avatarUrl: null });
    expect(personOf(INSTANCE, { login: 'mona' })).toEqual({ name: 'mona', avatarUrl: null });
  });

  test('absolutises the avatar and keeps an absolute one', () => {
    expect(personOf(INSTANCE, { fullName: 'Mona', avatarUrl: '/avatar/mona' })?.avatarUrl)
      .toBe(`${INSTANCE}/avatar/mona`);
    expect(personOf(INSTANCE, { fullName: 'Mona', avatarUrl: 'https://cdn.example.com/m.png' })?.avatarUrl)
      .toBe('https://cdn.example.com/m.png');
  });

  test('is null without a value or a usable name', () => {
    expect(personOf(INSTANCE, null)).toBeNull();
    expect(personOf(INSTANCE, {})).toBeNull();
  });
});

describe('toContainer', () => {
  test('uses the short name as the key', () => {
    expect(toContainer({ id: 'p-1', name: 'Probe Project', shortName: 'PROJ' }))
      .toEqual({ id: 'p-1', key: 'PROJ', name: 'Probe Project' });
  });

  test('falls back across the name fields', () => {
    expect(toContainer({ id: 'p-1', name: 'Probe Project' }))
      .toEqual({ id: 'p-1', key: 'Probe Project', name: 'Probe Project' });
    expect(toContainer({ id: 'p-1' })).toEqual({ id: 'p-1', key: null, name: 'p-1' });
  });
});

describe('toSummary', () => {
  test('builds the neutral summary from the issue and its custom fields', () => {
    expect(toSummary(INSTANCE, issue())).toEqual({
      id: '2-1',
      identifier: 'PROJ-1',
      title: 'Login fails on Safari',
      url: `${INSTANCE}/issue/PROJ-1`,
      state: { id: 's-open', name: 'Open', category: 'todo' },
      priority: 'urgent',
      labels: [{ id: 't-bug', name: 'bug', color: '#e5484d' }],
      assignee: { name: 'Mona Teapot', avatarUrl: `${INSTANCE}/avatar/mona` },
      container: { id: 'p-proj', key: 'PROJ', name: 'Probe Project' },
      updatedAt: '2026-10-30T09:00:00.000Z',
    });
  });

  test('uppercases the identifier, encodes the URL and falls back for the title', () => {
    const summary = toSummary(INSTANCE, issue({ idReadable: 'proj 1', summary: null }));
    expect(summary.identifier).toBe('PROJ 1');
    expect(summary.url).toBe(`${INSTANCE}/issue/PROJ%201`);
    expect(summary.title).toBe('PROJ 1');
  });

  test('has a null state, no labels or people, and no container when absent', () => {
    const summary = toSummary(INSTANCE, {
      id: 'x-1',
      idReadable: 'X-1',
      customFields: [],
      tags: null,
      project: null,
    });
    expect(summary).toMatchObject({
      state: null,
      priority: 'none',
      labels: [],
      assignee: null,
      container: null,
      updatedAt: null,
    });
  });
});

describe('toItem', () => {
  test('carries the description and maps the comments', () => {
    const item = toItem(INSTANCE, issue({
      comments: [
        {
          id: 'c-1',
          text: 'Reproduced on 17.4.',
          created: Date.UTC(2026, 9, 30, 9, 10, 0),
          author: { login: 'octo', fullName: 'Octo Kettle' },
        },
        { id: 'c-2', text: null, author: null },
      ],
    }));
    expect(item.description).toBe('Open the app in Safari.');
    expect(item.comments).toEqual([
      {
        id: 'c-1',
        body: 'Reproduced on 17.4.',
        createdAt: '2026-10-30T09:10:00.000Z',
        author: { name: 'Octo Kettle', avatarUrl: null },
      },
      { id: 'c-2', body: '', createdAt: null, author: null },
    ]);
  });

  test('nulls a missing description', () => {
    expect(toItem(INSTANCE, issue({ description: null })).description).toBeNull();
  });
});

describe('toWorkflowState', () => {
  test('uses the name as the id, because updateState writes a name', () => {
    expect(toWorkflowState({ id: 's-fixed', name: 'Fixed', isResolved: true }, 3)).toEqual({
      id: 'Fixed',
      name: 'Fixed',
      category: 'done',
      position: 3,
    });
  });

  test('falls back to the id, then the position', () => {
    expect(toWorkflowState({ id: 's-x' }, 1)).toMatchObject({ id: 's-x', name: 's-x' });
    expect(toWorkflowState({}, 2)).toEqual({
      id: 'state-2',
      name: 'State 2',
      category: null,
      position: 2,
    });
  });
});

describe('toLiveSummary', () => {
  test('reports the identifier, title and state', () => {
    expect(toLiveSummary(INSTANCE, issue())).toEqual({
      identifier: 'PROJ-1',
      title: 'Login fails on Safari',
      state: { name: 'Open', category: 'todo' },
    });
  });

  test('defaults a missing state to Open/todo', () => {
    expect(toLiveSummary(INSTANCE, issue({ customFields: [] })).state)
      .toEqual({ name: 'Open', category: 'todo' });
  });
});
