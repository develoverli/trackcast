"""Generate app icons (PNG + ICO) and tray icons for TrackCast.

Renders the app mark (dark tile, green to violet gradient ring, green note glyph)
at each size and writes:
  - src/renderer/assets/icon-<size>.png and icon.png   window, taskbar, About
  - src/renderer/assets/tray/tray-<state>-<size>.png   system tray (idle / playing / error)
  - build/icon.ico                                      app, installer and uninstaller icon

Requires: Python 3.9+, Pillow 8.1+.
"""
from pathlib import Path

from PIL import Image, ImageDraw

from branding import ACCENT, app_mark

ROOT = Path(__file__).resolve().parent.parent
BUILD_DIR = ROOT / "build"
ASSETS_DIR = ROOT / "src" / "renderer" / "assets"
TRAY_DIR = ASSETS_DIR / "tray"

SUPERSAMPLE = 8
ICON_SIZES = [16, 24, 32, 48, 64, 128, 256]
TRAY_SIZES = [16, 24, 32]
SMALL_ICON_MAX = 32  # sizes at or below this get a bolder glyph so it stays legible

STATUS_COLORS = {
    "playing": ACCENT,
    "idle": (150, 160, 155),
    "error": (240, 82, 70),
}
STATUS_OUTLINE = (12, 16, 14)


def render_icon(size: int) -> Image.Image:
    """Render the app mark at `size` pixels with supersampling for smooth edges."""
    canvas = size * SUPERSAMPLE
    small = size <= SMALL_ICON_MAX
    ring = max(round(size * 0.032), 1) * SUPERSAMPLE
    mark = app_mark(
        canvas,
        ring=ring,
        glyph_ratio=0.62 if small else 0.52,
        stroke=3.2 if small else 2.3,
    )
    return mark.resize((size, size), Image.LANCZOS)


def render_tray_icon(size: int, state: str) -> Image.Image:
    """App mark with a status dot in the bottom-right corner."""
    canvas = size * SUPERSAMPLE
    image = render_icon(size).resize((canvas, canvas), Image.LANCZOS)
    draw = ImageDraw.Draw(image)
    radius = canvas * 0.2
    outline = max(canvas * 0.06, SUPERSAMPLE)
    cx = cy = canvas - radius - outline
    draw.ellipse(
        (cx - radius - outline, cy - radius - outline, cx + radius + outline, cy + radius + outline),
        fill=STATUS_OUTLINE + (255,),
    )
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=STATUS_COLORS[state] + (255,))
    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    BUILD_DIR.mkdir(exist_ok=True)
    TRAY_DIR.mkdir(exist_ok=True, parents=True)

    icons = {size: render_icon(size) for size in ICON_SIZES}
    for size, image in icons.items():
        image.save(ASSETS_DIR / f"icon-{size}.png", format="PNG")
    icons[256].save(ASSETS_DIR / "icon.png", format="PNG")

    for state in STATUS_COLORS:
        for size in TRAY_SIZES:
            render_tray_icon(size, state).save(TRAY_DIR / f"tray-{state}-{size}.png", format="PNG")

    # Each ICO entry uses its own hand-tuned render instead of downscaling the 256px image.
    ico_path = BUILD_DIR / "icon.ico"
    largest = icons[ICON_SIZES[-1]]
    largest.save(
        ico_path,
        format="ICO",
        sizes=[(size, size) for size in ICON_SIZES],
        append_images=[icons[size] for size in ICON_SIZES[:-1]],
    )
    print(f"Wrote {len(ICON_SIZES)} app icons, {len(STATUS_COLORS) * len(TRAY_SIZES)} tray icons and {ico_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
