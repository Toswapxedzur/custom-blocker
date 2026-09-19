---
name: run-customblocker
description: Run and debug the customBlocker MV3 Chrome extension (Adamancia Vault) — launch Chromium with the unpacked extension via Playwright, read the background service-worker console, and evaluate JS inside the service worker. Use when asked to run, test, debug, load, or check the customBlocker extension, its service worker, or chrome.storage.
---

# Run / debug customBlocker (MV3 extension)

Paths are relative to `customBlocker/` (this extension's root). Driver:
`.claude/skills/run-customblocker/driver.py` — Python Playwright, `channel="chromium"`,
extension loaded via `--load-extension`, headless (new headless) by default.

This is the **only wired way to see the MV3 service-worker context**: the Claude Browser
pane can't load extensions, and Claude-in-Chrome is page-scoped (page console only).

## Prerequisites (already present on this Mac)
- Python Playwright + Chromium 1148 in `~/Library/Caches/ms-playwright/`.
- Interpreter that has playwright: `/Library/Frameworks/Python.framework/Versions/3.13/bin/python3`

## Run (agent path)
```bash
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 .claude/skills/run-customblocker/driver.py --hold 6
```
Prints the SW URL + extension id, then **`evaluate-in-SW OK`** (manifest name/version/id) —
that line is the definitive "extension loaded + SW reachable" proof — then streams any
`[SW console.*]` lines for `--hold` seconds. Exit `0` = SW found; `2` = no SW (extension
failed to load — check `manifest.json` / import errors).

Run code inside the service worker (Promises are awaited):
```bash
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 .claude/skills/run-customblocker/driver.py --hold 3 --eval "() => chrome.storage.local.get(null)"
```
Options: `--headed` (visible Chromium — fallback if the SW never appears headless);
`--hold N`; env `PROFILE=<dir>` (reuse a profile to test `chrome.storage` persistence);
env `EXT_DIR=<dir>` (load a different unpacked extension, e.g. `casinoMalwareExtension`).

## Gotchas (verified 2026-09-10)
- **A healthy SW is quiet.** `background.js` gates its logging behind `cbDebugMode`
  (`cbDebugLog/Warn/Error`), so `captured 0 SW console line(s)` is NORMAL. Judge load
  success by `evaluate-in-SW OK`, not console volume.
- Real failures DO print: `service-worker.js` is a thin `importScripts("background.js")`
  loader logging `[CustomBlocker] background worker failed to start`; `background.js` logs
  `[CustomBlocker] importScripts(<file>) failed` per module → appear as `[SW console.error]`.
- Early startup logs can race the console listener — another reason evaluate-in-SW is the proof.
- Fresh temp profile each run ⇒ `chrome.storage.local` starts `{}`. Set `PROFILE=` to persist.
- Unpacked-extension id (`fjichnkbaoilbfbjcjkggllmbicmeegk`) derives from the folder path — stable while the path is.
- `manifest.json` has `"name": "__MSG_appName__"`, but `chrome.runtime.getManifest().name`
  returns the localized "Adamancia Vault — Website Blocker & Focus Timer".
- Headless works with `channel="chromium"` (new headless); no window pops.

## Also registered: chrome-devtools-mcp (raw CDP)
User-scope in `~/.claude.json` → `mcpServers.chrome-devtools` (`npx -y chrome-devtools-mcp@latest`,
v1.9.0). Exposes CDP to agents: targets incl. extension service workers, console, evaluate,
network, perf traces. Loads at session start — **reload the session to get its tools**; not yet
exercised in a session. Use it to attach to a Chrome already running the extension
(e.g. real Chrome launched with `--remote-debugging-port=9222`).
