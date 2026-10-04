# customBlocker — Vault extension (canonical web-extension source)

> 🤖 **AI protocol:** Read `../package-info.md` (group), the group `AGENTS.md`, and `../misc/project-memory/PROJECT-MEMORY.md` before working here. Update this file when the folder changes. Never delete without owner consent; keep secrets out of git.

- **Growing lists (owner 2026-10-01):** the shared `vui-list-box` bounds editor collections without limiting item counts. Group navigation, sites/apps, creator/account filters, Discord targets and tag suggestions scroll inside their containers. `tests/popup-bounded-lists.js` verifies large collections in the actual popup on mini1; the existing driver accepts `--width`/`--height` for viewport coverage.

- **Custom-rule logs (owner 2026-10-01):** the Log panel contains only `v.log()` output, independently retained by immutable group ID (200 entries per rule). Clear and Download operate on the selected rule. Engine errors and collection/transport diagnostics stay in developer diagnostics. Browser feed tests: `customBlocker/tests/runner-rule-log-isolation.js`; native persistence tests: `macosBlocker/Tests/RuleLogShim.test.js`.

- **What:** the Manifest V3 browser extension (public name **Vault extension**) and the **canonical source** every other web surface mirrors from: Safari (`../safariBlocker/build.sh`), the Mac/Windows WebAssets, and the website's Replica (`../blockerWebsite/vendor/ext`).
- **Own git repo:** `Toswapxedzur/custom-blocker`, branch `main`; releases tagged `vX.Y.Z` + `release/vX.Y.Z`. Version source of truth = `manifest.json` (keep `manifest.safari.json` equal).
- **Scopes, phase 1 (2026-09-24):** a stored group is POLICY fields + `scopes` (see `group-scopes.js`: lines of surface site | items | pages | home | shelf, each with one action block | hide | dim). The worker sanitizer migrates every flat/legacy shape once and never writes the flat scope fields back; a flat patch (popup form, MCP) over a stored group still describes the intended lines and wins; a `scopes` patch is sanitized line by line. The worker matches, builds feed filters, surface hides and the whole-site fast path FROM THE LINES; the popup keeps its flat form model and converts at its storage boundary (`toStoredGroups`). `tests/runner-scopes-migration.js` verifies safe stored-state reconciliation; `tests/runner-scopes-union.js` checks current multi-platform policy and independent repeated website entries. The retired pre-scopes worker comparison is removed; isolated source tests require no historical checkout.
- **Site entries may carry a path (2026-09-24):** `youtube.com/shorts`, `reddit.com/r/all` block only that path and everything under it (segment boundary, case-insensitive) on the host and its subdomains; bare hosts are unchanged. Both normalizers keep the path, `siteEntryMatches` is the one matcher (page session, whole-site fast path, redirect target, allowlists). The desktop apps block whole hosts and skip path entries on import with a warning. Test: `tests/runner-site-path-blocking.js`.
- **Platform parity (owner 2026-09-23): YouTube, Reddit and Bilibili are the three full-compatibility platforms, with X/Twitter added the same day (pill, blackout profile, tag filter, custom-rule engine; verified live on x.com/home + a status page in the owner's Chrome); TikTok classification (collector, pills, blackout profile) was deleted by the owner 2026-09-24/25 — TikTok remains a blockable platform only** — per-item pill, feed blackout (since 2026-09-24 EVERY top-most media element of a card is covered — a photo+video tweet or a photo grid leaked the ones after the first; `cbFindMediaAll`/`cbFindPagePlayers`), in-place page blackout, cover-until-tagged, tag filter, AND custom rules (their "items" event carries these platforms' feed items and the page itself). Shared collector core (`vault-classifier-collector-core.js`) follows the native Classifier activation gate and the pill-only `observe` hook for cards without a verifiable source; YouTube keeps its own collector but applies the same gate. Pill lookup (`vaultTagsForCard`) resolves a wrapper element to the one pilled card inside it (Reddit `<article>` → `<shreddit-post>`). Live-verified against bilibili.com on 2026-09-23; reddit.com cannot be opened in the built-in browser, so Reddit relies on the fixture tests + the mini1 rig.
- **Settings over the hub (2026-09-23, MCP 1:1 parity):** Mac Vault relays `browser-request` frames to the service worker; `background.js` `cbHandleBrowserRequest` answers `settings-get` / `settings-create-group` / `settings-set-group` / `settings-delete-group` (`CB_BROWSER_REQUEST_OPERATIONS`) through the popup's own sanitizers (`createDefaultGroup`, `sanitizeGroups`); a frozen / strict / parental group refuses patch + delete exactly as the popup does; the id and the lock are never patchable. Test `tests/runner-extension-settings-ops.js` loads the REAL background.js under a stubbed `chrome.*` (deep-proxy pattern, worth reusing).
- **Key files:** `background.js` (service worker, hub client), `content.js` (feed/overlay logic incl. content-based block), `popup.*` (editor UI), `rule-core.js` (the custom-rule contract both engines run: `(on, v) => {…}`, raw events in, a small action set out, no helper library — owner 2026-09-27; also the supported API described in the separate code manual) + `event-sandbox.js` (the browser's engine, glue around rule-core; Safari runs it inside Safari Vault’s containing app), `platform-profiles.js`, `local-hub-*.js` (authenticated hub protocol v4), `bridge-protocol.js`.
- **Folders:** `tests/` (run `bash tests/run.sh`, uses macOS `jsc`), `tools/` (`package.py` builds `dist/` zips, icon/locale/promo builders), `scripts/` (translation/documentation audits and compact content-catalog generator), `manual/` (in-app user guides; English is the current source), `code-manual/` (separate platform-specific code guides copied by **Copy code docs**), `translation/` + `_locales/` (UI catalogs), `i18n-docs/` (translated copies of this repo's docs), `icons/`, `promotionpicture/`, `docs/` (internal engineering notes, not localized), `dist/` (built packages).
- **Legal:** `PRIVACY.md` / `TERMS.md` are canonical; the website vendors byte-identical copies.

- **UI regression:** `tests/runner-ui.py` runs through the existing extension
  driver’s `--ui-script` hook on mini1. Popup checks use actual chrome APIs;
  tag checks use synthetic transport with the production renderer in Chromium.
  Content tag removal is immediate by click or Delete/Backspace; Classifier
  tree-node deletion still confirms. Pills invert the browser color preference
  via CSS (dark browser → light tags, light browser → dark tags), including
  prediction/Tagging fills. Browser/native timers
  and custom-rule panels use their earlier dark translucent surfaces, with
  readable filled controls; settings and pause pages retain the light theme.

- **Tag chooser regression:** `tests/popup-tag-chooser.js` runs through the
  same driver's `--headed --popup-test` path on mini1. It uses a synthetic
  500-tag catalog and isolated extension storage to check bounded scrolling,
  search, selection through normal draft handlers, focus and dismissal.
  Use `--headed` so the test browser identifies as Chrome and exposes tagging.

- **Follow-up UI regression:** `tests/runner-ui-followup.py` uses the same
  driver hook with the sibling Mac source. It covers remaining dialogs,
  provider confirmation, Activity caret preservation, tag correction/picker
  behavior, and rule HTML/control styling. Captures use `UI_CAPTURE_DIR`.

- **Classifier activation regression:** `tests/browser-classifier-activation.py` uses the existing extension driver `--ui-script` on mini1. A synthetic YouTube page and hub response exercise group creation, pending-to-tag push, pause/hide and resume without reloading. Tagging controls and the retired `extension_set_classifier` tool are removed from the extension; Mac Vault owns activation and Activity owns recording.

- **English terminology:** blocking groups apply policy; Classifier groups assign tags. Source labels use Creators, Accounts, or Communities; Knowledge uses Content sources. Freeze credentials are PINs. `tests/popup-terminology.js` checks snooze labels through the isolated extension driver on mini1. The existing English-plus19 app languages use complete shared catalogs; native dialogs, Info and in-app guides follow the same release batch.

- **Info explanations (2026-10-01):** `vault-info.js` / `vault-info.css` implement click-to-open localized explanations, with explicit data-info sources, one anchored bounded popover, Escape/outside dismissal and language restoration. `tests/popup-info.js` checks real extension behavior at wide/narrow widths on mini1.

- **Field Info (2026-10-02):** 10px blue-gray icons retain a 24px invisible hit area. English field explanations are explicit; built-in settings, names, switches, searches and picker fields use the shared component. Other locales retain inline help.

- **Compact Info (2026-10-02):** 10px icons retain a 24px click area; explanations use 12px text in a softly shaded, 260px-wide popup with tighter padding. English search copy is concise.

- English language/manual regression: `tests/popup-language-manuals.js` checks the separate guides, code-doc copying, safe syntax coloring, matched editor layers, navigation, and Escape in the actual mini1 extension popup.
- List search (owner 2026-10-02): `vault-ui.js` adds local search to marked lists and dropdowns with more than five entries. Queries remain display state; selectors keep their original values/events. `tests/popup-search.js` and `tests/browser-panel-search.py` verify list/dropdown/custom-panel behavior on mini1.
- Remembered group selection: `tests/popup-group-selection.js` exercises the shared editor with Chrome storage or Mac's native shim; `tests/browser-group-selection.py` uses the existing driver to verify real reload/reopen and the worker's + destination.

- Menu layering: `tests/popup-layering.js` checks Settings language hit testing,
  transformed clipping, viewport bounds, fallback layering, and dialog/menu
  Escape order in the actual isolated mini1 extension.

- `tests/popup-list-performance.js`: isolated 10,000-entry rendering/search/page/timer regression through the existing extension driver. `VaultUI.renderList` bounds DOM rows while retaining complete stored collections.

- Growing-list performance: shared editable lists/chips use 40-row pages with
  complete backing data and cooperative full-list search. Long selects keep a
  complete option model while mounting one backing option and 40 menu results.
  Feed collectors/filtering process changed card roots in 32-card batches;
  navigation/policy changes still require full scans. Taxonomy transport pages
  all tags; attached content tags retain their separate 16-tag limit. Browser
  panels construct cooperatively and defer offscreen paint. Timer rows are
  reused and remain click-through. No constant-time total-data claim.
- Icon redesign base (owner 2026-10-02): `tools/branding/vault-shield-base.svg`
  preserves the exact current Mac Vault background and shield finish, with
  only the complete shield scaled 1.10. Platform symbols compose separately;
  installed icons remain unchanged during this base-review stage.

- Functional filter regressions: `tests/popup-functional-fixes.js` and `tests/popup-tag-chooser.js` run through the canonical mini1 driver. Repeated Applied Website entries have stable `entryID` values and independent filters; tool flat patches require that ID when ambiguous. `runner-scopes-union.js` covers migration and shared-budget enforcement. `runner-vault-classifier-tag-ui-none.js` covers immediate recognition, Untagged failures, stale pushes and recycled Reddit roots.

- Timer HUDs mount one viewport-sized page, rotate automatically every five seconds, reserve countdown width, and remain fully click-through. Custom row styles are measured when choosing the page.

- Release scope (owner 2026-10-04): Vault extension supports Chromium-family browsers only. Safari Vault remains a separate native product built from the shared source. Firefox packaging and its in-page rule sandbox are retired.
