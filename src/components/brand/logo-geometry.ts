/**
 * Geometry of the Veritas marks on a 64×64 grid, shared by the React
 * component, the icon generator and the intro (points are sampled from these
 * paths). Three directions of DESIGN_V2 §9 are on /design for the owner to
 * choose; all are strokes of light, no fills, no gradients.
 */
export const MARK_VIEWBOX = '0 0 64 64';

/**
 * «Линза»: a V whose two lines of light bend around a dark point, the way a
 * mass bends light. The short left arm and the long right arm read as ✓.
 */
export const LENS = {
  left: 'M7 24L16.26 45.73A9.5 9.5 0 0 0 22.38 51.13',
  right: 'M58 4L33.22 46.76A9.5 9.5 0 0 1 27.62 51.13',
  point: { cx: 25, cy: 42, r: 9.5 },
} as const;

/**
 * «Горизонт»: the shadow, the photon ring and the disk in three lines. The
 * far side of the disk is lensed into an arc over the shadow (and a fainter
 * one under it); the near side crosses in front. Left is brighter (Doppler).
 */
export const HORIZON = {
  ring: { cx: 32, cy: 33, r: 9.5 },
  over: 'M15 34.5A17 15.5 0 0 1 49 31.2',
  under: 'M19.5 36A12.5 11.5 0 0 0 44.5 33.4',
  diskNear: 'M2 36.2L32 33',
  diskFar: 'M32 33L62 29.8',
} as const;

/**
 * «Затмение»: a dark disk with a thin crescent of light on its edge; the
 * crescent runs out into the long stroke of a check: truth shows at the edge.
 */
export const ECLIPSE = {
  stroke: 'M12.06 31.69A15 15 0 0 0 39.72 40.95L58.8 10.42',
  disk: { cx: 27, cy: 33, r: 15 },
} as const;

export type MarkVariant = 'lens' | 'horizon' | 'eclipse';
export const markVariants: readonly MarkVariant[] = ['lens', 'horizon', 'eclipse'];

/* V1 «Орбита» mark, still used by the QR code and the icon build until the owner picks the V2 mark. */
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
