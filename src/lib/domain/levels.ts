/**
 * Levels and ranks. 50 levels in 10 ranks of 5 ("Comet III").
 * Cumulative XP for level L: round(100 · (L − 1)^1.75) — gentle early growth,
 * about a month of steady work to reach Comet, 1.5–2 years to Galaxy.
 * The same formula lives in SQL (stage 6); tests keep them in step.
 */
export const MAX_LEVEL = 50;
export const LEVELS_PER_RANK = 5;

export const ranks = [
  'dust',
  'meteor',
  'comet',
  'moon',
  'planet',
  'star',
  'giant',
  'supernova',
  'quasar',
  'galaxy',
] as const;
export type Rank = (typeof ranks)[number];

export function xpForLevel(level: number): number {
  const l = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  return Math.round(100 * (l - 1) ** 1.75);
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function rankForLevel(level: number): { rank: Rank; tier: number } {
  const index = Math.min(Math.floor((Math.max(1, level) - 1) / LEVELS_PER_RANK), ranks.length - 1);
  return { rank: ranks[index]!, tier: ((Math.max(1, level) - 1) % LEVELS_PER_RANK) + 1 };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
export function tierRoman(tier: number): string {
  return ROMAN[tier - 1] ?? String(tier);
}

export interface LevelProgress {
  level: number;
  rank: Rank;
  tier: number;
  xp: number;
  levelStart: number;
  nextLevelAt: number | null;
  /** 0..1 within the current level (1 at max level). */
  progress: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(Math.max(0, xp));
  const { rank, tier } = rankForLevel(level);
  const levelStart = xpForLevel(level);
  const nextLevelAt = level >= MAX_LEVEL ? null : xpForLevel(level + 1);
  const progress = nextLevelAt === null ? 1 : (xp - levelStart) / (nextLevelAt - levelStart);
  return { level, rank, tier, xp, levelStart, nextLevelAt, progress: Math.min(1, Math.max(0, progress)) };
}
