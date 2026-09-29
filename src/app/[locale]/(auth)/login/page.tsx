import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/login-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login');
  return { title: t('title') };
}

export default async function LoginPage({ params }: PageProps<'/[locale]/login'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
