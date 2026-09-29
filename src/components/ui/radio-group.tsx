'use client';

import { RadioGroup as R } from 'radix-ui';
import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function RadioGroup({ className, ...props }: ComponentPropsWithoutRef<typeof R.Root>) {
  return <R.Root className={cn('flex flex-col gap-3', className)} {...props} />;
}

interface RadioItemProps extends ComponentPropsWithoutRef<typeof R.Item> {
  label: ReactNode;
  description?: ReactNode;
}

export function RadioItem({ label, description, className, id: idProp, ...props }: RadioItemProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <div className={cn('group/field flex items-start gap-3', className)}>
      <span className="flex h-6 items-center">
        <R.Item
          id={id}
          className={cn(
            'relative inline-flex size-4 shrink-0 items-center justify-center rounded-full focus-ring',
            'border border-line-bright bg-surface-2 transition-[border-color] duration-140 ease-out',
            'hover-ok:border-fg-3',
            'data-[state=checked]:border-accent',
            'disabled:pointer-events-none disabled:opacity-45',
          )}
          {...props}
        >
          <R.Indicator className="size-1.5 rounded-full bg-accent" />
        </R.Item>
      </span>
      <label
        htmlFor={id}
        className="flex flex-col gap-0.5 text-base text-fg group-has-[button:disabled]/field:opacity-45"
      >
        <span>{label}</span>
        {description && <span className="text-sm text-fg-3">{description}</span>}
      </label>
    </div>
  );
}
