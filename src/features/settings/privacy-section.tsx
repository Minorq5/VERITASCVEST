'use client';

import { useTranslations } from 'next-intl';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  useProfile,
  useSettings,
  useUpdateProfile,
  useUpdateSettings,
} from '@/features/account/queries';
import { authErrorKey } from '@/lib/auth/errors';
import { toast } from '@/stores/toasts';
import { SettingRow, SettingsGroup } from './setting-row';

const FRIEND_REQUESTS = ['everyone', 'friends_of_friends', 'nobody'] as const;
const LABEL = {
  everyone: 'everyone',
  friends_of_friends: 'friendsOfFriends',
  nobody: 'nobody',
} as const;

export function PrivacySection() {
  const t = useTranslations('settings.privacy');
  const tErrors = useTranslations('auth.errors');
  const settings = useSettings().data;
  const profile = useProfile().data;
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  if (!settings || !profile) return null;

  const fail = (error: unknown) => toast.error(tErrors(authErrorKey(error)));

  return (
    <div className="flex flex-col gap-8">
      <SettingsGroup title={t('friendRequests')}>
        <SettingRow>
          <RadioGroup
            aria-label={t('friendRequests')}
            value={settings.friend_requests}
            onValueChange={(v) => updateSettings.mutate({ friend_requests: v }, { onError: fail })}
          >
            {FRIEND_REQUESTS.map((v) => (
              <RadioItem key={v} value={v} label={t(LABEL[v])} description={t(`${LABEL[v]}Hint`)} />
            ))}
          </RadioGroup>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={t('visibility')}>
        <SettingRow>
          <Switch
            label={t('searchable')}
            description={t('searchableHint')}
            checked={profile.searchable}
            onCheckedChange={(on) => updateProfile.mutate({ searchable: on }, { onError: fail })}
          />
        </SettingRow>
        <SettingRow>
          <Switch
            label={t('leaderboard')}
            description={t('leaderboardHint')}
            checked={settings.show_in_leaderboard}
            onCheckedChange={(on) =>
              updateSettings.mutate({ show_in_leaderboard: on }, { onError: fail })
            }
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
