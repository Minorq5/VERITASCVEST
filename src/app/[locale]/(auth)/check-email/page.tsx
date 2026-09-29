import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckEmail } from '@/features/auth/check-email';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.checkEmail');
  return { title: t('title'), robots: { index: false } };
}

export default async function CheckEmailPage({ params }: PageProps<'/[locale]/check-email'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <CheckEmail />;
}
