import { Geologica, JetBrains_Mono, Onest } from 'next/font/google';
import localFont from 'next/font/local';

/**
 * Headings: a strict grotesque with full Cyrillic, including ѝ and the
 * Bulgarian letterforms (locl BGR). Chosen on /design against Wix Madefor
 * Display and Tektur (DESIGN_V2.md §4).
 */
export const fontDisplay = Geologica({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-heading',
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
