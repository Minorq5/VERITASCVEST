'use client';

import { motion } from 'motion/react';
import { ToggleGroup } from 'radix-ui';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { spring } from '@/lib/motion/tokens';

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Mutually exclusive options with a pill that glides between them. */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  const layoutId = useId();
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next as T)}
      aria-label={label}
      className={cn(
        'shadow-inset-top relative no-scrollbar inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-line-strong p-1 glass',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm font-medium focus-ring',
              'transition-colors duration-200 ease-out [&_svg]:size-4',
              size === 'sm' ? 'h-7 px-2.5 text-sm' : 'h-8 px-3 text-sm',
              active ? 'text-fg' : 'text-fg-3 hover-ok:text-fg-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-sm border border-line-bright bg-surface-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_2px_8px_-2px_rgb(0_0_0/0.6)]"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
