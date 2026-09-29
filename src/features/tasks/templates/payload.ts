import { z } from 'zod';
import type { MilestoneRow, TagRow, TaskRow } from '@/lib/db/types';
import { alignAnchor, parseRecurrence } from '@/lib/domain/recurrence';
import { isTaskType, taskTypes } from '@/lib/domain/task-types';
import { newId } from '@/lib/ids';
import { keysBetween } from '@/lib/order';
import type { Change } from '@/lib/sync/repo';
import type { IsoDate } from '@/lib/time/dates';
import { createTask, type ActionContext } from '../data/actions';

/** What a task template keeps: the task's shape, not its dates or history. */
export const templatePayloadSchema = z.object({
  v: z.literal(1),
  task: z.object({
    title: z.string().min(1).max(500),
    type: z.enum(taskTypes),
    description: z.unknown().optional(),
    description_text: z.string().max(20000).optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
    estimate_minutes: z.number().int().min(0).max(100000).nullable().optional(),
    progress_target: z.number().min(0).max(1e12).nullable().optional(),
    progress_unit: z.string().max(24).nullable().optional(),
    type_config: z.record(z.string(), z.unknown()).optional(),
    recurrence: z.unknown().optional(),
    color: z.string().nullable().optional(),
    reminders: z.array(z.number().int().min(0).max(525600)).max(10).optional(),
  }),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  milestones: z.array(z.object({ title: z.string().min(1).max(200), weight: z.number().min(0).max(100) })).max(100).optional(),
  subtasks: z.array(z.object({ title: z.string().min(1).max(500) })).max(100).optional(),
});
export type TemplatePayload = z.infer<typeof templatePayloadSchema>;

export function payloadFromTask(
  task: TaskRow,
  extra: { priorityKey: string | null; tags: TagRow[]; milestones: MilestoneRow[]; subtasks: TaskRow[] },
): TemplatePayload {
  const reminders = Array.isArray(task.reminders)
    ? (task.reminders as { before?: unknown }[]).map((r) => Number(r.before)).filter((n) => Number.isInteger(n) && n >= 0)
    : [];
  return {
    v: 1,
    task: {
      title: task.title,
      type: isTaskType(task.type) ? task.type : 'normal',
      description: task.description ?? undefined,
      description_text: task.description_text || undefined,
      priority: (extra.priorityKey as TemplatePayload['task']['priority']) ?? null,
      estimate_minutes: task.estimate_minutes,
      progress_target: task.progress_target,
      progress_unit: task.progress_unit,
      type_config: (task.type_config as Record<string, unknown>) ?? {},
      recurrence: task.recurrence ?? undefined,
      color: task.color,
      reminders,
    },
    tags: extra.tags.map((tag) => tag.name),
    milestones: extra.milestones.filter((m) => !m.deleted_at).map((m) => ({ title: m.title, weight: Number(m.weight) || 0 })),
    subtasks: extra.subtasks.filter((s) => !s.deleted_at).map((s) => ({ title: s.title })),
  };
}

/** Creates a task (with its stages or steps and subtasks) from a template; returns its id and the undo. */
export async function applyTemplate(
  ctx: ActionContext,
  payload: TemplatePayload,
  where: { due: IsoDate | null; projectId: string | null; today: IsoDate },
): Promise<{ id: string; inverse: Change[] }> {
  const p = payload.task;
  const rule = parseRecurrence(p.recurrence);
  const anchored = rule ? alignAnchor(rule, where.due ?? where.today, ctx.weekStart) : null;
  const { task, inverse } = await createTask(ctx, {
    title: p.title,
    type: p.type,
    description: p.description ?? null,
    description_text: p.description_text ?? '',
    priority: p.priority ?? null,
    estimate_minutes: p.estimate_minutes ?? null,
    progress_target: p.progress_target ?? null,
    progress_unit: p.progress_unit ?? null,
    type_config: p.type_config ?? {},
    recurrence: anchored,
    due_date: anchored ? anchored.anchor : where.due,
    project_id: where.projectId,
    color: p.color ?? null,
    reminders: p.reminders ?? [],
    tags: payload.tags ?? [],
  });
  const milestones = payload.milestones ?? [];
  const keys = milestones.length ? keysBetween(null, null, milestones.length) : [];
  for (const [i, m] of milestones.entries()) {
    await ctx.repo.insert('task_milestones', {
      id: newId(),
      task_id: task.id,
      created_by: ctx.userId,
      title: m.title,
      weight: m.weight,
      done_at: null,
      due_date: null,
      sort_key: keys[i]!,
      deleted_at: null,
    } as never);
  }
  for (const s of payload.subtasks ?? []) {
    await createTask(ctx, { title: s.title, parent_id: task.id, project_id: where.projectId });
  }
  // Removing the task removes everything created with it.
  return { id: task.id, inverse };
}
