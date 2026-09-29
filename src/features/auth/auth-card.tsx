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

/** Glass card floating above the planet. */
export function AuthCard({ title, subtitle, icon, children, footer, className }: AuthCardProps) {
  return (
    <section
      className={cn(
        'glass-strong relative rounded-2xl border border-line-strong p-6 shadow-xl shadow-inset-top sm:p-8',
        'motion-ok:animate-[dialog-in_480ms_var(--ease-out-expo)]',
        className,
      )}
    >
      {icon && <div className="mb-5 text-accent [&_svg]:size-7">{icon}</div>}
      <h1 className="font-display text-2xl font-semibold leading-tight text-fg">{title}</h1>
      {subtitle && <p className="mt-2 text-base text-fg-2">{subtitle}</p>}
      {children && <div className="mt-7">{children}</div>}
      {footer && <div className="mt-6 border-t border-line pt-5 text-center text-sm text-fg-2">{footer}</div>}
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
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-md border px-3.5 py-3 text-sm', tones[tone])}>
      {children}
    </div>
  );
}
