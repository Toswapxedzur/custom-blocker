
- `runner-storage-schema.js` exercises guarded real storage API methods with
  disposable data: app-major expiry, alpha import, failed commits/retry, callback
  errors, idempotence and future-schema protection for all write methods.

- `runner-first-link.js` exercises original definition/usage capture, consecutive
  and interrupted snapshots, receipts, retries/restart, rolling buckets, second
  browsers, empty scope contributions and serialized slow storage adoption.

- `runner-definition-storage-order.js` exercises the actual worker storage listener
  with Chrome-reordered object properties, preserving real scalar edits, entry and
  group deletions, array order, and value types across browser program identities.

- `runner-rule-initial-state.js` checks initialization-only custom-rule memory, repeated Run/restart persistence, registration validation, and stale group deletion.

- `browser-tag-panel-focus.js` loads the real closed-shadow renderer in an isolated
  Playwright context: a clipped ancestor tests opening without focus-induced
  scrolling only; a separately named visible-input fixture tests typing, Escape
  focus return, outside click, and genuine user scroll. Clipped typing remains a
  separate retained negative. Its caller owns browser/profile cleanup.

The focus regression is a Node Playwright **context callback**, not a second
extension driver. Call it from the existing bounded Mini2 offline supervisor;
its `probe.mjs` owns the browser and its `run-probe.py` owns resource/process and
profile cleanup. The validated invocation (on Mini2 alt1) is:

```sh
VAULT_TAGFOCUS_FIXTURE_ALLOCATED=old-new-regression /usr/bin/python3 /Users/john.zhu.alt1/Desktop/agentic/precise-native-live-40f8728-20261011/tag-panel-focus-regression-v2-20261012T103231Z/run-probe.py
```

The supervisor pins both source directories and the callback, requires the old
renderer to fail with a trusted H3 scroll and closed panel, then requires the
candidate's separately named fixtures to pass. The Node caller is:

```js
const run = require(extensionDir + "/tests/browser-tag-panel-focus.js");
const observations = await run(ownedPlaywrightContext, extensionDir);
```

Use an isolated owned context; close it and remove its profile after the callback.
The earlier full-clipped typing failure remains a separate negative. Passing the
opening-only fixture does not certify typing or row visibility in a clipped title.
The current actual YouTube replay must check search typing and row hit geometry.
