import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** One line of the task's properties: an icon and name on the left, the value (a control) on the right. */
export function PropertyRow({ icon, label, children, className }: { icon: ReactNode; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid min-h-10 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]', className)}>
      <span className="flex items-center gap-2 text-sm text-fg-3 [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/** The clickable value of a property (opens its picker). */
export const valueButton = cn(
  'focus-ring inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-base transition-colors duration-150',
  'hover-ok:bg-surface-4 data-[state=open]:bg-surface-4 [&_svg]:size-4 [&_svg]:shrink-0',
);
