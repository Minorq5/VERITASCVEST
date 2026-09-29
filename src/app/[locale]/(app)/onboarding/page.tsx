import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SpaceBackdrop } from '@/components/effects/space-backdrop';
import { PlanetHorizon } from '@/features/auth/planet-horizon';
import { Onboarding } from '@/features/onboarding/onboarding';

export async function generateMetadata({ params }: PageProps<'/[locale]/onboarding'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as 'ru' | 'en' | 'bg', namespace: 'onboarding' });
  return { title: t("metaTitle") };
}

export default async function OnboardingPage({ params }: PageProps<'/[locale]/onboarding'>) {
  setRequestLocale((await params).locale as 'ru' | 'en' | 'bg');
  return (
    <>
      <SpaceBackdrop />
      <PlanetHorizon />
      <main id="main">
        <Onboarding />
      </main>
    </>
  );
}
