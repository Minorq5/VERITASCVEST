import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DesignShowcase } from '@/features/design-showcase/design-showcase';
import { designPageEnabled } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('design');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function DesignPage({ params }: PageProps<'/[locale]/design'>) {
  if (!designPageEnabled) notFound();
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  return <DesignShowcase />;
}
