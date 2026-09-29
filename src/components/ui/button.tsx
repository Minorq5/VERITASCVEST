import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './spinner';

export const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none',
    'transition-[color,background-color,border-color,box-shadow,transform,filter,opacity] duration-200 ease-out',
    'focus-ring disabled:pointer-events-none aria-busy:cursor-progress [&:disabled:not([aria-busy=true])]:opacity-45',
    'motion-ok:active:scale-[0.97]',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: [
          'font-semibold text-accent-ink',
          'bg-[linear-gradient(180deg,var(--accent-hi)_0%,var(--accent)_58%)]',
          'shadow-[inset_0_1px_0_rgb(255_255_255/0.4),0_1px_2px_rgb(0_0_0/0.45)]',
          'hover-ok:shadow-glow-md hover-ok:brightness-105',
        ],
        secondary: [
          'shadow-inset-top border border-line-strong text-fg glass',
          'hover-ok:border-line-bright hover-ok:bg-surface-4/70',
        ],
        ghost: 'text-fg-2 hover-ok:bg-surface-3 hover-ok:text-fg',
        danger: [
          'border border-danger/25 bg-danger/12 text-danger',
          'hover-ok:border-danger/40 hover-ok:bg-danger/20',
        ],
        link: 'h-auto px-0 text-accent underline-offset-4 hover-ok:underline',
      },
      size: {
        sm: 'h-8 rounded-md px-3 text-sm [&_svg]:size-4',
        md: 'h-10 rounded-md px-4 text-base [&_svg]:size-[18px]',
        lg: 'h-12 rounded-lg px-6 text-md [&_svg]:size-5',
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
