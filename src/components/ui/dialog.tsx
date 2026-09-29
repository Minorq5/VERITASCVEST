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
            'scrim-anim fixed inset-0 z-[var(--z-modal)] grid place-items-center overflow-y-auto p-4 sm:p-8',
            'bg-[rgb(2_2_3/0.78)]',
          )}
        >
          <D.Content
            className={cn(
              'dialog-anim relative w-full rounded-xl border border-line-strong bg-surface-1 p-6 outline-none',
              widths[size],
              className,
            )}
          >
            <div className="flex flex-col gap-2">
              <D.Title className="pr-10 font-display text-xl font-medium text-fg">{title}</D.Title>
              {description ? (
                <D.Description className="text-base text-fg-2">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close
              aria-label={t('closeDialog')}
              className="absolute top-5 right-5 inline-flex size-8 items-center justify-center rounded-sm text-fg-3 focus-ring transition-colors hover-ok:bg-surface-3 hover-ok:text-fg"
            >
              <X className="size-[18px]" />
            </D.Close>
            {children && <div className="mt-5">{children}</div>}
            {footer && (
              <div className="-mx-6 mt-6 -mb-6 flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
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
