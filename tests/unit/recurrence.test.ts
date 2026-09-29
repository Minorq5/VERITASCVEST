import { describe, expect, it } from 'vitest';
import {
  afterCompletion,
  alignAnchor,
  nextDueAfterCompletion,
  nextOccurrence,
  nthWeekdayOfMonth,
  occurrences,
  parseRecurrence,
  presets,
  summarize,
  toRRule,
  type RecurrenceRule,
} from '@/lib/domain/recurrence';

const rule = (r: Partial<RecurrenceRule> & Pick<RecurrenceRule, 'freq' | 'anchor'>): RecurrenceRule => ({
  interval: 1,
  mode: 'schedule',
  ...r,
});

describe('recurrence: daily and weekly', () => {
  it('every day and every 3 days', () => {
    expect(occurrences(presets.daily('2026-10-01'), '2026-10-01', '2026-10-04')).toEqual([
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ]);
    expect(occurrences(presets.daily('2026-10-01', 3), '2026-10-01', '2026-10-10')).toEqual([
      '2026-10-01', '2026-10-04', '2026-10-07', '2026-10-10',
    ]);
  });

  it('weekdays skip the weekend', () => {
    // 2026-10-02 is a Friday.
    expect(occurrences(presets.weekdays('2026-10-02'), '2026-10-02', '2026-10-07')).toEqual([
      '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07',
    ]);
  });

  it('every other week on Monday and Thursday, weeks starting Monday', () => {
    // 2026-09-28 is a Monday.
    expect(occurrences(presets.weekly('2026-09-28', [1, 4], 2), '2026-09-28', '2026-10-25')).toEqual([
      '2026-09-28', '2026-10-01', '2026-10-12', '2026-10-15',
    ]);
  });

  it('week start matters for "every 2 weeks" with Sunday', () => {
    const r = presets.weekly('2026-10-01', [0, 3], 2); // Thursday anchor; Sun + Wed
    expect(occurrences(r, '2026-10-01', '2026-10-31', 1)).toEqual(['2026-10-04', '2026-10-14', '2026-10-18', '2026-10-28']);
    expect(occurrences(r, '2026-10-01', '2026-10-31', 0)).toEqual(['2026-10-11', '2026-10-14', '2026-10-25', '2026-10-28']);
  });
});

describe('recurrence: months and years', () => {
  it('"every 31st" clamps to the last day of shorter months, incl. leap February', () => {
    expect(occurrences(presets.monthlyOnDay('2027-12-31', 31), '2027-12-01', '2028-04-30')).toEqual([
      '2027-12-31', '2028-01-31', '2028-02-29', '2028-03-31', '2028-04-30',
    ]);
  });

  it('last day of the month', () => {
    expect(occurrences(presets.monthlyOnDay('2026-01-31', -1), '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ]);
  });

  it('second Tuesday and last Friday of the month', () => {
    expect(nthWeekdayOfMonth(2026, 10, 2, 2)).toBe('2026-10-13');
    expect(nthWeekdayOfMonth(2026, 10, 5, -1)).toBe('2026-10-30');
    expect(occurrences(presets.monthlyNth('2026-10-01', 2, 2), '2026-10-01', '2026-12-31')).toEqual([
      '2026-10-13', '2026-11-10', '2026-12-08',
    ]);
  });

  it('a fifth weekday that a month lacks is skipped', () => {
    expect(nthWeekdayOfMonth(2026, 2, 1, 4)).toBe('2026-02-23');
  });

  it('yearly on Feb 29 falls back to Feb 28 in common years', () => {
    expect(occurrences(presets.yearly('2028-02-29'), '2028-01-01', '2033-01-01')).toEqual([
      '2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29',
    ]);
  });
});

describe('recurrence: limits', () => {
  it('until, count and skipped dates', () => {
    const base = presets.daily('2026-10-01');
    expect(occurrences({ ...base, until: '2026-10-03' }, '2026-10-01', '2026-10-10')).toEqual([
      '2026-10-01', '2026-10-02', '2026-10-03',
    ]);
    expect(occurrences({ ...base, count: 2 }, '2026-10-01', '2026-10-10')).toEqual(['2026-10-01', '2026-10-02']);
    expect(occurrences({ ...base, count: 3, exdates: ['2026-10-02'] }, '2026-10-01', '2026-10-10')).toEqual([
      '2026-10-01', '2026-10-03',
    ]);
  });

  it('next occurrence is strictly after the given date and respects the end', () => {
    const r = { ...presets.weekdays('2026-10-01'), until: '2026-10-06' };
    expect(nextOccurrence(r, '2026-10-01')).toBe('2026-10-02');
    expect(nextOccurrence(r, '2026-10-02')).toBe('2026-10-05');
    expect(nextOccurrence(r, '2026-10-06')).toBeNull();
  });
});

describe('recurrence: completing a recurring task', () => {
  it('moves to the next occurrence after the current due date', () => {
    expect(nextDueAfterCompletion(presets.daily('2026-10-01'), '2026-10-05', '2026-10-03')).toBe('2026-10-06');
  });

  it('skips missed occurrences instead of carrying them forward', () => {
    expect(nextDueAfterCompletion(presets.daily('2026-10-01'), '2026-10-01', '2026-10-09')).toBe('2026-10-10');
  });

  it('"3 days after completion" counts from the completion date', () => {
    const r = rule({ freq: 'daily', interval: 3, mode: 'completion', anchor: '2026-10-01' });
    expect(nextDueAfterCompletion(r, '2026-10-01', '2026-10-07')).toBe('2026-10-10');
    expect(afterCompletion(rule({ freq: 'monthly', interval: 1, anchor: '2026-01-31' }), '2026-01-31')).toBe('2026-02-28');
  });

  it('a finished series returns null (the task simply stays completed)', () => {
    expect(nextDueAfterCompletion({ ...presets.daily('2026-10-01'), count: 1 }, '2026-10-01', '2026-10-01')).toBeNull();
  });
});

describe('recurrence: RRULE export and summaries', () => {
  it('exports RFC 5545 rules', () => {
    expect(toRRule(presets.weekdays('2026-10-01'))).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(toRRule(presets.monthlyNth('2026-10-01', 2, 2))).toBe('FREQ=MONTHLY;BYDAY=2TU');
    expect(toRRule(presets.monthlyOnDay('2026-10-01', 31))).toBe('FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
    expect(toRRule({ ...presets.daily('2026-10-01', 2), until: '2026-12-31' })).toBe('FREQ=DAILY;INTERVAL=2;UNTIL=20261231');
    expect(toRRule({ ...presets.yearly('2026-03-15'), count: 5 })).toBe('FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15;COUNT=5');
  });

  it('summaries recognise the common patterns', () => {
    expect(summarize(presets.weekdays('2026-10-01'))).toEqual({ kind: 'weekdays' });
    expect(summarize(presets.weekends('2026-10-03'))).toEqual({ kind: 'weekends' });
    expect(summarize(presets.weekly('2026-10-01', [4, 1]))).toEqual({ kind: 'weekly', interval: 1, days: [1, 4] });
  });

  it('aligns an anchor that does not match its own pattern', () => {
    // Anchor on a Thursday, rule says Mondays → first Monday after.
    expect(alignAnchor(presets.weekly('2026-10-01', [1]), '2026-10-01').anchor).toBe('2026-10-05');
  });

  it('validates stored rules', () => {
    expect(parseRecurrence({ freq: 'weekly', interval: 1, anchor: '2026-10-01' })?.mode).toBe('schedule');
    expect(parseRecurrence({ freq: 'hourly', interval: 1, anchor: '2026-10-01' })).toBeNull();
    expect(parseRecurrence({ freq: 'daily', interval: 0, anchor: '2026-10-01' })).toBeNull();
    expect(parseRecurrence({ freq: 'daily', interval: 1, anchor: '2026-13-01' })).toBeNull();
  });
});
