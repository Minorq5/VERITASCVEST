'use client';

import { Check, ChevronsUpDown, LocateFixed, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { controlFrame } from '@/components/ui/input';
import { allZones, describeZone, deviceTimeZone, searchZones } from '@/lib/time/zones';
import { cn } from '@/lib/utils/cn';

/** Searchable list of every IANA time zone, with the device zone on top. */
export function TimezonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (zone: string) => void;
}) {
  const t = useTranslations('settings.language');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const device = useMemo(() => deviceTimeZone(), []);
  const zones = useMemo(
    () => (open ? allZones().map((z) => describeZone(z, locale)) : []),
    [open, locale],
  );
  const current = useMemo(() => describeZone(value, locale), [value, locale]);
  const q = query.trim().toLowerCase().replace(/ё/g, 'е');
  const results = useMemo(() => searchZones(zones, q), [zones, q]);
  const options = q
    ? results
    : [describeZone(device, locale), ...results.filter((z) => z.id !== device)];

  function choose(zone: string) {
    onChange(zone);
    setOpen(false);
    setQuery('');
  }

  function move(next: number) {
    const clamped = Math.max(0, Math.min(options.length - 1, next));
    setActive(clamped);
    listRef.current
      ?.querySelector(`[data-index="${clamped}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') move(active + 1);
    else if (event.key === 'ArrowUp') move(active - 1);
    else if (event.key === 'PageDown') move(active + 8);
    else if (event.key === 'PageUp') move(active - 8);
    else if (event.key === 'Enter' && options[active]) choose(options[active].id);
    else return;
    event.preventDefault();
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery('');
        setActive(0);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            controlFrame,
            'h-11 w-full justify-between gap-3 px-3 text-left sm:w-80 hover-ok:border-line-bright',
          )}
          aria-label={`${t('timezone')}: ${current.city}`}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-base text-fg">
              {current.city} <span className="font-mono text-sm text-fg-3">{current.offset}</span>
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-fg-3" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-fg-3" aria-hidden />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
            aria-label={t('timezoneSearch')}
            placeholder={t('timezoneSearch')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-11 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-4"
          />
        </div>
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={t('timezone')}
          className="max-h-80 overflow-y-auto p-1.5"
        >
          {options.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-fg-3">{t('timezoneEmpty')}</li>
          )}
          {options.map((zone, index) => {
            const selected = zone.id === value;
            const isDevice = !q && index === 0;
            return (
              <li
                key={`${zone.id}-${index}`}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(zone.id)}
                className={cn(
                  'flex cursor-default items-center gap-3 rounded-sm px-2.5 py-2',
                  index === active && 'bg-surface-4',
                  isDevice && 'mb-1 border-b border-line pb-2.5',
                )}
              >
                {isDevice ? (
                  <LocateFixed className="size-4 shrink-0 text-accent" aria-hidden />
                ) : (
                  <span className="size-4 shrink-0" aria-hidden />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base text-fg">
                    {isDevice ? t('timezoneDevice', { zone: zone.city }) : zone.city}
                  </span>
                  <span className="truncate text-xs text-fg-3">{zone.local || zone.region}</span>
                </span>
                <span className="shrink-0 font-mono tabular text-xs text-fg-3">{zone.offset}</span>
                {selected ? (
                  <Check className="size-4 shrink-0 text-accent" aria-hidden />
                ) : (
                  <span className="size-4 shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
