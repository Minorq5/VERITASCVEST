import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileView } from '@/features/profile/profile-view';

export async function generateMetadata({ params }: PageProps<'/[locale]/profile'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'profile' });
  return { title: t('title') };
}

export default async function ProfilePage({ params }: PageProps<'/[locale]/profile'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <ProfileView />;
}
