/**
 * Geometry of the Veritas mark «Горизонт» (chosen by the owner, DESIGN_V2 §9)
 * on a 64×64 grid, shared by the React component, the QR code and the brand
 * build (scripts/brand/build_brand.py reads these literals).
 *
 * A black hole in three lines: the photon ring, the far side of the disk bent
 * over the shadow by the lens (and a fainter image under it), the near side of
 * the disk crossing in front. The approaching (left) half is brighter: Doppler.
 * Strokes of light only, no fills, no gradients.
 */
export const MARK_VIEWBOX = '0 0 64 64';

/** Full detail, for 32 px and up. */
export const HORIZON = {
  ring: { cx: 32, cy: 33, r: 9.5 },
  over: 'M15 34.5A17 15.5 0 0 1 49 31.2',
  under: 'M19.5 36A12.5 11.5 0 0 0 44.5 33.4',
  diskNear: 'M2 36.2L32 33',
  diskFar: 'M32 33L62 29.8',
  /** The gap the disk cuts through the ring and arcs, drawn as a mask. */
  cut: 'M2 36.2L62 29.8',
} as const;

/**
 * Optical size for 16–28 px (favicons, the sidebar, small buttons): fewer,
 * heavier lines so the mark keeps its shape instead of turning into a smudge.
 */
export const HORIZON_COMPACT = {
  ring: { cx: 32, cy: 33, r: 12, stroke: 6.5 },
  over: 'M10 35.5A22 21 0 0 1 54 30.3',
  overStroke: 5,
  diskNear: 'M1 37L32 33',
  diskFar: 'M32 33L63 29',
  diskStroke: 7,
  cut: 'M1 37L63 29',
  cutStroke: 16,
} as const;

/** Largest rendered size (px) that uses the compact drawing. */
export const COMPACT_MAX = 28;
