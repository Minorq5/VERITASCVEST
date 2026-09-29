/** Device-level settings shared by server (boot script) and client (store). */

export const accents = ['amber', 'blue', 'white'] as const;
export type Accent = (typeof accents)[number];

export const graphicsQualities = ['auto', 'ultra', 'high', 'low', 'off'] as const;
export type GraphicsQuality = (typeof graphicsQualities)[number];

/** custom: stars bend around the pointer (lensing); system: a still sky. */
export type CursorMode = 'custom' | 'system';
export type MotionMode = 'system' | 'reduced';

/** auto: the full intro on the first visit, the short one on later visits; short: always short; off: none. */
export const introModes = ['auto', 'short', 'off'] as const;
export type IntroMode = (typeof introModes)[number];

export interface DeviceSettings {
  accent: Accent;
  cursor: CursorMode;
  motion: MotionMode;
  quality: GraphicsQuality;
  haptics: boolean;
  intro: IntroMode;
}

export const DEVICE_SETTINGS_KEY = 'vt:device';

export const defaultDeviceSettings: DeviceSettings = {
  accent: 'amber',
  cursor: 'custom',
  motion: 'system',
  quality: 'auto',
  haptics: true,
  intro: 'auto',
};

/** Keys the intro uses in storage (read by the boot script before the first paint). */
export const INTRO_SEEN_KEY = 'vt:intro-seen';
export const INTRO_SESSION_KEY = 'vt:intro-played';
