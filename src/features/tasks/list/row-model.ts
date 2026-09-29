import type { ProjectRow, TagRow, TaskRow } from '@/lib/db/types';
import { computeProgress, type TaskProgress } from '@/lib/domain/progress';
import { isOverdue } from '@/lib/domain/sections';
import { isTaskType, type TaskType } from '@/lib/domain/task-types';
import type { IsoDate } from '@/lib/time/dates';
import type { Catalog, TaskIndex } from '../data/hooks';

/** Everything a list row shows, computed once per render of the list. */
export interface RowContext {
  catalog: Catalog;
  index: TaskIndex;
  childrenOf: Map<string, TaskRow[]>;
  tasksById: Map<string, TaskRow>;
  today: IsoDate;
  now: Date;
  timeZone: string;
  weekStart: number;
  /** On a project's page its own name is left out of the rows. */
  hideProjectId?: string;
}

export interface RowModel {
  /** List key when a task appears more than once (a repeating task's completions). */
  key?: string;
  /** In the "Completed" list: when this completion happened. */
  completedAt?: string;
  task: TaskRow;
  type: TaskType;
  priorityKey: string | null;
  project: ProjectRow | null;
  tags: TagRow[];
  progress: TaskProgress | null;
  overdue: boolean;
  subtasks: { done: number; total: number } | null;
  comments: number;
  attachments: number;
  parentTitle: string | null;
}

export function indexChildren(tasks: readonly TaskRow[]): Map<string, TaskRow[]> {
  const map = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    if (!t.parent_id) continue;
    const list = map.get(t.parent_id);
    if (list) list.push(t);
    else map.set(t.parent_id, [t]);
  }
  return map;
}

function descendants(childrenOf: Map<string, TaskRow[]>, id: string): TaskRow[] {
  const out: TaskRow[] = [];
  const seen = new Set([id]);
  const stack = [...(childrenOf.get(id) ?? [])];
  while (stack.length) {
    const t = stack.pop()!;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    stack.push(...(childrenOf.get(t.id) ?? []));
  }
  return out;
}

export function buildRow(task: TaskRow, rc: RowContext): RowModel {
  const type: TaskType = isTaskType(task.type) ? task.type : 'normal';
  const priority = task.priority_id ? rc.catalog.priorityById.get(task.priority_id) : undefined;
  const children = (rc.childrenOf.get(task.id) ?? []).filter((c) => !c.deleted_at);
  const progress =
    type === 'normal'
      ? null
      : computeProgress(
          task,
          {
            events: rc.index.events.get(task.id),
            milestones: rc.index.milestones.get(task.id),
            sessions: rc.index.sessions.get(task.id),
            habitLogs: rc.index.habitLogs.get(task.id),
            descendants: type === 'subtasks' ? descendants(rc.childrenOf, task.id) : undefined,
          },
          { now: rc.now, timeZone: rc.timeZone, weekStart: rc.weekStart },
        );
  const tags = (rc.index.tags.get(task.id) ?? [])
    .map((id) => rc.catalog.tagById.get(id))
    .filter((tag): tag is TagRow => Boolean(tag && !tag.deleted_at))
    .sort((a, b) => a.name.localeCompare(b.name));
  const project = task.project_id ? (rc.catalog.projectById.get(task.project_id) ?? null) : null;
  const parent = task.parent_id ? rc.tasksById.get(task.parent_id) : undefined;
  return {
    task,
    type,
    priorityKey: priority && !priority.deleted_at ? (priority.system_key ?? null) : null,
    project: project && !project.deleted_at && project.id !== rc.hideProjectId ? project : null,
    tags,
    progress,
    overdue: isOverdue(task, { today: rc.today, now: rc.now }),
    subtasks: children.length ? { done: children.filter((c) => c.completed_at).length, total: children.length } : null,
    comments: rc.index.comments.get(task.id) ?? 0,
    attachments: rc.index.attachments.get(task.id) ?? 0,
    parentTitle: parent ? parent.title : null,
  };
}
