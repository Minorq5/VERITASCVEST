import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { CinemaStill } from '@/features/cinema/black-hole/cinema-still';
import { IntroFrames } from '@/features/cinema/intro/intro-frames';
import { introViews, sceneViews, type IntroShot, type SceneName } from '@/features/cinema/black-hole/presets';
import { designPageEnabled } from '@/lib/site';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Key frames of the intro and scene posters rendered by the real shader: /cinema?shot=horizon&samples=4. Development only. */
export default async function CinemaPage({ params, searchParams }: PageProps<'/[locale]/cinema'>) {
  if (!designPageEnabled) notFound();
  const { locale } = await params;
  setRequestLocale(locale as 'ru' | 'en' | 'bg');
  const query = await searchParams;
  // /cinema?intro=frames: the page the intro film is rendered from.
  if (query.intro === 'frames') return <IntroFrames />;
  const name = String(query.shot);
  const shot: IntroShot | SceneName = name in introViews || name in sceneViews ? (name as IntroShot | SceneName) : 'horizon';
  const samples = query.samples === '1' ? 1 : 4;
  // step > 1: how a lower quality level's longer geodesic steps look.
  const step = Math.min(3, Math.max(1, Number(query.step) || 1));
  return <CinemaStill shot={shot} samples={samples} step={step} />;
}
