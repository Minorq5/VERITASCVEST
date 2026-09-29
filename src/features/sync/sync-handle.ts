'use client';

import Dexie, { liveQuery } from 'dexie';
import { VeritasDB, dbName } from '@/lib/db/schema';
import { SyncEngine, type ConflictNotice, type RejectedNotice } from '@/lib/sync/engine';
import { Repo } from '@/lib/sync/repo';
import { supabaseTransport } from '@/lib/sync/supabase-transport';
import { getSupabase } from '@/lib/supabase/client';
import { useSyncStatus } from '@/stores/sync-status';

type Notify = { conflict?: (n: ConflictNotice) => void; rejected?: (n: RejectedNotice) => void };

export interface SyncHandle {
  userId: string;
  db: VeritasDB;
  repo: Repo;
  engine: SyncEngine;
  /** The interface sets these to show toasts in the current language. */
  notify: Notify;
  setNotify: (next: Notify) => void;
  dispose: () => void;
}

const handles = new Map<string, SyncHandle>();

/** One local database and one engine per signed-in account (shared by every component). */
export function openSync(userId: string): SyncHandle {
  const existing = handles.get(userId);
  if (existing) return existing;
  const db = new VeritasDB(dbName(userId));
  const notify: SyncHandle['notify'] = {};
  const engine = new SyncEngine({
    db,
    transport: supabaseTransport(getSupabase(), `sync:${userId}`),
    lockName: `veritas-sync-${userId}`,
    onStatus: (s) => useSyncStatus.getState().set(s),
    onConflict: (n) => notify.conflict?.(n),
    onRejected: (n) => notify.rejected?.(n),
  });
  const repo = new Repo({ db, onWrite: () => engine.poke() });
  // Other tabs write into the same outbox: the syncing tab notices and pushes.
  const subscription = liveQuery(() => db.outbox.count()).subscribe({ next: () => engine.poke() });
  const handle: SyncHandle = {
    userId,
    db,
    repo,
    engine,
    notify,
    setNotify: (next) => Object.assign(notify, next),
    dispose: () => subscription.unsubscribe(),
  };
  handles.set(userId, handle);
  return handle;
}

export function currentSync(userId: string | undefined): SyncHandle | null {
  return userId ? (handles.get(userId) ?? null) : null;
}

/** Stops syncing; `wipe` also erases the device copy (sign-out, account deletion). */
export async function closeSync(userId: string, { wipe }: { wipe: boolean }): Promise<void> {
  const handle = handles.get(userId);
  handles.delete(userId);
  if (handle) {
    handle.dispose();
    await handle.engine.stop();
    handle.db.close();
  }
  if (wipe) await Dexie.delete(dbName(userId));
  useSyncStatus.getState().set(null);
}
