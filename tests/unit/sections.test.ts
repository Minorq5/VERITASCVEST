import { describe, expect, it } from 'vitest';
import {
  compareManual,
  compareTasks,
  inSection,
  isOverdue,
  sectionCounts,
  trashDaysLeft,
  type SectionTask,
} from '@/lib/domain/sections';

const TODAY = '2026-09-29';
// 12:00 in Moscow (UTC+3).
const NOW = new Date('2026-09-29T09:00:00Z');
const ctx = { today: TODAY, now: NOW };

let seq = 0;
function task(extra: Partial<SectionTask> = {}): SectionTask {
  seq += 1;
  return {
    id: `t${String(seq).padStart(3, '0')}`,
    parent_id: null,
    project_id: null,
    due_date: null,
    due_time: null,
    timezone: 'Europe/Moscow',
    completed_at: null,
    deleted_at: null,
    priority_id: null,
    sort_key: 'a0',
    created_at: `2026-09-01T00:00:${String(seq % 60).padStart(2, '0')}Z`,
    ...extra,
  };
}

describe('sections', () => {
  it('today holds everything due today or earlier; overdue only what is past its deadline', () => {
    const yesterday = task({ due_date: '2026-09-28' });
    const morning = task({ due_date: TODAY, due_time: '09:00:00' });
    const evening = task({ due_date: TODAY, due_time: '20:00:00' });
    const allDay = task({ due_date: TODAY });
    for (const t of [yesterday, morning, evening, allDay]) expect(inSection(t, 'today', ctx)).toBe(true);
    expect([yesterday, morning, evening, allDay].map((t) => isOverdue(t, ctx))).toEqual([true, true, false, false]);
  });

  it('the deadline is read in the task’s own time zone', () => {
    // 10:00 in Tokyo is 01:00 UTC — long past at 09:00 UTC.
    const tokyo = task({ due_date: TODAY, due_time: '10:00:00', timezone: 'Asia/Tokyo' });
    // 10:00 in New York is 14:00 UTC — still ahead.
    const newYork = task({ due_date: TODAY, due_time: '10:00:00', timezone: 'America/New_York' });
    expect(isOverdue(tokyo, ctx)).toBe(true);
    expect(isOverdue(newYork, ctx)).toBe(false);
  });

  it('tomorrow and the next 7 days', () => {
    const tomorrow = task({ due_date: '2026-09-30' });
    const sixDays = task({ due_date: '2026-10-05' });
    const sevenDays = task({ due_date: '2026-10-06' });
    expect(inSection(tomorrow, 'tomorrow', ctx)).toBe(true);
    expect(inSection(tomorrow, 'week', ctx)).toBe(true);
    expect(inSection(sixDays, 'week', ctx)).toBe(true);
    expect(inSection(sevenDays, 'week', ctx)).toBe(false);
  });

  it('inbox: open top-level tasks without a project, with or without a date', () => {
    expect(inSection(task(), 'inbox', ctx)).toBe(true);
    expect(inSection(task({ due_date: TODAY }), 'inbox', ctx)).toBe(true);
    expect(inSection(task({ project_id: 'p1' }), 'inbox', ctx)).toBe(false);
    expect(inSection(task({ parent_id: 'x' }), 'inbox', ctx)).toBe(false);
  });

  it('completed and deleted tasks leave the working lists', () => {
    const done = task({ due_date: TODAY, completed_at: NOW.toISOString() });
    const trashed = task({ due_date: TODAY, deleted_at: NOW.toISOString() });
    for (const s of ['today', 'inbox', 'overdue', 'week'] as const) {
      expect(inSection(done, s, ctx)).toBe(false);
      expect(inSection(trashed, s, ctx)).toBe(false);
    }
    expect(inSection(done, 'completed', ctx)).toBe(true);
    expect(inSection(trashed, 'trash', ctx)).toBe(true);
    // A completed task that was then deleted belongs to the trash only.
    const both = task({ completed_at: NOW.toISOString(), deleted_at: NOW.toISOString() });
    expect(inSection(both, 'completed', ctx)).toBe(false);
    expect(inSection(both, 'trash', ctx)).toBe(true);
  });

  it('the trash shows a deleted subtask inside its deleted parent, not twice', () => {
    const parent = task({ deleted_at: NOW.toISOString() });
    const child = task({ parent_id: parent.id, deleted_at: NOW.toISOString() });
    const orphan = task({ parent_id: 'alive-parent', deleted_at: NOW.toISOString() });
    const deleted = new Set([parent.id, child.id, orphan.id]);
    expect(inSection(parent, 'trash', ctx, deleted)).toBe(true);
    expect(inSection(child, 'trash', ctx, deleted)).toBe(false);
    expect(inSection(orphan, 'trash', ctx, deleted)).toBe(true);
  });

  it('counts every list in one pass', () => {
    const counts = sectionCounts(
      [task({ due_date: '2026-09-28' }), task({ due_date: TODAY }), task({ due_date: '2026-09-30' }), task({ completed_at: NOW.toISOString() })],
      ctx,
    );
    expect(counts).toMatchObject({ today: 2, overdue: 1, tomorrow: 1, week: 2, inbox: 3, completed: 1, trash: 0 });
  });
});

describe('ordering', () => {
  const rank = (id: string | null) => ({ critical: 1, high: 2, medium: 3, low: 4 })[id as 'high'] ?? 5;

  it('deadline first, tasks without one last; all-day before timed; then priority; then manual order', () => {
    const a = task({ due_date: '2026-09-30' });
    const b = task({ due_date: TODAY, due_time: '10:00:00' });
    const c = task({ due_date: TODAY });
    const d = task({ due_date: TODAY, due_time: '10:00:00', priority_id: 'critical' });
    const e = task();
    const sorted = [a, b, c, d, e].sort((x, y) => compareTasks(x, y, rank)).map((t) => t.id);
    expect(sorted).toEqual([c.id, d.id, b.id, a.id, e.id]);
  });

  it('manual order follows the fractional keys as bytes (like COLLATE "C")', () => {
    const x = task({ sort_key: 'a0' });
    const y = task({ sort_key: 'a0V' });
    const z = task({ sort_key: 'a1' });
    const upper = task({ sort_key: 'Zz' });
    expect([z, y, upper, x].sort(compareManual).map((t) => t.sort_key)).toEqual(['Zz', 'a0', 'a0V', 'a1']);
  });
});

describe('trash countdown', () => {
  it('30 days, rounded up, never negative', () => {
    const now = new Date('2026-09-29T12:00:00Z');
    expect(trashDaysLeft('2026-09-29T11:00:00Z', now)).toBe(30);
    expect(trashDaysLeft('2026-09-19T12:00:00Z', now)).toBe(20);
    expect(trashDaysLeft('2026-08-30T13:00:00Z', now)).toBe(1);
    expect(trashDaysLeft('2026-08-01T00:00:00Z', now)).toBe(0);
  });
});
