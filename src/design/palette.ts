/**
 * Palette mirror for TypeScript (showcase, charts, 3D scenes).
 * The CSS tokens in src/styles/tokens.css are the source of truth;
 * tests/unit/palette.test.ts fails if the two drift apart.
 */
export const surfaces = {
  void: '#020203',
  bg: '#050506',
  'surface-1': '#0b0b0d',
  'surface-2': '#111114',
  'surface-3': '#17181c',
  'surface-4': '#1e1f24',
  'surface-5': '#27292f',
} as const;

export const lines = {
  line: '#1b1c21',
  'line-strong': '#26292f',
  'line-bright': '#3a3d45',
} as const;

export const text = {
  fg: '#f2ede4',
  'fg-2': '#bcb5a9',
  'fg-3': '#8e887e',
  'fg-4': '#5c5851',
} as const;

/** The three physical colours: disk light, Doppler blue, danger. */
export const physical = {
  amber: '#ff8a2a',
  'amber-hi': '#ffa65c',
  'amber-lo': '#c4600f',
  blue: '#6fa8ff',
  'blue-hi': '#9cc3ff',
  'blue-lo': '#3f74c7',
  red: '#ff5247',
} as const;

export const semantic = {
  success: '#ffa65c',
  warning: '#e8b54d',
  danger: '#ff5247',
  info: '#6fa8ff',
} as const;

export const priorities = {
  critical: '#ff5247',
  high: '#ff8a2a',
  medium: '#6fa8ff',
  low: '#7e796f',
} as const;

/** Tag and project colours: the spectrum of stars, from cool red M to blue O. */
export const swatches = {
  rust: '#d0643e',
  amber: '#ff8a2a',
  gold: '#e3b34c',
  sand: '#cbb89a',
  star: '#f2ede4',
  ice: '#b9d3ff',
  blue: '#6fa8ff',
  steel: '#8195b0',
  ash: '#8e887e',
} as const;

export type SwatchName = keyof typeof swatches;

export const accentPalette = {
  amber: { accent: '#ff8a2a', hi: '#ffa65c', lo: '#c4600f', ink: '#160a02' },
  blue: { accent: '#6fa8ff', hi: '#9cc3ff', lo: '#3f74c7', ink: '#03101f' },
  white: { accent: '#f2ede4', hi: '#ffffff', lo: '#bcb5a9', ink: '#0b0a09' },
} as const;
