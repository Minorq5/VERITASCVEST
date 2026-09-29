import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex h-5 items-center gap-1 rounded-xs border px-1.5 font-mono text-[0.6875rem] font-medium tracking-[0.06em] uppercase [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'border-line-strong bg-surface-2 text-fg-2',
        accent: 'border-accent/40 bg-accent/8 text-accent',
        success: 'border-success/40 bg-success/8 text-success',
        warning: 'border-warning/40 bg-warning/8 text-warning',
        danger: 'border-danger/45 bg-danger/8 text-danger',
        info: 'border-info/40 bg-info/8 text-info',
      },
      outline: { true: 'bg-transparent' },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, outline, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, outline }), className)} {...props} />;
}

/** Compact number bubble for navigation counters. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center px-1 font-mono text-xs text-fg-3 tabular',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
