'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { currentSync } from '@/features/sync/sync-handle';
import { useRouter } from '@/i18n/navigation';
import { authErrorKey } from '@/lib/auth/errors';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toasts';
import { pendingChanges, signOut } from './sign-out';

/**
 * Sign-out that never silently drops work: when changes are still waiting to
 * be sent, it asks first ("wait" pushes them now).
 */
export function useSafeSignOut(): {
  request: (scope?: 'local' | 'global') => Promise<void>;
  dialog: ReactNode;
} {
  const t = useTranslations();
  const router = useRouter();
  const [pending, setPending] = useState<{ count: number; scope: 'local' | 'global' } | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (scope: 'local' | 'global') => {
    setBusy(true);
    try {
      await signOut(scope);
      if (scope === 'global') toast.success(t('settings.account.signedOutAll'));
      router.replace('/login');
    } catch (error) {
      toast.error(t(`auth.errors.${authErrorKey(error)}`));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const request = async (scope: 'local' | 'global' = 'local') => {
    const count = await pendingChanges();
    if (count > 0) {
      setPending({ count, scope });
      return;
    }
    await finish(scope);
  };

  const dialog = (
    <ResponsiveDialog
      open={pending !== null}
      onOpenChange={(open) => !open && !busy && setPending(null)}
      title={t('sync.signOutTitle')}
      description={t('sync.signOutText', { count: pending?.count ?? 0 })}
      size="sm"
      footer={
        <>
          <Button
            variant="primary"
            onClick={() => {
              const handle = currentSync(useSession.getState().user?.id);
              void handle?.engine.syncNow();
              setPending(null);
            }}
          >
            {t('sync.signOutWait')}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => pending && void finish(pending.scope)}>
            {t('sync.signOutAnyway')}
          </Button>
        </>
      }
    />
  );

  return { request, dialog };
}
