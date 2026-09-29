'use client';

import { Bell, Check, Flag, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Menu, MenuContent, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PriorityRow, ProjectRow, StatusRow, TagRow } from '@/lib/db/types';
import { priorityVar, swatchNames, swatchVar } from '@/lib/color/swatches';
import { cn } from '@/lib/utils/cn';
import { formatDuration } from '../format';
import { valueButton } from './property-row';

// ---------------------------------------------------------------------------
// Priority and status
// ---------------------------------------------------------------------------
export function PriorityPicker({ value, priorities, onChange }: { value: string | null; priorities: PriorityRow[]; onChange: (id: string | null) => void }) {
  const t = useTranslations('tasks');
  const current = priorities.find((p) => p.id === value);
  const key = current?.system_key ?? null;
  const name = (p: PriorityRow) => (p.system_key ? t(`priority.${p.system_key as 'high'}`) : (p.name ?? ''));
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className={cn(valueButton, current ? 'text-fg' : 'text-fg-3')}>
          <Flag aria-hidden style={{ color: priorityVar(key) }} />
          <span className="truncate">{current ? name(current) : t('priority.none')}</span>
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuRadioGroup value={value ?? 'none'} onValueChange={(v) => onChange(v === 'none' ? null : v)}>
          {priorities.map((p) => (
            <MenuRadioItem key={p.id} value={p.id}>
              <span className="flex items-center gap-2">
                <Flag aria-hidden className="size-4" style={{ color: priorityVar(p.system_key) ?? swatchVar(p.color) }} />
                {name(p)}
              </span>
            </MenuRadioItem>
          ))}
          <MenuRadioItem value="none">{t('priority.none')}</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

export function StatusPicker({ value, statuses, onChange }: { value: string | null; statuses: StatusRow[]; onChange: (id: string) => void }) {
  const t = useTranslations('tasks');
  const current = statuses.find((s) => s.id === value);
  const name = (s: StatusRow) => (s.system_key ? t(`status.${s.system_key as 'todo'}`) : (s.name ?? ''));
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className={cn(valueButton, 'text-fg')}>
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: swatchVar(current?.color) }} />
          <span className="truncate">{current ? name(current) : t('status.todo')}</span>
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuRadioGroup value={value ?? ''} onValueChange={onChange}>
          {statuses.map((s) => (
            <MenuRadioItem key={s.id} value={s.id}>
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 rounded-full" style={{ background: swatchVar(s.color) }} />
                {name(s)}
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

// ---------------------------------------------------------------------------
// Search-or-create list (projects, tags)
// ---------------------------------------------------------------------------
interface Option {
  id: string;
  name: string;
  color: string;
}

function SearchList({
  options,
  selected,
  placeholder,
  createLabel,
  onPick,
  onCreate,
  validate,
}: {
  options: Option[];
  selected: ReadonlySet<string>;
  placeholder: string;
  createLabel: (name: string) => string;
  onPick: (option: Option) => void;
  onCreate: (name: string) => void;
  validate?: (name: string) => boolean;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const q = query.trim().toLocaleLowerCase();
  const found = useMemo(() => options.filter((o) => o.name.toLocaleLowerCase().includes(q)).slice(0, 30), [options, q]);
  const canCreate = q.length > 0 && !options.some((o) => o.name.toLocaleLowerCase() === q) && (validate?.(query.trim()) ?? true);
  const total = found.length + (canCreate ? 1 : 0);
  const choose = (i: number) => {
    if (i < found.length) onPick(found[i]!);
    else if (canCreate) {
      onCreate(query.trim());
      setQuery('');
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <input
        autoFocus
        value={query}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (total) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + total) % total);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(active);
          }
        }}
        className="focus-ring h-9 rounded-md border border-line-strong bg-surface-2 px-2.5 text-base text-fg placeholder:text-fg-3"
      />
      <ul role="listbox" className="max-h-64 overflow-y-auto">
        {found.map((o, i) => (
          <li key={o.id} role="option" aria-selected={i === active}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
              className={cn('flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-base', i === active ? 'bg-surface-4 text-fg' : 'text-fg-2')}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: swatchVar(o.color) }} />
              <span className="flex-1 truncate">{o.name}</span>
              {selected.has(o.id) && <Check aria-hidden className="size-4 text-accent" />}
            </button>
          </li>
        ))}
        {canCreate && (
          <li role="option" aria-selected={active === found.length}>
            <button
              type="button"
              onMouseEnter={() => setActive(found.length)}
              onClick={() => choose(found.length)}
              className={cn(
                'flex h-9 w-full items-center gap-2.5 rounded-sm px-2.5 text-left text-base',
                active === found.length ? 'bg-surface-4 text-fg' : 'text-fg-2',
              )}
            >
              <Plus aria-hidden className="size-4 text-accent" />
              <span className="truncate">{createLabel(query.trim())}</span>
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

export function ProjectPicker({
  value,
  projects,
  onPick,
  onCreate,
}: {
  value: string | null;
  projects: ProjectRow[];
  onPick: (id: string | null) => void;
  onCreate: (name: string) => void;
}) {
  const t = useTranslations('tasks.detail');
  const [open, setOpen] = useState(false);
  const current = projects.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(valueButton, current ? 'text-fg' : 'text-fg-3')}>
          {current && <span aria-hidden className="size-2.5 rounded-full" style={{ background: swatchVar(current.color) }} />}
          <span className="truncate">{current?.name ?? t('noProject')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <SearchList
          options={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
          selected={new Set(value ? [value] : [])}
          placeholder={t('projectSearch')}
          createLabel={(name) => t('createProject', { name })}
          onPick={(o) => {
            onPick(o.id === value ? null : o.id);
            setOpen(false);
          }}
          onCreate={(name) => {
            onCreate(name);
            setOpen(false);
          }}
        />
        {current && (
          <button
            type="button"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
            className="mt-1 flex h-9 w-full items-center gap-2 rounded-sm px-2.5 text-sm text-fg-2 hover-ok:bg-surface-4"
          >
            <X aria-hidden className="size-4" />
            {t('noProject')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function TagsPicker({
  tags,
  selected,
  onToggle,
  onCreate,
}: {
  tags: TagRow[];
  selected: TagRow[];
  onToggle: (tag: TagRow) => void;
  onCreate: (name: string) => void;
}) {
  const t = useTranslations('tasks.detail');
  const ids = new Set(selected.map((tag) => tag.id));
  return (
    <>
      {selected.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex h-7 items-center gap-1 rounded-full border pr-1 pl-2.5 text-sm"
          style={{
            color: swatchVar(tag.color),
            borderColor: `color-mix(in oklab, ${swatchVar(tag.color)} 35%, transparent)`,
            background: `color-mix(in oklab, ${swatchVar(tag.color)} 10%, transparent)`,
          }}
        >
          #{tag.name}
          <button
            type="button"
            aria-label={t('removeTag', { name: tag.name })}
            onClick={() => onToggle(tag)}
            className="focus-ring inline-flex size-5 items-center justify-center rounded-full opacity-70 hover-ok:bg-surface-5 hover-ok:opacity-100"
          >
            <X aria-hidden className="size-3" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cn(valueButton, 'h-7 text-sm text-fg-3')}>
            <Plus aria-hidden />
            {selected.length ? null : t('addTag')}
            <span className="sr-only">{t('addTag')}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <SearchList
            options={tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }))}
            selected={ids}
            placeholder={t('tagSearch')}
            createLabel={(name) => t('createTag', { name: name.replace(/\s+/g, '_') })}
            validate={(name) => name.replace(/^#/, '').length > 0 && name.length <= 40}
            onPick={(o) => {
              const tag = tags.find((x) => x.id === o.id);
              if (tag) onToggle(tag);
            }}
            onCreate={(name) => onCreate(name.replace(/^#/, '').replace(/\s+/g, '_'))}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------------------
// Estimate, reminders, color
// ---------------------------------------------------------------------------
export function EstimatePicker({ value, onChange }: { value: number | null; onChange: (minutes: number | null) => void }) {
  const t = useTranslations('tasks');
  const [custom, setCustom] = useState('');
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className={cn(valueButton, value ? 'text-fg' : 'text-fg-3')}>
          <span className="truncate">{value ? formatDuration(value, t) : t('detail.noEstimate')}</span>
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
          <MenuItem key={m} icon={value === m ? <Check className="text-accent" /> : <span className="size-4" />} onSelect={() => onChange(m)}>
            {formatDuration(m, t)}
          </MenuItem>
        ))}
        <MenuSeparator />
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <input
            type="number"
            min={1}
            max={100000}
            value={custom}
            placeholder={t('detail.estimateCustom')}
            aria-label={t('detail.estimateCustom')}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && Number(custom) > 0) onChange(Math.round(Number(custom)));
            }}
            className="focus-ring h-8 w-full rounded-md border border-line-strong bg-surface-2 px-2 font-mono text-sm text-fg"
          />
        </div>
        {value && (
          <MenuItem icon={<X />} onSelect={() => onChange(null)}>
            {t('detail.noEstimate')}
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}

export interface Reminder {
  before: number;
}

export function readReminders(value: unknown): Reminder[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((r): r is Reminder => typeof r === 'object' && r !== null && typeof (r as Reminder).before === 'number')
    .sort((a, b) => a.before - b.before);
}

export function RemindersPicker({ value, hasDue, onChange }: { value: unknown; hasDue: boolean; onChange: (next: Reminder[]) => void }) {
  const t = useTranslations('tasks');
  const reminders = readReminders(value);
  const label = (r: Reminder) => (r.before === 0 ? t('detail.reminderAtDue') : t('detail.reminderBefore', { value: formatDuration(r.before, t) }));
  return (
    <div className="flex w-full flex-col items-start gap-1.5 py-1">
      <div className="flex flex-wrap items-center gap-1.5">
        {reminders.map((r) => (
          <span key={r.before} className="inline-flex h-7 items-center gap-1 rounded-full border border-line-strong bg-surface-3 pr-1 pl-2.5 text-sm text-fg-2">
            <Bell aria-hidden className="size-3.5 text-fg-3" />
            {label(r)}
            <button
              type="button"
              aria-label={t('detail.removeReminder')}
              onClick={() => onChange(reminders.filter((x) => x.before !== r.before))}
              className="focus-ring inline-flex size-5 items-center justify-center rounded-full text-fg-3 hover-ok:bg-surface-5 hover-ok:text-fg"
            >
              <X aria-hidden className="size-3" />
            </button>
          </span>
        ))}
        {reminders.length < 10 && (
          <Menu>
            <MenuTrigger asChild>
              <button type="button" className={cn(valueButton, 'h-7 text-sm text-fg-3')}>
                <Plus aria-hidden />
                {t('detail.addReminder')}
              </button>
            </MenuTrigger>
            <MenuContent align="start">
              {[0, 10, 30, 60, 180, 1440, 2880, 10080]
                .filter((m) => !reminders.some((r) => r.before === m))
                .map((m) => (
                  <MenuItem key={m} onSelect={() => onChange([...reminders, { before: m }])}>
                    {label({ before: m })}
                  </MenuItem>
                ))}
            </MenuContent>
          </Menu>
        )}
      </div>
      {reminders.length > 0 && <p className="text-xs text-fg-3">{hasDue ? t('detail.remindersSoon') : t('detail.remindersNeedDue')}</p>}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string | null; onChange: (color: string | null) => void }) {
  const t = useTranslations('tasks.detail');
  const tc = useTranslations('tasks.colors');
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1" role="radiogroup" aria-label={t('appearance')}>
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label={t('colorNone')}
        onClick={() => onChange(null)}
        className={cn(
          'focus-ring relative inline-flex size-6 items-center justify-center rounded-xs border border-line-bright',
          value === null && 'outline outline-1 outline-offset-2 outline-fg',
        )}
      >
        <span aria-hidden className="h-px w-4 rotate-45 bg-fg-3" />
      </button>
      {swatchNames
        .filter((name) => name !== 'ash')
        .map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={value === name}
            aria-label={tc(name)}
            onClick={() => onChange(name)}
            className={cn('focus-ring size-6 rounded-xs', value === name && 'outline outline-1 outline-offset-2 outline-fg')}
            style={{ background: swatchVar(name) }}
          />
        ))}
    </div>
  );
}

