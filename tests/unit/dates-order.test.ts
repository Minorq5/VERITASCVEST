import { describe, expect, it } from 'vitest';
import { newId, stableId } from '@/lib/ids';
import { compareKeys, keyBetween, keyForIndex, keysBetween } from '@/lib/order';
import { addMonths, startOfWeek, todayIn, zonedMoment } from '@/lib/time/dates';

describe('dates', () => {
  it('today depends on the time zone', () => {
    const instant = new Date('2026-09-30T22:30:00Z');
    expect(todayIn('Europe/Moscow', instant)).toBe('2026-10-01');
    expect(todayIn('America/New_York', instant)).toBe('2026-09-30');
  });

  it('local date + time → the right instant, also across daylight saving', () => {
    expect(zonedMoment('2026-10-01', '18:00', 'Europe/Moscow').toISOString()).toBe('2026-10-01T15:00:00.000Z');
    // Sofia switches to winter time on 25 Oct 2026.
    expect(zonedMoment('2026-10-24', '12:00', 'Europe/Sofia').toISOString()).toBe('2026-10-24T09:00:00.000Z');
    expect(zonedMoment('2026-10-26', '12:00', 'Europe/Sofia').toISOString()).toBe('2026-10-26T10:00:00.000Z');
    // A date without time means the end of that day.
    expect(zonedMoment('2026-10-01', null, 'Europe/Moscow').toISOString()).toBe('2026-10-01T20:59:59.000Z');
  });

  it('month arithmetic clamps to the month length', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('week start', () => {
    expect(startOfWeek('2026-09-30', 1)).toBe('2026-09-28');
    expect(startOfWeek('2026-09-30', 0)).toBe('2026-09-27');
    expect(startOfWeek('2026-09-30', 6)).toBe('2026-09-26');
  });
});

describe('ids and order', () => {
  it('ids are time-ordered UUID v7; content ids are stable', () => {
    const a = newId();
    const b = newId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
    expect(stableId.taskTag('t', 'g')).toBe(stableId.taskTag('t', 'g'));
    expect(stableId.tag('u', ' Спорт ')).toBe(stableId.tag('u', 'спорт'));
    expect(stableId.habitDay('t', 'u', '2026-10-01')).not.toBe(stableId.habitDay('t', 'u', '2026-10-02'));
  });

  it('fractional keys sort byte-wise and fit between neighbours', () => {
    const first = keyBetween(null, null);
    expect(first).toBe('a0');
    const [k1, k2, k3] = keysBetween(first, null, 3);
    expect([first, k1!, k2!, k3!].every((k, i, arr) => i === 0 || compareKeys(arr[i - 1]!, k) < 0)).toBe(true);
    const mid = keyBetween(k1!, k2!);
    expect(compareKeys(k1!, mid) < 0 && compareKeys(mid, k2!) < 0).toBe(true);
    expect(compareKeys(keyForIndex(['a0', 'a1'], 0), 'a0')).toBeLessThan(0);
    expect(compareKeys(keyForIndex(['a0', 'a1'], 2), 'a1')).toBeGreaterThan(0);
  });
});
