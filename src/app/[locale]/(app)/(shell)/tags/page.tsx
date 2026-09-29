import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TagsScreen } from '@/features/tags/tags-screen';

export async function generateMetadata({ params }: PageProps<'/[locale]/tags'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'tags' });
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/tags'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <TagsScreen />;
}
