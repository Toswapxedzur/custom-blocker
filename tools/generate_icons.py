"""Generate the Custom Web Blocker app icons.

Design intent:
- Premium, modern, app-store-style tile.
- Rounded squircle background with a diagonal blue gradient (light sky in the
  top-left to deeper marine in the bottom-right) and a soft top highlight for
  a glossy, glassy feel.
- Soft white padlock with a faint vertical gradient and a subtle drop shadow
  so it reads as one confident silhouette without skeuomorphic detail.
- A single small circular keyhole picks up the deep blue from the background
  gradient, tying the palette together without adding clutter.

Render at high resolution (super-sample) and down-sample with LANCZOS so the
16 / 32 / 48 / 128 px variants stay crisp.

Run: `python3 tools/generate_icons.py`
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


# ---------------------------------------------------------------------------
# Color palette
# ---------------------------------------------------------------------------

# Diagonal background gradient (top-left -> bottom-right).
BG_TOP_LEFT = (104, 188, 240)        # bright sky blue
BG_BOTTOM_RIGHT = (28, 92, 168)      # deep marine

# Padlock body / shackle gradient (top -> bottom). Near-white with a faint
# cool tint so it sits comfortably on the blue tile.
LOCK_TOP = (250, 253, 255)
LOCK_BOTTOM = (218, 232, 246)

# Keyhole accent — pulled from the background bottom for palette cohesion.
KEYHOLE = BG_BOTTOM_RIGHT


# ---------------------------------------------------------------------------
# Gradients
# ---------------------------------------------------------------------------

def vertical_gradient(size: int, top_rgb, bottom_rgb) -> Image.Image:
    """Smooth vertical gradient as an RGB image."""
    grad = Image.new("RGB", (1, size))
    for y in range(size):
        t = y / max(size - 1, 1)
        grad.putpixel((0, y), (
            round(top_rgb[0] * (1 - t) + bottom_rgb[0] * t),
            round(top_rgb[1] * (1 - t) + bottom_rgb[1] * t),
            round(top_rgb[2] * (1 - t) + bottom_rgb[2] * t),
        ))
    return grad.resize((size, size))


def diagonal_gradient(size: int, tl_rgb, br_rgb) -> Image.Image:
    """Diagonal (top-left -> bottom-right) gradient.

    Implemented by rendering at a small resolution per-pixel and then up-
    sampling with bilinear filtering — gradients are smooth so the upscale
    doesn't introduce visible artefacts and we avoid a numpy dependency.
    """
    work = 256
    small = Image.new("RGB", (work, work))
    pixels = small.load()
    denom = (work - 1) * 2
    for y in range(work):
        for x in range(work):
            t = (x + y) / denom
            pixels[x, y] = (
                round(tl_rgb[0] * (1 - t) + br_rgb[0] * t),
                round(tl_rgb[1] * (1 - t) + br_rgb[1] * t),
                round(tl_rgb[2] * (1 - t) + br_rgb[2] * t),
            )
    return small.resize((size, size), resample=Image.BILINEAR)


def rounded_square_mask(size: int, radius: int) -> Image.Image:
    """Solid white rounded-square alpha mask."""
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=radius, fill=255
    )
    return mask


# ---------------------------------------------------------------------------
# Background tile (gradient squircle + soft top highlight)
# ---------------------------------------------------------------------------

def render_tile(size: int) -> Image.Image:
    radius = round(size * 0.22)        # iOS-style squircle corner
    mask = rounded_square_mask(size, radius)

    bg = diagonal_gradient(size, BG_TOP_LEFT, BG_BOTTOM_RIGHT).convert("RGBA")

    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile.paste(bg, (0, 0), mask)

    # Soft top highlight: a faint white-to-transparent horizontal band that
    # only covers the upper third of the tile. Adds a glassy sheen without
    # looking skeuomorphic.
    highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(highlight)
    band_h = round(size * 0.55)
    for y in range(band_h):
        t = y / max(band_h - 1, 1)
        # ease-out: strong at the very top, fades quickly
        alpha = round(70 * (1 - t) ** 2)
        if alpha <= 0:
            continue
        hd.line([(0, y), (size, y)], fill=(255, 255, 255, alpha))
    # Confine the highlight to the squircle.
    highlight.putalpha(
        Image.eval(highlight.split()[3], lambda v: v).point(lambda v: v)
    )
    masked_highlight = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    masked_highlight.paste(highlight, (0, 0), mask)

    tile.alpha_composite(masked_highlight)
    return tile


# ---------------------------------------------------------------------------
# Padlock
# ---------------------------------------------------------------------------

def lock_silhouette_mask(size: int):
    """Build the alpha mask for the padlock (shackle + body) and also return
    the geometry of the body so the keyhole can be placed precisely."""
    body_w = round(size * 0.50)
    body_h = round(size * 0.40)
    body_radius = round(size * 0.09)
    body_left = (size - body_w) // 2
    body_bottom = size - round(size * 0.16)
    body_top = body_bottom - body_h
    body_right = body_left + body_w

    # Shackle as a true semicircular arc with thick legs.
    shackle_outer_w = round(size * 0.34)
    shackle_thickness = round(size * 0.085)
    shackle_left = (size - shackle_outer_w) // 2
    shackle_right = shackle_left + shackle_outer_w
    shackle_top = round(size * 0.16)
    shackle_arc_bottom = shackle_top + shackle_outer_w   # bbox is square
    shackle_leg_bottom = body_top + round(size * 0.04)

    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)

    md.arc(
        (shackle_left, shackle_top, shackle_right, shackle_arc_bottom),
        start=180, end=360, fill=255, width=shackle_thickness,
    )

    half = shackle_thickness // 2
    arc_center_y = (shackle_top + shackle_arc_bottom) // 2
    for cx in (shackle_left + half, shackle_right - half):
        md.rectangle(
            (cx - half, arc_center_y, cx + half - 1, shackle_leg_bottom),
            fill=255,
        )

    md.rounded_rectangle(
        (body_left, body_top, body_right - 1, body_bottom - 1),
        radius=body_radius, fill=255,
    )

    body_box = (body_left, body_top, body_right, body_bottom)
    return mask, body_box


def render_lock(size: int) -> Image.Image:
    mask, body_box = lock_silhouette_mask(size)

    fill = vertical_gradient(size, LOCK_TOP, LOCK_BOTTOM).convert("RGBA")
    lock = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    lock.paste(fill, (0, 0), mask)

    # Keyhole: a single bold circle, centered in the body.
    body_left, body_top, body_right, body_bottom = body_box
    body_cx = (body_left + body_right) // 2
    body_cy = (body_top + body_bottom) // 2
    keyhole_d = round(size * 0.16)
    d = ImageDraw.Draw(lock)
    d.ellipse(
        (body_cx - keyhole_d // 2, body_cy - keyhole_d // 2,
         body_cx + keyhole_d // 2, body_cy + keyhole_d // 2),
        fill=KEYHOLE,
    )

    return lock


# ---------------------------------------------------------------------------
# Composite
# ---------------------------------------------------------------------------

def render_master(size: int) -> Image.Image:
    canvas = render_tile(size)
    lock = render_lock(size)

    # Soft drop shadow beneath the lock for subtle depth.
    shadow_src = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_src.paste((6, 24, 56, 110), (0, 0), lock.split()[3])
    shadow = shadow_src.filter(ImageFilter.GaussianBlur(radius=size * 0.018))
    offset = max(1, round(size * 0.018))

    # Confine the shadow to the squircle so it doesn't bleed past the tile.
    radius = round(size * 0.22)
    tile_mask = rounded_square_mask(size, radius)
    shadow_clipped = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shifted = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shifted.alpha_composite(shadow, (0, offset))
    shadow_clipped.paste(shifted, (0, 0), tile_mask)

    canvas.alpha_composite(shadow_clipped)
    canvas.alpha_composite(lock)
    return canvas


def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)

    super_size = 1024
    master = render_master(super_size)
    master.save(out_dir / "icon-master.png", optimize=True)

    for px in (16, 32, 48, 128):
        resized = master.resize((px, px), resample=Image.LANCZOS)
        resized.save(out_dir / f"icon-{px}.png", optimize=True)

    print(f"Wrote icons to {out_dir}")


if __name__ == "__main__":
    main()
