'use client';

import { Info, Volume2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useSettings, useUpdateSettings, type SettingsPatch } from '@/features/account/queries';
import { sound } from '@/sound/engine';
import { SettingRow, SettingsGroup } from './setting-row';

type VolumeKey = 'sound_volume' | 'sound_ui' | 'sound_fx' | 'sound_ambient';
const ENGINE_KEY = {
  sound_volume: 'volume',
  sound_ui: 'ui',
  sound_fx: 'fx',
  sound_ambient: 'ambient',
} as const;

export function SoundSection() {
  const t = useTranslations();
  const settings = useSettings().data;
  const updateSettings = useUpdateSettings();
  // Slider positions while dragging; saved once the thumb is released.
  const [drafts, setDrafts] = useState<Partial<Record<VolumeKey, number>>>({});
  if (!settings) return null;

  const save = (patch: SettingsPatch) => updateSettings.mutate(patch);
  const off = !settings.sound_enabled;

  const volumeRow = (key: VolumeKey, label: string, disabled: boolean) => {
    const value = drafts[key] ?? settings[key];
    return (
      <SettingRow key={key} stack label={label}>
        <div className="flex items-center gap-4">
          <Slider
            label={label}
            min={0}
            max={100}
            step={5}
            disabled={disabled}
            value={[Math.round(value * 100)]}
            formatValue={(v) => `${v}%`}
            onValueChange={([v]) => {
              const next = (v ?? 0) / 100;
              setDrafts((d) => ({ ...d, [key]: next }));
              sound.configure({ [ENGINE_KEY[key]]: next });
            }}
            onValueCommit={([v]) => {
              save({ [key]: (v ?? 0) / 100 });
              setDrafts(({ [key]: _done, ...rest }) => rest);
              if (key !== 'sound_ambient') sound.play(key === 'sound_fx' ? 'success' : 'click');
            }}
          />
          <span className="w-11 shrink-0 text-right font-mono tabular text-sm text-fg-3">
            {Math.round(value * 100)}%
          </span>
        </div>
      </SettingRow>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingsGroup title={t('settings.sound.main')}>
        <SettingRow>
          <Switch
            label={t('settings.sound.enabled')}
            description={t('onboarding.sound.text')}
            checked={settings.sound_enabled}
            onCheckedChange={(on) => {
              sound.configure({ enabled: on });
              save({ sound_enabled: on });
            }}
          />
        </SettingRow>
        {volumeRow('sound_volume', t('settings.sound.volume'), off)}
        <SettingRow>
          <Button
            icon={<Volume2 />}
            className="self-start"
            disabled={off}
            onClick={() => {
              sound.play('chime');
              window.setTimeout(() => sound.play('success'), 420);
            }}
          >
            {t('onboarding.sound.test')}
          </Button>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup
        title={t('settings.sound.channels')}
        description={t('settings.sound.channelsHint')}
      >
        {volumeRow('sound_ui', t('settings.sound.ui'), off)}
        {volumeRow('sound_fx', t('settings.sound.fx'), off)}
      </SettingsGroup>

      <SettingsGroup title={t('settings.sound.ambient')}>
        <SettingRow>
          <Switch
            label={t('settings.sound.ambientEnabled')}
            description={t('settings.sound.ambientHint')}
            checked={settings.ambient_enabled}
            disabled={off}
            onCheckedChange={(on) => save({ ambient_enabled: on })}
          />
        </SettingRow>
        {volumeRow(
          'sound_ambient',
          t('settings.sound.ambientVolume'),
          off || !settings.ambient_enabled,
        )}
      </SettingsGroup>

      <p className="flex items-start gap-2 px-1 text-sm text-fg-3">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t('settings.sound.iosHint')}
      </p>
    </div>
  );
}
