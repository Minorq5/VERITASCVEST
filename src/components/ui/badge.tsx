import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-4 text-fg-2',
        accent: 'bg-accent/15 text-accent',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-danger/15 text-danger',
        info: 'bg-info/15 text-info',
      },
      outline: { true: 'border border-current/30 bg-transparent' },
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
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-4 px-1.5 font-mono tabular text-xs font-medium text-fg-2',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
