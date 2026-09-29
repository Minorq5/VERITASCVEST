import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SectionScreen } from '@/features/tasks/list/screens';

export async function generateMetadata({ params }: PageProps<'/[locale]/inbox'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'nav' });
  return { title: t('inbox') };
}

export default async function Page({ params }: PageProps<'/[locale]/inbox'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <SectionScreen section="inbox" />;
}
