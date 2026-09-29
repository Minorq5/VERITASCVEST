'use client';

import type { ReactNode } from 'react';
import type { TaskRow } from '@/lib/db/types';
import type { TaskProgress } from '@/lib/domain/progress';
import type { IsoDate } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import type { PlannerPrefs, TaskParts } from '../data/hooks';
import type { TaskActions } from '../data/use-task-actions';

export interface WidgetProps {
  task: TaskRow;
  parts: TaskParts;
  progress: TaskProgress;
  prefs: PlannerPrefs;
  today: IsoDate;
  now: Date;
  actions: TaskActions;
  /** In the trash: look, but do not touch. */
  readOnly: boolean;
}

/** The framed area at the top of the task that holds the type's controls. */
export function WidgetCard({ children, className }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <section className={cn('relative overflow-hidden rounded-lg border border-line-strong bg-surface-1 p-4', className)}>
      {children}
    </section>
  );
}

/** Small numeric input used by several widgets. */
export function NumberInput({
  value,
  onCommit,
  label,
  min = 0,
  max = 1e12,
  step = 1,
  className,
  placeholder,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      key={value ?? 'empty'}
      defaultValue={value ?? ''}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      placeholder={placeholder}
      onBlur={(e) => {
        const raw = e.currentTarget.value.trim();
        const next = raw === '' ? null : Math.min(max, Math.max(min, Number(raw)));
        if (next !== value && (next === null || Number.isFinite(next))) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={cn(
        'focus-ring h-8 w-24 rounded-sm border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg tabular placeholder:text-fg-4 focus-visible:border-blue',
        className,
      )}
    />
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="label-mono">{label}</span>
      <span className="mt-0.5 font-mono text-lg text-fg tabular">{value}</span>
    </div>
  );
}
