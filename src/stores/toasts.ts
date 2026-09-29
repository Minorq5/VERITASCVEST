'use client';

import { create } from 'zustand';
import { sound } from '@/sound/engine';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: ToastAction;
  /** Milliseconds before auto-dismiss; `Infinity` keeps it until dismissed. */
  duration: number;
  /** Undo toasts show a countdown ring around the action. */
  countdown?: boolean;
  createdAt: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id' | 'createdAt'> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: ({ id, ...toast }) => {
    const toastId = id ?? `t${Date.now().toString(36)}${(counter += 1)}`;
    set((state) => ({
      // Re-pushing the same id replaces the toast instead of stacking duplicates.
      toasts: [
        ...state.toasts.filter((t) => t.id !== toastId),
        { ...toast, id: toastId, createdAt: Date.now() },
      ].slice(-5),
    }));
    return toastId;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

const DEFAULT_DURATION = 4500;
export const UNDO_DURATION = 6000;

type Options = Partial<Pick<ToastItem, 'description' | 'action' | 'duration' | 'id'>>;

const push = (tone: ToastTone, title: string, options: Options = {}) =>
  useToasts.getState().push({ tone, title, duration: DEFAULT_DURATION, ...options });

/** Imperative API usable from anywhere (event handlers, sync engine, stores). */
export const toast = {
  info: (title: string, options?: Options) => push('info', title, options),
  success: (title: string, options?: Options) => push('success', title, options),
  warning: (title: string, options?: Options) => push('warning', title, options),
  error: (title: string, options?: Options) => {
    sound.play('error');
    return push('error', title, { duration: 8000, ...options });
  },
  /** Action completed with a way back. The action label is usually "Undo". */
  undo: (title: string, undoLabel: string, onUndo: () => void, options?: Options) =>
    useToasts.getState().push({
      tone: 'success',
      title,
      duration: UNDO_DURATION,
      countdown: true,
      action: { label: undoLabel, onClick: onUndo },
      ...options,
    }),
  dismiss: (id: string) => useToasts.getState().dismiss(id),
};
