import { cn } from '@/lib/utils/cn';

/** A physical key. Used in tooltips, the palette and the shortcut sheet. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-xs px-1.5 font-mono text-xs font-medium text-fg-2',
        'border border-b-2 border-line-strong bg-surface-3',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
