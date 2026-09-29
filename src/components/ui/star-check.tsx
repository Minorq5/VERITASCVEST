'use client';

import { AnimatePresence, motion } from 'motion/react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { useLessMotion } from '@/lib/hooks/use-less-motion';

interface StarCheckProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Ring colour, usually the priority colour. Defaults to the neutral line. */
  color?: string;
  label: string;
  size?: number;
}

/**
 * The task completion control. A ring that ignites into a four-point star;
 * the particle supernova is layered on top by the effects canvas (stage 7).
 */
export const StarCheck = forwardRef<HTMLButtonElement, StarCheckProps>(function StarCheck(
  { checked, onCheckedChange, color, label, size = 22, className, disabled, ...props },
  ref,
) {
  const reduce = useLessMotion();
  const ring = color ?? 'var(--color-line-bright)';
  const fill = color ?? 'var(--accent)';

  return (
    <button
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'group/star relative inline-flex shrink-0 items-center justify-center rounded-full focus-ring',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {/* ring */}
      <span
        className="absolute inset-0 rounded-full border-[1.75px] transition-[border-color,background-color,box-shadow,transform] duration-300 ease-out motion-ok:group-active/star:scale-90"
        style={{
          borderColor: checked ? fill : ring,
          backgroundColor: checked ? fill : 'transparent',
          boxShadow: checked ? `0 0 14px -2px ${fill}` : undefined,
        }}
      />
      {/* hover hint: a faint star inside the empty ring */}
      {!checked && (
        <svg
          viewBox="0 0 24 24"
          className="relative size-[62%] opacity-0 transition-opacity duration-200 group-hover/star:opacity-60"
          aria-hidden
        >
          <path
            d="M12 3.5c.6 4.9 3.6 7.9 8.5 8.5-4.9.6-7.9 3.6-8.5 8.5-.6-4.9-3.6-7.9-8.5-8.5 4.9-.6 7.9-3.6 8.5-8.5Z"
            fill={fill}
          />
        </svg>
      )}
      <AnimatePresence initial={false}>
        {checked && (
          <motion.svg
            key="star"
            viewBox="0 0 24 24"
            className="relative size-[70%]"
            aria-hidden
            initial={reduce ? { opacity: 0 } : { scale: 0, rotate: -60, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0, rotate: 45, opacity: 0 }}
            transition={
              reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 520, damping: 22 }
            }
          >
            <path
              d="M12 2.5c.7 5.6 3.9 8.8 9.5 9.5-5.6.7-8.8 3.9-9.5 9.5-.7-5.6-3.9-8.8-9.5-9.5 5.6-.7 8.8-3.9 9.5-9.5Z"
              fill="var(--color-bg)"
            />
          </motion.svg>
        )}
      </AnimatePresence>
      {/* burst ring */}
      <AnimatePresence>
        {checked && !reduce && (
          <motion.span
            key="burst"
            className="pointer-events-none absolute inset-0 rounded-full border-2"
            style={{ borderColor: fill }}
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2.3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>
    </button>
  );
});
