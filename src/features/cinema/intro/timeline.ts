import { defaultView, type BlackHoleView } from '../black-hole/renderer';

/**
 * The intro «Залёт в чёрную дыру» (DESIGN_V2 §8.1) as a pure function of
 * time, so the live intro, the pre-rendered video and the tests all see the
 * same frames.
 *
 *   0.0–1.2  darkness, one point of light in the centre
 *   1.2–3.0  stars appear and bend: space ahead is curved, the hole not yet seen
 *   3.0–5.5  the black hole comes out of the dark: disk above and below the shadow
 *   5.5–8.0  the camera rushes in: light smears, the disk fills the screen, time slows
 *   8.0–8.6  through the photon ring: black
 *   8.6–10   light opens from the centre, the mark draws itself, the page opens in a circle
 *
 * The short intro for later visits is the last two seconds of the full one.
 */
export type IntroVariant = 'full' | 'short';

export const INTRO_FULL = 10;
export const INTRO_SHORT = 2;
/** Where the short intro starts inside the full timeline. */
export const SHORT_FROM = INTRO_FULL - INTRO_SHORT;

export const introLength = (variant: IntroVariant) => (variant === 'full' ? INTRO_FULL : INTRO_SHORT);
/** Time in the full timeline for a moment of either variant. */
export const toFull = (variant: IntroVariant, t: number) => (variant === 'full' ? t : SHORT_FROM + t);

export interface IntroFrame {
  view: BlackHoleView;
  /** 0..1: radius of the light opening from the centre over the final scene. */
  light: number;
  /** 0..1: how much of the mark is drawn. */
  mark: number;
  /** 0..1: the wordmark under it. */
  word: number;
  /** 0..1: the page opening in a circle from the centre. */
  reveal: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const logLerp = (a: number, b: number, x: number) => Math.exp(lerp(Math.log(a), Math.log(b), x));
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const easeIn = (x: number) => x * x * x;
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** Scene seconds of disk rotation: steady, then slowing toward the horizon (time dilation). */
function diskTime(t: number) {
  const k = 0.8;
  if (t <= 5.5) return 1 + k * t;
  const u = Math.min(t, 8) - 5.5;
  // rate falls linearly from 1 to 0.15 over 2.5 s
  return 1 + k * (5.5 + u - (0.85 * u * u) / 5);
}

const FINAL: BlackHoleView = {
  ...defaultView,
  distance: 15,
  elevation: 84,
  fov: 36,
  stars: 0.25,
  disk: 0.8,
  exposure: 0.24,
  bloom: 0.45,
  portraitFit: 1,
};

/** The frame at `t` seconds of the full timeline (0..10). */
export function introFrame(t: number): IntroFrame {
  const none = { light: 0, mark: 0, word: 0, reveal: 0 };

  // Through the photon ring and the horizon: nothing at all.
  if (t >= 8 && t < 8.6) return { view: { ...FINAL, fade: 0 }, ...none };

  if (t >= 8.6) {
    return {
      view: { ...FINAL, time: 5 + 0.3 * (t - 8.6), fade: 1 },
      light: easeOut(seg(t, 8.6, 9.3)),
      mark: inOut(seg(t, 8.75, 9.55)),
      word: easeOut(seg(t, 9.15, 9.6)),
      reveal: inOut(seg(t, 9.4, 10)),
    };
  }

  const a = seg(t, 1.2, 3); // stars in, the point fades
  const b = seg(t, 3, 5.5); // the hole appears
  const c = seg(t, 5.5, 8); // the rush

  // Distance: far away → the lens → the hole → just outside the photon sphere.
  // (the approach starts slowly, so the stars bend before the hole itself can be seen)
  let distance = 3600;
  if (t >= 1.2) distance = logLerp(3600, 70, a * a);
  if (t >= 3) distance = logLerp(70, 18, inOut(b));
  if (t >= 5.5) distance = logLerp(18, 2.3, easeIn(c));

  const view: BlackHoleView = {
    ...defaultView,
    distance,
    elevation: t < 3 ? 9 : t < 5.5 ? lerp(9, 6.5, inOut(b)) : lerp(6.5, 2.5, easeIn(c)),
    azimuth: 0,
    fov: t < 3 ? 34 : t < 5.5 ? lerp(34, 42, inOut(b)) : lerp(42, 66, easeIn(c)),
    roll: t < 3 ? 0 : t < 5.5 ? lerp(0, -5, inOut(b)) : lerp(-5, -13, easeIn(c)),
    shift: [0, 0],
    stars: t < 1.2 ? 0 : t < 3 ? lerp(0, 1.5, inOut(a)) : t < 5.5 ? lerp(1.5, 0.8, b) : lerp(0.8, 0.5, c),
    // The single point is the disk, unresolved; it goes out while the stars come in, then the disk returns up close.
    disk: t < 1.2 ? 4 : t < 3 ? logLerp(4, 0.005, easeOut(seg(t, 1.2, 2.2))) : t < 5.5 ? logLerp(0.005, 1, easeOut(b)) : 1,
    exposure: t < 1.2 ? 3.6 : t < 3 ? logLerp(3.6, 1.15, a) : t < 5.5 ? lerp(1.15, 0.72, b) : lerp(0.72, 0.95, c),
    bloom: t < 3 ? lerp(1.2, 0.6, a) : t < 5.5 ? lerp(0.6, 0.7, b) : lerp(0.7, 0.9, c),
    time: diskTime(t),
    fade: easeOut(seg(t, 0, 0.5)),
    streak: t < 5.5 ? 0 : easeIn(c),
  };
  return { view, ...none };
}
