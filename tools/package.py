"""Build a clean Chrome Web Store upload zip.

Why an allowlist (not a denylist):
  The Chrome Web Store rejects packages containing dev artefacts, dotfiles,
  reserved-prefix paths, or files referenced by nothing. Maintaining an
  explicit list of what *does* ship is safer than chasing every new
  development artefact.

What gets included:
  - The MV3 manifest.
  - Runtime JS / HTML / CSS at the repo root.
  - Localized store-listing strings under _locales/.
  - Icons, templates, translations, manuals.

What gets excluded:
  - .git, .idea, .cursor, .DS_Store, *.pyc, __pycache__
  - tools/ (this script and friends)
  - tests/
  - README.md, dist/, *.zip
  - Anything starting with "_" except the reserved _locales/ directory.

Output:
  dist/custom-web-blocker-<version>.zip

Run:
  python3 tools/package.py
"""

from __future__ import annotations

import json
import shutil
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = REPO_ROOT / "dist"

# Files at the repo root that ship verbatim.
TOP_LEVEL_FILES = [
    "manifest.json",
    "background.js",
    "content.js",
    "helpers.js",
    "popup.html",
    "popup.js",
    "popup.css",
    "popup-markdown.js",
    "event-sandbox.html",
    "event-sandbox.js",
    "offscreen.html",
    "offscreen.js",
    "message-page.html",
    "message-page.js",
    "message-page.css",
    "translations.js",
]

# Whole directories that ship verbatim. Each directory is walked and every
# file inside is included unless excluded by EXCLUDE_PATTERNS below.
INCLUDE_DIRS = [
    "_locales",
    "icons",
    "templates",
    "translation",
    "manual",
]

# Filenames anywhere under an included directory that should be skipped.
EXCLUDE_NAMES = {".DS_Store", "Thumbs.db"}
EXCLUDE_SUFFIXES = {".pyc", ".pyo"}


def is_excluded(path: Path) -> bool:
    if path.name in EXCLUDE_NAMES:
        return True
    if path.suffix in EXCLUDE_SUFFIXES:
        return True
    if "__pycache__" in path.parts:
        return True
    return False


def collect_files() -> list[Path]:
    """Return the absolute paths of every file that will go into the zip."""
    files: list[Path] = []
    missing: list[str] = []

    for rel in TOP_LEVEL_FILES:
        p = REPO_ROOT / rel
        if not p.exists():
            missing.append(rel)
            continue
        files.append(p)

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
            "ERROR: required paths missing from repo:\n  - "
            + "\n  - ".join(missing)
            + "\n"
        )
        sys.exit(1)

    return files


def read_version() -> str:
    with (REPO_ROOT / "manifest.json").open("r", encoding="utf-8") as f:
        return json.load(f)["version"]


def main() -> None:
    version = read_version()
    files = collect_files()

    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True)

    zip_path = DIST_DIR / f"custom-web-blocker-{version}.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for f in files:
            arcname = f.relative_to(REPO_ROOT).as_posix()
            z.write(f, arcname)

    total_bytes = sum(f.stat().st_size for f in files)
    print(f"Packaged {len(files)} files ({total_bytes / 1024:.1f} KB) -> {zip_path}")
    print("Contents preview:")
    for arcname in sorted(f.relative_to(REPO_ROOT).as_posix() for f in files)[:20]:
        print(f"  {arcname}")
    if len(files) > 20:
        print(f"  ... ({len(files) - 20} more)")


if __name__ == "__main__":
    main()
