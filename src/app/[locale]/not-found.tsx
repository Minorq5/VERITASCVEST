import { useTranslations } from 'next-intl';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { Button } from '@/components/ui/button';
import { AstronautArt } from '@/components/ui/astronaut-art';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <>
      <SpaceBackdrop />
      <main
        id="main"
        className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
      >
        <AstronautArt className="mb-8 w-60" />
        <p className="font-mono text-sm tracking-[0.3em] text-accent">{t('notFoundCode')}</p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-fg sm:text-4xl">
          {t('notFoundTitle')}
        </h1>
        <p className="mt-4 text-lg text-fg-2">{t('notFoundText')}</p>
        <Button asChild variant="primary" size="lg" className="mt-10">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </main>
    </>
  );
}
