'use client';

import { create } from 'zustand';

/** Tasks picked for a bulk action (X, Shift+click, long press). */
interface SelectionState {
  ids: ReadonlySet<string>;
  /** Last clicked row, the start of a Shift+click range. */
  anchor: string | null;
  toggle: (id: string) => void;
  selectRange: (orderedIds: readonly string[], to: string) => void;
  set: (ids: Iterable<string>) => void;
  clear: () => void;
}

export const useSelection = create<SelectionState>((set, get) => ({
  ids: new Set(),
  anchor: null,
  toggle: (id) =>
    set((s) => {
      const ids = new Set(s.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { ids, anchor: id };
    }),
  selectRange: (orderedIds, to) => {
    const { anchor, ids } = get();
    const from = anchor ? orderedIds.indexOf(anchor) : -1;
    const end = orderedIds.indexOf(to);
    if (from < 0 || end < 0) {
      get().toggle(to);
      return;
    }
    const [a, b] = from < end ? [from, end] : [end, from];
    const next = new Set(ids);
    for (const id of orderedIds.slice(a, b + 1)) next.add(id);
    set({ ids: next, anchor: to });
  },
  set: (ids) => set({ ids: new Set(ids) }),
  clear: () => set({ ids: new Set(), anchor: null }),
}));
