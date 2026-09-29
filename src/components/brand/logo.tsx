'use client';

import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '@/lib/utils/cn';
import { ease } from '@/lib/motion/tokens';
import { useLessMotion } from '@/lib/hooks/use-less-motion';
import {
  MARK_LEFT_ARM,
  MARK_ORBIT,
  MARK_RIGHT_ARM,
  MARK_STAR,
  MARK_STAR_CENTER,
  MARK_VIEWBOX,
} from './logo-geometry';

interface LogoMarkProps {
  size?: number;
  /** Large renders show the orbit and a halo; small ones stay crisp. */
  detail?: 'full' | 'compact';
  /** Beams draw in and the star ignites on mount. */
  animated?: boolean;
  className?: string;
  /** Accessible name; omit when the mark sits next to visible text. */
  title?: string;
}

export function LogoMark({
  size = 32,
  detail = size >= 72 ? 'full' : 'compact',
  animated = false,
  className,
  title,
}: LogoMarkProps) {
  const id = useId().replace(/:/g, '');
  const reduce = useLessMotion();
  const play = animated && !reduce;

  return (
    <svg
      viewBox={MARK_VIEWBOX}
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            style={{ stopColor: 'var(--accent-lo)', stopOpacity: detail === 'full' ? 0.35 : 0.7 }}
          />
          <stop offset="0.5" style={{ stopColor: 'var(--accent)' }} />
          <stop offset="1" style={{ stopColor: 'var(--accent-hi)' }} />
        </linearGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" style={{ stopColor: 'var(--accent)', stopOpacity: 0.85 }} />
          <stop offset="1" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      {detail === 'full' && (
        <motion.ellipse
          cx={MARK_ORBIT.cx}
          cy={MARK_ORBIT.cy}
          rx={MARK_ORBIT.rx}
          ry={MARK_ORBIT.ry}
          transform={`rotate(${MARK_ORBIT.rotate} ${MARK_ORBIT.cx} ${MARK_ORBIT.cy})`}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.32}
          strokeWidth={0.55}
          initial={play ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: ease.cinematic, delay: 0.5 }}
        />
      )}

      {detail === 'full' && (
        <motion.circle
          cx={MARK_STAR_CENTER.x}
          cy={MARK_STAR_CENTER.y}
          r={13}
          fill={`url(#${id}-halo)`}
          initial={play ? { opacity: 0, scale: 0.4 } : false}
          animate={{ opacity: 0.5, scale: 1 }}
          style={{ transformOrigin: `${MARK_STAR_CENTER.x}px ${MARK_STAR_CENTER.y}px` }}
          transition={{ duration: 0.9, ease: ease.outExpo, delay: 0.75 }}
        />
      )}

      {[MARK_LEFT_ARM, MARK_RIGHT_ARM].map((d, i) => (
        <motion.path
          key={d}
          d={d}
          fill={`url(#${id}-beam)`}
          initial={play ? { opacity: 0, y: -6 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: ease.outExpo, delay: 0.1 + i * 0.08 }}
        />
      ))}

      <motion.path
        d={MARK_STAR}
        fill="#ffffff"
        initial={play ? { opacity: 0, scale: 0, rotate: -45 } : false}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        style={{ transformOrigin: `${MARK_STAR_CENTER.x}px ${MARK_STAR_CENTER.y}px` }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.55 }}
      />
    </svg>
  );
}

interface LogoLockupProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const lockupSizes = {
  sm: { mark: 28, text: 'text-md', gap: 'gap-2' },
  md: { mark: 36, text: 'text-lg', gap: 'gap-2.5' },
  lg: { mark: 56, text: 'text-2xl', gap: 'gap-3.5' },
} as const;

/** Mark + wordmark. "Tasks" is lighter so "Veritas" carries the name. */
export function LogoLockup({ size = 'md', animated = false, className }: LogoLockupProps) {
  const s = lockupSizes[size];
  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <LogoMark size={s.mark} animated={animated} detail="compact" />
      <span className={cn('font-display leading-none tracking-[0.01em]', s.text)}>
        <span className="font-semibold text-fg">Veritas</span>{' '}
        <span className="font-light text-fg-2">Tasks</span>
      </span>
    </span>
  );
}
