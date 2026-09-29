import { cn } from '@/lib/utils/cn';

/** Placeholder in the shape of real content. A slow dim pulse; still with reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block rounded-xs bg-surface-3 motion-ok:animate-pulse', className)} />;
}
