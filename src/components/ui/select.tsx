'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select as S } from 'radix-ui';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { useField } from './field';
import { controlFrame, controlState } from './input';
import { panelSurface } from './popover';

interface SelectProps extends ComponentPropsWithoutRef<typeof S.Root> {
  placeholder?: string;
  children: ReactNode;
  className?: string;
  invalid?: boolean;
  'aria-label'?: string;
}

export function Select({
  placeholder,
  children,
  className,
  invalid,
  'aria-label': ariaLabel,
  ...props
}: SelectProps) {
  const field = useField();
  return (
    <S.Root {...props}>
      <S.Trigger
        id={field?.id}
        aria-label={ariaLabel}
        aria-invalid={(invalid ?? field?.invalid) || undefined}
        className={cn(
          controlFrame,
          controlState({ invalid: invalid ?? field?.invalid, disabled: props.disabled }),
          'h-9 justify-between px-3 text-left text-base focus-ring data-[placeholder]:text-fg-3 [&_svg]:size-4',
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon className="text-fg-3">
          <ChevronDown />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            panelSurface,
            'overlay-anim z-[var(--z-dropdown)] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden p-1',
            'origin-[var(--radix-select-content-transform-origin)]',
          )}
        >
          <S.Viewport>{children}</S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}

export function SelectItem({
  children,
  icon,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof S.Item> & { icon?: ReactNode }) {
  return (
    <S.Item
      className={cn(
        'relative flex h-8 cursor-default items-center gap-2.5 rounded-xs pr-8 pl-2.5 text-base text-fg-2 outline-none select-none',
        'data-[highlighted]:bg-surface-4 data-[highlighted]:text-fg data-[state=checked]:text-fg',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4',
        className,
      )}
      {...props}
    >
      {icon}
      <S.ItemText>{children}</S.ItemText>
      <S.ItemIndicator className="absolute right-2.5 inline-flex text-accent">
        <Check />
      </S.ItemIndicator>
    </S.Item>
  );
}
