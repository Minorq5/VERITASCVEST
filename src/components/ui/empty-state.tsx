import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { AstronautArt } from './astronaut-art';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  art?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, art, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-sm flex-col items-center px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-6 w-52">{art ?? <AstronautArt className="w-full" />}</div>
      <h3 className="font-display text-lg font-semibold text-fg">{title}</h3>
      {description && <p className="mt-2 text-base text-fg-2">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
