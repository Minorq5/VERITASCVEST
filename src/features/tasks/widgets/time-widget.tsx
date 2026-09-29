'use client';

import { Pause, Play, Plus, SkipForward, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Switch } from '@/components/ui/switch';
import type { TaskRow, TimeSessionRow } from '@/lib/db/types';
import { sessionSeconds, trackedSeconds } from '@/lib/domain/progress';
import { defaultPomodoro, readTypeConfig } from '@/lib/domain/task-types';
import { newId } from '@/lib/ids';
import { todayIn } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import { sound } from '@/sound/engine';
import { toast } from '@/stores/toasts';
import { startTimer, stopTimer } from '../data/actions';
import { formatClock, formatDuration, formatShortDate, formatStopwatch } from '../format';
import { typeMeta } from '../shared/type-meta';
import { NumberInput, WidgetCard, type WidgetProps } from './shared';

const BLUE = typeMeta.time.color;
type Pomodoro = typeof defaultPomodoro | NonNullable<ReturnType<typeof readTypeConfig<'time'>>['pomodoro']>;

function phaseMinutes(session: TimeSessionRow, p: Pomodoro): number {
  if (session.kind !== 'break') return p.focus;
  return session.pomodoro_index === p.cycles ? p.longBreak : p.shortBreak;
}

/** Planet on an orbit: how far the current interval (or the goal) has come. */
function OrbitDial({ ratio, children }: { ratio: number; children: React.ReactNode }) {
  const r = 52;
  const a = Math.min(1, Math.max(0, ratio)) * Math.PI * 2 - Math.PI / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full overflow-visible" aria-hidden>
        <circle cx={60} cy={60} r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} strokeDasharray="1 5" />
        <circle
          cx={60}
          cy={60}
          r={r}
          fill="none"
          stroke={BLUE}
          strokeWidth={1.5}
          strokeLinecap="butt"
          strokeDasharray={`${circumference * Math.min(1, ratio)} ${circumference}`}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dasharray 0.9s linear' }}
        />
        <circle cx={60 + r * Math.cos(a)} cy={60 + r * Math.sin(a)} r={3} fill={BLUE} style={{ transition: 'cx 0.9s linear, cy 0.9s linear' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function TimeWidget({ task, parts, prefs, now, today, actions, readOnly }: WidgetProps) {
  const t = useTranslations('tasks');
  const config = readTypeConfig('time', task.type_config);
  const pomodoro = config.pomodoro ?? null;
  const running = parts.sessions.find((s) => !s.ended_at) ?? null;
  const [tick, setTick] = useState<number | null>(null);
  const finishing = useRef<string | null>(null);

  // A second-by-second clock while a session runs.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const nowMs = Math.max(now.getTime(), tick ?? 0);
  const tracked = trackedSeconds(parts.sessions, new Date(nowMs)).seconds;
  const goal = task.progress_target != null && Number(task.progress_target) > 0 ? Number(task.progress_target) : null;
  const goalSeconds = goal ? goal * 60 : null;

  const saveConfig = (next: Record<string, unknown>) =>
    void actions.update(task.id, { type_config: { ...(task.type_config as object), ...next } } as Partial<TaskRow>);

  const lastIndex = () => {
    const todays = parts.sessions
      .filter((s) => s.ended_at && todayIn(prefs.timeZone, new Date(s.started_at)) === today)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    return todays[0]?.pomodoro_index ?? 0;
  };

  const start = async (kind: 'focus' | 'break' = 'focus', index?: number) => {
    const p = pomodoro;
    const i = index ?? (p ? (lastIndex() % p.cycles) + 1 : undefined);
    await startTimer(actions.ctx, task.id, kind, i);
  };

  const stop = async (session: TimeSessionRow) => {
    await stopTimer(actions.ctx, session.id);
    if (session.kind !== 'break' && goalSeconds != null && !task.completed_at) {
      const after = trackedSeconds(
        parts.sessions.map((s) => (s.id === session.id ? { ...s, ended_at: new Date().toISOString(), seconds: sessionSeconds(s, new Date()) } : s)),
        new Date(),
      ).seconds;
      if (after >= goalSeconds) await actions.complete(task, { auto: true });
    }
  };

  // Pomodoro: close the interval when its time is up (also after coming back later).
  useEffect(() => {
    if (!running || !pomodoro) return;
    const end = Date.parse(running.started_at) + phaseMinutes(running, pomodoro) * 60_000;
    const finish = async () => {
      if (finishing.current === running.id) return;
      finishing.current = running.id;
      const seconds = Math.round((end - Date.parse(running.started_at)) / 1000);
      await actions.ctx.repo.update('time_sessions', running.id, { ended_at: new Date(end).toISOString(), seconds });
      sound.play('chime');
      const wasFocus = running.kind !== 'break';
      toast.info(wasFocus ? t('widgets.time.focusDone') : t('widgets.time.breakDone'), { id: `pomodoro-${task.id}` });
      if (pomodoro.autoStart) {
        const index = running.pomodoro_index ?? 1;
        await (wasFocus ? start('break', index) : start('focus', (index % pomodoro.cycles) + 1));
      }
    };
    const id = setTimeout(() => void finish(), Math.max(0, end - Date.now()));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the running interval or settings change
  }, [running?.id, pomodoro?.focus, pomodoro?.shortBreak, pomodoro?.longBreak, pomodoro?.cycles, pomodoro?.autoStart]);

  const phase = running && pomodoro ? phaseMinutes(running, pomodoro) * 60 : null;
  const phaseElapsed = running ? sessionSeconds(running, new Date(nowMs)) : 0;
  const ratio = phase ? phaseElapsed / phase : goalSeconds ? tracked / goalSeconds : running ? (phaseElapsed % 3600) / 3600 : 0;

  const center = phase ? formatStopwatch(Math.max(0, phase - phaseElapsed)) : formatStopwatch(tracked);
  const phaseName = running
    ? running.kind === 'break'
      ? running.pomodoro_index === pomodoro?.cycles
        ? t('widgets.time.phase.longBreak')
        : t('widgets.time.phase.break')
      : t('widgets.time.phase.focus')
    : null;

  const sessions = [...parts.sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)).slice(0, 12);
  const [manual, setManual] = useState('');

  const addManual = async () => {
    const minutes = Math.round(Number(manual));
    if (!(minutes > 0)) return;
    const end = new Date();
    const { inverse } = await actions.ctx.repo.insert('time_sessions', {
      id: newId(),
      task_id: task.id,
      user_id: actions.ctx.userId,
      started_at: new Date(end.getTime() - minutes * 60_000).toISOString(),
      ended_at: end.toISOString(),
      seconds: minutes * 60,
      kind: 'focus',
      pomodoro_index: null,
      deleted_at: null,
    } as never);
    actions.record(t('toast.changed'), inverse);
    setManual('');
  };

  return (
    <WidgetCard accent={BLUE}>
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <OrbitDial ratio={ratio}>
          <span className="font-mono text-2xl text-fg tabular">{center}</span>
          {phaseName && <span className="label-mono mt-0.5 text-fg-2">{phaseName}</span>}
          {running && pomodoro && running.pomodoro_index && (
            <span className="font-mono text-[11px] text-fg-3">{t('widgets.time.cycleOf', { n: running.pomodoro_index, total: pomodoro.cycles })}</span>
          )}
        </OrbitDial>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <p className="label-mono">{t('widgets.time.tracked')}</p>
              <p className="font-mono text-lg text-fg tabular">{formatDuration(tracked / 60, t)}</p>
            </div>
            {goal != null && (
              <div>
                <p className="label-mono">{tracked >= goalSeconds! ? t('widgets.time.over') : t('widgets.time.left')}</p>
                <p className={cn('font-mono text-lg tabular', tracked >= goalSeconds! ? 'text-success' : 'text-fg-2')}>
                  {formatDuration(Math.abs(tracked - goalSeconds!) / 60, t)}
                </p>
              </div>
            )}
          </div>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <>
                  <Button variant="primary" icon={<Pause />} onClick={() => void stop(running)}>
                    {t('widgets.time.stop')}
                  </Button>
                  {pomodoro && (
                    <IconButton
                      variant="secondary"
                      label={t('widgets.time.skipPhase')}
                      icon={<SkipForward />}
                      onClick={async () => {
                        await stopTimer(actions.ctx, running.id);
                        const index = running.pomodoro_index ?? 1;
                        await (running.kind === 'break' ? start('focus', (index % pomodoro.cycles) + 1) : start('break', index));
                      }}
                    />
                  )}
                </>
              ) : (
                <Button variant="primary" icon={<Play />} onClick={() => void start('focus')}>
                  {t('widgets.time.start')}
                </Button>
              )}
              <label className="ml-auto flex items-center gap-2 text-sm text-fg-3">
                {t('widgets.time.goal')}
                <NumberInput value={goal} min={0} max={100000} label={t('widgets.time.goal')} onCommit={(v) => void actions.update(task.id, { progress_target: v && v > 0 ? v : null } as Partial<TaskRow>)} className="w-20" />
              </label>
            </div>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          <Switch
            checked={pomodoro !== null}
            onCheckedChange={(on) => saveConfig({ pomodoro: on ? { ...defaultPomodoro } : undefined })}
            label={t('widgets.time.pomodoro')}
          />
          {pomodoro && (
            <div className="grid grid-cols-2 gap-3 text-sm text-fg-3 sm:grid-cols-4">
              {(
                [
                  ['focus', t('widgets.time.focus'), 1, 240],
                  ['shortBreak', t('widgets.time.shortBreak'), 1, 60],
                  ['longBreak', t('widgets.time.longBreak'), 1, 120],
                  ['cycles', t('widgets.time.cycles'), 1, 12],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="flex flex-col gap-1">
                  {label}
                  <NumberInput
                    value={pomodoro[key]}
                    min={min}
                    max={max}
                    label={label}
                    onCommit={(v) => v && saveConfig({ pomodoro: { ...pomodoro, [key]: Math.round(v) } })}
                    className="w-full"
                  />
                </label>
              ))}
              <Switch
                className="col-span-full"
                checked={pomodoro.autoStart}
                onCheckedChange={(autoStart) => saveConfig({ pomodoro: { ...pomodoro, autoStart } })}
                label={t('widgets.time.autoStart')}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <p className="label-mono mb-2">{t('widgets.time.sessions')}</p>
        {sessions.length === 0 ? (
          <p className="text-sm text-fg-3">{t('widgets.time.noSessions')}</p>
        ) : (
          <ul className="flex flex-col">
            {sessions.map((s) => (
              <li key={s.id} className="group/session flex items-center gap-3 border-b border-line py-1.5 text-sm last:border-b-0">
                <span className={cn('size-2 rounded-full', s.kind === 'break' ? 'bg-fg-4' : '')} style={s.kind === 'break' ? undefined : { background: BLUE }} />
                <span className="text-fg-2">
                  {formatShortDate(todayIn(prefs.timeZone, new Date(s.started_at)), prefs.locale, today)},{' '}
                  {formatClock(new Date(s.started_at), prefs.locale, prefs.hour12, prefs.timeZone)}
                </span>
                <span className="text-fg-3">{s.kind === 'break' ? t('widgets.time.phase.break') : t('widgets.time.phase.focus')}</span>
                <span className="ml-auto font-mono text-fg tabular">{s.ended_at ? formatDuration(sessionSeconds(s, new Date(nowMs)) / 60, t) : formatStopwatch(sessionSeconds(s, new Date(nowMs)))}</span>
                {!readOnly && s.ended_at && (
                  <IconButton
                    size="sm"
                    variant="danger"
                    label={t('widgets.time.deleteSession')}
                    icon={<Trash2 />}
                    className="pointer-fine:opacity-0 pointer-fine:group-hover/session:opacity-100"
                    onClick={async () => {
                      const { inverse } = await actions.ctx.repo.update('time_sessions', s.id, { deleted_at: new Date().toISOString() });
                      actions.record(t('toast.changed'), inverse, t('toast.changed'));
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void addManual();
            }}
          >
            <input
              type="number"
              min={1}
              max={1440}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={t('widgets.time.sessionMinutes')}
              aria-label={t('widgets.time.sessionMinutes')}
              className="focus-ring h-8 w-28 rounded-sm border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg placeholder:font-sans placeholder:text-fg-4"
            />
            <Button size="sm" variant="ghost" icon={<Plus />} type="submit" disabled={!(Number(manual) > 0)}>
              {t('widgets.time.addSession')}
            </Button>
          </form>
        )}
      </div>
    </WidgetCard>
  );
}
