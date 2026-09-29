'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TaskQuery } from '@/lib/domain/filters';
import { isSortMode, type SortMode } from '@/lib/domain/sort';

export const LIST_VIEWS_KEY = 'vt:list-views';

interface ListViewsState {
  /** Sort order of lists whose settings live on this device (sections, tags), by list key. */
  sort: Record<string, SortMode>;
  setSort: (key: string, mode: SortMode) => void;
}

/**
 * How lists are shown on this device. Projects and smart lists keep theirs
 * in the account instead (they follow the person to every device).
 * Hydrated after the first render (see AppShell), so server and client markup match.
 */
export const useListViews = create<ListViewsState>()(
  persist(
    (set) => ({
      sort: {},
      setSort: (key, mode) => set((s) => ({ sort: { ...s.sort, [key]: mode } })),
    }),
    {
      name: LIST_VIEWS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ sort }) => ({ sort }),
      // Stored data is never trusted: unknown modes are dropped.
      merge: (persisted, current) => {
        const raw = (persisted as { sort?: Record<string, unknown> } | null)?.sort ?? {};
        const sort: Record<string, SortMode> = {};
        for (const [key, mode] of Object.entries(raw)) if (isSortMode(mode)) sort[key] = mode;
        return { ...current, sort };
      },
    },
  ),
);

interface ListFiltersState {
  /** Filters narrowing the list on screen, by list key (kept until the tab closes). */
  queries: Record<string, TaskQuery>;
  /** Lists whose filter bar is open. */
  open: Record<string, boolean>;
  setQuery: (key: string, query: TaskQuery) => void;
  setOpen: (key: string, open: boolean) => void;
  clear: (key: string) => void;
}

export const useListFilters = create<ListFiltersState>((set) => ({
  queries: {},
  open: {},
  setQuery: (key, query) => set((s) => ({ queries: { ...s.queries, [key]: query } })),
  setOpen: (key, open) => set((s) => ({ open: { ...s.open, [key]: open } })),
  clear: (key) =>
    set((s) => {
      const { [key]: _gone, ...queries } = s.queries;
      return { queries };
    }),
}));
