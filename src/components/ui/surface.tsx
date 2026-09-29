'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { useSpotlight } from '@/components/effects/spotlight';

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** glass: floats over the scene; solid: sits in content. */
  tone?: 'solid' | 'glass';
  /** Soft light follows the pointer. */
  spotlight?: boolean;
  interactive?: boolean;
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  { tone = 'solid', spotlight = false, interactive = false, className, children, ...props },
  ref,
) {
  const spot = useSpotlight<HTMLDivElement>(spotlight);
  return (
    <div
      ref={(node) => {
        spot.ref.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      onPointerMove={spot.onPointerMove}
      className={cn(
        'shadow-inset-top relative rounded-lg border border-line',
        tone === 'glass' ? 'shadow-md glass' : 'bg-surface-2',
        interactive &&
          'transition-[border-color,transform,box-shadow] duration-200 ease-out hover-ok:border-line-strong hover-ok:shadow-md motion-ok:hover-ok:-translate-y-0.5',
        className,
      )}
      {...props}
    >
      {spotlight && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] spotlight opacity-0 transition-opacity duration-300 [:hover>&]:opacity-100"
        />
      )}
      {children}
    </div>
  );
});
