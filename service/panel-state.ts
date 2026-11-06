/**
 * The rail panel's project selection: the shapes, and the pure rules that
 * decide what is visible and what a save stores.
 *
 * The service entry owns the file and the in-memory copy; everything here
 * takes the state it needs as an argument.
 */
import type { TrackerProviderContainer } from '@openchamber/sdk';

export type PanelMode = 'all' | 'selected';
export type ProjectAccess = 'edit' | 'read' | 'unknown';
export type PanelProject = TrackerProviderContainer & { access: ProjectAccess };
export type PanelUser = { id: string; login: string | null };

export type PanelState = {
  selectedByInstance: Record<string, string[]>;
  modeByInstance: Record<string, PanelMode>;
  knownProjects: Record<string, PanelProject[]>;
  currentUserByInstance: Record<string, PanelUser>;
  lastInstance: string | null;
};

export type Selection = { instance: string; mode: PanelMode; selected: string[] };

export const emptyPanelState = (): PanelState => ({
  selectedByInstance: {},
  modeByInstance: {},
  knownProjects: {},
  currentUserByInstance: {},
  lastInstance: null,
});

/** Drop anything malformed from a saved `knownProjects` map; keep what is usable. */
export const knownProjectsOf = (value: unknown): Record<string, PanelProject[]> => {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, PanelProject[]> = {};
  for (const [instance, projects] of Object.entries(value as Record<string, PanelProject[]>)) {
    if (!Array.isArray(projects)) continue;
    const cleaned = projects.flatMap((project) => {
      if (!project || typeof project !== 'object' || typeof project.id !== 'string') return [];
      const access: ProjectAccess =
        project.access === 'edit' || project.access === 'read' ? project.access : 'unknown';
      return [{
        id: project.id,
        key: typeof project.key === 'string' ? project.key : null,
        name: typeof project.name === 'string' ? project.name : project.id,
        access,
      }];
    });
    result[instance] = cleaned;
  }
  return result;
};

/** Older files have no mode; a non-empty selection means it was in use. */
export const modeOf = (state: PanelState, instance: string): PanelMode =>
  state.modeByInstance[instance]
    ?? ((state.selectedByInstance[instance]?.length ?? 0) > 0 ? 'selected' : 'all');

/**
 * What the board and the unscoped item picker see. An empty selection in
 * `selected` mode is refused at save time, but a visible list must still be
 * whole if an old file disagrees.
 */
export const visibleProjects = (
  projects: readonly PanelProject[],
  mode: PanelMode,
  selected: readonly string[],
): PanelProject[] => {
  const chosen = new Set(selected);
  if (mode === 'all' || chosen.size === 0) return [...projects];
  return projects.filter((project) => chosen.has(project.id));
};

/**
 * The body of `PUT /projects`, before it is checked against the known project
 * ids. `null` is a body this service will not store.
 */
export const parseSelectionRequest = (
  body: string,
  fallbackInstance: string | null,
): Selection | null => {
  let parsed: { instance?: unknown; mode?: unknown; selected?: unknown };
  try {
    parsed = JSON.parse(body) as { instance?: unknown; mode?: unknown; selected?: unknown };
  } catch {
    return null;
  }

  const instance = typeof parsed.instance === 'string' ? parsed.instance : fallbackInstance;
  const selected = Array.isArray(parsed.selected)
    ? parsed.selected.filter((id): id is string => typeof id === 'string')
    : null;
  if (!instance || !selected) return null;

  const mode: PanelMode =
    parsed.mode === 'all' || parsed.mode === 'selected'
      ? parsed.mode
      : selected.length === 0
        ? 'all'
        : 'selected';
  if (mode === 'selected' && selected.length === 0) return null;

  return { instance, mode, selected };
};

/**
 * Keep only ids this instance's project list knows. An empty known list means
 * the project list has not loaded yet, so the ids are kept as given.
 *
 * The selection outlives the mode: "Show all" is a visibility switch, not a
 * reset, so switching back to `selected` restores the picked projects.
 */
export const restrictSelection = (
  selection: Selection,
  knownIds: ReadonlySet<string>,
): Selection | null => {
  const selected =
    knownIds.size === 0
      ? selection.selected
      : selection.selected.filter((id) => knownIds.has(id));
  if (selection.mode === 'selected' && selected.length === 0) return null;
  return { ...selection, selected };
};
