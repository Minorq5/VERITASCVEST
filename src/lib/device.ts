/** Device-level settings shared by server (boot script) and client (store). */

export const accents = ['cyan', 'ice', 'aurora', 'nebula', 'plasma', 'solar'] as const;
export type Accent = (typeof accents)[number];

export const graphicsQualities = ['auto', 'ultra', 'high', 'low', 'off'] as const;
export type GraphicsQuality = (typeof graphicsQualities)[number];

export type CursorMode = 'custom' | 'system';
export type MotionMode = 'system' | 'reduced';

export interface DeviceSettings {
  accent: Accent;
  cursor: CursorMode;
  motion: MotionMode;
  quality: GraphicsQuality;
  haptics: boolean;
}

export const DEVICE_SETTINGS_KEY = 'vt:device';

export const defaultDeviceSettings: DeviceSettings = {
  accent: 'cyan',
  cursor: 'custom',
  motion: 'system',
  quality: 'auto',
  haptics: true,
};
