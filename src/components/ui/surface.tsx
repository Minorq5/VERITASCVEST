import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** raised: one level above the page (default); sunken: back at page level inside a raised block. */
  tone?: 'raised' | 'sunken';
  interactive?: boolean;
}

/** A block of content: a background level and a 1px line. Depth comes from levels, never from shadows. */
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { tone = 'raised', interactive = false, className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative rounded-xl border',
        tone === 'raised' ? 'border-line bg-surface-1' : 'border-line bg-bg',
        interactive && 'transition-[border-color,background-color] duration-140 ease-out hover-ok:border-line-strong hover-ok:bg-surface-2',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
