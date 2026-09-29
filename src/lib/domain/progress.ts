import {
  addDays,
  compareDates,
  diffDays,
  parts,
  startOfMonth,
  startOfWeek,
  todayIn,
  weekday,
  daysInMonth,
  fromParts,
  type IsoDate,
} from '@/lib/time/dates';
import { readTypeConfig, type HabitSchedule, type TaskType } from './task-types';

/**
 * Progress of every task type, reduced to 0–1 so lists, the galaxy,
 * statistics and quests treat all types alike. Pure functions: the same
 * inputs give the same result on every device and offline.
 */

export interface ProgressTask {
  id: string;
  type: string;
  completed_at: string | null;
  progress_current: number;
  progress_target: number | null;
  type_config: unknown;
  created_at: string;
}
export interface ProgressEvent {
  id: string;
  kind: string;
  value: number;
  occurred_at: string;
  user_id: string;
  deleted_at: string | null;
}
export interface ProgressMilestone {
  id: string;
  weight: number;
  done_at: string | null;
  sort_key: string;
  deleted_at: string | null;
}
export interface ProgressSession {
  started_at: string;
  ended_at: string | null;
  seconds: number | null;
  kind: string;
  deleted_at: string | null;
}
export interface ProgressHabitLog {
  date: IsoDate;
  status: string;
  deleted_at: string | null;
}
export interface ProgressDescendant {
  id: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface ProgressParts {
  events?: readonly ProgressEvent[];
  milestones?: readonly ProgressMilestone[];
  sessions?: readonly ProgressSession[];
  habitLogs?: readonly ProgressHabitLog[];
  /** All descendants (any depth), for the "by subtasks" type. */
  descendants?: readonly ProgressDescendant[];
}

export interface ProgressContext {
  now: Date;
  timeZone: string;
  /** 0 Sunday, 1 Monday, 6 Saturday. */
  weekStart: number;
}

export interface TaskProgress {
  type: TaskType;
  /** 0..1 (a limit counter may exceed 1). */
  ratio: number;
  current: number;
  target: number | null;
  /** The type's goal is reached (percent 100 %, target hit…). */
  reached: boolean;
  /** Type-specific extras for the widgets. */
  detail: ProgressDetail;
}

export type ProgressDetail =
  | { kind: 'none' }
  | { kind: 'subtasks'; done: number; total: number }
  | { kind: 'time'; seconds: number; running: boolean }
  | { kind: 'habit'; done: number; required: number; streak: number; best: number; unit: 'days' | 'weeks'; todayStatus: string | null; scheduledToday: boolean }
  | { kind: 'counter'; period: string; mode: 'goal' | 'limit'; from: IsoDate | null; to: IsoDate | null }
  | { kind: 'stages'; done: number; total: number }
  | { kind: 'chain'; done: number; total: number; nextId: string | null }
  | { kind: 'collab'; byUser: Record<string, number> }
  | { kind: 'abstain'; days: number; record: number; since: string };

const live = <T extends { deleted_at: string | null }>(rows: readonly T[] | undefined): T[] =>
  (rows ?? []).filter((r) => !r.deleted_at);

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);
const localDate = (iso: string, timeZone: string) => todayIn(timeZone, new Date(iso));

// ---------------------------------------------------------------------------
// Numbers built from events
// ---------------------------------------------------------------------------

/** Replays events in time order: "set" replaces the value, "delta" adds to it. */
export function replayValue(events: readonly ProgressEvent[]): number {
  const ordered = live(events)
    .filter((e) => e.kind === 'set' || e.kind === 'delta')
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at) || a.id.localeCompare(b.id));
  let value = 0;
  for (const e of ordered) value = e.kind === 'set' ? Number(e.value) : value + Number(e.value);
  return value;
}

export function counterWindow(
  period: 'day' | 'week' | 'month' | 'none',
  today: IsoDate,
  weekStart: number,
): { from: IsoDate | null; to: IsoDate | null } {
  switch (period) {
    case 'day':
      return { from: today, to: today };
    case 'week': {
      const from = startOfWeek(today, weekStart);
      return { from, to: addDays(from, 6) };
    }
    case 'month': {
      const from = startOfMonth(today);
      const { y, m } = parts(today);
      return { from, to: fromParts(y, m, daysInMonth(y, m)) };
    }
    case 'none':
      return { from: null, to: null };
  }
}

/** Total of delta events whose local date falls in the window (the automatic reset). */
export function counterValue(
  events: readonly ProgressEvent[],
  window: { from: IsoDate | null; to: IsoDate | null },
  timeZone: string,
): number {
  let sum = 0;
  for (const e of live(events)) {
    if (e.kind !== 'delta') continue;
    const d = localDate(e.occurred_at, timeZone);
    if (window.from && d < window.from) continue;
    if (window.to && d > window.to) continue;
    sum += Number(e.value);
  }
  return sum;
}

/** Totals of the last `count` periods, newest first (history under the counter). */
export function counterHistory(
  events: readonly ProgressEvent[],
  period: 'day' | 'week' | 'month',
  ctx: ProgressContext,
  count: number,
): { from: IsoDate; to: IsoDate; total: number }[] {
  const out: { from: IsoDate; to: IsoDate; total: number }[] = [];
  let anchor = todayIn(ctx.timeZone, ctx.now);
  for (let i = 0; i < count; i += 1) {
    const w = counterWindow(period, anchor, ctx.weekStart) as { from: IsoDate; to: IsoDate };
    out.push({ ...w, total: counterValue(events, w, ctx.timeZone) });
    anchor = addDays(w.from, -1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------
export function sessionSeconds(session: ProgressSession, now: Date): number {
  if (session.seconds != null && session.ended_at) return session.seconds;
  const start = Date.parse(session.started_at);
  const end = session.ended_at ? Date.parse(session.ended_at) : now.getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function trackedSeconds(sessions: readonly ProgressSession[], now: Date): { seconds: number; running: boolean } {
  let seconds = 0;
  let running = false;
  for (const s of live(sessions)) {
    if (s.kind === 'break') continue;
    if (!s.ended_at) running = true;
    seconds += sessionSeconds(s, now);
  }
  return { seconds, running };
}

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------
const SATISFIED = new Set(['done', 'freeze']);

function isScheduled(schedule: HabitSchedule, date: IsoDate): boolean {
  return schedule.kind === 'times' || schedule.days.includes(weekday(date));
}

export function habitStats(
  logs: readonly ProgressHabitLog[],
  schedule: HabitSchedule,
  start: IsoDate,
  today: IsoDate,
  weekStart: number,
): { done: number; required: number; streak: number; best: number; unit: 'days' | 'weeks'; todayStatus: string | null } {
  const byDate = new Map<IsoDate, string>();
  for (const l of live(logs)) byDate.set(l.date, l.status);
  const todayStatus = byDate.get(today) ?? null;
  const weekFrom = startOfWeek(today, weekStart);

  if (schedule.kind === 'days') {
    let required = 0;
    let done = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(weekFrom, i);
      if (!schedule.days.includes(weekday(d)) || d < start) continue;
      required += 1;
      if (SATISFIED.has(byDate.get(d) ?? '')) done += 1;
    }

    // Walk scheduled days from the start: today without a mark does not break the series.
    let run = 0;
    let best = 0;
    let streak = 0;
    for (let d = start; compareDates(d, today) <= 0; d = addDays(d, 1)) {
      if (!isScheduled(schedule, d)) continue;
      const ok = SATISFIED.has(byDate.get(d) ?? '');
      if (ok) {
        run += 1;
        best = Math.max(best, run);
      } else if (d !== today) {
        run = 0;
      }
    }
    streak = run;
    return { done, required, streak, best, unit: 'days', todayStatus };
  }

  // "N times a week": the series counts weeks that met the goal.
  const countWeek = (from: IsoDate) => {
    let n = 0;
    for (let i = 0; i < 7; i += 1) if (SATISFIED.has(byDate.get(addDays(from, i)) ?? '')) n += 1;
    return n;
  };
  const done = countWeek(weekFrom);
  let run = 0;
  let best = 0;
  for (let w = startOfWeek(start, weekStart); compareDates(w, weekFrom) <= 0; w = addDays(w, 7)) {
    const met = countWeek(w) >= schedule.perWeek;
    if (met) {
      run += 1;
      best = Math.max(best, run);
    } else if (w !== weekFrom) {
      run = 0;
    }
  }
  return { done, required: schedule.perWeek, streak: run, best, unit: 'weeks', todayStatus };
}

// ---------------------------------------------------------------------------
// Abstinence ("Отказ")
// ---------------------------------------------------------------------------
export function abstainStats(
  relapses: readonly ProgressEvent[],
  since: string,
  today: IsoDate,
  timeZone: string,
): { days: number; record: number; since: string } {
  const moments = live(relapses)
    .filter((e) => e.kind === 'relapse')
    .map((e) => e.occurred_at)
    .filter((t) => t >= since)
    .sort();
  let previous = localDate(since, timeZone);
  let record = 0;
  for (const m of moments) {
    const d = localDate(m, timeZone);
    record = Math.max(record, diffDays(d, previous));
    previous = d;
  }
  const days = Math.max(0, diffDays(today, previous));
  return { days, record: Math.max(record, days), since: moments.at(-1) ?? since };
}

// ---------------------------------------------------------------------------
// Milestones (stages and chains)
// ---------------------------------------------------------------------------
export function orderedMilestones<T extends ProgressMilestone>(milestones: readonly T[]): T[] {
  return live(milestones).sort((a, b) => (a.sort_key < b.sort_key ? -1 : a.sort_key > b.sort_key ? 1 : a.id.localeCompare(b.id)));
}

/** Rescales weights to sum to 100 (equal split when all are zero); the last one absorbs rounding. */
export function normalizeWeights(weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
  const raw = sum > 0 ? weights.map((w) => (Math.max(0, w) / sum) * 100) : weights.map(() => 100 / weights.length);
  const rounded = raw.map((w) => Math.round(w * 10) / 10);
  const drift = Math.round((100 - rounded.reduce((a, b) => a + b, 0)) * 10) / 10;
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1]! + drift) * 10) / 10;
  return rounded;
}

// ---------------------------------------------------------------------------
// The single entry point
// ---------------------------------------------------------------------------
export function computeProgress(task: ProgressTask, parts: ProgressParts, ctx: ProgressContext): TaskProgress {
  const type = task.type as TaskType;
  const completed = Boolean(task.completed_at);
  const target = task.progress_target != null && Number(task.progress_target) > 0 ? Number(task.progress_target) : null;
  const today = todayIn(ctx.timeZone, ctx.now);

  switch (type) {
    case 'percent': {
      const current = Math.min(100, Math.max(0, Number(task.progress_current) || 0));
      return { type, ratio: completed ? 1 : current / 100, current, target: 100, reached: current >= 100, detail: { kind: 'none' } };
    }
    case 'numeric': {
      const current = replayValue(parts.events ?? []);
      const ratio = target ? clamp01(current / target) : completed ? 1 : 0;
      return { type, ratio: completed ? 1 : ratio, current, target, reached: target != null && current >= target, detail: { kind: 'none' } };
    }
    case 'subtasks': {
      const all = live(parts.descendants ?? []);
      const done = all.filter((t) => t.completed_at).length;
      const ratio = all.length ? done / all.length : completed ? 1 : 0;
      return {
        type,
        ratio: completed ? 1 : ratio,
        current: done,
        target: all.length,
        reached: all.length > 0 && done === all.length,
        detail: { kind: 'subtasks', done, total: all.length },
      };
    }
    case 'time': {
      const { seconds, running } = trackedSeconds(parts.sessions ?? [], ctx.now);
      const goalSeconds = target ? target * 60 : null;
      const ratio = goalSeconds ? clamp01(seconds / goalSeconds) : completed ? 1 : 0;
      return {
        type,
        ratio: completed ? 1 : ratio,
        current: seconds / 60,
        target,
        reached: goalSeconds != null && seconds >= goalSeconds,
        detail: { kind: 'time', seconds, running },
      };
    }
    case 'habit': {
      const config = readTypeConfig('habit', task.type_config);
      const start = config.start ?? localDate(task.created_at, ctx.timeZone);
      const s = habitStats(parts.habitLogs ?? [], config.schedule, start, today, ctx.weekStart);
      return {
        type,
        ratio: s.required ? clamp01(s.done / s.required) : 0,
        current: s.done,
        target: s.required,
        reached: s.required > 0 && s.done >= s.required,
        detail: { kind: 'habit', ...s, scheduledToday: isScheduled(config.schedule, today) },
      };
    }
    case 'counter': {
      const config = readTypeConfig('counter', task.type_config);
      const window = counterWindow(config.period, today, ctx.weekStart);
      const current = counterValue(parts.events ?? [], window, ctx.timeZone);
      const ratio = target ? current / target : 0;
      return {
        type,
        ratio: config.mode === 'limit' ? Math.max(0, ratio) : clamp01(ratio),
        current,
        target,
        reached: target != null && (config.mode === 'limit' ? current <= target : current >= target),
        detail: { kind: 'counter', period: config.period, mode: config.mode, ...window },
      };
    }
    case 'stages': {
      const ms = orderedMilestones(parts.milestones ?? []);
      const weights = ms.every((m) => Number(m.weight) <= 0) ? ms.map(() => 1) : ms.map((m) => Math.max(0, Number(m.weight)));
      const total = weights.reduce((a, b) => a + b, 0);
      const doneWeight = ms.reduce((acc, m, i) => acc + (m.done_at ? weights[i]! : 0), 0);
      const done = ms.filter((m) => m.done_at).length;
      const ratio = total ? doneWeight / total : completed ? 1 : 0;
      return {
        type,
        ratio: completed ? 1 : clamp01(ratio),
        current: done,
        target: ms.length,
        reached: ms.length > 0 && done === ms.length,
        detail: { kind: 'stages', done, total: ms.length },
      };
    }
    case 'chain': {
      const ms = orderedMilestones(parts.milestones ?? []);
      // A step counts only when every step before it is done.
      let done = 0;
      for (const m of ms) {
        if (!m.done_at) break;
        done += 1;
      }
      const nextId = ms[done]?.id ?? null;
      const ratio = ms.length ? done / ms.length : completed ? 1 : 0;
      return {
        type,
        ratio: completed ? 1 : ratio,
        current: done,
        target: ms.length,
        reached: ms.length > 0 && done === ms.length,
        detail: { kind: 'chain', done, total: ms.length, nextId },
      };
    }
    case 'collab': {
      const byUser: Record<string, number> = {};
      let total = 0;
      for (const e of live(parts.events ?? [])) {
        if (e.kind !== 'contribution' && e.kind !== 'delta') continue;
        byUser[e.user_id] = (byUser[e.user_id] ?? 0) + Number(e.value);
        total += Number(e.value);
      }
      const ratio = target ? clamp01(total / target) : completed ? 1 : 0;
      return { type, ratio: completed ? 1 : ratio, current: total, target, reached: target != null && total >= target, detail: { kind: 'collab', byUser } };
    }
    case 'abstain': {
      const config = readTypeConfig('abstain', task.type_config);
      const since = config.start ?? task.created_at;
      const s = abstainStats(parts.events ?? [], since, today, ctx.timeZone);
      return {
        type,
        ratio: target ? clamp01(s.days / target) : 0,
        current: s.days,
        target,
        reached: target != null && s.days >= target,
        detail: { kind: 'abstain', ...s },
      };
    }
    case 'normal':
    default:
      return { type: 'normal', ratio: completed ? 1 : 0, current: completed ? 1 : 0, target: 1, reached: completed, detail: { kind: 'none' } };
  }
}
