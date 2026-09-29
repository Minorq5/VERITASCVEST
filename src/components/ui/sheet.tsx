'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils/cn';

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Bottom sheet for phones: drag the handle or swipe down to close. */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  const t = useTranslations('a11y');
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-[rgb(3_5_10/0.75)] backdrop-blur-[4px]" />
        <Drawer.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[92dvh] flex-col glass-strong outline-none',
            'shadow-inset-top rounded-t-2xl border-t border-line-strong shadow-xl',
            className,
          )}
        >
          <Drawer.Handle
            aria-label={t('dragHandle')}
            className="!mt-3 !h-1.5 !w-10 !rounded-full !bg-surface-5 !opacity-100"
          />
          <div className="flex flex-col gap-1.5 px-5 pt-4 pb-2">
            <Drawer.Title className="font-display text-lg font-semibold text-fg">
              {title}
            </Drawer.Title>
            {description ? (
              <Drawer.Description className="text-base text-fg-2">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{title}</Drawer.Description>
            )}
          </div>
          {children && <div className="overflow-y-auto px-5 py-3">{children}</div>}
          {footer && (
            <div className="flex flex-col gap-2 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
          {!footer && <div className="pb-[max(1.25rem,env(safe-area-inset-bottom))]" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
