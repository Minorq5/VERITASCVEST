'use client';

import { useEffect, useRef } from 'react';
import { BlackHoleRenderer } from '../black-hole/renderer';
import { encodeWav, toBase64 } from '@/sound/wav';
import { renderIntroScore } from './score';
import { introFrame } from './timeline';

declare global {
  interface Window {
    /** Renders the intro scene at `t` seconds and returns the frame as a PNG data URL. */
    __introFrame?: (t: number, samples?: number) => Promise<string>;
    /** The intro score as a base64 WAV. */
    __introScore?: () => Promise<string>;
  }
}

/**
 * Development page for the pre-rendered intro film
 * (scripts/cinema/render-intro.mjs): the scene only — the mark and the
 * opening of the page stay live in the app, on top of the film.
 */
export function IntroFrames() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 size-full';
    host.current?.appendChild(canvas);
    const renderer = new BlackHoleRenderer(canvas);
    renderer.resize(window.innerWidth, window.innerHeight);
    window.__introFrame = async (t, samples = 1) => {
      await renderer.renderStill(introFrame(t).view, { samples, tile: 256 });
      return canvas.toDataURL('image/png');
    };
    window.__introScore = async () => toBase64(encodeWav(await renderIntroScore()));
    document.body.dataset.ready = 'intro';
    return () => {
      delete window.__introFrame;
      delete window.__introScore;
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return <main ref={host} className="fixed inset-0 bg-void" />;
}
