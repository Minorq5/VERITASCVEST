import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** A titled card of settings rows. */
export function SettingsGroup({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-1">
        <h3 className={cn('eyebrow', tone === 'danger' && 'text-danger')}>{title}</h3>
        {description && <p className="text-sm text-fg-3">{description}</p>}
      </div>
      <div
        className={cn(
          'flex flex-col divide-y divide-line rounded-lg border bg-surface-1',
          tone === 'danger' ? 'border-danger/25' : 'border-line',
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Label and hint on the left, the control on the right (below on narrow screens when `stack`). */
export function SettingRow({
  label,
  description,
  control,
  stack = false,
  children,
}: {
  label?: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  stack?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
      {(label || control) && (
        <div className={cn('flex gap-x-6 gap-y-3', stack ? 'flex-col sm:flex-row sm:items-center' : 'items-center')}>
          {label && (
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base text-fg">{label}</span>
              {description && <span className="text-sm text-fg-3">{description}</span>}
            </div>
          )}
          {control && <div className={cn('flex shrink-0', stack && 'sm:justify-end')}>{control}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
