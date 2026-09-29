'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => undefined;

/**
 * A value that only exists in the browser (origin, feature support).
 * `server` is used for the server render and hydration, so markup matches.
 * The getter must return a primitive or a cached object.
 */
export function useClientValue<T>(get: () => T, server: T): T {
  return useSyncExternalStore(noop, get, () => server);
}
