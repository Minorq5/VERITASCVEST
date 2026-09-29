'use client';

import { useCallback, useRef, useState } from 'react';

/** Runs an async submit at most once at a time: double clicks do nothing. */
export function useGuardedSubmit() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const run = useCallback(async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await task();
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);
  return { pending, run };
}
