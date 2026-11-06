/**
 * The project selector's pure rules: what matches the search box, how the
 * list is grouped, and when the draft differs from what is saved.
 *
 * The panel keeps the DOM and the host calls; everything here is a function of
 * the answer and the draft, so it can be checked without a browser.
 */

export type PanelMode = "all" | "selected";
export type ProjectAccess = "edit" | "read" | "unknown";
export type Project = { id: string; key: string | null; name: string; access: ProjectAccess };
export type ProjectsAnswer = {
  connected: boolean;
  instance: string | null;
  projects: Project[];
  mode: PanelMode;
  selected: string[];
  user: { id: string; login: string | null } | null;
  needsLoad: boolean;
};

export type ProjectGroup = { access: ProjectAccess; label: string; projects: Project[] };

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Same ids, order ignored; duplicates are not a difference. */
export const sameList = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) return false;
  const chosen = new Set(left);
  return right.every((id) => chosen.has(id));
};

// Keep the boxes in sync with the saved project selection, independently of
// whether the board currently shows all projects or only the selected ones.
export const checkedFrom = (answer: ProjectsAnswer): Set<string> => new Set(answer.selected);

export const searchTermOf = (search: string): string => search.trim().toLocaleLowerCase();

export const matchesSearch = (project: Project, term: string): boolean => {
  const wanted = term.trim().toLocaleLowerCase();
  if (!wanted) return true;
  return (
    project.name.toLocaleLowerCase().includes(wanted)
    || (project.key ?? "").toLocaleLowerCase().includes(wanted)
  );
};

/** Alphabetical by name, then key; a copy, so the caller's array keeps its order. */
export const sortByName = (projects: readonly Project[]): Project[] =>
  [...projects].sort(
    (left, right) =>
      collator.compare(left.name, right.name) || collator.compare(left.key ?? "", right.key ?? ""),
  );

/**
 * Can edit, then Read only, then Access unknown. A list where every project is
 * unknown is simply "Projects": the tracker has not filled access in yet.
 */
export const groupProjects = (projects: readonly Project[], term: string): ProjectGroup[] => {
  const visible = projects.filter((project) => matchesSearch(project, term));
  const allUnknown = projects.every((project) => project.access === "unknown");
  return (["edit", "read", "unknown"] as const).flatMap((access) => {
    const inGroup = sortByName(visible.filter((project) => project.access === access));
    if (inGroup.length === 0) return [];
    const label =
      access === "edit"
        ? "Can edit"
        : access === "read"
          ? "Read only"
          : allUnknown
            ? "Projects"
            : "Access unknown";
    return [{ access, label, projects: inGroup }];
  });
};

export const summaryText = (mode: PanelMode, total: number, selected: number): string => {
  if (mode === "all") return `All ${total} projects included`;
  if (selected === 0) return "Pick at least one project";
  if (selected === total) return `All ${total} projects selected`;
  return `${selected} of ${total} selected`;
};

export const isDirty = (draft: Iterable<string>, selected: readonly string[]): boolean =>
  !sameList([...draft], selected);
