'use client';

import { motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';
import { spring } from '@/lib/motion/tokens';
import { useLessMotion } from '@/lib/hooks/use-less-motion';

interface ProgressRingProps {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
  className?: string;
  /** Show the percentage in the middle when no children are given. */
  showValue?: boolean;
}

/** Ring that fills with light; the glow grows as the task nears completion. */
export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color = 'var(--accent)',
  children,
  className,
  showValue = true,
}: ProgressRingProps) {
  const t = useTranslations('a11y');
  const reduce = useLessMotion();
  const clamped = Math.min(1, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const percent = Math.round(clamped * 100);
  const glow = 2 + clamped * 10;

  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={t('progress', { value: percent })}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-5)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: Math.max(clamped, 0.0001) }}
          transition={reduce ? { duration: 0 } : spring.gentle}
          style={{ filter: `drop-shadow(0 0 ${glow}px ${color})` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {children ??
          (showValue && (
            <span
              className="font-mono tabular font-medium text-fg"
              style={{ fontSize: Math.max(11, size * 0.22) }}
            >
              {percent}
              <span className="text-fg-3">%</span>
            </span>
          ))}
      </span>
    </span>
  );
}

export function ProgressBar({
  value,
  color = 'var(--accent)',
  className,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const t = useTranslations('a11y');
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label ?? t('progress', { value: percent })}
      className={cn(
        'relative block h-1.5 w-full overflow-hidden rounded-full bg-surface-5',
        className,
      )}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out-expo"
        style={{
          width: `${percent}%`,
          background: `linear-gradient(90deg, color-mix(in oklab, ${color} 55%, transparent), ${color})`,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
    </span>
  );
}
