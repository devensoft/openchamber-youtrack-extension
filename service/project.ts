import { execFile } from 'node:child_process';
import { basename, isAbsolute } from 'node:path';

import { repoNameOf, type MappingHint } from './mapping.ts';
import { createTtlCache } from './ttl-cache.ts';

/** How long a folder's git answer is reused. */
const GIT_ANSWER_TTL_MS = 5 * 60_000;

const runGit = (directory: string, args: string[]): Promise<string> => new Promise((resolve, reject) => {
  execFile(
    'git',
    ['-C', directory, ...args],
    { timeout: 3000, maxBuffer: 64 * 1024 },
    (error, stdout) => {
      if (error) reject(error);
      else resolve(String(stdout).trim());
    },
  );
});

type GitIdentity = { remote: string; repo: string | null };
const remoteCache = createTtlCache<GitIdentity | null>(GIT_ANSWER_TTL_MS);
const rootCache = createTtlCache<string | null>(GIT_ANSWER_TTL_MS);

/**
 * The native project's git remote. `git -C <folder> remote get-url origin`,
 * then the first remote when there is no origin. Worktrees, `git@host:owner/repo`
 * and ssh URLs are git's problem, not ours. A folder without git, or a failed
 * command, is `null`.
 */
const gitIdentityOf = async (directory: string | null): Promise<GitIdentity | null> => {
  if (!directory || !isAbsolute(directory) || directory.includes('\0')) return null;
  const cached = remoteCache.get(directory);
  if (cached !== undefined) return cached;

  let remote = '';
  try {
    remote = await runGit(directory, ['remote', 'get-url', 'origin']);
  } catch {
    // No origin; try the first remote below.
  }
  if (!remote) {
    try {
      const names = (await runGit(directory, ['remote']))
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean);
      if (names[0]) remote = await runGit(directory, ['remote', 'get-url', names[0]]);
    } catch {
      // Not a git repository, or git is unavailable.
    }
  }

  const value = remote ? { remote, repo: repoNameOf(remote) } : null;
  remoteCache.set(directory, value);
  return value;
};

/**
 * The main checkout of a worktree, or the repository root of a subfolder.
 * `git worktree list --porcelain` puts the main worktree first. A folder that
 * is not a repository answers itself, so the remote read still decides.
 */
const projectRootOf = async (directory: string | null): Promise<string | null> => {
  if (!directory || !isAbsolute(directory) || directory.includes('\0')) return null;
  const cached = rootCache.get(directory);
  if (cached !== undefined) return cached;

  let value: string | null = null;
  try {
    const output = await runGit(directory, ['worktree', 'list', '--porcelain']);
    const first = output.split(/\r?\n/).find((line) => line.startsWith('worktree '));
    if (first) value = first.slice('worktree '.length).trim() || null;
  } catch {
    // Not a git repository, or git is unavailable.
  }
  value ??= directory;
  rootCache.set(directory, value);
  return value;
};

const textOf = (input: unknown, key: string): string | null => {
  if (!input || typeof input !== 'object') return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const hintsOf = async (directory: string | null, projectName: string | null): Promise<MappingHint[]> => {
  const hints: MappingHint[] = [];
  const folder = directory ? basename(directory) : '';
  if (folder) hints.push({ value: folder });
  if (projectName) hints.push({ value: projectName });
  const git = await gitIdentityOf(directory);
  if (git?.remote) hints.push({ value: git.remote });
  if (git?.repo) hints.push({ value: git.repo });
  return hints;
};

/** What a tracker call is scoped to: the resolved folder, its name and the mapping hints. */
export type ProjectScope = {
  directory: string | null;
  projectName: string | null;
  hints: MappingHint[];
};

/**
 * The folder a call is for. Prefer the host field, then the latest top-level
 * session folder; resolve a worktree to its main checkout so the folder name
 * and git remote both identify the same project.
 */
export const scopeOf = async (input: unknown, fallback: string | null): Promise<ProjectScope> => {
  const requested = textOf(input, 'directory')
    ?? textOf(input, 'projectPath')
    ?? fallback;
  const directory = await projectRootOf(requested);
  const projectName = textOf(input, 'projectName');
  return { directory, projectName, hints: await hintsOf(directory, projectName) };
};
