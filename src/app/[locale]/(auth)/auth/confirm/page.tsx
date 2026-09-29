import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { ConfirmEmail } from '@/features/auth/confirm-email';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.confirm');
  return { title: t('verifying'), robots: { index: false } };
}

export default async function ConfirmPage({ params }: PageProps<'/[locale]/auth/confirm'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return (
    <Suspense>
      <ConfirmEmail />
    </Suspense>
  );
}
