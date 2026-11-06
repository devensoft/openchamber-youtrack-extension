import { describe, expect, test } from 'bun:test';

import {
  categoryFallback,
  peopleFilterQuery,
  priorityFilterQuery,
  projectQuery,
  quoteTerm,
  stateNameQuery,
  valueListQuery,
} from '../service/query.ts';

describe('quoteTerm', () => {
  test('braces only a term that contains whitespace', () => {
    expect(quoteTerm('PROJ')).toBe('PROJ');
    expect(quoteTerm('In Progress')).toBe('{In Progress}');
    expect(quoteTerm('Probe Project')).toBe('{Probe Project}');
  });
});

describe('valueListQuery', () => {
  test('joins the values under one field', () => {
    expect(valueListQuery('State', ['Open', 'Fixed'])).toBe('State: Open, Fixed');
    expect(valueListQuery('State', ['In Progress', 'Fixed', 'Won\u0027t fix']))
      .toBe('State: {In Progress}, Fixed, {Won\u0027t fix}');
  });
});

describe('projectQuery', () => {
  test('scopes to every container by key', () => {
    expect(projectQuery([
      { id: 'p-1', key: 'PROJ', name: 'Probe Project' },
      { id: 'p-2', key: 'OPS', name: 'Operations' },
    ])).toBe('project: PROJ, OPS');
  });

  test('falls back to the name and braces a spaced one', () => {
    expect(projectQuery([{ id: 'p-1', key: null, name: 'Probe Project' }]))
      .toBe('project: {Probe Project}');
    expect(projectQuery([{ id: 'p-1', key: 'PROJ', name: 'Probe Project' }]))
      .toBe('project: PROJ');
  });

  test('is null with nothing to scope', () => {
    expect(projectQuery([])).toBeNull();
  });
});

describe('priorityFilterQuery', () => {
  test('writes the names a YouTrack project uses for each neutral level', () => {
    expect(priorityFilterQuery('urgent')).toBe('Priority: Show-stopper, Critical, Blocker');
    expect(priorityFilterQuery('high')).toBe('Priority: Major, High');
    expect(priorityFilterQuery('medium')).toBe('Priority: Normal, Medium');
    expect(priorityFilterQuery('low')).toBe('Priority: Minor, Low');
  });

  test('adds no filter for all or none', () => {
    expect(priorityFilterQuery('all')).toBeNull();
    expect(priorityFilterQuery('none')).toBeNull();
  });
});

describe('peopleFilterQuery', () => {
  test('turns the neutral people options into YouTrack search terms', () => {
    expect(peopleFilterQuery('me')).toBe('for: me');
    expect(peopleFilterQuery('created')).toBe('created by: me');
    expect(peopleFilterQuery('any')).toBeNull();
  });
});

describe('stateNameQuery', () => {
  test('lists the project state names, bracing the spaced ones', () => {
    expect(stateNameQuery(['Open', 'Fixed'])).toBe('State: Open, Fixed');
    expect(stateNameQuery(['In Progress', 'Pending Deploy']))
      .toBe('State: {In Progress}, {Pending Deploy}');
  });

  test('is null when the project has no state in the category', () => {
    expect(stateNameQuery([])).toBeNull();
  });
});

describe('categoryFallback', () => {
  test('reads cancellation as resolved and everything else as unresolved', () => {
    expect(categoryFallback('canceled')).toBe('#Resolved');
    expect(categoryFallback('done')).toBe('#Unresolved');
    expect(categoryFallback('todo')).toBe('#Unresolved');
    expect(categoryFallback('in-progress')).toBe('#Unresolved');
    expect(categoryFallback('triage')).toBe('#Unresolved');
    expect(categoryFallback('backlog')).toBe('#Unresolved');
  });
});
