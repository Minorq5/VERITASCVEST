'use client';

import { Plus } from 'lucide-react';
import { animate, useMotionValue, useTransform, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ui/progress';
import type { TaskRow } from '@/lib/db/types';
import { readTypeConfig } from '@/lib/domain/task-types';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { formatNumber } from '../format';
import { typeMeta } from '../shared/type-meta';
import { NumberInput, WidgetCard, type WidgetProps } from './shared';

/** Decimal places a number is written with (0 for whole numbers, at most 2). */
function decimalsOf(n: number) {
  if (Number.isInteger(n)) return 0;
  return Math.min(2, (String(n).split('.')[1] ?? '').length);
}

/**
 * A number that rolls to its new value (the odometer). Intermediate values keep the precision
 * of the new value, so a whole counter rolls 5 → 6 → 7, never 6,99.
 */
export function RollingNumber({ value, locale }: { value: number; locale: string }) {
  const reduce = useLessMotion();
  const mv = useMotionValue(value);
  // Roll with the precision of where the number is going.
  const step = 10 ** decimalsOf(value);
  const text = useTransform(mv, (v) => formatNumber(Math.round(v * step) / step, locale));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.45, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, mv, reduce]);
  return <motion.span>{text}</motion.span>;
}

/** Running total over time, drawn as a small line. */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 220;
  const h = 44;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 4 - ((p - min) / span) * (h - 8)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full overflow-visible" aria-hidden>
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx={xy.at(-1)![0]} cy={xy.at(-1)![1]} r={3.5} fill={color} />
    </svg>
  );
}

export function NumericWidget({ task, parts, progress, prefs, actions, readOnly }: WidgetProps) {
  const t = useTranslations('tasks');
  const [amount, setAmount] = useState('');
  const [exact, setExact] = useState('');
  const target = task.progress_target != null && Number(task.progress_target) > 0 ? Number(task.progress_target) : null;
  const unit = task.progress_unit ?? '';
  const current = progress.current;
  const color = progress.reached ? 'var(--color-success)' : typeMeta.numeric.color;
  const steps = readTypeConfig('numeric', task.type_config).steps ?? [1, 5, 10];

  const series = (() => {
    const ordered = parts.events
      .filter((e) => e.kind === 'set' || e.kind === 'delta')
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id));
    let v = 0;
    const out = [0];
    for (const e of ordered) {
      v = e.kind === 'set' ? Number(e.value) : v + Number(e.value);
      out.push(v);
    }
    return out.slice(-24);
  })();

  const afterChange = async (next: number) => {
    if (target != null && next >= target && !task.completed_at) await actions.complete(task, { auto: true });
  };
  const add = async (delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    await actions.addEvent(task.id, 'delta', delta);
    await afterChange(current + delta);
  };
  const set = async (value: number) => {
    if (!Number.isFinite(value)) return;
    await actions.addEvent(task.id, 'set', value);
    await afterChange(value);
  };

  return (
    <WidgetCard accent={typeMeta.numeric.color}>
      <div className="flex items-center gap-5">
        <ProgressRing value={progress.ratio} size={88} color={color} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-3xl font-medium text-fg tabular">
            <RollingNumber value={current} locale={prefs.locale} />
            {target != null && (
              <span className="text-xl text-fg-3">
                {' / '}
                {formatNumber(target, prefs.locale)}
              </span>
            )}
            {unit && <span className="ml-2 font-sans text-base font-normal text-fg-2">{unit}</span>}
          </p>
          {target == null && <p className="mt-1 text-sm text-fg-3">{t('widgets.numeric.noTarget')}</p>}
          <Sparkline points={series} color={color} />
        </div>
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((s) => (
              <Button key={s} size="sm" onClick={() => void add(s)}>
                +{formatNumber(s, prefs.locale)}
              </Button>
            ))}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void add(Number(amount)).then(() => setAmount(''));
              }}
            >
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('widgets.numeric.amount')}
                aria-label={t('widgets.numeric.amount')}
                className="focus-ring h-8 w-36 rounded-sm border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg placeholder:font-sans placeholder:text-fg-4"
              />
              <Button size="sm" variant="primary" type="submit" icon={<Plus />} disabled={!Number(amount)}>
                {t('widgets.numeric.add')}
              </Button>
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-3">
            <label className="flex items-center gap-2">
              {t('widgets.numeric.target')}
              <NumberInput
                value={target}
                min={0}
                label={t('widgets.numeric.target')}
                onCommit={(v) => void actions.update(task.id, { progress_target: v && v > 0 ? v : null } as Partial<TaskRow>)}
              />
            </label>
            <label className="flex items-center gap-2">
              {t('widgets.numeric.unit')}
              <input
                key={unit}
                defaultValue={unit}
                maxLength={24}
                placeholder={t('widgets.numeric.unitPlaceholder')}
                onBlur={(e) => {
                  const next = e.currentTarget.value.trim() || null;
                  if (next !== (task.progress_unit ?? null)) void actions.update(task.id, { progress_unit: next } as Partial<TaskRow>);
                }}
                className="focus-ring h-9 w-28 rounded-sm border border-line-strong bg-surface-2 px-2.5 text-sm text-fg placeholder:text-fg-4"
              />
            </label>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (exact.trim() === '') return;
                void set(Number(exact)).then(() => setExact(''));
              }}
            >
              <input
                type="number"
                inputMode="decimal"
                value={exact}
                onChange={(e) => setExact(e.target.value)}
                placeholder={t('widgets.numeric.set')}
                aria-label={t('widgets.numeric.set')}
                className="focus-ring h-9 w-32 rounded-sm border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg placeholder:font-sans placeholder:text-fg-4"
              />
              <Button size="sm" variant="ghost" type="submit" disabled={exact.trim() === ''}>
                {t('widgets.numeric.setApply')}
              </Button>
            </form>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
