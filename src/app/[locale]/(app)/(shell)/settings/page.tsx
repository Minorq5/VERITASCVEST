import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SettingsFrame } from '@/features/settings/settings-frame';

export async function generateMetadata({ params }: PageProps<'/[locale]/settings'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'settings' });
  return { title: t('title') };
}

export default async function SettingsPage({ params }: PageProps<'/[locale]/settings'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <SettingsFrame section={null} />;
}
