import { Golos_Text, IBM_Plex_Mono, Tektur, Wix_Madefor_Display } from 'next/font/google';

/** Candidates compared with the chosen faces on /design (DESIGN_V2 §4). Loaded on /design only. */
export const altWix = Wix_Madefor_Display({ subsets: ['latin', 'cyrillic'], display: 'swap', preload: false });
export const altTektur = Tektur({ subsets: ['latin', 'cyrillic'], display: 'swap', preload: false });
export const altGolos = Golos_Text({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], display: 'swap', preload: false });
export const altPlexMono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
});
