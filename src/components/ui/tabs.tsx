'use client';

import { motion } from 'motion/react';
import { Tabs as T } from 'radix-ui';
import {
  createContext,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils/cn';
import { spring } from '@/lib/motion/tokens';

const TabsContext = createContext<{ value: string; layoutId: string } | null>(null);

interface TabsProps extends Omit<
  ComponentPropsWithoutRef<typeof T.Root>,
  'value' | 'onValueChange'
> {
  value: string;
  onValueChange: (value: string) => void;
}

export function Tabs({ value, onValueChange, children, ...props }: TabsProps) {
  const layoutId = useId();
  return (
    <TabsContext.Provider value={{ value, layoutId }}>
      <T.Root value={value} onValueChange={onValueChange} {...props}>
        {children}
      </T.Root>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof T.List>) {
  return (
    <T.List
      className={cn('relative flex items-center gap-1 border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof T.Trigger> & { children: ReactNode }) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <T.Trigger
      value={value}
      className={cn(
        'relative -mb-px inline-flex h-9 items-center gap-2 rounded-t-xs px-3 text-sm font-medium focus-ring',
        'transition-colors duration-140 ease-out [&_svg]:size-4',
        active ? 'text-fg' : 'text-fg-3 hover-ok:text-fg-2',
        className,
      )}
      {...props}
    >
      {children}
      {active && ctx && (
        <motion.span
          layoutId={ctx.layoutId}
          transition={spring.snappy}
          className="absolute inset-x-0 -bottom-px h-px bg-accent"
        />
      )}
    </T.Trigger>
  );
}

export const TabsContent = T.Content;
