/** The palette for tags, projects and task colors (tokens --color-swatch-*): the spectrum of stars. */
export const swatchNames = ['rust', 'amber', 'gold', 'sand', 'star', 'ice', 'blue', 'steel', 'ash'] as const;
export type SwatchName = (typeof swatchNames)[number];

/** Names from the first palette, still possible in data cached on a device before the redesign. */
const legacy: Record<string, SwatchName> = {
  cyan: 'ice',
  sky: 'blue',
  indigo: 'steel',
  violet: 'steel',
  orchid: 'sand',
  rose: 'rust',
  coral: 'rust',
  lime: 'gold',
  mint: 'ice',
  teal: 'steel',
  slate: 'ash',
};

export function isSwatch(value: unknown): value is SwatchName {
  return typeof value === 'string' && (swatchNames as readonly string[]).includes(value);
}

/** A stored color name as a current swatch; unknown names become ash. */
export function toSwatch(name: string | null | undefined): SwatchName {
  if (isSwatch(name)) return name;
  return (name && legacy[name]) || 'ash';
}

/** CSS color for a stored color name. */
export function swatchVar(name: string | null | undefined): string {
  return `var(--color-swatch-${toSwatch(name)})`;
}

/** A stable color for a new tag or project, derived from its name. */
export function swatchFor(seed: string): SwatchName {
  let hash = 2166136261;
  for (const ch of seed.toLocaleLowerCase()) hash = Math.imul(hash ^ ch.codePointAt(0)!, 16777619);
  // Ash is kept for "no color"; pick among the others.
  return swatchNames[(hash >>> 0) % (swatchNames.length - 1)]!;
}

/** Priority colors by system key (tokens --color-prio-*). */
export function priorityVar(key: string | null | undefined): string | undefined {
  return key === 'critical' || key === 'high' || key === 'medium' || key === 'low' ? `var(--color-prio-${key})` : undefined;
}
