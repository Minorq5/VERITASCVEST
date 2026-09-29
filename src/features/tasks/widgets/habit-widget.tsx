'use client';

import { Flame, Snowflake, SkipForward } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { StarCheck } from '@/components/ui/star-check';
import type { TaskRow } from '@/lib/db/types';
import { readTypeConfig, type HabitSchedule } from '@/lib/domain/task-types';
import { addDays, startOfWeek, todayIn, weekday, type IsoDate } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import { formatLongDate, weekdayNames } from '../format';
import { typeMeta } from '../shared/type-meta';
import { markHabitDay } from './habit-actions';
import { NumberInput, Stat, WidgetCard, type WidgetProps } from './shared';

const CORAL = typeMeta.habit.color;
const ICE = 'var(--color-swatch-sky)';

const cellColor: Record<string, string> = {
  done: CORAL,
  freeze: ICE,
  skip: 'var(--color-surface-5)',
  fail: 'color-mix(in oklab, var(--color-danger) 45%, transparent)',
};

export function HabitWidget({ task, parts, progress, prefs, today, actions, readOnly }: WidgetProps) {
  const t = useTranslations('tasks');
  const config = readTypeConfig('habit', task.type_config);
  const schedule = config.schedule;
  const start = config.start ?? todayIn(prefs.timeZone, new Date(task.created_at));
  const detail = progress.detail.kind === 'habit' ? progress.detail : null;
  const byDate = new Map(parts.habitLogs.map((l) => [l.date, l.status]));
  const todayStatus = byDate.get(today) ?? null;
  const done = todayStatus === 'done' || todayStatus === 'freeze';
  // The server counts ISO weeks (from Monday) for the freeze rule.
  const isoWeek = startOfWeek(today, 1);
  const freezeUsed = parts.habitLogs.some((l) => l.status === 'freeze' && startOfWeek(l.date, 1) === isoWeek && l.date !== today);
  const mark = (date: IsoDate, status: 'done' | 'skip' | 'freeze' | null) => void markHabitDay(actions, task, date, status, t('toast.changed'));

  const setSchedule = (next: HabitSchedule) =>
    void actions.update(task.id, { type_config: { ...(task.type_config as object), ...config, schedule: next } } as Partial<TaskRow>);

  // Heatmap: the last 53 weeks, a column per week.
  const lastWeek = startOfWeek(today, prefs.weekStart);
  const firstWeek = addDays(lastWeek, -52 * 7);
  const names = weekdayNames(prefs.locale, 'short');
  const statusName = (s: string | null) => t(`widgets.habit.statusNames.${(s ?? 'none') as 'none'}`);

  return (
    <WidgetCard accent={CORAL}>
      <div className="flex flex-wrap items-center gap-4">
        <StarCheck
          checked={done}
          size={48}
          color={CORAL}
          disabled={readOnly}
          label={done ? t('widgets.habit.undo') : t('widgets.habit.markDone')}
          onCheckedChange={() => mark(today, done ? null : 'done')}
        />
        <div className="min-w-0 flex-1">
          <p className="text-md font-medium text-fg">{done ? t('widgets.habit.done') : detail?.scheduledToday === false ? t('widgets.habit.restDay') : t('widgets.habit.markDone')}</p>
          {detail && <p className="text-sm text-fg-3">{t('widgets.habit.thisWeek', { done: detail.done, required: detail.required })}</p>}
        </div>
        {detail && (
          <div className="flex gap-6">
            <Stat
              label={t('widgets.habit.streak')}
              value={
                <span className="inline-flex items-center gap-1" style={{ color: detail.streak ? CORAL : undefined }}>
                  <Flame aria-hidden className="size-4" />
                  {detail.unit === 'days' ? t('widgets.habit.days', { n: detail.streak }) : t('widgets.habit.weeks', { n: detail.streak })}
                </span>
              }
            />
            <Stat label={t('widgets.habit.best')} value={detail.unit === 'days' ? t('widgets.habit.days', { n: detail.best }) : t('widgets.habit.weeks', { n: detail.best })} />
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" icon={<SkipForward />} disabled={todayStatus === 'skip'} onClick={() => mark(today, 'skip')}>
            {t('widgets.habit.skip')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Snowflake style={{ color: ICE }} />}
            disabled={freezeUsed || todayStatus === 'freeze'}
            title={freezeUsed ? t('widgets.habit.freezeUsed') : t('widgets.habit.freezeHint')}
            onClick={() => mark(today, 'freeze')}
          >
            {t('widgets.habit.freeze')}
          </Button>
          <span className="self-center text-xs text-fg-3">{freezeUsed ? t('widgets.habit.freezeUsed') : t('widgets.habit.freezeHint')}</span>
        </div>
      )}

      {!readOnly && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-fg-3">{t('widgets.habit.schedule')}</span>
            <Segmented
              size="sm"
              label={t('widgets.habit.schedule')}
              value={schedule.kind}
              onValueChange={(kind) =>
                setSchedule(kind === 'days' ? { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] } : { kind: 'times', perWeek: 3 })
              }
              options={[
                { value: 'days', label: t('widgets.habit.scheduleDays') },
                { value: 'times', label: t('widgets.habit.scheduleTimes') },
              ]}
            />
          </div>
          {schedule.kind === 'days' ? (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 7 }, (_, i) => (prefs.weekStart + i) % 7).map((d) => {
                const on = schedule.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const days = on ? schedule.days.filter((x) => x !== d) : [...schedule.days, d];
                      if (days.length) setSchedule({ kind: 'days', days: days.sort() });
                    }}
                    className={cn(
                      'focus-ring inline-flex h-9 min-w-10 items-center justify-center rounded-md border px-2 text-sm transition-colors first-letter:uppercase',
                      on ? 'border-[color-mix(in_oklab,var(--c)_50%,transparent)] bg-[color-mix(in_oklab,var(--c)_14%,transparent)] text-fg' : 'border-line-strong text-fg-3 hover-ok:bg-surface-4',
                    )}
                    style={{ ['--c' as string]: CORAL }}
                  >
                    {names[d]?.replace('.', '')}
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm text-fg-3">
              <NumberInput value={schedule.perWeek} min={1} max={7} label={t('widgets.habit.scheduleTimes')} onCommit={(v) => v && setSchedule({ kind: 'times', perWeek: Math.round(v) })} className="w-16" />
              {t('widgets.habit.perWeek', { n: schedule.perWeek }).replace(/^\d+\s*/, '')}
            </label>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-fg-3 uppercase">{t('widgets.habit.year')}</p>
        <div className="no-scrollbar overflow-x-auto" dir="rtl">
          <div className="inline-grid grid-flow-col grid-rows-7 gap-[3px]" dir="ltr">
            {Array.from({ length: 53 * 7 }, (_, i) => {
              const date = addDays(firstWeek, i);
              if (date > today) return <span key={date} className="size-2.5 sm:size-3" />;
              const status = byDate.get(date) ?? null;
              const before = date < start;
              const scheduled = schedule.kind === 'times' || schedule.days.includes(weekday(date));
              const label = t('widgets.habit.cell', { date: formatLongDate(date, prefs.locale, today), status: statusName(status) });
              return (
                <button
                  key={date}
                  type="button"
                  disabled={readOnly || before}
                  aria-label={label}
                  title={label}
                  onClick={() => mark(date, status === 'done' ? null : 'done')}
                  className={cn('size-2.5 rounded-[3px] transition-transform hover-ok:scale-125 sm:size-3', date === today && 'ring-1 ring-fg-2')}
                  style={{
                    background: status ? cellColor[status] : before ? 'transparent' : scheduled ? 'var(--color-surface-4)' : 'var(--color-surface-3)',
                    boxShadow: status === 'done' ? `0 0 6px -1px ${CORAL}` : undefined,
                    opacity: before ? 0.25 : 1,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
