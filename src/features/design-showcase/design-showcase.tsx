'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { LogoLockup } from '@/components/brand/logo';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import {
  ButtonsSection,
  ChoiceSection,
  DialogsSection,
  EmptySection,
  IdentitySection,
  InputsSection,
  LoadingSection,
  OverlaysSection,
  ProgressSection,
  ToastsSection,
} from './sections-components';
import {
  BackgroundSection,
  BansSection,
  BrandSection,
  ColorSection,
  DepthSection,
  FontCompareSection,
  GridSection,
  IconsSection,
  MotionSection,
  TypeSection,
} from './sections-foundation';

const SECTION_IDS = [
  'brand',
  'color',
  'type',
  'fonts',
  'grid',
  'depth',
  'motion',
  'icons',
  'buttons',
  'inputs',
  'choice',
  'overlays',
  'dialogs',
  'toasts',
  'identity',
  'progress',
  'loading',
  'empty',
  'background',
  'bans',
] as const;

function useActiveSection() {
  const [active, setActive] = useState<string>(SECTION_IDS[0]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

export function DesignShowcase() {
  const t = useTranslations('design');
  const active = useActiveSection();

  return (
    <>
      <SpaceBackdrop />
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-line bg-bg">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" className="rounded-md focus-ring">
            <LogoLockup size="sm" />
          </Link>
          <LocaleSwitcher />
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 sm:px-8 lg:grid-cols-[13rem_1fr]">
        <nav
          aria-label={t('nav')}
          className="sticky top-14 hidden max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-10 lg:block"
        >
          <p className="mb-3 px-3 label-mono">{t('nav')}</p>
          <ul className="flex flex-col gap-0.5">
            {SECTION_IDS.map((id) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={active === id ? 'location' : undefined}
                  className={cn(
                    'relative flex h-8 items-center rounded-xs px-3 text-sm focus-ring transition-colors',
                    active === id ? 'bg-surface-2 text-fg' : 'text-fg-3 hover-ok:text-fg-2',
                  )}
                >
                  {active === id && (
                    <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
                  )}
                  {t(`sections.${id}`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="min-w-0 pt-10 pb-24">
          <div className="mb-10 max-w-3xl">
            <p className="label-mono text-accent">{t('eyebrow')}</p>
            <h1 className="mt-3 font-display text-3xl font-medium text-fg sm:text-4xl">{t('title')}</h1>
            <p className="mt-3 text-md text-fg-2">{t('lead')}</p>
          </div>
          <BrandSection />
          <ColorSection />
          <TypeSection />
          <FontCompareSection />
          <GridSection />
          <DepthSection />
          <MotionSection />
          <IconsSection />
          <ButtonsSection />
          <InputsSection />
          <ChoiceSection />
          <OverlaysSection />
          <DialogsSection />
          <ToastsSection />
          <IdentitySection />
          <ProgressSection />
          <LoadingSection />
          <EmptySection />
          <BackgroundSection />
          <BansSection />
        </main>
      </div>
    </>
  );
}
