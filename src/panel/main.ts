import { connectHost } from "@openchamber/sdk";
import { applyHostReady } from "@openchamber/sdk/ui";
import {
  checkedFrom,
  groupProjects,
  isDirty,
  matchesSearch,
  searchTermOf,
  summaryText,
  type PanelMode,
  type Project,
  type ProjectAccess,
  type ProjectsAnswer,
} from "./projects.ts";

const host = connectHost();
const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("panel root element is missing");
}

let mounted = false;
let loading = false;
let saving = false;
let error: string | null = null;
let state: ProjectsAnswer | null = null;
let draft = new Set<string>();
let search = "";
let groupsEl: HTMLDivElement | null = null;
let countEl: HTMLSpanElement | null = null;
let unsavedEl: HTMLSpanElement | null = null;
let saveButton: HTMLButtonElement | null = null;
let selectAllButton: HTMLButtonElement | null = null;
let unselectAllButton: HTMLButtonElement | null = null;

const describe = (cause: unknown): string => {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  return "The YouTrack service did not answer.";
};

const readAnswer = <T>(response: { status: number; body: string }): T => {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`The YouTrack service answered ${response.status}.`);
  }
  return JSON.parse(response.body) as T;
};

const searchTerm = (): string => searchTermOf(search);

const visibleProjects = (): Project[] =>
  state?.projects.filter((project) => matchesSearch(project, searchTerm())) ?? [];

const groupedProjects = () => groupProjects(state?.projects ?? [], searchTerm());

const dirty = (): boolean => {
  if (!state) return false;
  return isDirty(draft, state.selected);
};

const updateMeta = (): void => {
  if (!countEl || !saveButton || !state) return;
  const all = state.projects.length;
  const visible = visibleProjects().length;

  countEl.textContent = summaryText(state.mode, all, draft.size);

  const changed = dirty();
  if (unsavedEl) unsavedEl.hidden = !changed;
  saveButton.textContent = saving ? "Saving…" : "Save";
  saveButton.disabled = saving || draft.size === 0 || !changed;
  if (selectAllButton) {
    selectAllButton.textContent = searchTerm() ? "Select visible" : "Select all";
    selectAllButton.disabled = saving || visible === 0;
  }
  if (unselectAllButton) unselectAllButton.disabled = saving || draft.size === 0;
};

const button = (label: string, onClick: () => void, primary = false): HTMLButtonElement => {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.className = primary ? "primary" : "";
  element.addEventListener("click", onClick);
  return element;
};

const searchIcon = (): SVGSVGElement => {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("search-icon");

  const circle = document.createElementNS(ns, "circle");
  circle.setAttribute("cx", "11");
  circle.setAttribute("cy", "11");
  circle.setAttribute("r", "7");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "m20 20-3.5-3.5");
  svg.append(circle, path);
  return svg;
};

const load = async (): Promise<void> => {
  loading = true;
  error = null;
  render();

  try {
    const response = await host.serviceRequest({ method: "GET", path: "/projects" });
    state = readAnswer<ProjectsAnswer>(response);
    draft = checkedFrom(state);
  } catch (cause) {
    error = describe(cause);
  } finally {
    loading = false;
    render();
  }
};

let refreshing = false;

const sameAnswer = (left: ProjectsAnswer | null, right: ProjectsAnswer): boolean =>
  left !== null && JSON.stringify(left) === JSON.stringify(right);

// The rail panel can stay mounted while the account is disconnected in
// Settings. Re-read when the panel comes back into view, and only redraw when
// the answer actually changed so typing and focus survive an unchanged poll.
const refresh = async (): Promise<void> => {
  if (loading || saving || refreshing) return;
  refreshing = true;
  try {
    const response = await host.serviceRequest({ method: "GET", path: "/projects" });
    const next = readAnswer<ProjectsAnswer>(response);
    if (sameAnswer(state, next)) return;
    state = next;
    draft = checkedFrom(state);
    render();
  } catch {
    // Keep the last good answer; the explicit Reload reports errors.
  } finally {
    refreshing = false;
  }
};

const saveDraft = async (): Promise<void> => {
  if (!state?.instance || saving || draft.size === 0) return;
  await putSelection(state.instance, "selected", [...draft]);
};

const putSelection = async (
  instance: string,
  mode: PanelMode,
  selected: string[],
): Promise<void> => {
  saving = true;
  error = null;
  render();

  try {
    const response = await host.serviceRequest({
      method: "PUT",
      path: "/projects",
      body: JSON.stringify({ instance, mode, selected }),
    });
    const saved = readAnswer<{ mode: PanelMode; selected: string[] }>(response);
    if (!state) return;
    state.mode = saved.mode;
    state.selected = saved.selected;
    draft = checkedFrom(state);
    host.toast({
      kind: "success",
      message:
        saved.mode === "all"
          ? "Showing all projects. Your selection is kept. Reopen Issues and PRs to reload."
          : "Projects saved. Reopen Issues and PRs to reload.",
    });
  } catch (cause) {
    error = describe(cause);
  } finally {
    saving = false;
    render();
  }
};

const groupCard = (group: {
  access: ProjectAccess;
  label: string;
  projects: Project[];
}): HTMLElement => {
  const card = document.createElement("section");
  card.className = "group-card";
  card.dataset.access = group.access;

  const header = document.createElement("header");
  header.className = "group-head";

  const dot = document.createElement("span");
  dot.className = "dot";

  const label = document.createElement("span");
  label.className = "group-title";
  label.textContent = group.label;

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = String(group.projects.length);

  header.append(dot, label, count);
  if (group.access === "edit") {
    header.title = "You are on this project's team, or you lead it.";
  } else if (group.access === "read") {
    header.title = "This project is visible, but you are not on its team.";
  } else {
    header.title = "YouTrack did not return project team data for this project.";
  }

  const tiles = document.createElement("div");
  tiles.className = "tiles";

  for (const project of group.projects) {
    const tile = document.createElement("label");
    tile.className = "project";
    tile.dataset.access = project.access;
    tile.title = project.name;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = draft.has(project.id);
    checkbox.disabled = saving;
    checkbox.setAttribute("aria-label", `${project.name} ${project.key ?? ""}`.trim());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) draft.add(project.id);
      else draft.delete(project.id);
      updateMeta();
    });

    tile.addEventListener("click", (event) => {
      if (saving) return;
      if (event.target === checkbox) return;
      event.preventDefault();
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      checkbox.focus();
    });

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = project.name;

    const key = document.createElement("span");
    key.className = "key";
    key.textContent = project.key ?? project.id;

    tile.append(checkbox, name, key);
    tiles.append(tile);
  }

  card.append(header, tiles);
  return card;
};

const renderGroups = (): void => {
  if (!groupsEl || !state) return;
  groupsEl.replaceChildren();

  const groups = groupedProjects();
  if (groups.length === 0) {
    const empty = document.createElement("div");
    empty.className = "state-card";
    const text = document.createElement("p");
    text.textContent = searchTerm()
      ? `No projects match “${search.trim()}”.`
      : "No projects are available.";
    empty.append(text);
    if (searchTerm()) {
      empty.append(
        button("Clear search", () => {
          search = "";
          render();
        }),
      );
    }
    groupsEl.append(empty);
    return;
  }

  for (const group of groups) {
    groupsEl.append(groupCard(group));
  }
};

const pageHeader = (): HTMLElement => {
  const header = document.createElement("header");
  header.className = "page-header";

  const row = document.createElement("div");
  row.className = "title-row";

  const title = document.createElement("h1");
  title.textContent = "Projects";

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = "Choose which YouTrack projects appear in the board and item picker.";

  row.append(title);
  header.append(row, subtitle);
  return header;
};

const accessSummary = (): HTMLElement | null => {
  const summary = document.createElement("div");
  summary.className = "access-summary";

  const edit = state?.projects.filter((project) => project.access === "edit").length ?? 0;
  const read = state?.projects.filter((project) => project.access === "read").length ?? 0;
  if (edit + read === 0) return null;

  for (const [access, label, count] of [
    ["edit", "Can edit", edit],
    ["read", "Read only", read],
  ] as const) {
    if (count === 0) continue;
    const pill = document.createElement("span");
    pill.className = "summary-pill";
    pill.dataset.access = access;

    const dot = document.createElement("span");
    dot.className = "dot";

    const name = document.createElement("span");
    name.className = "summary-label";
    name.textContent = label;

    const number = document.createElement("span");
    number.className = "summary-count";
    number.textContent = String(count);

    pill.append(dot, name, number);
    summary.append(pill);
  }

  const caveat = document.createElement("span");
  caveat.className = "access-caveat";
  caveat.textContent = "Access is inferred from project team membership.";
  summary.append(caveat);
  return summary;
};

const footer = (): HTMLElement => {
  const bar = document.createElement("footer");
  bar.className = "footer";

  const inner = document.createElement("div");
  inner.className = "footer-inner";

  const row = document.createElement("div");
  row.className = "footer-row";

  const summary = document.createElement("div");
  summary.className = "footer-summary";

  countEl = document.createElement("span");
  countEl.className = "footer-count";

  unsavedEl = document.createElement("span");
  unsavedEl.className = "footer-unsaved";
  unsavedEl.hidden = true;
  const unsavedDot = document.createElement("span");
  unsavedDot.className = "dot";
  unsavedEl.append(unsavedDot, "Unsaved changes");

  summary.append(countEl, unsavedEl);

  const actions = document.createElement("div");
  actions.className = "footer-actions";

  saveButton = button("Save", () => void saveDraft(), true);
  actions.append(saveButton);

  row.append(summary, actions);
  inner.append(row);

  if (state?.instance) {
    const account = document.createElement("p");
    account.className = "footer-account";
    account.textContent = state.user?.login
      ? `Signed in as ${state.user.login} · ${state.instance}`
      : `Account: ${state.instance}`;
    inner.append(account);
  }

  bar.append(inner);
  return bar;
};

const render = (): void => {
  root.replaceChildren();
  groupsEl = null;
  countEl = null;
  unsavedEl = null;
  saveButton = null;
  selectAllButton = null;
  unselectAllButton = null;

  const scroll = document.createElement("div");
  scroll.className = "scroll";

  const page = document.createElement("div");
  page.className = "page";

  page.append(pageHeader());

  if (error) {
    const banner = document.createElement("div");
    banner.className = "banner error";
    const message = document.createElement("span");
    message.textContent = error;
    const retry = button(state ? "Dismiss" : "Reload projects", () => {
      if (state) {
        error = null;
        render();
      } else {
        void load();
      }
    });
    retry.className = "banner-action";
    retry.disabled = loading || saving;
    banner.append(message, retry);
    page.append(banner);
  }

  if (loading && !state) {
    const waiting = document.createElement("div");
    waiting.className = "state-card";
    const text = document.createElement("p");
    text.textContent = "Loading projects…";
    waiting.append(text);
    page.append(waiting);
    root.append(scroll);
    scroll.append(page);
    return;
  }

  if (!state) {
    root.append(scroll);
    scroll.append(page);
    return;
  }

  if (state.needsLoad || state.projects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "state-card";
    const text = document.createElement("p");
    text.textContent =
      state.connected === false
        ? "Connect YouTrack in Settings → Extension accounts, then reload projects."
        : "The project list loads when the YouTrack account is connected. If this account was already connected, open the tracker once.";
    const reload = button("Reload projects", () => void load());
    reload.disabled = loading || saving;
    empty.append(text, reload);
    page.append(empty);
    root.append(scroll);
    scroll.append(page);
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.className = "toolbar-card";

  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.className = "search";
  searchInput.placeholder = "Search by name or key";
  searchInput.setAttribute("aria-label", "Search projects");
  searchInput.value = search;
  searchInput.disabled = saving;
  searchInput.addEventListener("input", () => {
    search = searchInput.value;
    renderGroups();
    updateMeta();
  });

  const searchWrap = document.createElement("div");
  searchWrap.className = "search-wrap";
  searchWrap.append(searchIcon(), searchInput);

  const actions = document.createElement("div");
  actions.className = "toolbar-actions";

  selectAllButton = button("Select all", () => {
    for (const project of visibleProjects()) draft.add(project.id);
    renderGroups();
    updateMeta();
  });
  unselectAllButton = button("Unselect all", () => {
    draft = new Set();
    renderGroups();
    updateMeta();
  });

  actions.append(selectAllButton, unselectAllButton);
  toolbar.append(searchWrap, actions);
  page.append(toolbar);

  const summary = accessSummary();
  if (summary) page.append(summary);

  if (state.projects.some((project) => project.access === "unknown")) {
    const banner = document.createElement("div");
    banner.className = "banner info";
    const message = document.createElement("span");
    message.textContent = "Access labels load with the tracker.";
    const reload = button("Reload", () => void load());
    reload.className = "banner-action";
    reload.disabled = loading || saving;
    banner.append(message, reload);
    page.append(banner);
  }

  groupsEl = document.createElement("div");
  groupsEl.className = "groups";
  page.append(groupsEl);

  scroll.append(page);
  root.append(scroll, footer());

  renderGroups();
  updateMeta();
};

window.addEventListener("focus", () => void refresh());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refresh();
});
// A disconnect in Settings leaves this panel mounted. Poll the local service
// so the cached project list clears even when focus never leaves the frame.
window.setInterval(() => void refresh(), 15000);

host.onReady((context) => {
  applyHostReady(context, document.documentElement);

  if (mounted) return;
  mounted = true;
  void load();
});
