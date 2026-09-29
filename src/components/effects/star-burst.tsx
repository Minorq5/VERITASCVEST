'use client';

import { motion } from 'motion/react';
import { useLessMotion } from '@/lib/hooks/use-less-motion';

const STAR = 'M12 3.5c.6 4.9 3.6 7.9 8.5 8.5-4.9.6-7.9 3.6-8.5 8.5-.6-4.9-3.6-7.9-8.5-8.5 4.9-.6 7.9-3.6 8.5-8.5Z';

/**
 * A burst of stars from the centre of the screen: the small celebration at
 * the end of onboarding (the particle version arrives with the 3D stage).
 */
export function StarBurst({ count = 18 }: { count?: number }) {
  const reduce = useLessMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[var(--z-toast)] flex items-center justify-center">
      <motion.span
        className="absolute size-40 rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 55%, transparent), transparent 70%)' }}
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 3.2, opacity: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.2;
        const distance = 140 + (i % 3) * 70;
        const size = 10 + (i % 4) * 5;
        return (
          <motion.svg
            key={i}
            viewBox="0 0 24 24"
            className="absolute"
            style={{ width: size, height: size, filter: 'drop-shadow(0 0 6px var(--accent))' }}
            initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, scale: [0, 1.2, 0.6], rotate: 160, opacity: [1, 1, 0] }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: (i % 5) * 0.03 }}
          >
            <path d={STAR} fill={i % 3 === 0 ? 'white' : 'var(--accent)'} />
          </motion.svg>
        );
      })}
    </div>
  );
}
