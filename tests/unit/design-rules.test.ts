import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The bans of DESIGN_V2 §2, checked in the source. The working interface has
 * no light: no glow, no glass, no blur, no decorative gradients, no violet or
 * pink, nothing rounder than 8px, no emoji. Light and bloom live only in the
 * 3D scenes (src/features/cinema, src/scenes), which are exempt.
 */

const UI_DIRS = ['src/app', 'src/components', 'src/features', 'src/styles'];
const EXEMPT = [/^src\/features\/cinema\//, /^src\/scenes\//];

const files = UI_DIRS.flatMap((dir) => globSync(`${dir}/**/*.{ts,tsx,css}`))
  .map((f) => f.replaceAll('\\', '/'))
  .filter((f) => !EXEMPT.some((re) => re.test(f)))
  .sort();

/** Code without comments, so a comment may name a ban without breaking it. */
function code(file: string) {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const sources = files.map((file) => ({ file, text: code(file) }));

function offenders(test: (text: string) => string[]) {
  const found: string[] = [];
  for (const { file, text } of sources) for (const hit of test(text)) found.push(`${file}: ${hit}`);
  return found;
}

const all = (re: RegExp) => (text: string) => [...text.matchAll(re)].map((m) => m[0]);

function hexToHsl(hex: string) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  return rgbToHsl(r, g, b);
}

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return { h: hue, s, l };
}

/** Violet, purple, magenta and pink: hue 255°–345° with visible saturation. */
const isVioletOrPink = ({ h, s, l }: { h: number; s: number; l: number }) => h >= 255 && h <= 345 && s > 0.2 && l > 0.12 && l < 0.97;

describe('design bans (DESIGN_V2 §2)', () => {
  it('scans the interface', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no glass, blur or backdrop filters', () => {
    expect(
      offenders(all(/backdrop-(?:blur|filter|brightness|saturate|contrast)|backdropFilter|['"`\s]glass(?:-strong)?(?=['"`\s])|\bblur-(?:xs|sm|md|lg|xl|2xl|3xl|\[)|(?<![.\w])blur\(\s*\d/g)),
    ).toEqual([]);
  });

  it('no glow: no shadow utilities, drop shadows or blurred box shadows', () => {
    const blurred = (text: string) => {
      const hits: string[] = [];
      for (const m of text.matchAll(/(?:boxShadow:\s*[`'"]|box-shadow:\s*)([^`'";]+)/g)) {
        for (const layer of m[1]!.split(/,(?![^(]*\))/)) {
          const lengths = layer.replace(/(?:rgb|rgba|hsl|color-mix|var)\([^)]*\)+/g, '').match(/-?\d*\.?\d+(?:px|rem)?|\$\{[^}]+\}/g) ?? [];
          // offset-x offset-y blur spread: a non-zero blur is a glow.
          const blur = lengths[2];
          if (blur && blur !== '0' && blur !== '0px') hits.push(m[0]);
        }
      }
      return hits;
    };
    expect(offenders(all(/(?<!-)\bshadow-(?:glow\S*|2xs|xs|sm|md|lg|xl|2xl|inner)\b|\btext-glow\b|(?<!--)drop-shadow/g))).toEqual([]);
    expect(offenders(blurred)).toEqual([]);
  });

  it('no decorative gradients outside the 3D scenes', () => {
    expect(
      offenders(all(/(?:linear|radial|conic)-gradient|<(?:linear|radial)Gradient\b|create(?:Linear|Radial|Conic)Gradient|\bbg-(?:gradient|linear|radial|conic)-/g)),
    ).toEqual([]);
  });

  it('nothing rounder than 8px (circles only through rounded-full)', () => {
    const tooRound = (text: string) => [
      ...all(/\brounded(?:-[trblse]{1,2})?-(?:3xl|4xl)\b/g)(text),
      ...[...text.matchAll(/\brounded(?:-[trblse]{1,2})?-\[(\d+(?:\.\d+)?)px\]/g)].filter((m) => Number(m[1]) > 8).map((m) => m[0]),
      ...[...text.matchAll(/borderRadius:\s*(\d+(?:\.\d+)?)/g)].filter((m) => Number(m[1]) > 8).map((m) => m[0]),
      ...[...text.matchAll(/border-radius:\s*(\d+(?:\.\d+)?)px/g)].filter((m) => Number(m[1]) > 8).map((m) => m[0]),
    ];
    expect(offenders(tooRound)).toEqual([]);
  });

  it('radius tokens stop at 8px', () => {
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    for (const m of tokens.matchAll(/--radius-[\w-]+:\s*(\d+)px/g)) expect(Number(m[1])).toBeLessThanOrEqual(8);
  });

  it('no violet or pink anywhere in the interface', () => {
    const colours = (text: string) => [
      ...[...text.matchAll(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi)].filter((m) => isVioletOrPink(hexToHsl(m[0]))).map((m) => m[0]),
      ...[...text.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)]
        .filter((m) => isVioletOrPink(rgbToHsl(Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255)))
        .map((m) => m[0]),
      ...all(/\b(?:bg|text|border|from|to|via|ring|fill|stroke|outline|decoration)-(?:purple|violet|fuchsia|pink|indigo)-\d/g)(text),
    ];
    expect(offenders(colours)).toEqual([]);
  });

  it('no emoji in the interface or in its texts', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    const texts = ['ru', 'en', 'bg'].map((l) => ({ file: `src/messages/${l}.json`, text: readFileSync(`src/messages/${l}.json`, 'utf8') }));
    const hits = [...sources, ...texts].flatMap(({ file, text }) =>
      text
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => emoji.test(line.replace(/[©®™↻↺→←↑↓⌘⌥⇧⌫⏎✓✕]/g, '')))
        .map(({ i }) => `${file}:${i + 1}`),
    );
    expect(hits).toEqual([]);
  });

  it('no template marketing phrases', () => {
    const texts = ['ru', 'en', 'bg'].map((l) => readFileSync(`src/messages/${l}.json`, 'utf8')).join('\n');
    expect(texts).not.toMatch(/будущее продуктивности|future of productivity|бъдещето на продуктивността|добро пожаловать в будущее/i);
  });
});
