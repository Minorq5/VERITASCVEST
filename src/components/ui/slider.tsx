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
      <S.Track className="relative h-0.5 grow overflow-hidden bg-line-bright">
        <S.Range className="absolute h-full bg-accent" />
      </S.Track>
      {current.map((v, i) => (
        <S.Thumb
          key={i}
          aria-label={label}
          className={cn(
            'relative block h-4 w-2 rounded-[1px] bg-fg focus-ring',
            'transition-colors duration-140 ease-out hover-ok:bg-accent-hi',
          )}
        >
          {formatValue && (
            <span
              className={cn(
                'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-xs px-1.5 py-0.5',
                'border border-line-bright bg-surface-3 font-mono text-xs text-fg tabular',
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
