'use client';

import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { ProgressBar } from '@/components/ui/progress';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectItem } from '@/components/ui/select';
import type { TaskRow } from '@/lib/db/types';
import { counterHistory } from '@/lib/domain/progress';
import { readTypeConfig } from '@/lib/domain/task-types';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatShortDate } from '../format';
import { typeMeta } from '../shared/type-meta';
import { RollingNumber } from './numeric-widget';
import { NumberInput, WidgetCard, type WidgetProps } from './shared';

const AMBER = typeMeta.counter.color;

/** Counter: big +/−, a goal or a limit per period, lights for every step. */
export function CounterWidget({ task, parts, progress, prefs, today, now, actions, readOnly }: WidgetProps) {
  const t = useTranslations('tasks');
  const reduce = useLessMotion();
  const config = readTypeConfig('counter', task.type_config);
  const target = task.progress_target != null && Number(task.progress_target) > 0 ? Number(task.progress_target) : null;
  const current = progress.current;
  const limit = config.mode === 'limit';
  const over = limit && target != null && current > target;
  const orbs = target != null && target <= 12 && Number.isInteger(target) ? target : null;
  const lit = Math.max(0, Math.floor(current / (config.step || 1)) * (config.step || 1));

  const setConfig = (patch: Partial<typeof config>) =>
    void actions.update(task.id, { type_config: { ...(task.type_config as object), ...config, ...patch } } as Partial<TaskRow>);

  const history =
    config.period === 'none' ? [] : counterHistory(parts.events, config.period, { now, timeZone: prefs.timeZone, weekStart: prefs.weekStart }, 8).slice(1);
  const historyMax = Math.max(1, target ?? 0, ...history.map((h) => h.total));

  const status = (() => {
    if (target == null) return null;
    if (limit) return over ? t('widgets.counter.over', { n: formatNumber(current - target, prefs.locale) }) : t('widgets.counter.roomLeft', { n: formatNumber(target - current, prefs.locale) });
    return current >= target ? t('widgets.counter.reached') : t('widgets.counter.left', { n: formatNumber(target - current, prefs.locale) });
  })();

  const step = formatNumber(config.step, prefs.locale);

  return (
    <WidgetCard accent={AMBER}>
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          disabled={readOnly || current <= 0}
          onClick={() => void actions.addEvent(task.id, 'delta', -config.step)}
          aria-label={t('widgets.counter.minus', { step })}
          className="focus-ring inline-flex size-14 shrink-0 items-center justify-center rounded-full border border-line-strong text-fg-2 transition-[background-color,transform] hover-ok:bg-surface-4 motion-ok:active:scale-95 disabled:opacity-40"
        >
          <Minus aria-hidden className="size-6" />
        </button>
        <div className="min-w-0 text-center">
          <p className={cn('font-mono text-5xl font-semibold tabular', over ? 'text-danger' : 'text-fg')}>
            <RollingNumber value={current} locale={prefs.locale} />
            {target != null && <span className="text-2xl text-fg-3"> / {formatNumber(target, prefs.locale)}</span>}
          </p>
          <p className="mt-1 text-sm text-fg-3">
            {t(`widgets.counter.per.${config.period}`)}
            {status && <span className={cn('ml-2', over ? 'text-danger' : progress.reached ? 'text-success' : 'text-fg-2')}>· {status}</span>}
          </p>
        </div>
        <button
          type="button"
          disabled={readOnly}
          onClick={() => void actions.addEvent(task.id, 'delta', config.step)}
          aria-label={t('widgets.counter.plus', { step })}
          className="focus-ring inline-flex size-14 shrink-0 items-center justify-center rounded-full text-accent-ink shadow-[0_0_24px_-4px_var(--c)] transition-transform motion-ok:active:scale-95 disabled:opacity-40"
          style={{ ['--c' as string]: AMBER, background: `linear-gradient(180deg, color-mix(in oklab, ${AMBER} 70%, white), ${AMBER})` }}
        >
          <Plus aria-hidden className="size-6" strokeWidth={2.6} />
        </button>
      </div>

      <div className="mt-4">
        {orbs ? (
          <div className="flex flex-wrap justify-center gap-2" aria-hidden>
            {Array.from({ length: orbs }, (_, i) => {
              const on = i < lit;
              return (
                <motion.span
                  key={i}
                  initial={false}
                  animate={on && !reduce ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="size-4 rounded-full border"
                  style={{
                    borderColor: on ? 'transparent' : 'var(--color-line-bright)',
                    background: on ? `radial-gradient(circle at 35% 30%, white, ${limit && i >= target! ? 'var(--color-danger)' : AMBER} 55%)` : 'transparent',
                    boxShadow: on ? `0 0 12px -1px ${AMBER}` : undefined,
                  }}
                />
              );
            })}
          </div>
        ) : target != null ? (
          <ProgressBar value={Math.min(1, progress.ratio)} color={over ? 'var(--color-danger)' : AMBER} />
        ) : null}
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-4 text-sm text-fg-3">
          <Segmented
            size="sm"
            label={t('widgets.counter.mode')}
            value={config.mode}
            onValueChange={(mode) => setConfig({ mode })}
            options={[
              { value: 'goal', label: t('widgets.counter.modeGoal') },
              { value: 'limit', label: t('widgets.counter.modeLimit') },
            ]}
          />
          <label className="flex items-center gap-2">
            {limit ? t('widgets.counter.limit') : t('widgets.counter.goal')}
            <NumberInput
              value={target}
              min={0}
              label={limit ? t('widgets.counter.limit') : t('widgets.counter.goal')}
              onCommit={(v) => void actions.update(task.id, { progress_target: v && v > 0 ? v : null } as Partial<TaskRow>)}
              className="w-20"
            />
          </label>
          <label className="flex items-center gap-2">
            {t('widgets.counter.step')}
            <NumberInput value={config.step} min={0.01} max={1e6} label={t('widgets.counter.step')} onCommit={(v) => v && v > 0 && setConfig({ step: v })} className="w-20" />
          </label>
          <div className="flex items-center gap-2">
            <span>{t('widgets.counter.period')}</span>
            <Select value={config.period} onValueChange={(v) => setConfig({ period: v as typeof config.period })} aria-label={t('widgets.counter.period')} className="h-9 w-44">
              {(['day', 'week', 'month', 'none'] as const).map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`widgets.counter.periods.${p}`)}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-fg-3">{t('widgets.counter.history')}</p>
          <ol className="flex items-end gap-1.5">
            {[...history].reverse().map((h) => (
              <li key={h.from} className="flex flex-1 flex-col items-center gap-1" title={`${formatShortDate(h.from, prefs.locale, today)}: ${formatNumber(h.total, prefs.locale)}`}>
                <span
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${Math.max(3, (h.total / historyMax) * 40)}px`,
                    background: limit && target != null && h.total > target ? 'var(--color-danger)' : `color-mix(in oklab, ${AMBER} 70%, transparent)`,
                  }}
                />
                <span className="font-mono text-[10px] text-fg-3 tabular">{formatNumber(h.total, prefs.locale)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </WidgetCard>
  );
}
