'use client';

import { useTranslations } from 'next-intl';
import { ColorSwatches } from '@/components/ui/color-swatches';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { QualityChoice } from '@/features/account/quality-choice';
import { useUpdateSettings } from '@/features/account/queries';
import { accentPalette } from '@/design/palette';
import { accents, introModes, type Accent, type IntroMode } from '@/lib/device';
import { useRecommendedQuality } from '@/lib/graphics/use-recommended-quality';
import { useFinePointer } from '@/lib/hooks/use-media-query';
import { useDeviceSettings } from '@/stores/device-settings';
import { SettingRow, SettingsGroup } from './setting-row';

export function AppearanceSection() {
  const t = useTranslations();
  const device = useDeviceSettings();
  const updateSettings = useUpdateSettings();
  const recommended = useRecommendedQuality();
  const finePointer = useFinePointer();

  return (
    <div className="flex flex-col gap-8">
      <SettingsGroup title={t('accent.label')} description={t('settings.appearance.accentHint')}>
        <SettingRow>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <ColorSwatches<Accent>
              label={t('accent.label')}
              value={device.accent}
              size={36}
              swatches={accents.map((a) => ({
                value: a,
                color: accentPalette[a].accent,
                label: t(`accent.${a}`),
              }))}
              onValueChange={(accent) => {
                device.set('accent', accent);
                updateSettings.mutate({ accent });
              }}
            />
            <span className="text-base text-fg-2" aria-live="polite">
              {t(`accent.${device.accent}`)}
            </span>
          </div>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={t('quality.label')} description={t('settings.appearance.qualityHint')}>
        <SettingRow>
          <QualityChoice
            value={device.quality}
            recommended={recommended}
            onChange={(q) => device.set('quality', q)}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title={t('settings.appearance.comfort')}>
        <SettingRow>
          <Switch
            label={t('settings.appearance.motion')}
            description={t('settings.appearance.motionHint')}
            checked={device.motion === 'reduced'}
            onCheckedChange={(on) => device.set('motion', on ? 'reduced' : 'system')}
          />
        </SettingRow>
        <SettingRow
          stack
          label={t('settings.appearance.intro')}
          description={t('settings.appearance.introHint')}
          control={
            <Segmented<IntroMode>
              size="sm"
              label={t('settings.appearance.intro')}
              value={device.intro}
              onValueChange={(intro) => device.set('intro', intro)}
              options={introModes.map((mode) => ({ value: mode, label: t(`settings.appearance.introModes.${mode}`) }))}
            />
          }
        />
        {finePointer && (
          <SettingRow>
            <Switch
              label={t('settings.appearance.cursor')}
              description={t('settings.appearance.cursorHint')}
              checked={device.cursor === 'custom'}
              onCheckedChange={(on) => device.set('cursor', on ? 'custom' : 'system')}
            />
          </SettingRow>
        )}
      </SettingsGroup>
    </div>
  );
}
