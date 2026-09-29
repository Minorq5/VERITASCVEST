import { addDays, type IsoDate } from '@/lib/time/dates';
import { isOverdue, type SectionTask } from './sections';
import { isTaskType, type TaskType } from './task-types';

/**
 * Filters and smart lists. A query is plain JSON (it is stored in
 * `saved_filters.query`): every part narrows the list, values inside a part
 * are alternatives ("high or critical").
 */

export const dueFilters = ['overdue', 'today', 'tomorrow', 'week', 'month', 'later', 'none'] as const;
export type DueFilter = (typeof dueFilters)[number];

export const taskStates = ['open', 'done', 'all'] as const;
export type TaskState = (typeof taskStates)[number];

export interface TaskQuery {
  /** Open (default), done or all tasks. */
  state?: TaskState;
  due?: DueFilter[];
  /** Priority ids; "none" — without a priority. */
  priorities?: string[];
  /** Status ids. */
  statuses?: string[];
  types?: TaskType[];
  /** Project ids (a project includes its subprojects); "none" — outside projects. */
  projects?: string[];
  /** Tag ids. */
  tags?: string[];
  /** "any" (default): at least one of the tags; "all": every one. */
  tagMode?: 'any' | 'all';
}

export interface QueryTask extends SectionTask {
  type: string;
  status_id: string | null;
}

export interface QueryContext {
  today: IsoDate;
  now: Date;
  /** Tag ids of a task. */
  tagsOf: (taskId: string) => ReadonlySet<string>;
  /** A project and all its subprojects. */
  projectTree: (projectId: string) => ReadonlySet<string>;
}

const NONE = 'none';

/** Which due bucket a task is in (open tasks; done ones by their date). */
export function dueBucket(task: QueryTask, ctx: Pick<QueryContext, 'today' | 'now'>): DueFilter {
  if (!task.due_date) return 'none';
  if (isOverdue(task, ctx)) return 'overdue';
  if (task.due_date <= ctx.today) return 'today';
  if (task.due_date === addDays(ctx.today, 1)) return 'tomorrow';
  if (task.due_date <= addDays(ctx.today, 6)) return 'week';
  if (task.due_date <= addDays(ctx.today, 30)) return 'month';
  return 'later';
}

/** Due filters are plain date ranges: a task due today at a passed hour is both "today" and "overdue". */
export function matchesDue(task: QueryTask, due: DueFilter, ctx: Pick<QueryContext, 'today' | 'now'>): boolean {
  const date = task.due_date;
  switch (due) {
    case 'none':
      return !date;
    case 'overdue':
      return isOverdue(task, ctx);
    case 'today':
      return date === ctx.today;
    case 'tomorrow':
      return date === addDays(ctx.today, 1);
    case 'week':
      return Boolean(date && date >= ctx.today && date <= addDays(ctx.today, 6));
    case 'month':
      return Boolean(date && date >= ctx.today && date <= addDays(ctx.today, 30));
    case 'later':
      return Boolean(date && date > addDays(ctx.today, 30));
  }
}

export function matchesQuery(task: QueryTask, query: TaskQuery, ctx: QueryContext): boolean {
  if (task.deleted_at) return false;
  const state = query.state ?? 'open';
  if (state === 'open' && task.completed_at) return false;
  if (state === 'done' && !task.completed_at) return false;

  if (query.due?.length && !query.due.some((d) => matchesDue(task, d, ctx))) return false;

  if (query.priorities?.length && !query.priorities.includes(task.priority_id ?? NONE)) return false;
  if (query.statuses?.length && !(task.status_id && query.statuses.includes(task.status_id))) return false;
  if (query.types?.length && !query.types.includes(task.type as TaskType)) return false;

  if (query.projects?.length) {
    const ok = query.projects.some((p) => (p === NONE ? !task.project_id : Boolean(task.project_id && ctx.projectTree(p).has(task.project_id))));
    if (!ok) return false;
  }

  if (query.tags?.length) {
    const own = ctx.tagsOf(task.id);
    const ok = query.tagMode === 'all' ? query.tags.every((t) => own.has(t)) : query.tags.some((t) => own.has(t));
    if (!ok) return false;
  }
  return true;
}

/** Parts that narrow the list (for "N filters" and the empty check). */
export function activeParts(query: TaskQuery): number {
  let n = 0;
  if ((query.state ?? 'open') !== 'open') n += 1;
  for (const part of [query.due, query.priorities, query.statuses, query.types, query.projects, query.tags]) if (part?.length) n += 1;
  return n;
}

const strings = (value: unknown, max = 200): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const out = [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= max))];
  return out.length ? out.slice(0, 200) : undefined;
};

/** A query from stored JSON: unknown or broken parts are dropped, never trusted. */
export function sanitizeQuery(raw: unknown): TaskQuery {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const q: TaskQuery = {};
  if (typeof r.state === 'string' && (taskStates as readonly string[]).includes(r.state)) q.state = r.state as TaskState;
  const due = strings(r.due)?.filter((d): d is DueFilter => (dueFilters as readonly string[]).includes(d));
  if (due?.length) q.due = due;
  const priorities = strings(r.priorities, 64);
  if (priorities) q.priorities = priorities;
  const statuses = strings(r.statuses, 64);
  if (statuses) q.statuses = statuses;
  const types = strings(r.types)?.filter((t): t is TaskType => isTaskType(t));
  if (types?.length) q.types = types;
  const projects = strings(r.projects, 64);
  if (projects) q.projects = projects;
  const tags = strings(r.tags, 64);
  if (tags) q.tags = tags;
  if (r.tagMode === 'all') q.tagMode = 'all';
  return q;
}

/** A project and its subprojects, from the flat list. */
export function projectTrees(projects: readonly { id: string; parent_id: string | null }[]): (projectId: string) => ReadonlySet<string> {
  const children = new Map<string, string[]>();
  for (const p of projects) {
    if (!p.parent_id) continue;
    const list = children.get(p.parent_id) ?? [];
    list.push(p.id);
    children.set(p.parent_id, list);
  }
  const cache = new Map<string, Set<string>>();
  return (projectId) => {
    const hit = cache.get(projectId);
    if (hit) return hit;
    const tree = new Set<string>();
    const stack = [projectId];
    while (stack.length) {
      const id = stack.pop()!;
      if (tree.has(id)) continue;
      tree.add(id);
      stack.push(...(children.get(id) ?? []));
    }
    cache.set(projectId, tree);
    return tree;
  };
}
