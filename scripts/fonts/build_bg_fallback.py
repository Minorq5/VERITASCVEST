"""
Builds tiny fallback fonts that add Bulgarian ѝ / Ѝ (U+045D / U+040D) to the
approved text and mono faces (Onest, JetBrains Mono), which lack the
precomposed letters. The glyphs are composed from the font's own и/И and its
combining grave, positioned exactly like the font's è/È, so the letters match
the typeface. Output: two-glyph WOFF2 files used via unicode-range.

Usage: python3 scripts/fonts/build_bg_fallback.py <fonts-dir> <out-dir>
Sources are the variable TTFs from github.com/google/fonts (SIL OFL 1.1).
"""
import sys
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphComponent, Glyph

FONTS = [
    ("Onest.ttf", "vt-onest-bg.woff2", "VT Onest BG"),
    ("JetBrainsMono.ttf", "vt-jetbrains-bg.woff2", "VT JetBrains BG"),
]


def component_offsets(font, composite_name, base_name):
    """Offset of the grave component inside a composite like egrave."""
    glyf = font["glyf"]
    g = glyf[composite_name]
    if not g.isComposite():
        raise RuntimeError(f"{composite_name} is not composite")
    base = next(c for c in g.components if c.glyphName == base_name)
    mark = next(c for c in g.components if c.glyphName != base_name)
    return mark.glyphName, mark.x - base.x, mark.y - base.y


def build(src: Path, out: Path, family: str):
    font = TTFont(src)
    # Decompile every table before the glyph order changes (gvar is lazy).
    for tag in list(font.keys()):
        font[tag]
    cmap = font.getBestCmap()
    names = {cp: cmap[cp] for cp in (0x0438, 0x0418, 0x00E8, 0x00C8, 0x0065, 0x0045)}
    i_small, i_cap = names[0x0438], names[0x0418]
    e_grave, E_grave, e, E = names[0x00E8], names[0x00C8], names[0x0065], names[0x0045]
    hmtx = font["hmtx"]

    new = {}
    for new_name, cp, base, grave_src, grave_base in (
        ("uni045D", 0x045D, i_small, e_grave, e),
        ("uni040D", 0x040D, i_cap, E_grave, E),
    ):
        mark, dx, dy = component_offsets(font, grave_src, grave_base)
        # centre the grave over и the same way it is centred over e
        shift = (hmtx[base][0] - hmtx[grave_base][0]) / 2
        glyph = Glyph()
        glyph.numberOfContours = -1
        glyph.components = []
        for name, x, y in ((base, 0, 0), (mark, round(dx + shift), dy)):
            comp = GlyphComponent()
            comp.glyphName, comp.x, comp.y, comp.flags = name, x, y, 0x4  # ROUND_XY_TO_GRID
            glyph.components.append(comp)
        font["glyf"][new_name] = glyph
        hmtx[new_name] = hmtx[base]
        # Advance-width variations follow the base letter.
        if "HVAR" in font and font["HVAR"].table.AdvWidthMap is None:
            # Implicit (glyph-index) mapping cannot address appended glyphs;
            # advances then come from gvar phantom points instead.
            del font["HVAR"]
        if "HVAR" in font:
            hvar = font["HVAR"].table
            for attr in ("AdvWidthMap", "LsbMap", "RsbMap"):
                mapping = getattr(hvar, attr, None)
                if mapping is not None and base in mapping.mapping:
                    mapping.mapping[new_name] = mapping.mapping[base]
        new[cp] = new_name

    order = font.getGlyphOrder() + [n for n in new.values() if n not in font.getGlyphOrder()]
    font.setGlyphOrder(order)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap.update(new)
    # Variable fonts: components inherit the base glyph variations; give the new
    # glyphs empty variation records so gvar stays consistent.
    if "gvar" in font:
        for name in new.values():
            font["gvar"].variations[name] = []

    opts = Options()
    opts.flavor = "woff2"
    opts.layout_features = []
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = Subsetter(opts)
    sub.populate(unicodes=list(new.keys()))
    sub.subset(font)
    for record in font["name"].names:
        if record.nameID in (1, 4, 16):
            record.string = family
        elif record.nameID == 6:
            record.string = family.replace(" ", "")
    font.flavor = "woff2"
    font.save(out)
    print(f"{out.name}: {out.stat().st_size} bytes, glyphs {font.getGlyphOrder()}")


if __name__ == "__main__":
    fonts_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    for src, dst, family in FONTS:
        build(fonts_dir / src, out_dir / dst, family)
