'use client';

import { Avatar as A } from 'radix-ui';
import { cn } from '@/lib/utils/cn';
import { hashString } from '@/lib/utils/hash';

/** Curated two-tone "nebula" fills for people without a photo. */
const NEBULAE: [string, string][] = [
  ['#1f6f8b', '#5ce1ee'],
  ['#3b3f9e', '#8fb8ff'],
  ['#1e7a5f', '#6bf0b8'],
  ['#5b3fa8', '#b294ff'],
  ['#8a2f73', '#f28ad9'],
  ['#8a5a1f', '#f2d48f'],
  ['#2d5a8a', '#6fb6ff'],
  ['#7a3144', '#ff7f9f'],
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return (first + second).toUpperCase();
}

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
  onlineLabel?: string;
  className?: string;
  ring?: boolean;
}

export function Avatar({
  name,
  src,
  size = 36,
  online,
  onlineLabel,
  className,
  ring,
}: AvatarProps) {
  const [from, to] = NEBULAE[hashString(name) % NEBULAE.length] ?? NEBULAE[0]!;
  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <A.Root
        className={cn(
          'inline-flex size-full items-center justify-center overflow-hidden rounded-full select-none',
          ring && 'ring-2 ring-bg',
        )}
      >
        {src && <A.Image src={src} alt={name} className="size-full object-cover" />}
        <A.Fallback
          delayMs={src ? 400 : 0}
          className="flex size-full items-center justify-center font-display font-semibold text-white"
          style={{
            background: `radial-gradient(circle at 30% 25%, ${to}, ${from} 70%)`,
            fontSize: Math.max(10, size * 0.36),
          }}
          aria-label={name}
        >
          {initials(name)}
        </A.Fallback>
      </A.Root>
      {online && (
        <span
          className="absolute right-0 bottom-0 block rounded-full border-2 border-bg bg-success shadow-[0_0_8px_var(--color-success)]"
          style={{ width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }}
          role="img"
          aria-label={onlineLabel}
        />
      )}
    </span>
  );
}

export function AvatarGroup({
  people,
  size = 28,
  max = 4,
  className,
}: {
  people: { name: string; src?: string | null }[];
  size?: number;
  max?: number;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cn('flex items-center', className)}>
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          src={p.src}
          size={size}
          ring
          className={i > 0 ? '-ml-2' : ''}
        />
      ))}
      {rest > 0 && (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-surface-4 font-mono text-xs text-fg-2 ring-2 ring-bg"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
