'use client';

import { useReducedMotion } from 'motion/react';
import { useDeviceSettings } from '@/stores/device-settings';

/** True when the OS asks for less motion or the person chose it in settings. */
export function useLessMotion(): boolean {
  const system = useReducedMotion();
  const setting = useDeviceSettings((s) => s.motion);
  return setting === 'reduced' || !!system;
}
