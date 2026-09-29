"""
Standalone brand SVGs: the mark and the mark + wordmark lockup with the
wordmark converted to outlines (no font needed to display the logo).

Usage: python3 scripts/brand/build_brand.py <Unbounded[wght].ttf> <out-dir>
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


def const(name):
    return re.search(rf"export const {name} =\s*'([^']+)'", GEOMETRY).group(1)


LEFT, RIGHT, STAR = const("MARK_LEFT_ARM"), const("MARK_RIGHT_ARM"), const("MARK_STAR")

PALETTE = {"accent": "#5ce1ee", "hi": "#92edf6", "lo": "#2ab8c9", "fg": "#e8edfa", "fg2": "#b2bcd3"}


def mark_group(detail="full", prefix="vt", mono=None, star="#ffffff"):
    """SVG markup of the mark in a 64x64 box."""
    if mono:
        return (
            f'<path d="{LEFT}" fill="{mono}"/><path d="{RIGHT}" fill="{mono}"/>'
            f'<path d="{STAR}" fill="{mono}"/>'
        )
    top_opacity = 0.35 if detail == "full" else 0.75
    defs = (
        f'<linearGradient id="{prefix}-beam" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{PALETTE["lo"]}" stop-opacity="{top_opacity}"/>'
        f'<stop offset="0.5" stop-color="{PALETTE["accent"]}"/>'
        f'<stop offset="1" stop-color="{PALETTE["hi"]}"/></linearGradient>'
        f'<radialGradient id="{prefix}-halo"><stop offset="0" stop-color="{PALETTE["accent"]}" stop-opacity="0.85"/>'
        f'<stop offset="1" stop-color="{PALETTE["accent"]}" stop-opacity="0"/></radialGradient>'
    )
    body = ""
    if detail == "full":
        body += (
            '<ellipse cx="32" cy="29" rx="29" ry="9" transform="rotate(-16 32 29)" fill="none" '
            f'stroke="{PALETTE["accent"]}" stroke-opacity="0.32" stroke-width="0.55"/>'
            f'<circle cx="32" cy="46.6" r="13" fill="url(#{prefix}-halo)" opacity="0.5"/>'
        )
    body += (
        f'<path d="{LEFT}" fill="url(#{prefix}-beam)"/><path d="{RIGHT}" fill="url(#{prefix}-beam)"/>'
        f'<path d="{STAR}" fill="{star}"/>'
    )
    return f"<defs>{defs}</defs>{body}"


def shape_text(font_path, text, weight, size, tracking_em=0.01):
    """Returns (svg path data, advance width) for text set in Unbounded."""
    font = TTFont(font_path)
    static = instantiateVariableFont(font, {"wght": weight}, inplace=False)
    blob = hb.Blob.from_file_path(str(font_path))
    face = hb.Face(blob)
    hbfont = hb.Font(face)
    hbfont.set_variations({"wght": weight})
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    upem = static["head"].unitsPerEm
    scale = size / upem
    glyph_set = static.getGlyphSet()
    order = static.getGlyphOrder()
    x = 0.0
    parts = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        pen = SVGPathPen(glyph_set)
        # font units -> px, flip y (baseline at y=0)
        tpen = TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, -pos.y_offset * scale))
        glyph_set[name].draw(tpen)
        d = pen.getCommands()
        if d:
            parts.append(d)
        x += pos.x_advance * scale + tracking_em * size
    return " ".join(parts), x - tracking_em * size


def write(path, svg):
    path.write_text(svg, encoding="utf-8")
    print(f"{path.name}: {len(svg)} bytes")


def main(font_path, out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    write(out / "veritas-mark.svg",
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512" role="img" aria-label="Veritas">'
          f'{mark_group("full")}</svg>\n')
    write(out / "veritas-mark-compact.svg",
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256" role="img" aria-label="Veritas">'
          f'{mark_group("compact")}</svg>\n')
    write(out / "veritas-mark-mono.svg",
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256" role="img" aria-label="Veritas">'
          f'{mark_group(mono="#ffffff")}</svg>\n')

    size = 30
    veritas, w1 = shape_text(font_path, "Veritas", 600, size)
    tasks, w2 = shape_text(font_path, "Tasks", 300, size)
    gap_word = size * 0.3
    mark_px, gap = 50, 12
    height = 64
    baseline = height / 2 + size * 0.36
    x_text = mark_px + gap
    width = x_text + w1 + gap_word + w2 + 2
    for variant, fg, fg2, star in (
        ("", PALETTE["fg"], PALETTE["fg2"], "#ffffff"),
        ("-on-light", "#0b1020", "#3c4663", "#0b1020"),
    ):
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.1f} {height}" width="{width * 4:.0f}" height="{height * 4}" role="img" aria-label="Veritas Tasks">'
            f'<g transform="translate(0 {(height - mark_px) / 2}) scale({mark_px / 64})">{mark_group("compact", prefix="vtl" + variant, star=star)}</g>'
            f'<g transform="translate({x_text} {baseline:.2f})"><path d="{veritas}" fill="{fg}"/></g>'
            f'<g transform="translate({x_text + w1 + gap_word:.2f} {baseline:.2f})"><path d="{tasks}" fill="{fg2}"/></g>'
            f"</svg>\n"
        )
        write(out / f"veritas-lockup{variant}.svg", svg)

    # App icon: dark squircle, glow, compact mark. Used for favicons and PWA icons.
    icon = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">'
        '<defs><radialGradient id="bgGlow" cx="0.5" cy="0.72" r="0.7">'
        f'<stop offset="0" stop-color="{PALETTE["accent"]}" stop-opacity="0.28"/>'
        f'<stop offset="1" stop-color="{PALETTE["accent"]}" stop-opacity="0"/></radialGradient>'
        '<linearGradient id="bgFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1422"/><stop offset="1" stop-color="#05070e"/></linearGradient></defs>'
        '<rect width="64" height="64" rx="14" fill="url(#bgFill)"/>'
        '<rect width="64" height="64" rx="14" fill="url(#bgGlow)"/>'
        '<rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>'
        f'<g transform="translate(10 9.5) scale(0.6875)">{mark_group("compact", prefix="ic")}</g>'
        "</svg>\n"
    )
    write(out / "veritas-app-icon.svg", icon)

    # Maskable icon: full-bleed background, mark inside the 80% safe circle.
    maskable = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">'
        '<defs><radialGradient id="mGlow" cx="0.5" cy="0.66" r="0.62">'
        f'<stop offset="0" stop-color="{PALETTE["accent"]}" stop-opacity="0.26"/>'
        f'<stop offset="1" stop-color="{PALETTE["accent"]}" stop-opacity="0"/></radialGradient></defs>'
        '<rect width="64" height="64" fill="#060912"/><rect width="64" height="64" fill="url(#mGlow)"/>'
        f'<g transform="translate(16 15.5) scale(0.5)">{mark_group("compact", prefix="mk")}</g>'
        "</svg>\n"
    )
    write(out / "veritas-maskable.svg", maskable)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
