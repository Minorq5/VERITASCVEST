import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface AuthCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** The form panel: one surface level above the sky, a 1px line, radius 8. */
export function AuthCard({ title, subtitle, icon, children, footer, className }: AuthCardProps) {
  return (
    <section
      className={cn(
        'relative rounded-xl border border-line-strong bg-surface-1 p-6 sm:p-8',
        className,
      )}
    >
      {icon && <div className="mb-5 text-accent [&_svg]:size-7">{icon}</div>}
      <h1 className="font-display text-2xl font-medium text-fg">{title}</h1>
      {subtitle && <p className="mt-2 text-base text-fg-2">{subtitle}</p>}
      {children && <div className="mt-7">{children}</div>}
      {footer && <div className="-mx-6 mt-6 -mb-6 border-t border-line px-6 py-4 text-sm text-fg-2 sm:-mx-8 sm:-mb-8 sm:px-8">{footer}</div>}
    </section>
  );
}

export function FormAlert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'info' | 'success' }) {
  const tones = {
    danger: 'border-danger/30 bg-danger/10 text-danger',
    info: 'border-info/30 bg-info/10 text-info',
    success: 'border-success/30 bg-success/10 text-success',
  } as const;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-sm border px-3 py-2.5 text-sm', tones[tone])}>
      {children}
    </div>
  );
}
