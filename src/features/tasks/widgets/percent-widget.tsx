'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import type { TaskRow } from '@/lib/db/types';
import { typeMeta } from '../shared/type-meta';
import { WidgetCard, type WidgetProps } from './shared';

/** Percent: a ring, a slider and quick steps; reaching 100 % completes the task. */
export function PercentWidget({ task, actions, readOnly }: WidgetProps) {
  const t = useTranslations('tasks');
  const stored = Math.round(Math.min(100, Math.max(0, Number(task.progress_current) || 0)));
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? stored;
  const color = value >= 100 ? 'var(--color-success)' : typeMeta.percent.color;

  const commit = async (next: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(next)));
    setDraft(null);
    if (clamped === stored) return;
    await actions.update(task.id, { progress_current: clamped } as Partial<TaskRow>);
    if (clamped >= 100 && !task.completed_at) await actions.complete({ ...task, progress_current: clamped }, { auto: true });
  };

  return (
    <WidgetCard accent={typeMeta.percent.color}>
      <div className="flex items-center gap-5">
        <ProgressRing value={value / 100} size={88} color={color} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Slider
            label={t('widgets.percent.slider')}
            value={[value]}
            min={0}
            max={100}
            step={1}
            disabled={readOnly}
            formatValue={(v) => `${v} %`}
            onValueChange={([v]) => setDraft(v ?? 0)}
            onValueCommit={([v]) => void commit(v ?? 0)}
          />
          <div className="flex flex-wrap gap-2">
            {[5, 10, 25].map((n) => (
              <Button key={n} size="sm" disabled={readOnly || value >= 100} onClick={() => void commit(value + n)}>
                {t('widgets.percent.step', { n })}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
