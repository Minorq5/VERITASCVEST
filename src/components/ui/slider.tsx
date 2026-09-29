'use client';

import { Slider as S } from 'radix-ui';
import { useState, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface SliderProps extends ComponentPropsWithoutRef<typeof S.Root> {
  /** Shows the value above the thumb while dragging. */
  formatValue?: (value: number) => string;
  label: string;
}

export function Slider({
  className,
  formatValue,
  label,
  value,
  defaultValue,
  onValueChange,
  ...props
}: SliderProps) {
  const [dragging, setDragging] = useState(false);
  const [internal, setInternal] = useState<number[]>(value ?? defaultValue ?? [0]);
  const current = value ?? internal;

  return (
    <S.Root
      className={cn(
        'group/slider relative flex h-6 w-full touch-none items-center select-none',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
        className,
      )}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        setInternal(next);
        onValueChange?.(next);
      }}
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => setDragging(false)}
      onLostPointerCapture={() => setDragging(false)}
      {...props}
    >
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-5">
        <S.Range className="absolute h-full rounded-full bg-[linear-gradient(90deg,var(--accent-lo),var(--accent))] shadow-[0_0_12px_var(--accent)]" />
      </S.Track>
      {current.map((v, i) => (
        <S.Thumb
          key={i}
          aria-label={label}
          className={cn(
            'relative block size-5 rounded-full border-2 border-accent bg-fg shadow-[0_2px_8px_rgb(0_0_0/0.5)] focus-ring',
            'transition-[transform,box-shadow] duration-200 ease-out hover-ok:shadow-glow-sm',
            'motion-ok:active:scale-110',
          )}
        >
          {formatValue && (
            <span
              className={cn(
                'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-xs px-1.5 py-0.5',
                'border border-line-strong font-mono tabular text-xs text-fg shadow-md glass-strong',
                'transition-[opacity,transform] duration-150 ease-out',
                dragging
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-1 opacity-0 group-focus-within/slider:translate-y-0 group-focus-within/slider:opacity-100',
              )}
            >
              {formatValue(v)}
            </span>
          )}
        </S.Thumb>
      ))}
    </S.Root>
  );
}
