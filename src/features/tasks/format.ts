import type { RecurrenceRule } from '@/lib/domain/recurrence';
import { summarize } from '@/lib/domain/recurrence';
import { addDays, diffDays, parts, type IsoDate } from '@/lib/time/dates';

/**
 * Human wording for dates, times, durations and repeat rules in the three
 * interface languages. Dates are calendar days (no time zone shifts): they are
 * formatted at noon UTC with the UTC zone.
 */

// Any next-intl translator (their key types differ per namespace).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Translate = (...args: any[]) => string;

const formatters = new Map<string, Intl.DateTimeFormat>();

function dtf(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, f);
  }
  return f;
}

const noon = (date: IsoDate) => {
  const { y, m, d } = parts(date);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

/** "5 окт", "Oct 5"; the year is added when it is not the current one. */
export function formatShortDate(date: IsoDate, locale: string, today: IsoDate): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return dtf(locale, { day: 'numeric', month: 'short', timeZone: 'UTC', ...(sameYear ? {} : { year: 'numeric' }) })
    .format(noon(date))
    .replace(/\s*г\.?$/, '')
    .replace(/\.$/, '');
}

/** "четверг, 2 октября" — list group headers. */
export function formatLongDate(date: IsoDate, locale: string, today: IsoDate): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return dtf(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
    .format(noon(date))
    .replace(' г.', '');
}

export function weekdayName(date: IsoDate, locale: string, width: 'long' | 'short' = 'long'): string {
  return dtf(locale, { weekday: width, timeZone: 'UTC' }).format(noon(date));
}

/** Weekday names 0 = Sunday … 6 = Saturday. */
export function weekdayNames(locale: string, width: 'long' | 'short' | 'narrow' = 'short'): string[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => dtf(locale, { weekday: width, timeZone: 'UTC' }).format(noon(`2023-01-0${i + 1}`)));
}

export function monthTitle(year: number, month: number, locale: string): string {
  const text = dtf(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 15)));
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1).replace(' г.', '');
}

/** "18:00" or "6:00 PM" from "18:00:00". */
export function formatTime(time: string, locale: string, hour12: boolean): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return dtf(locale, { hour: 'numeric', minute: '2-digit', hour12, timeZone: 'UTC' }).format(new Date(Date.UTC(2020, 0, 1, h, m)));
}

export function formatClock(date: Date, locale: string, hour12: boolean, timeZone: string): string {
  return dtf(locale, { hour: 'numeric', minute: '2-digit', hour12, timeZone }).format(date);
}

/** A day relative to today: "Сегодня", "Завтра", "Вчера", a weekday this week, or a short date. */
export function relativeDay(date: IsoDate, today: IsoDate, locale: string, t: Translate): string {
  const diff = diffDays(date, today);
  if (diff === 0) return t('dates.today');
  if (diff === 1) return t('dates.tomorrow');
  if (diff === -1) return t('dates.yesterday');
  if (diff > 1 && diff < 7) {
    const name = weekdayName(date, locale);
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  }
  return formatShortDate(date, locale, today);
}

/** Group headers for completed and weekly lists: "Сегодня", "Вчера", "Завтра" or "четверг, 2 октября". */
export function dayHeader(date: IsoDate, today: IsoDate, locale: string, t: Translate): string {
  const diff = diffDays(date, today);
  if (diff === 0) return t('groups.today');
  if (diff === -1) return t('groups.yesterday');
  if (diff === 1) return t('groups.tomorrow');
  const text = formatLongDate(date, locale, today);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later';

export function dueTone(date: IsoDate, today: IsoDate, overdue: boolean): DueTone {
  if (overdue) return 'overdue';
  const diff = diffDays(date, today);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'soon';
  return 'later';
}

/** "~1 ч 30 мин" style estimate. */
export function formatDuration(minutes: number, t: Translate): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return t('duration.minutes', { m });
  if (m === 0) return t('duration.hours', { h });
  return t('duration.hoursMinutes', { h, m });
}

/** Timer display "1:05:09" / "25:00". */
export function formatStopwatch(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}

/** Compact number: 1 234,5 in Russian, 1,234.5 in English. */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

// ---------------------------------------------------------------------------
// Repeat rules
// ---------------------------------------------------------------------------
interface RecurrenceWords {
  t: Translate;
  /** The `tasks.recurrence` messages as raw arrays (weekday names in the accusative, their gender). */
  weekdaysAcc: string[];
  weekdayGender: string[];
  locale: string;
  weekStart: number;
}

export function describeRecurrence(rule: RecurrenceRule, w: RecurrenceWords): string {
  const { t, locale } = w;
  const s = summarize(rule);
  const n = rule.interval;
  let text: string;
  if (rule.mode === 'completion') {
    const unit = t(`recurrence.completionUnit.${rule.freq}`, { n });
    text = t('recurrence.summary.afterCompletion', { n, unit });
  } else {
    switch (s.kind) {
      case 'daily':
        text = t('recurrence.summary.daily', { n });
        break;
      case 'weekdays':
        text = t('recurrence.summary.weekdays');
        break;
      case 'weekends':
        text = t('recurrence.summary.weekends');
        break;
      case 'weekly': {
        const names = weekdayNames(locale, 'short');
        const ordered = [...s.days].sort((a, b) => ((a - w.weekStart + 7) % 7) - ((b - w.weekStart + 7) % 7));
        text = t('recurrence.summary.weekly', { n, days: ordered.map((d) => names[d]).join(', ') });
        break;
      }
      case 'monthlyDay':
        text = s.day === -1 ? t('recurrence.summary.monthlyLast', { n }) : t('recurrence.summary.monthlyDay', { n, day: s.day });
        break;
      case 'monthlyNth': {
        const nth = t('recurrence.summary.nth', {
          pos: String(s.pos),
          g: w.weekdayGender[s.weekday] ?? 'm',
          weekday: w.weekdaysAcc[s.weekday] ?? '',
        });
        text = t('recurrence.summary.monthlyNth', { n, nth });
        break;
      }
      case 'yearly': {
        const date = dtf(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
          new Date(Date.UTC(2024, s.month - 1, Math.min(s.day === -1 ? 28 : s.day, 29), 12)),
        );
        text = t('recurrence.summary.yearly', { n, date });
        break;
      }
    }
  }
  const extras: string[] = [];
  if (rule.until) extras.push(t('recurrence.summary.until', { date: formatShortDate(rule.until, locale, rule.anchor) }));
  if (rule.count) extras.push(t('recurrence.summary.times', { n: rule.count }));
  return extras.length ? `${text}, ${extras.join(', ')}` : text;
}

/** Monday (or the chosen week start) after `today`, for "next week". */
export function nextWeekStart(today: IsoDate, weekStart: number): IsoDate {
  const { y, m, d } = parts(today);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const ahead = (weekStart - day + 7) % 7 || 7;
  return addDays(today, ahead);
}

/** Saturday of this week (or today when it is the weekend). */
export function thisWeekend(today: IsoDate): IsoDate {
  const { y, m, d } = parts(today);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (day === 6 || day === 0) return today;
  return addDays(today, 6 - day);
}
