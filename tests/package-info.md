
- `runner-storage-schema.js` exercises guarded real storage API methods with
  disposable data: app-major expiry, alpha import, failed commits/retry, callback
  errors, idempotence and future-schema protection for all write methods.

- `runner-first-link.js` exercises original definition/usage capture, consecutive
  and interrupted snapshots, receipts, retries/restart, rolling buckets, second
  browsers, empty scope contributions and serialized slow storage adoption.

- `runner-definition-storage-order.js` exercises the actual worker storage listener
  with Chrome-reordered object properties, preserving real scalar edits, entry and
  group deletions, array order, and value types across browser program identities.

- `runner-rule-initial-state.js` checks initialization-only custom-rule memory, repeated Run/restart persistence, registration validation, stale group deletion, and a held reconciliation overlapping Runs of different rules. Its actual loader and reconciler share the same lexical snapshot; another rule's Run must not repeat initialization.

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

- `browser-tag-panel-placement.js` is the real DOM placement/lifecycle context
  callback: full clipped input/row hits, visible dismissal behavior, transformed
  or filtered card/body/html ancestors, real paging/dismiss buttons, edge clamp/flip, removed subtree/remount
  ownership, and retired asynchronous taxonomy. A caller supplies the same
  pinned `targetHitGeometry` used by the actual replay and exact selected-owner
  control lookup. The document-root portal escapes body transforms, filters and
  paint containment; the old body portal's measured anchor offset is a separate
  regression. Capability-absent HTML paint containment remains an explicit
  clipping limitation, not usable input acceptance. The bounded Mini2 supervisor owns normal context/profile
  cleanup; source review and actual execution are separate.

- `runner-tag-host-registration.js` exercises the actual private WeakSet and
  captured-navigation helper: a live correction host is exempt, then removal
  revokes that exemption without reviving a retired host when a new one mounts.

The placement callback uses the same established bounded Node supervisor. Its
validated Mini2 alt1 invocation is:

```sh
VAULT_PLACEMENT_FIXTURE_ALLOCATED=headless-dom /usr/bin/python3 /Users/john.zhu.alt1/Desktop/agentic/precise-native-live-40f8728-20261011/tag-panel-placement-rootportal-bound-20261012T133206Z/run-probe.py
```

Run inside the owned UID 503 Aqua session. The supervisor binds installed Chrome
154.0.8037.99, all source/helper files, a disposable profile, a 60-second total
limit, and normal context/profile cleanup. Its existing Node caller supplies:

```js
const run = require(extensionDir + "/tests/browser-tag-panel-placement.js");
const observations = await run(ownedPlaywrightContext, extensionDir, {
  targetHitGeometry,
  selectedOwnedPanelControl
});
```

The validated campaign checks six hit-coordinate controls, two input UA-shadow
controls, genuine old clipped/fixed-only failures, the old body portal's measured
anchor offset, 19 candidate placement/ownership/paging/lifecycle scenes, and the
six focus controls. The capability-absent HTML paint-containment case is a
measured clipping limitation, not usable input acceptance. This is headless
Chrome DOM verification; headed YouTube behavior and native Safari/WebKit
acceptance remain separate and pending. No second driver or runtime is required.

- `runner-rule-delivery-ack.js`: actual extracted worker/content ACK and bounded pending queue regression, with inert Node page/APIs. Partial click/query failures, missing/malformed ACK and closed response ports report per-rule `page-error` without replay; proven absent receiver retains the existing targeted queue. Successful ACK, broadcast boundaries and shared-batch attribution are covered. Registered in `tests/run.sh`; execute only on the owner-designated Mini2 test host.

- `runner-rule-time.js`: named timer lifecycle/panel/persistence and rolling usage scenarios, including overlap, expiry and invalid-state refusal.

- `runner-rule-time-shared.js`: shared merge, overlap, receipts, join barriers, disconnects and capacity refusal.
- `runner-rule-time-client.js`: bounded authenticated time transport, reconnect/stale response and payload privacy controls.

- `runner-rule-time-save.js`: saved-completion-before-action ordering, failed write recovery and exactly-once retry.

- `runner-rule-handler-errors.js`: real RuleCore handler exceptions reach the production per-rule error Log feed with debug OFF; stale replies stay excluded and failed state/save paths cannot replay actions.
