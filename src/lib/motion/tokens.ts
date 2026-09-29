import type { Transition } from 'motion/react';

/** Durations in seconds (Motion) — mirrored as CSS variables in tokens.css. Short and exact. */
export const duration = {
  instant: 0.09,
  fast: 0.14,
  base: 0.2,
  slow: 0.28,
  cinematic: 1.2,
} as const;

/** Cubic-bezier curves shared with CSS. Nothing in the UI moves linearly. */
export const ease = {
  out: [0.22, 1, 0.36, 1],
  outExpo: [0.16, 1, 0.3, 1],
  inOut: [0.65, 0, 0.35, 1],
  emphasized: [0.2, 0, 0, 1],
  cinematic: [0.83, 0, 0.17, 1],
} as const satisfies Record<string, [number, number, number, number]>;

/** Spring presets for interface physics. All critically damped: instruments do not wobble. */
export const spring = {
  /** Toggles, presses, small elements that must feel instant. */
  snappy: { type: 'spring', stiffness: 620, damping: 50, mass: 0.9 },
  /** Panels, sheets, cards moving into place. */
  smooth: { type: 'spring', stiffness: 380, damping: 40, mass: 1 },
  /** Large surfaces, page-level movement. */
  gentle: { type: 'spring', stiffness: 200, damping: 30, mass: 1 },
  /** Completion and achievements: a touch livelier, still no overshoot you can see. */
  bouncy: { type: 'spring', stiffness: 460, damping: 36, mass: 0.8 },
} as const satisfies Record<string, Transition>;

/** Stagger between siblings appearing in a cascade. */
export const stagger = {
  tight: 0.03,
  base: 0.05,
  loose: 0.08,
} as const;

/** Transition used when the person asked for less motion: a short cross-fade. */
export const reducedTransition: Transition = { duration: duration.fast, ease: ease.out };
