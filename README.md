# Vault extension

Vault extension is a Manifest V3 focus tool for Chromium browsers. Its current editor manages website block groups, supported-platform groups, Custom JavaScript groups, schedules, freeze and snooze controls, and optional web-app bridge links.

The source code is the product contract. The English in-app manual at [manual/en.md](manual/en.md) explains the shipped controls; it replaces the previous copied and machine-translated manuals.

## Current capabilities

- Default website groups with blocklist or allowlist behavior, optional redirect, immediate blocking, time allowance, or countdown.
- Dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X.
- Platform-specific filters and optional hide-element controls where the current platform profile supports them.
- Custom JavaScript groups with syntax checking, templates, run controls, a controlled runtime, and a log feed.
- Per-group schedules, freeze modes, snooze controls, import/export, and automatic save.
- Optional local-folder access for supported Custom-rule text, CSV, and JSON operations.
- Optional connection to a native Vault bridge hub for explicitly linked groups.

## Run locally

1. Open `chrome://extensions` in a Chromium browser.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this repository folder.
4. Open the Vault extension and create a group.

The manifest requires Chrome 116 or later for its current offscreen and rule APIs.

## Development checks

Run the extension test suite from this folder:

```bash
./tests/run.sh
```

The suite exercises helper behavior, platform profiles, Markdown rendering, and the translation catalog audit.

## Localized manuals and translations

The English documents remain the canonical source. The extension ships its localized manuals beside `manual/en.md`, and the localized copies of other maintained documents live under `i18n-docs/<locale>/`.

The UI catalogs in `translation/*.json` are complete for every supported locale. Verify the catalogs and localized documents with:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Scope

Vault extension only acts in the browser profile where it is installed and on pages the browser grants it access to. It does not install native apps, change system permissions, or synchronize groups unless the user explicitly connects a bridge and links matching groups.
