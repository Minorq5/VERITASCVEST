'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface ChipProps {
  children: ReactNode;
  /** Colour dot, e.g. a tag or project colour. */
  color?: string;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  icon?: ReactNode;
  className?: string;
}

export function Chip({
  children,
  color,
  selected,
  onClick,
  onRemove,
  removeLabel,
  icon,
  className,
}: ChipProps) {
  const Comp = onClick ? 'button' : 'span';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-xs border text-sm transition-colors duration-140',
        selected
          ? 'border-accent/60 bg-accent/10 text-fg'
          : 'border-line-strong bg-surface-2 text-fg-2',
        onRemove ? 'pr-0.5 pl-2' : 'px-2',
        className,
      )}
    >
      <Comp
        {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': selected } : {})}
        className={cn(
          'inline-flex items-center gap-1.5 [&_svg]:size-3.5',
          onClick && 'rounded-xs focus-ring hover-ok:text-fg',
        )}
      >
        {color && (
          <span className="size-1.5 rounded-full" style={{ background: color }} />
        )}
        {icon}
        {children}
      </Comp>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="inline-flex size-5 items-center justify-center rounded-xs text-fg-3 focus-ring transition-colors hover-ok:bg-surface-4 hover-ok:text-fg"
        >
          <X className="size-3.5" />
        </button>
      )}
    </span>
  );
}
