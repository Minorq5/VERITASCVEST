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

/**
 * The form's content on the auth panel: the panel itself is the surface, so
 * no card of its own. The footer (switch between sign-in and sign-up) sits
 * under a hairline.
 */
export function AuthCard({ title, subtitle, icon, children, footer, className }: AuthCardProps) {
  return (
    <section className={cn('relative', className)}>
      {icon && <div className="mb-6 text-accent [&_svg]:size-6">{icon}</div>}
      <h1 className="font-display text-3xl font-medium tracking-[-0.02em] text-fg">{title}</h1>
      {subtitle && <p className="mt-2 text-base text-fg-2">{subtitle}</p>}
      {children && <div className="mt-8">{children}</div>}
      {footer && <div className="mt-8 border-t border-line pt-5 text-sm text-fg-2">{footer}</div>}
    </section>
  );
}

export function FormAlert({
  children,
  tone = 'danger',
}: {
  children: ReactNode;
  tone?: 'danger' | 'info' | 'success';
}) {
  const tones = {
    danger: 'border-danger/30 bg-danger/10 text-danger',
    info: 'border-info/30 bg-info/10 text-info',
    success: 'border-success/30 bg-success/10 text-success',
  } as const;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-sm border px-3 py-2.5 text-sm', tones[tone])}
    >
      {children}
    </div>
  );
}
