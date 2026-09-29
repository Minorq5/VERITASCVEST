'use client';

import { ArrowUp, ChevronDown, Lightbulb, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { priorityVar, swatchFor, swatchVar } from '@/lib/color/swatches';
import { parseQuickAdd, type QuickAddResult, type Token } from '@/lib/domain/quick-add/parse';
import type { QuickLocale } from '@/lib/domain/quick-add/lexicon';
import type { TaskRow } from '@/lib/db/types';
import { inSection } from '@/lib/domain/sections';
import { ongoingTypes, type TaskType } from '@/lib/domain/task-types';
import { addDays, timeIn } from '@/lib/time/dates';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toasts';
import { ensureProject } from '../data/actions';
import { useCatalog, usePlannerPrefs, useToday } from '../data/hooks';
import { useTaskActions } from '../data/use-task-actions';
import { formatDuration, formatTime, relativeDay } from '../format';
import { useDescribeRecurrence, useRawMessage } from '../shared/use-words';
import { TypeMenu } from '../shared/type-menu';
import { typeMeta } from '../shared/type-meta';
import { useTaskRoute } from '../shared/use-task-route';
import type { ListScope } from './store';

const kindColor = (token: Token, catalog: ReturnType<typeof useCatalog>): string => {
  switch (token.kind) {
    case 'tag': {
      const tag = catalog?.tags.find((x) => x.name.toLocaleLowerCase() === token.name?.toLocaleLowerCase());
      return swatchVar(tag?.color ?? swatchFor(token.name ?? ''));
    }
    case 'project': {
      const project = catalog?.projects.find((x) => x.name.toLocaleLowerCase() === token.name?.toLocaleLowerCase());
      return swatchVar(project?.color ?? swatchFor(token.name ?? ''));
    }
    case 'priority':
      return priorityVar(token.priority) ?? 'var(--accent)';
    case 'repeat':
      return 'var(--color-swatch-violet)';
    case 'estimate':
      return 'var(--color-swatch-amber)';
    case 'reminder':
      return 'var(--color-swatch-sky)';
    default:
      return 'var(--accent)';
  }
};

/** The fragment being typed after "#" or "+" (for suggestions). */
function fragmentAt(text: string, caret: number): { sign: '#' | '+'; start: number; query: string } | null {
  const before = text.slice(0, caret);
  const quoted = /(^|\s)\+"([^"]*)$/.exec(before);
  if (quoted) return { sign: '+', start: before.length - quoted[2]!.length - 2, query: quoted[2]! };
  const plain = /(^|\s)([#+])([^\s#+!~@"]*)$/u.exec(before);
  if (!plain) return null;
  return { sign: plain[2] as '#' | '+', start: before.length - plain[3]!.length - 1, query: plain[3]! };
}

interface QuickAddProps {
  scope: ListScope;
  autoFocus?: boolean;
  /** Called after a task is created (the dialog closes itself). */
  onCreated?: (task: TaskRow) => void;
  /** Text to start with (onboarding examples). */
  defaultText?: string;
  className?: string;
}

export function QuickAdd({ scope, autoFocus, onCreated, defaultText, className }: QuickAddProps) {
  const t = useTranslations('tasks');
  const tn = useTranslations('nav');
  const prefs = usePlannerPrefs();
  const { today, now } = useToday();
  const catalog = useCatalog();
  const actions = useTaskActions();
  const { open } = useTaskRoute();
  const reduce = useLessMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const [text, setText] = useState(defaultText ?? '');
  const [caret, setCaret] = useState(0);
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(new Set());
  const [type, setType] = useState<TaskType>('normal');
  const [hintOn, setHintOn] = useState(false);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [example] = useState(() => Math.floor(Math.random() * 5));
  const examples = useRawMessage<string[]>('tasks', 'quickAdd.examples');
  const describe = useDescribeRecurrence(prefs);

  const locale = (['ru', 'en', 'bg'].includes(prefs.locale) ? prefs.locale : 'en') as QuickLocale;

  const result: QuickAddResult = useMemo(() => {
    const ctx = { locale, today, nowTime: timeIn(prefs.timeZone, now), weekStart: prefs.weekStart, disabled };
    const first = parseQuickAdd(text, ctx);
    // Assigning people arrives with friends (stage 5): "@name" stays text for now.
    const people = first.tokens.filter((tk) => tk.kind === 'assignee').map((tk) => tk.key);
    return people.length ? parseQuickAdd(text, { ...ctx, disabled: new Set([...disabled, ...people]) }) : first;
  }, [text, locale, today, now, prefs.timeZone, prefs.weekStart, disabled]);

  // Keep the highlight layer the same height as the text area.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const fragment = focused ? fragmentAt(text, caret) : null;
  const suggestions = useMemo(() => {
    if (!fragment || !catalog) return [];
    const q = fragment.query.toLocaleLowerCase();
    const pool =
      fragment.sign === '#'
        ? catalog.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }))
        : catalog.projects.map((p) => ({ id: p.id, name: p.name, color: p.color }));
    const found = pool
      .filter((item) => item.name.toLocaleLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLocaleLowerCase().startsWith(q)) - Number(!b.name.toLocaleLowerCase().startsWith(q)))
      .slice(0, 6);
    const exact = pool.some((item) => item.name.toLocaleLowerCase() === q);
    const create = q && !exact && (fragment.sign === '+' || !/\s/.test(q)) ? [{ id: 'new', name: fragment.query, color: swatchFor(fragment.query) }] : [];
    return [...found, ...create];
  }, [fragment, catalog]);
  const showSuggestions = suggestions.length > 0;

  const accept = (index: number) => {
    const item = suggestions[index];
    if (!item || !fragment) return;
    const insert = fragment.sign === '#' ? `#${item.name.replace(/\s+/g, '_')} ` : /\s/.test(item.name) ? `+"${item.name}" ` : `+${item.name} `;
    const next = text.slice(0, fragment.start) + insert + text.slice(caret).replace(/^[^\s]*/, '').trimStart();
    setText(next);
    const pos = fragment.start + insert.length;
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
    setActive(0);
  };

  const hint = result.hint;
  const effectiveType: TaskType = hintOn && hint ? hint.type : type;

  const reset = () => {
    setText('');
    setDisabled(new Set());
    setType('normal');
    setHintOn(false);
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    const title = result.title.trim();
    if (!title) {
      if (text.trim()) setError(t('quickAdd.titleMissing'));
      return;
    }
    setBusy(true);
    try {
      const section = scope?.kind === 'section' ? scope.section : null;
      // Habits, counters and "quit" goals measure periods: they have no deadline of their own.
      const ongoing = (ongoingTypes as readonly string[]).includes(effectiveType);
      const fallbackDue = ongoing ? null : section === 'today' || section === 'week' ? today : section === 'tomorrow' ? addDays(today, 1) : null;
      const dueDate = result.dueDate ?? (result.recurrence ? result.recurrence.anchor : fallbackDue);
      const projectId = result.project
        ? await ensureProject(actions.ctx, result.project)
        : scope?.kind === 'project'
          ? scope.projectId
          : null;
      const task = await actions.create({
        title,
        type: effectiveType,
        due_date: dueDate,
        due_time: dueDate ? result.dueTime : null,
        start_date: result.startDate,
        start_time: result.startDate ? result.startTime : null,
        recurrence: result.recurrence,
        priority: result.priority,
        tags: result.tags,
        project_id: projectId,
        estimate_minutes: result.estimateMinutes,
        reminders: result.reminders,
        progress_target: hintOn && hint ? hint.target : null,
        progress_unit: hintOn && hint ? hint.unit : null,
      });
      if (!task) return;
      reset();
      onCreated?.(task);
      // Say where the task went when it is not in the list on screen.
      const visible =
        scope?.kind === 'project'
          ? task.project_id === scope.projectId
          : section
            ? inSection(task, section, { today, now })
            : false;
      if (!visible) {
        const where = task.due_date
          ? task.due_date === today
            ? tn('today')
            : task.due_date === addDays(today, 1)
              ? tn('tomorrow')
              : relativeDay(task.due_date, today, prefs.locale, t)
          : task.project_id
            ? (catalog?.projectById.get(task.project_id)?.name ?? result.project ?? '')
            : tn('inbox');
        toast.success(t('toast.createdElsewhere', { section: where }), {
          id: `created-${task.id}`,
          action: { label: t('actions.open'), onClick: () => open(task.id) },
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((i) => (i + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
        return;
      }
      // Enter completes a name only when there is something to complete; otherwise it adds the task.
      const index = Math.min(active, suggestions.length - 1);
      const item = suggestions[index];
      const completes = item !== undefined && item.id !== 'new' && item.name.toLocaleLowerCase() !== fragment?.query.toLocaleLowerCase();
      if (event.key === 'Tab' || (event.key === 'Enter' && completes)) {
        event.preventDefault();
        accept(index);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setFocused(false);
        return;
      }
    }
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  // Text with the recognised parts marked (drawn under the transparent text area).
  const segments = useMemo(() => {
    const out: { text: string; token?: Token }[] = [];
    let at = 0;
    for (const token of result.tokens) {
      if (token.kind === 'hint') continue;
      if (token.start > at) out.push({ text: text.slice(at, token.start) });
      out.push({ text: text.slice(token.start, token.end), token });
      at = token.end;
    }
    out.push({ text: text.slice(at) });
    return out;
  }, [result.tokens, text]);

  const chipText = (token: Token): string => {
    switch (token.kind) {
      case 'date':
      case 'due':
      case 'start':
        return token.date ? relativeDay(token.date, today, prefs.locale, t) : token.text;
      case 'time':
        return token.time ? formatTime(token.time, prefs.locale, prefs.hour12) : token.text;
      case 'repeat':
        return token.rule ? describe(token.rule) : token.text;
      case 'tag':
        return `#${token.name ?? ''}`;
      case 'project':
        return token.name ?? token.text;
      case 'priority':
        return token.priority ? t(`priority.${token.priority}`) : token.text;
      case 'estimate':
      case 'reminder':
        return token.minutes ? formatDuration(token.minutes, t) : token.text;
      default:
        return token.text;
    }
  };

  const visibleTokens = result.tokens.filter((tk) => tk.kind !== 'hint');
  const TypeIcon = typeMeta[effectiveType].icon;
  const placeholder = focused
    ? t('quickAdd.tryExample', { example: examples[example] ?? '' })
    : t('quickAdd.placeholder');

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'glass shadow-inset-top relative flex items-start gap-2 rounded-xl border px-2 py-2 transition-[border-color,box-shadow] duration-200',
          focused
            ? 'border-[color-mix(in_oklab,var(--accent)_55%,transparent)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_12%,transparent)]'
            : 'border-line-strong hover-ok:border-line-bright',
          error && 'border-danger/60',
        )}
      >
        <TypeMenu
          value={effectiveType}
          onChange={(next) => {
            setType(next);
            setHintOn(false);
          }}
          trigger={
            <button
              type="button"
              aria-label={`${t('quickAdd.type')}: ${t(`types.${effectiveType}.name`)}`}
              className="focus-ring mt-px inline-flex h-9 shrink-0 items-center gap-0.5 rounded-md px-2 text-fg-2 transition-colors hover-ok:bg-surface-4 hover-ok:text-fg"
            >
              <TypeIcon aria-hidden className="size-[18px]" style={{ color: typeMeta[effectiveType].color }} />
              <ChevronDown aria-hidden className="size-3.5 text-fg-3" />
            </button>
          }
        />

        <div className="relative min-w-0 flex-1">
          <div
            ref={mirrorRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 px-1 py-[7px] text-base leading-[22px] break-words whitespace-pre-wrap text-fg"
          >
            {segments.map((seg, i) =>
              seg.token ? (
                <mark
                  key={i}
                  className="rounded-[5px] [box-decoration-break:clone] text-[color:var(--c)]"
                  style={{
                    ['--c' as string]: kindColor(seg.token, catalog),
                    background: 'color-mix(in oklab, var(--c) 16%, transparent)',
                    boxShadow: '0 0 0 2px color-mix(in oklab, var(--c) 16%, transparent)',
                  }}
                >
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
            {'​'}
          </div>
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            aria-label={t('quickAdd.label')}
            aria-invalid={Boolean(error)}
            aria-autocomplete="list"
            aria-controls={showSuggestions ? listId : undefined}
            aria-expanded={showSuggestions}
            aria-activedescendant={showSuggestions ? `${listId}-${active}` : undefined}
            role="combobox"
            placeholder={placeholder}
            spellCheck={false}
            enterKeyHint="done"
            onChange={(e) => {
              setText(e.target.value.replace(/\n/g, ' '));
              setCaret(e.target.selectionStart);
              setError(null);
              setActive(0);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            className="relative block w-full resize-none overflow-hidden bg-transparent px-1 py-[7px] text-base leading-[22px] text-transparent caret-fg outline-none placeholder:text-fg-3 selection:bg-accent/30 selection:text-transparent"
          />
        </div>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!result.title.trim() || busy}
          aria-label={t('quickAdd.add')}
          className={cn(
            'focus-ring mt-px inline-flex size-9 shrink-0 items-center justify-center rounded-md transition-[background-color,color,opacity,transform] duration-200',
            result.title.trim()
              ? 'bg-[linear-gradient(180deg,var(--accent-hi),var(--accent)_60%)] text-accent-ink shadow-glow-sm motion-ok:active:scale-95'
              : 'bg-surface-4 text-fg-3 opacity-60',
          )}
        >
          <ArrowUp aria-hidden className="size-[18px]" strokeWidth={2.4} />
        </button>
      </div>

      {showSuggestions && (
        <ul
          id={listId}
          role="listbox"
          className="glass-strong shadow-inset-top absolute top-full left-12 z-[var(--z-dropdown)] mt-2 w-72 overflow-hidden rounded-lg border border-line-strong p-1.5 shadow-lg"
        >
          {suggestions.map((item, i) => (
            <li
              key={item.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                accept(i);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex h-9 cursor-default items-center gap-2.5 rounded-sm px-2.5 text-base',
                i === active ? 'bg-surface-4 text-fg' : 'text-fg-2',
              )}
            >
              <span aria-hidden className="size-2.5 rounded-full" style={{ background: swatchVar(item.color) }} />
              <span className="flex-1 truncate">
                {item.id === 'new' ? `${fragment?.sign === '#' ? t('quickAdd.newTag') : t('quickAdd.newProject')}: ` : ''}
                {fragment?.sign === '#' ? `#${item.name}` : item.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence initial={false}>
        {(visibleTokens.length > 0 || hint || error) && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-1.5 px-1 pt-2.5" aria-live="polite">
              {error && <p className="w-full text-sm text-danger">{error}</p>}
              {visibleTokens.map((token) => {
                const color = kindColor(token, catalog);
                const kind = t(`quickAdd.chip.${token.kind as Exclude<Token['kind'], 'hint'>}`);
                return (
                  <button
                    key={token.key}
                    type="button"
                    onClick={() => setDisabled((prev) => new Set(prev).add(token.key))}
                    aria-label={t('quickAdd.chipOff', { kind, text: token.text })}
                    className="focus-ring group/chip inline-flex h-7 items-center gap-1.5 rounded-full border pr-1.5 pl-2.5 text-sm transition-colors"
                    style={{
                      borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
                      background: `color-mix(in oklab, ${color} 12%, transparent)`,
                      color,
                    }}
                  >
                    <span className="text-fg-3">{kind}</span>
                    <span className="font-medium">{chipText(token)}</span>
                    <X aria-hidden className="size-3.5 opacity-60 group-hover/chip:opacity-100" />
                  </button>
                );
              })}
              {hint && (
                <button
                  type="button"
                  onClick={() => setHintOn((on) => !on)}
                  aria-pressed={hintOn}
                  className={cn(
                    'focus-ring inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-sm transition-colors',
                    hintOn ? 'border-accent/50 bg-accent/15 text-accent' : 'border-dashed border-line-bright text-fg-2 hover-ok:text-fg',
                  )}
                >
                  <Lightbulb aria-hidden className="size-3.5" />
                  {hintOn
                    ? t('quickAdd.hintAccepted', { type: t(`types.${hint.type}.name`) })
                    : t(hint.type === 'numeric' ? 'quickAdd.hintNumeric' : 'quickAdd.hintCounter', { target: hint.target, unit: hint.unit })}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {focused && visibleTokens.length === 0 && !hint && !error && (
        <p className="px-2 pt-2 text-xs text-fg-3 max-sm:hidden">{t('quickAdd.syntax')}</p>
      )}
    </div>
  );
}
