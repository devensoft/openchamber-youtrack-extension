/**
 * YouTrack's JSON read into OpenChamber's neutral tracker shapes.
 *
 * Pure translation: no I/O, no credential, no config. Kept out of the service
 * entry so the vocabulary can be exercised without starting the server.
 */
import type {
  TrackerProviderComment,
  TrackerProviderContainer,
  TrackerProviderItem,
  TrackerProviderItemSummary,
  TrackerProviderLiveSummary,
  TrackerProviderPerson,
  TrackerProviderPriority,
  TrackerProviderStateCategory,
  TrackerProviderWorkflowState,
} from '@openchamber/sdk';

// ---------------------------------------------------------------------------
// The parts of YouTrack's JSON this service reads.

export type YtUser = {
  id?: string;
  login?: string | null;
  name?: string | null;
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export type YtProject = {
  id: string;
  name?: string | null;
  shortName?: string | null;
  leader?: { id?: string | null; login?: string | null } | null;
  team?: {
    allUsersGroup?: boolean | null;
    users?: Array<{ id?: string | null; login?: string | null }> | null;
  } | null;
};

/** An enum/state/user value. `isResolved` is only on state bundle elements. */
export type YtFieldValue = {
  id?: string | null;
  name?: string | null;
  isResolved?: boolean | null;
  login?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

export type YtCustomField = { name: string; value?: YtFieldValue | YtFieldValue[] | null };

export type YtTag = { id: string; name?: string | null; color?: { id?: string | null } | null };

export type YtComment = { id: string; text?: string | null; created?: number | null; author?: YtUser | null };

export type YtIssue = {
  id: string;
  idReadable?: string | null;
  summary?: string | null;
  description?: string | null;
  created?: number | null;
  updated?: number | null;
  resolved?: number | null;
  project?: YtProject | null;
  customFields?: YtCustomField[] | null;
  tags?: YtTag[] | null;
  comments?: YtComment[] | null;
};

export type YtProjectField = {
  id: string;
  name?: string | null;
  field?: { name?: string | null } | null;
  bundle?: { values?: YtFieldValue[] | null } | null;
};

/**
 * `value(...)` carries the union of every element shape: enum names, state
 * `isResolved`, and user fields. YouTrack ignores the projections that do not
 * apply to an element type.
 */
export const ISSUE_FIELDS = [
  'id',
  'idReadable',
  'summary',
  'description',
  'created',
  'updated',
  'resolved',
  'project(id,name,shortName)',
  'tags(id,name,color(id))',
  'customFields(name,value(id,name,isResolved,login,fullName,avatarUrl))',
].join(',');

export const ISSUE_FIELDS_WITH_COMMENTS = `${ISSUE_FIELDS},comments(id,text,created,author(id,login,name,fullName,avatarUrl))`;

// ---------------------------------------------------------------------------
// YouTrack to the neutral shapes.

export const iso = (ms: number | null | undefined): string | null => (
  typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null
);

export const absolute = (instance: string, url: string | null | undefined): string | null => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${instance}${url.startsWith('/') ? '' : '/'}${url}`;
};

const single = (value: YtFieldValue | YtFieldValue[] | null | undefined): YtFieldValue | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

export const fieldNamed = (issue: YtIssue, name: string): YtFieldValue | null => {
  const field = issue.customFields?.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  return single(field?.value);
};

export const isStateValue = (value: unknown): value is YtFieldValue => (
  Object(value) === value &&
  !Array.isArray(value) &&
  typeof (value as YtFieldValue).isResolved === 'boolean'
);

/** The issue's state field, whatever the project calls it ("State", "Stage", "Status"). */
export const stateOf = (issue: YtIssue): { name: string; value: YtFieldValue | null } => {
  for (const field of issue.customFields ?? []) {
    const candidates = Array.isArray(field.value) ? field.value : [field.value];
    const state = candidates.find(isStateValue);
    if (state) return { name: field.name, value: state };
  }
  return { name: 'State', value: null };
};

/**
 * YouTrack has no portable todo/in-progress/done taxonomy: categories are
 * per-project workflows. Infer the neutral category from the bundle element's
 * resolution flag plus its name.
 */
export const categoryOf = (
  name: string | null | undefined,
  isResolved: boolean | null | undefined,
): TrackerProviderStateCategory | null => {
  const text = (name ?? '').trim().toLowerCase();
  if (/won'?t fix|cancel|duplicate|obsolete|rejected|declined|invalid/.test(text)) return 'canceled';
  if (isResolved === true) return 'done';
  if (!text) return null;
  if (/backlog|icebox/.test(text)) return 'backlog';
  if (/triage|inbox/.test(text)) return 'triage';
  if (/in progress|in review|review|testing|\bqa\b|doing|started|in dev|development|implement|pending/.test(text)) return 'in-progress';
  if (/to ?do|todo|submitted|open|new|ready|approved/.test(text)) return 'todo';
  return 'todo';
};

/**
 * The default YouTrack workflow's unresolved state names. Only used when an
 * unscoped category filter has too many visible projects to read each
 * workflow, so the answer stays one query instead of a project-wide scan.
 */
const COMMON_STATE_NAMES = [
  'Triage',
  'Inbox',
  'Backlog',
  'Icebox',
  'Submitted',
  'Open',
  'New',
  'Ready',
  'Approved',
  'To Do',
  'In Progress',
  'In Review',
  'Review',
  'Testing',
  'QA',
  'Doing',
  'Started',
  'In Development',
  'Pending Deploy',
  "Won't fix",
  'Duplicate',
  'Obsolete',
  'Rejected',
  'Declined',
  'Invalid',
];

/** The common names for one neutral category, empty for a resolved category. */
export const commonStateNames = (category: TrackerProviderStateCategory): string[] =>
  COMMON_STATE_NAMES.filter((name) => categoryOf(name, false) === category);

const PRIORITY_BY_NAME: Record<string, TrackerProviderPriority> = {
  'show-stopper': 'urgent',
  'showstopper': 'urgent',
  blocker: 'urgent',
  critical: 'urgent',
  highest: 'urgent',
  major: 'high',
  high: 'high',
  normal: 'medium',
  medium: 'medium',
  minor: 'low',
  low: 'low',
  lowest: 'low',
  'no priority': 'none',
  none: 'none',
};

export const priorityOf = (name: string | null | undefined): TrackerProviderPriority => {
  if (!name) return 'none';
  return PRIORITY_BY_NAME[name.trim().toLowerCase()] ?? 'none';
};

export const personOf = (instance: string, value: YtFieldValue | YtUser | null | undefined): TrackerProviderPerson | null => {
  if (!value) return null;
  const name = ('fullName' in value ? value.fullName : undefined) ?? value.name ?? value.login ?? null;
  if (!name) return null;
  return { name, avatarUrl: absolute(instance, value.avatarUrl) };
};

export const toContainer = (project: YtProject): TrackerProviderContainer => ({
  id: project.id,
  key: project.shortName ?? project.name ?? null,
  name: project.name ?? project.shortName ?? project.id,
});

export const toSummary = (instance: string, raw: YtIssue): TrackerProviderItemSummary => {
  const identifier = (raw.idReadable ?? raw.id).toUpperCase();
  const state = stateOf(raw);
  const priority = fieldNamed(raw, 'priority');
  const assignee = fieldNamed(raw, 'assignee');
  return {
    id: raw.id,
    identifier,
    title: raw.summary ?? identifier,
    url: `${instance}/issue/${encodeURIComponent(identifier)}`,
    state: state.value
      ? {
          id: state.value.id ?? null,
          name: state.value.name ?? '',
          category: categoryOf(state.value.name, state.value.isResolved),
        }
      : null,
    priority: priorityOf(priority?.name),
    labels: (raw.tags ?? []).map((tag) => ({
      id: tag.id,
      name: tag.name ?? tag.id,
      color: tag.color?.id ?? null,
    })),
    assignee: personOf(instance, assignee),
    container: raw.project ? toContainer(raw.project) : null,
    updatedAt: iso(raw.updated),
  };
};

export const toComment = (instance: string, raw: YtComment): TrackerProviderComment => ({
  id: raw.id,
  body: raw.text ?? '',
  createdAt: iso(raw.created),
  author: personOf(instance, raw.author),
});

export const toItem = (instance: string, raw: YtIssue): TrackerProviderItem => ({
  ...toSummary(instance, raw),
  description: raw.description ?? null,
  comments: (raw.comments ?? []).map((comment) => toComment(instance, comment)),
});

export const toWorkflowState = (value: YtFieldValue, position: number): TrackerProviderWorkflowState => ({
  // The name is the id: `items.updateState` writes a state by name, and state
  // names are unique inside a project's bundle.
  id: value.name ?? value.id ?? `state-${position}`,
  name: value.name ?? value.id ?? `State ${position}`,
  category: categoryOf(value.name, value.isResolved),
  position,
});

export const toLiveSummary = (instance: string, raw: YtIssue): TrackerProviderLiveSummary => {
  const summary = toSummary(instance, raw);
  return {
    identifier: summary.identifier,
    title: summary.title,
    state: { name: summary.state?.name ?? 'Open', category: summary.state?.category ?? 'todo' },
  };
};
