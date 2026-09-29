import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoMark } from '@/components/brand/logo';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { designPageEnabled } from '@/lib/site';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * 1200×630 share card, captured by `npm run icons -- --og <url>` into
 * public/og/og-<locale>.png. Development only.
 */
export default async function OgCardPage({ params }: PageProps<'/[locale]/og-card'>) {
  if (!designPageEnabled) notFound();
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  const t = await getTranslations('home');

  return (
    <main className="relative flex h-[630px] w-[1200px] items-center gap-16 overflow-hidden px-24">
      <SpaceBackdrop />
      <div className="relative shrink-0">
        <LogoMark size={300} detail="full" />
      </div>
      <div className="relative flex flex-col">
        <p className="eyebrow text-accent">Veritas Tasks</p>
        <h1 className="mt-5 font-display text-[3.4rem] leading-[1.08] font-medium tracking-[-0.025em] text-fg">
          <span className="block">{t('title')}</span>
          <span className="block text-accent">
            {t('titleAccent')}
          </span>
        </h1>
        <p className="mt-7 text-xl text-fg-2">
          {t('pillars.offline')} · {t('pillars.devices')}
        </p>
        <p className="mt-2 text-lg text-fg-3">{t('pillars.languages')}</p>
      </div>
    </main>
  );
}
