import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SettingsFrame } from '@/features/settings/settings-frame';
import { isSettingsSection, settingsSections } from '@/features/settings/sections';

export const dynamicParams = false;

export function generateStaticParams() {
  return settingsSections.map((section) => ({ section }));
}

export async function generateMetadata({ params }: PageProps<'/[locale]/settings/[section]'>): Promise<Metadata> {
  const { locale, section } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'settings' });
  if (!isSettingsSection(section)) return {};
  return { title: `${t(`sections.${section}`)} · ${t('title')}` };
}

export default async function SettingsSectionPage({ params }: PageProps<'/[locale]/settings/[section]'>) {
  const { locale, section } = await params;
  if (!isSettingsSection(section)) notFound();
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  return <SettingsFrame section={section} />;
}
