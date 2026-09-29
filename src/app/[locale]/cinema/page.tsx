import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { CinemaStill } from '@/features/cinema/black-hole/cinema-still';
import { introViews, type IntroShot } from '@/features/cinema/black-hole/presets';
import { designPageEnabled } from '@/lib/site';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Key frames of the intro rendered by the real shader: /cinema?shot=horizon&samples=4. Development only. */
export default async function CinemaPage({ params, searchParams }: PageProps<'/[locale]/cinema'>) {
  if (!designPageEnabled) notFound();
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  const query = await searchParams;
  const shot = String(query.shot) in introViews ? (query.shot as IntroShot) : 'horizon';
  const samples = query.samples === '1' ? 1 : 4;
  return <CinemaStill shot={shot} samples={samples} />;
}
