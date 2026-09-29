'use client';

import { MotionConfig } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { CustomCursor } from '@/components/effects/custom-cursor';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { spring } from '@/lib/motion/tokens';
import { useDeviceSettings } from '@/stores/device-settings';

/** Mirrors device settings onto <html> after the boot script's first pass. */
function DeviceAttributes() {
  const accent = useDeviceSettings((s) => s.accent);
  const motion = useDeviceSettings((s) => s.motion);
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);
  useEffect(() => {
    const root = document.documentElement;
    if (motion === 'reduced') root.setAttribute('data-motion', 'reduced');
    else root.removeAttribute('data-motion');
  }, [motion]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const motion = useDeviceSettings((s) => s.motion);
  return (
    <MotionConfig
      reducedMotion={motion === 'reduced' ? 'always' : 'user'}
      transition={spring.smooth}
    >
      <TooltipProvider delayDuration={450} skipDelayDuration={250}>
        <DeviceAttributes />
        {children}
        <Toaster />
        <CustomCursor />
      </TooltipProvider>
    </MotionConfig>
  );
}
