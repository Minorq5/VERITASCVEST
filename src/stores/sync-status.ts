'use client';

import { create } from 'zustand';
import type { SyncStatus } from '@/lib/sync/engine';

/** What the sync indicator shows. */
export const useSyncStatus = create<{ status: SyncStatus | null; set: (s: SyncStatus | null) => void }>((set) => ({
  status: null,
  set: (status) => set({ status }),
}));
