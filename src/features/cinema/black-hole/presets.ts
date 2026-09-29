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

export type SceneName = 'hero' | 'auth' | 'small';
export const sceneNames: readonly SceneName[] = ['hero', 'auth', 'small'];

/**
 * The scenes outside the intro. Each has a poster: the same view rendered
 * once, offline, by the same shader (scripts/cinema/render-posters.mjs). The
 * poster is the first paint, the fallback without WebGL2, and the whole scene
 * when graphics are off or motion is reduced. The live scene starts from the
 * poster's `time`, so the switch from picture to 3D is seamless.
 */
export const sceneViews: Record<SceneName, BlackHoleView> = {
  // Landing: close and large; the disk runs off the frame, the approaching side on the left.
  hero: view({ distance: 23, elevation: 8, fov: 40, roll: -8, shift: [0, -0.06], stars: 0.9, disk: 1, exposure: 0.62, bloom: 0.6, time: 3, portraitFit: 1 }),
  // Sign-in: a distant black hole in a wide frame, its disk turning slowly.
  auth: view({ distance: 60, elevation: 6, fov: 28, roll: -6, stars: 1, disk: 1, exposure: 0.8, bloom: 0.6, time: 3, portraitFit: 1 }),
  // 404 and empty states: a small still.
  small: view({ distance: 30, elevation: 10, fov: 30, roll: -6, stars: 0.6, disk: 1, exposure: 0.8, bloom: 0.55, time: 3, portraitFit: 1 }),
};

export interface ScenePoster {
  src: string;
  width: number;
  height: number;
}

export const scenePosters: Record<SceneName, ScenePoster> = {
  hero: { src: '/cinema/hero.webp', width: 1600, height: 1600 },
  auth: { src: '/cinema/auth.webp', width: 1920, height: 1200 },
  small: { src: '/cinema/small.webp', width: 700, height: 500 },
};
