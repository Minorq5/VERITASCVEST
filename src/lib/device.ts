/** Device-level settings shared by server (boot script) and client (store). */

export const accents = ['amber', 'blue', 'white'] as const;
export type Accent = (typeof accents)[number];

export const graphicsQualities = ['auto', 'ultra', 'high', 'low', 'off'] as const;
export type GraphicsQuality = (typeof graphicsQualities)[number];

/** custom: stars bend around the pointer (lensing); system: a still sky. */
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
  accent: 'amber',
  cursor: 'custom',
  motion: 'system',
  quality: 'auto',
  haptics: true,
};
