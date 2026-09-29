import { describe, expect, it } from 'vitest';
import { INTRO_FULL, introFrame, toFull } from '@/features/cinema/intro/timeline';

describe('intro timeline', () => {
  it('starts dark with one point of light: no stars, far away', () => {
    const f = introFrame(0.6);
    expect(f.view.stars).toBe(0);
    expect(f.view.distance).toBeGreaterThan(1000);
    expect(f.reveal).toBe(0);
  });

  it('shows the hole only after the stars: far away at 2.2 s, disk emission tiny at 3 s and full by 5.5 s', () => {
    expect(introFrame(2.2).view.distance).toBeGreaterThan(500);
    expect(introFrame(3).view.disk).toBeLessThan(0.05);
    expect(introFrame(5.5).view.disk).toBeCloseTo(1, 5);
  });

  it('flies in without jumps: distance falls monotonically until the horizon', () => {
    let last = Infinity;
    for (let t = 0; t < 8; t += 1 / 30) {
      const d = introFrame(t).view.distance;
      expect(d).toBeLessThanOrEqual(last + 1e-9);
      last = d;
    }
    expect(last).toBeLessThan(3);
  });

  it('is black between the photon ring and the light', () => {
    for (const t of [8, 8.2, 8.5]) expect(introFrame(t).view.fade).toBe(0);
    expect(introFrame(8.7).view.fade).toBe(1);
  });

  it('draws the mark, then opens the page, and ends fully open', () => {
    expect(introFrame(9).mark).toBeGreaterThan(0);
    expect(introFrame(9.3).reveal).toBe(0);
    expect(introFrame(INTRO_FULL).reveal).toBe(1);
  });

  it('the short intro is the last two seconds of the full one', () => {
    expect(toFull('short', 0)).toBe(8);
    expect(introFrame(toFull('short', 0)).view.fade).toBe(0);
    expect(introFrame(toFull('short', 2)).reveal).toBe(1);
  });

  it('slows the disk down toward the horizon (time dilation)', () => {
    const early = introFrame(3.1).view.time - introFrame(3).view.time;
    const late = introFrame(7.9).view.time - introFrame(7.8).view.time;
    expect(late).toBeLessThan(early);
  });
});
