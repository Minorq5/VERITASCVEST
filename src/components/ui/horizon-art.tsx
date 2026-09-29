import { cn } from '@/lib/utils/cn';

/**
 * Line drawing for empty states: an orbit around a black point, drawn like a
 * chart. No gradients, no glow; one accent tick marks where the next task lands.
 */
export function HorizonArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 120" className={cn('overflow-visible', className)} aria-hidden>
      <g fill="none" strokeWidth={1} vectorEffect="non-scaling-stroke">
        <ellipse cx="120" cy="60" rx="108" ry="30" stroke="var(--color-line-strong)" />
        <ellipse cx="120" cy="60" rx="72" ry="20" stroke="var(--color-line-strong)" strokeDasharray="2 4" />
        <ellipse cx="120" cy="60" rx="40" ry="11" stroke="var(--color-line-bright)" />
        <line x1="4" y1="60" x2="236" y2="60" stroke="var(--color-line)" />
      </g>
      <circle cx="120" cy="60" r="13" fill="var(--color-void)" stroke="var(--color-fg-4)" strokeWidth={1} />
      <circle cx="228" cy="60" r="3" fill="var(--accent)" />
      <line x1="228" y1="50" x2="228" y2="42" stroke="var(--accent)" strokeWidth={1} />
      {[
        [30, 22],
        [206, 18],
        [58, 104],
        [188, 98],
        [150, 14],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.5} height={1.5} fill="var(--color-fg-3)" />
      ))}
    </svg>
  );
}
