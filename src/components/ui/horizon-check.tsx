'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface HorizonCheckProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Ring colour, usually the priority colour. Defaults to the neutral line. */
  color?: string;
  label: string;
  size?: number;
}

/**
 * The task completion control: an event horizon. An open ring in the priority
 * colour; when done, the ring fills with accent light and a black point stays
 * in the centre. Light only, no glow. The lensing ripple across the screen is
 * a separate effect.
 */
export const HorizonCheck = forwardRef<HTMLButtonElement, HorizonCheckProps>(function HorizonCheck(
  { checked, onCheckedChange, color, label, size = 20, className, disabled, style, ...props },
  ref,
) {
  const ring = color ?? 'var(--color-line-bright)';
  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      data-state={checked ? 'checked' : 'unchecked'}
      className={cn(
        'group/horizon relative inline-flex shrink-0 items-center justify-center rounded-full focus-ring',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {/* the ring */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border-[1.5px] transition-[border-color] duration-200"
        style={{ borderColor: checked ? 'var(--accent)' : ring }}
      />
      {/* accent light filling the disc */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 rounded-full bg-accent transition-[transform,opacity] ease-out-expo',
          checked ? 'scale-100 opacity-100 duration-280' : 'scale-50 opacity-0 duration-140',
        )}
      />
      {/* the horizon: a black point that stays in the centre */}
      <span
        aria-hidden
        className={cn(
          'absolute rounded-full bg-void transition-[transform,opacity] ease-out-expo',
          checked ? 'scale-100 opacity-100 delay-100 duration-280' : 'scale-0 opacity-0 duration-140',
        )}
        style={{ width: '36%', height: '36%' }}
      />
      {/* hover hint: the point the task will fall into */}
      {!checked && (
        <span
          aria-hidden
          className="absolute rounded-full opacity-0 transition-opacity duration-140 hover-ok:group-hover/horizon:opacity-70"
          style={{ width: '28%', height: '28%', background: ring }}
        />
      )}
    </button>
  );
});
