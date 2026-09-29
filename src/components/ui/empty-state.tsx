import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { BlackHoleStill } from '@/features/cinema/black-hole/black-hole-scene';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  art?: ReactNode;
  /** Small mono caption above the title, e.g. "0 задач". */
  label?: ReactNode;
  className?: string;
}

/** Nothing here yet (DESIGN_V2 §8.2): a still frame of a small black hole, a plain sentence and the one useful action. Left-aligned. */
export function EmptyState({ title, description, action, art, label, className }: EmptyStateProps) {
  return (
    <div className={cn('flex max-w-md flex-col items-start px-1 py-10', className)}>
      <div className="mb-6 w-56">
        {art ?? (
          <BlackHoleStill
            scene="small"
            sizes="224px"
            className="aspect-[7/5] w-full rounded-sm border border-line"
          />
        )}
      </div>
      {label && <p className="mb-2 label-mono">{label}</p>}
      <h3 className="font-display text-lg font-medium text-fg">{title}</h3>
      {description && <p className="mt-1.5 text-base text-fg-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
