'use client';

import { RadioGroup } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Tooltip } from './tooltip';

interface Swatch<T extends string> {
  value: T;
  color: string;
  label: string;
}

interface ColorSwatchesProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  swatches: Swatch<T>[];
  label: string;
  size?: number;
  className?: string;
}

export function ColorSwatches<T extends string>({
  value,
  onValueChange,
  swatches,
  label,
  size = 32,
  className,
}: ColorSwatchesProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      aria-label={label}
      orientation="horizontal"
      className={cn('flex flex-wrap gap-2.5', className)}
    >
      {swatches.map((swatch) => (
        <Tooltip key={swatch.value} content={swatch.label}>
          <RadioGroup.Item
            value={swatch.value}
            aria-label={swatch.label}
            className={cn(
              'relative inline-flex items-center justify-center rounded-full focus-ring transition-transform duration-200 ease-out',
              'data-[state=checked]:ring-2 data-[state=checked]:ring-offset-2 data-[state=checked]:ring-offset-bg motion-ok:hover-ok:scale-110',
            )}
            style={{
              width: size,
              height: size,
              background: `radial-gradient(circle at 32% 28%, color-mix(in oklab, ${swatch.color} 55%, white), ${swatch.color} 55%, color-mix(in oklab, ${swatch.color} 60%, black))`,
              ['--tw-ring-color' as string]: swatch.color,
              boxShadow: value === swatch.value ? `0 0 18px -2px ${swatch.color}` : undefined,
            }}
          >
            <RadioGroup.Indicator>
              <Check className="size-4 text-[#05080f]" strokeWidth={3} />
            </RadioGroup.Indicator>
          </RadioGroup.Item>
        </Tooltip>
      ))}
    </RadioGroup.Root>
  );
}
