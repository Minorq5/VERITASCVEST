import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SectionScreen } from '@/features/tasks/list/screens';

export async function generateMetadata({ params }: PageProps<'/[locale]/overdue'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'nav' });
  return { title: t('overdue') };
}

export default async function Page({ params }: PageProps<'/[locale]/overdue'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <SectionScreen section="overdue" />;
}
