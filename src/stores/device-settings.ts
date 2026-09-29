'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEVICE_SETTINGS_KEY, defaultDeviceSettings, type DeviceSettings } from '@/lib/device';

interface DeviceSettingsStore extends DeviceSettings {
  set: <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => void;
}

/**
 * Settings that belong to this device rather than to the account:
 * a phone and a desktop usually want different graphics and cursors.
 */
export const useDeviceSettings = create<DeviceSettingsStore>()(
  persist(
    (set) => ({
      ...defaultDeviceSettings,
      set: (key, value) => set({ [key]: value } as Partial<DeviceSettings>),
    }),
    {
      name: DEVICE_SETTINGS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
