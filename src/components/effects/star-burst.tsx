'use client';

import { motion } from 'motion/react';
import { useLessMotion } from '@/lib/hooks/use-less-motion';

/**
 * The small celebration at the end of onboarding: two thin rings run outward
 * from the centre like a lensing ripple, and a single point of accent light
 * collapses into black. Lines only, no glow; the particle version arrives
 * with the 3D stage.
 */
export function StarBurst() {
  const reduce = useLessMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[var(--z-toast)] flex items-center justify-center">
      {[0, 0.12].map((delay) => (
        <motion.span
          key={delay}
          className="absolute size-24 rounded-full border border-accent"
          initial={{ scale: 0.2, opacity: 0.9 }}
          animate={{ scale: 9, opacity: 0 }}
          transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      <motion.span
        className="absolute size-3 rounded-full bg-accent"
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: [1, 1.6, 0], opacity: [1, 1, 0] }}
        transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
      />
    </div>
  );
}
