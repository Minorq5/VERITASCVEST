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
export function WidgetCard({ children, className, accent }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <section
      className={cn('shadow-inset-top relative overflow-hidden rounded-xl border border-line bg-surface-2/70 p-4', className)}
      style={accent ? { backgroundImage: `radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, ${accent} 10%, transparent), transparent 60%)` } : undefined}
    >
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
        'focus-ring h-9 w-24 rounded-md border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg tabular placeholder:text-fg-4',
        className,
      )}
    />
  );
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="text-xs text-fg-3">{label}</span>
      <span className="font-mono text-lg font-medium text-fg tabular">{value}</span>
    </div>
  );
}
