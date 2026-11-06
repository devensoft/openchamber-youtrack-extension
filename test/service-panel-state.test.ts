import { describe, expect, test } from 'bun:test';

import {
  emptyPanelState,
  knownProjectsOf,
  modeOf,
  parseSelectionRequest,
  restrictSelection,
  visibleProjects,
  type PanelProject,
  type PanelState,
} from '../service/panel-state.ts';

const project = (
  id: string,
  access: PanelProject['access'] = 'edit',
  key: string | null = id.toUpperCase(),
  name = `Project ${id}`,
): PanelProject => ({ id, key, name, access });

const state = (overrides: Partial<PanelState> = {}): PanelState => ({
  ...emptyPanelState(),
  ...overrides,
});

describe('knownProjectsOf', () => {
  test('drops non-objects and instances whose value is not a list', () => {
    expect(knownProjectsOf(null)).toEqual({});
    expect(knownProjectsOf('nope')).toEqual({});
    expect(knownProjectsOf({ 'https://a': 'not a list' })).toEqual({});
  });

  test('keeps well-formed projects and defaults the rest', () => {
    expect(knownProjectsOf({
      'https://a': [
        { id: 'p-1', key: 'PROJ', name: 'Probe', access: 'edit' },
        { id: 'p-2', access: 'read' },
        { id: 'p-3', key: null, name: null, access: 'nonsense' },
        { key: 'NO-ID' },
        null,
        'nope',
      ],
    })).toEqual({
      'https://a': [
        { id: 'p-1', key: 'PROJ', name: 'Probe', access: 'edit' },
        { id: 'p-2', key: null, name: 'p-2', access: 'read' },
        { id: 'p-3', key: null, name: 'p-3', access: 'unknown' },
      ],
    });
  });
});

describe('modeOf', () => {
  test('prefers the saved mode', () => {
    expect(modeOf(state({ modeByInstance: { a: 'all' }, selectedByInstance: { a: ['p-1'] } }), 'a'))
      .toBe('all');
    expect(modeOf(state({ modeByInstance: { a: 'selected' } }), 'a')).toBe('selected');
  });

  test('infers selected from a non-empty selection in an older file', () => {
    expect(modeOf(state({ selectedByInstance: { a: ['p-1'] } }), 'a')).toBe('selected');
  });

  test('is all for an instance with no mode and no selection', () => {
    expect(modeOf(state(), 'a')).toBe('all');
    expect(modeOf(state({ selectedByInstance: { a: [] } }), 'a')).toBe('all');
  });
});

describe('visibleProjects', () => {
  const all = [project('p-1'), project('p-2'), project('p-3')];

  test('shows every project in all mode', () => {
    expect(visibleProjects(all, 'all', ['p-2']).map((entry) => entry.id))
      .toEqual(['p-1', 'p-2', 'p-3']);
  });

  test('shows the saved selection in selected mode', () => {
    expect(visibleProjects(all, 'selected', ['p-1', 'p-3']).map((entry) => entry.id))
      .toEqual(['p-1', 'p-3']);
  });

  test('ignores ids the instance no longer has', () => {
    expect(visibleProjects(all, 'selected', ['p-1', 'gone']).map((entry) => entry.id))
      .toEqual(['p-1']);
  });

  test('keeps the list whole when selected mode has an empty selection', () => {
    expect(visibleProjects(all, 'selected', []).map((entry) => entry.id))
      .toEqual(['p-1', 'p-2', 'p-3']);
  });

  test('returns a copy, so the caller cannot mutate the cached list', () => {
    const visible = visibleProjects(all, 'all', []);
    visible.pop();
    expect(all).toHaveLength(3);
  });
});

describe('parseSelectionRequest', () => {
  test('rejects a body that is not JSON or has no selected array', () => {
    expect(parseSelectionRequest('not json', 'a')).toBeNull();
    expect(parseSelectionRequest('{"instance":"a"}', 'a')).toBeNull();
    expect(parseSelectionRequest('{"instance":"a","selected":"p-1"}', 'a')).toBeNull();
  });

  test('rejects a request with no instance to fall back to', () => {
    expect(parseSelectionRequest('{"selected":["p-1"]}', null)).toBeNull();
  });

  test('uses the last instance when the body omits one', () => {
    expect(parseSelectionRequest('{"selected":["p-1"]}', 'https://a'))
      .toEqual({ instance: 'https://a', mode: 'selected', selected: ['p-1'] });
  });

  test('keeps only string ids', () => {
    expect(parseSelectionRequest('{"instance":"a","selected":["p-1",2,null]}', null))
      .toEqual({ instance: 'a', mode: 'selected', selected: ['p-1'] });
  });

  test('honours an explicit mode, including all with a selection', () => {
    expect(parseSelectionRequest('{"instance":"a","mode":"all","selected":["p-1"]}', null))
      .toEqual({ instance: 'a', mode: 'all', selected: ['p-1'] });
  });

  test('infers the mode from the selection when the body does not say', () => {
    expect(parseSelectionRequest('{"instance":"a","selected":["p-1"]}', null)?.mode).toBe('selected');
    expect(parseSelectionRequest('{"instance":"a","selected":[]}', null)?.mode).toBe('all');
  });

  test('refuses selected mode with nothing selected', () => {
    expect(parseSelectionRequest('{"instance":"a","mode":"selected","selected":[]}', null)).toBeNull();
  });
});

describe('restrictSelection', () => {
  const known = new Set(['p-1', 'p-2']);

  test('drops ids this instance does not have', () => {
    expect(restrictSelection({ instance: 'a', mode: 'selected', selected: ['p-1', 'gone'] }, known))
      .toEqual({ instance: 'a', mode: 'selected', selected: ['p-1'] });
  });

  test('keeps the ids as given when the project list has not loaded', () => {
    expect(restrictSelection({ instance: 'a', mode: 'selected', selected: ['p-9'] }, new Set()))
      .toEqual({ instance: 'a', mode: 'selected', selected: ['p-9'] });
  });

  test('refuses a selection that loses every id in selected mode', () => {
    expect(restrictSelection({ instance: 'a', mode: 'selected', selected: ['gone'] }, known))
      .toBeNull();
  });

  test('allows that same empty result in all mode, where selection is dormant', () => {
    expect(restrictSelection({ instance: 'a', mode: 'all', selected: ['gone'] }, known))
      .toEqual({ instance: 'a', mode: 'all', selected: [] });
  });

  test('keeps the selection while all mode is on', () => {
    expect(restrictSelection({ instance: 'a', mode: 'all', selected: ['p-1'] }, known))
      .toEqual({ instance: 'a', mode: 'all', selected: ['p-1'] });
  });

  test('does not mutate the parsed request', () => {
    const selection = { instance: 'a', mode: 'selected' as const, selected: ['p-1', 'gone'] };
    restrictSelection(selection, known);
    expect(selection.selected).toEqual(['p-1', 'gone']);
  });
});
