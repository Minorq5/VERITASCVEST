import { presets, alignAnchor, type RecurrenceRule } from '@/lib/domain/recurrence';
import {
  addDays,
  addMonths,
  addYears,
  daysInMonth,
  fromParts,
  parts,
  startOfWeek,
  weekday,
  type IsoDate,
} from '@/lib/time/dates';
import { lexicons, type Lexicon, type QuickLocale } from './lexicon';

/**
 * The smart input: "Сходить в зал завтра в 18:00 #спорт !высокий" →
 * title "Сходить в зал", due tomorrow 18:00, tag "спорт", priority high.
 *
 * Every recognised fragment is a token with its position in the original
 * text, so the input can highlight it as a chip; a chip the person clicks
 * away is passed back in `disabled` and stays plain text.
 */

export type TokenKind =
  | 'date'
  | 'start'
  | 'due'
  | 'time'
  | 'repeat'
  | 'tag'
  | 'priority'
  | 'project'
  | 'assignee'
  | 'estimate'
  | 'reminder'
  | 'hint';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface Token {
  kind: TokenKind;
  start: number;
  end: number;
  text: string;
  /** Stable identity for "the person turned this chip off". */
  key: string;
  date?: IsoDate;
  /** Set when the date came from a weekday name (so "до пятницы" can follow "с понедельника"). */
  weekday?: number;
  time?: string;
  rule?: RecurrenceRule;
  name?: string;
  priority?: Priority;
  minutes?: number;
  hint?: { type: 'numeric' | 'counter'; target: number; unit: string };
}

export interface QuickAddContext {
  locale: QuickLocale;
  today: IsoDate;
  /** Current local time "HH:MM" (a bare time already past today means tomorrow). */
  nowTime: string;
  weekStart: number;
  disabled?: ReadonlySet<string>;
}

export interface QuickAddResult {
  title: string;
  tokens: Token[];
  dueDate: IsoDate | null;
  dueTime: string | null;
  startDate: IsoDate | null;
  startTime: string | null;
  recurrence: RecurrenceRule | null;
  tags: string[];
  priority: Priority | null;
  project: string | null;
  assignees: string[];
  estimateMinutes: number | null;
  reminders: number[];
  hint: Token['hint'] | null;
}

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------
const W = '\\p{L}\\p{N}_';
const START = `(?<![${W}])`;
const END = `(?![${W}])`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (words: readonly string[]) =>
  [...words].sort((a, b) => b.length - a.length).map((w) => escape(w).replace(/ /g, '\\s+')).join('|');

const re = (source: string) => new RegExp(source, 'giu');

interface Candidate extends Omit<Token, 'key'> {
  weight: number;
}

type Maker = (m: RegExpExecArray) => Omit<Candidate, 'start' | 'end' | 'text' | 'weight'> | null;

interface Matcher {
  regex: RegExp;
  make: Maker;
  weight?: number;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function validDate(y: number, m: number, d: number): IsoDate | null {
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return fromParts(y, m, d);
}

/** A day/month without a year: this year, or next year if it already passed. */
function futureDate(today: IsoDate, month: number, day: number, year?: number): IsoDate | null {
  if (year) return validDate(year, month, day);
  const t = parts(today);
  const thisYear = validDate(t.y, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return validDate(t.y + 1, month, day);
}

function indexOfForm(groups: readonly (readonly string[])[], word: string): number {
  const w = word.toLocaleLowerCase();
  return groups.findIndex((forms) => forms.includes(w));
}

function upcomingWeekday(today: IsoDate, wd: number): IsoDate {
  return addDays(today, (wd - weekday(today) + 7) % 7);
}

function nextWeeksWeekday(today: IsoDate, wd: number, weekStart: number): IsoDate {
  return addDays(startOfWeek(today, weekStart), 7 + ((wd - weekStart + 7) % 7));
}

function hourFrom(hour: number, minute: number, suffix: string | undefined): string | null {
  let h = hour;
  switch (suffix) {
    case 'pm':
      if (h < 12) h += 12;
      break;
    case 'am':
      if (h === 12) h = 0;
      break;
    case 'day':
      if (h >= 1 && h <= 6) h += 12; // "в 3 дня" → 15:00
      break;
    case 'night':
      if (h === 12) h = 0; // "в 12 ночи"
      break;
  }
  if (h > 23 || minute > 59) return null;
  return `${pad(h)}:${pad(minute)}`;
}

// ---------------------------------------------------------------------------
// Matchers
// ---------------------------------------------------------------------------
function buildMatchers(lex: Lexicon, ctx: QuickAddContext): Matcher[] {
  const { today, weekStart } = ctx;
  const weekdayForms = lex.weekdays.flat();
  const monthForms = lex.months.flat();
  const numberWords = Object.keys(lex.numberWords);
  const count = (raw: string | undefined) => {
    if (!raw) return 1;
    const n = Number(raw);
    return Number.isFinite(n) ? n : (lex.numberWords[raw.toLocaleLowerCase()] ?? 1);
  };
  const on = lex.onWords.length ? `(?:(?:${alt(lex.onWords)})\\s+)?` : '';
  const next = `(?:(${alt(lex.nextWords)})\\s+)?`;
  const at = `(?:(?:${alt(lex.atWords)})\\s+)?`;
  const units = [...lex.unitDay, ...lex.unitWeek, ...lex.unitMonth, ...lex.unitYear];
  const unitKind = (u: string) => {
    const w = u.toLocaleLowerCase();
    if (lex.unitDay.includes(w)) return 'day';
    if (lex.unitWeek.includes(w)) return 'week';
    if (lex.unitMonth.includes(w)) return 'month';
    return 'year';
  };
  const shift = (unit: string, n: number): IsoDate => {
    switch (unitKind(unit)) {
      case 'day':
        return addDays(today, n);
      case 'week':
        return addDays(today, 7 * n);
      case 'month':
        return addMonths(today, n);
      default:
        return addYears(today, n);
    }
  };
  const ruleFor = (unit: string, interval: number, anchor: IsoDate): RecurrenceRule => {
    switch (unitKind(unit)) {
      case 'day':
        return presets.daily(anchor, interval);
      case 'week':
        return { freq: 'weekly', interval, byWeekday: [weekday(anchor)], mode: 'schedule', anchor };
      case 'month':
        return { freq: 'monthly', interval, mode: 'schedule', anchor };
      default:
        return presets.yearly(anchor, interval);
    }
  };
  // Split on anything that is not a letter: "и" inside "вторник" must not split the word.
  const daysFrom = (text: string, groups: readonly (readonly string[])[]) =>
    [...new Set(
      text
        .toLocaleLowerCase()
        .split(/[^\p{L}]+/u)
        .map((w) => indexOfForm(groups, w))
        .filter((i) => i >= 0),
    )];

  const m: Matcher[] = [];

  // --- universal markers --------------------------------------------------
  m.push({
    regex: re(`(?<![${W}#])#([\\p{L}\\p{N}_][\\p{L}\\p{N}_-]{0,39})`),
    make: (x) => ({ kind: 'tag', name: x[1]! }),
  });
  m.push({
    regex: re(`(?<![${W}!])!(1|2|3|4|${alt(Object.keys(lex.priorities))})${END}`),
    make: (x) => {
      const raw = x[1]!.toLocaleLowerCase();
      const byDigit: Record<string, Priority> = { '1': 'critical', '2': 'high', '3': 'medium', '4': 'low' };
      const priority = byDigit[raw] ?? lex.priorities[raw];
      return priority ? { kind: 'priority', priority } : null;
    },
  });
  m.push({
    regex: re(`(?<![${W}+])\\+(?:"([^"]{1,120})"|([\\p{L}\\p{N}_][\\p{L}\\p{N}_-]{0,59}))`),
    make: (x) => ({ kind: 'project', name: (x[1] ?? x[2])!.trim() }),
  });
  m.push({
    regex: re(`(?<![${W}.@])@([a-z][a-z0-9_]{2,23})${END}`),
    make: (x) => ({ kind: 'assignee', name: x[1]!.toLowerCase() }),
  });
  m.push({
    // "~1ч30м": digits may follow the hour unit directly.
    regex: re(`~\\s?(?:(\\d+(?:[.,]\\d+)?)\\s?(${alt(lex.hourUnits)})(?!\\p{L}))?\\s?(?:(\\d+)\\s?(${alt(lex.minuteUnits)})${END})?`),
    make: (x) => {
      if (!x[1] && !x[3]) return null;
      const hours = x[1] ? Number(x[1].replace(',', '.')) : 0;
      const minutes = Math.round(hours * 60 + (x[3] ? Number(x[3]) : 0));
      return minutes > 0 && minutes <= 100000 ? { kind: 'estimate', minutes } : null;
    },
  });
  m.push({
    regex: new RegExp(lex.remind.source, 'giu'),
    make: (x) => {
      const raw = x[1]!.toLocaleLowerCase();
      const unit = (x[2] ?? '').toLocaleLowerCase();
      let minutes: number;
      if (raw === 'полчаса') minutes = 30;
      else if (raw === 'час') minutes = 60;
      else if (raw === 'день' || raw === 'сутки') minutes = 1440;
      else {
        const n = Number(raw);
        if (/^(h|hr|hrs?|hours?|ч|час|часа|часов)$/u.test(unit)) minutes = n * 60;
        else if (/^(d|days?|дн|дня|дней|день|сутки|дни|ден)$/u.test(unit)) minutes = n * 1440;
        else minutes = n;
      }
      return minutes > 0 && minutes <= 60 * 24 * 60 ? { kind: 'reminder', minutes } : null;
    },
  });

  // --- dates ------------------------------------------------------------------
  m.push({
    regex: re(`${START}(\\d{4})-(\\d{2})-(\\d{2})${END}`),
    make: (x) => {
      const date = validDate(Number(x[1]), Number(x[2]), Number(x[3]));
      return date ? { kind: 'date', date } : null;
    },
  });
  m.push({
    // 15.03 · 2.05 · 15/03/2027 (a single-digit month needs a year: "2.5" is a number).
    regex: re(`(?<![\\d.,/])(\\d{1,2})[./](\\d{2}|\\d)(?:[./](\\d{4}|\\d{2}))?(?![\\d./,]|${'\\p{L}'})`),
    make: (x) => {
      if (x[2]!.length === 1 && !x[3]) return null;
      const year = x[3] ? (x[3].length === 2 ? 2000 + Number(x[3]) : Number(x[3])) : undefined;
      const date = futureDate(today, Number(x[2]), Number(x[1]), year);
      return date ? { kind: 'date', date } : null;
    },
  });
  m.push({
    regex: re(`${START}${alt(lex.afterTomorrow)}${END}`),
    make: () => ({ kind: 'date', date: addDays(today, 2) }),
    weight: 2,
  });
  m.push({ regex: re(`${START}(?:${alt(lex.today)})${END}`), make: () => ({ kind: 'date', date: today }) });
  m.push({ regex: re(`${START}(?:${alt(lex.tomorrow)})${END}`), make: () => ({ kind: 'date', date: addDays(today, 1) }) });
  m.push({
    regex: re(`${START}${on}${next}(${alt(weekdayForms)})${END}`),
    make: (x) => {
      const wd = indexOfForm(lex.weekdays, x[2]!);
      if (wd < 0) return null;
      return { kind: 'date', weekday: wd, date: x[1] ? nextWeeksWeekday(today, wd, weekStart) : upcomingWeekday(today, wd) };
    },
  });
  if (lex.weekdaysDative) {
    m.push({
      regex: re(`${START}к\\s+(${alt(lex.weekdaysDative.flat())})${END}`),
      make: (x) => {
        const wd = indexOfForm(lex.weekdaysDative!, x[1]!);
        return wd < 0 ? null : { kind: 'due', weekday: wd, date: upcomingWeekday(today, wd) };
      },
    });
  }
  m.push({
    regex: re(`${START}(\\d{1,2})(?:-?(?:го|е|ти|st|nd|rd|th))?\\s+(${alt(monthForms)})(?:\\s+(\\d{4}))?${END}`),
    make: (x) => {
      const month = indexOfForm(lex.months, x[2]!) + 1;
      const date = month ? futureDate(today, month, Number(x[1]), x[3] ? Number(x[3]) : undefined) : null;
      return date ? { kind: 'date', date } : null;
    },
  });
  m.push({
    regex: re(`${START}(${alt(monthForms)})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?${END}`),
    make: (x) => {
      const month = indexOfForm(lex.months, x[1]!) + 1;
      const date = month ? futureDate(today, month, Number(x[2]), x[3] ? Number(x[3]) : undefined) : null;
      return date ? { kind: 'date', date } : null;
    },
  });
  m.push({
    regex: re(`${START}(?:${alt(lex.inWords)})\\s+(?:(\\d{1,3}|${alt(numberWords)})\\s+)?(${alt(units)})${END}`),
    make: (x) => ({ kind: 'date', date: shift(x[2]!, count(x[1])) }),
  });
  m.push({
    regex: re(`${START}(?:${alt(lex.weekend)})${END}`),
    make: () => {
      const wd = weekday(today);
      return { kind: 'date', date: wd === 6 || wd === 0 ? today : upcomingWeekday(today, 6) };
    },
  });
  m.push({ regex: re(`${START}(?:${alt(lex.nextWeek)})${END}`), make: () => ({ kind: 'date', date: addDays(startOfWeek(today, weekStart), 7) }) });
  m.push({
    regex: re(`${START}(?:${alt(lex.nextMonth)})${END}`),
    make: () => {
      const n = addMonths(today, 1);
      return { kind: 'date', date: fromParts(parts(n).y, parts(n).m, 1) };
    },
  });

  // --- times ------------------------------------------------------------------
  m.push({
    regex: re(`${START}${at}([01]?\\d|2[0-3]):([0-5]\\d)(?:\\s?(${alt(Object.keys(lex.hourSuffix))})${END})?(?![\\d:])`),
    make: (x) => {
      const time = hourFrom(Number(x[1]), Number(x[2]), x[3] ? lex.hourSuffix[x[3].toLocaleLowerCase()] : undefined);
      return time ? { kind: 'time', time } : null;
    },
  });
  m.push({
    regex: re(`${START}${at}(\\d{1,2})\\s?(${alt(Object.keys(lex.hourSuffix))})${END}`),
    make: (x) => {
      const suffix = lex.hourSuffix[x[2]!.toLocaleLowerCase()];
      // "3 дня" alone is a duration ("отпуск 3 дня"); only "в 3 дня" is a time.
      if (suffix === 'day' && !new RegExp(`^(?:${alt(lex.atWords)})\\s`, 'iu').test(x[0])) return null;
      const time = hourFrom(Number(x[1]), 0, suffix);
      return time ? { kind: 'time', time } : null;
    },
  });
  if (lex.atWords.length) {
    // A bare hour ("в 9") only at the end or before another marker, so "в 9 классе" stays text.
    m.push({
      regex: re(`${START}(?:${alt(lex.atWords)})\\s+([01]?\\d|2[0-3])(?=\\s*$|\\s*[,.;!#+@~])`),
      make: (x) => ({ kind: 'time', time: `${pad(Number(x[1]))}:00` }),
    });
  }
  m.push({
    regex: re(`${START}${at}(${alt(Object.keys(lex.timeOfDay))})${END}`),
    make: (x) => {
      const key = Object.keys(lex.timeOfDay).find((k) => new RegExp(`^${alt([k])}$`, 'iu').test(x[1]!));
      return key ? { kind: 'time', time: lex.timeOfDay[key]! } : null;
    },
    weight: -1,
  });

  // --- repeats ------------------------------------------------------------------
  const anchorOf = (rule: RecurrenceRule) => alignAnchor(rule, today, weekStart);
  m.push({ regex: re(`${START}(?:${alt(lex.everyDay)})${END}`), make: () => ({ kind: 'repeat', rule: presets.daily(today) }), weight: 3 });
  m.push({
    regex: re(`${START}(?:${alt(lex.weekdaysRepeat)})${END}`),
    make: () => ({ kind: 'repeat', rule: anchorOf(presets.weekdays(today)) }),
    weight: 3,
  });
  m.push({
    regex: re(`${START}(?:${alt(lex.weekendsRepeat)})${END}`),
    make: () => ({ kind: 'repeat', rule: anchorOf(presets.weekends(today)) }),
    weight: 3,
  });
  m.push({
    regex: re(`${START}(?:${alt(lex.everyWeek)})${END}`),
    make: () => ({ kind: 'repeat', rule: presets.weekly(today, [weekday(today)]) }),
    weight: 3,
  });
  m.push({
    regex: re(`${START}(?:${alt(lex.everyMonth)})${END}`),
    make: () => ({ kind: 'repeat', rule: { freq: 'monthly', interval: 1, mode: 'schedule', anchor: today } }),
    weight: 3,
  });
  m.push({ regex: re(`${START}(?:${alt(lex.everyYear)})${END}`), make: () => ({ kind: 'repeat', rule: presets.yearly(today) }), weight: 3 });
  const dayList = (forms: string) => `(?:${forms})(?:\\s*(?:${alt(lex.and)})\\s*(?:${forms}))*`;
  m.push({
    regex: re(`${START}(?:${alt(lex.every)})\\s+(${dayList(alt(weekdayForms))})${END}`),
    make: (x) => {
      const days = daysFrom(x[1]!, lex.weekdays);
      return days.length ? { kind: 'repeat', rule: anchorOf(presets.weekly(today, days)) } : null;
    },
    weight: 3,
  });
  if (lex.weekdayPlurals) {
    m.push({
      regex: re(`${START}по\\s+(${dayList(alt(lex.weekdayPlurals.flat()))})${END}`),
      make: (x) => {
        const days = daysFrom(x[1]!, lex.weekdayPlurals!);
        return days.length ? { kind: 'repeat', rule: anchorOf(presets.weekly(today, days)) } : null;
      },
      weight: 3,
    });
  }
  m.push({
    regex: re(`${START}(?:на\\s+)?(?:${alt(lex.every)})\\s+(\\d{1,3}|${alt(numberWords)})\\s+(${alt(units)})${END}`),
    make: (x) => ({ kind: 'repeat', rule: ruleFor(x[2]!, count(x[1]), today) }),
    weight: 3,
  });
  if (lex.everyOther.length) {
    m.push({
      regex: re(`${START}(?:${alt(lex.everyOther)})\\s+(${alt(units)})${END}`),
      make: (x) => ({ kind: 'repeat', rule: ruleFor(x[1]!, 2, today) }),
      weight: 3,
    });
  }
  if (lex.monthDayWords.length) {
    m.push({
      regex: re(`${START}(?:${alt(lex.every)})\\s+(\\d{1,2})(?:-?(?:е|го|о|то|ти))?\\s+(?:${alt(lex.monthDayWords)})${END}`),
      make: (x) => monthDayRepeat(Number(x[1])),
      weight: 3,
    });
    m.push({
      regex: re(`${START}(\\d{1,2})(?:-?го)?\\s+числа\\s+каждого\\s+месяца${END}`),
      make: (x) => monthDayRepeat(Number(x[1])),
      weight: 3,
    });
  } else {
    m.push({
      regex: re(`${START}(?:${alt(lex.every)})\\s+(\\d{1,2})(?:st|nd|rd|th)${END}`),
      make: (x) => monthDayRepeat(Number(x[1])),
      weight: 3,
    });
  }
  function monthDayRepeat(day: number) {
    if (day < 1 || day > 31) return null;
    const rule: RecurrenceRule = presets.monthlyOnDay(today, day);
    return { kind: 'repeat' as const, rule: anchorOf(rule) };
  }

  // --- type hints (the text stays in the title) ---------------------------------
  m.push({
    regex: re(`${START}(\\d{1,6}(?:[.,]\\d+)?)\\s+(${alt(lex.numericUnits)})${END}`),
    make: (x) => ({ kind: 'hint', hint: { type: 'numeric', target: Number(x[1]!.replace(',', '.')), unit: x[2]!.toLocaleLowerCase() } }),
    weight: -5,
  });
  m.push({
    regex: re(`${START}(\\d{1,4})\\s+(${alt(lex.counterUnits)})${END}`),
    make: (x) => ({ kind: 'hint', hint: { type: 'counter', target: Number(x[1]), unit: x[2]!.toLocaleLowerCase() } }),
    weight: -5,
  });

  return m;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
const SINGLE: readonly TokenKind[] = ['date', 'start', 'due', 'time', 'repeat', 'priority', 'project', 'estimate', 'hint'];

function tokenKey(kind: TokenKind, text: string, occurrence: number) {
  return `${kind}:${text.toLocaleLowerCase().replace(/\s+/g, ' ')}:${occurrence}`;
}

export function parseQuickAdd(input: string, ctx: QuickAddContext): QuickAddResult {
  const lexs = ctx.locale === 'en' ? [lexicons.en] : [lexicons[ctx.locale], lexicons.en];
  const candidates: Candidate[] = [];
  lexs.forEach((lex, li) => {
    for (const matcher of buildMatchers(lex, ctx)) {
      matcher.regex.lastIndex = 0;
      let x: RegExpExecArray | null;
      while ((x = matcher.regex.exec(input))) {
        if (x[0].length === 0) {
          matcher.regex.lastIndex += 1;
          continue;
        }
        const made = matcher.make(x);
        if (made) {
          candidates.push({
            ...made,
            start: x.index,
            end: x.index + x[0].length,
            text: x[0],
            // The person's own language wins ties with English.
            weight: (matcher.weight ?? 0) - li,
          });
        }
      }
    }
  });

  // Keys count earlier occurrences of the same text, so turning off one "завтра" keeps others.
  const withKeys = candidates
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || b.weight - a.weight)
    .map((c) => {
      const occurrence = candidates.filter((o) => o.kind === c.kind && o.start < c.start && o.text.toLocaleLowerCase() === c.text.toLocaleLowerCase()).length;
      return { ...c, key: tokenKey(c.kind, c.text, occurrence) };
    })
    .filter((c) => !ctx.disabled?.has(c.key));

  // Longest match first at each position; tokens never overlap.
  const chosen: (Token & { weight: number })[] = [];
  for (const c of withKeys) {
    if (chosen.some((t) => c.start < t.end && t.start < c.end)) continue;
    chosen.push(c);
  }
  chosen.sort((a, b) => a.start - b.start);

  // "с понедельника" / "до пятницы": a date right after a from/by word becomes start/due.
  const lex = lexicons[ctx.locale];
  const from = new RegExp(`(?:^|\\s)(?:${alt([...lex.fromWords, ...lexicons.en.fromWords])})\\s+$`, 'iu');
  const by = new RegExp(`(?:^|\\s)(?:${alt([...lex.byWords, ...lexicons.en.byWords])})\\s+$`, 'iu');
  for (const t of chosen) {
    if (t.kind !== 'date') continue;
    const before = input.slice(0, t.start);
    const previous = chosen.filter((o) => o.end <= t.start).at(-1);
    const gapStart = previous ? previous.end : 0;
    for (const [pattern, kind] of [[from, 'start'], [by, 'due']] as const) {
      const hit = pattern.exec(before);
      if (!hit) continue;
      const wordStart = before.length - hit[0].trimStart().length;
      if (wordStart < gapStart) continue;
      t.kind = kind;
      t.start = wordStart;
      t.text = input.slice(wordStart, t.end);
      t.key = tokenKey(kind, t.text, 0);
      break;
    }
  }

  // One of each single-valued kind: later duplicates stay as text.
  const seen = new Set<TokenKind>();
  const tokens: Token[] = [];
  for (const t of chosen) {
    const bucket: TokenKind = t.kind === 'date' || t.kind === 'due' ? 'due' : t.kind;
    if (SINGLE.includes(t.kind) && seen.has(bucket)) continue;
    seen.add(bucket);
    const { weight: _w, ...token } = t;
    tokens.push(token);
  }

  return assemble(input, tokens, ctx);
}

function assemble(input: string, tokens: Token[], ctx: QuickAddContext): QuickAddResult {
  const result: QuickAddResult = {
    title: '',
    tokens,
    dueDate: null,
    dueTime: null,
    startDate: null,
    startTime: null,
    recurrence: null,
    tags: [],
    priority: null,
    project: null,
    assignees: [],
    estimateMinutes: null,
    reminders: [],
    hint: null,
  };

  let timeToken: Token | undefined;
  for (const t of tokens) {
    switch (t.kind) {
      case 'date':
      case 'due':
        result.dueDate = t.date ?? null;
        break;
      case 'start':
        result.startDate = t.date ?? null;
        break;
      case 'time':
        timeToken = t;
        break;
      case 'repeat':
        result.recurrence = t.rule ?? null;
        break;
      case 'tag':
        if (t.name && !result.tags.some((x) => x.toLocaleLowerCase() === t.name!.toLocaleLowerCase())) result.tags.push(t.name);
        break;
      case 'priority':
        result.priority = t.priority ?? null;
        break;
      case 'project':
        result.project = t.name ?? null;
        break;
      case 'assignee':
        if (t.name && !result.assignees.includes(t.name)) result.assignees.push(t.name);
        break;
      case 'estimate':
        result.estimateMinutes = t.minutes ?? null;
        break;
      case 'reminder':
        if (t.minutes && !result.reminders.includes(t.minutes)) result.reminders.push(t.minutes);
        break;
      case 'hint':
        result.hint = t.hint ?? null;
        break;
    }
  }

  if (timeToken?.time) {
    const startToken = tokens.find((t) => t.kind === 'start');
    const nearStart = startToken && timeToken.start >= startToken.end && timeToken.start - startToken.end <= 2;
    if (nearStart) {
      result.startTime = timeToken.time;
    } else {
      result.dueTime = timeToken.time;
      if (!result.dueDate && !result.recurrence) {
        // A bare time: today, or tomorrow when that time has already passed.
        result.dueDate = timeToken.time > ctx.nowTime ? ctx.today : addDays(ctx.today, 1);
      }
    }
  }

  if (result.recurrence) {
    // The series starts at the given date (or start date), moved to the first matching day.
    const from = result.dueDate ?? result.startDate;
    if (from) result.recurrence = alignAnchor(result.recurrence, from, ctx.weekStart);
    result.dueDate = result.recurrence.anchor;
  }
  if (result.startDate && result.dueDate && result.startDate > result.dueDate) {
    // "с понедельника до пятницы": the Friday after that Monday.
    const due = tokens.find((t) => t.kind === 'due' || t.kind === 'date');
    if (due?.weekday != null) {
      result.dueDate = addDays(result.startDate, (due.weekday - weekday(result.startDate) + 7) % 7);
    } else {
      result.startDate = result.dueDate;
    }
  }

  // The title is everything that was not recognised (type hints stay in it).
  let title = '';
  let cursor = 0;
  for (const t of tokens) {
    if (t.kind === 'hint') continue;
    title += `${input.slice(cursor, t.start)} `;
    cursor = t.end;
  }
  title += input.slice(cursor);
  result.title = title
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim();
  return result;
}
