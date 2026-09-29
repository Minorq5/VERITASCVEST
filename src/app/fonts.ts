import { JetBrains_Mono, Onest, Unbounded } from 'next/font/google';
import localFont from 'next/font/local';

/** Display face: wide, cosmic, full Cyrillic. Headlines, levels, big numbers. */
export const fontDisplay = Unbounded({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-unbounded',
  display: 'swap',
});

/** Text face: everything people read and operate. */
export const fontText = Onest({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-onest',
  display: 'swap',
});

/** Numbers that must not jitter: timers, counters, statistics. */
export const fontMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
});

/*
 * Onest and JetBrains Mono lack the Bulgarian letters ѝ / Ѝ. These two-glyph
 * fonts are built from each face's own и + grave (scripts/fonts), and the
 * browser uses them only for those code points.
 */
export const fontTextBg = localFont({
  src: '../assets/fonts/vt-onest-bg.woff2',
  variable: '--font-onest-bg',
  weight: '100 900',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+040D, U+045D' }],
});

export const fontMonoBg = localFont({
  src: '../assets/fonts/vt-jetbrains-bg.woff2',
  variable: '--font-jetbrains-bg',
  weight: '100 800',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+040D, U+045D' }],
});

export const fontVariables = [
  fontDisplay.variable,
  fontText.variable,
  fontMono.variable,
  fontTextBg.variable,
  fontMonoBg.variable,
].join(' ');
