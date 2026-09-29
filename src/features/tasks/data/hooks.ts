'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';
import { useSettings } from '@/features/account/queries';
import { useSync } from '@/features/sync/sync-provider';
import type {
  AttachmentRow,
  CommentRow,
  CompletionRow,
  HabitLogRow,
  MilestoneRow,
  PriorityRow,
  ProgressEventRow,
  ProjectRow,
  StatusRow,
  TagRow,
  TaskRow,
  TemplateRow,
  TimeSessionRow,
} from '@/lib/db/types';
import { useNow } from '@/lib/hooks/use-now';
import { todayIn, type IsoDate } from '@/lib/time/dates';
import { deviceTimeZone } from '@/lib/time/zones';

/**
 * Reading data: live queries over the device copy. Every screen updates by
 * itself when anything changes: an edit here, another tab, or a change that
 * arrived from the server.
 */

export interface PlannerPrefs {
  timeZone: string;
  weekStart: number;
  hour12: boolean;
  locale: string;
}

export function usePlannerPrefs(): PlannerPrefs {
  const settings = useSettings().data;
  const locale = useLocale();
  return useMemo(
    () => ({
      timeZone: settings?.timezone || deviceTimeZone(),
      weekStart: settings?.week_start ?? 1,
      hour12: settings?.time_format === '12h',
      locale,
    }),
    [settings?.timezone, settings?.week_start, settings?.time_format, locale],
  );
}

/** "Today" in the account's time zone, and the clock it was taken from. */
export function useToday(): { today: IsoDate; now: Date } {
  const { timeZone } = usePlannerPrefs();
  const ms = useNow();
  return useMemo(() => {
    const now = new Date(ms);
    return { today: todayIn(timeZone, now), now };
  }, [ms, timeZone]);
}

export function useTasks(): TaskRow[] | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => (await db.tasks.toArray()) as unknown as TaskRow[], [db]);
}

export function useTask(id: string | null | undefined): TaskRow | null | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => (id ? (((await db.tasks.get(id)) as TaskRow | undefined) ?? null) : null), [db, id]);
}

// ---------------------------------------------------------------------------
// Catalog: statuses, priorities, projects, tags
// ---------------------------------------------------------------------------
export interface Catalog {
  statuses: StatusRow[];
  priorities: PriorityRow[];
  projects: ProjectRow[];
  tags: TagRow[];
  templates: TemplateRow[];
  statusById: Map<string, StatusRow>;
  priorityById: Map<string, PriorityRow>;
  priorityByKey: Map<string, PriorityRow>;
  projectById: Map<string, ProjectRow>;
  tagById: Map<string, TagRow>;
  /** 1 (critical) … 4 (low); tasks without a priority sort after them. */
  rankOf: (priorityId: string | null) => number;
}

const byId = <T extends { id: string }>(rows: readonly T[]) => new Map(rows.map((r) => [r.id, r]));
const alive = <T extends { deleted_at: string | null }>(rows: readonly T[]) => rows.filter((r) => !r.deleted_at);

export function useCatalog(): Catalog | undefined {
  const { db } = useSync();
  const data = useLiveQuery(async () => {
    const [statuses, priorities, projects, tags, templates] = await Promise.all([
      db.statuses.toArray(),
      db.priorities.toArray(),
      db.projects.toArray(),
      db.tags.toArray(),
      db.templates.toArray(),
    ]);
    return {
      statuses: statuses as StatusRow[],
      priorities: priorities as PriorityRow[],
      projects: projects as ProjectRow[],
      tags: tags as TagRow[],
      templates: templates as TemplateRow[],
    };
  }, [db]);

  return useMemo(() => {
    if (!data) return undefined;
    const priorities = alive(data.priorities).sort((a, b) => a.rank - b.rank);
    const priorityById = byId(data.priorities);
    return {
      statuses: alive(data.statuses).sort((a, b) => (a.sort_key < b.sort_key ? -1 : 1)),
      priorities,
      projects: alive(data.projects)
        .filter((p) => !p.archived_at)
        .sort((a, b) => (a.sort_key < b.sort_key ? -1 : a.sort_key > b.sort_key ? 1 : a.name.localeCompare(b.name))),
      tags: alive(data.tags).sort((a, b) => a.name.localeCompare(b.name)),
      templates: alive(data.templates).sort((a, b) => a.name.localeCompare(b.name)),
      statusById: byId(data.statuses),
      priorityById,
      priorityByKey: new Map(priorities.filter((p) => p.system_key).map((p) => [p.system_key!, p])),
      projectById: byId(data.projects),
      tagById: byId(data.tags),
      rankOf: (id) => (id ? (priorityById.get(id)?.rank ?? 5) : 5),
    };
  }, [data]);
}

// ---------------------------------------------------------------------------
// What task rows show: tags, counts and the parts progress is computed from
// ---------------------------------------------------------------------------
export interface TaskIndex {
  tags: Map<string, string[]>;
  comments: Map<string, number>;
  attachments: Map<string, number>;
  milestones: Map<string, MilestoneRow[]>;
  events: Map<string, ProgressEventRow[]>;
  sessions: Map<string, TimeSessionRow[]>;
  habitLogs: Map<string, HabitLogRow[]>;
}

function group<T extends { task_id: string; deleted_at: string | null }>(rows: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (row.deleted_at) continue;
    const list = map.get(row.task_id);
    if (list) list.push(row);
    else map.set(row.task_id, [row]);
  }
  return map;
}

function count(rows: readonly { task_id: string; deleted_at: string | null }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) if (!row.deleted_at) map.set(row.task_id, (map.get(row.task_id) ?? 0) + 1);
  return map;
}

export function useTaskIndex(): TaskIndex | undefined {
  const { db } = useSync();
  const data = useLiveQuery(async () => {
    const [links, comments, attachments, milestones, events, sessions, habitLogs] = await Promise.all([
      db.task_tags.toArray(),
      db.comments.toArray(),
      db.attachments.toArray(),
      db.task_milestones.toArray(),
      db.progress_events.toArray(),
      db.time_sessions.toArray(),
      db.habit_logs.toArray(),
    ]);
    return { links, comments, attachments, milestones, events, sessions, habitLogs };
  }, [db]);

  return useMemo(() => {
    if (!data) return undefined;
    const tags = new Map<string, string[]>();
    for (const link of data.links) {
      if (link.deleted_at) continue;
      const taskId = String(link.task_id);
      const list = tags.get(taskId);
      if (list) list.push(String(link.tag_id));
      else tags.set(taskId, [String(link.tag_id)]);
    }
    return {
      tags,
      comments: count(data.comments as CommentRow[]),
      attachments: count(data.attachments as AttachmentRow[]),
      milestones: group(data.milestones as MilestoneRow[]),
      events: group(data.events as ProgressEventRow[]),
      sessions: group(data.sessions as TimeSessionRow[]),
      habitLogs: group(data.habitLogs as HabitLogRow[]),
    };
  }, [data]);
}

/** Completion records (the "Completed" list and today's summary). */
export function useCompletions(): CompletionRow[] | undefined {
  const { db } = useSync();
  return useLiveQuery(
    async () => ((await db.task_completions.toArray()) as unknown as CompletionRow[]).filter((c) => !c.deleted_at),
    [db],
  );
}

// ---------------------------------------------------------------------------
// Everything about one task (the detail panel)
// ---------------------------------------------------------------------------
export interface TaskParts {
  milestones: MilestoneRow[];
  events: ProgressEventRow[];
  sessions: TimeSessionRow[];
  habitLogs: HabitLogRow[];
  completions: CompletionRow[];
  attachments: AttachmentRow[];
  comments: CommentRow[];
  tagIds: string[];
}

export function useTaskParts(taskId: string | null | undefined): TaskParts | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => {
    if (!taskId) return undefined;
    const of = <T>(table: { where: (i: string) => { equals: (v: string) => { toArray: () => Promise<unknown[]> } } }) =>
      table.where('task_id').equals(taskId).toArray() as Promise<T[]>;
    const [milestones, events, sessions, habitLogs, completions, attachments, comments, links] = await Promise.all([
      of<MilestoneRow>(db.task_milestones),
      of<ProgressEventRow>(db.progress_events),
      of<TimeSessionRow>(db.time_sessions),
      of<HabitLogRow>(db.habit_logs),
      of<CompletionRow>(db.task_completions),
      of<AttachmentRow>(db.attachments),
      of<CommentRow>(db.comments),
      of<{ tag_id: string; deleted_at: string | null }>(db.task_tags),
    ]);
    const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at);
    return {
      milestones: live(milestones),
      events: live(events),
      sessions: live(sessions),
      habitLogs: live(habitLogs),
      completions: live(completions),
      attachments: live(attachments).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      comments: live(comments).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      tagIds: live(links).map((l) => l.tag_id),
    };
  }, [db, taskId]);
}

/** Direct and nested subtasks of a task (live, including completed and deleted ones). */
export function descendantsOf(tasks: readonly TaskRow[], rootId: string): TaskRow[] {
  const byParent = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    if (!t.parent_id) continue;
    const list = byParent.get(t.parent_id);
    if (list) list.push(t);
    else byParent.set(t.parent_id, [t]);
  }
  const out: TaskRow[] = [];
  const seen = new Set<string>([rootId]);
  const walk = (id: string) => {
    for (const child of byParent.get(id) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child);
      walk(child.id);
    }
  };
  walk(rootId);
  return out;
}
