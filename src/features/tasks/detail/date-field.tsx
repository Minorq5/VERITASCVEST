'use client';

import { CalendarRange, CalendarX2, Clock, Sun, Sunrise, TreePalm, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { addDays, type IsoDate } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import type { PlannerPrefs } from '../data/hooks';
import { dueTone, formatTime, nextWeekStart, relativeDay, thisWeekend } from '../format';
import { valueButton } from './property-row';

const toneClass = { overdue: 'text-danger', today: 'text-fg', soon: 'text-warning', later: 'text-fg' } as const;

/** A date with an optional time, picked from quick choices or the calendar. */
export function DateField({
  date,
  time,
  onChange,
  today,
  prefs,
  overdue,
  placeholder,
  icon,
}: {
  date: IsoDate | null;
  time: string | null;
  onChange: (date: IsoDate | null, time: string | null) => void;
  today: IsoDate;
  prefs: PlannerPrefs;
  overdue?: boolean;
  placeholder: string;
  icon?: ReactNode;
}) {
  const t = useTranslations('tasks');
  const [open, setOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(time?.slice(0, 5) ?? '');
  const label = date
    ? [relativeDay(date, today, prefs.locale, t), time ? formatTime(time, prefs.locale, prefs.hour12) : null].filter(Boolean).join(', ')
    : placeholder;
  const tone = date ? dueTone(date, today, Boolean(overdue)) : null;

  const pick = (next: IsoDate | null) => {
    onChange(next, next ? (draftTime ? `${draftTime}:00` : null) : null);
    setOpen(false);
  };

  const quick: [ReactNode, string, IsoDate][] = [
    [<Sun key="t" aria-hidden />, t('dates.today'), today],
    [<Sunrise key="m" aria-hidden />, t('dates.tomorrow'), addDays(today, 1)],
    [<CalendarRange key="w" aria-hidden />, t('dates.nextWeek'), nextWeekStart(today, prefs.weekStart)],
    [<TreePalm key="e" aria-hidden />, t('dates.weekend'), thisWeekend(today)],
  ];

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraftTime(time?.slice(0, 5) ?? '');
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={cn(valueButton, date ? toneClass[tone ?? 'later'] : 'text-fg-3')}>
          {icon}
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[19.5rem] p-3">
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {quick.map(([ic, text, value]) => (
            <button
              key={text}
              type="button"
              onClick={() => pick(value)}
              className={cn(
                'focus-ring flex h-8 items-center gap-2 rounded-sm border px-2.5 text-sm transition-colors [&_svg]:size-4 [&_svg]:text-fg-3',
                date === value ? 'border-accent bg-surface-3 text-fg' : 'border-line-strong text-fg-2 hover-ok:bg-surface-3 hover-ok:text-fg',
              )}
            >
              {ic}
              {text}
            </button>
          ))}
        </div>
        <Calendar
          value={date}
          onChange={(value) => pick(value)}
          today={today}
          weekStart={prefs.weekStart}
          locale={prefs.locale}
          labels={{ previous: t('dates.prevMonth'), next: t('dates.nextMonth') }}
        />
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <Clock aria-hidden className="size-4 text-fg-3" />
          <label className="sr-only" htmlFor="task-time">
            {t('dates.time')}
          </label>
          <input
            id="task-time"
            type="time"
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
            onBlur={() => {
              if (date && draftTime !== (time?.slice(0, 5) ?? '')) onChange(date, draftTime ? `${draftTime}:00` : null);
            }}
            className="focus-ring h-8 flex-1 rounded-sm border border-line-strong bg-surface-1 px-2.5 font-mono text-sm text-fg [color-scheme:dark]"
          />
          {draftTime && (
            <button
              type="button"
              aria-label={t('dates.clearTime')}
              onClick={() => {
                setDraftTime('');
                if (date) onChange(date, null);
              }}
              className="focus-ring inline-flex size-8 items-center justify-center rounded-sm text-fg-3 hover-ok:bg-surface-3 hover-ok:text-fg"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
        {date && (
          <button
            type="button"
            onClick={() => pick(null)}
            className="focus-ring mt-2 flex h-8 w-full items-center gap-2 rounded-sm px-2.5 text-sm text-fg-2 hover-ok:bg-surface-3 hover-ok:text-fg"
          >
            <CalendarX2 aria-hidden className="size-4" />
            {t('dates.clear')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
