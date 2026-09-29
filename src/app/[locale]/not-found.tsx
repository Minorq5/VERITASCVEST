import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { BlackHoleStill } from '@/features/cinema/black-hole/black-hole-scene';
import { Link } from '@/i18n/navigation';

/** 404 (DESIGN_V2 §8.2): a still frame of a small black hole and one exact sentence. */
export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <main
      id="main"
      className="mx-auto grid min-h-dvh max-w-5xl content-center items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_26rem] lg:gap-16"
    >
      <BlackHoleStill
        eager
        scene="small"
        sizes="(min-width: 1024px) 416px, 100vw"
        className="aspect-[7/5] w-full rounded-md border border-line lg:order-2"
      />
      <div>
        <p className="label-mono text-accent">{t('notFoundCode')}</p>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-fg sm:text-5xl">
          {t('notFoundTitle')}
        </h1>
        <p className="mt-4 max-w-md text-lg text-fg-2">{t('notFoundText')}</p>
        <Button asChild variant="primary" size="lg" className="mt-8">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </main>
  );
}
