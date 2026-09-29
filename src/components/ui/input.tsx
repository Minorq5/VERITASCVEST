'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { useField } from './field';

export const controlFrame = [
  'group/control relative flex w-full items-center gap-2 rounded-sm border bg-surface-2 text-fg',
  'transition-[border-color,background-color] duration-[90ms] ease-out',
];

/** Focus is a blue line on the field itself (no halo). */
export function controlState({ invalid, disabled }: { invalid?: boolean; disabled?: boolean }) {
  return cn(
    invalid ? 'border-danger/70 focus-within:border-danger' : 'border-line-strong hover-ok:border-line-bright focus-within:border-blue',
    disabled && 'pointer-events-none opacity-45',
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  invalid?: boolean;
  frameClassName?: string;
}

const sizes = {
  sm: 'h-8 px-2.5 text-sm [&_svg]:size-4',
  md: 'h-9 px-3 text-base [&_svg]:size-4',
  lg: 'h-11 px-3.5 text-md [&_svg]:size-[18px]',
} as const;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, size = 'md', invalid, disabled, className, frameClassName, id, ...props },
  ref,
) {
  const field = useField();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const isDisabled = disabled ?? field?.disabled ?? false;
  const describedBy = [field?.hintId, field?.messageId, props['aria-describedby']]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cn(
        controlFrame,
        sizes[size],
        controlState({ invalid: isInvalid, disabled: isDisabled }),
        frameClassName,
      )}
    >
      {prefix && <span className="flex shrink-0 items-center text-fg-3">{prefix}</span>}
      <input
        ref={ref}
        id={id ?? field?.id}
        disabled={isDisabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-3',
          '[&::-webkit-search-cancel-button]:hidden',
          className,
        )}
        {...props}
      />
      {suffix && <span className="flex shrink-0 items-center gap-1 text-fg-3">{suffix}</span>}
    </div>
  );
});
