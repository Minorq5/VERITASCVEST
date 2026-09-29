import { describe, expect, it } from 'vitest';
import { levelForXp, levelProgress, MAX_LEVEL, rankForLevel, tierRoman, xpForLevel } from '@/lib/domain/levels';

describe('levels', () => {
  it('level 1 starts at 0 XP and thresholds grow strictly', () => {
    expect(xpForLevel(1)).toBe(0);
    for (let l = 2; l <= MAX_LEVEL; l += 1) expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1));
  });

  it('levelForXp is the inverse of xpForLevel at every boundary', () => {
    for (let l = 1; l <= MAX_LEVEL; l += 1) {
      expect(levelForXp(xpForLevel(l))).toBe(l);
      if (l > 1) expect(levelForXp(xpForLevel(l) - 1)).toBe(l - 1);
    }
    expect(levelForXp(10_000_000)).toBe(MAX_LEVEL);
  });

  it('ranks change every five levels', () => {
    expect(rankForLevel(1)).toEqual({ rank: 'dust', tier: 1 });
    expect(rankForLevel(5)).toEqual({ rank: 'dust', tier: 5 });
    expect(rankForLevel(11)).toEqual({ rank: 'comet', tier: 1 });
    expect(rankForLevel(36)).toEqual({ rank: 'supernova', tier: 1 });
    expect(rankForLevel(50)).toEqual({ rank: 'galaxy', tier: 5 });
    expect(tierRoman(3)).toBe('III');
  });

  it('pacing: Comet in weeks, Galaxy in years (≈150 XP a day)', () => {
    const daysTo = (level: number) => xpForLevel(level) / 150;
    expect(daysTo(11)).toBeGreaterThan(20);
    expect(daysTo(11)).toBeLessThan(60);
    expect(daysTo(46)).toBeGreaterThan(365);
  });

  it('progress within a level', () => {
    const p = levelProgress(xpForLevel(4) + (xpForLevel(5) - xpForLevel(4)) / 2);
    expect(p.level).toBe(4);
    expect(p.progress).toBeCloseTo(0.5, 2);
    expect(levelProgress(0)).toMatchObject({ level: 1, rank: 'dust', tier: 1, progress: 0 });
    expect(levelProgress(xpForLevel(MAX_LEVEL)).nextLevelAt).toBeNull();
  });
});
