'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { SessionSync } from '@/components/session-sync';
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
      mutations: { retry: 0 },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const motion = useDeviceSettings((s) => s.motion);
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig
        reducedMotion={motion === 'reduced' ? 'always' : 'user'}
        transition={spring.smooth}
      >
        <TooltipProvider delayDuration={450} skipDelayDuration={250}>
          <SessionSync />
          <DeviceAttributes />
          {children}
          <Toaster />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
