'use client';

import { Flame } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { HorizonCheck } from '@/components/ui/horizon-check';
import { ProgressRing } from '@/components/ui/progress';
import type { CompletionRow, TaskRow } from '@/lib/db/types';
import { todayIn } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import type { PlannerPrefs } from '../data/hooks';
import type { TaskActions } from '../data/use-task-actions';
import { markHabitDay } from '../widgets/habit-actions';
import { buildRow, type RowContext } from './row-model';

function Reading({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 px-3 py-3 sm:px-4', className)}>
      <span className="label-mono">{label}</span>
      {children}
    </div>
  );
}

/**
 * Today at a glance, read like an instrument: done, left, overdue, and
 * today's habits one tap away. A thin line along the bottom fills as the day
 * gets done.
 */
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
  const open = tasks.filter((task) => !task.deleted_at && !task.completed_at && task.due_date !== null && task.due_date <= rc.today);
  const doneToday = completions.filter((c) => todayIn(prefs.timeZone, new Date(c.completed_at)) === rc.today).length;
  const remaining = open.length;
  const overdue = open.filter((task) => task.due_date! < rc.today).length;
  const total = doneToday + remaining;
  const ratio = total ? doneToday / total : 0;

  const habits = tasks
    .filter((task) => task.type === 'habit' && !task.deleted_at && !task.completed_at)
    .map((task) => buildRow(task, rc))
    .filter((row) => row.progress?.detail.kind === 'habit' && row.progress.detail.scheduledToday);

  const caption = total === 0 ? t('summary.nothing') : remaining === 0 ? t('summary.allDone') : null;

  return (
    <section aria-label={t('summary.label')} className="relative overflow-hidden rounded-lg border border-line bg-surface-1">
      <div className="grid grid-cols-3 divide-line max-sm:[&>*:nth-child(-n+2)]:border-r max-sm:[&>*:nth-child(-n+2)]:border-line sm:grid-cols-[auto_auto_auto_1fr] sm:divide-x">
        <Reading label={t('summary.done')}>
          <span className="flex items-center gap-3">
            <ProgressRing value={ratio} size={24} showValue={false} className="max-sm:hidden" color={remaining === 0 && total > 0 ? 'var(--color-success)' : undefined} />
            <span className="font-mono text-xl text-fg tabular sm:text-2xl">
              {doneToday}
              <span className="text-fg-3">/{total}</span>
            </span>
          </span>
        </Reading>
        <Reading label={t('summary.left')}>
          <span className="font-mono text-xl text-fg tabular sm:text-2xl">{remaining}</span>
        </Reading>
        <Reading label={t('summary.overdue')}>
          <span className={cn('font-mono text-xl tabular sm:text-2xl', overdue > 0 ? 'text-danger' : 'text-fg-3')}>{overdue}</span>
        </Reading>
        <Reading label={t('summary.habits')} className="max-sm:col-span-3 max-sm:border-t max-sm:border-line">
          {habits.length === 0 ? (
            <span className="text-sm text-fg-3">{caption ?? '—'}</span>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {habits.map((row) => {
                const detail = row.progress!.detail as Extract<NonNullable<typeof row.progress>['detail'], { kind: 'habit' }>;
                const done = detail.todayStatus === 'done' || detail.todayStatus === 'freeze';
                return (
                  <li key={row.task.id} className="flex h-7 items-center gap-2">
                    <HorizonCheck
                      checked={done}
                      size={18}
                      color="var(--color-amber)"
                      label={`${row.task.title}: ${done ? t('widgets.habit.undo') : t('widgets.habit.markDone')}`}
                      onCheckedChange={() => void markHabitDay(actions, row.task, rc.today, done ? null : 'done', t('toast.changed'))}
                    />
                    <span className={cn('max-w-40 truncate text-sm', done ? 'text-fg-3' : 'text-fg')}>{row.task.title}</span>
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
          )}
        </Reading>
      </div>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-line" />
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-px bg-accent transition-[width] duration-500 ease-out"
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </section>
  );
}
