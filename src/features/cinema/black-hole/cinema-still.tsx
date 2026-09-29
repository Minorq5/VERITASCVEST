'use client';

import { useEffect, useRef, useState } from 'react';
import { LogoLockup, LogoMark } from '@/components/brand/logo';
import { introViews, type IntroShot } from './presets';
import { BlackHoleRenderer } from './renderer';

/**
 * Renders one key frame of the intro with the real shader, supersampled and
 * tiled, for review. Sets data-ready on <body> when the frame is on screen.
 */
export function CinemaStill({ shot, samples }: { shot: IntroShot; samples: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A fresh canvas per run: disposing loses the GL context for good.
    const el = document.createElement('canvas');
    el.className = 'absolute inset-0 size-full';
    host.current?.appendChild(el);
    let renderer: BlackHoleRenderer | null = null;
    let cancelled = false;
    const started = performance.now();
    try {
      renderer = new BlackHoleRenderer(el);
      renderer.resize(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio);
      void renderer.renderStill(introViews[shot], { samples }).then(() => {
        if (cancelled) return;
        document.body.dataset.ready = String(Math.round(performance.now() - started));
      });
    } catch (e) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reporting a failed GL setup once
      setError(e instanceof Error ? e.message : String(e));
      document.body.dataset.ready = 'error';
    }
    return () => {
      cancelled = true;
      renderer?.dispose();
      el.remove();
    };
  }, [shot, samples]);

  return (
    <main className="fixed inset-0 bg-void">
      <div ref={host} className="absolute inset-0" />
      {shot === 'logo' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <LogoMark size={112} detail="full" className="translate-y-2" />
          <LogoLockup size="md" className="mt-6 [&>svg]:hidden" />
        </div>
      )}
      {error && <p className="absolute top-4 left-4 font-mono text-sm text-danger">{error}</p>}
    </main>
  );
}
