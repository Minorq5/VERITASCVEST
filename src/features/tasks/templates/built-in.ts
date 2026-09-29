import { presets } from '@/lib/domain/recurrence';
import type { TaskType } from '@/lib/domain/task-types';
import type { TemplatePayload } from './payload';

type Translate = ((key: string) => string) & { raw: (key: string) => unknown };

export const builtInKeys = ['weeklyReview', 'reading', 'water', 'workout', 'morning', 'launch', 'course', 'sugar'] as const;
export type BuiltInKey = (typeof builtInKeys)[number];

export const builtInTypes: Record<BuiltInKey, TaskType> = {
  weeklyReview: 'normal',
  reading: 'numeric',
  water: 'counter',
  workout: 'time',
  morning: 'habit',
  launch: 'stages',
  course: 'chain',
  sugar: 'abstain',
};

/** Ready-made templates, worded in the interface language (`t` is scoped to `tasks.templates.items`). */
export function builtInPayload(key: BuiltInKey, t: Translate, today: string): TemplatePayload {
  const title = t(`${key}.title`);
  const base = { v: 1 as const, task: { title, type: builtInTypes[key] } };
  switch (key) {
    case 'weeklyReview':
      return { ...base, task: { ...base.task, priority: 'medium', estimate_minutes: 30, recurrence: presets.weekly(today, [5]) } };
    case 'reading':
      return { ...base, task: { ...base.task, progress_target: 300, progress_unit: t('reading.unit'), type_config: { steps: [10, 25, 50] } } };
    case 'water':
      return { ...base, task: { ...base.task, progress_target: 8, progress_unit: t('water.unit'), type_config: { period: 'day', mode: 'goal', step: 1 } } };
    case 'workout':
      return { ...base, task: { ...base.task, progress_target: 180, type_config: {} } };
    case 'morning':
      return { ...base, task: { ...base.task, type_config: { schedule: { kind: 'days', days: [1, 2, 3, 4, 5] } } } };
    case 'launch':
      return { ...base, milestones: (t.raw('launch.stages') as string[]).map((s) => ({ title: s, weight: 25 })) };
    case 'course':
      return { ...base, milestones: (t.raw('course.steps') as string[]).map((s) => ({ title: s, weight: 0 })) };
    case 'sugar':
      return { ...base, task: { ...base.task, progress_target: 30 } };
  }
}
