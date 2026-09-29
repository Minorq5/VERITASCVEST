'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { accents, DEVICE_SETTINGS_KEY, defaultDeviceSettings, introModes, type DeviceSettings } from '@/lib/device';

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
      version: 3,
      storage: createJSONStorage(() => localStorage),
      // v2: the redesign replaced the six accents with amber, blue and white. v3: the intro setting.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<DeviceSettings>;
        const accent = (accents as readonly string[]).includes(state.accent ?? '') ? state.accent : defaultDeviceSettings.accent;
        const intro = (introModes as readonly string[]).includes(state.intro ?? '') ? state.intro : defaultDeviceSettings.intro;
        return { ...defaultDeviceSettings, ...state, accent, intro } as DeviceSettingsStore;
      },
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
