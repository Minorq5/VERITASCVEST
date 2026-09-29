'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useState } from 'react';
import { useDeviceSettings } from '@/stores/device-settings';
import { useFinePointer } from '@/lib/hooks/use-media-query';
import { useLessMotion } from '@/lib/hooks/use-less-motion';

const INTERACTIVE =
  'a, button, [role="button"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], [role="slider"], label, select, summary, [data-cursor="hover"]';
const TEXT =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"]';

/**
 * A quiet custom cursor: an exact dot plus a ring that trails with a spring
 * and grows over interactive elements. Hidden over text fields (the system
 * caret is more precise) and on touch devices.
 */
export function CustomCursor() {
  const mode = useDeviceSettings((s) => s.cursor);
  const fine = useFinePointer();
  const reduce = useLessMotion();
  const enabled = mode === 'custom' && fine;

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, reduce ? { duration: 0 } : { stiffness: 520, damping: 40, mass: 0.5 });
  const ringY = useSpring(y, reduce ? { duration: 0 } : { stiffness: 520, damping: 40, mass: 0.5 });
  const [state, setState] = useState<'idle' | 'hover' | 'text' | 'hidden'>('hidden');
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.setAttribute('data-cursor', 'custom');
    else root.removeAttribute('data-cursor');
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      x.set(event.clientX);
      y.set(event.clientY);
      const target = event.target as Element | null;
      if (target?.closest(TEXT)) setState('text');
      else if (target?.closest(INTERACTIVE)) setState('hover');
      else setState('idle');
    };
    const leave = () => setState('hidden');
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('blur', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('blur', leave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  const visible = state !== 'hidden' && state !== 'text';
  const ringScale = state === 'hover' ? (pressed ? 1.25 : 1.6) : pressed ? 0.8 : 1;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[var(--z-cursor)]">
      <motion.div
        className="absolute top-0 left-0 -mt-4 -ml-4 size-8 rounded-full border border-[color-mix(in_oklab,var(--accent)_70%,transparent)]"
        style={{ x: ringX, y: ringY }}
        animate={{
          scale: ringScale,
          opacity: visible ? 1 : 0,
          backgroundColor:
            state === 'hover'
              ? 'color-mix(in oklab, var(--accent) 12%, transparent)'
              : 'rgba(0,0,0,0)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      />
      <motion.div
        className="absolute top-0 left-0 -mt-[3px] -ml-[3px] size-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)]"
        style={{ x, y }}
        animate={{ opacity: visible ? 1 : 0, scale: state === 'hover' ? 0.5 : 1 }}
        transition={{ duration: 0.15 }}
      />
    </div>
  );
}
