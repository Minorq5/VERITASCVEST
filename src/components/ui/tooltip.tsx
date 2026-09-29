'use client';

import { Tooltip as T } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Kbd } from './kbd';

export const TooltipProvider = T.Provider;

interface TooltipProps {
  content: ReactNode;
  /** Keyboard shortcut shown after the text, e.g. ['⌘', 'K']. */
  shortcut?: string[];
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
  /** Render nothing but the trigger (e.g. on touch devices). */
  disabled?: boolean;
}

export function Tooltip({ content, shortcut, side = 'top', children, disabled }: TooltipProps) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'z-[var(--z-toast)] flex max-w-72 items-center gap-2 rounded-sm px-2 py-1 text-sm text-fg',
            'border border-line-bright bg-surface-3',
            'origin-[var(--radix-tooltip-content-transform-origin)]',
            'overlay-anim',
          )}
        >
          <span>{content}</span>
          {shortcut && (
            <span className="flex items-center gap-0.5">
              {shortcut.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          )}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
