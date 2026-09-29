import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './spinner';
import { Tooltip } from './tooltip';

const iconButtonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center rounded-md select-none',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out',
    'focus-ring disabled:pointer-events-none motion-ok:active:scale-[0.94] [&:disabled:not([aria-busy=true])]:opacity-45',
  ],
  {
    variants: {
      variant: {
        ghost: 'text-fg-2 hover-ok:bg-surface-3 hover-ok:text-fg',
        secondary:
          'shadow-inset-top border border-line-strong text-fg glass hover-ok:border-line-bright',
        primary:
          'bg-[linear-gradient(180deg,var(--accent-hi),var(--accent)_58%)] text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] hover-ok:shadow-glow-md',
        danger: 'text-danger hover-ok:bg-danger/12',
      },
      size: {
        sm: 'size-8 [&_svg]:size-4',
        md: 'size-10 [&_svg]:size-[18px]',
        lg: 'size-12 rounded-lg [&_svg]:size-5',
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
