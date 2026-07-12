"""Build clean, per-browser extension upload packages.

One source tree, several stores. The browsers differ ONLY in packaging:

  chrome  — Chromium MV3 (service worker + chrome.offscreen). The canonical
            manifest.json ships as-is. Also the artifact for Edge/Brave/Opera/
            Vivaldi/Arc, which all consume the Chrome package.
  edge    — Identical artifact to chrome, emitted under an edge-named zip for a
            separate Microsoft Partner Center submission.
  firefox — Gecko MV3. No chrome.offscreen, so the background is a DOM-bearing
            page that hosts the sandbox iframe in-page (offscreen.firefox.html,
            shipped as offscreen.html). Uses manifest.firefox.json and the
            browser-compat.js namespace bridge.
  safari  — Thin client. Default + platform groups run in the extension;
            custom-rule logic is redirected to the macosBlocker app over
            native messaging. Uses manifest.safari.json, omits the in-browser
            eval sandbox, and pins the native transport via a generated
            sandbox-transport.js.

Why an allowlist (not a denylist):
  Stores reject packages containing dev artefacts, dotfiles, reserved-prefix
  paths, or files referenced by nothing. Maintaining an explicit list of what
  *does* ship is safer than chasing every new development artefact.

Output:
  dist/AdamanciaVault-extension-<target>-v<version>.zip

Run:
  python3 tools/package.py                 # builds every target
  python3 tools/package.py --target edge   # builds one target
  python3 tools/package.py --target chrome edge firefox safari
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = REPO_ROOT / "dist"

# Runtime JS/HTML/CSS at the repo root shared by every target. Per-target
# manifests and host pages are handled separately below so they can be
# renamed/synthesised during the copy.
COMMON_TOP_LEVEL_FILES = [
    "background.js",
    "content.js",
    "platform-profiles.js",
    "helpers.js",
    "browser-compat.js",
    "popup.html",
    "popup.js",
    "popup.css",
    "popup-markdown.js",
    "message-page.html",
    "message-page.js",
    "message-page.css",
    "translations.js",
]

# The in-browser eval sandbox. Present on Chromium + Firefox; omitted on
# Safari, where custom rules run natively in the macosBlocker app.
SANDBOX_FILES = [
    "event-sandbox.html",
    "event-sandbox.js",
    "offscreen.js",
]

# YouTube creator-tag feature, shared by every target: the feed hider
# (yt-block.js), the consent-gated channel-id collector (yt-collect.js), the
# page-world continuation harvester (yt-harvest-main.js, a MAIN-world content
# script that lets every scrolled-in card resolve its channel id). Consent is
# part of the popup, so it has no standalone page to package.
YOUTUBE_FILES = [
    "yt-collect.js",
    "yt-block.js",
    "yt-harvest-main.js",
]

INCLUDE_DIRS = [
    "_locales",
    "icons",
    "templates",
    "translation",
    "manual",
]

EXCLUDE_NAMES = {
    ".DS_Store",
    "Thumbs.db",
    "icon-master.png",
    "icon-inverse-dark-master.png",
}
EXCLUDE_SUFFIXES = {".pyc", ".pyo"}

ALL_TARGETS = ["chrome", "edge", "firefox", "safari"]


def is_excluded(path: Path) -> bool:
    if path.name in EXCLUDE_NAMES:
        return True
    if path.suffix in EXCLUDE_SUFFIXES:
        return True
    if "__pycache__" in path.parts:
        return True
    return False


def read_version(manifest_name: str) -> str:
    with (REPO_ROOT / manifest_name).open("r", encoding="utf-8") as f:
        return json.load(f)["version"]


def manifest_for(target: str) -> str:
    if target in ("chrome", "edge"):
        return "manifest.json"
    if target == "firefox":
        return "manifest.firefox.json"
    if target == "safari":
        return "manifest.safari.json"
    raise ValueError(f"unknown target: {target}")


def collect_dir_files() -> list[Path]:
    files: list[Path] = []
    missing: list[str] = []
    for rel in INCLUDE_DIRS:
        d = REPO_ROOT / rel
        if not d.exists():
            missing.append(rel + "/")
            continue
        for f in sorted(d.rglob("*")):
            if f.is_file() and not is_excluded(f):
                files.append(f)
    if missing:
        sys.stderr.write(
            "ERROR: required directories missing from repo:\n  - "
            + "\n  - ".join(missing)
            + "\n"
        )
        sys.exit(1)
    return files


def build_target(target: str) -> Path:
    """Build one target. Returns the path to the written zip.

    Files are written into the zip under their final (in-package) names, so a
    source like manifest.firefox.json lands as manifest.json, and
    offscreen.firefox.html lands as offscreen.html.
    """
    manifest_name = manifest_for(target)
    version = read_version(manifest_name)

    # (source_path_or_None, arcname, optional_literal_text)
    entries: list[tuple[Path | None, str, str | None]] = []

    # Manifest -> manifest.json
    entries.append((REPO_ROOT / manifest_name, "manifest.json", None))

    for rel in COMMON_TOP_LEVEL_FILES:
        entries.append((REPO_ROOT / rel, rel, None))

    for rel in YOUTUBE_FILES:
        entries.append((REPO_ROOT / rel, rel, None))

    if target != "safari":
        for rel in SANDBOX_FILES:
            entries.append((REPO_ROOT / rel, rel, None))
        # The offscreen host page differs per engine.
        if target == "firefox":
            entries.append((REPO_ROOT / "offscreen.firefox.html", "offscreen.html", None))
        else:
            entries.append((REPO_ROOT / "offscreen.html", "offscreen.html", None))
    else:
        # Safari: pin the native sandbox transport. background.js reads
        # self.CB_SANDBOX_TRANSPORT before deciding where to run custom rules.
        entries.append((
            None,
            "sandbox-transport.js",
            '/* generated by tools/package.py for the safari target */\n'
            'self.CB_SANDBOX_TRANSPORT = "native";\n',
        ))

    for f in collect_dir_files():
        entries.append((f, f.relative_to(REPO_ROOT).as_posix(), None))

    # Validate sources exist.
    missing = [
        arc for (src, arc, lit) in entries
        if lit is None and (src is None or not src.exists())
    ]
    if missing:
        sys.stderr.write(
            f"ERROR [{target}]: required paths missing from repo:\n  - "
            + "\n  - ".join(sorted(set(missing)))
            + "\n"
        )
        sys.exit(1)

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = DIST_DIR / f"AdamanciaVault-extension-{target}-v{version}.zip"
    if zip_path.exists():
        zip_path.unlink()

    total_bytes = 0
    seen: set[str] = set()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for src, arc, lit in entries:
            if arc in seen:
                continue
            seen.add(arc)
            if lit is not None:
                data = lit.encode("utf-8")
                z.writestr(arc, data)
                total_bytes += len(data)
            else:
                z.write(src, arc)
                total_bytes += src.stat().st_size

    print(
        f"[{target}] packaged {len(seen)} files "
        f"({total_bytes / 1024:.1f} KB) -> {zip_path.relative_to(REPO_ROOT)}"
    )
    return zip_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Build per-browser extension packages.")
    parser.add_argument(
        "--target",
        nargs="+",
        choices=ALL_TARGETS,
        default=ALL_TARGETS,
        help="Which target(s) to build (default: all).",
    )
    args = parser.parse_args()

    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)

    for target in args.target:
        build_target(target)


if __name__ == "__main__":
    main()
