import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SectionScreen } from '@/features/tasks/list/screens';

export async function generateMetadata({ params }: PageProps<'/[locale]/tomorrow'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'nav' });
  return { title: t('tomorrow') };
}

export default async function Page({ params }: PageProps<'/[locale]/tomorrow'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <SectionScreen section="tomorrow" />;
}
