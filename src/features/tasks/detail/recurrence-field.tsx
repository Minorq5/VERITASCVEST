'use client';

import { Check, Repeat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  alignAnchor,
  occurrences,
  parseRecurrence,
  presets,
  type RecurrenceRule,
} from '@/lib/domain/recurrence';
import { addYears, parts, weekday, type IsoDate } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import type { PlannerPrefs } from '../data/hooks';
import { formatShortDate, weekdayNames } from '../format';
import { useRawMessage, useDescribeRecurrence } from '../shared/use-words';
import { valueButton } from './property-row';

type Freq = RecurrenceRule['freq'];

/** Repeat rule of a task: presets in a menu, the rest in the editor. */
export function RecurrenceField({
  value,
  anchor,
  onChange,
  prefs,
  today,
}: {
  value: unknown;
  /** The task's date (or today): presets repeat on its weekday / day of month. */
  anchor: IsoDate;
  onChange: (rule: RecurrenceRule | null) => void;
  prefs: PlannerPrefs;
  today: IsoDate;
}) {
  const t = useTranslations('tasks');
  const describe = useDescribeRecurrence(prefs);
  const rule = parseRecurrence(value);
  const [editing, setEditing] = useState(false);
  const choices: [string, RecurrenceRule][] = [
    [t('recurrence.daily'), presets.daily(anchor)],
    [t('recurrence.weekdays'), presets.weekdays(anchor)],
    [t('recurrence.weekly'), presets.weekly(anchor, [weekday(anchor)])],
    [t('recurrence.monthly'), presets.monthlyOnDay(anchor, parts(anchor).d)],
    [t('recurrence.yearly'), presets.yearly(anchor)],
  ];
  const same = (a: RecurrenceRule | null, b: RecurrenceRule) => a !== null && describe(a) === describe(b);

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button type="button" className={cn(valueButton, rule ? 'text-fg' : 'text-fg-3')}>
            {rule && <Repeat aria-hidden className="text-fg-3" />}
            <span className="truncate first-letter:uppercase">{rule ? describe(rule) : t('recurrence.none')}</span>
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          {choices.map(([label, preset]) => (
            <MenuItem key={label} icon={same(rule, preset) ? <Check className="text-accent" /> : <span className="size-4" />} onSelect={() => onChange(alignAnchor(preset, anchor, prefs.weekStart))}>
              {label}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={<span className="size-4" />} onSelect={() => setEditing(true)}>
            {t('recurrence.custom')}
          </MenuItem>
          {rule && (
            <MenuItem icon={<span className="size-4" />} onSelect={() => onChange(null)}>
              {t('recurrence.none')}
            </MenuItem>
          )}
        </MenuContent>
      </Menu>
      {editing && (
        <RecurrenceEditor
          initial={rule ?? presets.weekly(anchor, [weekday(anchor)])}
          anchor={anchor}
          prefs={prefs}
          today={today}
          onClose={() => setEditing(false)}
          onApply={(next) => {
            onChange(next);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

function RecurrenceEditor({
  initial,
  anchor,
  prefs,
  today,
  onClose,
  onApply,
}: {
  initial: RecurrenceRule;
  anchor: IsoDate;
  prefs: PlannerPrefs;
  today: IsoDate;
  onClose: () => void;
  onApply: (rule: RecurrenceRule) => void;
}) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const describe = useDescribeRecurrence(prefs);
  const weekdaysAcc = useRawMessage<string[]>('tasks', 'recurrence.weekdaysAcc');
  const genders = useRawMessage<string[]>('tasks', 'recurrence.weekdayGender');
  const [freq, setFreq] = useState<Freq>(initial.freq);
  const [interval, setEvery] = useState(initial.interval);
  const [days, setDays] = useState<number[]>(initial.byWeekday?.length ? initial.byWeekday : [weekday(anchor)]);
  const [monthBy, setMonthBy] = useState<'day' | 'nth' | 'last'>(initial.setPos ? 'nth' : initial.byMonthDay === -1 ? 'last' : 'day');
  const [ends, setEnds] = useState<'never' | 'until' | 'count'>(initial.until ? 'until' : initial.count ? 'count' : 'never');
  const [until, setUntil] = useState<IsoDate>(initial.until ?? addYears(anchor, 1));
  const [count, setCount] = useState(initial.count ?? 10);
  const [completion, setCompletion] = useState(initial.mode === 'completion');

  const a = parts(anchor);
  const nthPos = Math.min(4, Math.ceil(a.d / 7));
  const rule: RecurrenceRule = useMemo(() => {
    const base: RecurrenceRule = { freq, interval: Math.max(1, Math.min(999, interval || 1)), mode: completion ? 'completion' : 'schedule', anchor };
    if (!completion) {
      if (freq === 'weekly') base.byWeekday = days.length ? [...days].sort() : [weekday(anchor)];
      if (freq === 'monthly') {
        if (monthBy === 'nth') {
          base.byWeekday = [weekday(anchor)];
          base.setPos = nthPos;
        } else base.byMonthDay = monthBy === 'last' ? -1 : a.d;
      }
    }
    if (ends === 'until') base.until = until;
    if (ends === 'count') base.count = Math.max(1, Math.min(10000, count || 1));
    return completion ? base : alignAnchor(base, anchor, prefs.weekStart);
  }, [freq, interval, days, monthBy, ends, until, count, completion, anchor, a.d, nthPos, prefs.weekStart]);

  const preview = completion ? [] : occurrences(rule, today > rule.anchor ? today : rule.anchor, addYears(today, 5), prefs.weekStart, 5);
  const names = weekdayNames(prefs.locale, 'short');
  const order = Array.from({ length: 7 }, (_, i) => (prefs.weekStart + i) % 7);
  const nthLabel = t('recurrence.summary.nth', {
    pos: String(nthPos),
    g: genders[weekday(anchor)] ?? 'm',
    weekday: weekdaysAcc[weekday(anchor)] ?? '',
  });

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('recurrence.label')}
      description={describe(rule)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={() => onApply(rule)}>
            {t('recurrence.apply')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <span className="text-base text-fg-2">{t('recurrence.every')}</span>
          <input
            type="number"
            min={1}
            max={999}
            value={interval}
            onChange={(e) => setEvery(Number(e.target.value))}
            aria-label={t('recurrence.every')}
            className="focus-ring h-11 w-20 rounded-md border border-line-strong bg-surface-2 px-3 font-mono text-base text-fg"
          />
          <Select value={freq} onValueChange={(v) => setFreq(v as Freq)} aria-label={t('recurrence.label')} className="w-40">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((f) => (
              <SelectItem key={f} value={f}>
                {t(`recurrence.unit.${f}`, { n: interval || 1 })}
              </SelectItem>
            ))}
          </Select>
        </div>

        {!completion && freq === 'weekly' && (
          <fieldset>
            <legend className="mb-2 text-sm text-fg-3">{t('recurrence.onDays')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {order.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                    className={cn(
                      'focus-ring inline-flex h-10 min-w-11 items-center justify-center rounded-md border px-2 text-sm transition-colors first-letter:uppercase',
                      on ? 'border-accent/50 bg-accent/15 text-fg' : 'border-line-strong text-fg-2 hover-ok:bg-surface-4',
                    )}
                  >
                    {names[d]?.replace('.', '')}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {!completion && freq === 'monthly' && (
          <fieldset>
            <legend className="mb-2 text-sm text-fg-3">{t('recurrence.monthBy')}</legend>
            <RadioGroup value={monthBy} onValueChange={(v) => setMonthBy(v as typeof monthBy)}>
              <RadioItem value="day" label={t('recurrence.byMonthDay')} description={`${a.d}`} />
              <RadioItem value="nth" label={t('recurrence.byNth')} description={nthLabel} />
              <RadioItem value="last" label={t('recurrence.byLastDay')} />
            </RadioGroup>
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-2 text-sm text-fg-3">{t('recurrence.ends')}</legend>
          <RadioGroup value={ends} onValueChange={(v) => setEnds(v as typeof ends)}>
            <RadioItem value="never" label={t('recurrence.endsNever')} />
            <div className="flex flex-wrap items-center gap-3">
              <RadioItem value="until" label={t('recurrence.endsOn')} />
              {ends === 'until' && (
                <input
                  type="date"
                  value={until}
                  min={anchor}
                  onChange={(e) => e.target.value && setUntil(e.target.value)}
                  aria-label={t('recurrence.endsOn')}
                  className="focus-ring h-9 rounded-md border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg [color-scheme:dark]"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <RadioItem value="count" label={t('recurrence.endsAfter')} />
              {ends === 'count' && (
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  aria-label={t('recurrence.count')}
                  className="focus-ring h-9 w-24 rounded-md border border-line-strong bg-surface-2 px-2.5 font-mono text-sm text-fg"
                />
              )}
            </div>
          </RadioGroup>
        </fieldset>

        <Switch checked={completion} onCheckedChange={setCompletion} label={t('recurrence.fromCompletion')} description={t('recurrence.fromCompletionHint')} />

        {preview.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-fg-3">{t('recurrence.preview')}</p>
            <ul className="flex flex-wrap gap-1.5">
              {preview.map((d) => (
                <li key={d} className="rounded-full border border-line-strong bg-surface-3 px-2.5 py-1 font-mono text-xs text-fg-2">
                  {formatShortDate(d, prefs.locale, today)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
