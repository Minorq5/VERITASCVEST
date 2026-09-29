import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/globals.css', 'utf8');

describe('globals.css', () => {
  it('never hand-writes -webkit-backdrop-filter (the optimizer would drop the standard property)', () => {
    expect(css).not.toMatch(/-webkit-backdrop-filter\s*:/);
  });

  it('tiles noise textures seamlessly: stitched, with the filter region equal to the tile', () => {
    const sources = ['src/features/auth/planet-horizon.tsx', 'src/components/effects/space-backdrop.tsx'].map((f) =>
      readFileSync(f, 'utf8'),
    );
    let checked = 0;
    for (const source of sources) {
      expect(source).toContain('<feTurbulence');
      for (const match of source.matchAll(/<svg[^>]*width='(\d+)' height='(\d+)'><filter([^>]*)><feTurbulence([^>]*)>/g)) {
        const [, w, h, filter, turbulence] = match;
        expect(turbulence).toContain("stitchTiles='stitch'");
        expect(filter).toContain(`width='${w}' height='${h}' filterUnits='userSpaceOnUse'`);
        checked += 1;
      }
    }
    expect(checked).toBe(sources.length);
  });

  it('emits the colors chosen at run time (priorities, swatches) even when no class names them', () => {
    const block = /@theme static \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    for (const key of ['critical', 'high', 'medium', 'low']) expect(block).toContain(`--color-prio-${key}:`);
    for (const name of ['cyan', 'sky', 'indigo', 'violet', 'orchid', 'rose', 'coral', 'amber', 'lime', 'mint', 'teal', 'slate']) {
      expect(block).toContain(`--color-swatch-${name}:`);
    }
  });
});
