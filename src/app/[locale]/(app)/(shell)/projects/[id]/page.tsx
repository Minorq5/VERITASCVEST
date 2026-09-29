import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProjectScreen } from '@/features/tasks/list/screens';

export async function generateMetadata({ params }: PageProps<'/[locale]/projects/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'nav' });
  return { title: t('projects') };
}

export default async function ProjectPage({ params }: PageProps<'/[locale]/projects/[id]'>) {
  const { locale, id } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  return <ProjectScreen id={id} />;
}
