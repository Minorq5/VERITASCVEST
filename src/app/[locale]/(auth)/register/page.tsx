import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { RegisterForm } from '@/features/auth/register-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.register');
  return { title: t('title') };
}

export default async function RegisterPage({ params }: PageProps<'/[locale]/register'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
