/** The palette for tags, projects and task colors (tokens --color-swatch-*). */
export const swatchNames = [
  'cyan',
  'sky',
  'indigo',
  'violet',
  'orchid',
  'rose',
  'coral',
  'amber',
  'lime',
  'mint',
  'teal',
  'slate',
] as const;
export type SwatchName = (typeof swatchNames)[number];

export function isSwatch(value: unknown): value is SwatchName {
  return typeof value === 'string' && (swatchNames as readonly string[]).includes(value);
}

/** CSS color for a stored color name; unknown names fall back to slate. */
export function swatchVar(name: string | null | undefined): string {
  return `var(--color-swatch-${isSwatch(name) ? name : 'slate'})`;
}

/** A stable, pleasant color for a new tag or project, derived from its name. */
export function swatchFor(seed: string): SwatchName {
  let hash = 2166136261;
  for (const ch of seed.toLocaleLowerCase()) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619);
  // Slate is kept for "no color"; pick among the bright ones.
  return swatchNames[(hash >>> 0) % (swatchNames.length - 1)]!;
}

/** Priority colors by system key (tokens --color-prio-*). */
export function priorityVar(key: string | null | undefined): string | undefined {
  return key === 'critical' || key === 'high' || key === 'medium' || key === 'low' ? `var(--color-prio-${key})` : undefined;
}
