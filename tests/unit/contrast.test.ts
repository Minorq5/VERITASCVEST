import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_LARGE, WCAG_AA_TEXT } from '@/lib/color/contrast';

const css = readFileSync(path.resolve(__dirname, '../../src/styles/globals.css'), 'utf8');

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`Token --${name} not found`);
  return match[1].trim();
}

function accentBlock(accent: string): Record<string, string> {
  const block = css.match(new RegExp(`\\[data-accent='${accent}'\\]\\s*\\{([^}]+)\\}`));
  if (!block?.[1]) throw new Error(`Accent ${accent} not found`);
  return Object.fromEntries(
    [...block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

const surfaces = [
  'color-bg',
  'color-surface-1',
  'color-surface-2',
  'color-surface-3',
  'color-surface-4',
];

describe('design tokens meet WCAG AA', () => {
  it.each(['color-fg', 'color-fg-2', 'color-fg-3'])('%s is readable on every surface', (text) => {
    for (const surface of surfaces) {
      expect(
        contrastRatio(token(text), token(surface)),
        `${text} on ${surface}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    }
  });

  it.each(['color-success', 'color-warning', 'color-danger', 'color-info'])(
    '%s works as text on surfaces',
    (tone) => {
      for (const surface of surfaces) {
        expect(
          contrastRatio(token(tone), token(surface)),
          `${tone} on ${surface}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
    },
  );

  it.each(['cyan', 'ice', 'aurora', 'nebula', 'plasma', 'solar'])(
    'accent %s: text on surfaces and ink on accent',
    (name) => {
      const accent = accentBlock(name);
      for (const surface of surfaces) {
        expect(
          contrastRatio(accent.accent!, token(surface)),
          `${name} on ${surface}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
      }
      expect(contrastRatio(accent['accent-ink']!, accent.accent!)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(accent['accent-ink']!, accent['accent-hi']!)).toBeGreaterThanOrEqual(7);
    },
  );

  it('priority colours are distinguishable on cards', () => {
    for (const prio of ['critical', 'high', 'medium', 'low']) {
      expect(
        contrastRatio(token(`color-prio-${prio}`), token('color-surface-2')),
      ).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    }
  });
});
