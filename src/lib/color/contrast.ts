/**
 * WCAG 2.x contrast utilities. Used by the design showcase and by unit tests
 * that guard every text/background token pair against dropping below AA.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function parseColor(input: string): Rgba {
  const value = input.trim().toLowerCase();
  const hex = value.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const num = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: num(0), g: num(2), b: num(4), a: h.length === 8 ? num(6) / 255 : 1 };
  }
  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/,
  );
  if (rgb) {
    const alphaRaw = rgb[4];
    const a =
      alphaRaw === undefined
        ? 1
        : alphaRaw.endsWith('%')
          ? parseFloat(alphaRaw) / 100
          : parseFloat(alphaRaw);
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a };
  }
  throw new Error(`Unsupported colour: ${input}`);
}

/** Composite a translucent colour over an opaque background. */
export function flatten(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

function channel(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between text and background (translucent text is flattened first). */
export function contrastRatio(text: string, background: string): number {
  const bg = parseColor(background);
  const fg = flatten(parseColor(text), bg);
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_LARGE = 3;
