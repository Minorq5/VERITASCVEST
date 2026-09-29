'use client';

import { Switch as S } from 'radix-ui';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { sound } from '@/sound/engine';

interface SwitchProps extends ComponentPropsWithoutRef<typeof S.Root> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { label, description, className, id: idProp, onCheckedChange, ...props },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const control = (
    <S.Root
      ref={ref}
      id={id}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-xs focus-ring',
        'border border-line-bright bg-surface-3 transition-[background-color,border-color] duration-140 ease-out',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        'disabled:pointer-events-none disabled:opacity-45',
        !label && className,
      )}
      {...props}
      onCheckedChange={(checked) => {
        onCheckedChange?.(checked);
        // After the handler: a switch that turns sound on is heard.
        sound.play(checked ? 'toggleOn' : 'toggleOff');
      }}
    >
      <S.Thumb
        className={cn(
          'block size-3.5 translate-x-0.5 rounded-[1px] bg-fg-2',
          'transition-[transform,background-color] duration-200 ease-out',
          'data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-accent-ink',
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
