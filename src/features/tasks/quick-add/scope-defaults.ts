import type { TaskQuery } from '@/lib/domain/filters';
import { addDays, type IsoDate } from '@/lib/time/dates';
import type { Catalog } from '../data/hooks';

type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface ScopeDefaults {
  projectId: string | null;
  tagNames: string[];
  priority: Priority | null;
  due: IsoDate | null;
}

const isPriority = (key: string | null | undefined): key is Priority =>
  key === 'critical' || key === 'high' || key === 'medium' || key === 'low';

/**
 * What a task written inside a smart list gets, so that it lands in the list:
 * the list's only project, its tags, its only priority, its day.
 */
export function smartDefaults(query: TaskQuery, catalog: Catalog, today: IsoDate): ScopeDefaults {
  const projects = (query.projects ?? []).filter((id) => {
    const p = catalog.projectById.get(id);
    return p && !p.deleted_at;
  });
  const tags = (query.tags ?? []).flatMap((id) => {
    const tag = catalog.tagById.get(id);
    return tag && !tag.deleted_at ? [tag.name] : [];
  });
  const priorities = query.priorities ?? [];
  const priorityKey = priorities.length === 1 ? catalog.priorityById.get(priorities[0]!)?.system_key : null;
  const due = query.due ?? [];
  return {
    projectId: projects.length === 1 ? projects[0]! : null,
    // "Any of the tags" is satisfied by the first one.
    tagNames: query.tagMode === 'all' ? tags : tags.slice(0, 1),
    priority: isPriority(priorityKey) ? priorityKey : null,
    due: due.some((d) => d === 'today' || d === 'week' || d === 'month') ? today : due.includes('tomorrow') ? addDays(today, 1) : null,
  };
}
