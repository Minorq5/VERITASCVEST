import { z } from 'zod';
import {
  addDays,
  addMonths,
  addYears,
  daysInMonth,
  fromParts,
  isIsoDate,
  parts,
  startOfWeek,
  weekday,
  type IsoDate,
} from '@/lib/time/dates';

/**
 * Repeat rules, compatible with RFC 5545 (exported to .ics as RRULE).
 * Everything works on calendar dates, so time zones and daylight saving never
 * move an occurrence; the time of day stays on the task.
 *
 * Month days beyond the month's length are clamped ("every 31st" → Feb 28/29),
 * which is what people mean; the RRULE export uses the BYSETPOS=-1 idiom for it.
 */
export const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(999),
  /** Weekly: the days (0 = Sunday … 6 = Saturday). Monthly with setPos: the weekday. */
  byWeekday: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  /** Monthly / yearly: day of month 1–31, or -1 for the last day. */
  byMonthDay: z.number().int().min(-1).max(31).refine((d) => d !== 0).optional(),
  /** Monthly: 1–4 = first…fourth, -1 = last (with a single byWeekday). */
  setPos: z.number().int().min(-1).max(4).refine((p) => p !== 0).optional(),
  /** Yearly: month 1–12. */
  byMonth: z.number().int().min(1).max(12).optional(),
  /** "schedule": fixed calendar; "completion": N days/weeks… after the last completion. */
  mode: z.enum(['schedule', 'completion']).default('schedule'),
  /** First occurrence (DTSTART). */
  anchor: z.string().refine(isIsoDate),
  until: z.string().refine(isIsoDate).nullable().optional(),
  count: z.number().int().min(1).max(10000).nullable().optional(),
  exdates: z.array(z.string().refine(isIsoDate)).max(500).optional(),
});

export type RecurrenceRule = z.infer<typeof recurrenceSchema>;
export type RecurrenceInput = z.input<typeof recurrenceSchema>;

export function parseRecurrence(value: unknown): RecurrenceRule | null {
  const result = recurrenceSchema.safeParse(value);
  return result.success ? result.data : null;
}

const MAX_SCAN = 20000;

function sortedDays(rule: RecurrenceRule, weekStart: number): number[] {
  const days = rule.byWeekday?.length ? [...new Set(rule.byWeekday)] : [weekday(rule.anchor)];
  return days.sort((a, b) => ((a - weekStart + 7) % 7) - ((b - weekStart + 7) % 7));
}

/** nth (1..4) or last (-1) weekday of a month. */
export function nthWeekdayOfMonth(y: number, m: number, day: number, pos: number): IsoDate | null {
  if (pos === -1) {
    const last = fromParts(y, m, daysInMonth(y, m));
    const back = (weekday(last) - day + 7) % 7;
    return addDays(last, -back);
  }
  const first = fromParts(y, m, 1);
  const forward = (day - weekday(first) + 7) % 7;
  const date = addDays(first, forward + (pos - 1) * 7);
  return parts(date).m === m ? date : null;
}

/**
 * All scheduled occurrences in order (ignores exdates and limits; see
 * `occurrences`). Candidates before the anchor are skipped.
 */
function* candidates(rule: RecurrenceRule, weekStart: number): Generator<IsoDate> {
  const anchor = rule.anchor;
  const a = parts(anchor);
  switch (rule.freq) {
    case 'daily': {
      for (let i = 0; ; i += 1) yield addDays(anchor, i * rule.interval);
    }
    case 'weekly': {
      const days = sortedDays(rule, weekStart);
      const week0 = startOfWeek(anchor, weekStart);
      for (let w = 0; ; w += rule.interval) {
        const base = addDays(week0, w * 7);
        for (const d of days) {
          const date = addDays(base, (d - weekStart + 7) % 7);
          if (date >= anchor) yield date;
        }
      }
    }
    case 'monthly': {
      for (let k = 0; ; k += rule.interval) {
        const total = a.y * 12 + (a.m - 1) + k;
        const y = Math.floor(total / 12);
        const m = (total % 12) + 1;
        let date: IsoDate | null;
        if (rule.setPos && rule.byWeekday?.length) {
          date = nthWeekdayOfMonth(y, m, rule.byWeekday[0]!, rule.setPos);
        } else {
          const want = rule.byMonthDay ?? a.d;
          const dim = daysInMonth(y, m);
          date = fromParts(y, m, want === -1 ? dim : Math.min(want, dim));
        }
        if (date && date >= anchor) yield date;
      }
    }
    case 'yearly': {
      const month = rule.byMonth ?? a.m;
      const day = rule.byMonthDay ?? a.d;
      for (let k = 0; ; k += rule.interval) {
        const y = a.y + k;
        const dim = daysInMonth(y, month);
        const date = fromParts(y, month, day === -1 ? dim : Math.min(day, dim));
        if (date >= anchor) yield date;
      }
    }
  }
}

/** Occurrences in [from, to] (both inclusive), honouring until, count and exdates. */
export function occurrences(rule: RecurrenceRule, from: IsoDate, to: IsoDate, weekStart = 1, limit = 1000): IsoDate[] {
  const out: IsoDate[] = [];
  const skip = new Set(rule.exdates ?? []);
  let index = 0;
  let scanned = 0;
  for (const date of candidates(rule, weekStart)) {
    if (++scanned > MAX_SCAN) break;
    if (rule.until && date > rule.until) break;
    if (rule.count && index >= rule.count) break;
    index += 1;
    if (date > to) break;
    if (date >= from && !skip.has(date)) {
      out.push(date);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** The first scheduled occurrence strictly after `after`, or null when the series is over. */
export function nextOccurrence(rule: RecurrenceRule, after: IsoDate, weekStart = 1): IsoDate | null {
  const skip = new Set(rule.exdates ?? []);
  let index = 0;
  let scanned = 0;
  for (const date of candidates(rule, weekStart)) {
    if (++scanned > MAX_SCAN) return null;
    if (rule.until && date > rule.until) return null;
    if (rule.count && index >= rule.count) return null;
    index += 1;
    if (date > after && !skip.has(date)) return date;
  }
  return null;
}

/** "Every N days after the last completion": the interval counted from the completion date. */
export function afterCompletion(rule: RecurrenceRule, completedOn: IsoDate): IsoDate {
  switch (rule.freq) {
    case 'daily':
      return addDays(completedOn, rule.interval);
    case 'weekly':
      return addDays(completedOn, rule.interval * 7);
    case 'monthly':
      return addMonths(completedOn, rule.interval);
    case 'yearly':
      return addYears(completedOn, rule.interval);
  }
}

/**
 * Where a recurring task moves when it is completed. Missed occurrences are
 * not carried forward: the task jumps to the first occurrence after
 * max(current due date, today).
 */
export function nextDueAfterCompletion(
  rule: RecurrenceRule,
  currentDue: IsoDate | null,
  today: IsoDate,
  weekStart = 1,
): IsoDate | null {
  if (rule.mode === 'completion') {
    const next = afterCompletion(rule, today);
    if (rule.until && next > rule.until) return null;
    return next;
  }
  const after = currentDue && currentDue > today ? currentDue : today;
  return nextOccurrence(rule, after, weekStart);
}

// ---------------------------------------------------------------------------
// Presets used by the editor and the smart input
// ---------------------------------------------------------------------------
export const presets = {
  daily: (anchor: IsoDate, interval = 1): RecurrenceRule => ({ freq: 'daily', interval, mode: 'schedule', anchor }),
  weekdays: (anchor: IsoDate): RecurrenceRule => ({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5], mode: 'schedule', anchor }),
  weekends: (anchor: IsoDate): RecurrenceRule => ({ freq: 'weekly', interval: 1, byWeekday: [6, 0], mode: 'schedule', anchor }),
  weekly: (anchor: IsoDate, days: number[], interval = 1): RecurrenceRule => ({
    freq: 'weekly',
    interval,
    byWeekday: days.length ? days : [weekday(anchor)],
    mode: 'schedule',
    anchor,
  }),
  monthlyOnDay: (anchor: IsoDate, day: number, interval = 1): RecurrenceRule => ({
    freq: 'monthly',
    interval,
    byMonthDay: day,
    mode: 'schedule',
    anchor,
  }),
  monthlyNth: (anchor: IsoDate, day: number, pos: number, interval = 1): RecurrenceRule => ({
    freq: 'monthly',
    interval,
    byWeekday: [day],
    setPos: pos,
    mode: 'schedule',
    anchor,
  }),
  yearly: (anchor: IsoDate, interval = 1): RecurrenceRule => ({ freq: 'yearly', interval, mode: 'schedule', anchor }),
};

/** First occurrence on or after `from` for a rule whose anchor may not match its own pattern. */
export function alignAnchor(rule: RecurrenceRule, from: IsoDate, weekStart = 1): RecurrenceRule {
  const probe = { ...rule, anchor: from, until: null, count: null, exdates: [] };
  const first = occurrences(probe, from, addYears(from, 5), weekStart, 1)[0];
  return { ...rule, anchor: first ?? from };
}

// ---------------------------------------------------------------------------
// RRULE export (RFC 5545)
// ---------------------------------------------------------------------------
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

function monthDayRule(day: number): string {
  if (day === -1) return 'BYMONTHDAY=-1';
  if (day <= 28) return `BYMONTHDAY=${day}`;
  // "30th, or the last day of shorter months".
  const set = Array.from({ length: day - 27 }, (_, i) => 28 + i).join(',');
  return `BYMONTHDAY=${set};BYSETPOS=-1`;
}

export function toRRule(rule: RecurrenceRule): string {
  const out = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.interval > 1) out.push(`INTERVAL=${rule.interval}`);
  const a = parts(rule.anchor);
  if (rule.freq === 'weekly') {
    out.push(`BYDAY=${(rule.byWeekday?.length ? rule.byWeekday : [weekday(rule.anchor)]).map((d) => BYDAY[d]).join(',')}`);
  } else if (rule.freq === 'monthly') {
    if (rule.setPos && rule.byWeekday?.length) out.push(`BYDAY=${rule.setPos}${BYDAY[rule.byWeekday[0]!]}`);
    else out.push(monthDayRule(rule.byMonthDay ?? a.d));
  } else if (rule.freq === 'yearly') {
    out.push(`BYMONTH=${rule.byMonth ?? a.m}`);
    out.push(monthDayRule(rule.byMonthDay ?? a.d));
  }
  if (rule.count) out.push(`COUNT=${rule.count}`);
  else if (rule.until) out.push(`UNTIL=${rule.until.replace(/-/g, '')}`);
  return out.join(';');
}

// ---------------------------------------------------------------------------
// Human description (rendered through translations)
// ---------------------------------------------------------------------------
export type RecurrenceSummary =
  | { kind: 'daily'; interval: number }
  | { kind: 'weekdays' }
  | { kind: 'weekends' }
  | { kind: 'weekly'; interval: number; days: number[] }
  | { kind: 'monthlyDay'; interval: number; day: number }
  | { kind: 'monthlyNth'; interval: number; pos: number; weekday: number }
  | { kind: 'yearly'; interval: number; month: number; day: number };

export function summarize(rule: RecurrenceRule): RecurrenceSummary {
  const a = parts(rule.anchor);
  switch (rule.freq) {
    case 'daily':
      return { kind: 'daily', interval: rule.interval };
    case 'weekly': {
      const days = [...new Set(rule.byWeekday?.length ? rule.byWeekday : [weekday(rule.anchor)])].sort();
      if (rule.interval === 1 && days.join() === '1,2,3,4,5') return { kind: 'weekdays' };
      if (rule.interval === 1 && days.join() === '0,6') return { kind: 'weekends' };
      return { kind: 'weekly', interval: rule.interval, days };
    }
    case 'monthly':
      if (rule.setPos && rule.byWeekday?.length) {
        return { kind: 'monthlyNth', interval: rule.interval, pos: rule.setPos, weekday: rule.byWeekday[0]! };
      }
      return { kind: 'monthlyDay', interval: rule.interval, day: rule.byMonthDay ?? a.d };
    case 'yearly':
      return { kind: 'yearly', interval: rule.interval, month: rule.byMonth ?? a.m, day: rule.byMonthDay ?? a.d };
  }
}
