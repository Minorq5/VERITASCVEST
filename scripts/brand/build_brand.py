"""
Standalone brand SVGs for the mark «Горизонт» (DESIGN_V2 §9): the mark, its
compact optical size, a mono version, the lockup with the wordmark converted
to outlines (no font needed to display it), the app icon, the favicon and the
maskable PWA icon. Flat colours only: no gradients, no glow.

Usage: python3 scripts/brand/build_brand.py <Geologica[wght].ttf> <JetBrainsMono[wght].ttf> <out-dir>
Then: npm run icons
"""
import re
import sys
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
GEOMETRY = (ROOT / "src/components/brand/logo-geometry.ts").read_text()

COLORS = {
    "bg": "#050506",
    "line": "#26292f",
    "accent": "#ff8a2a",
    "accent_hi": "#ffa65c",
    "accent_lo": "#c4600f",
    "fg": "#f2ede4",
    "fg3": "#8e887e",
}


def block(name):
    return re.search(rf"export const {name} = \{{(.*?)\}} as const;", GEOMETRY, re.S).group(1)


def string(body, key):
    return re.search(rf"\b{key}: '([^']+)'", body).group(1)


def number(body, key):
    return float(re.search(rf"\b{key}: ([\d.]+)", body).group(1))


FULL = block("HORIZON")
COMPACT = block("HORIZON_COMPACT")
RING = re.search(r"ring: \{ cx: ([\d.]+), cy: ([\d.]+), r: ([\d.]+)", FULL).groups()
CRING = re.search(r"ring: \{ cx: ([\d.]+), cy: ([\d.]+), r: ([\d.]+), stroke: ([\d.]+)", COMPACT).groups()


def full_mark(prefix, sw=4.5, hi=None, lo=None):
    """The full drawing in a 64×64 box. `hi`/`lo` override the two tones (mono, light backgrounds)."""
    hi = hi or COLORS["accent_hi"]
    lo = lo or COLORS["accent"]
    cx, cy, r = RING
    return (
        f'<defs><mask id="{prefix}-k"><rect width="64" height="64" fill="white"/>'
        f'<path d="{string(FULL, "cut")}" stroke="black" stroke-width="{sw * 2.2:.2f}"/></mask></defs>'
        f'<g mask="url(#{prefix}-k)" fill="none">'
        f'<path d="{string(FULL, "over")}" stroke="{lo}" stroke-opacity="0.7" stroke-width="{sw * 0.6:.2f}"/>'
        f'<path d="{string(FULL, "under")}" stroke="{lo}" stroke-opacity="0.45" stroke-width="{sw * 0.4:.2f}"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" stroke="{hi}" stroke-width="{sw * 0.5:.2f}"/></g>'
        f'<path d="{string(FULL, "diskNear")}" stroke="{hi}" stroke-width="{sw * 0.8:.2f}" fill="none"/>'
        f'<path d="{string(FULL, "diskFar")}" stroke="{lo}" stroke-opacity="0.7" stroke-width="{sw * 0.8:.2f}" fill="none"/>'
    )


def compact_mark(prefix, hi=None, lo=None):
    hi = hi or COLORS["accent_hi"]
    lo = lo or COLORS["accent"]
    cx, cy, r, stroke = CRING
    return (
        f'<defs><mask id="{prefix}-k"><rect width="64" height="64" fill="white"/>'
        f'<path d="{string(COMPACT, "cut")}" stroke="black" stroke-width="{number(COMPACT, "cutStroke")}"/></mask></defs>'
        f'<g mask="url(#{prefix}-k)" fill="none">'
        f'<path d="{string(COMPACT, "over")}" stroke="{lo}" stroke-opacity="0.85" stroke-width="{number(COMPACT, "overStroke")}"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" stroke="{hi}" stroke-width="{stroke}"/></g>'
        f'<path d="{string(COMPACT, "diskNear")}" stroke="{hi}" stroke-width="{number(COMPACT, "diskStroke")}" fill="none"/>'
        f'<path d="{string(COMPACT, "diskFar")}" stroke="{lo}" stroke-width="{number(COMPACT, "diskStroke")}" fill="none"/>'
    )


def shape_text(font_path, text, weight, size, tracking_em):
    """Returns (svg path data, advance width) for text set in the given variable font."""
    font = TTFont(font_path)
    static = instantiateVariableFont(font, {"wght": weight}, inplace=False)
    face = hb.Face(hb.Blob.from_file_path(str(font_path)))
    hbfont = hb.Font(face)
    hbfont.set_variations({"wght": weight})
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    scale = size / static["head"].unitsPerEm
    glyph_set = static.getGlyphSet()
    order = static.getGlyphOrder()
    x = 0.0
    parts = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(glyph_set)
        tpen = TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, -pos.y_offset * scale))
        glyph_set[order[info.codepoint]].draw(tpen)
        if pen.getCommands():
            parts.append(pen.getCommands())
        x += pos.x_advance * scale + tracking_em * size
    return " ".join(parts), x - tracking_em * size


def write(path, svg):
    path.write_text(svg, encoding="utf-8")
    print(f"{path.name}: {len(svg)} bytes")


def svg(viewbox, width, height, body, label=None):
    aria = f' role="img" aria-label="{label}"' if label else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" width="{width}" height="{height}"{aria}>{body}</svg>\n'


def main(display_font, mono_font, out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    write(out / "veritas-mark.svg", svg("0 0 64 64", 512, 512, full_mark("m"), "Veritas"))
    write(out / "veritas-mark-compact.svg", svg("0 0 64 64", 256, 256, compact_mark("c"), "Veritas"))
    write(out / "veritas-mark-mono.svg", svg("0 0 64 64", 256, 256, full_mark("o", hi=COLORS["fg"], lo=COLORS["fg"]), "Veritas"))

    # Lockup: mark + VERITAS (Geologica 500, tracking 0.2em) + TASKS (JetBrains Mono 500, small, tracking 0.2em).
    size = 26
    word, w1 = shape_text(display_font, "VERITAS", 500, size, 0.2)
    tasks_size = size * 0.36
    tasks, w2 = shape_text(mono_font, "TASKS", 500, tasks_size, 0.2)
    mark_px, gap, gap_word, height = 52, 14, size * 0.45, 64
    baseline = height / 2 + size * 0.36
    x_text = mark_px + gap
    width = x_text + w1 + gap_word + w2 + 2
    for variant, fg, fg3, hi, lo in (
        ("", COLORS["fg"], COLORS["fg3"], None, None),
        ("-on-light", "#0b0a09", "#5c5851", COLORS["accent_lo"], COLORS["accent"]),
    ):
        body = (
            f'<g transform="translate(0 {(height - mark_px) / 2}) scale({mark_px / 64})">{full_mark("l" + variant, sw=5.5, hi=hi, lo=lo)}</g>'
            f'<g transform="translate({x_text} {baseline:.2f})"><path d="{word}" fill="{fg}"/></g>'
            f'<g transform="translate({x_text + w1 + gap_word:.2f} {baseline:.2f})"><path d="{tasks}" fill="{fg3}"/></g>'
        )
        write(out / f"veritas-lockup{variant}.svg", svg(f"0 0 {width:.1f} {height}", f"{width * 4:.0f}", height * 4, body, "Veritas Tasks"))

    # The mark's optical centre is the ring (32, 33): scale around it.
    def placed(inner, scale):
        return f'<g transform="translate({32 - 32 * scale:.2f} {32 - 33 * scale:.2f}) scale({scale})">{inner}</g>'

    frame = (
        f'<rect width="64" height="64" rx="14" fill="{COLORS["bg"]}"/>'
        f'<rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="{COLORS["line"]}"/>'
    )
    # App icon (PWA "any", apple-touch after squaring): the full drawing.
    write(out / "veritas-app-icon.svg", svg("0 0 64 64", 512, 512, frame + placed(full_mark("a", sw=5), 0.8)))
    # Favicon: the compact drawing, a little larger in its square.
    fav_frame = f'<rect width="64" height="64" rx="12" fill="{COLORS["bg"]}"/>'
    write(out / "veritas-favicon.svg", svg("0 0 64 64", 64, 64, fav_frame + placed(compact_mark("f"), 0.98)))
    # Maskable: full bleed, the mark inside the 80 % safe circle.
    mask_bg = f'<rect width="64" height="64" fill="{COLORS["bg"]}"/>'
    write(out / "veritas-maskable.svg", svg("0 0 64 64", 512, 512, mask_bg + placed(full_mark("k", sw=5), 0.62)))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
