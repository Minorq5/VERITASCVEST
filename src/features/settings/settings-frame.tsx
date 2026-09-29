'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { spring } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils/cn';
import { AccountSection } from './account-section';
import { AppearanceSection } from './appearance-section';
import { LanguageSection } from './language-section';
import { PrivacySection } from './privacy-section';
import { sectionIcons, settingsSections, type SettingsSection } from './sections';
import { SoundSection } from './sound-section';

const CONTENT: Record<SettingsSection, () => ReactNode> = {
  account: AccountSection,
  appearance: AppearanceSection,
  sound: SoundSection,
  language: LanguageSection,
  privacy: PrivacySection,
};

/**
 * Desktop: section list on the left, content on the right (the bare
 * /settings shows "Account"). Phone: /settings is the list, each section
 * opens as its own screen with a way back.
 */
export function SettingsFrame({ section }: { section: SettingsSection | null }) {
  const t = useTranslations('settings');
  const shown = section ?? 'account';
  const Content = CONTENT[shown];

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* On a phone section screen the page title stays for screen readers only. */}
      <h1
        className={cn(
          'border-b border-line pb-4 font-display text-3xl font-medium text-fg',
          section && 'max-lg:sr-only',
        )}
      >
        {t('title')}
      </h1>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <div className={cn(section && 'hidden lg:block')}>
          {/* phone: big tappable rows */}
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-surface-1 lg:hidden">
            {settingsSections.map((s) => {
              const Icon = sectionIcons[s];
              return (
                <li key={s}>
                  <Link
                    href={`/settings/${s}`}
                    className="flex min-h-13 items-center gap-3.5 px-4 py-3 focus-ring transition-colors hover-ok:bg-surface-2"
                  >
                    <Icon className="size-[18px] text-fg-3" aria-hidden />
                    <span className="flex-1 text-base text-fg">{t(`sections.${s}`)}</span>
                    <ChevronRight className="size-4 text-fg-3" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* desktop: quiet vertical nav */}
          <nav aria-label={t('title')} className="sticky top-10 hidden lg:block">
            <ul className="flex flex-col gap-0.5">
              {settingsSections.map((s) => {
                const Icon = sectionIcons[s];
                const active = s === shown;
                return (
                  <li key={s}>
                    <Link
                      href={`/settings/${s}`}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex h-9 items-center gap-3 rounded-sm px-3 text-base focus-ring transition-colors',
                        active
                          ? 'bg-surface-2 text-fg'
                          : 'text-fg-2 hover-ok:bg-surface-2 hover-ok:text-fg',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="settings-active"
                          transition={spring.snappy}
                          className="absolute inset-y-0 left-0 w-0.5 bg-accent"
                        />
                      )}
                      <Icon
                        className={cn('size-4', active ? 'text-accent' : 'text-fg-3')}
                        aria-hidden
                      />
                      {t(`sections.${s}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className={cn('min-w-0 flex-col gap-6', section ? 'flex' : 'hidden lg:flex')}>
          {section && (
            <Link
              href="/settings"
              className="-mb-2 -ml-1 inline-flex items-center gap-1 self-start rounded-sm px-1 py-1 text-sm text-fg-2 focus-ring lg:hidden hover-ok:text-fg"
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('title')}
            </Link>
          )}
          <h2 className="font-display text-2xl font-medium text-fg">{t(`sections.${shown}`)}</h2>
          <Content />
        </div>
      </div>
    </div>
  );
}
