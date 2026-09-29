'use client';

import { motion, useSpring } from 'motion/react';
import { useRef, type ReactNode } from 'react';
import { useFinePointer } from '@/lib/hooks/use-media-query';
import { useLessMotion } from '@/lib/hooks/use-less-motion';

interface MagneticProps {
  children: ReactNode;
  /** Share of the pointer offset the element follows (0..1). */
  strength?: number;
  className?: string;
}

/** Pulls the main call-to-action gently toward the cursor. Desktop only. */
export function Magnetic({ children, strength = 0.28, className }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const fine = useFinePointer();
  const reduce = useLessMotion();
  const x = useSpring(0, { stiffness: 260, damping: 18, mass: 0.6 });
  const y = useSpring(0, { stiffness: 260, damping: 18, mass: 0.6 });
  const active = fine && !reduce;

  return (
    <motion.span
      ref={ref}
      className={className ?? 'inline-flex'}
      style={active ? { x, y } : undefined}
      onPointerMove={(event) => {
        if (!active || event.pointerType !== 'mouse' || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
        y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}
