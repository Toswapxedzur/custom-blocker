#!/usr/bin/env python3
"""driver.py — load the customBlocker MV3 extension into Chromium (Playwright) and read
its background service-worker console / evaluate JS inside the SW context.

  python3 driver.py                  # headless (new headless), stream SW console ~8s
  python3 driver.py --headed         # visible Chromium (fallback if no SW appears headless)
  python3 driver.py --eval "() => chrome.storage.local.get(null)"   # run code IN the SW
  python3 driver.py --hold 30        # keep the browser open N seconds (default 8)
Env: EXT_DIR=<dir> to load a different unpacked extension; PROFILE=<dir> to reuse a profile.
Exit 0 = service worker found; 2 = no service worker (extension failed to load).
"""
import argparse, os, sys, tempfile, time
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
# driver lives at <ext>/.claude/skills/run-customblocker/ -> extension root is 3 levels up
EXT = os.path.abspath(os.environ.get("EXT_DIR") or os.path.join(HERE, "..", "..", ".."))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--eval", default=None)
    ap.add_argument("--hold", type=float, default=8)
    a = ap.parse_args()
    profile = os.environ.get("PROFILE") or tempfile.mkdtemp(prefix="cb-profile-")
    print(f"[driver] extension: {EXT}")
    print(f"[driver] profile:   {profile}  headless={not a.headed}", flush=True)
    seen = []

    def on_console(msg):
        line = f"[SW console.{msg.type}] {msg.text}"
        seen.append(line); print(line, flush=True)

    def attach(sw):
        print(f"[driver] service worker: {sw.url}", flush=True)
        sw.on("console", on_console)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            profile, channel="chromium", headless=not a.headed,
            args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"],
        )
        ctx.on("serviceworker", attach)          # future SWs
        for sw in ctx.service_workers: attach(sw) # SWs already up
        if not ctx.service_workers:
            try:
                ctx.wait_for_event("serviceworker", timeout=15000)
            except Exception as e:
                print(f"[driver] NO service worker within 15s: {e}", file=sys.stderr)
        sws = ctx.service_workers
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
        time.sleep(a.hold)
        ctx.close()
    print(f"[driver] captured {len(seen)} SW console line(s)")
    return 0 if sws else 2

if __name__ == "__main__":
    sys.exit(main())
