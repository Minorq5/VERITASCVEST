import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './spinner';
import { Tooltip } from './tooltip';

const iconButtonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center rounded-sm select-none',
    'transition-[color,background-color,border-color] duration-[90ms] ease-out',
    'focus-ring disabled:pointer-events-none [&:disabled:not([aria-busy=true])]:opacity-40',
  ],
  {
    variants: {
      variant: {
        ghost: 'text-fg-3 hover-ok:bg-surface-3 hover-ok:text-fg active:bg-surface-4',
        secondary: 'border border-line-strong text-fg-2 hover-ok:border-line-bright hover-ok:bg-surface-3 hover-ok:text-fg',
        primary: 'bg-accent text-accent-ink hover-ok:bg-accent-hi active:bg-accent-lo',
        danger: 'text-fg-3 hover-ok:bg-danger/10 hover-ok:text-danger',
      },
      size: {
        sm: 'size-7 [&_svg]:size-4',
        md: 'size-8 [&_svg]:size-4',
        lg: 'size-11 rounded-md [&_svg]:size-5',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface IconButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  /** Accessible name — also shown as a tooltip. Required: icons alone say nothing. */
  label: string;
  icon: ReactNode;
  shortcut?: string[];
  loading?: boolean;
  tooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    label,
    icon,
    shortcut,
    loading,
    tooltip = true,
    variant,
    size,
    className,
    disabled,
    type,
    ...props
  },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <Spinner size={16} /> : icon}
    </button>
  );
  return (
    <Tooltip content={label} shortcut={shortcut} disabled={!tooltip}>
      {button}
    </Tooltip>
  );
});
