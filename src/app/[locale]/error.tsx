'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
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
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8"
    >
      <p className="label-mono text-danger">{t('errorTitle')}</p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em] text-fg sm:text-4xl">
        {t('errorText')}
      </h1>
      {error.digest && (
        <p className="mt-4 font-mono text-sm text-fg-3">
          {t('errorDigest', { digest: error.digest })}
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" icon={<RotateCcw />} onClick={reset}>
          {t('retry')}
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </main>
  );
}
