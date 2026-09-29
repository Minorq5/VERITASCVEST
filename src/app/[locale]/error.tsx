'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SpaceBackdrop />
      <main
        id="main"
        className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
      >
        <h1 className="font-display text-3xl font-semibold text-fg">{t('errorTitle')}</h1>
        <p className="mt-4 text-lg text-fg-2">{t('errorText')}</p>
        {error.digest && (
          <p className="mt-3 font-mono text-sm text-fg-3">
            {t('errorDigest', { digest: error.digest })}
          </p>
        )}
        <div className="mt-10 flex gap-3">
          <Button variant="primary" size="lg" icon={<RotateCcw />} onClick={reset}>
            {t('retry')}
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/">{t('backHome')}</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
