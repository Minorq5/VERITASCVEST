/**
 * Calendar dates are plain "YYYY-MM-DD" strings in the task's (or person's)
 * time zone. Arithmetic runs on UTC midnights, so daylight-saving changes can
 * never shift a date.
 */
export type IsoDate = string;

const DAY_MS = 86_400_000;

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function parts(date: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return { y, m, d };
}

export function fromParts(y: number, m: number, d: number): IsoDate {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.toISOString().slice(0, 10);
}

export function toUtc(date: IsoDate): number {
  const { y, m, d } = parts(date);
  return Date.UTC(y, m - 1, d);
}

export function fromUtc(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Adds months keeping the day, clamped to the month's length (31 → 30 or 28/29). */
export function addMonths(date: IsoDate, months: number, keepDay?: number): IsoDate {
  const { y, m, d } = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fromParts(ny, nm, Math.min(keepDay ?? d, daysInMonth(ny, nm)));
}

export function addYears(date: IsoDate, years: number, keep?: { m: number; d: number }): IsoDate {
  const { y, m, d } = parts(date);
  const ny = y + years;
  const mm = keep?.m ?? m;
  return fromParts(ny, mm, Math.min(keep?.d ?? d, daysInMonth(ny, mm)));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: IsoDate): number {
  return new Date(toUtc(date)).getUTCDay();
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(a) - toUtc(b)) / DAY_MS);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

/** First day of the week containing `date` (weekStart: 0 Sunday, 1 Monday, 6 Saturday). */
export function startOfWeek(date: IsoDate, weekStart: number): IsoDate {
  const offset = (weekday(date) - weekStart + 7) % 7;
  return addDays(date, -offset);
}

export function startOfMonth(date: IsoDate): IsoDate {
  const { y, m } = parts(date);
  return fromParts(y, m, 1);
}

/** Today's date in a time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Local wall-clock "HH:MM" in a time zone. */
export function timeIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

/** Absolute moment of a local date + time in a time zone (inverse of the database trigger). */
export function zonedMoment(date: IsoDate, time: string | null | undefined, timeZone: string): Date {
  const [hh = '23', mm = '59', ss = time ? '00' : '59'] = (time ?? '23:59:59').split(':');
  const { y, m, d } = parts(date);
  const guess = Date.UTC(y, m - 1, d, Number(hh), Number(mm), Number(ss));
  // Two passes of "what is the offset at this instant" handle DST boundaries.
  let t = guess - offsetMs(guess, timeZone);
  t = guess - offsetMs(t, timeZone);
  return new Date(t);
}

function offsetMs(instant: number, timeZone: string): number {
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    return asUtc - Math.floor(instant / 1000) * 1000;
  } catch {
    return 0;
  }
}
