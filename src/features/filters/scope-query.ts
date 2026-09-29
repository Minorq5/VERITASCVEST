import type { TaskQuery } from '@/lib/domain/filters';
import type { ListScope } from '@/features/tasks/quick-add/store';
import type { FilterPart } from './filter-bar';

/**
 * The filter parts that make sense on a list: a date section decides the
 * deadline itself, the inbox holds tasks without a project, and so on.
 * Null — the list has no filter (trash, smart lists edit their own query).
 */
export function filterPartsFor(scope: NonNullable<ListScope>): FilterPart[] | null {
  switch (scope.kind) {
    case 'section':
      switch (scope.section) {
        case 'trash':
          return null;
        case 'inbox':
          return ['due', 'priorities', 'statuses', 'types', 'tags'];
        case 'completed':
          return ['due', 'priorities', 'types', 'projects', 'tags'];
        default:
          return ['priorities', 'statuses', 'types', 'projects', 'tags'];
      }
    case 'project':
      return ['due', 'priorities', 'statuses', 'types', 'tags'];
    case 'tag':
      return ['due', 'priorities', 'statuses', 'types', 'projects', 'tags'];
    case 'smart':
      return null;
  }
}

/** A filter used on a list, as a smart list of its own: the list's meaning is added to the query. */
export function queryForScope(scope: NonNullable<ListScope>, filter: TaskQuery): TaskQuery {
  const q: TaskQuery = { ...filter };
  delete q.state;
  switch (scope.kind) {
    case 'section':
      switch (scope.section) {
        case 'inbox':
          q.projects = ['none'];
          break;
        case 'today':
          q.due ??= ['overdue', 'today'];
          break;
        case 'tomorrow':
          q.due ??= ['tomorrow'];
          break;
        case 'week':
          q.due ??= ['week'];
          break;
        case 'overdue':
          q.due ??= ['overdue'];
          break;
        case 'completed':
          q.state = 'done';
          break;
        case 'trash':
          break;
      }
      break;
    case 'project':
      q.projects = [scope.projectId];
      break;
    case 'tag': {
      const tags = [...new Set([scope.tagId, ...(q.tags ?? [])])];
      q.tags = tags;
      if (tags.length > 1) q.tagMode = 'all';
      break;
    }
    case 'smart':
      return { ...scope.query, ...filter };
  }
  return q;
}
