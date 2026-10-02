#!/usr/bin/env python3
"""driver.py — load the customBlocker MV3 extension into Chromium (Playwright) and read
its background service-worker console / evaluate JS inside the SW context.

  python3 driver.py                  # headless (new headless), stream SW console ~8s
  python3 driver.py --headed         # visible Chromium (fallback if no SW appears headless)
  python3 driver.py --eval "() => chrome.storage.local.get(null)"   # run code IN the SW
  python3 driver.py --popup-test tests/popup-rule-logs.js --hold 0
  python3 driver.py --connect-cdp http://127.0.0.1:9333 --eval "() => chrome.runtime.id"
  python3 driver.py --hold 30        # keep the browser open N seconds (default 8)
Env: EXT_DIR=<dir> to load a different unpacked extension; PROFILE=<dir> to reuse a profile.
Exit 0 = service worker found; 2 = no service worker (extension failed to load).
"""
import argparse, os, runpy, shutil, sys, tempfile, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
# driver lives at <ext>/.claude/skills/run-customblocker/ -> extension root is 3 levels up
EXT = os.path.abspath(os.environ.get("EXT_DIR") or os.path.join(HERE, "..", "..", ".."))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--connect-cdp", help="Attach to an already running isolated test browser; its launcher owns shutdown")
    ap.add_argument("--extension-id", help="Select the target worker when the remote browser includes built-in extensions")
    ap.add_argument("--eval", default=None)
    ap.add_argument("--ui-script", help="Python script exporting run(context, service_worker) for UI checks")
    ap.add_argument("--popup-test", help="JavaScript file containing an async popup regression function")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--hold", type=float, default=8)
    a = ap.parse_args()
    profile = None if a.connect_cdp else os.environ.get("PROFILE") or tempfile.mkdtemp(prefix="cb-profile-")
    print(f"[driver] extension: {EXT}")
    print(f"[driver] remote CDP: {a.connect_cdp}" if a.connect_cdp else f"[driver] profile:   {profile}  headless={not a.headed}", flush=True)
    seen = []
    failed = False

    def on_console(msg):
        line = f"[SW console.{msg.type}] {msg.text}"
        seen.append(line); print(line, flush=True)

    def attach(sw):
        print(f"[driver] service worker: {sw.url}", flush=True)
        sw.on("console", on_console)

    with sync_playwright() as p:
        if a.connect_cdp:
            browser = p.chromium.connect_over_cdp(a.connect_cdp)
            if not browser.contexts:
                raise RuntimeError("Remote test browser has no default context")
            ctx = browser.contexts[0]
        else:
            ctx = p.chromium.launch_persistent_context(
                profile, channel="chromium", headless=not a.headed,
                args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"],
            )
        original_pages = set(ctx.pages)
        try:
            ctx.on("serviceworker", attach)          # future SWs
            for sw in ctx.service_workers: attach(sw) # SWs already up
            if a.connect_cdp and a.extension_id and not any(sw.url.startswith(f"chrome-extension://{a.extension_id}/") for sw in ctx.service_workers):
                # An existing MV3 worker may be suspended. Opening its owned popup
                # wakes it without reloading/unloading the extension or browser.
                wake_page = ctx.new_page()
                wake_page.goto(f"chrome-extension://{a.extension_id}/popup.html")
            if not any(not a.extension_id or sw.url.startswith(f"chrome-extension://{a.extension_id}/") for sw in ctx.service_workers):
                try:
                    ctx.wait_for_event("serviceworker", predicate=lambda sw: not a.extension_id or sw.url.startswith(f"chrome-extension://{a.extension_id}/"), timeout=15000)
                except Exception as e:
                    print(f"[driver] NO service worker within 15s: {e}", file=sys.stderr)
            sws = [sw for sw in ctx.service_workers if not a.extension_id or sw.url.startswith(f"chrome-extension://{a.extension_id}/")]
            if a.connect_cdp and not a.extension_id and len(sws) > 1:
                raise RuntimeError("Remote browser has multiple extensions; specify --extension-id")
            if sws:
                sw = sws[0]
                print(f"[driver] extension id: {sw.url.split('/')[2]}")
                try:   # definitive proof we can execute inside the SW context
                    info = sw.evaluate("""() => ({ name: chrome.runtime.getManifest().name,
                        version: chrome.runtime.getManifest().version, id: chrome.runtime.id })""")
                    print(f"[driver] evaluate-in-SW OK: {info}", flush=True)
                except Exception as e:
                    print(f"[driver] evaluate-in-SW FAILED: {e}", file=sys.stderr)
                if a.eval:
                    try:    print(f"[driver] --eval => {sw.evaluate(a.eval)}", flush=True)
                    except Exception as e: print(f"[driver] --eval FAILED: {e}", file=sys.stderr)
                if a.ui_script:
                    runpy.run_path(a.ui_script)["run"](ctx, sw)
            if sws and a.popup_test:
                try:
                    # Give the freshly created offscreen document time to register its relay.
                    sw.evaluate("async () => await ensureOffscreenDocument()")
                    page = ctx.new_page()
                    page.set_viewport_size({"width": a.width, "height": a.height})
                    page.on("pageerror", lambda error: print(f"[popup error] {error}", flush=True))
                    page.goto(f"chrome-extension://{sw.url.split('/')[2]}/popup.html")
                    deadline = time.monotonic() + 10
                    while not page.evaluate("() => typeof render === 'function' && typeof state === 'object'"):
                        if time.monotonic() > deadline:
                            raise RuntimeError("Popup renderer did not initialize")
                        time.sleep(0.05)
                    page.wait_for_timeout(1000)
                    with open(a.popup_test, encoding="utf-8") as test_file:
                        result = page.evaluate(test_file.read())
                    print(f"[driver] popup-test OK: {result}", flush=True)
                except Exception as error:
                    failed = True
                    print(f"[driver] popup-test FAILED: {error}", file=sys.stderr)
            time.sleep(a.hold)
        finally:
            if a.connect_cdp:
                # Only pages created by this invocation belong to the driver. The
                # guest launcher owns its browser/profile and its final shutdown.
                for page in ctx.pages:
                    if page not in original_pages:
                        page.close()
            else:
                ctx.close()
    if profile is not None and not os.environ.get("PROFILE"):
        shutil.rmtree(profile)
    print(f"[driver] captured {len(seen)} SW console line(s)")
    return 1 if failed else (0 if sws else 2)

if __name__ == "__main__":
    sys.exit(main())
