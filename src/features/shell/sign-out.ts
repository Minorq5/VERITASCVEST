'use client';

import { forgetSettings } from '@/features/account/queries';
import { closeSync, currentSync } from '@/features/sync/sync-handle';
import { getSupabase } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';
import { useUndo } from '@/stores/undo';

/**
 * Signs out on this device (`local`) or on every device (`global`). The
 * device copy of the account's data is erased: the next person at this
 * computer sees nothing of it.
 */
export async function signOut(scope: 'local' | 'global' = 'local') {
  const userId = useSession.getState().user?.id;
  const { error } = await getSupabase().auth.signOut({ scope });
  if (error) throw error;
  await forgetDevice(userId);
}

/** Erases this account's data from the device (after sign-out or account deletion). */
export async function forgetDevice(userId: string | undefined) {
  useUndo.getState().clear();
  if (!userId) return;
  forgetSettings(userId);
  await closeSync(userId, { wipe: true }).catch(() => undefined);
}

/** Changes made on this device that have not reached the server yet. */
export async function pendingChanges(): Promise<number> {
  const handle = currentSync(useSession.getState().user?.id);
  if (!handle) return 0;
  handle.engine.poke();
  return handle.db.outbox.count();
}
