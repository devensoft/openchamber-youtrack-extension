import { describe, expect, test } from 'bun:test';

import {
  checkedFrom,
  groupProjects,
  isDirty,
  matchesSearch,
  sameList,
  sortByName,
  summaryText,
  type Project,
  type ProjectAccess,
  type ProjectsAnswer,
} from '../src/panel/projects.ts';

const project = (
  id: string,
  name: string,
  access: ProjectAccess = 'edit',
  key: string | null = id.toUpperCase(),
): Project => ({ id, key, name, access });

const answer = (overrides: Partial<ProjectsAnswer> = {}): ProjectsAnswer => ({
  connected: true,
  instance: 'https://youtrack.example.com',
  projects: [],
  mode: 'all',
  selected: [],
  user: null,
  needsLoad: false,
  ...overrides,
});

describe('sameList', () => {
  test('ignores order', () => {
    expect(sameList(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  test('sees a different length or a different id', () => {
    expect(sameList(['a'], ['a', 'b'])).toBe(false);
    expect(sameList(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  test('treats duplicates as a difference', () => {
    expect(sameList(['a', 'a'], ['a'])).toBe(false);
  });
});

describe('checkedFrom', () => {
  test('ticks exactly the saved selection', () => {
    expect([...checkedFrom(answer({ selected: ['p-1', 'p-2'] }))].sort()).toEqual(['p-1', 'p-2']);
  });
});

describe('matchesSearch', () => {
  const probe = project('p-1', 'Probe Project', 'edit', 'PROJ');

  test('matches name and key case-insensitively', () => {
    expect(matchesSearch(probe, 'probe')).toBe(true);
    expect(matchesSearch(probe, 'proj')).toBe(true);
    expect(matchesSearch(probe, 'PROJECT')).toBe(true);
  });

  test('ignores surrounding whitespace and an empty term', () => {
    expect(matchesSearch(probe, '  proj  ')).toBe(true);
    expect(matchesSearch(probe, '   ')).toBe(true);
  });

  test('does not match an unrelated term', () => {
    expect(matchesSearch(probe, 'operations')).toBe(false);
  });

  test('copes with a null key', () => {
    expect(matchesSearch(project('p-1', 'Probe', 'edit', null), 'p-1')).toBe(false);
    expect(matchesSearch(project('p-1', 'Probe', 'edit', null), 'probe')).toBe(true);
  });
});

describe('sortByName', () => {
  test('orders case-insensitively and numerically', () => {
    const sorted = sortByName([
      project('p-10', 'item 10'),
      project('p-2', 'Item 2'),
      project('p-1', 'item 1'),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(['p-1', 'p-2', 'p-10']);
  });

  test('breaks a name tie on the key', () => {
    const sorted = sortByName([
      project('p-2', 'Same', 'edit', 'B'),
      project('p-1', 'Same', 'edit', 'A'),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(['p-1', 'p-2']);
  });

  test('does not reorder the input', () => {
    const input = [project('p-2', 'B'), project('p-1', 'A')];
    sortByName(input);
    expect(input.map((entry) => entry.id)).toEqual(['p-2', 'p-1']);
  });
});

describe('groupProjects', () => {
  test('groups Can edit, Read only, then Access unknown', () => {
    const groups = groupProjects([
      project('u-1', 'Mystery', 'unknown'),
      project('r-1', 'Shared', 'read'),
      project('e-1', 'Own', 'edit'),
    ], '');
    expect(groups.map((group) => group.access)).toEqual(['edit', 'read', 'unknown']);
    expect(groups.map((group) => group.label)).toEqual(['Can edit', 'Read only', 'Access unknown']);
  });

  test('leaves out an empty group', () => {
    const groups = groupProjects([
      project('e-1', 'Own', 'edit'),
      project('u-1', 'Mystery', 'unknown'),
    ], '');
    expect(groups.map((group) => group.access)).toEqual(['edit', 'unknown']);
  });

  test('sorts inside each group', () => {
    const groups = groupProjects([
      project('e-2', 'Beta'),
      project('e-1', 'Alpha'),
    ], '');
    expect(groups[0]?.projects.map((entry) => entry.name)).toEqual(['Alpha', 'Beta']);
  });

  test('calls an all-unknown list just Projects', () => {
    const groups = groupProjects([
      project('u-1', 'Alpha', 'unknown'),
      project('u-2', 'Beta', 'unknown'),
    ], '');
    expect(groups.map((group) => group.label)).toEqual(['Projects']);
  });

  test('filters by the search term before grouping', () => {
    const groups = groupProjects([
      project('e-1', 'Probe Project', 'edit', 'PROJ'),
      project('r-1', 'Operations', 'read', 'OPS'),
    ], 'ops');
    expect(groups.map((group) => group.access)).toEqual(['read']);
    expect(groups[0]?.projects.map((entry) => entry.name)).toEqual(['Operations']);
  });

  test('is empty when nothing matches', () => {
    expect(groupProjects([project('e-1', 'Probe')], 'zzz')).toEqual([]);
  });
});

describe('summaryText', () => {
  test('states what the board currently shows', () => {
    expect(summaryText('all', 12, 0)).toBe('All 12 projects included');
    expect(summaryText('selected', 12, 0)).toBe('Pick at least one project');
    expect(summaryText('selected', 12, 12)).toBe('All 12 projects selected');
    expect(summaryText('selected', 12, 3)).toBe('3 of 12 selected');
  });
});

describe('isDirty', () => {
  test('is false for the same set of ids', () => {
    expect(isDirty(new Set(['p-1', 'p-2']), ['p-2', 'p-1'])).toBe(false);
  });

  test('is true when the draft adds or removes an id', () => {
    expect(isDirty(new Set(['p-1']), ['p-1', 'p-2'])).toBe(true);
    expect(isDirty(new Set(['p-1', 'p-2']), ['p-1'])).toBe(true);
  });
});
