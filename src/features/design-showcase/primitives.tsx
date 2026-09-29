import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function Section({
  id,
  title,
  children,
  lead,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 border-t border-line py-14 first:border-t-0 first:pt-4"
    >
      <h2 id={`${id}-title`} className="font-display text-2xl font-semibold text-fg">
        {title}
      </h2>
      {lead && <p className="mt-2 max-w-2xl text-base text-fg-2">{lead}</p>}
      <div className="mt-8 flex flex-col gap-10">{children}</div>
    </section>
  );
}

export function Group({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h3 className="eyebrow">{label}</h3>
      <div className={cn('flex min-w-0 flex-wrap items-center gap-4', className)}>{children}</div>
    </div>
  );
}

/** Even grid for swatches and specimens: no orphans on the last row. */
export const chipGrid = 'grid w-full grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-4';

export function Specimen({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {children}
      {label && <span className="font-mono text-xs text-fg-3">{label}</span>}
    </div>
  );
}
