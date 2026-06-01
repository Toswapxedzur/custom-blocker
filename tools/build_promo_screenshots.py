"""Convert raw promo screenshots into Chrome Web Store 1280x800 24-bit PNGs.

For each PNG in `promotionpicture/`:
  1. Sample a 6x6 region at the top-right corner to pick the canvas color.
     (The screenshots come from a dark-mode browser so this resolves to
     ~#000000; sampling rather than hard-coding keeps the script reusable
     if the browser theme changes.)
  2. Scale the source to its largest non-distorted size that still covers
     the 1280x800 canvas (cover / crop-fill), then center-crop the
     overflow so the canvas is fully filled.
  3. The canvas is pre-filled with the sampled color so any sub-pixel edge
     mismatch falls back to that color instead of transparent.
  4. Save as a 24-bit (RGB, no alpha) PNG in `promotionpicture/store_1280x800/`.

Run: `python3 tools/build_promo_screenshots.py`
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = REPO_ROOT / "promotionpicture"
OUT_DIR = SRC_DIR / "store_1280x800"

TARGET_W = 1280
TARGET_H = 800
CORNER_PROBE = 6   # pixels of top-right corner to average for the canvas color


def sample_top_right(im: Image.Image) -> tuple[int, int, int]:
    w, h = im.size
    region = im.crop((w - CORNER_PROBE, 0, w, CORNER_PROBE))
    pixels = list(region.getdata())
    return tuple(round(sum(c[i] for c in pixels) / len(pixels)) for i in range(3))


def fit_cover(im: Image.Image, fill_rgb) -> Image.Image:
    """Scale `im` to the smallest size that still covers TARGET_WxTARGET_H
    while preserving aspect, then center-crop the overflow.

    This is the largest non-distorted scale that fills the entire canvas.
    Any sub-pixel rounding leaves the underlying `fill_rgb` visible.
    """
    w, h = im.size
    scale = max(TARGET_W / w, TARGET_H / h)
    new_w = round(w * scale)
    new_h = round(h * scale)
    resized = im.resize((new_w, new_h), resample=Image.LANCZOS)

    canvas = Image.new("RGB", (TARGET_W, TARGET_H), fill_rgb)
    offset_x = (TARGET_W - new_w) // 2
    offset_y = (TARGET_H - new_h) // 2
    # paste() will clip naturally where the resized image extends past the
    # canvas edges, giving us a center-crop for free.
    canvas.paste(resized, (offset_x, offset_y))
    return canvas


def main() -> None:
    if not SRC_DIR.is_dir():
        raise SystemExit(f"Source folder not found: {SRC_DIR}")

    OUT_DIR.mkdir(exist_ok=True)

    sources = sorted(p for p in SRC_DIR.iterdir() if p.suffix.lower() == ".png" and p.parent == SRC_DIR)
    if not sources:
        raise SystemExit(f"No PNGs found directly in {SRC_DIR}")

    for idx, src in enumerate(sources, start=1):
        im = Image.open(src).convert("RGB")
        fill = sample_top_right(im)
        out = fit_cover(im, fill)
        out_path = OUT_DIR / f"screenshot-{idx:02d}.png"
        out.save(out_path, format="PNG", optimize=True)
        hexc = "#{:02x}{:02x}{:02x}".format(*fill)
        print(f"  {src.name}")
        print(f"    -> {out_path.relative_to(REPO_ROOT)}  pad={hexc}  size=({out.size[0]}x{out.size[1]})")

    print(f"\nWrote {len(sources)} screenshot(s) to {OUT_DIR.relative_to(REPO_ROOT)}/")


if __name__ == "__main__":
    main()
