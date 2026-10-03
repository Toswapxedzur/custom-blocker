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

## Prerequisites
All testing runs on mini1, using an isolated extension copy. Its verified
interpreter is `~/agentic-tooling-test-env/bin/python` (Playwright + Chromium).
Do not launch test browsers on the owner's laptop.

## Run (agent path)
```bash
ssh mini 'cd ~/vault-ext && ~/agentic-tooling-test-env/bin/python .claude/skills/run-customblocker/driver.py --hold 6'
```
Prints the SW URL + extension id, then **`evaluate-in-SW OK`** (manifest name/version/id) —
that line is the definitive "extension loaded + SW reachable" proof — then streams any
`[SW console.*]` lines for `--hold` seconds. Exit `0` = SW found; `2` = no SW (extension
failed to load — check `manifest.json` / import errors).

Run code inside the service worker (Promises are awaited):
```bash
~/agentic-tooling-test-env/bin/python .claude/skills/run-customblocker/driver.py --hold 3 --eval "() => chrome.storage.local.get(null)"
```
Options: `--headed` (visible Chromium — fallback if the SW never appears headless);
`--hold N`; env `PROFILE=<dir>` (reuse a profile to test `chrome.storage` persistence);
env `EXT_DIR=<dir>` (load a different unpacked extension, e.g. `casinoMalwareExtension`).

For an isolated Windows guest browser launched by a separate fixture, reuse
this driver on mini1 with `--connect-cdp http://127.0.0.1:<forwarded-port>`.
Pass `--extension-id` to select Vault when the browser also has built-in workers.
It attaches to the existing default context, closes only pages it created,
and leaves the remote browser/profile shutdown to its fixture launcher.
The ordinary launch path remains unchanged. Do not attach to a personal profile.

## Gotchas (verified 2026-09-10)
- **A healthy SW is quiet.** `background.js` gates its logging behind `cbDebugMode`
  (`cbDebugLog/Warn/Error`), so `captured 0 SW console line(s)` is NORMAL. Judge load
  success by `evaluate-in-SW OK`, not console volume.
- Real failures DO print: `service-worker.js` is a thin `importScripts("background.js")`
  loader logging `[CustomBlocker] background worker failed to start`; `background.js` logs
  `[CustomBlocker] importScripts(<file>) failed` per module → appear as `[SW console.error]`.
- Early startup logs can race the console listener — another reason evaluate-in-SW is the proof.
- Fresh temp profile each run ⇒ `chrome.storage.local` starts `{}`. Set `PROFILE=` to persist.
- The development extension id (`fjichnkbaoilbfbjcjkggllmbicmeegk`) derives from the public development manifest key supplied only to the isolated test copy. Production uses its own key and identity.
- `manifest.json` has `"name": "__MSG_appName__"`, but `chrome.runtime.getManifest().name`
  returns the localized "Adamancia Vault — Website Blocker & Focus Timer".
- Headless works with `channel="chromium"` (new headless); no window pops.

## Also registered: chrome-devtools-mcp (raw CDP)
User-scope in `~/.claude.json` → `mcpServers.chrome-devtools` (`npx -y chrome-devtools-mcp@latest`,
v1.9.0). Exposes CDP to agents: targets incl. extension service workers, console, evaluate,
network, perf traces. Loads at session start — **reload the session to get its tools**; not yet
exercised in a session. Use it to attach to a Chrome already running the extension
(e.g. real Chrome launched with `--remote-debugging-port=9222`).
