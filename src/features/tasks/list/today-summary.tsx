'use client';

import { Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ProgressRing } from '@/components/ui/progress';
import { HorizonCheck } from '@/components/ui/horizon-check';
import type { CompletionRow, TaskRow } from '@/lib/db/types';
import { todayIn } from '@/lib/time/dates';
import type { PlannerPrefs } from '../data/hooks';
import type { TaskActions } from '../data/use-task-actions';
import { markHabitDay } from '../widgets/habit-actions';
import { buildRow, type RowContext } from './row-model';

/** Today at a glance: how much is done, and today's habits one tap away. */
export function TodaySummary({
  tasks,
  completions,
  rc,
  actions,
  prefs,
}: {
  tasks: readonly TaskRow[];
  completions: readonly CompletionRow[];
  rc: RowContext;
  actions: TaskActions;
  prefs: PlannerPrefs;
}) {
  const t = useTranslations('tasks');
  const doneToday = completions.filter((c) => todayIn(prefs.timeZone, new Date(c.completed_at)) === rc.today).length;
  const remaining = tasks.filter((task) => !task.deleted_at && !task.completed_at && task.due_date !== null && task.due_date <= rc.today).length;
  const total = doneToday + remaining;

  const habits = tasks
    .filter((task) => task.type === 'habit' && !task.deleted_at && !task.completed_at)
    .map((task) => buildRow(task, rc))
    .filter((row) => row.progress?.detail.kind === 'habit' && row.progress.detail.scheduledToday);

  const text = total === 0 ? t('summary.nothing') : remaining === 0 ? t('summary.allDone') : t('summary.progress', { done: doneToday, total });

  return (
    <div className="bg-surface-1 flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="flex items-center gap-4">
        <ProgressRing value={total ? doneToday / total : 0} size={56} color={remaining === 0 && total > 0 ? 'var(--color-success)' : undefined} />
        <p className="text-md font-medium text-fg">{text}</p>
      </div>
      {habits.length > 0 && (
        <div className="min-w-0 sm:ml-auto">
          <h2 className="mb-2 text-xs font-semibold tracking-[0.08em] text-fg-3 uppercase">{t('summary.habits')}</h2>
          <ul className="flex flex-wrap gap-2">
            {habits.map((row) => {
              const detail = row.progress!.detail as Extract<NonNullable<typeof row.progress>['detail'], { kind: 'habit' }>;
              const done = detail.todayStatus === 'done' || detail.todayStatus === 'freeze';
              return (
                <li key={row.task.id} className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-3/70 py-1 pr-3 pl-1">
                  <HorizonCheck
                    checked={done}
                    size={24}
                    color="var(--color-amber)"
                    label={`${row.task.title}: ${done ? t('widgets.habit.undo') : t('widgets.habit.markDone')}`}
                    onCheckedChange={() => void markHabitDay(actions, row.task, rc.today, done ? null : 'done', t('toast.changed'))}
                  />
                  <span className="max-w-40 truncate text-sm text-fg">{row.task.title}</span>
                  {detail.streak > 0 && (
                    <span className="inline-flex items-center gap-0.5 font-mono text-xs text-[color:var(--color-amber)] tabular">
                      <Flame aria-hidden className="size-3" />
                      {detail.streak}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
