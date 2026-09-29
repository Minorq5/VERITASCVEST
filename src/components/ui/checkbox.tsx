'use client';

import { Checkbox as C } from 'radix-ui';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface CheckboxProps extends ComponentPropsWithoutRef<typeof C.Root> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(function Checkbox(
  { label, description, className, id: idProp, disabled, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const box = (
    <C.Root
      ref={ref}
      id={id}
      disabled={disabled}
      className={cn(
        'group/check relative inline-flex size-4 shrink-0 items-center justify-center rounded-xs',
        'border border-line-bright bg-surface-2 transition-[background-color,border-color] duration-140 ease-out',
        'focus-ring hover-ok:border-fg-3',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        'data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent',
        'disabled:pointer-events-none disabled:opacity-45',
        !label && className,
      )}
      {...props}
    >
      <C.Indicator forceMount className="text-accent-ink">
        <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
          <path
            d="M3.5 8.4 6.6 11.4 12.6 4.8"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="square"
            strokeLinejoin="miter"
            pathLength={1}
            className="transition-[stroke-dashoffset] duration-300 ease-out [stroke-dasharray:1] [stroke-dashoffset:1] group-data-[state=checked]/check:[stroke-dashoffset:0] group-data-[state=indeterminate]/check:hidden"
          />
          <path
            d="M4 8h8"
            stroke="currentColor"
            strokeWidth={2}
            className="hidden group-data-[state=indeterminate]/check:block"
          />
        </svg>
      </C.Indicator>
    </C.Root>
  );

  if (!label) return box;

  return (
    <div className={cn('group/field flex items-start gap-3', className)}>
      <span className="flex h-6 items-center">{box}</span>
      <label
        htmlFor={id}
        className="flex flex-col gap-0.5 text-base text-fg group-has-[button:disabled]/field:opacity-45"
      >
        <span>{label}</span>
        {description && <span className="text-sm text-fg-3">{description}</span>}
      </label>
    </div>
  );
});
