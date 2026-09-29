'use client';

import { Hash } from 'lucide-react';
import { useMemo } from 'react';
import { useTaskIndex, useVisibleTasks } from '@/features/tasks/data/hooks';
import { swatchVar } from '@/lib/color/swatches';

export interface TagCounts {
  /** Open tasks with the tag. */
  open: number;
  /** Every living task with the tag (for the delete warning). */
  all: number;
}

/** How many tasks carry each tag. */
export function useTagCounts(): Map<string, TagCounts> | null {
  const tasks = useVisibleTasks();
  const index = useTaskIndex();
  return useMemo(() => {
    if (!tasks || !index) return null;
    const counts = new Map<string, TagCounts>();
    for (const task of tasks) {
      if (task.deleted_at) continue;
      for (const tagId of index.tags.get(task.id) ?? []) {
        const c = counts.get(tagId) ?? { open: 0, all: 0 };
        c.all += 1;
        if (!task.completed_at) c.open += 1;
        counts.set(tagId, c);
      }
    }
    return counts;
  }, [tasks, index]);
}

/** The "#" of a tag in its colour. */
export function TagMark({ color, size = 'md' }: { color: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={
        size === 'lg'
          ? 'inline-flex size-12 shrink-0 items-center justify-center rounded-md border border-line bg-surface-1'
          : 'inline-flex shrink-0 items-center justify-center'
      }
      style={{ color: swatchVar(color) }}
    >
      <Hash className={size === 'lg' ? 'size-6' : size === 'md' ? 'size-4' : 'size-3.5'} strokeWidth={size === 'lg' ? 1.75 : 2} />
    </span>
  );
}
