import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { accentPalette, lines, physical, priorities, semantic, surfaces, swatches, text } from '@/design/palette';

const css = readFileSync(path.resolve(__dirname, '../../src/styles/tokens.css'), 'utf8');
const cssToken = (name: string) =>
  css
    .match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]
    ?.trim()
    .toLowerCase();

describe('TypeScript palette mirrors CSS tokens', () => {
  it('surfaces and text', () => {
    for (const [key, value] of Object.entries({ ...surfaces, ...lines, ...text, ...physical })) {
      expect(cssToken(`color-${key}`), key).toBe(value);
    }
  });
  it('semantic, priorities and swatches', () => {
    for (const [key, value] of Object.entries(semantic))
      expect(cssToken(`color-${key}`)).toBe(value);
    for (const [key, value] of Object.entries(priorities))
      expect(cssToken(`color-prio-${key}`)).toBe(value);
    for (const [key, value] of Object.entries(swatches))
      expect(cssToken(`color-swatch-${key}`)).toBe(value);
  });
  it('accent themes', () => {
    for (const [name, a] of Object.entries(accentPalette)) {
      const block =
        css.match(new RegExp(`\\[data-accent='${name}'\\]\\s*\\{([^}]+)\\}`))?.[1] ?? '';
      expect(block).toContain(`--accent: ${a.accent};`);
      expect(block).toContain(`--accent-hi: ${a.hi};`);
      expect(block).toContain(`--accent-lo: ${a.lo};`);
      expect(block).toContain(`--accent-ink: ${a.ink};`);
    }
  });
});
