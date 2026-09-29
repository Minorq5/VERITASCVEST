'use client';

import { RadioGroup as R } from 'radix-ui';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** A radio group drawn as cards: for choices that deserve a picture or a sentence. */
export function ChoiceCards({ className, ...props }: ComponentPropsWithoutRef<typeof R.Root>) {
  return <R.Root className={cn('grid gap-2.5', className)} {...props} />;
}

interface ChoiceCardProps extends Omit<ComponentPropsWithoutRef<typeof R.Item>, 'children'> {
  label: ReactNode;
  description?: ReactNode;
  /** Leading visual: an icon, a preview, a flag of colour. */
  media?: ReactNode;
  badge?: ReactNode;
}

export function ChoiceCard({ label, description, media, badge, className, ...props }: ChoiceCardProps) {
  return (
    <R.Item
      className={cn(
        'group/choice focus-ring relative flex w-full items-center gap-3.5 rounded-lg border border-line bg-surface-2/60 p-3 text-left sm:p-3.5',
        'transition-[border-color,background-color,box-shadow] duration-200 ease-out',
        'hover-ok:border-line-strong hover-ok:bg-surface-3/70',
        'data-[state=checked]:border-[color-mix(in_oklab,var(--accent)_65%,transparent)]',
        'data-[state=checked]:bg-[color-mix(in_oklab,var(--accent)_7%,var(--color-surface-2))] data-[state=checked]:shadow-glow-sm',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {media}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium text-fg">
          {label}
          {badge}
        </span>
        {description && <span className="text-sm text-fg-3">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'flex size-[18px] shrink-0 items-center justify-center rounded-full border border-line-bright bg-surface-2',
          'transition-[border-color,box-shadow] duration-200',
          'group-data-[state=checked]/choice:border-accent group-data-[state=checked]/choice:shadow-glow-sm',
        )}
      >
        <R.Indicator className="size-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)] motion-ok:animate-[pop-in_180ms_var(--ease-out)]" />
      </span>
    </R.Item>
  );
}
