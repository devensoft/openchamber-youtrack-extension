/**
 * YouTrack search-syntax fragments.
 *
 * The tracker input is neutral; these functions turn it into the query string
 * YouTrack understands. Pure, so the exact string can be asserted without a
 * server.
 */
import type {
  TrackerProviderContainer,
  TrackerProviderInputs,
  TrackerProviderPriority,
  TrackerProviderStateCategory,
} from '@openchamber/sdk';

/** A term with whitespace is braced, YouTrack's escape for a multi-word value. */
export const quoteTerm = (term: string): string => (/\s/.test(term) ? `{${term}}` : term);

/** `Field: a, b, {multi word}` — the shape a custom-field filter uses. */
export const valueListQuery = (field: string, names: string[]): string =>
  `${field}: ${names.map(quoteTerm).join(', ')}`;

/** The project scope for an unscoped list: every visible container, by key or name. */
export const projectQuery = (containers: TrackerProviderContainer[]): string | null => {
  const terms = containers
    .map((container) => container.key ?? container.name)
    .filter((term): term is string => Boolean(term));
  if (terms.length === 0) return null;
  return `project: ${terms.map(quoteTerm).join(', ')}`;
};

const PRIORITY_QUERY: Record<Exclude<TrackerProviderPriority, 'none'>, string[]> = {
  urgent: ['Show-stopper', 'Critical', 'Blocker'],
  high: ['Major', 'High'],
  medium: ['Normal', 'Medium'],
  low: ['Minor', 'Low'],
};

/** A neutral priority as the names YouTrack projects give it (English defaults). */
export const priorityFilterQuery = (
  priority: TrackerProviderInputs['items.list']['priority'],
): string | null => {
  if (priority === 'all' || priority === 'none') return null;
  const names = PRIORITY_QUERY[priority];
  if (!names) return null;
  return valueListQuery('Priority', names);
};

export const peopleFilterQuery = (
  people: TrackerProviderInputs['items.list']['people'],
): string | null => {
  if (people === 'me') return 'for: me';
  if (people === 'created') return 'created by: me';
  return null;
};

/** The project's own state names for one neutral category, or null when there are none. */
export const stateNameQuery = (names: string[]): string | null =>
  names.length === 0 ? null : valueListQuery('State', names);

/**
 * The coarse fallback when a project has no state for the requested category:
 * cancellation is the only category that reads as resolved.
 */
export const categoryFallback = (
  category: TrackerProviderStateCategory,
): '#Resolved' | '#Unresolved' => (category === 'canceled' ? '#Resolved' : '#Unresolved');
