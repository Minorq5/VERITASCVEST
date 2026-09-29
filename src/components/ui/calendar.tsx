'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, addMonths, fromParts, parts, startOfMonth, weekday, type IsoDate } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';

interface CalendarProps {
  value: IsoDate | null;
  onChange: (date: IsoDate) => void;
  today: IsoDate;
  /** 0 Sunday, 1 Monday, 6 Saturday. */
  weekStart: number;
  locale: string;
  labels: { previous: string; next: string };
  /** Days that get a small dot (e.g. other deadlines). */
  marked?: ReadonlySet<IsoDate>;
  className?: string;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = locale + JSON.stringify(options);
  let f = fmtCache.get(key);
  if (!f) fmtCache.set(key, (f = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options })));
  return f;
}
const noon = (d: IsoDate) => {
  const p = parts(d);
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 12));
};

/**
 * Month grid with keyboard control (arrows, Page Up/Down, Home/End). Works on
 * calendar dates only, so time zones never shift a day.
 */
export function Calendar({ value, onChange, today, weekStart, locale, labels, marked, className }: CalendarProps) {
  const [month, setMonth] = useState<IsoDate>(() => startOfMonth(value ?? today));
  const [focus, setFocus] = useState<IsoDate>(value ?? today);
  const grid = useRef<HTMLDivElement>(null);
  const focusWithin = useRef(false);

  useEffect(() => {
    if (!focusWithin.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus();
  }, [focus, month]);

  const first = startOfMonth(month);
  const lead = (weekday(first) - weekStart + 7) % 7;
  const start = addDays(first, -lead);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const { m: monthNumber } = parts(month);
  const title = fmt(locale, { month: 'long', year: 'numeric' }).format(noon(fromParts(parts(month).y, monthNumber, 15))).replace(' г.', '');
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt(locale, { weekday: 'short' }).format(noon(addDays('2023-01-01', (weekStart + i) % 7))));

  const moveFocus = (next: IsoDate) => {
    setFocus(next);
    if (startOfMonth(next) !== startOfMonth(month)) setMonth(startOfMonth(next));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, () => IsoDate> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      PageUp: () => addMonths(focus, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, event.shiftKey ? 12 : 1),
      Home: () => addDays(focus, -((weekday(focus) - weekStart + 7) % 7)),
      End: () => addDays(focus, 6 - ((weekday(focus) - weekStart + 7) % 7)),
    };
    const go = map[event.key];
    if (!go) return;
    event.preventDefault();
    focusWithin.current = true;
    moveFocus(go());
  };

  return (
    <div className={cn('w-full select-none', className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label={labels.previous}
          onClick={() => setMonth(addMonths(month, -1))}
          className="focus-ring inline-flex size-8 items-center justify-center rounded-sm text-fg-2 hover-ok:bg-surface-3 hover-ok:text-fg"
        >
          <ChevronLeft aria-hidden className="size-4" />
        </button>
        <span className="text-sm font-medium text-fg first-letter:uppercase" aria-live="polite">
          {title}
        </span>
        <button
          type="button"
          aria-label={labels.next}
          onClick={() => setMonth(addMonths(month, 1))}
          className="focus-ring inline-flex size-8 items-center justify-center rounded-sm text-fg-2 hover-ok:bg-surface-3 hover-ok:text-fg"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      <div role="grid" aria-label={title} ref={grid} onKeyDown={onKeyDown} onFocus={() => (focusWithin.current = true)} onBlur={() => (focusWithin.current = false)}>
        <div role="row" className="grid grid-cols-7">
          {weekdays.map((name) => (
            <span key={name} role="columnheader" className="py-1 text-center font-mono text-[0.6875rem] tracking-[0.06em] text-fg-4 uppercase">
              {name.replace('.', '')}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, w) => (
          <div role="row" key={w} className="grid grid-cols-7">
            {days.slice(w * 7, w * 7 + 7).map((day) => {
              const inMonth = parts(day).m === monthNumber;
              const selected = day === value;
              const isToday = day === today;
              const past = day < today;
              return (
                <span role="gridcell" key={day} aria-selected={selected} className="flex items-center justify-center p-0.5">
                  <button
                    type="button"
                    data-date={day}
                    tabIndex={day === focus ? 0 : -1}
                    onClick={() => {
                      setFocus(day);
                      onChange(day);
                    }}
                    aria-label={fmt(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(noon(day))}
                    aria-current={isToday ? 'date' : undefined}
                    className={cn(
                      'focus-ring relative inline-flex size-9 items-center justify-center rounded-sm font-mono text-sm tabular transition-colors duration-150',
                      selected
                        ? 'bg-accent font-medium text-accent-ink'
                        : isToday
                          ? 'text-accent ring-1 ring-[color-mix(in_oklab,var(--accent)_55%,transparent)] ring-inset hover-ok:bg-surface-3'
                          : inMonth
                            ? past
                              ? 'text-fg-3 hover-ok:bg-surface-3 hover-ok:text-fg'
                              : 'text-fg hover-ok:bg-surface-3'
                            : 'text-fg-4 hover-ok:bg-surface-3',
                    )}
                  >
                    {parts(day).d}
                    {marked?.has(day) && !selected && <span aria-hidden className="absolute bottom-1 h-px w-2 bg-accent" />}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
