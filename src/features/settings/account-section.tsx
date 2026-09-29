'use client';

import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useProfile } from '@/features/account/queries';
import { signOut } from '@/features/shell/sign-out';
import { useRouter } from '@/i18n/navigation';
import { authErrorKey } from '@/lib/auth/errors';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toasts';
import { ChangeEmailDialog } from './change-email-dialog';
import { ChangePasswordDialog } from './change-password-dialog';
import { DeleteAccountDialog } from './delete-account-dialog';
import { SettingRow, SettingsGroup } from './setting-row';

export function AccountSection() {
  const t = useTranslations();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const profile = useProfile().data;
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState<'here' | 'all' | null>(null);
  if (!user || !profile) return null;
  const email = user.email ?? '';

  async function leave(scope: 'local' | 'global') {
    setBusy(scope === 'local' ? 'here' : 'all');
    try {
      await signOut(scope);
      if (scope === 'global') toast.success(t('settings.account.signedOutAll'));
      router.replace('/login');
    } catch (error) {
      toast.error(t(`auth.errors.${authErrorKey(error)}`));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <SettingsGroup title={t('settings.account.signIn')}>
        <SettingRow
          stack
          label={t('settings.account.email')}
          description={
            <>
              <span className="break-all">{email}</span>
              {user.new_email && (
                <span className="mt-1 block text-warning">{t('settings.account.emailPending', { email: user.new_email })}</span>
              )}
            </>
          }
          control={<ChangeEmailDialog currentEmail={email} />}
        />
        <SettingRow
          stack
          label={t('settings.account.password')}
          description={t('settings.account.passwordHint')}
          control={<ChangePasswordDialog email={email} context={[email, profile.username, profile.display_name]} />}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.account.sessions')} description={t('settings.account.sessionsText')}>
        <SettingRow
          stack
          label={t('settings.account.signOutHere')}
          control={
            <Button size="sm" icon={<LogOut />} loading={busy === 'here'} onClick={() => void leave('local')}>
              {t('shell.signOut')}
            </Button>
          }
        />
        <SettingRow
          stack
          label={t('settings.account.signOutAll')}
          description={t('settings.account.signOutAllText')}
          control={
            <Dialog
              open={confirmAll}
              onOpenChange={setConfirmAll}
              trigger={
                <Button size="sm" icon={<MonitorSmartphone />}>
                  {t('settings.account.signOutAllShort')}
                </Button>
              }
              title={t('settings.account.signOutAll')}
              description={t('settings.account.signOutAllText')}
              size="sm"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setConfirmAll(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button variant="primary" loading={busy === 'all'} onClick={() => void leave('global')}>
                    {t('settings.account.signOutAllShort')}
                  </Button>
                </>
              }
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.account.danger')} tone="danger">
        <SettingRow
          stack
          label={t('settings.account.delete')}
          description={t('settings.account.deleteText')}
          control={<DeleteAccountDialog username={profile.username} />}
        />
      </SettingsGroup>
    </div>
  );
}
