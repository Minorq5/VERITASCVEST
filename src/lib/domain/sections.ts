import { addDays, zonedMoment, type IsoDate } from '@/lib/time/dates';

/** Lists in the sidebar ("разделы"), in the order of the 1–7 shortcuts. */
export const sections = ['inbox', 'today', 'tomorrow', 'week', 'overdue', 'completed', 'trash'] as const;
export type Section = (typeof sections)[number];

export interface SectionTask {
  id: string;
  parent_id: string | null;
  project_id: string | null;
  due_date: string | null;
  due_time: string | null;
  timezone: string;
  completed_at: string | null;
  deleted_at: string | null;
  priority_id: string | null;
  sort_key: string;
  created_at: string;
}

export interface SectionContext {
  today: IsoDate;
  now: Date;
}

const active = (t: SectionTask) => !t.deleted_at && !t.completed_at;

export function dueMoment(t: SectionTask): Date | null {
  return t.due_date ? zonedMoment(t.due_date, t.due_time, t.timezone) : null;
}

/** Past its deadline: an earlier day, or today after the given time. */
export function isOverdue(t: SectionTask, ctx: SectionContext): boolean {
  if (!active(t) || !t.due_date) return false;
  if (t.due_date < ctx.today) return true;
  if (t.due_date > ctx.today || !t.due_time) return false;
  const due = dueMoment(t);
  return due !== null && due.getTime() < ctx.now.getTime();
}

export function inSection(t: SectionTask, section: Section, ctx: SectionContext, deletedIds?: ReadonlySet<string>): boolean {
  switch (section) {
    case 'today':
      return active(t) && t.due_date !== null && t.due_date <= ctx.today;
    case 'tomorrow':
      return active(t) && t.due_date === addDays(ctx.today, 1);
    case 'week':
      return active(t) && t.due_date !== null && t.due_date >= ctx.today && t.due_date <= addDays(ctx.today, 6);
    case 'overdue':
      return isOverdue(t, ctx);
    case 'inbox':
      return active(t) && !t.project_id && !t.parent_id;
    case 'completed':
      return !t.deleted_at && t.completed_at !== null;
    case 'trash':
      // A subtask of a deleted task is shown inside its parent, not on its own.
      return t.deleted_at !== null && !(t.parent_id && deletedIds?.has(t.parent_id));
  }
}

/** Deadline first (tasks without one last), then time (all-day before timed), priority, manual order. */
export function compareTasks(a: SectionTask, b: SectionTask, rankOf: (priorityId: string | null) => number): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  if (a.due_time !== b.due_time) {
    if (!a.due_time) return -1;
    if (!b.due_time) return 1;
    return a.due_time < b.due_time ? -1 : 1;
  }
  const ra = rankOf(a.priority_id);
  const rb = rankOf(b.priority_id);
  if (ra !== rb) return ra - rb;
  if (a.sort_key !== b.sort_key) return a.sort_key < b.sort_key ? -1 : 1;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id.localeCompare(b.id);
}

/** Manual order (inbox, subtasks): sort key, then creation. */
export function compareManual(a: SectionTask, b: SectionTask): number {
  if (a.sort_key !== b.sort_key) return a.sort_key < b.sort_key ? -1 : 1;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id.localeCompare(b.id);
}

export function sectionCounts(tasks: readonly SectionTask[], ctx: SectionContext): Record<Section, number> {
  const deleted = new Set(tasks.filter((t) => t.deleted_at).map((t) => t.id));
  const counts = Object.fromEntries(sections.map((s) => [s, 0])) as Record<Section, number>;
  for (const t of tasks) for (const s of sections) if (inSection(t, s, ctx, deleted)) counts[s] += 1;
  return counts;
}

/** Days left before a trashed task is removed for good (30-day trash). */
export function trashDaysLeft(deletedAt: string, now: Date, retentionDays = 30): number {
  const age = (now.getTime() - Date.parse(deletedAt)) / 86_400_000;
  return Math.max(0, Math.ceil(retentionDays - age));
}
