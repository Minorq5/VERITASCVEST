import { describe, expect, it } from 'vitest';
import {
  abstainStats,
  computeProgress,
  counterHistory,
  habitStats,
  normalizeWeights,
  replayValue,
  type ProgressContext,
  type ProgressEvent,
  type ProgressTask,
} from '@/lib/domain/progress';
import { readTypeConfig, type HabitSchedule } from '@/lib/domain/task-types';

// Wednesday 2026-09-30, 15:00 in Moscow.
const ctx: ProgressContext = { now: new Date('2026-09-30T12:00:00Z'), timeZone: 'Europe/Moscow', weekStart: 1 };

const task = (type: string, extra: Partial<ProgressTask> = {}): ProgressTask => ({
  id: 't1',
  type,
  completed_at: null,
  progress_current: 0,
  progress_target: null,
  type_config: {},
  created_at: '2026-09-01T09:00:00Z',
  ...extra,
});

let seq = 0;
const ev = (kind: string, value: number, occurred_at: string, user_id = 'u1', deleted_at: string | null = null): ProgressEvent => ({
  id: `e${(seq += 1)}`,
  kind,
  value,
  occurred_at,
  user_id,
  deleted_at,
});

describe('progress by type', () => {
  it('normal: 0 or 100 %', () => {
    expect(computeProgress(task('normal'), {}, ctx).ratio).toBe(0);
    expect(computeProgress(task('normal', { completed_at: '2026-09-30T10:00:00Z' }), {}, ctx).ratio).toBe(1);
  });

  it('percent: the stored value, capped to 0–100', () => {
    expect(computeProgress(task('percent', { progress_current: 35 }), {}, ctx).ratio).toBeCloseTo(0.35);
    const full = computeProgress(task('percent', { progress_current: 140 }), {}, ctx);
    expect([full.ratio, full.reached]).toEqual([1, true]);
  });

  it('numeric: events replay ("set" resets, "delta" adds), deleted events are ignored', () => {
    const events = [
      ev('delta', 25, '2026-09-20T10:00:00Z'),
      ev('set', 100, '2026-09-21T10:00:00Z'),
      ev('delta', 50, '2026-09-22T10:00:00Z'),
      ev('delta', 999, '2026-09-23T10:00:00Z', 'u1', '2026-09-23T11:00:00Z'),
    ];
    const p = computeProgress(task('numeric', { progress_target: 300 }), { events }, ctx);
    expect([p.current, p.ratio]).toEqual([150, 0.5]);
  });

  it('numeric: two offline devices adding +1 each give +2', () => {
    expect(replayValue([ev('delta', 1, '2026-09-30T10:00:00Z'), ev('delta', 1, '2026-09-30T10:00:00Z')])).toBe(2);
  });

  it('subtasks: completed / all descendants', () => {
    const descendants = [
      { id: 'a', completed_at: '2026-09-29T10:00:00Z', deleted_at: null },
      { id: 'b', completed_at: null, deleted_at: null },
      { id: 'c', completed_at: '2026-09-29T10:00:00Z', deleted_at: null },
      { id: 'd', completed_at: null, deleted_at: '2026-09-29T10:00:00Z' },
    ];
    const p = computeProgress(task('subtasks'), { descendants }, ctx);
    expect([p.current, p.target, p.ratio]).toEqual([2, 3, 2 / 3]);
  });

  it('time: finished and running focus sessions, breaks do not count', () => {
    const sessions = [
      { started_at: '2026-09-30T10:00:00Z', ended_at: '2026-09-30T10:25:00Z', seconds: 1500, kind: 'focus', deleted_at: null },
      { started_at: '2026-09-30T10:25:00Z', ended_at: '2026-09-30T10:30:00Z', seconds: 300, kind: 'break', deleted_at: null },
      { started_at: '2026-09-30T11:45:00Z', ended_at: null, seconds: null, kind: 'focus', deleted_at: null },
    ];
    const p = computeProgress(task('time', { progress_target: 60 }), { sessions }, ctx);
    expect(p.detail).toEqual({ kind: 'time', seconds: 1500 + 900, running: true });
    expect(p.ratio).toBeCloseTo(40 / 60);
  });

  it('counter: resets by period in the person\'s time zone', () => {
    const events = [
      ev('delta', 1, '2026-09-29T20:30:00Z'), // 23:30 Moscow, Tuesday
      ev('delta', 1, '2026-09-29T21:30:00Z'), // 00:30 Moscow, Wednesday
      ev('delta', 1, '2026-09-30T08:00:00Z'),
      ev('delta', -1, '2026-09-30T09:00:00Z'),
    ];
    const daily = computeProgress(task('counter', { progress_target: 8, type_config: { period: 'day' } }), { events }, ctx);
    expect(daily.current).toBe(1);
    const weekly = computeProgress(task('counter', { progress_target: 8, type_config: { period: 'week' } }), { events }, ctx);
    expect(weekly.current).toBe(2);
    const limit = computeProgress(task('counter', { progress_target: 1, type_config: { period: 'week', mode: 'limit' } }), { events }, ctx);
    expect([limit.ratio, limit.reached]).toEqual([2, false]);
  });

  it('counter history: last periods, newest first', () => {
    const events = [ev('delta', 3, '2026-09-30T08:00:00Z'), ev('delta', 5, '2026-09-29T08:00:00Z')];
    expect(counterHistory(events, 'day', ctx, 3).map((p) => [p.from, p.total])).toEqual([
      ['2026-09-30', 3],
      ['2026-09-29', 5],
      ['2026-09-28', 0],
    ]);
  });

  it('stages: weights of finished stages; equal split when weights are empty', () => {
    const milestones = [
      { id: 'm1', weight: 20, done_at: '2026-09-29T10:00:00Z', sort_key: 'a0', deleted_at: null },
      { id: 'm2', weight: 50, done_at: null, sort_key: 'a1', deleted_at: null },
      { id: 'm3', weight: 30, done_at: '2026-09-29T10:00:00Z', sort_key: 'a2', deleted_at: null },
    ];
    expect(computeProgress(task('stages'), { milestones }, ctx).ratio).toBeCloseTo(0.5);
    const equal = milestones.map((m) => ({ ...m, weight: 0 }));
    expect(computeProgress(task('stages'), { milestones: equal }, ctx).ratio).toBeCloseTo(2 / 3);
  });

  it('chain: a step counts only after all previous steps', () => {
    const milestones = [
      { id: 's1', weight: 0, done_at: '2026-09-29T10:00:00Z', sort_key: 'a0', deleted_at: null },
      { id: 's2', weight: 0, done_at: null, sort_key: 'a1', deleted_at: null },
      { id: 's3', weight: 0, done_at: '2026-09-29T10:00:00Z', sort_key: 'a2', deleted_at: null },
    ];
    const p = computeProgress(task('chain'), { milestones }, ctx);
    expect(p.detail).toEqual({ kind: 'chain', done: 1, total: 3, nextId: 's2' });
  });

  it('collab: contributions per person add up to the shared goal', () => {
    const events = [ev('contribution', 30, '2026-09-29T10:00:00Z', 'alex'), ev('contribution', 45, '2026-09-30T10:00:00Z', 'maria')];
    const p = computeProgress(task('collab', { progress_target: 100 }), { events }, ctx);
    expect([p.current, p.ratio]).toEqual([75, 0.75]);
    expect(p.detail).toEqual({ kind: 'collab', byUser: { alex: 30, maria: 45 } });
  });

  it('abstain: days since the last relapse, with the record', () => {
    const events = [ev('relapse', 0, '2026-09-10T10:00:00Z'), ev('relapse', 0, '2026-09-20T10:00:00Z')];
    const p = computeProgress(
      task('abstain', { progress_target: 30, type_config: { start: '2026-09-01T00:00:00Z' } }),
      { events },
      ctx,
    );
    expect(p.detail).toEqual({ kind: 'abstain', days: 10, record: 10, since: '2026-09-20T10:00:00Z' });
    expect(abstainStats([], '2026-08-01T00:00:00Z', '2026-09-30', 'Europe/Moscow').record).toBe(60);
  });
});

describe('habits', () => {
  const everyday: HabitSchedule = { kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] };
  const log = (date: string, status = 'done') => ({ date, status, deleted_at: null });

  it('streak continues while today is still open; a freeze keeps it', () => {
    const logs = [log('2026-09-26'), log('2026-09-27', 'freeze'), log('2026-09-28'), log('2026-09-29')];
    const s = habitStats(logs, everyday, '2026-09-20', '2026-09-30', 1);
    expect([s.streak, s.best]).toEqual([4, 4]);
  });

  it('a missed scheduled day breaks the streak; unscheduled days do not', () => {
    const monWedFri: HabitSchedule = { kind: 'days', days: [1, 3, 5] };
    const logs = [log('2026-09-21'), log('2026-09-23'), log('2026-09-25'), log('2026-09-28')];
    expect(habitStats(logs, monWedFri, '2026-09-21', '2026-09-30', 1).streak).toBe(4);
    const broken = [log('2026-09-21'), log('2026-09-25'), log('2026-09-28')];
    const s = habitStats(broken, monWedFri, '2026-09-21', '2026-09-30', 1);
    expect([s.streak, s.best]).toEqual([2, 2]);
  });

  it('"3 times a week" counts weeks that met the goal', () => {
    const logs = [log('2026-09-14'), log('2026-09-16'), log('2026-09-18'), log('2026-09-21'), log('2026-09-22'), log('2026-09-26'), log('2026-09-29')];
    const s = habitStats(logs, { kind: 'times', perWeek: 3 }, '2026-09-14', '2026-09-30', 1);
    expect([s.unit, s.streak, s.done, s.required]).toEqual(['weeks', 2, 1, 3]);
  });

  it('weekly progress of a habit', () => {
    const p = computeProgress(
      task('habit', { type_config: { schedule: { kind: 'days', days: [1, 3, 5] } } }),
      { habitLogs: [log('2026-09-28')] },
      ctx,
    );
    expect(p.ratio).toBeCloseTo(1 / 3);
  });
});

describe('helpers', () => {
  it('normalizes stage weights to 100', () => {
    expect(normalizeWeights([1, 1, 1])).toEqual([33.3, 33.3, 33.4]);
    expect(normalizeWeights([0, 0])).toEqual([50, 50]);
    expect(normalizeWeights([20, 60])).toEqual([25, 75]);
  });

  it('reads type settings with defaults and survives broken data', () => {
    expect(readTypeConfig('counter', {})).toMatchObject({ period: 'day', mode: 'goal', step: 1 });
    expect(readTypeConfig('habit', { schedule: { kind: 'nonsense' } }).schedule).toEqual({ kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] });
  });
});
