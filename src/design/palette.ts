/**
 * Palette mirror for TypeScript (showcase, charts, 3D scenes).
 * The CSS tokens in src/styles/globals.css are the source of truth;
 * tests/unit/palette.test.ts fails if the two drift apart.
 */
export const surfaces = {
  void: '#03050a',
  bg: '#060912',
  'surface-1': '#0a0f1b',
  'surface-2': '#0e1422',
  'surface-3': '#131a2b',
  'surface-4': '#1a2338',
  'surface-5': '#243049',
} as const;

export const text = {
  fg: '#e8edfa',
  'fg-2': '#b2bcd3',
  'fg-3': '#8791ae',
  'fg-4': '#5c6788',
} as const;

export const semantic = {
  success: '#5fe3a1',
  warning: '#ffb547',
  danger: '#ff6b7d',
  info: '#7fb6ff',
} as const;

export const priorities = {
  critical: '#ff5e73',
  high: '#ffb547',
  medium: '#6fb6ff',
  low: '#8e99b5',
} as const;

export const swatches = {
  cyan: '#5ce1ee',
  sky: '#6fb6ff',
  indigo: '#8c9bff',
  violet: '#b294ff',
  orchid: '#f28ad9',
  rose: '#ff7f9f',
  coral: '#ff8a6b',
  amber: '#ffb547',
  lime: '#c4e86b',
  mint: '#6bf0b8',
  teal: '#3fd0c0',
  slate: '#9aa6c4',
} as const;

export type SwatchName = keyof typeof swatches;

export const accentPalette = {
  cyan: { accent: '#5ce1ee', hi: '#92edf6', lo: '#2ab8c9', ink: '#04161a' },
  ice: { accent: '#8fb8ff', hi: '#b5d0ff', lo: '#5e8fe8', ink: '#06122a' },
  aurora: { accent: '#6bf0b8', hi: '#9df6d0', lo: '#33c98c', ink: '#05190f' },
  nebula: { accent: '#b294ff', hi: '#cdb9ff', lo: '#8b68f0', ink: '#140a2c' },
  plasma: { accent: '#f28ad9', hi: '#f8b3e7', lo: '#d65dbb', ink: '#2a0822' },
  solar: { accent: '#f2d48f', hi: '#f8e3b5', lo: '#d9b25e', ink: '#2a1d05' },
} as const;
