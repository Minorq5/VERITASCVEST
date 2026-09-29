'use client';

import { Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ProgressRing } from '@/components/ui/progress';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import type { TaskRow } from '@/lib/db/types';
import { readTypeConfig } from '@/lib/domain/task-types';
import { addDays, todayIn } from '@/lib/time/dates';
import { formatClock, formatLongDate, formatNumber, formatShortDate } from '../format';
import { typeMeta } from '../shared/type-meta';
import { RollingNumber } from './numeric-widget';
import { NumberInput, Stat, WidgetCard, type WidgetProps } from './shared';

// ---------------------------------------------------------------------------
// Shared goal: everyone's contributions add up
// ---------------------------------------------------------------------------
export function CollabWidget({ task, parts, progress, prefs, today, actions, readOnly }: WidgetProps) {
  const t = useTranslations('tasks');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const color = typeMeta.collab.color;
  const target = task.progress_target != null && Number(task.progress_target) > 0 ? Number(task.progress_target) : null;
  const contributions = parts.events.filter((e) => e.kind === 'contribution').sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const total = contributions.reduce((acc, e) => acc + Number(e.value), 0);
  const mine = contributions.filter((e) => e.user_id === actions.ctx.userId).reduce((acc, e) => acc + Number(e.value), 0);

  const contribute = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    await actions.addEvent(task.id, 'contribution', value, note.trim() || undefined);
    setAmount('');
    setNote('');
    if (target != null && total + value >= target && !task.completed_at) await actions.complete(task, { auto: true });
  };

  return (
    <WidgetCard accent={color}>
      <div className="flex items-center gap-5">
        <ProgressRing value={target ? Math.min(1, total / target) : 0} size={88} stroke={7} color={progress.reached ? 'var(--color-success)' : color} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-3xl font-semibold text-fg tabular">
            <RollingNumber value={total} locale={prefs.locale} />
            {target != null && <span className="text-xl text-fg-3"> / {formatNumber(target, prefs.locale)}</span>}
            {task.progress_unit && <span className="ml-2 font-sans text-base font-normal text-fg-2">{task.progress_unit}</span>}
          </p>
          <p className="mt-1 text-sm text-fg-3">
            {t('widgets.collab.you')}: <span className="font-mono text-fg-2 tabular">{formatNumber(mine, prefs.locale)}</span>
          </p>
        </div>
        {!readOnly && (
          <label className="flex flex-col gap-1 text-xs text-fg-3">
            {t('widgets.numeric.target')}
            <NumberInput value={target} min={0} label={t('widgets.numeric.target')} onCommit={(v) => void actions.update(task.id, { progress_target: v && v > 0 ? v : null } as Partial<TaskRow>)} className="w-24" />
          </label>
        )}
      </div>

      {!readOnly && (
        <form
          className="mt-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void contribute();
          }}
        >
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('widgets.collab.amount')}
            aria-label={t('widgets.collab.amount')}
            className="focus-ring h-9 w-28 rounded-md border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg placeholder:font-sans placeholder:text-fg-4"
          />
          <input
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('widgets.collab.notePlaceholder')}
            aria-label={t('widgets.collab.note')}
            className="focus-ring h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface-2 px-2.5 text-sm text-fg placeholder:text-fg-4"
          />
          <Button size="sm" variant="primary" type="submit" icon={<Plus />} disabled={!(Number(amount) > 0)}>
            {t('widgets.collab.contribute')}
          </Button>
        </form>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-fg-3 uppercase">{t('widgets.collab.contributions')}</p>
        {contributions.length === 0 ? (
          <p className="text-sm text-fg-3">{t('widgets.collab.empty')}</p>
        ) : (
          <ul className="flex flex-col">
            {contributions.slice(0, 20).map((e) => (
              <li key={e.id} className="group/c flex items-center gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
                <span className="size-2 rounded-full" style={{ background: color }} />
                <span className="text-fg-2">{e.user_id === actions.ctx.userId ? t('widgets.collab.you') : '—'}</span>
                <span className="min-w-0 flex-1 truncate text-fg-3">{e.note}</span>
                <span className="text-fg-3">{formatShortDate(todayIn(prefs.timeZone, new Date(e.occurred_at)), prefs.locale, today)}</span>
                <span className="font-mono text-fg tabular">+{formatNumber(Number(e.value), prefs.locale)}</span>
                {!readOnly && e.user_id === actions.ctx.userId && (
                  <IconButton
                    size="sm"
                    variant="danger"
                    label={t('widgets.collab.remove')}
                    icon={<Trash2 />}
                    className="pointer-fine:opacity-0 pointer-fine:group-hover/c:opacity-100"
                    onClick={async () => {
                      const { inverse } = await actions.ctx.repo.update('progress_events', e.id, { deleted_at: new Date().toISOString() });
                      actions.record(t('toast.changed'), inverse, t('toast.changed'));
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </WidgetCard>
  );
}

// ---------------------------------------------------------------------------
// Quit ("Отказ"): days without a slip
// ---------------------------------------------------------------------------
export function AbstainWidget({ task, parts, progress, prefs, today, actions, readOnly }: WidgetProps) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const [confirm, setConfirm] = useState(false);
  const color = typeMeta.abstain.color;
  const detail = progress.detail.kind === 'abstain' ? progress.detail : null;
  const goal = task.progress_target != null && Number(task.progress_target) > 0 ? Number(task.progress_target) : null;
  const config = readTypeConfig('abstain', task.type_config);
  const since = config.start ?? task.created_at;
  const relapses = parts.events.filter((e) => e.kind === 'relapse').sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const relapseDays = new Set(relapses.map((e) => todayIn(prefs.timeZone, new Date(e.occurred_at))));
  const startDay = todayIn(prefs.timeZone, new Date(since));
  const days = detail?.days ?? 0;

  return (
    <WidgetCard accent={color}>
      <div className="flex flex-wrap items-center gap-5">
        <ProgressRing value={goal ? Math.min(1, days / goal) : days > 0 ? 1 : 0} size={96} stroke={7} color={color}>
          <span className="font-mono text-2xl font-semibold text-fg tabular">{days}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium text-fg">{t('widgets.abstain.days', { n: days })}</p>
          {detail && (
            <p className="mt-0.5 text-sm text-fg-3">
              {t('widgets.abstain.since', { date: formatLongDate(todayIn(prefs.timeZone, new Date(detail.since)), prefs.locale, today) })}
            </p>
          )}
        </div>
        <div className="flex gap-6">
          <Stat label={t('widgets.abstain.record')} value={t('widgets.habit.days', { n: detail?.record ?? 0 })} />
          {!readOnly && (
            <label className="flex flex-col gap-1 text-xs text-fg-3">
              {t('widgets.abstain.goal')}
              <NumberInput value={goal} min={0} max={100000} label={t('widgets.abstain.goal')} onCommit={(v) => void actions.update(task.id, { progress_target: v && v > 0 ? Math.round(v) : null } as Partial<TaskRow>)} className="w-20" />
            </label>
          )}
        </div>
      </div>

      {/* The last 30 days: clean days glow, slips are red. */}
      <div className="mt-4 flex gap-1" aria-hidden>
        {Array.from({ length: 30 }, (_, i) => addDays(today, i - 29)).map((d) => (
          <span
            key={d}
            title={formatShortDate(d, prefs.locale, today)}
            className="h-6 flex-1 rounded-sm"
            style={{
              background: d < startDay ? 'var(--color-surface-3)' : relapseDays.has(d) ? 'var(--color-danger)' : `color-mix(in oklab, ${color} 55%, transparent)`,
              opacity: d < startDay ? 0.4 : 1,
            }}
          />
        ))}
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="danger" icon={<ShieldAlert />} onClick={() => setConfirm(true)}>
            {t('widgets.abstain.relapse')}
          </Button>
          <label className="ml-auto flex items-center gap-2 text-sm text-fg-3">
            {t('widgets.abstain.startLabel')}
            <input
              type="date"
              value={startDay}
              max={today}
              onChange={(e) => {
                if (!e.target.value) return;
                const start = new Date(`${e.target.value}T00:00:00`).toISOString();
                void actions.update(task.id, { type_config: { ...(task.type_config as object), start } } as Partial<TaskRow>);
              }}
              className="focus-ring h-9 rounded-md border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg [color-scheme:dark]"
            />
          </label>
        </div>
      )}

      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold tracking-[0.08em] text-fg-3 uppercase">{t('widgets.abstain.relapses')}</p>
        {relapses.length === 0 ? (
          <p className="text-sm text-fg-3">{t('widgets.abstain.noRelapses')}</p>
        ) : (
          <ul className="flex flex-col">
            {relapses.slice(0, 20).map((e) => (
              <li key={e.id} className="group/r flex items-center gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
                <span className="size-2 rounded-full bg-danger" />
                <span className="flex-1 text-fg-2">
                  {formatShortDate(todayIn(prefs.timeZone, new Date(e.occurred_at)), prefs.locale, today)}, {formatClock(new Date(e.occurred_at), prefs.locale, prefs.hour12, prefs.timeZone)}
                </span>
                {!readOnly && (
                  <IconButton
                    size="sm"
                    variant="danger"
                    label={tc('delete')}
                    icon={<Trash2 />}
                    className="pointer-fine:opacity-0 pointer-fine:group-hover/r:opacity-100"
                    onClick={async () => {
                      const { inverse } = await actions.ctx.repo.update('progress_events', e.id, { deleted_at: new Date().toISOString() });
                      actions.record(t('toast.changed'), inverse, t('toast.changed'));
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ResponsiveDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('widgets.abstain.relapseTitle')}
        description={t('widgets.abstain.relapseText')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirm(false);
                await actions.addEvent(task.id, 'relapse', 1);
              }}
            >
              {t('widgets.abstain.relapseConfirm')}
            </Button>
          </>
        }
      />
    </WidgetCard>
  );
}
