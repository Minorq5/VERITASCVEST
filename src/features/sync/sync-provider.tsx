'use client';

import { useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toasts';
import { useUndo } from '@/stores/undo';
import { openSync, type SyncHandle } from './sync-handle';

const SyncContext = createContext<SyncHandle | null>(null);

/** Opens the device copy of the signed-in account's data and keeps it in sync. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('sync');
  const userId = useSession((s) => s.user?.id);
  const accessToken = useSession((s) => s.session?.access_token);
  const handle = useMemo(() => (userId ? openSync(userId) : null), [userId]);

  useEffect(() => {
    if (!handle) return;
    void handle.engine.start();
    return () => {
      void handle.engine.stop();
    };
  }, [handle]);

  // Undo history belongs to one account.
  useEffect(() => () => useUndo.getState().clear(), [userId]);

  // A refreshed sign-in lets a sync that was refused ("sign in again") continue.
  useEffect(() => {
    if (handle && accessToken && handle.engine.getStatus().state === 'auth') void handle.engine.syncNow();
  }, [handle, accessToken]);

  useEffect(() => {
    if (!handle) return;
    handle.setNotify({
      conflict: () => toast.info(t('conflict'), { id: 'sync-conflict', description: t('conflictText') }),
      rejected: (n) =>
        toast.error(t('rejected'), {
          id: `sync-rejected-${n.rowId}`,
          description: t(n.op === 'insert' ? 'rejectedCreate' : 'rejectedChange'),
        }),
    });
  }, [handle, t]);

  if (!handle) return null;
  return <SyncContext.Provider value={handle}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncHandle {
  const handle = useContext(SyncContext);
  if (!handle) throw new Error('useSync outside SyncProvider');
  return handle;
}
