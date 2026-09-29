'use client';

import { motion } from 'motion/react';
import { useId } from 'react';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { ease } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils/cn';
import { COMPACT_MAX, HORIZON, HORIZON_COMPACT, MARK_VIEWBOX } from './logo-geometry';

interface LogoMarkProps {
  size?: number;
  /** The lines of light draw in around the shadow, as at the end of the intro. */
  animated?: boolean;
  className?: string;
  /** Accessible name; omit when the mark sits next to visible text. */
  title?: string;
}

/** Thinner strokes as the mark grows, so large renders stay delicate. */
function strokeFor(size: number) {
  if (size >= 96) return 3.6;
  if (size >= 48) return 4.5;
  return 5.5;
}

/** The Veritas mark «Горизонт»: a black hole drawn in three lines of light. */
export function LogoMark({ size = 32, animated = false, className, title }: LogoMarkProps) {
  const id = useId().replace(/:/g, '');
  const reduce = useLessMotion();
  const play = animated && !reduce;
  const compact = size <= COMPACT_MAX;

  const draw = (delay: number, opacity = 1) => ({
    initial: play ? { pathLength: 0, opacity: 0 } : false,
    animate: { pathLength: 1, opacity },
    transition: { duration: 0.9, ease: ease.cinematic, delay },
  });

  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      fill="none"
    >
      {compact ? (
        <>
          <defs>
            <mask id={`${id}-k`}>
              <rect width="64" height="64" fill="white" />
              <path d={HORIZON_COMPACT.cut} stroke="black" strokeWidth={HORIZON_COMPACT.cutStroke} />
            </mask>
          </defs>
          <g mask={`url(#${id}-k)`}>
            <path d={HORIZON_COMPACT.over} stroke="var(--accent)" strokeOpacity={0.85} strokeWidth={HORIZON_COMPACT.overStroke} />
            <circle
              cx={HORIZON_COMPACT.ring.cx}
              cy={HORIZON_COMPACT.ring.cy}
              r={HORIZON_COMPACT.ring.r}
              stroke="var(--accent-hi)"
              strokeWidth={HORIZON_COMPACT.ring.stroke}
            />
          </g>
          <path d={HORIZON_COMPACT.diskNear} stroke="var(--accent-hi)" strokeWidth={HORIZON_COMPACT.diskStroke} />
          <path d={HORIZON_COMPACT.diskFar} stroke="var(--accent)" strokeWidth={HORIZON_COMPACT.diskStroke} />
        </>
      ) : (
        <FullMark id={id} sw={strokeFor(size)} draw={draw} />
      )}
    </svg>
  );
}

function FullMark({
  id,
  sw,
  draw,
}: {
  id: string;
  sw: number;
  draw: (delay: number, opacity?: number) => object;
}) {
  return (
    <>
      <defs>
        <mask id={`${id}-k`}>
          <rect width="64" height="64" fill="white" />
          <path d={HORIZON.cut} stroke="black" strokeWidth={sw * 2.2} />
        </mask>
      </defs>
      <g mask={`url(#${id}-k)`}>
        <motion.path d={HORIZON.over} stroke="var(--accent)" strokeWidth={sw * 0.6} {...draw(0.25, 0.7)} />
        <motion.path d={HORIZON.under} stroke="var(--accent)" strokeWidth={sw * 0.4} {...draw(0.35, 0.45)} />
        <motion.circle
          cx={HORIZON.ring.cx}
          cy={HORIZON.ring.cy}
          r={HORIZON.ring.r}
          stroke="var(--accent-hi)"
          strokeWidth={sw * 0.5}
          {...draw(0.1)}
        />
      </g>
      <motion.path d={HORIZON.diskNear} stroke="var(--accent-hi)" strokeWidth={sw * 0.8} {...draw(0.45)} />
      <motion.path d={HORIZON.diskFar} stroke="var(--accent)" strokeWidth={sw * 0.8} {...draw(0.5, 0.7)} />
    </>
  );
}

interface LogoLockupProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const lockupSizes = {
  sm: { mark: 24, word: 'text-sm', gap: 'gap-2.5' },
  md: { mark: 32, word: 'text-md', gap: 'gap-3' },
  lg: { mark: 48, word: 'text-2xl', gap: 'gap-4' },
} as const;

/** Mark + wordmark: VERITAS in strict capitals, TASKS as a mono label. */
export function LogoLockup({ size = 'md', animated = false, className }: LogoLockupProps) {
  const s = lockupSizes[size];
  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <LogoMark size={s.mark} animated={animated} />
      <span className="inline-flex items-baseline gap-2 leading-none">
        <span className={cn('font-display font-medium tracking-[0.2em] text-fg', s.word)}>VERITAS</span>
        <span className="font-mono text-[0.625rem] font-medium tracking-[0.2em] text-fg-3">TASKS</span>
      </span>
    </span>
  );
}
