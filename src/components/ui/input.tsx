'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { useField } from './field';

export const controlFrame = [
  'group/control relative flex w-full items-center gap-2 rounded-md border bg-surface-2 text-fg',
  'shadow-[inset_0_1px_0_rgb(255_255_255/0.03)] transition-[border-color,box-shadow,background-color] duration-200 ease-out',
];

export function controlState({ invalid, disabled }: { invalid?: boolean; disabled?: boolean }) {
  return cn(
    invalid
      ? 'border-danger/60 focus-within:shadow-[0_0_0_4px_rgb(255_107_125/0.14)]'
      : 'border-line-strong focus-within:border-[color-mix(in_oklab,var(--accent)_65%,transparent)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent)_14%,transparent)] hover-ok:border-line-bright',
    'focus-within:bg-surface-3/60',
    disabled && 'pointer-events-none opacity-50',
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
  sm: 'h-9 px-2.5 text-sm [&_svg]:size-4',
  md: 'h-11 px-3 text-base [&_svg]:size-[18px]',
  lg: 'h-12 px-4 text-md [&_svg]:size-5',
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
