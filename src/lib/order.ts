import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Manual order uses fractional keys ("a0", "a0V", "a1"…): moving an item
 * rewrites only that item, which keeps offline edits and merges cheap.
 * Keys compare as plain byte strings (the database column uses COLLATE "C").
 */
export function keyBetween(before: string | null | undefined, after: string | null | undefined): string {
  return generateKeyBetween(before ?? null, after ?? null);
}

export function keysBetween(
  before: string | null | undefined,
  after: string | null | undefined,
  count: number,
): string[] {
  return generateNKeysBetween(before ?? null, after ?? null, count);
}

/** Byte-wise comparison matching the database order. */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Key for putting an item at `index` of an already sorted list of keys. */
export function keyForIndex(sortedKeys: readonly string[], index: number): string {
  const i = Math.max(0, Math.min(index, sortedKeys.length));
  return keyBetween(sortedKeys[i - 1] ?? null, sortedKeys[i] ?? null);
}
