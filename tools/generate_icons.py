"""Render Vault extension icons from the canonical SVG source.

The SVG is the single design source. Rasterize every target directly from that
vector so the 16 / 32 / 48 / 128px variants stay crisp. The normal mark emits
both stable and active cache-busting filenames; the inverse-dark companion
mark emits its own explicitly named files for dark browser surfaces.

Run: `python3 tools/generate_icons.py`
"""

from __future__ import annotations

from pathlib import Path
import shutil
import subprocess


def render_official_svg(source: Path, output: Path, size: int) -> None:
    """Rasterize the canonical SVG with an available transparency-safe tool."""
    try:
        import cairosvg  # type: ignore
    except ImportError:
        cairosvg = None

    if cairosvg is not None:
        cairosvg.svg2png(
            url=str(source),
            write_to=str(output),
            output_width=size,
            output_height=size,
        )
        return

    if shutil.which("rsvg-convert"):
        subprocess.run(
            [
                "rsvg-convert",
                "-w",
                str(size),
                "-h",
                str(size),
                "-o",
                str(output),
                str(source),
            ],
            check=True,
        )
        return

    if shutil.which("sips"):
        subprocess.run(
            [
                "sips",
                "-z",
                str(size),
                str(size),
                "-s",
                "format",
                "png",
                str(source),
                "--out",
                str(output),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        return

    raise RuntimeError(
        "Install CairoSVG or librsvg, or run this tool on macOS with sips."
    )


def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)

    source = out_dir / "official-vault-extension.svg"
    render_official_svg(source, out_dir / "icon-master.png", 1024)

    for px in (16, 32, 48, 128):
        stable_path = out_dir / f"icon-{px}.png"
        render_official_svg(source, stable_path, px)
        shutil.copyfile(
            stable_path,
            out_dir / f"adamancia-vault-lock-v3-{px}.png",
        )

    inverse_source = out_dir / "official-vault-extension-inverse-dark.svg"
    render_official_svg(inverse_source, out_dir / "icon-inverse-dark-master.png", 1024)
    for px in (16, 32, 48, 128):
        render_official_svg(
            inverse_source,
            out_dir / f"adamancia-vault-lock-inverse-dark-{px}.png",
            px,
        )

    print(f"Wrote icons to {out_dir}")


if __name__ == "__main__":
    main()
