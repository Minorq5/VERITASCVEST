import { defaultView, type BlackHoleView } from './renderer';

export type IntroShot = 'darkness' | 'lensing' | 'horizon' | 'logo';
export const introShots: readonly IntroShot[] = ['darkness', 'lensing', 'horizon', 'logo'];

const view = (patch: Partial<BlackHoleView>): BlackHoleView => ({ ...defaultView, ...patch });

/**
 * Key frames of the intro (DESIGN_V2 §8). The real-time intro interpolates
 * between them; the stills for review are rendered from exactly these.
 */
export const introViews: Record<IntroShot, BlackHoleView> = {
  // 0–1.5 s: darkness and a single point of light far away (the disk, unresolved).
  darkness: view({ distance: 3600, elevation: 9, fov: 34, stars: 0, disk: 2.2, exposure: 3.6, bloom: 1.2, shift: [0.07, -0.04] }),
  // 1.5–4 s: the stars around the point start to bend; the disk is still too dim to see.
  lensing: view({ distance: 21, elevation: 3, fov: 46, stars: 1.7, disk: 0.012, exposure: 1.15, bloom: 0.6 }),
  // 4–7 s: close to the hole: the disk above and below the shadow, the photon ring, Doppler.
  horizon: view({ distance: 18, elevation: 6.5, fov: 42, roll: -5, stars: 0.8, disk: 1, exposure: 0.72, bloom: 0.7, time: 3 }),
  // After the pass through the ring: darkness, then light. Seen from above, the disk
  // becomes a ring and the shadow a dark circle; the logo assembles inside it.
  logo: view({ distance: 15, elevation: 84, fov: 36, stars: 0.25, disk: 0.8, exposure: 0.24, bloom: 0.45, time: 5, portraitFit: 1 }),
};
