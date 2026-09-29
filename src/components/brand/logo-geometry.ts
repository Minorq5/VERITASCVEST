/**
 * Geometry of the Veritas mark, shared by the React component, the icon
 * generator and the particle intro (points are sampled from these paths).
 *
 * Idea: two beams of light converge into a single star — veritas, "truth",
 * is the point where paths meet. The beams fade in from the dark at the top
 * and brighten toward the star, so the mark reads as movement toward light.
 */
export const MARK_VIEWBOX = '0 0 64 64';

/** Left beam: angled cut at the top, sharp tip at the convergence point. */
export const MARK_LEFT_ARM = 'M8.4 9.2L14.4 6.4Q20.9 32.8 32 46.6Q14.6 36.6 8.4 9.2Z';

/** Right beam, mirrored around x = 32. */
export const MARK_RIGHT_ARM = 'M55.6 9.2L49.6 6.4Q43.1 32.8 32 46.6Q49.4 36.6 55.6 9.2Z';

/** Four-point star at the convergence point; vertical rays are longer. */
export const MARK_STAR =
  'M32 35.4C32.7 42.4 34.4 44.9 41 46.6C34.4 48.3 32.7 50.8 32 57.8C31.3 50.8 29.6 48.3 23 46.6C29.6 44.9 31.3 42.4 32 35.4Z';

/** Thin orbit that crosses the mark on large renders only. */
export const MARK_ORBIT = { cx: 32, cy: 29, rx: 29, ry: 9, rotate: -16 } as const;

export const MARK_STAR_CENTER = { x: 32, y: 46.6 } as const;
