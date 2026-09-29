import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProjectsScreen } from '@/features/projects/projects-screen';

export async function generateMetadata({ params }: PageProps<'/[locale]/projects'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'projects' });
  return { title: t('title') };
}

export default async function Page({ params }: PageProps<'/[locale]/projects'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return <ProjectsScreen />;
}
