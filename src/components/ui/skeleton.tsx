import { cn } from '@/lib/utils/cn';

/** Placeholder in the shape of real content. Shimmer stops with reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block rounded-sm bg-surface-3',
        'motion-ok:animate-shimmer motion-ok:bg-[linear-gradient(100deg,var(--color-surface-3)_30%,var(--color-surface-4)_50%,var(--color-surface-3)_70%)] motion-ok:bg-[length:200%_100%]',
        className,
      )}
    />
  );
}
