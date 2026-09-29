'use client';

import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { StarCheck } from '@/components/ui/star-check';
import type { TaskRow } from '@/lib/db/types';
import { compareManual } from '@/lib/domain/sections';
import { keyBetween } from '@/lib/order';
import type { IsoDate } from '@/lib/time/dates';
import { cn } from '@/lib/utils/cn';
import type { PlannerPrefs } from '../data/hooks';
import type { TaskActions } from '../data/use-task-actions';
import { dueTone, relativeDay } from '../format';

const toneClass = { overdue: 'text-danger', today: 'text-accent', soon: 'text-warning', later: 'text-fg-3' } as const;

function Item({
  task,
  childCount,
  readOnly,
  today,
  prefs,
  actions,
  onOpen,
}: {
  task: TaskRow;
  childCount: { done: number; total: number } | null;
  readOnly: boolean;
  today: IsoDate;
  prefs: PlannerPrefs;
  actions: TaskActions;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations('tasks');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: readOnly });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group/sub relative flex items-center gap-2.5 rounded-md py-1.5 pr-1 pl-5', isDragging ? 'z-10 bg-surface-4 shadow-lg' : 'hover-ok:bg-surface-3/60')}
    >
      {!readOnly && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('row.drag', { title: task.title })}
          className="focus-ring absolute left-0 inline-flex h-6 w-4 cursor-grab touch-none items-center justify-center text-fg-4 pointer-fine:opacity-0 pointer-fine:group-hover/sub:opacity-100"
        >
          <GripVertical aria-hidden className="size-3.5" />
        </button>
      )}
      <StarCheck
        checked={Boolean(task.completed_at)}
        size={20}
        disabled={readOnly}
        label={task.completed_at ? t('row.reopen', { title: task.title }) : t('row.complete', { title: task.title })}
        onCheckedChange={() => void actions.toggle(task)}
      />
      <button type="button" onClick={() => onOpen(task.id)} className="focus-ring flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left">
        <span className={cn('truncate text-base', task.completed_at ? 'text-fg-3 line-through' : 'text-fg')}>{task.title}</span>
        {task.due_date && !task.completed_at && (
          <span className={cn('shrink-0 text-xs', toneClass[dueTone(task.due_date, today, task.due_date < today)])}>
            {relativeDay(task.due_date, today, prefs.locale, t)}
          </span>
        )}
        {childCount && (
          <span className="shrink-0 font-mono text-xs text-fg-3 tabular">
            {childCount.done}/{childCount.total}
          </span>
        )}
        <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-fg-4 group-hover/sub:text-fg-3" />
      </button>
      {!readOnly && (
        <IconButton
          size="sm"
          variant="danger"
          label={t('actions.delete')}
          icon={<Trash2 />}
          className="pointer-fine:opacity-0 pointer-fine:group-hover/sub:opacity-100"
          onClick={() => void actions.trash([task.id])}
        />
      )}
    </li>
  );
}

/** Subtasks of any depth: each opens as its own task with its own subtasks. */
export function Subtasks({
  parent,
  tasks,
  readOnly,
  today,
  prefs,
  actions,
  onOpen,
}: {
  parent: TaskRow;
  tasks: readonly TaskRow[];
  readOnly: boolean;
  today: IsoDate;
  prefs: PlannerPrefs;
  actions: TaskActions;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations('tasks');
  const [title, setTitle] = useState('');
  const children = tasks.filter((x) => x.parent_id === parent.id && !x.deleted_at).sort(compareManual);
  const counts = new Map<string, { done: number; total: number }>();
  for (const x of tasks) {
    if (!x.parent_id || x.deleted_at) continue;
    const c = counts.get(x.parent_id) ?? { done: 0, total: 0 };
    c.total += 1;
    if (x.completed_at) c.done += 1;
    counts.set(x.parent_id, c);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = children.findIndex((c) => c.id === active.id);
    const to = children.findIndex((c) => c.id === over.id);
    const ordered = arrayMove(children, from, to);
    const prev = ordered[to - 1]?.sort_key ?? null;
    const next = ordered[to + 1]?.sort_key ?? null;
    void actions.update(String(active.id), { sort_key: prev && next && prev >= next ? keyBetween(prev, null) : keyBetween(prev, next) });
  };

  const add = async () => {
    const clean = title.trim();
    if (!clean) return;
    setTitle('');
    await actions.create({ title: clean, parent_id: parent.id, project_id: parent.project_id });
  };

  return (
    <section aria-labelledby={`subtasks-${parent.id}`}>
      <h3 id={`subtasks-${parent.id}`} className="mb-2 text-xs font-semibold tracking-[0.08em] text-fg-3 uppercase">
        {t('detail.subtasks')}
        {children.length > 0 && (
          <span className="ml-2 font-mono tabular">
            {children.filter((c) => c.completed_at).length}/{children.length}
          </span>
        )}
      </h3>
      {children.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
          <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="-mx-1 flex flex-col">
              {children.map((child) => (
                <Item
                  key={child.id}
                  task={child}
                  childCount={counts.get(child.id) ?? null}
                  readOnly={readOnly}
                  today={today}
                  prefs={prefs}
                  actions={actions}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {!readOnly && (
        <form
          className="mt-1.5 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Plus aria-hidden className="size-4 shrink-0 text-fg-3" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            placeholder={t('detail.subtaskPlaceholder')}
            aria-label={t('detail.addSubtask')}
            className="h-9 min-w-0 flex-1 rounded-md bg-transparent px-1 text-base text-fg outline-none placeholder:text-fg-4 focus-visible:bg-surface-3"
          />
          {title.trim() && (
            <Button size="sm" type="submit">
              {t('detail.addSubtask')}
            </Button>
          )}
        </form>
      )}
    </section>
  );
}
