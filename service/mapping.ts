/**
 * Repository identity and the issue-description convention.
 *
 * A native project supplies a folder (and optionally its OpenChamber project
 * name); this module turns those into the text forms a YouTrack issue
 * description can carry, and reads the fenced JSON metadata back.
 *
 * Pure: no I/O, no credential, no host state.
 */
import type { TrackerProviderContainer } from '@openchamber/sdk';

export type MappingHint = {
  value: string;
};

export type IssueMapping = {
  /** The projects of the issues whose description names the repository. */
  projects: TrackerProviderContainer[];
  /** The search terms that found those issues; the list query reuses one. */
  terms: string[];
};

/** Lowercase, strip diacritics, then keep only `[a-z0-9]`. */
export const normaliseMineText = (value: string): string => value
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const stripGitSuffix = (value: string): string =>
  value.replace(/\/+$/, '').replace(/\.git$/i, '');

/**
 * The repository identity in a value: `owner/repo` when the value names one,
 * otherwise the last path segment. Accepts an https/ssh URL, a `git@host:path`
 * remote, a `host/owner/repo` path, or a bare `owner/repo`.
 */
export const repoIdentityOf = (value: string): string | null => {
  let text = value.trim();
  if (!text) return null;

  const scp = /^[^@\s]+@[^:\s]+:(.+)$/.exec(text);
  if (scp) {
    text = scp[1] ?? '';
  } else {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
      try {
        text = new URL(text).pathname;
      } catch {
        // A value that looks like a URL but is not one: keep it as a path.
      }
    }
    // `github.com/owner/repo` without a scheme.
    text = text.replace(/^\/+/, '');
    const hosted = /^[a-z0-9.-]+\.[a-z]{2,}\/(.+)$/i.exec(text);
    if (hosted) text = hosted[1] ?? text;
  }

  const parts = stripGitSuffix(text)
    .split(/[\\/]+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return null;
  return parts.length >= 2
    ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
    : parts[0] ?? null;
};

/** The bare repository name: the last segment of {@link repoIdentityOf}. */
export const repoNameOf = (value: string): string | null => {
  const identity = repoIdentityOf(value);
  if (!identity) return null;
  return identity.split('/').pop() ?? identity;
};

/** A value, its `owner/repo` identity, and its bare repo name. */
const formsOf = (value: string): string[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const forms = [trimmed];
  for (const form of [repoIdentityOf(trimmed), repoNameOf(trimmed)]) {
    if (form && !forms.includes(form)) forms.push(form);
  }
  return forms;
};

/**
 * Project metadata written into an issue description as a fenced JSON
 * object. These are the fields that name a project or its repository; values
 * such as assignees and other metadata are deliberately not identity.
 */
const DESCRIPTION_JSON_KEYS = new Set([
  'ocprojectname',
  'githuburl',
  'repourl',
  'repositoryurl',
  'gitremote',
  'giturl',
  'remoteurl',
  'remote',
  'reponame',
  'repositoryname',
  'projectname',
  'project',
  'repo',
  'repository',
  'youtrackproject',
  'youtrackprojectkey',
  'youtrackprojectid',
]);

const FENCED_BLOCK = /```[^\n]*\r?\n([\s\S]*?)```/g;

const collectJsonValues = (value: unknown, out: string[]): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonValues(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DESCRIPTION_JSON_KEYS.has(key.toLowerCase())) {
      if (typeof child === 'string' && child.trim()) out.push(child.trim());
      if (Array.isArray(child)) {
        for (const item of child) {
          if (typeof item === 'string' && item.trim()) out.push(item.trim());
        }
      }
      continue;
    }
    collectJsonValues(child, out);
  }
};

const jsonDescriptionValues = (description: string): string[] => {
  const values: string[] = [];
  const blocks = [...description.matchAll(FENCED_BLOCK)].flatMap((match) => (
    match[1] ? [match[1]] : []
  ));
  // A description that is only JSON (no fence) is just as valid.
  const trimmed = description.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) blocks.push(trimmed);

  for (const block of blocks) {
    try {
      collectJsonValues(JSON.parse(block), values);
    } catch {
      // A fenced block that is not JSON is ordinary prose.
    }
  }
  return values;
};

/**
 * Every project/repository identity carried by an issue description, from
 * the fenced JSON block (with or without a language tag) or a bare JSON
 * description. Unknown fields are ignored.
 */
export const descriptionValues = (description: string | null | undefined): string[] => {
  if (!description) return [];
  return [...new Set(jsonDescriptionValues(description))];
};

/** Whether a description's metadata names any of the hints. */
export const descriptionMatches = (
  description: string | null | undefined,
  hints: readonly string[],
): boolean => {
  const wanted = [...new Set(hints.flatMap(formsOf))].map(normaliseMineText);
  if (wanted.length === 0) return false;
  const described = descriptionValues(description)
    .flatMap(formsOf)
    .map(normaliseMineText);
  return wanted.some((form) => described.includes(form));
};
