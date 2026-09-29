'use client';

import { create } from 'zustand';
import type { Change } from '@/lib/sync/repo';

/**
 * Undo / redo history for the session. An entry is the list of changes that
 * reverts one action (see Repo: every write returns its inverse). Applying it
 * gives the changes that redo the action, which go on the other stack.
 */
export interface UndoEntry {
  id: number;
  /** Short description of the action, shown after undo/redo. */
  label: string;
  changes: Change[];
}

interface UndoState {
  past: UndoEntry[];
  future: UndoEntry[];
  /** Records an action; returns its id (the toast's undo button uses it). */
  record: (label: string, changes: Change[]) => number | null;
  /** Takes an entry off the undo stack (the newest, or a specific one). */
  takePast: (id?: number) => UndoEntry | null;
  takeFuture: () => UndoEntry | null;
  pushPast: (entry: Omit<UndoEntry, 'id'>) => void;
  pushFuture: (entry: Omit<UndoEntry, 'id'>) => void;
  clear: () => void;
}

const LIMIT = 50;
let seq = 0;

export const useUndo = create<UndoState>((set, get) => ({
  past: [],
  future: [],
  record: (label, changes) => {
    if (changes.length === 0) return null;
    const id = (seq += 1);
    set((s) => ({ past: [...s.past, { id, label, changes }].slice(-LIMIT), future: [] }));
    return id;
  },
  takePast: (id) => {
    const { past } = get();
    const entry = id === undefined ? past.at(-1) : past.find((e) => e.id === id);
    if (!entry) return null;
    set({ past: past.filter((e) => e !== entry) });
    return entry;
  },
  takeFuture: () => {
    const entry = get().future.at(-1);
    if (!entry) return null;
    set((s) => ({ future: s.future.slice(0, -1) }));
    return entry;
  },
  pushPast: (entry) => set((s) => ({ past: [...s.past, { ...entry, id: (seq += 1) }].slice(-LIMIT) })),
  pushFuture: (entry) => set((s) => ({ future: [...s.future, { ...entry, id: (seq += 1) }].slice(-LIMIT) })),
  clear: () => set({ past: [], future: [] }),
}));
