import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { swatchNames } from '@/lib/color/swatches';

const globals = readFileSync('src/styles/globals.css', 'utf8');
const tokens = readFileSync('src/styles/tokens.css', 'utf8');

describe('styles', () => {
  it('never hand-writes -webkit-backdrop-filter (the optimizer would drop the standard property)', () => {
    expect(globals + tokens).not.toMatch(/-webkit-backdrop-filter\s*:/);
  });

  it('tiles noise textures seamlessly: stitched, with the filter region equal to the tile', () => {
    const sources = globSync('src/**/*.{ts,tsx}')
      .map((f) => readFileSync(f, 'utf8'))
      .filter((s) => s.includes('<feTurbulence'));
    for (const source of sources) {
      const tiles = [...source.matchAll(/<svg[^>]*width='(\d+)' height='(\d+)'><filter([^>]*)><feTurbulence([^>]*)>/g)];
      expect(tiles.length).toBeGreaterThan(0);
      for (const [, w, h, filter, turbulence] of tiles) {
        expect(turbulence).toContain("stitchTiles='stitch'");
        expect(filter).toContain(`width='${w}' height='${h}' filterUnits='userSpaceOnUse'`);
      }
    }
  });

  it('emits the colors chosen at run time (priorities, swatches) even when no class names them', () => {
    const block = /@theme static \{([\s\S]*?)\n\}/.exec(tokens)?.[1] ?? '';
    for (const key of ['critical', 'high', 'medium', 'low']) expect(block).toContain(`--color-prio-${key}:`);
    for (const name of swatchNames) expect(block).toContain(`--color-swatch-${name}:`);
  });

  it('loads the tokens after Tailwind so the reset of the default palette applies', () => {
    expect(globals.indexOf("@import 'tailwindcss'")).toBeLessThan(globals.indexOf("@import './tokens.css'"));
  });
});
