'use client';

import { Popover as P } from 'radix-ui';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils/cn';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export const PopoverAnchor = P.Anchor;

/** Floating panels: one step above the page, a 1px line, radius 6. No blur, no shadow. */
export const panelSurface = 'rounded-lg border border-line-strong bg-surface-2 text-fg';

export function PopoverContent({
  className,
  sideOffset = 8,
  align = 'center',
  ...props
}: ComponentPropsWithoutRef<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          panelSurface,
          'overlay-anim z-[var(--z-dropdown)] w-72 p-4 outline-none',
          'origin-[var(--radix-popover-content-transform-origin)]',
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}
