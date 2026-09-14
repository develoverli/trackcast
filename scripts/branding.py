"""Shared TrackCast artwork helpers for the asset generation scripts.

Colors are sRGB approximations of the CSS OKLCH tokens in src/renderer/styles.css.
"""
from PIL import Image, ImageDraw

ACCENT = (48, 224, 122)
CYAN = (46, 196, 206)
VIOLET = (152, 112, 240)
TILE_TOP = (36, 46, 40)
TILE_BOTTOM = (20, 26, 23)


def lerp_color(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vertical_gradient(size: tuple, top: tuple, bottom: tuple) -> Image.Image:
    width, height = size
    column = Image.new("RGB", (1, height))
    column.putdata([lerp_color(top, bottom, y / max(height - 1, 1)) for y in range(height)])
    return column.resize((width, height))


GRADIENT_SAMPLE = 64  # a linear gradient survives upscaling, so render it small


def diagonal_gradient(size: tuple, stops: list) -> Image.Image:
    """Top-left to bottom-right gradient through evenly spaced color stops."""
    sample = GRADIENT_SAMPLE
    span = sample * 2 - 2
    segments = len(stops) - 1
    data = []
    for y in range(sample):
        for x in range(sample):
            t = (x + y) / span * segments
            index = min(int(t), segments - 1)
            data.append(lerp_color(stops[index], stops[index + 1], t - index))
    image = Image.new("RGB", (sample, sample))
    image.putdata(data)
    return image.resize(size, Image.BICUBIC)


def rounded_mask(size: tuple, radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def draw_note_glyph(draw: ImageDraw.ImageDraw, origin: tuple, box: float, color: tuple, stroke: float) -> None:
    """Lucide 'music' glyph (24x24 grid): path M9 18V5l12-2v13, circles (6,18) and (18,16) r=3."""
    ox, oy = origin
    unit = box / 24
    width = max(round(stroke * unit), 1)

    def point(x: float, y: float) -> tuple:
        return (ox + x * unit, oy + y * unit)

    draw.line([point(9, 18), point(9, 5), point(21, 3), point(21, 16)], fill=color, width=width, joint="curve")
    for cx, cy in ((6, 18), (18, 16)):
        radius = 3 * unit
        x, y = point(cx, cy)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=color, width=width)
    cap = width / 2
    for x, y in (point(9, 18), point(21, 16)):
        draw.ellipse((x - cap, y - cap, x + cap, y + cap), fill=color)


def app_mark(size: int, ring: int, glyph_ratio: float = 0.5, stroke: float = 2.3) -> Image.Image:
    """Rounded tile with a green to violet gradient ring and a green note glyph (RGBA)."""
    radius = round(size * 0.27)
    mark = diagonal_gradient((size, size), [ACCENT, CYAN, VIOLET]).convert("RGBA")
    mark.putalpha(rounded_mask((size, size), radius))

    inner_size = size - ring * 2
    inner = vertical_gradient((inner_size, inner_size), TILE_TOP, TILE_BOTTOM).convert("RGBA")
    inner.putalpha(rounded_mask((inner_size, inner_size), max(radius - ring, 1)))
    mark.alpha_composite(inner, (ring, ring))

    glyph_box = size * glyph_ratio
    offset = (size - glyph_box) / 2
    draw_note_glyph(ImageDraw.Draw(mark), (offset, offset), glyph_box, ACCENT, stroke=stroke)
    return mark
