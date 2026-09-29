import { useTranslations } from 'next-intl';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { Button } from '@/components/ui/button';
import { HorizonArt } from '@/components/ui/horizon-art';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('errors');
  return (
    <>
      <SpaceBackdrop />
      <main id="main" className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
        <HorizonArt className="mb-10 w-72" />
        <p className="label-mono text-accent">{t('notFoundCode')}</p>
        <h1 className="mt-3 font-display text-3xl font-medium text-fg sm:text-4xl">{t('notFoundTitle')}</h1>
        <p className="mt-3 max-w-md text-lg text-fg-2">{t('notFoundText')}</p>
        <Button asChild variant="primary" size="lg" className="mt-8 self-start">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </main>
    </>
  );
}
