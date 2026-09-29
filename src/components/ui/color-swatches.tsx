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
  size = 28,
  className,
}: ColorSwatchesProps<T>) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      aria-label={label}
      orientation="horizontal"
      className={cn('flex flex-wrap gap-2', className)}
    >
      {swatches.map((swatch) => (
        <Tooltip key={swatch.value} content={swatch.label}>
          <RadioGroup.Item
            value={swatch.value}
            aria-label={swatch.label}
            className={cn(
              'relative inline-flex items-center justify-center rounded-xs focus-ring',
              'outline-offset-2 data-[state=checked]:outline data-[state=checked]:outline-1 data-[state=checked]:outline-fg',
            )}
            style={{
              width: size,
              height: size,
              background: swatch.color,
            }}
          >
            <RadioGroup.Indicator>
              <Check className="size-3.5 text-void" strokeWidth={2.5} />
            </RadioGroup.Indicator>
          </RadioGroup.Item>
        </Tooltip>
      ))}
    </RadioGroup.Root>
  );
}
