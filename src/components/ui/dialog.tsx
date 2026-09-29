'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as D } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const widths = { sm: 'max-w-[420px]', md: 'max-w-[520px]', lg: 'max-w-[720px]' } as const;

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: DialogProps) {
  const t = useTranslations('a11y');
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay
          className={cn(
            'backdrop-anim fixed inset-0 z-[var(--z-modal)] grid place-items-center overflow-y-auto p-4 sm:p-8',
            'bg-[radial-gradient(ellipse_at_center,rgb(6_9_18/0.55),rgb(3_5_10/0.85))] backdrop-blur-[6px]',
          )}
        >
          <D.Content
            className={cn(
              'dialog-anim shadow-inset-top relative w-full rounded-xl border border-line-strong p-6 shadow-xl glass-strong outline-none sm:p-7',
              widths[size],
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <D.Title className="font-display text-xl font-semibold text-fg">{title}</D.Title>
                {description ? (
                  <D.Description className="text-base text-fg-2">{description}</D.Description>
                ) : (
                  <D.Description className="sr-only">{title}</D.Description>
                )}
              </div>
              <D.Close
                aria-label={t('closeDialog')}
                className="-mt-1 -mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-fg-3 focus-ring transition-colors hover-ok:bg-surface-4 hover-ok:text-fg"
              >
                <X className="size-[18px]" />
              </D.Close>
            </div>
            {children && <div className="mt-5">{children}</div>}
            {footer && (
              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {footer}
              </div>
            )}
          </D.Content>
        </D.Overlay>
      </D.Portal>
    </D.Root>
  );
}

export const DialogClose = D.Close;
