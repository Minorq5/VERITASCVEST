import { z } from 'zod';
import { isIsoDate } from '@/lib/time/dates';

/** The 11 task types (see PLAN.md §5.2). */
export const taskTypes = [
  'normal',
  'percent',
  'numeric',
  'subtasks',
  'time',
  'habit',
  'counter',
  'stages',
  'collab',
  'abstain',
  'chain',
] as const;
export type TaskType = (typeof taskTypes)[number];

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && (taskTypes as readonly string[]).includes(value);
}

/** Types that are "ongoing": they measure a period, they are never finished by reaching 100 %. */
export const ongoingTypes: readonly TaskType[] = ['habit', 'counter', 'abstain'];

/** Types whose goal can be reached, after which the task completes itself (with undo). */
export const autoCompleteTypes: readonly TaskType[] = ['percent', 'numeric', 'stages', 'chain', 'time', 'collab'];

// ---------------------------------------------------------------------------
// Per-type settings stored in tasks.type_config
// ---------------------------------------------------------------------------
const weekdays = z.array(z.number().int().min(0).max(6)).min(1).max(7);

export const habitScheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('days'), days: weekdays }),
  z.object({ kind: z.literal('times'), perWeek: z.number().int().min(1).max(7) }),
]);
export type HabitSchedule = z.infer<typeof habitScheduleSchema>;

export const typeConfigSchemas = {
  normal: z.object({}).passthrough(),
  percent: z.object({}).passthrough(),
  numeric: z
    .object({ steps: z.array(z.number().positive().max(1e9)).max(6).optional() })
    .passthrough(),
  subtasks: z.object({}).passthrough(),
  time: z
    .object({
      pomodoro: z
        .object({
          focus: z.number().int().min(1).max(240),
          shortBreak: z.number().int().min(1).max(60),
          longBreak: z.number().int().min(1).max(120),
          cycles: z.number().int().min(1).max(12),
          autoStart: z.boolean(),
        })
        .optional(),
    })
    .passthrough(),
  habit: z
    .object({
      schedule: habitScheduleSchema.default({ kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] }),
      start: z.string().refine(isIsoDate).optional(),
    })
    .passthrough(),
  counter: z
    .object({
      period: z.enum(['day', 'week', 'month', 'none']).default('day'),
      mode: z.enum(['goal', 'limit']).default('goal'),
      step: z.number().positive().max(1e6).default(1),
    })
    .passthrough(),
  stages: z.object({}).passthrough(),
  collab: z.object({}).passthrough(),
  abstain: z
    .object({
      /** Moment the streak started (ISO timestamp). */
      start: z.string().optional(),
    })
    .passthrough(),
  chain: z.object({}).passthrough(),
} satisfies Record<TaskType, z.ZodType>;

export type TypeConfig<T extends TaskType> = z.infer<(typeof typeConfigSchemas)[T]>;

/** Stored config with defaults filled in; invalid stored data falls back to defaults. */
export function readTypeConfig<T extends TaskType>(type: T, value: unknown): TypeConfig<T> {
  const schema = typeConfigSchemas[type];
  const parsed = schema.safeParse(value ?? {});
  if (parsed.success) return parsed.data as TypeConfig<T>;
  return schema.parse({}) as TypeConfig<T>;
}

export const defaultPomodoro = { focus: 25, shortBreak: 5, longBreak: 15, cycles: 4, autoStart: false } as const;
