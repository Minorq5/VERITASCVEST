'use client';

import { useCallback, useRef, type PointerEvent } from 'react';

/**
 * Writes the pointer position into --mx / --my on the element so CSS can draw
 * a soft light under the cursor. One rAF per frame at most, no React renders.
 */
export function useSpotlight<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);
  const frame = useRef(0);

  const onPointerMove = useCallback(
    (event: PointerEvent<T>) => {
      if (!enabled || event.pointerType !== 'mouse') return;
      const el = ref.current;
      if (!el) return;
      const { clientX, clientY } = event;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${clientX - rect.left}px`);
        el.style.setProperty('--my', `${clientY - rect.top}px`);
      });
    },
    [enabled],
  );

  return { ref, onPointerMove };
}
