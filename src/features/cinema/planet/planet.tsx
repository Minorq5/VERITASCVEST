'use client';

import { useEffect, useRef } from 'react';
import { swatches } from '@/design/palette';
import { toSwatch } from '@/lib/color/swatches';
import { cn } from '@/lib/utils/cn';

/**
 * A project's planet (DESIGN_V2 §8.2): lit from one side by the disk of the
 * black hole — a real terminator, a night side, a thin bright limb. The look
 * comes from the project's seed (bands, their tilt, spots, maybe a ring) and
 * colour, so every project keeps its own planet on every device.
 */

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const mix = (a: [number, number, number], b: [number, number, number], t: number) =>
  a.map((v, i) => Math.round(v + (b[i]! - v) * t)) as [number, number, number];
const css = ([r, g, b]: [number, number, number], alpha = 1) => `rgba(${r},${g},${b},${alpha})`;

export interface PlanetLook {
  seed: number;
  color: string | null;
}

/** Draws the planet into a square canvas of `size` device pixels. */
export function drawPlanet(ctx: CanvasRenderingContext2D, size: number, { seed, color }: PlanetLook) {
  const rand = rng(seed);
  const base = rgb(swatches[toSwatch(color)]);
  const deep = mix(base, [8, 8, 10], 0.55);
  const light = mix(base, [255, 244, 228], 0.35);
  const c = size / 2;
  const r = size * 0.36;
  const tilt = (rand() - 0.5) * 0.9;
  const ringed = rand() < 0.34;
  const ringTilt = 0.22 + rand() * 0.2;

  ctx.clearRect(0, 0, size, size);

  const ring = (front: boolean) => {
    if (!ringed) return;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(tilt - 0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.62, r * 1.62 * ringTilt, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.strokeStyle = css(mix(base, [255, 244, 228], 0.5), front ? 0.55 : 0.3);
    ctx.lineWidth = Math.max(1, size * 0.012);
    ctx.stroke();
    ctx.restore();
  };

  ring(false);

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = css(deep);
  ctx.fillRect(0, 0, size, size);

  // Latitude bands, tilted, with soft edges.
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(tilt);
  const bands = 4 + Math.floor(rand() * 5);
  for (let i = 0; i < bands; i += 1) {
    const y = -r + rand() * 2 * r;
    const h = r * (0.06 + rand() * 0.28);
    const shade = rand() < 0.5 ? mix(base, [255, 244, 228], 0.15 + rand() * 0.25) : mix(base, [8, 8, 10], 0.2 + rand() * 0.3);
    const g = ctx.createLinearGradient(0, y - h, 0, y + h);
    g.addColorStop(0, css(shade, 0));
    g.addColorStop(0.5, css(shade, 0.55));
    g.addColorStop(1, css(shade, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-r * 1.2, y - h, r * 2.4, h * 2);
  }
  // A few storms and craters.
  const spots = Math.floor(rand() * 4);
  for (let i = 0; i < spots; i += 1) {
    ctx.beginPath();
    ctx.ellipse((rand() - 0.5) * r * 1.2, (rand() - 0.5) * r * 1.2, r * (0.05 + rand() * 0.12), r * (0.03 + rand() * 0.06), 0, 0, Math.PI * 2);
    ctx.fillStyle = css(rand() < 0.5 ? light : deep, 0.35);
    ctx.fill();
  }
  ctx.restore();

  // Light from the disk: bright on the left, a soft terminator, a dark night side.
  const lx = c - r * 0.55;
  const ly = c - r * 0.25;
  const day = ctx.createRadialGradient(lx, ly, r * 0.05, lx, ly, r * 1.55);
  day.addColorStop(0, 'rgba(255,240,220,0.22)');
  day.addColorStop(0.45, 'rgba(0,0,0,0)');
  day.addColorStop(0.72, 'rgba(0,0,0,0.55)');
  day.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = day;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // The lit limb: a thin warm crescent on the side facing the light.
  ctx.beginPath();
  ctx.arc(c, c, r - Math.max(0.5, size * 0.004), Math.PI * 0.72, Math.PI * 1.42);
  ctx.strokeStyle = 'rgba(255,226,190,0.55)';
  ctx.lineWidth = Math.max(1, size * 0.01);
  ctx.stroke();

  ring(true);
}

export function Planet({ seed, color, size, className }: PlanetLook & { size: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const px = Math.round(size * Math.min(window.devicePixelRatio || 1, 2));
    canvas.width = px;
    canvas.height = px;
    drawPlanet(ctx, px, { seed, color });
  }, [seed, color, size]);
  return <canvas ref={ref} aria-hidden className={cn('shrink-0', className)} style={{ width: size, height: size }} />;
}
