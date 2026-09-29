'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { GraphicsQuality } from '@/lib/device';
import { isSoftwareRenderer } from '@/lib/graphics/detect';
import { useRecommendedQuality } from '@/lib/graphics/use-recommended-quality';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { cn } from '@/lib/utils/cn';
import { useDeviceSettings } from '@/stores/device-settings';
import { coverView } from './framing';
import { scenePosters, sceneViews, type SceneName } from './presets';
import { BlackHoleRenderer, type BlackHoleView } from './renderer';

/**
 * Levels of DESIGN_V2 §8: share of the screen's resolution, longest pixel
 * count per frame, geodesic step (Ultra ≈ 300 steps a ray, Low ≈ 120) and
 * frame rate. A slow device drops further on its own (see `adapt`).
 */
const LEVELS = {
  ultra: { scale: 1, maxDpr: 2, pixels: 2_400_000, step: 1, fps: 60 },
  high: { scale: 0.75, maxDpr: 1.5, pixels: 1_200_000, step: 1.3, fps: 60 },
  low: { scale: 0.5, maxDpr: 1, pixels: 500_000, step: 2, fps: 30 },
} as const;

interface BlackHoleSceneProps {
  scene: SceneName;
  className?: string;
  /** Where the picture sits when the box crops it, like `object-position` (0..1). */
  position?: readonly [number, number];
  /** Overrides the device setting (the onboarding preview shows the level being chosen). */
  quality?: GraphicsQuality;
  /** The poster is the page's main image: load it first. */
  preload?: boolean;
  /** `sizes` for the poster's responsive image. */
  sizes?: string;
  /** Scene seconds per real second: how fast the disk turns. */
  speed?: number;
  /** The camera leans a little toward the pointer. */
  sway?: boolean;
}

/**
 * A live black hole: the real shader in real time over its poster. The poster
 * is the first paint and stays the whole scene when graphics are off, motion
 * is reduced, WebGL2 is missing or the GPU is emulated. The live frame fades
 * in only once it is drawn, and it starts from the poster's own moment.
 * Rendering pauses when the scene leaves the screen or the tab is hidden.
 */
export function BlackHoleScene({
  scene,
  className,
  position = [0.5, 0.5],
  quality,
  preload = false,
  sizes = '100vw',
  speed = 0.3,
  sway = false,
}: BlackHoleSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const setting = useDeviceSettings((s) => s.quality);
  const recommended = useRecommendedQuality();
  const lessMotion = useLessMotion();
  const chosen = quality ?? setting;
  const level = chosen === 'auto' ? recommended : chosen;
  const poster = scenePosters[scene];
  const [px, py] = position;

  useEffect(() => {
    const box = host.current;
    if (!box || !level || level === 'off' || lessMotion) return;
    // The GPU is asked for a context only once the scene is actually on screen
    // (a hidden or scrolled-away scene costs nothing).
    let live: LiveScene | null | undefined;
    const seen = new IntersectionObserver(([entry]) => {
      const visible = Boolean(entry?.isIntersecting);
      if (visible && live === undefined)
        live = startLive(box, { level, scene, position: [px, py], speed, sway });
      live?.setVisible(visible);
    });
    seen.observe(box);
    return () => {
      seen.disconnect();
      live?.dispose();
    };
  }, [level, lessMotion, scene, px, py, speed, sway]);

  return (
    <div ref={host} aria-hidden className={cn('relative overflow-hidden bg-void', className)}>
      <Image
        src={poster.src}
        alt=""
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover"
        style={{ objectPosition: `${px * 100}% ${py * 100}%` }}
      />
    </div>
  );
}

interface LiveScene {
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

/** Starts the real-time scene over the poster; null when this device cannot run it. */
function startLive(
  box: HTMLDivElement,
  {
    level,
    scene,
    position,
    speed,
    sway,
  }: {
    level: keyof typeof LEVELS;
    scene: SceneName;
    position: readonly [number, number];
    speed: number;
    sway: boolean;
  },
): LiveScene | null {
  const settings = LEVELS[level];
  const poster = scenePosters[scene];
  // A fresh canvas per run: disposing loses its GL context for good.
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className =
    'pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-700';
  box.appendChild(canvas);
  let renderer: BlackHoleRenderer;
  try {
    renderer = new BlackHoleRenderer(canvas);
  } catch {
    canvas.remove();
    return null;
  }
  // Development can force the live path on an emulated GPU to test it (slowly).
  const forceLive = process.env.NODE_ENV !== 'production' && readFlag('vt:force-live');
  if (isSoftwareRenderer(renderer.gpu) && !forceLive) {
    renderer.dispose();
    canvas.remove();
    return null;
  }
  renderer.step = settings.step;
  const base: BlackHoleView = sceneViews[scene];
  // Each star keeps the light it has on the poster, however coarse the live frame gets.
  renderer.starRef = (2 * Math.tan((base.fov * Math.PI) / 360)) / poster.height;

  let framed = base;
  let adapt = 1;
  let shown = false;
  let sceneTime = base.time;
  // The pointer leans the camera by a degree or two, eased.
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  const draw = () =>
    renderer.renderFrame({
      ...framed,
      time: sceneTime,
      azimuth: framed.azimuth + lean.x * 1.5,
      elevation: framed.elevation - lean.y,
    });
  const layout = () => {
    const width = box.clientWidth;
    const height = box.clientHeight;
    if (!width || !height) return;
    framed = coverView(base, poster, { width, height }, position);
    const dpr = Math.min(window.devicePixelRatio || 1, settings.maxDpr);
    let w = width * dpr * settings.scale * adapt;
    let h = height * dpr * settings.scale * adapt;
    const budget = settings.pixels * adapt * adapt;
    if (w * h > budget) {
      const k = Math.sqrt(budget / (w * h));
      w *= k;
      h *= k;
    }
    renderer.resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    // Resizing clears the canvas: redraw at once, even while paused.
    if (shown) draw();
  };
  layout();
  const resizer = new ResizeObserver(layout);
  resizer.observe(box);

  const onPointer = (e: PointerEvent) => {
    lean.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    lean.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  if (sway && matchMedia('(pointer: fine)').matches)
    window.addEventListener('pointermove', onPointer, { passive: true });

  let visible = false;
  let raf = 0;
  let stopped = false;
  let last = 0;
  let windowStart = 0;
  let frames = 0;
  const frameGap = 1000 / settings.fps;

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (last && now - last < frameGap - 2) return;
    // After a pause the disk continues where it stopped, without a jump.
    if (last) sceneTime += (Math.min(now - last, 100) / 1000) * speed;
    last = now;
    lean.x += (lean.tx - lean.x) * 0.05;
    lean.y += (lean.ty - lean.y) * 0.05;
    draw();
    if (!shown) {
      shown = true;
      canvas.style.opacity = '1';
      box.dataset.live = 'on';
      windowStart = now;
    }
    // A device that cannot keep up renders fewer pixels; one that still cannot keeps the last frame.
    frames += 1;
    if (now - windowStart > 2000) {
      const achieved = (frames * 1000) / (now - windowStart);
      frames = 0;
      windowStart = now;
      if (achieved < settings.fps * 0.7) {
        if (adapt <= 0.45) {
          stopped = true;
          box.dataset.live = 'still';
          cancelAnimationFrame(raf);
          return;
        }
        adapt *= 0.8;
        layout();
      }
    }
  };

  const run = () => {
    cancelAnimationFrame(raf);
    last = 0;
    if (visible && !document.hidden && !stopped) raf = requestAnimationFrame(tick);
  };
  document.addEventListener('visibilitychange', run);
  const onLost = (e: Event) => {
    e.preventDefault();
    stopped = true;
    cancelAnimationFrame(raf);
    canvas.style.opacity = '0';
  };
  canvas.addEventListener('webglcontextlost', onLost);

  return {
    setVisible(next) {
      visible = next;
      run();
    },
    dispose() {
      cancelAnimationFrame(raf);
      resizer.disconnect();
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('pointermove', onPointer);
      canvas.removeEventListener('webglcontextlost', onLost);
      renderer.dispose();
      canvas.remove();
      delete box.dataset.live;
    },
  };
}

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** The poster alone, for server-rendered places (404, empty states): a still frame of the same scene. */
export function BlackHoleStill({
  scene,
  className,
  sizes = '320px',
}: {
  scene: SceneName;
  className?: string;
  sizes?: string;
}) {
  const poster = scenePosters[scene];
  return (
    <div aria-hidden className={cn('relative overflow-hidden bg-void', className)}>
      <Image src={poster.src} alt="" fill sizes={sizes} className="object-cover" />
    </div>
  );
}
