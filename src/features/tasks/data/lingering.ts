'use client';

import { create } from 'zustand';
import type { TaskRow } from '@/lib/db/types';

/**
 * Tasks just checked off stay in their list for a moment, drawn as done, so
 * the star can ignite before the row glides away. The row keeps the place it
 * had before (its snapshot), even if completing moved its date.
 */
export const useLingering = create<{
  rows: ReadonlyMap<string, TaskRow>;
  add: (task: TaskRow, ms?: number) => void;
}>((set) => ({
  rows: new Map(),
  add: (task, ms = 1100) => {
    set((s) => ({ rows: new Map(s.rows).set(task.id, task) }));
    setTimeout(() => {
      set((s) => {
        const rows = new Map(s.rows);
        rows.delete(task.id);
        return { rows };
      });
    }, ms);
  },
}));
