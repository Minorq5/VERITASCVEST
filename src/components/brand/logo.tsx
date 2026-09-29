'use client';

import { motion } from 'motion/react';
import { useId } from 'react';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import { ease } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils/cn';
import { ECLIPSE, HORIZON, LENS, MARK_VIEWBOX, type MarkVariant } from './logo-geometry';

/** The mark the product uses until the owner picks one of the three on /design. */
export const DEFAULT_MARK: MarkVariant = 'lens';

interface LogoMarkProps {
  size?: number;
  variant?: MarkVariant;
  /** Large renders add hairlines (the dark point, the disk); small ones stay bare. */
  detail?: 'full' | 'compact';
  /** The lines of light draw in toward the dark point, as at the end of the intro. */
  animated?: boolean;
  className?: string;
  /** Accessible name; omit when the mark sits next to visible text. */
  title?: string;
}

/** Thicker strokes as the mark gets smaller, so it keeps its weight at 16px. */
function strokeFor(size: number) {
  if (size >= 96) return 3.6;
  if (size >= 48) return 4.5;
  if (size >= 24) return 5.5;
  return 6.5;
}

export function LogoMark({
  size = 32,
  variant = DEFAULT_MARK,
  detail = size >= 72 ? 'full' : 'compact',
  animated = false,
  className,
  title,
}: LogoMarkProps) {
  const id = useId().replace(/:/g, '');
  const reduce = useLessMotion();
  const play = animated && !reduce;
  const sw = strokeFor(size);
  const full = detail === 'full';

  const draw = (delay: number, opacity = 1) => ({
    initial: play ? { pathLength: 0, opacity: 0 } : false,
    animate: { pathLength: 1, opacity },
    transition: { duration: 0.9, ease: ease.cinematic, delay },
  });
  const appear = (delay: number, opacity = 1) => ({
    initial: play ? { opacity: 0 } : false,
    animate: { opacity },
    transition: { duration: 0.6, ease: ease.out, delay },
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
      {variant === 'lens' && (
        <>
          {full && (
            <motion.circle
              cx={LENS.point.cx}
              cy={LENS.point.cy}
              r={LENS.point.r - sw / 2 - 1.2}
              stroke="var(--color-line-bright)"
              strokeWidth={0.6}
              {...appear(0.9)}
            />
          )}
          <motion.path d={LENS.left} stroke="var(--accent)" strokeWidth={sw} {...draw(0.1)} />
          <motion.path d={LENS.right} stroke="var(--accent)" strokeWidth={sw} {...draw(0.18)} />
        </>
      )}

      {variant === 'horizon' && (
        <>
          <defs>
            <mask id={`${id}-k`}>
              <rect width="64" height="64" fill="white" />
              <path d="M2 36.2L62 29.8" stroke="black" strokeWidth={sw * 2.2} />
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
      )}

      {variant === 'eclipse' && (
        <>
          {full && (
            <motion.circle
              cx={ECLIPSE.disk.cx}
              cy={ECLIPSE.disk.cy}
              r={ECLIPSE.disk.r - sw / 2 - 1.5}
              stroke="var(--color-line-bright)"
              strokeWidth={0.6}
              {...appear(0.2)}
            />
          )}
          <motion.path d={ECLIPSE.stroke} stroke="var(--accent)" strokeWidth={sw} {...draw(0.1)} />
        </>
      )}
    </svg>
  );
}

interface LogoLockupProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: MarkVariant;
  animated?: boolean;
  className?: string;
}

const lockupSizes = {
  sm: { mark: 24, word: 'text-sm', gap: 'gap-2.5' },
  md: { mark: 32, word: 'text-md', gap: 'gap-3' },
  lg: { mark: 48, word: 'text-2xl', gap: 'gap-4' },
} as const;

/** Mark + wordmark: VERITAS in strict capitals, TASKS as a mono label. */
export function LogoLockup({ size = 'md', variant, animated = false, className }: LogoLockupProps) {
  const s = lockupSizes[size];
  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <LogoMark size={s.mark} variant={variant} animated={animated} detail="compact" />
      <span className="inline-flex items-baseline gap-2 leading-none">
        <span className={cn('font-display font-medium tracking-[0.2em] text-fg', s.word)}>VERITAS</span>
        <span className="font-mono text-[0.625rem] font-medium tracking-[0.2em] text-fg-3">TASKS</span>
      </span>
    </span>
  );
}
