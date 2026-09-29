import { Geologica, Golos_Text, Inter, Manrope, Martian_Mono } from 'next/font/google';

/** Alternatives shown next to the approved trio. Loaded on /design only. */
export const altGeologica = Geologica({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
});
export const altManrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
});
export const altGolos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
});
export const altInter = Inter({ subsets: ['latin', 'cyrillic'], display: 'swap', preload: false });
export const altMartian = Martian_Mono({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
});
