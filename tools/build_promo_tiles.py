"""Generate the two Chrome Web Store promo tiles.

  - Small promo tile:   440 x 280  (the card the user sees in search /
                                    recommendations on the Web Store).
  - Marquee promo tile: 1400 x 560 (used when the listing is featured).

Both are saved as 24-bit RGB PNGs (no alpha) so they pass the Web Store
upload validator.

Design language reuses the app icon palette:
  - Diagonal gradient #68BCF0 (top-left) -> #1C5CA8 (bottom-right).
  - Soft top sheen for a glassy feel.
  - The existing app-icon master is dropped in on the left and the product
    name + tagline sit on the right in white SF / Helvetica.

Output: `promotionpicture/store_promo_tiles/`.
Run:    `python3 tools/build_promo_tiles.py`
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


REPO_ROOT = Path(__file__).resolve().parent.parent
ICON_MASTER = REPO_ROOT / "icons" / "icon-master.png"
OUT_DIR = REPO_ROOT / "promotionpicture" / "store_promo_tiles"

# ---------------------------------------------------------------------------
# Palette: bright light-blue tile with deep navy text for sharp contrast.
# ---------------------------------------------------------------------------

BG_TOP_LEFT = (206, 232, 249)        # very pale icy blue
BG_BOTTOM_RIGHT = (155, 205, 240)    # slightly deeper sky blue

TITLE_RGB = (12, 35, 78)             # deep navy
TAGLINE_RGB = (40, 78, 138)          # mid navy

TITLE_TEXT = "Adamancia Vault"
TAGLINE_TEXT = "Stay focused. Block what matters."

# ---------------------------------------------------------------------------
# Fonts: prefer SF, fall back to Helvetica / Arial, then PIL default.
# ---------------------------------------------------------------------------

FONT_CANDIDATES_BOLD = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/SFNS.ttf",
]
FONT_CANDIDATES_REGULAR = [
    "/System/Library/Fonts/SFNS.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
]


def load_font(size: int, bold: bool) -> ImageFont.ImageFont:
    candidates = FONT_CANDIDATES_BOLD if bold else FONT_CANDIDATES_REGULAR
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def text_width(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]


def fit_title(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_size: int,
    min_size: int,
    max_width: int,
    bold: bool,
):
    """Return (font, lines) where each line fits inside `max_width`.

    Strategy: try single-line at sizes from `max_size` down. If single-line
    never fits, try a 2-line wrap (split at the last space before midpoint)
    at the same descending size range. Falls back to `min_size` clamping if
    even wrapped lines still overflow.
    """
    # Single-line attempt at the largest size that fits.
    for size in range(max_size, min_size - 1, -2):
        font = load_font(size, bold=bold)
        if text_width(draw, text, font) <= max_width:
            return font, [text]

    # Two-line wrap. Split at the space closest to the middle of the string.
    words = text.split()
    if len(words) >= 2:
        best_split = None
        best_balance = float("inf")
        for i in range(1, len(words)):
            left = " ".join(words[:i])
            right = " ".join(words[i:])
            balance = abs(len(left) - len(right))
            if balance < best_balance:
                best_balance = balance
                best_split = (left, right)
        if best_split is not None:
            for size in range(max_size, min_size - 1, -2):
                font = load_font(size, bold=bold)
                if (text_width(draw, best_split[0], font) <= max_width
                        and text_width(draw, best_split[1], font) <= max_width):
                    return font, list(best_split)

    # Last resort: smallest size, single line, even if it overflows visually.
    return load_font(min_size, bold=bold), [text]


# ---------------------------------------------------------------------------
# Gradient + sheen helpers
# ---------------------------------------------------------------------------

def diagonal_gradient(w: int, h: int, tl_rgb, br_rgb) -> Image.Image:
    """Diagonal (TL -> BR) gradient. Rendered small, upscaled bilinearly."""
    work = 256
    small = Image.new("RGB", (work, work))
    px = small.load()
    denom = (work - 1) * 2
    for y in range(work):
        for x in range(work):
            t = (x + y) / denom
            px[x, y] = (
                round(tl_rgb[0] * (1 - t) + br_rgb[0] * t),
                round(tl_rgb[1] * (1 - t) + br_rgb[1] * t),
                round(tl_rgb[2] * (1 - t) + br_rgb[2] * t),
            )
    return small.resize((w, h), resample=Image.BILINEAR)


def add_top_sheen(canvas: Image.Image) -> Image.Image:
    """Soft white horizontal band fading down from the top edge."""
    w, h = canvas.size
    band = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    band_h = round(h * 0.55)
    for y in range(band_h):
        t = y / max(band_h - 1, 1)
        alpha = round(60 * (1 - t) ** 2)
        if alpha <= 0:
            continue
        bd.line([(0, y), (w, y)], fill=(255, 255, 255, alpha))
    base = canvas.convert("RGBA")
    base.alpha_composite(band)
    return base.convert("RGB")


# ---------------------------------------------------------------------------
# Tile renderer
# ---------------------------------------------------------------------------

def render_tile(
    *,
    width: int,
    height: int,
    icon_px: int,
    icon_left_pad: int,
    text_gap: int,
    right_pad: int,
    title_max_size: int,
    title_min_size: int,
    tagline_max_size: int,
    tagline_min_size: int,
    line_gap: int,
    tagline_gap: int,
    icon_shadow_blur: float,
    icon_shadow_offset: int,
) -> Image.Image:
    bg = diagonal_gradient(width, height, BG_TOP_LEFT, BG_BOTTOM_RIGHT)
    bg = add_top_sheen(bg)
    canvas = bg.convert("RGBA")

    # --- Icon ---
    icon = Image.open(ICON_MASTER).convert("RGBA").resize(
        (icon_px, icon_px), resample=Image.LANCZOS
    )
    icon_x = icon_left_pad
    icon_y = (height - icon_px) // 2

    # Soft drop shadow under the icon for depth.
    shadow_src = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    shadow_src.paste((8, 24, 60, 130), (icon_x, icon_y), icon.split()[3])
    shadow = shadow_src.filter(ImageFilter.GaussianBlur(radius=icon_shadow_blur))
    canvas.alpha_composite(shadow, (0, icon_shadow_offset))

    canvas.alpha_composite(icon, (icon_x, icon_y))

    # --- Text ---
    draw = ImageDraw.Draw(canvas)
    text_left = icon_x + icon_px + text_gap
    text_max_width = width - text_left - right_pad

    title_font, title_lines = fit_title(
        draw, TITLE_TEXT, title_max_size, title_min_size, text_max_width, bold=True
    )
    tagline_font, tagline_lines = fit_title(
        draw, TAGLINE_TEXT, tagline_max_size, tagline_min_size, text_max_width, bold=False
    )

    # Measure to vertical-center the whole text block.
    line_heights_title = []
    for line in title_lines:
        bbox = draw.textbbox((0, 0), line, font=title_font)
        line_heights_title.append((bbox, bbox[3] - bbox[1]))
    line_heights_tagline = []
    for line in tagline_lines:
        bbox = draw.textbbox((0, 0), line, font=tagline_font)
        line_heights_tagline.append((bbox, bbox[3] - bbox[1]))

    title_block_h = sum(h for _, h in line_heights_title) + line_gap * max(
        0, len(title_lines) - 1
    )
    tagline_block_h = sum(h for _, h in line_heights_tagline) + line_gap * max(
        0, len(tagline_lines) - 1
    )
    block_h = title_block_h + tagline_gap + tagline_block_h
    cursor_y = (height - block_h) // 2

    # Dark text on light bg doesn't need a shadow for legibility; a 1 px
    # white highlight underneath the title adds a touch of crispness instead.
    highlight_off = max(1, height // 400)

    for line, (bbox, h) in zip(title_lines, line_heights_title):
        baseline_y = cursor_y - bbox[1]
        draw.text(
            (text_left, baseline_y + highlight_off),
            line,
            font=title_font,
            fill=(255, 255, 255, 110),
        )
        draw.text((text_left, baseline_y), line, font=title_font, fill=TITLE_RGB)
        cursor_y += h + line_gap
    if title_lines:
        cursor_y -= line_gap
    cursor_y += tagline_gap

    for line, (bbox, h) in zip(tagline_lines, line_heights_tagline):
        baseline_y = cursor_y - bbox[1]
        draw.text((text_left, baseline_y), line, font=tagline_font, fill=TAGLINE_RGB)
        cursor_y += h + line_gap

    return canvas.convert("RGB")


def main() -> None:
    if not ICON_MASTER.exists():
        raise SystemExit(
            f"Missing {ICON_MASTER}. Run `python3 tools/generate_icons.py` first."
        )
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Small promo tile 440x280. Tight: icon shrunk so title gets more room.
    small = render_tile(
        width=440,
        height=280,
        icon_px=150,
        icon_left_pad=24,
        text_gap=20,
        right_pad=20,
        title_max_size=34,
        title_min_size=18,
        tagline_max_size=15,
        tagline_min_size=11,
        line_gap=4,
        tagline_gap=10,
        icon_shadow_blur=8,
        icon_shadow_offset=4,
    )
    small_path = OUT_DIR / "promo-small-440x280.png"
    small.save(small_path, format="PNG", optimize=True)
    print(f"Wrote {small_path.relative_to(REPO_ROOT)}  size={small.size}")

    # Marquee promo tile 1400x560.
    marquee = render_tile(
        width=1400,
        height=560,
        icon_px=380,
        icon_left_pad=100,
        text_gap=60,
        right_pad=80,
        title_max_size=96,
        title_min_size=48,
        tagline_max_size=42,
        tagline_min_size=24,
        line_gap=8,
        tagline_gap=24,
        icon_shadow_blur=24,
        icon_shadow_offset=10,
    )
    marquee_path = OUT_DIR / "promo-marquee-1400x560.png"
    marquee.save(marquee_path, format="PNG", optimize=True)
    print(f"Wrote {marquee_path.relative_to(REPO_ROOT)}  size={marquee.size}")


if __name__ == "__main__":
    main()
