import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SmartListScreen } from '@/features/filters/smart-list-screen';

export async function generateMetadata({ params }: PageProps<'/[locale]/lists/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'lists' });
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/lists/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  return <SmartListScreen id={id} />;
}
