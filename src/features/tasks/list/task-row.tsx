'use client';

import {
  ArrowUpRight,
  CalendarDays,
  CalendarX2,
  Copy,
  CornerDownRight,
  Ellipsis,
  Flag,
  Flame,
  Hourglass,
  Link2,
  ListChecks,
  MessageSquare,
  Paperclip,
  Plus,
  Repeat,
  RotateCcw,
  Sun,
  Sunrise,
  Trash2,
  CalendarRange,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { memo, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu';
import { ProgressRing } from '@/components/ui/progress';
import { HorizonCheck } from '@/components/ui/horizon-check';
import { priorityVar, swatchVar } from '@/lib/color/swatches';
import { readTypeConfig } from '@/lib/domain/task-types';
import { addDays, type IsoDate } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toasts';
import type { PlannerPrefs } from '../data/hooks';
import type { TaskActions } from '../data/use-task-actions';
import { dueTone, formatDuration, formatNumber, formatTime, nextWeekStart, relativeDay } from '../format';
import { markHabitDay } from '../widgets/habit-actions';
import type { RowModel } from './row-model';

export interface TaskRowProps {
  model: RowModel;
  variant?: 'list' | 'completed' | 'trash';
  /** The group header already names the day: show only the time. */
  hideDate?: boolean;
  active?: boolean;
  selected?: boolean;
  selecting?: boolean;
  lingering?: boolean;
  today: IsoDate;
  prefs: PlannerPrefs;
  actions: TaskActions;
  onOpen: (id: string) => void;
  onSelect: (id: string, range: boolean) => void;
  /** Extra line under the title (trash countdown, completion time). */
  note?: ReactNode;
  dragHandle?: ReactNode;
}

const toneClass = {
  overdue: 'text-danger',
  today: 'text-fg-2',
  soon: 'text-warning',
  later: 'text-fg-3',
} as const;

/** One reading in the mono line under the title. */
function Meta({ icon, children, className, label }: { icon?: ReactNode; children?: ReactNode; className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0', className)} aria-label={label}>
      {icon}
      {children}
    </span>
  );
}

/** The progress reading at the end of a row (also on board cards). */
export function ProgressBadge({ model, prefs }: { model: RowModel; prefs: PlannerPrefs }) {
  const t = useTranslations('tasks');
  const p = model.progress;
  if (!p) return null;
  const n = (v: number) => formatNumber(v, prefs.locale);
  let label: ReactNode = null;
  switch (p.detail.kind) {
    case 'none':
      label = model.type === 'percent' ? `${Math.round(p.current)}%` : p.target ? `${n(p.current)}/${n(p.target)}` : n(p.current);
      break;
    case 'subtasks':
    case 'stages':
    case 'chain':
      label = `${p.detail.done}/${p.detail.total}`;
      break;
    case 'time':
      label = p.target
        ? `${formatDuration(p.detail.seconds / 60, t)} / ${formatDuration(p.target, t)}`
        : formatDuration(p.detail.seconds / 60, t);
      break;
    case 'habit':
      label = (
        <span className="inline-flex items-center gap-0.5 text-[color:var(--color-amber)]">
          <Flame aria-hidden className="size-3" />
          {p.detail.streak}
        </span>
      );
      break;
    case 'counter':
      label = p.target ? `${n(p.current)}/${n(p.target)}` : n(p.current);
      break;
    case 'collab':
      label = p.target ? `${n(p.current)}/${n(p.target)}` : n(p.current);
      break;
    case 'abstain':
      label = t('widgets.habit.days', { n: p.detail.days });
      break;
  }
  const over = p.detail.kind === 'counter' && p.detail.mode === 'limit' && p.target != null && p.current > p.target;
  const ringColor = over ? 'var(--color-danger)' : p.reached ? 'var(--color-success)' : undefined;
  const showRing = p.detail.kind !== 'abstain';
  return (
    <span className="flex shrink-0 items-center gap-2 pt-px">
      <span className={cn('font-mono text-xs tabular', over ? 'text-danger' : 'text-fg-2')}>{label}</span>
      {showRing && <ProgressRing value={Math.min(1, p.ratio)} size={18} showValue={false} color={ringColor} />}
    </span>
  );
}

/** What stands before a task's title: the complete check, or a habit / counter control. */
export function TaskCheck({ model, prefs, actions, lingering, today }: Pick<TaskRowProps, 'model' | 'prefs' | 'actions' | 'lingering' | 'today'>) {
  const t = useTranslations('tasks');
  const { task } = model;
  const color = priorityVar(model.priorityKey);
  const nextLabel = (date: IsoDate) => relativeDay(date, today, prefs.locale, t);

  if (task.deleted_at) {
    return <HorizonCheck checked={Boolean(task.completed_at)} onCheckedChange={() => undefined} disabled label={task.title} color={color} />;
  }
  if (model.type === 'habit' && model.progress?.detail.kind === 'habit') {
    const d = model.progress.detail;
    const done = d.todayStatus === 'done' || d.todayStatus === 'freeze';
    return (
      <HorizonCheck
        checked={done}
        onCheckedChange={() => void markHabitDay(actions, task, today, done ? null : 'done', t('toast.changed'))}
        label={done ? t('widgets.habit.undo') : t('widgets.habit.markDone')}
        color="var(--color-amber)"
        className={cn(!d.scheduledToday && !done && 'opacity-60')}
      />
    );
  }
  if (model.type === 'counter') {
    const config = readTypeConfig('counter', task.type_config);
    return (
      <button
        type="button"
        aria-label={t('widgets.counter.plus', { step: formatNumber(config.step, prefs.locale) })}
        onClick={() => void actions.addEvent(task.id, 'delta', config.step)}
        className="focus-ring inline-flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[color:var(--color-swatch-gold)] text-[color:var(--color-swatch-gold)] transition-colors hover-ok:bg-[color-mix(in_oklab,var(--color-swatch-gold)_16%,transparent)]"
      >
        <Plus aria-hidden className="size-3" strokeWidth={2} />
      </button>
    );
  }
  if (model.type === 'abstain') {
    return (
      <span
        aria-hidden
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[color:var(--color-swatch-steel)]"
      >
        <span className="size-1 rounded-full bg-[color:var(--color-swatch-steel)]" />
      </span>
    );
  }
  const checked = Boolean(task.completed_at) || Boolean(lingering);
  return (
    <HorizonCheck
      checked={checked}
      onCheckedChange={() => void actions.toggle(task, nextLabel)}
      label={task.completed_at ? t('row.reopen', { title: task.title }) : t('row.complete', { title: task.title })}
      color={color}
    />
  );
}

function RowMenu({ model, actions, today, prefs, onOpen }: Pick<TaskRowProps, 'model' | 'actions' | 'today' | 'prefs' | 'onOpen'>) {
  const t = useTranslations('tasks');
  const { task } = model;
  const label = (date: IsoDate) => relativeDay(date, today, prefs.locale, t);
  const move = (date: IsoDate | null) => void actions.setDue([task.id], date, date ? label(date) : t('dates.clear'));

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t('row.more')}
          className={cn(
            'focus-ring -my-1 inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-fg-3 transition-[opacity,color,background-color]',
            'hover-ok:bg-surface-3 hover-ok:text-fg data-[state=open]:bg-surface-3 data-[state=open]:text-fg',
            'pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:data-[state=open]:opacity-100',
          )}
        >
          <Ellipsis aria-hidden className="size-4" />
        </button>
      </MenuTrigger>
      <MenuContent align="end">
        {task.deleted_at ? (
          <>
            <MenuItem icon={<RotateCcw />} onSelect={() => void actions.restore([task.id])}>
              {t('actions.restore')}
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem icon={<ArrowUpRight />} shortcut={['Enter']} onSelect={() => onOpen(task.id)}>
              {t('actions.open')}
            </MenuItem>
            <MenuSeparator />
            <MenuSub>
              <MenuSubTrigger icon={<CalendarDays />}>{t('actions.date')}</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem icon={<Sun />} onSelect={() => move(today)}>
                  {t('actions.today')}
                </MenuItem>
                <MenuItem icon={<Sunrise />} onSelect={() => move(addDays(today, 1))}>
                  {t('actions.tomorrow')}
                </MenuItem>
                <MenuItem icon={<CalendarRange />} onSelect={() => move(nextWeekStart(today, prefs.weekStart))}>
                  {t('actions.nextWeek')}
                </MenuItem>
                {task.due_date && (
                  <MenuItem icon={<CalendarX2 />} onSelect={() => move(null)}>
                    {t('actions.noDate')}
                  </MenuItem>
                )}
              </MenuSubContent>
            </MenuSub>
            <MenuSub>
              <MenuSubTrigger icon={<Flag />}>{t('actions.priority')}</MenuSubTrigger>
              <MenuSubContent>
                <MenuRadioGroup value={model.priorityKey ?? 'none'} onValueChange={(v) => void actions.setPriority([task.id], v === 'none' ? null : v)}>
                  {(['critical', 'high', 'medium', 'low'] as const).map((key) => (
                    <MenuRadioItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <Flag aria-hidden className="size-4" style={{ color: priorityVar(key) }} />
                        {t(`priority.${key}`)}
                      </span>
                    </MenuRadioItem>
                  ))}
                  <MenuRadioItem value="none">{t('priority.none')}</MenuRadioItem>
                </MenuRadioGroup>
              </MenuSubContent>
            </MenuSub>
            <MenuSeparator />
            <MenuItem icon={<Copy />} onSelect={() => void actions.duplicate(task.id)}>
              {t('actions.duplicate')}
            </MenuItem>
            <MenuItem
              icon={<Link2 />}
              onSelect={() => {
                const url = new URL(window.location.href);
                url.searchParams.set('task', task.id);
                void navigator.clipboard.writeText(url.toString()).then(() => toast.success(t('actions.linkCopied')));
              }}
            >
              {t('actions.copyLink')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 />} tone="danger" shortcut={['Del']} onSelect={() => void actions.trash([task.id])}>
              {t('actions.delete')}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

function TaskRowView(props: TaskRowProps) {
  const t = useTranslations('tasks');
  const { model, variant = 'list', hideDate, active, selected, selecting, lingering, today, prefs, onOpen, onSelect, note, dragHandle } = props;
  const { task } = model;
  const done = Boolean(task.completed_at) || Boolean(lingering);
  const tone = task.due_date ? dueTone(task.due_date, today, model.overdue) : null;
  const running = model.progress?.detail.kind === 'time' && model.progress.detail.running;

  const dueLabel = task.due_date
    ? [
        hideDate && task.due_date === today ? null : relativeDay(task.due_date, today, prefs.locale, t),
        task.due_time ? formatTime(task.due_time, prefs.locale, prefs.hour12) : null,
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <div
      data-task-id={task.id}
      className={cn(
        'group/row relative flex min-h-11 items-start gap-3 px-3 py-2.5 transition-colors duration-90 sm:px-4',
        active || selected ? 'bg-surface-2' : 'hover-ok:bg-surface-2/60',
      )}
    >
      {(active || selected) && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-blue" />}
      {dragHandle}
      {(selecting || selected) && (
        <Checkbox
          checked={Boolean(selected)}
          onCheckedChange={() => onSelect(task.id, false)}
          aria-label={t('row.select', { title: task.title })}
          className="mt-0.5"
        />
      )}
      <span className="flex h-5 items-center">
        <TaskCheck model={model} prefs={prefs} actions={props.actions} lingering={lingering} today={today} />
      </span>

      <button
        type="button"
        data-row-open
        onClick={(event) => {
          if (selecting || event.shiftKey || event.metaKey || event.ctrlKey) {
            onSelect(task.id, event.shiftKey);
            return;
          }
          onOpen(task.id);
        }}
        className="focus-ring -my-1 min-w-0 flex-1 rounded-xs py-1 text-left"
        aria-label={t('row.open', { title: task.title })}
      >
        <span
          className={cn(
            'block text-base break-words transition-colors duration-200',
            done ? 'text-fg-3 line-through decoration-fg-4' : 'text-fg',
          )}
        >
          {task.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[0.6875rem] leading-4 tracking-[0.02em] text-fg-3 empty:hidden">
          {model.parentTitle && (
            <Meta icon={<CornerDownRight aria-hidden />} className="max-w-48">
              <span className="truncate">{model.parentTitle}</span>
            </Meta>
          )}
          {dueLabel && variant !== 'trash' && (
            <Meta className={cn('tracking-[0.06em] uppercase', tone ? toneClass[tone] : undefined)} label={model.overdue ? t('row.overdue') : undefined}>
              {dueLabel}
            </Meta>
          )}
          {task.recurrence != null && <Meta icon={<Repeat aria-hidden />} label={t('row.repeats')} />}
          {running && (
            <Meta icon={<span className="size-1.5 rounded-full bg-blue motion-ok:animate-pulse" />} className="tracking-[0.06em] text-blue uppercase">
              {t('row.running')}
            </Meta>
          )}
          {model.subtasks && model.type !== 'subtasks' && (
            <Meta icon={<ListChecks aria-hidden />} label={t('row.subtasks', model.subtasks)}>
              {model.subtasks.done}/{model.subtasks.total}
            </Meta>
          )}
          {task.estimate_minutes != null && task.estimate_minutes > 0 && (
            <Meta icon={<Hourglass aria-hidden />} label={t('row.estimate', { value: formatDuration(task.estimate_minutes, t) })}>
              {formatDuration(task.estimate_minutes, t)}
            </Meta>
          )}
          {model.project && (
            <Meta icon={<span aria-hidden className="size-1.5 rounded-full" style={{ background: swatchVar(model.project.color) }} />} className="max-w-40 font-sans text-xs tracking-normal">
              <span className="truncate">{model.project.name}</span>
            </Meta>
          )}
          {model.tags.map((tag) => (
            <span key={tag.id} className="whitespace-nowrap" style={{ color: swatchVar(tag.color) }}>
              #{tag.name}
            </span>
          ))}
          {model.comments > 0 && (
            <Meta icon={<MessageSquare aria-hidden />} label={t('row.comments', { count: model.comments })}>
              {model.comments}
            </Meta>
          )}
          {model.attachments > 0 && (
            <Meta icon={<Paperclip aria-hidden />} label={t('row.attachments', { count: model.attachments })}>
              {model.attachments}
            </Meta>
          )}
          {note}
        </span>
      </button>

      {!task.deleted_at && <ProgressBadge model={model} prefs={prefs} />}
      {variant !== 'completed' && <RowMenu model={model} actions={props.actions} today={today} prefs={prefs} onOpen={onOpen} />}
    </div>
  );
}

export const TaskRowItem = memo(TaskRowView);
