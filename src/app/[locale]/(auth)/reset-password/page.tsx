import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ResetForm } from '@/features/auth/reset-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.reset');
  return { title: t('title'), robots: { index: false } };
}

export default async function ResetPasswordPage({ params }: PageProps<'/[locale]/reset-password'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <ResetForm />;
}
