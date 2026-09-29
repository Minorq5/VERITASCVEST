'use client';

import { SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { HORIZON, MARK_VIEWBOX } from '@/components/brand/logo-geometry';
import { INTRO_SEEN_KEY, INTRO_SESSION_KEY } from '@/lib/device';
import { isSoftwareRenderer } from '@/lib/graphics/detect';
import { useRecommendedQuality } from '@/lib/graphics/use-recommended-quality';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { sound } from '@/sound/engine';
import { useDeviceSettings } from '@/stores/device-settings';
import { BlackHoleRenderer } from '../black-hole/renderer';
import { renderIntroScore } from './score';
import { introFrame, introLength, toFull, type IntroVariant } from './timeline';
import './intro.css';


/** Pixels per frame for each graphics level: the intro is short, it keeps its time even if frames drop. */
const BUDGET = { ultra: 1_600_000, high: 900_000, low: 420_000 } as const;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-intro'] });
  return () => observer.disconnect();
}

function readVariant(): IntroVariant | null {
  const v = document.documentElement.dataset.intro;
  return v === 'full' || v === 'short' ? v : null;
}

/** Marks the intro as played and lets the page show. */
function finishIntro() {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
    sessionStorage.setItem(INTRO_SESSION_KEY, '1');
  } catch {
    /* private mode: it simply plays again */
  }
  const root = document.documentElement;
  root.removeAttribute('data-intro');
  root.removeAttribute('data-intro-live');
}

/**
 * The intro on entering the site (DESIGN_V2 §8.1). The boot script decides
 * before the first paint whether it plays (`<html data-intro="full|short">`)
 * and a cover hides the page until this takes over.
 */
export function Intro() {
  const variant = useSyncExternalStore(subscribe, readVariant, () => null);
  if (!variant) return null;
  return <IntroPlayer variant={variant} />;
}

function IntroPlayer({ variant }: { variant: IntroVariant }) {
  const t = useTranslations('intro');
  const lessMotion = useLessMotion();
  const quality = useDeviceSettings((s) => s.quality);
  const recommended = useRecommendedQuality();
  const level = quality === 'auto' ? recommended : quality;
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const clock = useRef<{ now: () => number; skip: () => void }>({ now: () => 0, skip: () => undefined });
  const score = useRef<Promise<AudioBuffer> | null>(null);
  const stopScore = useRef<(() => void) | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const length = introLength(variant);

  // Render the score in advance (no gesture needed offline); it plays only after a click.
  useEffect(() => {
    if (!sound.enabled || typeof OfflineAudioContext === 'undefined') return;
    score.current = renderIntroScore().catch(() => null as unknown as AudioBuffer);
    return () => stopScore.current?.();
  }, []);

  useEffect(() => {
    const el = root.current;
    const host = stage.current;
    if (!el || !host || level === undefined) return;
    const html = document.documentElement;
    let raf = 0;
    let done = false;
    let begin = performance.now();
    let jumpTo: number | null = null;
    const set = (name: string, value: number) => el.style.setProperty(name, value.toFixed(4));
    const now = () => Math.min(length, (performance.now() - begin) / 1000);
    const end = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      finishIntro();
    };
    clock.current = {
      now,
      // Skipping jumps to the opening of the page.
      skip: () => {
        const revealAt = variant === 'full' ? 9.4 : 1.4;
        if (now() < revealAt) jumpTo = revealAt;
        stopScore.current?.();
      },
    };
    const applyJump = () => {
      if (jumpTo !== null) {
        begin = performance.now() - jumpTo * 1000;
        jumpTo = null;
      }
    };
    const overlays = (full: number) => {
      const f = introFrame(full);
      set('--light', full >= 8.6 ? f.light : 1);
      set('--mark', f.mark);
      set('--word', f.word);
      set('--reveal', f.reveal);
      return f;
    };

    // No flight (less motion, or no film to show): the mark appears, then the page fades in.
    const timers: number[] = [];
    const still = () => {
      cancelAnimationFrame(raf);
      html.setAttribute('data-intro-live', '');
      el.dataset.mode = 'still';
      set('--mark', 1);
      set('--word', 1);
      set('--light', 1);
      set('--reveal', 0);
      timers.push(window.setTimeout(() => (el.style.opacity = '0'), 1000), window.setTimeout(end, 1400));
    };
    const clearTimers = () => timers.forEach((id) => window.clearTimeout(id));
    if (lessMotion) {
      still();
      return clearTimers;
    }

    // The live scene, unless graphics are off or the GPU cannot draw it in time: then the pre-rendered film.
    let renderer: BlackHoleRenderer | null = null;
    let canvas: HTMLCanvasElement | null = null;
    if (level !== 'off') {
      canvas = document.createElement('canvas');
      canvas.className = 'absolute inset-0 size-full';
      canvas.setAttribute('aria-hidden', 'true');
      host.appendChild(canvas);
      try {
        renderer = new BlackHoleRenderer(canvas);
        const force = process.env.NODE_ENV !== 'production' && localStorage.getItem('vt:force-live') === '1';
        if (isSoftwareRenderer(renderer.gpu) && !force) {
          renderer.dispose();
          renderer = null;
        }
      } catch {
        renderer = null;
      }
      if (!renderer) {
        canvas.remove();
        canvas = null;
      }
    }

    if (renderer && canvas) {
      const r = renderer;
      const c = canvas;
      const budget = BUDGET[level === 'off' ? 'low' : level];
      let adapt = 1;
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, level === 'ultra' ? 2 : 1.5);
        let w = window.innerWidth * dpr;
        let h = window.innerHeight * dpr;
        const k = Math.min(1, Math.sqrt((budget * adapt) / (w * h)));
        w *= k;
        h *= k;
        r.resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
      };
      size();
      window.addEventListener('resize', size);
      const lean = { x: 0, y: 0, tx: 0, ty: 0 };
      const onPointer = (e: PointerEvent) => {
        lean.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        lean.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      const onTilt = (e: DeviceOrientationEvent) => {
        if (e.gamma == null || e.beta == null) return;
        lean.tx = Math.max(-1, Math.min(1, e.gamma / 30));
        lean.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      };
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('deviceorientation', onTilt, { passive: true });
      html.setAttribute('data-intro-live', '');
      el.dataset.mode = 'live';
      let frames = 0;
      let windowStart = performance.now();
      begin = performance.now();
      const tick = () => {
        applyJump();
        const local = now();
        const full = toFull(variant, local);
        const f = overlays(full);
        lean.x += (lean.tx - lean.x) * 0.04;
        lean.y += (lean.ty - lean.y) * 0.04;
        r.renderFrame({ ...f.view, azimuth: f.view.azimuth + lean.x * 2, elevation: f.view.elevation - lean.y * 1.5 });
        c.style.opacity = '1';
        // A device that falls behind draws fewer pixels; the intro keeps its time.
        frames += 1;
        const elapsed = performance.now() - windowStart;
        if (elapsed > 1000) {
          if ((frames * 1000) / elapsed < 24 && adapt > 0.3) {
            adapt *= 0.7;
            size();
          }
          frames = 0;
          windowStart = performance.now();
        }
        if (local >= length) end();
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', size);
        window.removeEventListener('pointermove', onPointer);
        window.removeEventListener('deviceorientation', onTilt);
        r.dispose();
        c.remove();
      };
    }

    // The film: the same shader, rendered ahead of time. The mark and the opening stay live on top.
    const portrait = window.innerHeight > window.innerWidth;
    const big = Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1) > 1500;
    const video = document.createElement('video');
    video.src = `/cinema/intro-${portrait ? 'portrait' : 'landscape'}-${big ? 1080 : 720}.mp4`;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.className = 'absolute inset-0 size-full object-cover';
    video.setAttribute('aria-hidden', 'true');
    host.appendChild(video);
    el.dataset.mode = 'film';
    const offset = toFull(variant, 0);
    let started = false;
    let failed = false;
    const fail = () => {
      if (started || failed) return;
      failed = true;
      video.remove();
      still();
    };
    const startFilm = () => {
      if (started || failed) return;
      started = true;
      html.setAttribute('data-intro-live', '');
      begin = performance.now();
      const tick = () => {
        applyJump();
        const local = now();
        const full = toFull(variant, local);
        overlays(full);
        // Keep the film in step with the clock (it may start late or stall).
        if (Math.abs(video.currentTime - full) > 0.25 && full < video.duration - 0.05) video.currentTime = full;
        if (local >= length) end();
        else raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    video.currentTime = offset;
    video.addEventListener('playing', startFilm, { once: true });
    video.addEventListener('error', fail, { once: true });
    void video.play().catch(fail);
    // No film in time (offline, blocked): the mark alone, as with less motion.
    timers.push(window.setTimeout(fail, 2500));
    return () => {
      clearTimers();
      cancelAnimationFrame(raf);
      video.pause();
      video.remove();
    };
  }, [level, lessMotion, variant, length]);

  // Esc, Enter or Space skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        clock.current.skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSound = async () => {
    if (soundOn) {
      stopScore.current?.();
      stopScore.current = null;
      setSoundOn(false);
      return;
    }
    sound.unlock();
    setSoundOn(true);
    const buffer = await score.current;
    if (!buffer) return;
    stopScore.current = sound.playBuffer(buffer, 'fx', toFull(variant, clock.current.now()));
  };

  return (
    <div
      ref={root}
      role="region"
      aria-label={t('label')}
      className="vt-intro fixed inset-0 z-[2147483600] overflow-hidden bg-void select-none"
      style={{ '--light': 1, '--mark': 0, '--word': 0, '--reveal': 0 } as CSSProperties}
    >
      <div ref={stage} className="vt-intro-stage absolute inset-0" />
      <IntroMark />
      <div className="vt-intro-controls absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">
        {sound.enabled ? (
          <button
            type="button"
            onClick={() => void toggleSound()}
            className="focus-ring inline-flex h-9 items-center gap-2 rounded-sm px-3 font-mono text-[0.6875rem] tracking-[0.08em] text-fg-2 uppercase transition-colors hover-ok:bg-[rgb(255_255_255/0.06)] hover-ok:text-fg"
          >
            {soundOn ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
            {soundOn ? t('soundOff') : t('soundOn')}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => clock.current.skip()}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-sm px-3 font-mono text-[0.6875rem] tracking-[0.08em] text-fg-2 uppercase transition-colors hover-ok:bg-[rgb(255_255_255/0.06)] hover-ok:text-fg"
        >
          {t('skip')}
          <SkipForward aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Stroke weight on the 64-unit grid: finer than the 96 px logo, the mark is drawn large here, in lines of light. */
const SW = 2.6;

/** The mark drawn by the light at the end: stroke lengths follow `--mark`, the wordmark `--word`. */
function IntroMark() {
  const draw = (delay: number): CSSProperties => ({
    // A hair longer than the path, so a finished line has no seam where it started.
    strokeDasharray: '1.002 1',
    strokeDashoffset: `calc(1 - clamp(0, (var(--mark) - ${delay}) / (1 - ${delay}), 1))`,
  });
  return (
    <div aria-hidden className="vt-intro-mark pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <svg viewBox={MARK_VIEWBOX} className="w-[min(30vmin,190px)] overflow-visible" fill="none">
        <defs>
          <mask id="vt-intro-cut">
            <rect width="64" height="64" fill="white" />
            <path d={HORIZON.cut} stroke="black" strokeWidth={SW * 2.2} />
          </mask>
        </defs>
        <g mask="url(#vt-intro-cut)">
          <path d={HORIZON.over} pathLength={1} stroke="var(--accent)" strokeOpacity={0.7} strokeWidth={SW * 0.6} style={draw(0.15)} />
          <path d={HORIZON.under} pathLength={1} stroke="var(--accent)" strokeOpacity={0.45} strokeWidth={SW * 0.4} style={draw(0.25)} />
          <circle
            cx={HORIZON.ring.cx}
            cy={HORIZON.ring.cy}
            r={HORIZON.ring.r}
            pathLength={1}
            stroke="var(--accent-hi)"
            strokeWidth={SW * 0.5}
            style={draw(0)}
            transform={`rotate(-90 ${HORIZON.ring.cx} ${HORIZON.ring.cy})`}
          />
        </g>
        <path d={HORIZON.diskNear} pathLength={1} stroke="var(--accent-hi)" strokeWidth={SW * 0.8} style={draw(0.35)} />
        <path d={HORIZON.diskFar} pathLength={1} stroke="var(--accent)" strokeOpacity={0.7} strokeWidth={SW * 0.8} style={draw(0.45)} />
      </svg>
      <p className="mt-6 inline-flex items-baseline gap-2.5 leading-none" style={{ opacity: 'var(--word)' }}>
        <span className="font-display text-xl font-medium tracking-[0.2em] text-fg">VERITAS</span>
        <span className="font-mono text-[0.625rem] font-medium tracking-[0.2em] text-fg-3">TASKS</span>
      </p>
    </div>
  );
}
