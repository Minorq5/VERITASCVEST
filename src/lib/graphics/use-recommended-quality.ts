'use client';

import { useSyncExternalStore } from 'react';
import { detectGraphicsQuality, type ConcreteQuality } from './detect';

let detected: ConcreteQuality | undefined;
const noop = () => () => undefined;

/** What this device can comfortably run. Probed once per page load; undefined on the server. */
export function useRecommendedQuality(): ConcreteQuality | undefined {
  return useSyncExternalStore(
    noop,
    () => (detected ??= detectGraphicsQuality()),
    () => undefined,
  );
}
