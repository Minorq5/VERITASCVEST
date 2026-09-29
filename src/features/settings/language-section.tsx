'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Segmented } from '@/components/ui/segmented';
import { useSettings, useUpdateSettings } from '@/features/account/queries';
import { useSetLocale } from '@/features/account/use-set-locale';
import { localeNames, routing, type AppLocale } from '@/i18n/routing';
import { authErrorKey } from '@/lib/auth/errors';
import { toast } from '@/stores/toasts';
import { SettingRow, SettingsGroup } from './setting-row';
import { TimezonePicker } from './timezone-picker';

export function LanguageSection() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const settings = useSettings().data;
  const updateSettings = useUpdateSettings();
  const { setLocale } = useSetLocale();
  if (!settings) return null;

  const fail = (error: unknown) => toast.error(t(`auth.errors.${authErrorKey(error)}`));

  return (
    <div className="flex flex-col gap-8">
      <SettingsGroup title={t('settings.language.language')} description={t('settings.language.languageHint')}>
        <SettingRow>
          <Segmented<AppLocale>
            label={t('settings.language.language')}
            value={locale}
            options={routing.locales.map((l) => ({ value: l, label: <span lang={l}>{localeNames[l]}</span> }))}
            onValueChange={(next) => void setLocale(next).catch(fail)}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={t('settings.language.region')}>
        <SettingRow stack label={t('settings.language.timezone')} description={t('settings.language.timezoneHint')}>
          <TimezonePicker
            value={settings.timezone}
            onChange={(timezone) => updateSettings.mutate({ timezone }, { onError: fail })}
          />
        </SettingRow>
        <SettingRow stack label={t('settings.language.weekStart')}>
          <Segmented<'1' | '0' | '6'>
            label={t('settings.language.weekStart')}
            value={String(settings.week_start) as '1' | '0' | '6'}
            options={[
              { value: '1', label: t('settings.language.monday') },
              { value: '0', label: t('settings.language.sunday') },
              { value: '6', label: t('settings.language.saturday') },
            ]}
            onValueChange={(v) => updateSettings.mutate({ week_start: Number(v) }, { onError: fail })}
          />
        </SettingRow>
        <SettingRow stack label={t('settings.language.timeFormat')}>
          <Segmented<'24h' | '12h'>
            label={t('settings.language.timeFormat')}
            value={settings.time_format as '24h' | '12h'}
            options={[
              { value: '24h', label: t('settings.language.h24') },
              { value: '12h', label: t('settings.language.h12') },
            ]}
            onValueChange={(v) => updateSettings.mutate({ time_format: v }, { onError: fail })}
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
