'use client';

import { useEffect, useRef } from 'react';
import { useFinePointer } from '@/lib/hooks/use-media-query';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { cn } from '@/lib/utils/cn';
import { useDeviceSettings } from '@/stores/device-settings';

/** Deterministic pseudo-random numbers so every visit draws the same sky. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; a: number; c: string };

const TILE = 1200;
/** About one star per 20 000 px²: the sky stays empty enough to read against. */
const PER_TILE = Math.round((TILE * TILE) / 20_000);
// Star spectrum: mostly warm white, a few blue-white and amber points.
const TINTS = ['242,237,228', '242,237,228', '242,237,228', '185,211,255', '255,166,92'];

const TILE_STARS: Star[] = (() => {
  const rand = rng(20260929);
  return Array.from({ length: PER_TILE }, () => ({
    x: rand() * TILE,
    y: rand() * TILE,
    r: 0.35 + rand() ** 3 * 0.75,
    a: 0.18 + rand() ** 2 * 0.62,
    c: TINTS[Math.floor(rand() * TINTS.length)]!,
  }));
})();

/** Einstein radius of the cursor lens, px. Small on purpose: a hint, not a toy. */
const THETA = 34;
const REACH = THETA * 6;

/**
 * The sky behind the interface: rare, tiny, still stars on near-black. On a
 * computer with a mouse, stars near the pointer bend around it the way light
 * bends around a mass (a primary and a faint secondary image). No nebulae, no
 * twinkle, no grain. The 3D scenes (stage 7) draw on top of this.
 */
export function SpaceBackdrop({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fine = useFinePointer();
  const reduce = useLessMotion();
  const lensOn = useDeviceSettings((s) => s.cursor) === 'custom' && fine && !reduce;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    const layout = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = [];
      for (let ty = 0; ty < h; ty += TILE)
        for (let tx = 0; tx < w; tx += TILE)
          for (const s of TILE_STARS) {
            const x = tx + s.x;
            const y = ty + s.y;
            if (x < w && y < h) stars.push({ ...s, x, y });
          }
    };

    const dot = (x: number, y: number, r: number, a: number, c: string) => {
      ctx.fillStyle = `rgba(${c},${Math.min(1, a * intensity)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = () => {
      frame = 0;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const dx = pointer ? s.x - pointer.x : 0;
        const dy = pointer ? s.y - pointer.y : 0;
        const d = Math.hypot(dx, dy);
        if (!pointer || d > REACH || d < 0.5) {
          dot(s.x, s.y, s.r, s.a, s.c);
          continue;
        }
        // Point-mass lens: two images at (d ± √(d² + 4θ²)) / 2 on the same line.
        const root = Math.sqrt(d * d + 4 * THETA * THETA);
        const outer = (d + root) / 2;
        const inner = (d - root) / 2;
        // Fade the effect in towards the lens so nothing jumps at the edge.
        const k = Math.min(1, Math.max(0, (REACH - d) / (REACH * 0.5)));
        const ease = k * k * (3 - 2 * k);
        const ux = dx / d;
        const uy = dy / d;
        const along = d + (outer - d) * ease;
        // Images near the Einstein ring stretch along it and brighten a little.
        const gain = 1 + ease * Math.min(1.5, (THETA * THETA) / (d * d + 1));
        ctx.save();
        ctx.translate(pointer.x + ux * along, pointer.y + uy * along);
        ctx.rotate(Math.atan2(uy, ux) + Math.PI / 2);
        ctx.scale(gain, 1);
        dot(0, 0, s.r, s.a * gain, s.c);
        ctx.restore();
        if (ease > 0.2) dot(pointer.x + ux * inner * ease, pointer.y + uy * inner * ease, s.r * 0.8, s.a * 0.35 * ease, s.c);
      }
    };

    const request = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onResize = () => {
      layout();
      request();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointer = { x: e.clientX, y: e.clientY };
      request();
    };
    const onLeave = () => {
      pointer = null;
      request();
    };

    layout();
    draw();
    window.addEventListener('resize', onResize);
    if (lensOn) {
      window.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
      window.addEventListener('blur', onLeave);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, [lensOn, intensity]);

  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 -z-10 bg-bg', className)}>
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}
