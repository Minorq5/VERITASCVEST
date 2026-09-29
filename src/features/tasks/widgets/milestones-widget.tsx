'use client';

import { Lock, Plus, Scale, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { HorizonCheck } from '@/components/ui/horizon-check';
import type { MilestoneRow } from '@/lib/db/types';
import { normalizeWeights, orderedMilestones } from '@/lib/domain/progress';
import type { Change } from '@/lib/sync/repo';
import { cn } from '@/lib/utils/cn';
import { sound } from '@/sound/engine';
import { addMilestone } from '../data/actions';
import { typeMeta } from '../shared/type-meta';
import { WidgetCard, type WidgetProps } from './shared';

function Title({ milestone, readOnly, onRename }: { milestone: MilestoneRow; readOnly: boolean; onRename: (title: string) => void }) {
  return (
    <input
      key={milestone.title}
      defaultValue={milestone.title}
      readOnly={readOnly}
      maxLength={200}
      aria-label={milestone.title}
      onBlur={(e) => {
        const next = e.currentTarget.value.trim();
        if (next && next !== milestone.title) onRename(next);
        else e.currentTarget.value = milestone.title;
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={cn(
        'min-w-0 flex-1 rounded-sm bg-transparent px-1 py-0.5 text-base outline-none focus-visible:bg-surface-3',
        milestone.done_at ? 'text-fg-3 line-through' : 'text-fg',
      )}
    />
  );
}

/** Stages (weighted) and chains (one step after another) share the list of milestones. */
export function MilestonesWidget({ task, parts, actions, readOnly }: WidgetProps) {
  const t = useTranslations('tasks');
  const chain = task.type === 'chain';
  const meta = typeMeta[chain ? 'chain' : 'stages'];
  const [title, setTitle] = useState('');
  const list = orderedMilestones(parts.milestones);
  const weights = list.every((m) => Number(m.weight) <= 0) ? list.map(() => 100 / Math.max(1, list.length)) : list.map((m) => Number(m.weight));
  const sum = Math.round(weights.reduce((a, b) => a + b, 0) * 10) / 10;
  const nextIndex = list.findIndex((m) => !m.done_at);
  const lastDone = nextIndex === -1 ? list.length - 1 : nextIndex - 1;
  const repo = actions.ctx.repo;

  const toggle = async (m: MilestoneRow) => {
    const doneNow = !m.done_at;
    const { inverse } = await repo.update('task_milestones', m.id, { done_at: doneNow ? new Date().toISOString() : null });
    actions.record(t('toast.changed'), inverse);
    if (doneNow) {
      sound.play('success');
      const remaining = list.filter((x) => x.id !== m.id && !x.done_at).length;
      if (remaining === 0 && !task.completed_at) await actions.complete(task, { auto: true });
    }
  };
  const rename = async (m: MilestoneRow, next: string) => actions.record(t('toast.changed'), (await repo.update('task_milestones', m.id, { title: next })).inverse);
  const remove = async (m: MilestoneRow) =>
    actions.record(t('toast.changed'), (await repo.update('task_milestones', m.id, { deleted_at: new Date().toISOString() })).inverse, t('toast.changed'));
  const setWeight = async (m: MilestoneRow, w: number) => actions.record(t('toast.changed'), (await repo.update('task_milestones', m.id, { weight: w })).inverse);
  const balance = async () => {
    const next = normalizeWeights(list.map((m) => Number(m.weight)));
    const inverse: Change[] = [];
    for (const [i, m] of list.entries()) inverse.unshift(...(await repo.update('task_milestones', m.id, { weight: next[i] ?? 0 })).inverse);
    actions.record(t('toast.changed'), inverse);
  };
  const add = async () => {
    const clean = title.trim();
    if (!clean) return;
    actions.record(t('toast.changed'), await addMilestone(actions.ctx, task.id, clean, 0));
    setTitle('');
  };

  return (
    <WidgetCard accent={meta.color}>
      {/* The rocket's stages (weights) or the path of stars (a chain). */}
      {list.length > 0 &&
        (chain ? (
          <p className="mb-3 text-sm text-fg-2">{nextIndex === -1 ? t('widgets.chain.finished') : `${t('widgets.chain.next')}: ${list[nextIndex]!.title}`}</p>
        ) : (
          <div className="mb-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {list.map((m, i) => (
              <motion.span
                key={m.id}
                layout
                className="h-full"
                style={{
                  flexGrow: Math.max(0.5, weights[i] ?? 0),
                  background: m.done_at ? meta.color : 'var(--color-surface-5)',
                }}
              />
            ))}
          </div>
        ))}

      {list.length === 0 ? (
        <p className="text-sm text-fg-3">{chain ? t('widgets.chain.empty') : t('widgets.stages.empty')}</p>
      ) : (
        <ol className={cn('flex flex-col', chain && 'relative')}>
          {list.map((m, i) => {
            const locked = chain && !m.done_at && i !== nextIndex;
            const isNext = chain && i === nextIndex;
            return (
              <li key={m.id} className="group/ms relative flex items-center gap-3 py-1.5">
                {chain && i < list.length - 1 && (
                  <span aria-hidden className="absolute top-[34px] left-[13px] h-[calc(100%-22px)] w-px" style={{ background: m.done_at ? meta.color : 'var(--color-line-strong)' }} />
                )}
                {locked ? (
                  <span className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full border border-line-strong text-fg-4" title={t('widgets.chain.locked')}>
                    <Lock aria-hidden className="size-3" />
                    <span className="sr-only">{t('widgets.chain.locked')}</span>
                  </span>
                ) : (
                  <span className={cn('inline-flex rounded-full', isNext && '')} style={{ ['--c' as string]: meta.color }}>
                    <HorizonCheck
                      checked={Boolean(m.done_at)}
                      size={26}
                      color={meta.color}
                      disabled={readOnly || (chain && Boolean(m.done_at) && i !== lastDone)}
                      label={m.done_at ? (chain ? t('widgets.chain.reopen') : t('widgets.stages.reopen')) : chain ? t('widgets.chain.complete') : t('widgets.stages.complete')}
                      onCheckedChange={() => void toggle(m)}
                    />
                  </span>
                )}
                <Title milestone={m} readOnly={readOnly || locked} onRename={(next) => void rename(m, next)} />
                {!chain && (
                  <label className="flex items-center gap-1 text-sm text-fg-3">
                    <input
                      type="number"
                      key={`${m.id}-${m.weight}`}
                      defaultValue={Math.round((weights[i] ?? 0) * 10) / 10}
                      min={0}
                      max={100}
                      step={1}
                      readOnly={readOnly}
                      aria-label={`${t('widgets.stages.weight')}: ${m.title}`}
                      onBlur={(e) => {
                        const w = Math.max(0, Math.min(100, Number(e.currentTarget.value)));
                        if (Number.isFinite(w) && w !== Number(m.weight)) void setWeight(m, w);
                      }}
                      className="focus-ring h-8 w-16 rounded-md border border-line-strong bg-surface-2 px-2 text-right font-mono text-sm text-fg"
                    />
                    %
                  </label>
                )}
                {!readOnly && (
                  <IconButton
                    size="sm"
                    variant="danger"
                    label={chain ? t('widgets.chain.remove') : t('widgets.stages.remove')}
                    icon={<Trash2 />}
                    className="pointer-fine:opacity-0 pointer-fine:group-hover/ms:opacity-100"
                    onClick={() => void remove(m)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {!chain && list.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className={cn('font-mono tabular', Math.abs(sum - 100) > 0.5 ? 'text-warning' : 'text-fg-3')}>{t('widgets.stages.sum', { sum })}</span>
          {Math.abs(sum - 100) > 0.5 && !readOnly && (
            <Button size="sm" variant="ghost" icon={<Scale />} onClick={() => void balance()}>
              {t('widgets.stages.balance')}
            </Button>
          )}
          <span className="text-xs text-fg-3">{t('widgets.stages.sumHint')}</span>
        </div>
      )}

      {!readOnly && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder={chain ? t('widgets.chain.placeholder') : t('widgets.stages.placeholder')}
            aria-label={chain ? t('widgets.chain.add') : t('widgets.stages.add')}
            className="focus-ring h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface-2 px-2.5 text-base text-fg placeholder:text-fg-4"
          />
          <Button size="sm" type="submit" icon={<Plus />} disabled={!title.trim()}>
            {chain ? t('widgets.chain.add') : t('widgets.stages.add')}
          </Button>
        </form>
      )}
    </WidgetCard>
  );
}
