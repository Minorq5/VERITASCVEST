import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './spinner';

export const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none',
    'transition-[color,background-color,border-color,opacity] duration-[90ms] ease-out',
    'focus-ring disabled:pointer-events-none aria-busy:cursor-progress [&:disabled:not([aria-busy=true])]:opacity-40',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        // A flat fill of the accent, dark text; pressing darkens it. No gradient, no glow.
        primary:
          'bg-accent font-semibold text-accent-ink hover-ok:bg-accent-hi active:bg-accent-lo [&:disabled:not([aria-busy=true])]:bg-surface-3 [&:disabled:not([aria-busy=true])]:text-fg-3 [&:disabled:not([aria-busy=true])]:opacity-100',
        secondary: 'border border-line-strong bg-transparent text-fg hover-ok:border-line-bright hover-ok:bg-surface-3 active:bg-surface-4',
        ghost: 'text-fg-2 hover-ok:bg-surface-3 hover-ok:text-fg active:bg-surface-4',
        danger: 'border border-line-strong text-danger hover-ok:border-danger/60 hover-ok:bg-danger/10 active:bg-danger/15',
        link: 'h-auto px-0 text-blue underline-offset-4 hover-ok:underline',
      },
      size: {
        sm: 'h-8 rounded-sm px-3 text-sm [&_svg]:size-4',
        md: 'h-9 rounded-sm px-3.5 text-base [&_svg]:size-4',
        lg: 'h-11 rounded-md px-5 text-md [&_svg]:size-[18px]',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Icon before the label; replaced by a spinner while loading. */
  icon?: ReactNode;
  /** Icon after the label (arrows, chevrons, shortcuts). */
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    block,
    asChild = false,
    loading = false,
    icon,
    trailing,
    disabled,
    children,
    type,
    ...props
  },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size, block }), className);

  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size={size === 'lg' ? 18 : 16} /> : icon}
      {children}
      {trailing}
    </button>
  );
});
