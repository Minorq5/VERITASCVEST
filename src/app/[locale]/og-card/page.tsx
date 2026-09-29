import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogoLockup } from '@/components/brand/logo';
import { BlackHoleStill } from '@/features/cinema/black-hole/black-hole-scene';
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
  const specs = (['types', 'languages', 'network'] as const).map(
    (key) => `${t(`specs.${key}.label`)}: ${t(`specs.${key}.value`)}`,
  );

  return (
    <main className="relative grid h-[630px] w-[1200px] grid-cols-[1fr_470px] overflow-hidden bg-bg">
      <div className="flex flex-col justify-between py-16 pr-10 pl-20">
        <LogoLockup size="md" />
        <div>
          <p className="label-mono text-accent">{t('eyebrow')}</p>
          <h1 className="mt-5 font-display text-[3.25rem] leading-[1.04] font-medium tracking-[-0.03em] text-fg">
            {t('title')}
          </h1>
        </div>
        <p className="font-mono text-sm tracking-[0.04em] text-fg-3 uppercase">
          {specs.join('  ·  ')}
        </p>
      </div>
      <BlackHoleStill scene="hero" sizes="470px" className="h-full border-l border-line-strong" />
    </main>
  );
}
