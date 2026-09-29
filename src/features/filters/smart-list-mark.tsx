import { ListFilter } from 'lucide-react';
import { swatchVar } from '@/lib/color/swatches';

/** The mark of a smart list: a filter in the list's colour. */
export function SmartListMark({ color, size = 'md' }: { color: string; size?: 'md' | 'lg' }) {
  if (size === 'lg') {
    return (
      <span
        aria-hidden
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-md border border-line bg-surface-1"
        style={{ color: swatchVar(color) }}
      >
        <ListFilter className="size-5" />
      </span>
    );
  }
  return <ListFilter aria-hidden className="size-4 shrink-0" style={{ color: swatchVar(color) }} />;
}
