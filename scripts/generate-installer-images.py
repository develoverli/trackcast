"""Generate the branded NSIS installer bitmaps for TrackCast.

Writes into build/ (picked up by electron-builder, see package.json build.nsis):
  - installerSidebar.bmp  164x314  Welcome and Finish pages
  - installerHeader.bmp   150x57   header of the inner pages (sits on a white header bar)

Artwork follows the in-app design system (docs/design/DESIGN.md): dark green-tinted
surface, glowing app mark with a green to violet ring, Plus Jakarta Sans wordmark.

Requires: Python 3.9+, Pillow, fontTools with WOFF2 support (`pip install pillow "fonttools[woff]"`).
"""
from io import BytesIO
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from branding import ACCENT, VIOLET, app_mark, vertical_gradient

ROOT = Path(__file__).resolve().parent.parent
BUILD_DIR = ROOT / "build"
FONTS_DIR = ROOT / "src" / "renderer" / "assets" / "fonts"

SCALE = 4  # supersample, then downscale for smooth edges

SIDEBAR_SIZE = (164, 314)
HEADER_SIZE = (150, 57)

# Colors (sRGB approximations of the CSS OKLCH tokens)
BG_TOP = (18, 25, 21)
BG_BOTTOM = (11, 15, 13)
ACCENT_DARK = (22, 150, 76)  # accent readable on white
TEXT_PRIMARY = (244, 247, 245)
TEXT_MUTED = (140, 156, 148)
INK = (20, 26, 23)
WHITE = (255, 255, 255)

TAGLINE = ("Your Spotify track,", "live in OBS Studio.")
FOOTER = "github.com/develoverli/trackcast"


def load_font(woff2_name: str, size: int) -> ImageFont.FreeTypeFont:
    """Load a bundled .woff2 font by converting it to TrueType in memory."""
    font = TTFont(FONTS_DIR / woff2_name)
    font.flavor = None
    buffer = BytesIO()
    font.save(buffer)
    buffer.seek(0)
    return ImageFont.truetype(buffer, size * SCALE)


def draw_waves(image: Image.Image) -> None:
    """Faint decorative curves, echoing the app's welcome screen."""
    width, height = image.size
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    def bezier(p0: tuple, p1: tuple, p2: tuple, p3: tuple, steps: int = 80) -> list:
        points = []
        for i in range(steps + 1):
            t = i / steps
            mt = 1 - t
            x = mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0]
            y = mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1]
            points.append((x * width, y * height))
        return points

    stroke = SCALE
    draw.line(bezier((-0.2, 0.7), (0.35, 0.62), (0.55, 0.96), (1.2, 0.84)), fill=VIOLET + (70,), width=stroke)
    draw.line(bezier((-0.2, 0.76), (0.3, 0.68), (0.6, 1.02), (1.2, 0.9)), fill=ACCENT + (60,), width=stroke)
    draw.line(bezier((-0.2, 0.82), (0.4, 0.76), (0.62, 1.08), (1.2, 0.98)), fill=ACCENT + (30,), width=stroke)
    image.alpha_composite(layer)


def draw_centered(draw: ImageDraw.ImageDraw, width: int, y: int, parts: list) -> None:
    """Draw (text, font, color) parts on one line, centered horizontally."""
    total = sum(draw.textlength(text, font=font) for text, font, _ in parts)
    x = (width - total) / 2
    for text, font, color in parts:
        draw.text((x, y), text, font=font, fill=color)
        x += draw.textlength(text, font=font)


def render_sidebar() -> Image.Image:
    width, height = SIDEBAR_SIZE[0] * SCALE, SIDEBAR_SIZE[1] * SCALE
    image = vertical_gradient((width, height), BG_TOP, BG_BOTTOM).convert("RGBA")

    mark_size = 64 * SCALE
    mark_x = (width - mark_size) // 2
    mark_y = 58 * SCALE

    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_radius = 58 * SCALE
    center = (width // 2, mark_y + mark_size // 2)
    ImageDraw.Draw(glow).ellipse(
        (center[0] - glow_radius, center[1] - glow_radius, center[0] + glow_radius, center[1] + glow_radius),
        fill=ACCENT + (46,),
    )
    image.alpha_composite(glow.filter(ImageFilter.GaussianBlur(26 * SCALE)))
    draw_waves(image)
    image.alpha_composite(app_mark(mark_size, ring=2 * SCALE), (mark_x, mark_y))

    draw = ImageDraw.Draw(image)
    wordmark = load_font("PlusJakartaSans-800.woff2", 23)
    body = load_font("Inter-Regular.woff2", 11)
    small = load_font("Inter-Medium.woff2", 8)

    draw_centered(draw, width, 142 * SCALE, [("Track", wordmark, TEXT_PRIMARY), ("Cast", wordmark, ACCENT)])
    for index, line in enumerate(TAGLINE):
        draw_centered(draw, width, (178 + index * 15) * SCALE, [(line, body, TEXT_MUTED)])
    draw_centered(draw, width, (height // SCALE - 22) * SCALE, [(FOOTER, small, TEXT_MUTED)])

    return image.convert("RGB").resize(SIDEBAR_SIZE, Image.LANCZOS)


def render_header() -> Image.Image:
    width, height = HEADER_SIZE[0] * SCALE, HEADER_SIZE[1] * SCALE
    image = Image.new("RGBA", (width, height), WHITE + (255,))

    mark_size = 34 * SCALE
    mark_y = (height - mark_size) // 2
    mark_x = width - mark_size - 10 * SCALE
    image.alpha_composite(app_mark(mark_size, ring=round(1.5 * SCALE)), (mark_x, mark_y))

    draw = ImageDraw.Draw(image)
    wordmark = load_font("PlusJakartaSans-800.woff2", 16)
    track_width = draw.textlength("Track", font=wordmark)
    cast_width = draw.textlength("Cast", font=wordmark)
    text_x = mark_x - 8 * SCALE - track_width - cast_width
    bbox = draw.textbbox((0, 0), "TrackCast", font=wordmark)
    text_y = (height - (bbox[3] - bbox[1])) / 2 - bbox[1]
    draw.text((text_x, text_y), "Track", font=wordmark, fill=INK)
    draw.text((text_x + track_width, text_y), "Cast", font=wordmark, fill=ACCENT_DARK)

    return image.convert("RGB").resize(HEADER_SIZE, Image.LANCZOS)


def main() -> None:
    BUILD_DIR.mkdir(exist_ok=True)
    outputs = {
        "installerSidebar.bmp": render_sidebar(),
        "installerHeader.bmp": render_header(),
    }
    for name, image in outputs.items():
        path = BUILD_DIR / name
        image.save(path, format="BMP")
        print(f"Wrote {path.relative_to(ROOT)} {image.size[0]}x{image.size[1]}")


if __name__ == "__main__":
    main()
