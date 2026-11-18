import { describe, expect, test } from 'bun:test';

import {
  descriptionMatches,
  descriptionValues,
  normaliseMineText,
  repoIdentityOf,
  repoNameOf,
} from '../service/mapping.ts';

describe('normaliseMineText', () => {
  test('drops case, separators and diacritics', () => {
    expect(normaliseMineText('Acme Example Project'))
      .toBe('acmeexampleproject');
    expect(normaliseMineText('acme-example-project'))
      .toBe('acmeexampleproject');
    expect(normaliseMineText('Café Déjà Vu')).toBe('cafedejavu');
  });
});

describe('repoIdentityOf and repoNameOf', () => {
  test('reads a full GitHub URL, with or without .git', () => {
    expect(repoIdentityOf('https://github.com/acme/example.git'))
      .toBe('acme/example');
    expect(repoIdentityOf('https://github.com/acme/example'))
      .toBe('acme/example');
    expect(repoNameOf('https://github.com/acme/example.git'))
      .toBe('example');
  });

  test('reads owner/repo, a host path, and git/ssh remotes', () => {
    expect(repoIdentityOf('acme/example'))
      .toBe('acme/example');
    expect(repoIdentityOf('github.com/acme/example'))
      .toBe('acme/example');
    expect(repoIdentityOf('git@github.com:acme/example.git'))
      .toBe('acme/example');
    expect(repoIdentityOf('ssh://git@github.com/acme/example.git'))
      .toBe('acme/example');
  });

  test('keeps a bare repository name', () => {
    expect(repoIdentityOf('example')).toBe('example');
    expect(repoNameOf('example')).toBe('example');
    expect(repoIdentityOf('   ')).toBeNull();
  });
});

describe('descriptionValues', () => {
  test('reads the fenced JSON metadata and ignores other fields', () => {
    const description = [
      'Folder mapping metadata:',
      '',
      '```json',
      '{',
      '  "repoUrl": "https://github.com/acme/example.git",',
      '  "ocProjectName": "example",',
      '  "ignoredField": "ignored"',
      '}',
      '```',
    ].join('\n');
    expect(descriptionValues(description)).toEqual([
      'https://github.com/acme/example.git',
      'example',
    ]);
  });

  test('accepts repoUrl as owner/repo, a host path, or a git remote', () => {
    expect(descriptionValues('{"repoUrl": "acme/panel"}')).toEqual(['acme/panel']);
    expect(descriptionValues('{"repoUrl": "github.com/acme/panel"}'))
      .toEqual(['github.com/acme/panel']);
    expect(descriptionValues('{"repoUrl": "git@github.com:acme/panel.git"}'))
      .toEqual(['git@github.com:acme/panel.git']);
  });

  test('reads a description that is only JSON', () => {
    expect(descriptionValues('{"repo": "acme/panel"}')).toEqual(['acme/panel']);
  });

  test('ignores prose and empty descriptions', () => {
    expect(descriptionValues('This project mentions acme: nowhere.')).toEqual([]);
    expect(descriptionValues(null)).toEqual([]);
    expect(descriptionValues('  project:   ')).toEqual([]);
  });
});

describe('descriptionMatches', () => {
  const description = [
    '```',
    '{',
    '  "repoUrl": "https://github.com/acme/example.git",',
    '  "ocProjectName": "example"',
    '}',
    '```',
  ].join('\n');

  test('matches a URL, owner/repo, repo name, or OC project name', () => {
    for (const hint of [
      'https://github.com/acme/example',
      'https://github.com/acme/example.git',
      'git@github.com:acme/example.git',
      'github.com/acme/example',
      'acme/example',
      'example',
    ]) {
      expect(descriptionMatches(description, [hint])).toBe(true);
    }
  });

  test('does not treat ordinary prose as metadata', () => {
    expect(descriptionMatches(
      'See acme/example for details.',
      ['acme/example'],
    )).toBe(false);
    expect(descriptionMatches(description, ['another-repo'])).toBe(false);
    expect(descriptionMatches(null, ['acme/example'])).toBe(false);
  });
});
