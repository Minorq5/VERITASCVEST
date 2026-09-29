'use client';

import {
  Bell,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Copy,
  CornerLeftUp,
  Ellipsis,
  Flag,
  Hourglass,
  LayoutTemplate,
  Link2,
  Palette,
  Repeat,
  RotateCcw,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { HorizonCheck } from '@/components/ui/horizon-check';
import { EmptyState } from '@/components/ui/empty-state';
import type { TagRow, TaskRow } from '@/lib/db/types';
import { priorityVar } from '@/lib/color/swatches';
import { computeProgress } from '@/lib/domain/progress';
import type { RecurrenceRule } from '@/lib/domain/recurrence';
import { isOverdue, trashDaysLeft } from '@/lib/domain/sections';
import { isTaskType, type TaskType } from '@/lib/domain/task-types';
import { todayIn, type IsoDate } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toasts';
import { ensureProject, ensureTag, setTaskTags } from '../data/actions';
import { descendantsOf, useCatalog, usePlannerPrefs, useTask, useTaskParts, useTasks, useToday } from '../data/hooks';
import { useTaskActions } from '../data/use-task-actions';
import { formatLongDate, relativeDay } from '../format';
import { TypeMenu } from '../shared/type-menu';
import { typeMeta } from '../shared/type-meta';
import { useTaskRoute } from '../shared/use-task-route';
import { SaveTemplateDialog } from '../templates/save-template-dialog';
import { TypeWidget } from '../widgets/type-widget';
import { Attachments } from './attachments';
import { DateField } from './date-field';
import { DetailTabs } from './detail-tabs';
import { ColorPicker, EstimatePicker, PriorityPicker, ProjectPicker, RemindersPicker, StatusPicker, TagsPicker, type Reminder } from './pickers';
import { PropertyRow } from './property-row';
import { RecurrenceField } from './recurrence-field';
import { Subtasks } from './subtasks';

const DescriptionEditor = dynamic(() => import('./description-editor'), {
  ssr: false,
  loading: () => <Skeleton className="h-28 rounded-lg" />,
});

function TitleEditor({ task, readOnly, onSave }: { task: TaskRow; readOnly: boolean; onSave: (title: string) => void }) {
  const t = useTranslations('tasks.detail');
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(task.title);
  const [synced, setSynced] = useState(task.title);
  const [editing, setEditing] = useState(false);
  // Derived state: a title changed elsewhere replaces the text unless it is being edited.
  if (task.title !== synced) {
    setSynced(task.title);
    if (!editing) setValue(task.title);
  }
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  const commit = () => {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (!clean) {
      setValue(task.title);
      toast.error(t('titleRequired'));
      return;
    }
    if (clean !== task.title) onSave(clean);
  };
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      readOnly={readOnly}
      maxLength={500}
      aria-label={t('titlePlaceholder')}
      placeholder={t('titlePlaceholder')}
      onChange={(e) => setValue(e.target.value.replace(/\n/g, ' '))}
      onFocus={() => setEditing(true)}
      onBlur={() => {
        setEditing(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setValue(task.title);
          e.currentTarget.blur();
        }
      }}
      className={cn(
        'block w-full resize-none overflow-hidden rounded-md bg-transparent px-1 py-0.5 font-display text-xl leading-snug font-semibold outline-none focus-visible:bg-surface-3/60',
        task.completed_at ? 'text-fg-2' : 'text-fg',
      )}
    />
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5" aria-hidden>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-4/5" />
      <Skeleton className="h-28 rounded-xl" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-8" />
      ))}
    </div>
  );
}

export function TaskDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations('tasks');
  const task = useTask(id);
  const parts = useTaskParts(id);
  const catalog = useCatalog();
  const tasks = useTasks();
  const prefs = usePlannerPrefs();
  const { today, now } = useToday();
  const actions = useTaskActions();
  const { open } = useTaskRoute();
  const [templateOpen, setTemplateOpen] = useState(false);

  if (task === undefined || !parts || !catalog || !tasks) return <DetailSkeleton />;
  if (task === null) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex justify-end p-3">
          <IconButton label={t('detail.close')} icon={<X />} onClick={onClose} />
        </div>
        <EmptyState title={t('detail.notFound')} description={t('detail.notFoundText')} />
      </div>
    );
  }

  const type: TaskType = isTaskType(task.type) ? task.type : 'normal';
  const readOnly = Boolean(task.deleted_at);
  const progress = computeProgress(
    task,
    {
      events: parts.events,
      milestones: parts.milestones,
      sessions: parts.sessions,
      habitLogs: parts.habitLogs,
      descendants: type === 'subtasks' ? descendantsOf(tasks, task.id) : undefined,
    },
    { now, timeZone: prefs.timeZone, weekStart: prefs.weekStart },
  );
  const parent = task.parent_id ? tasks.find((x) => x.id === task.parent_id) : undefined;
  const priority = task.priority_id ? catalog.priorityById.get(task.priority_id) : undefined;
  const status = task.status_id ? catalog.statusById.get(task.status_id) : undefined;
  const tagRows = parts.tagIds.map((tagId) => catalog.tagById.get(tagId)).filter((tag): tag is TagRow => Boolean(tag && !tag.deleted_at));
  const overdue = isOverdue(task, { today, now });
  const Icon = typeMeta[type].icon;
  const update = (patch: Partial<TaskRow>) => void actions.update(task.id, patch);
  const nextLabel = (date: IsoDate) => relativeDay(date, today, prefs.locale, t);

  const setTags = async (names: string[]) => {
    const inverse = await setTaskTags(actions.ctx, task.id, names);
    actions.record(t('toast.changed'), inverse);
  };

  const setStatus = async (statusId: string) => {
    const next = catalog.statusById.get(statusId);
    if (next?.category === 'done' && !task.completed_at) {
      await actions.complete(task, { nextLabel });
      return;
    }
    if (task.completed_at && next?.category !== 'done') await actions.reopen(task);
    update({ status_id: statusId });
  };

  const setRecurrence = (rule: RecurrenceRule | null) => {
    const patch: Partial<TaskRow> = { recurrence: rule as never };
    if (rule && !task.due_date) patch.due_date = rule.anchor;
    update(patch);
  };

  const leading = (() => {
    if (readOnly) return null;
    if (type === 'habit' || type === 'counter' || type === 'abstain') {
      return (
        <span className="mt-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full" style={{ color: typeMeta[type].color }}>
          <Icon aria-hidden className="size-5" />
        </span>
      );
    }
    return (
      <HorizonCheck
        checked={Boolean(task.completed_at)}
        size={28}
        color={priorityVar(priority?.system_key)}
        label={task.completed_at ? t('row.reopen', { title: task.title }) : t('row.complete', { title: task.title })}
        onCheckedChange={() => void actions.toggle(task, nextLabel)}
        className="mt-1"
      />
    );
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-line px-3 py-2 sm:px-4">
        <TypeMenu
          value={type}
          onChange={(next) => {
            if (next !== type) void actions.update(task.id, { type: next }, t('detail.typeChanged')).then(() => toast.success(t('detail.typeChanged')));
          }}
          trigger={
            <button
              type="button"
              disabled={readOnly}
              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-sm text-fg-2 transition-colors hover-ok:bg-surface-4 hover-ok:text-fg disabled:opacity-60"
            >
              <Icon aria-hidden className="size-4" style={{ color: typeMeta[type].color }} />
              {t(`types.${type}.name`)}
              {!readOnly && <ChevronDown aria-hidden className="size-3.5 text-fg-3" />}
            </button>
          }
        />
        <div className="ml-auto flex items-center gap-0.5">
          <Menu>
            <MenuTrigger asChild>
              <IconButton label={t('detail.more')} icon={<Ellipsis />} />
            </MenuTrigger>
            <MenuContent align="end">
              {readOnly ? (
                <MenuItem icon={<RotateCcw />} onSelect={() => void actions.restore([task.id])}>
                  {t('actions.restore')}
                </MenuItem>
              ) : (
                <>
                  <MenuItem
                    icon={<Copy />}
                    onSelect={() => void actions.duplicate(task.id).then((copyId) => copyId && open(copyId))}
                  >
                    {t('actions.duplicate')}
                  </MenuItem>
                  <MenuItem icon={<LayoutTemplate />} onSelect={() => setTemplateOpen(true)}>
                    {t('actions.saveAsTemplate')}
                  </MenuItem>
                  <MenuItem
                    icon={<Link2 />}
                    onSelect={() => void navigator.clipboard.writeText(window.location.href).then(() => toast.success(t('actions.linkCopied')))}
                  >
                    {t('actions.copyLink')}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    icon={<Trash2 />}
                    tone="danger"
                    onSelect={() => {
                      void actions.trash([task.id]);
                      onClose();
                    }}
                  >
                    {t('actions.delete')}
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
          <IconButton label={t('detail.close')} icon={<X />} shortcut={['Esc']} onClick={onClose} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5">
        {readOnly && task.deleted_at && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-fg">
            <Trash2 aria-hidden className="size-4 text-warning" />
            <span className="flex-1">
              {t('detail.inTrash')} · {t('trash.daysLeft', { days: trashDaysLeft(task.deleted_at, now) })}
            </span>
            <Button size="sm" icon={<RotateCcw />} onClick={() => void actions.restore([task.id])}>
              {t('actions.restore')}
            </Button>
          </div>
        )}

        {parent && (
          <button
            type="button"
            onClick={() => open(parent.id)}
            className="focus-ring mb-2 inline-flex max-w-full items-center gap-1.5 rounded-sm text-sm text-fg-3 hover-ok:text-fg"
          >
            <CornerLeftUp aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{t('detail.parent', { title: parent.title })}</span>
          </button>
        )}

        <div className="flex items-start gap-3">
          {leading}
          <div className="min-w-0 flex-1">
            <TitleEditor task={task} readOnly={readOnly} onSave={(title) => update({ title })} />
          </div>
        </div>

        {type !== 'normal' && (
          <div className="mt-4">
            <TypeWidget task={task} parts={parts} progress={progress} prefs={prefs} today={today} now={now} actions={actions} readOnly={readOnly} />
          </div>
        )}

        <div className={cn('mt-5 flex flex-col gap-0.5', readOnly && 'pointer-events-none opacity-70')}>
          <h3 className="sr-only">{t('detail.properties')}</h3>
          <PropertyRow icon={<CalendarDays />} label={t('detail.due')}>
            <DateField
              date={task.due_date}
              time={task.due_time}
              today={today}
              prefs={prefs}
              overdue={overdue}
              placeholder={t('detail.noDate')}
              onChange={(date, time) => update({ due_date: date, due_time: time } as Partial<TaskRow>)}
            />
          </PropertyRow>
          <PropertyRow icon={<CalendarClock />} label={t('detail.start')}>
            <DateField
              date={task.start_date}
              time={task.start_time}
              today={today}
              prefs={prefs}
              placeholder={t('detail.none')}
              onChange={(date, time) => update({ start_date: date, start_time: date ? time : null } as Partial<TaskRow>)}
            />
          </PropertyRow>
          <PropertyRow icon={<Repeat />} label={t('detail.repeat')}>
            <RecurrenceField value={task.recurrence} anchor={task.due_date ?? today} prefs={prefs} today={today} onChange={setRecurrence} />
          </PropertyRow>
          <PropertyRow icon={<Flag />} label={t('priority.label')}>
            <PriorityPicker value={task.priority_id} priorities={catalog.priorities} onChange={(priority_id) => update({ priority_id })} />
          </PropertyRow>
          <PropertyRow icon={<CircleDot />} label={t('status.label')}>
            <StatusPicker value={status?.id ?? null} statuses={catalog.statuses} onChange={(statusId) => void setStatus(statusId)} />
          </PropertyRow>
          <PropertyRow icon={<span className="size-3 rounded-full border border-current" />} label={t('detail.project')}>
            <ProjectPicker
              value={task.project_id}
              projects={catalog.projects}
              onPick={(project_id) => update({ project_id })}
              onCreate={async (name) => update({ project_id: await ensureProject(actions.ctx, name) })}
            />
          </PropertyRow>
          <PropertyRow icon={<Tags />} label={t('detail.tags')}>
            <TagsPicker
              tags={catalog.tags}
              selected={tagRows}
              onToggle={(tag) => {
                const names = tagRows.some((x) => x.id === tag.id) ? tagRows.filter((x) => x.id !== tag.id).map((x) => x.name) : [...tagRows.map((x) => x.name), tag.name];
                void setTags(names);
              }}
              onCreate={async (name) => {
                await ensureTag(actions.ctx, name);
                await setTags([...tagRows.map((x) => x.name), name]);
              }}
            />
          </PropertyRow>
          <PropertyRow icon={<Hourglass />} label={t('detail.estimate')}>
            <EstimatePicker value={task.estimate_minutes} onChange={(estimate_minutes) => update({ estimate_minutes })} />
          </PropertyRow>
          <PropertyRow icon={<Bell />} label={t('detail.reminders')} className="items-start [&>span]:mt-2.5">
            <RemindersPicker value={task.reminders} hasDue={Boolean(task.due_date)} onChange={(next: Reminder[]) => update({ reminders: next as never })} />
          </PropertyRow>
          <PropertyRow icon={<Palette />} label={t('detail.appearance')}>
            <ColorPicker value={task.color} onChange={(color) => update({ color })} />
          </PropertyRow>
        </div>

        <section className="mt-6">
          <h3 className="mb-2 text-xs font-semibold tracking-[0.08em] text-fg-3 uppercase">{t('detail.description')}</h3>
          {readOnly ? (
            <p className="text-base whitespace-pre-wrap text-fg-2">{task.description_text || '—'}</p>
          ) : (
            <DescriptionEditor
              key={task.id}
              value={task.description}
              label={t('detail.description')}
              placeholder={t('detail.descriptionPlaceholder')}
              onSave={(doc, text) => update({ description: doc as never, description_text: text })}
            />
          )}
        </section>

        <div className="mt-6">
          <Subtasks parent={task} tasks={tasks} readOnly={readOnly} today={today} prefs={prefs} actions={actions} onOpen={open} />
        </div>

        <div className="mt-6">
          <Attachments task={task} attachments={parts.attachments} readOnly={readOnly} actions={actions} />
        </div>

        <div className="mt-6">
          <DetailTabs task={task} parts={parts} prefs={prefs} today={today} actions={actions} readOnly={readOnly} />
        </div>

        <p className="mt-6 text-xs text-fg-3">
          {t('detail.created', { date: formatLongDate(todayIn(prefs.timeZone, new Date(task.created_at)), prefs.locale, today) })}
          {task.completed_at &&
            ` · ${t('detail.completedAt', { date: formatLongDate(todayIn(prefs.timeZone, new Date(task.completed_at)), prefs.locale, today) })}`}
        </p>
      </div>

      {templateOpen && <SaveTemplateDialog task={task} parts={parts} onClose={() => setTemplateOpen(false)} />}
    </div>
  );
}
