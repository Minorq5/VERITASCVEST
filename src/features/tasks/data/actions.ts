import type { VeritasDB } from '@/lib/db/schema';
import type { AnyRow, TaskRow } from '@/lib/db/types';
import { parseRecurrence, nextDueAfterCompletion } from '@/lib/domain/recurrence';
import type { TaskType } from '@/lib/domain/task-types';
import { newId, stableId } from '@/lib/ids';
import { keyBetween } from '@/lib/order';
import { swatchFor } from '@/lib/color/swatches';
import type { Change, Repo } from '@/lib/sync/repo';
import { todayIn, zonedMoment, type IsoDate } from '@/lib/time/dates';

/**
 * Everything people do with tasks, as small functions over the Repo. Each
 * returns the changes that undo it, so every action can be reverted from
 * the toast or with Ctrl+Z.
 */
export interface ActionContext {
  repo: Repo;
  userId: string;
  timeZone: string;
  weekStart: number;
  now?: () => Date;
}

const nowOf = (ctx: ActionContext) => ctx.now?.() ?? new Date();

export async function systemStatus(db: VeritasDB, key: string): Promise<AnyRow | undefined> {
  return db.statuses.filter((s) => s.system_key === key && !s.deleted_at).first();
}

export async function systemPriority(db: VeritasDB, key: string | null | undefined): Promise<AnyRow | undefined> {
  if (!key) return undefined;
  return db.priorities.filter((p) => p.system_key === key && !p.deleted_at).first();
}

export interface NewTask {
  title: string;
  type?: TaskType;
  parent_id?: string | null;
  project_id?: string | null;
  due_date?: IsoDate | null;
  due_time?: string | null;
  start_date?: IsoDate | null;
  start_time?: string | null;
  recurrence?: unknown;
  priority?: 'critical' | 'high' | 'medium' | 'low' | null;
  tags?: string[];
  estimate_minutes?: number | null;
  progress_target?: number | null;
  progress_unit?: string | null;
  type_config?: Record<string, unknown>;
  description_text?: string;
  description?: unknown;
  color?: string | null;
  icon?: string | null;
  /** Minutes before the deadline. */
  reminders?: number[];
  /** Put after this sort key (end of the list when omitted). */
  after?: string | null;
  before?: string | null;
}

const toTime = (t: string | null | undefined) => (t ? (t.length === 5 ? `${t}:00` : t) : null);

export async function createTask(ctx: ActionContext, input: NewTask): Promise<{ task: TaskRow; inverse: Change[] }> {
  const { repo, userId } = ctx;
  const db = repo.db;
  const [todo, priority] = await Promise.all([systemStatus(db, 'todo'), systemPriority(db, input.priority)]);
  let after = input.after;
  if (after === undefined) {
    const siblings = await db.tasks.filter((t) => (t.parent_id ?? null) === (input.parent_id ?? null) && !t.deleted_at).toArray();
    after = siblings.reduce<string | null>((max, t) => (max === null || String(t.sort_key) > max ? String(t.sort_key) : max), null);
  }
  const sort_key = keyBetween(after ?? null, input.before ?? null);
  const id = newId();
  const { row } = await repo.insert('tasks', {
    id,
    owner_id: userId,
    title: input.title.trim(),
    type: input.type ?? 'normal',
    parent_id: input.parent_id ?? null,
    project_id: input.project_id ?? null,
    description: (input.description as never) ?? null,
    description_text: input.description_text ?? '',
    status_id: (todo?.id as string | undefined) ?? null,
    priority_id: (priority?.id as string | undefined) ?? null,
    color: input.color ?? null,
    icon: input.icon ?? null,
    start_date: input.start_date ?? null,
    start_time: toTime(input.start_time),
    due_date: input.due_date ?? null,
    due_time: input.due_date ? toTime(input.due_time) : null,
    timezone: ctx.timeZone,
    estimate_minutes: input.estimate_minutes ?? null,
    progress_current: 0,
    progress_target: input.progress_target ?? null,
    progress_unit: input.progress_unit ?? null,
    type_config: (input.type_config ?? {}) as never,
    recurrence: (input.recurrence as never) ?? null,
    reminders: (input.reminders ?? []).map((before) => ({ before })) as never,
    completed_at: null,
    sort_key,
    deleted_at: null,
  } as never);
  const inverse: Change[] = [{ entity: 'tasks', op: 'delete', id, data: {} }];
  if (input.tags?.length) await setTaskTags(ctx, id, input.tags);
  return { task: row as TaskRow, inverse };
}

export async function updateTask(ctx: ActionContext, id: string, patch: Partial<TaskRow>): Promise<Change[]> {
  const normalized = { ...patch } as Record<string, unknown>;
  if ('due_time' in normalized) normalized.due_time = toTime(normalized.due_time as string | null);
  if ('start_time' in normalized) normalized.start_time = toTime(normalized.start_time as string | null);
  if ('due_date' in normalized && !normalized.due_date) normalized.due_time = null;
  return (await ctx.repo.update('tasks', id, normalized as never)).inverse;
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------
export interface CompleteOutcome {
  inverse: Change[];
  /** A recurring task moved on instead of closing. */
  nextDue: IsoDate | null;
}

export async function completeTask(ctx: ActionContext, task: TaskRow): Promise<CompleteOutcome> {
  const { repo, userId } = ctx;
  const now = nowOf(ctx);
  const nowIso = now.toISOString();
  const today = todayIn(ctx.timeZone, now);
  const priority = task.priority_id ? await repo.db.priorities.get(task.priority_id) : undefined;
  const due = task.due_date ? zonedMoment(task.due_date, task.due_time, task.timezone) : null;

  const completion = await repo.insert('task_completions', {
    id: newId(),
    task_id: task.id,
    user_id: userId,
    occurrence_date: task.recurrence ? task.due_date : null,
    completed_at: nowIso,
    on_time: due ? now.getTime() <= due.getTime() : null,
    priority_rank: (priority?.rank as number | undefined) ?? null,
    project_id: task.project_id,
    task_type: task.type,
    deleted_at: null,
  } as never);
  // Undoing a completion removes its record (from stage 6 the server also takes the XP back).
  const undoCompletion: Change = { entity: 'task_completions', op: 'update', id: String(completion.row!.id), data: { deleted_at: nowIso } };

  const rule = parseRecurrence(task.recurrence);
  if (rule) {
    const next = nextDueAfterCompletion(rule, task.due_date, today, ctx.weekStart);
    if (next) {
      const patch: Record<string, unknown> = { due_date: next };
      if (task.start_date && task.due_date) {
        // Keep the same span between start and deadline.
        const span = Math.round((Date.parse(task.due_date) - Date.parse(task.start_date)) / 86_400_000);
        patch.start_date = new Date(Date.parse(next) - span * 86_400_000).toISOString().slice(0, 10);
      }
      // Per-occurrence progress starts again.
      if (task.type === 'percent') patch.progress_current = 0;
      const moved = await repo.update('tasks', task.id, patch as never);
      return { inverse: [...moved.inverse, undoCompletion], nextDue: next };
    }
  }
  const done = await systemStatus(repo.db, 'done');
  const closed = await repo.update('tasks', task.id, { completed_at: nowIso, status_id: (done?.id as string | undefined) ?? task.status_id } as never);
  return { inverse: [...closed.inverse, undoCompletion], nextDue: null };
}

export async function reopenTask(ctx: ActionContext, task: TaskRow): Promise<Change[]> {
  const { repo } = ctx;
  const todo = await systemStatus(repo.db, 'todo');
  const inverse = (await repo.update('tasks', task.id, { completed_at: null, status_id: (todo?.id as string | undefined) ?? null } as never)).inverse;
  const latest = (await repo.db.task_completions.where('task_id').equals(task.id).toArray())
    .filter((c) => !c.deleted_at)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))[0];
  if (latest) inverse.push(...(await repo.update('task_completions', String(latest.id), { deleted_at: new Date().toISOString() })).inverse);
  return inverse;
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------
export async function trashTask(ctx: ActionContext, id: string): Promise<Change[]> {
  return (await ctx.repo.update('tasks', id, { deleted_at: nowOf(ctx).toISOString() })).inverse;
}

export async function restoreTask(ctx: ActionContext, id: string): Promise<Change[]> {
  return (await ctx.repo.update('tasks', id, { deleted_at: null })).inverse;
}

/** Permanently removes a task with its subtasks (the server cascades the parts). */
export async function purgeTask(ctx: ActionContext, id: string): Promise<void> {
  await ctx.repo.remove('tasks', id);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
export async function ensureTag(ctx: ActionContext, name: string): Promise<string> {
  const db = ctx.repo.db;
  const clean = name.trim().replace(/^#/, '');
  const existing = await db.tags.filter((t) => !t.deleted_at && String(t.name).toLocaleLowerCase() === clean.toLocaleLowerCase()).first();
  if (existing) return String(existing.id);
  // Same name on two offline devices → the same id → one tag.
  let id = stableId.tag(ctx.userId, clean);
  const taken = await db.tags.get(id);
  if (taken) id = newId();
  await ctx.repo.insert('tags', { id, owner_id: ctx.userId, name: clean, color: swatchFor(clean), deleted_at: null } as never);
  return id;
}

// ---------------------------------------------------------------------------
// Projects (the full project screens arrive in stage 4)
// ---------------------------------------------------------------------------
export async function ensureProject(ctx: ActionContext, name: string): Promise<string> {
  const db = ctx.repo.db;
  const clean = name.trim().replace(/^\+/, '').replace(/^"|"$/g, '').trim();
  const existing = await db.projects
    .filter((p) => !p.deleted_at && String(p.name).toLocaleLowerCase() === clean.toLocaleLowerCase())
    .first();
  if (existing) return String(existing.id);
  const siblings = (await db.projects.toArray()).filter((p) => !p.deleted_at && !p.parent_id);
  const last = siblings.reduce<string | null>((max, p) => (max === null || String(p.sort_key) > max ? String(p.sort_key) : max), null);
  const id = newId();
  await ctx.repo.insert('projects', {
    id,
    owner_id: ctx.userId,
    parent_id: null,
    name: clean,
    description: '',
    color: swatchFor(clean),
    icon: null,
    planet_seed: Math.floor(Math.random() * 2_147_483_647),
    sort_key: keyBetween(last, null),
    archived_at: null,
    view_settings: {},
    deleted_at: null,
  } as never);
  return id;
}

export async function setTaskTags(ctx: ActionContext, taskId: string, names: readonly string[]): Promise<Change[]> {
  const db = ctx.repo.db;
  const wanted = new Set<string>();
  for (const n of names) if (n.trim()) wanted.add(await ensureTag(ctx, n));
  const links = await db.task_tags.where('task_id').equals(taskId).toArray();
  const inverse: Change[] = [];
  for (const link of links) {
    const keep = wanted.has(String(link.tag_id));
    if (!keep && !link.deleted_at) inverse.push(...(await ctx.repo.update('task_tags', String(link.id), { deleted_at: nowOf(ctx).toISOString() })).inverse);
    if (keep && link.deleted_at) inverse.push(...(await ctx.repo.update('task_tags', String(link.id), { deleted_at: null })).inverse);
    wanted.delete(String(link.tag_id));
  }
  for (const tagId of wanted) {
    const id = stableId.taskTag(taskId, tagId);
    if (await db.task_tags.get(id)) {
      inverse.push(...(await ctx.repo.update('task_tags', id, { deleted_at: null })).inverse);
    } else {
      inverse.push(...(await ctx.repo.insert('task_tags', { id, task_id: taskId, tag_id: tagId, owner_id: ctx.userId, deleted_at: null } as never)).inverse);
    }
  }
  return inverse;
}

// ---------------------------------------------------------------------------
// Progress, habits, timer, milestones
// ---------------------------------------------------------------------------
export async function addProgressEvent(
  ctx: ActionContext,
  taskId: string,
  kind: 'set' | 'delta' | 'contribution' | 'relapse',
  value: number,
  note?: string,
): Promise<Change[]> {
  const { row } = await ctx.repo.insert('progress_events', {
    id: newId(),
    task_id: taskId,
    user_id: ctx.userId,
    kind,
    value,
    note: note ?? null,
    occurred_at: nowOf(ctx).toISOString(),
    deleted_at: null,
  } as never);
  return [{ entity: 'progress_events', op: 'update', id: String(row!.id), data: { deleted_at: nowOf(ctx).toISOString() } }];
}

export async function setHabitDay(
  ctx: ActionContext,
  taskId: string,
  date: IsoDate,
  status: 'done' | 'skip' | 'freeze' | 'fail' | null,
): Promise<Change[]> {
  const id = stableId.habitDay(taskId, ctx.userId, date);
  const existing = await ctx.repo.db.habit_logs.get(id);
  if (!existing) {
    if (!status) return [];
    return (await ctx.repo.insert('habit_logs', { id, task_id: taskId, user_id: ctx.userId, date, status, deleted_at: null } as never)).inverse;
  }
  return (await ctx.repo.update('habit_logs', id, status ? { status, deleted_at: null } : { deleted_at: nowOf(ctx).toISOString() })).inverse;
}

export async function startTimer(ctx: ActionContext, taskId: string, kind: 'focus' | 'break' = 'focus', pomodoroIndex?: number): Promise<string> {
  const { row } = await ctx.repo.insert('time_sessions', {
    id: newId(),
    task_id: taskId,
    user_id: ctx.userId,
    started_at: nowOf(ctx).toISOString(),
    ended_at: null,
    seconds: null,
    kind,
    pomodoro_index: pomodoroIndex ?? null,
    deleted_at: null,
  } as never);
  return String(row!.id);
}

export async function stopTimer(ctx: ActionContext, sessionId: string): Promise<void> {
  const session = await ctx.repo.db.time_sessions.get(sessionId);
  if (!session || session.ended_at) return;
  const end = nowOf(ctx);
  const seconds = Math.max(0, Math.round((end.getTime() - Date.parse(String(session.started_at))) / 1000));
  await ctx.repo.update('time_sessions', sessionId, { ended_at: end.toISOString(), seconds });
}

export async function addMilestone(ctx: ActionContext, taskId: string, title: string, weight = 0): Promise<Change[]> {
  const siblings = await ctx.repo.db.task_milestones.where('task_id').equals(taskId).toArray();
  const last = siblings.filter((m) => !m.deleted_at).reduce<string | null>((max, m) => (max === null || String(m.sort_key) > max ? String(m.sort_key) : max), null);
  return (
    await ctx.repo.insert('task_milestones', {
      id: newId(),
      task_id: taskId,
      created_by: ctx.userId,
      title: title.trim(),
      weight,
      done_at: null,
      sort_key: keyBetween(last, null),
      deleted_at: null,
    } as never)
  ).inverse;
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------
export async function duplicateTask(ctx: ActionContext, taskId: string, suffix: string): Promise<{ id: string; inverse: Change[] }> {
  const db = ctx.repo.db;
  const inverse: Change[] = [];
  const copy = async (sourceId: string, parentId: string | null, title?: string): Promise<string> => {
    const source = await db.tasks.get(sourceId);
    if (!source) throw new Error('task_missing');
    const id = newId();
    const { version: _v, tx_id: _t, created_at: _c, updated_at: _u, start_at: _s, due_at: _d, completed_by: _cb, deleted_by: _db, ...fields } = source;
    await ctx.repo.insert('tasks', {
      ...fields,
      id,
      owner_id: ctx.userId,
      parent_id: parentId,
      title: title ?? source.title,
      completed_at: null,
      deleted_at: null,
      sort_key: keyBetween(String(source.sort_key), null),
      progress_current: source.type === 'percent' ? 0 : source.progress_current,
    } as never);
    inverse.unshift({ entity: 'tasks', op: 'delete', id, data: {} });
    for (const m of await db.task_milestones.where('task_id').equals(sourceId).toArray()) {
      if (m.deleted_at) continue;
      await ctx.repo.insert('task_milestones', { id: newId(), task_id: id, created_by: ctx.userId, title: m.title, weight: m.weight, done_at: null, due_date: m.due_date, sort_key: m.sort_key, deleted_at: null } as never);
    }
    for (const link of await db.task_tags.where('task_id').equals(sourceId).toArray()) {
      if (link.deleted_at) continue;
      await ctx.repo.insert('task_tags', { id: stableId.taskTag(id, String(link.tag_id)), task_id: id, tag_id: link.tag_id, owner_id: ctx.userId, deleted_at: null } as never);
    }
    const children = (await db.tasks.where('parent_id').equals(sourceId).toArray()).filter((c) => !c.deleted_at);
    for (const child of children) await copy(String(child.id), id);
    return id;
  };
  const source = await db.tasks.get(taskId);
  const id = await copy(taskId, (source?.parent_id as string | null) ?? null, `${String(source?.title ?? '')}${suffix}`);
  return { id, inverse };
}
