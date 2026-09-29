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
      <h1 className={cn('font-display text-3xl font-semibold text-fg', section && 'max-lg:sr-only')}>{t('title')}</h1>

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <div className={cn(section && 'hidden lg:block')}>
          {/* phone: big tappable rows */}
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-1 lg:hidden">
            {settingsSections.map((s) => {
              const Icon = sectionIcons[s];
              return (
                <li key={s}>
                  <Link href={`/settings/${s}`} className="focus-ring flex min-h-14 items-center gap-3.5 px-4 py-3 transition-colors hover-ok:bg-surface-3/60">
                    <span className="flex size-9 items-center justify-center rounded-md bg-surface-4 text-accent">
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
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
                        'focus-ring relative flex h-10 items-center gap-3 rounded-md px-3 text-base transition-colors',
                        active ? 'bg-surface-3 text-fg' : 'text-fg-2 hover-ok:bg-surface-3/60 hover-ok:text-fg',
                      )}
                    >
                      {active && (
                        <motion.span layoutId="settings-active" transition={spring.snappy} className="absolute left-0 h-5 w-0.5 rounded-full bg-accent" />
                      )}
                      <Icon className={cn('size-[18px]', active && 'text-accent')} aria-hidden />
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
            <Link href="/settings" className="focus-ring -mb-2 -ml-1 inline-flex items-center gap-1 self-start rounded-md px-1 py-1 text-sm text-fg-2 hover-ok:text-fg lg:hidden">
              <ChevronLeft className="size-4" aria-hidden />
              {t('title')}
            </Link>
          )}
          <h2 className="font-display text-2xl font-semibold text-fg">{t(`sections.${shown}`)}</h2>
          <Content />
        </div>
      </div>
    </div>
  );
}
