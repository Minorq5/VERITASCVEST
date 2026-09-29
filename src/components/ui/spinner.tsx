import { cn } from '@/lib/utils/cn';

interface SpinnerProps {
  size?: number;
  className?: string;
  /** Announced to screen readers; omit when a parent already says "loading". */
  label?: string;
}

/** A small moon on an orbit. Rotation stops when motion is reduced. */
export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-full border-[1.5px] border-current opacity-25" />
      <span className="absolute inset-0 motion-ok:animate-orbit">
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current shadow-[0_0_6px_currentColor]"
          style={{ width: Math.max(3, size * 0.28), height: Math.max(3, size * 0.28) }}
        />
      </span>
    </span>
  );
}
