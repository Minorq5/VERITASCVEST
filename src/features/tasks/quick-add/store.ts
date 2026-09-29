'use client';

import { create } from 'zustand';
import type { Section } from '@/lib/domain/sections';

/** Where new tasks go by default: the list on screen. */
export type ListScope = { kind: 'section'; section: Section } | { kind: 'project'; projectId: string } | null;

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
