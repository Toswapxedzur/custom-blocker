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
import re
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
    "bridge-protocol.js",
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

# Chromium alone uses an MV3 service-worker wrapper. It turns a synchronous
# background import failure into a visible DevTools error instead of an
# unregistered worker (Chrome's opaque "No SW" state).
CHROMIUM_SERVICE_WORKER_FILES = [
    "service-worker.js",
]

# The in-browser eval sandbox. Present on Chromium + Firefox; omitted on
# Safari, where custom rules run natively in the macosBlocker app.
SANDBOX_FILES = [
    "event-sandbox.html",
    "event-sandbox.js",
    "offscreen.js",
]

# The opt-in Vault Classifier adapter is currently Chromium-only. Keep it out
# of Firefox and Safari packages until their native transport contracts exist,
# but include every manifest-declared Chrome/Edge content script.
VAULT_CLASSIFIER_FILES = [
    "vault-classifier-contract.js",
    # The service worker imports this adapter at startup; it is not declared
    # in the manifest, so it must remain explicitly listed here.
    "vault-classifier-bridge.js",
    "local-hub-auth.js",
    "vault-classifier-collector-core.js",
    "vault-classifier-youtube.js",
    "vault-classifier-tiktok.js",
    "vault-classifier-facebook.js",
    "vault-classifier-instagram.js",
    "vault-classifier-twitch.js",
    "vault-classifier-reddit.js",
    "vault-classifier-discord.js",
    "vault-classifier-twitter.js",
    "vault-classifier-bilibili.js",
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


def manifest_file_references(manifest: dict[str, object]) -> set[str]:
    """Return every packaged file path directly named by the manifest."""
    references: set[str] = set()

    background = manifest.get("background")
    if isinstance(background, dict):
        service_worker = background.get("service_worker")
        if isinstance(service_worker, str):
            references.add(service_worker)
        scripts = background.get("scripts")
        if isinstance(scripts, list):
            references.update(script for script in scripts if isinstance(script, str))

    content_scripts = manifest.get("content_scripts")
    if isinstance(content_scripts, list):
        for definition in content_scripts:
            if not isinstance(definition, dict):
                continue
            scripts = definition.get("js")
            if isinstance(scripts, list):
                references.update(script for script in scripts if isinstance(script, str))

    sandbox = manifest.get("sandbox")
    if isinstance(sandbox, dict):
        pages = sandbox.get("pages")
        if isinstance(pages, list):
            references.update(page for page in pages if isinstance(page, str))

    return references


def validate_manifest_files(target: str, manifest_path: Path, archive_paths: set[str]) -> None:
    """Fail before release if a manifest points at a file absent from the ZIP."""
    with manifest_path.open("r", encoding="utf-8") as f:
        manifest = json.load(f)

    if not isinstance(manifest, dict):
        raise ValueError(f"{manifest_path.name} must contain a JSON object")

    missing = sorted(manifest_file_references(manifest) - archive_paths)
    if missing:
        raise RuntimeError(
            f"ERROR [{target}]: manifest references files missing from the package:\n  - "
            + "\n  - ".join(missing)
        )


def validate_service_worker_imports(target: str, archive_paths: set[str]) -> None:
    """Reject Chromium packages whose worker imports an omitted local script.

    Manifest validation cannot see classic-worker ``importScripts`` calls. The
    Vault Classifier bridge is one such dependency; omitting it makes a fresh
    Chrome/Edge service worker fail before it can receive extension messages.
    Only Chromium runs this branch: Firefox and Safari preload their background
    dependencies through their manifest-specific script lists.
    """
    if target not in ("chrome", "edge"):
        return
    imports: set[str] = set()
    for worker_source_name in ("service-worker.js", "background.js"):
        worker_source = (REPO_ROOT / worker_source_name).read_text(encoding="utf-8")
        imports.update(re.findall(r'''\bimportScripts\(\s*["']([^"']+)["']\s*\)''', worker_source))
    missing = sorted(imports - archive_paths)
    if missing:
        raise RuntimeError(
            f"ERROR [{target}]: background service-worker imports missing from the package:\n  - "
            + "\n  - ".join(missing)
        )


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

    if target in ("chrome", "edge"):
        for rel in CHROMIUM_SERVICE_WORKER_FILES:
            entries.append((REPO_ROOT / rel, rel, None))
        for rel in VAULT_CLASSIFIER_FILES:
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

    # Validate the actual archive layout, rather than trusting the source tree.
    with zipfile.ZipFile(zip_path, "r") as z:
        archive_paths = set(z.namelist())
        validate_manifest_files(target, REPO_ROOT / manifest_name, archive_paths)
        validate_service_worker_imports(target, archive_paths)

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
