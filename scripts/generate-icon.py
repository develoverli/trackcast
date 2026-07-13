"""Generate app icon (PNG + ICO) for TrackCast.

Renders a rounded green square with a stylized note glyph at multiple sizes
and bundles them into build/icon.ico for electron-builder.
"""
from pathlib import Path
from PIL import Image, ImageDraw

# Spotify-ish green, slightly darker than #1DB954 so glyph contrast holds.
BG = (29, 185, 84, 255)        # #1DB954
FG = (250, 251, 250, 255)      # off-white
SHADOW = (0, 0, 0, 90)


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def render_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded square base
    radius = max(int(size * 0.22), 1)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BG)

    # Note glyph: simplified eighth note (head + stem + flag)
    # Head: ellipse, lower-left quadrant
    head_w = int(size * 0.32)
    head_h = int(size * 0.26)
    head_x = int(size * 0.22)
    head_y = int(size * 0.55)
    d.ellipse((head_x, head_y, head_x + head_w, head_y + head_h), fill=FG)

    # Stem: vertical bar from top of head upward
    stem_w = max(int(size * 0.06), 1)
    stem_x = head_x + head_w - stem_w
    stem_top = int(size * 0.20)
    stem_bottom = head_y + int(head_h * 0.45)
    d.rounded_rectangle(
        (stem_x, stem_top, stem_x + stem_w, stem_bottom),
        radius=max(int(size * 0.02), 1),
        fill=FG,
    )

    # Flag: curved-ish blob to the right of the stem top
    flag_x = stem_x + stem_w
    flag_w = int(size * 0.24)
    flag_top = stem_top
    flag_bottom = stem_top + int(size * 0.22)
    d.rounded_rectangle(
        (flag_x, flag_top, flag_x + flag_w, flag_bottom),
        radius=max(int(size * 0.06), 1),
        fill=FG,
    )

    # Apply rounded mask to clip any overflow
    mask = rounded_mask(size, radius)
    img.putalpha(Image.eval(mask, lambda v: v))

    return img


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    build_dir = root / "build"
    assets_dir = root / "src" / "renderer" / "assets"
    tray_dir = assets_dir / "tray"
    build_dir.mkdir(exist_ok=True)
    assets_dir.mkdir(exist_ok=True, parents=True)
    tray_dir.mkdir(exist_ok=True, parents=True)

    sizes = [16, 24, 32, 48, 64, 128, 256]
    pngs = []
    for s in sizes:
        im = render_icon(s)
        png_path = assets_dir / f"icon-{s}.png"
        im.save(png_path, format="PNG")
        pngs.append(im)
        if s == 256:
            im.save(assets_dir / "icon.png", format="PNG")

    # Tray icons: 16, 24, 32 with status overlay variants
    for state, color in (
        ("playing", (29, 185, 84, 255)),
        ("idle", (140, 140, 140, 255)),
        ("error", (226, 33, 52, 255)),
    ):
        for s in (16, 24, 32):
            base = render_icon(s)
            d = ImageDraw.Draw(base)
            r = max(int(s * 0.18), 2)
            cx, cy = s - r - 1, s - r - 1
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
            base.save(tray_dir / f"tray-{state}-{s}.png", format="PNG")

    # Build ICO with multiple sizes (electron-builder needs >=256).
    # Source must be the largest image so Pillow can downscale.
    ico_path = build_dir / "icon.ico"
    largest = pngs[-1]
    largest.save(
        ico_path,
        format="ICO",
        sizes=[(s, s) for s in sizes],
    )
    print(f"Wrote {ico_path}")


if __name__ == "__main__":
    main()
