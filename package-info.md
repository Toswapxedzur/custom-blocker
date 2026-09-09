# customBlocker — Vault extension (canonical web-extension source)

> 🤖 **AI protocol:** Read `../package-info.md` (group), the group `AGENTS.md`, and `../misc/project-memory/PROJECT-MEMORY.md` before working here. Update this file when the folder changes. Never delete without owner consent; keep secrets out of git.

- **What:** the Manifest V3 browser extension (public name **Vault extension**) and the **canonical source** every other web surface mirrors from: Safari (`../safariBlocker/build.sh`), the Mac/Windows WebAssets, and the website's Replica (`../blockerWebsite/vendor/ext`).
- **Own git repo:** `Toswapxedzur/custom-blocker`, branch `main`; releases tagged `vX.Y.Z` + `release/vX.Y.Z`. Version source of truth = `manifest.json` (keep `manifest.firefox.json` / `manifest.safari.json` equal).
- **Key files:** `background.js` (service worker, hub client), `content.js` (feed/overlay logic incl. content-based block), `popup.*` (editor UI), `helpers.js` + `event-sandbox.js` (custom-rule engine, also run verbatim inside Mac Vault), `platform-profiles.js`, `local-hub-*.js` (authenticated hub protocol v4), `bridge-protocol.js`.
- **Folders:** `tests/` (run `bash tests/run.sh`, uses macOS `jsc`), `tools/` (`package.py` builds `dist/` zips, icon/locale/promo builders), `scripts/` (translation + documentation audits, custom-rule AI reference generator), `manual/` (20-language in-app manual, `en.md` is source), `translation/` + `_locales/` (UI catalogs), `i18n-docs/` (translated copies of this repo's docs), `templates/`, `icons/`, `promotionpicture/`, `docs/` (internal engineering notes, not localized), `dist/` (built packages).
- **Legal:** `PRIVACY.md` / `TERMS.md` are canonical; the website vendors byte-identical copies.
