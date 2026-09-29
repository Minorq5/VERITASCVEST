'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { keyBetween } from '@/lib/order';
import { cn } from '@/lib/utils/cn';
import type { PlannerPrefs } from '../data/hooks';
import type { TaskActions } from '../data/use-task-actions';
import type { RowModel } from './row-model';
import { TaskRowItem } from './task-row';
import { sound } from '@/sound/engine';

export interface TaskListProps {
  rows: RowModel[];
  today: string;
  prefs: PlannerPrefs;
  actions: TaskActions;
  activeId: string | null;
  selected: ReadonlySet<string>;
  selecting: boolean;
  lingering: { has: (id: string) => boolean };
  onOpen: (id: string) => void;
  onSelect: (id: string, range: boolean) => void;
  variant?: 'list' | 'completed' | 'trash';
  hideDate?: boolean;
  /** Manual order: rows can be dragged (inbox, projects). */
  sortable?: boolean;
  note?: (row: RowModel) => ReactNode;
  label?: string;
}

function SortableRow({ id, title, children }: { id: string; title: string; children: (handle: ReactNode) => ReactNode }) {
  const t = useTranslations('tasks');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={t('row.drag', { title })}
      className={cn(
        'focus-ring absolute top-3 left-0 hidden h-6 w-4 cursor-grab touch-none items-center justify-center rounded-xs text-fg-4 active:cursor-grabbing sm:inline-flex',
        'pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-visible:opacity-100',
      )}
    >
      <GripVertical aria-hidden className="size-3.5" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 bg-surface-3 outline outline-1 outline-line-bright')}
    >
      {children(handle)}
    </div>
  );
}

export function TaskList(props: TaskListProps) {
  const { rows, sortable, actions, label } = props;
  const reduce = useLessMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const renderRow = (row: RowModel, handle?: ReactNode) => (
    <TaskRowItem
      model={row}
      variant={props.variant}
      hideDate={props.hideDate}
      active={props.activeId === row.task.id}
      selected={props.selected.has(row.task.id)}
      selecting={props.selecting}
      lingering={props.lingering.has(row.task.id)}
      today={props.today}
      prefs={props.prefs}
      actions={actions}
      onOpen={props.onOpen}
      onSelect={props.onSelect}
      note={props.note?.(row)}
      dragHandle={handle}
    />
  );

  const items = (
    <AnimatePresence initial={false}>
      {rows.map((row) => (
        <motion.li
          key={row.key ?? row.task.id}
          layout={reduce ? false : 'position'}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.28, ease: [0.65, 0, 0.35, 1] } }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden border-b border-line last:border-b-0"
        >
          {sortable ? <SortableRow id={row.task.id} title={row.task.title}>{(handle) => renderRow(row, handle)}</SortableRow> : renderRow(row)}
        </motion.li>
      ))}
    </AnimatePresence>
  );

  const list = (
    <ul aria-label={label} className="overflow-hidden rounded-lg border border-line bg-surface-1">
      {items}
    </ul>
  );

  if (!sortable) return list;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.task.id === active.id);
    const to = rows.findIndex((r) => r.task.id === over.id);
    if (from < 0 || to < 0) return;
    const ordered = arrayMove(rows, from, to);
    const prev = ordered[to - 1]?.task.sort_key ?? null;
    const next = ordered[to + 1]?.task.sort_key ?? null;
    // Equal keys can come from two offline devices; then the item goes right after its upper neighbour.
    const key = prev && next && prev >= next ? keyBetween(prev, null) : keyBetween(prev, next);
    void actions.update(String(active.id), { sort_key: key });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={() => sound.play('dragPickup')}
      onDragOver={() => sound.play('dragOver')}
      onDragEnd={(event) => {
        sound.play('dragDrop');
        onDragEnd(event);
      }}
    >
      <SortableContext items={rows.map((r) => r.task.id)} strategy={verticalListSortingStrategy}>
        {list}
      </SortableContext>
    </DndContext>
  );
}
