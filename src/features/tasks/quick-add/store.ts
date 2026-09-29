'use client';

import { create } from 'zustand';
import type { TaskQuery } from '@/lib/domain/filters';
import type { Section } from '@/lib/domain/sections';

/** Where new tasks go by default: the list on screen. */
export type ListScope =
  | { kind: 'section'; section: Section }
  | { kind: 'project'; projectId: string }
  | { kind: 'tag'; tagId: string }
  /** A smart list with its query as shown (possibly edited, not yet saved); `listId` null — a new one. */
  | { kind: 'smart'; listId: string | null; query: TaskQuery }
  | null;

/** A stable key of a list: its settings and filters are kept under it. */
export function scopeKey(scope: NonNullable<ListScope>): string {
  switch (scope.kind) {
    case 'section':
      return scope.section;
    case 'project':
      return `project:${scope.projectId}`;
    case 'tag':
      return `tag:${scope.tagId}`;
    case 'smart':
      return `smart:${scope.listId ?? 'new'}`;
  }
}

interface QuickAddState {
  open: boolean;
  /** The list currently on screen (set by list pages). */
  scope: ListScope;
  setOpen: (open: boolean) => void;
  setScope: (scope: ListScope) => void;
}

export const useQuickAdd = create<QuickAddState>((set) => ({
  open: false,
  scope: null,
  setOpen: (open) => set({ open }),
  setScope: (scope) => set({ scope }),
}));
