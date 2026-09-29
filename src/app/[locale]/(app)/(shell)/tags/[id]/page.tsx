import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TagScreen } from '@/features/tags/tags-screen';

export async function generateMetadata({ params }: PageProps<'/[locale]/tags/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'tags' });
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/tags/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  return <TagScreen id={id} />;
}
