import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SectionScreen } from '@/features/tasks/list/screens';

export async function generateMetadata({ params }: PageProps<'/[locale]/trash'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'nav' });
  return { title: t('trash') };
}

export default async function Page({ params }: PageProps<'/[locale]/trash'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <SectionScreen section="trash" />;
}
