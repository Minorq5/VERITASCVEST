import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SectionScreen } from '@/features/tasks/list/screens';

export async function generateMetadata({ params }: PageProps<'/[locale]/today'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'nav' });
  return { title: t('today') };
}

export default async function Page({ params }: PageProps<'/[locale]/today'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <SectionScreen section="today" />;
}
