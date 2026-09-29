import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ForgotForm } from '@/features/auth/forgot-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgot');
  return { title: t('title') };
}

export default async function ForgotPasswordPage({ params }: PageProps<'/[locale]/forgot-password'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <ForgotForm />;
}
