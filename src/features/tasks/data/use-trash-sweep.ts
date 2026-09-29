'use client';

import { useEffect, useRef } from 'react';
import { useSync } from '@/features/sync/sync-provider';
import type { TaskRow } from '@/lib/db/types';
import { useSyncStatus } from '@/stores/sync-status';

const RETENTION_MS = 30 * 86_400_000;

/**
 * Tasks stay in the trash for 30 days, then they are deleted for good. The
 * sweep runs once per session in the syncing tab, and only right after a
 * successful sync: a task restored on another device must never be erased
 * from a stale copy. (A server-side schedule takes this over in stage 10.)
 */
export function useTrashSweep() {
  const { db, repo } = useSync();
  const status = useSyncStatus((s) => s.status);
  const done = useRef(false);
  const ready = Boolean(status?.leader && status.bootstrapped && status.lastSyncAt && status.state === 'idle');

  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    void (async () => {
      const cutoff = Date.now() - RETENTION_MS;
      const tasks = (await db.tasks.toArray()) as unknown as TaskRow[];
      const deleted = new Set(tasks.filter((t) => t.deleted_at).map((t) => t.id));
      for (const task of tasks) {
        if (!task.deleted_at || Date.parse(task.deleted_at) > cutoff) continue;
        // Subtasks go together with their parent.
        if (task.parent_id && deleted.has(task.parent_id)) continue;
        await repo.remove('tasks', task.id);
      }
    })();
  }, [ready, db, repo]);
}
