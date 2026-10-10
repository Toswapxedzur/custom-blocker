
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
