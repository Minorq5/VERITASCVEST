'use client';

import { Switch as S } from 'radix-ui';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface SwitchProps extends ComponentPropsWithoutRef<typeof S.Root> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { label, description, className, id: idProp, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const control = (
    <S.Root
      ref={ref}
      id={id}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full focus-ring',
        'border border-line-strong bg-surface-4 transition-[background-color,border-color,box-shadow] duration-200 ease-out',
        'data-[state=checked]:border-transparent data-[state=checked]:bg-accent data-[state=checked]:shadow-glow-sm',
        'disabled:pointer-events-none disabled:opacity-45',
        !label && className,
      )}
      {...props}
    >
      <S.Thumb
        className={cn(
          'block size-[18px] translate-x-[3px] rounded-full bg-fg shadow-[0_1px_3px_rgb(0_0_0/0.5)]',
          'transition-[transform,background-color] duration-300 ease-out-expo',
          'data-[state=checked]:translate-x-[21px] data-[state=checked]:bg-accent-ink',
        )}
      />
    </S.Root>
  );
  if (!label) return control;
  return (
    <div className={cn('group/field flex items-start justify-between gap-4', className)}>
      <label
        htmlFor={id}
        className="flex flex-col gap-0.5 text-base text-fg group-has-[button:disabled]/field:opacity-45"
      >
        <span>{label}</span>
        {description && <span className="text-sm text-fg-3">{description}</span>}
      </label>
      <span className="flex h-6 items-center">{control}</span>
    </div>
  );
});
