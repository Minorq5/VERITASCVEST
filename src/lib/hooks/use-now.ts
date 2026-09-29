'use client';

import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  now = Date.now();
  for (const listener of listeners) listener();
}

function onVisible() {
  // A sleeping laptop or a background tab skips ticks: catch up at once.
  if (document.visibilityState === 'visible') tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

/**
 * The current time, shared by the whole app and refreshed every 30 seconds:
 * lists roll over at midnight and deadlines turn "overdue" without a reload.
 */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
