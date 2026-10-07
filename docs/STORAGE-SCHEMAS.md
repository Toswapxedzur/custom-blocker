# Local storage schemas

Format versions and product releases are independent. The browser editor store
uses `schemaVersion: 3` and `storageMetadata` with `format: vault.web-store`,
`schemaVersion`, `product`, and `writtenByAppVersion`. Ordinary worker startup,
installation and editor reads all enter the same registry. Metadata and migrated
payload keys commit in one storage operation; a failed operation leaves the old
schema and reruns the idempotent migration on retry.

Compatible alpha roots (unversioned or schema 1–2) are imported. Scope lines are
normalized with the current canonical sanitizer; retired flat scope fields do
not survive a browser migration. Runtime usage, pending transfers, receipt IDs,
rule state and unrelated storage keys remain. This is a bounded data import,
not a guarantee for every historical alpha shape or retired feature.

Migration retention follows each product's app major, taken from its manifest,
not this document's schema number. A transformation from the preceding app
major remains supported. Older transformations may expire at major 3 or 4 for
app-major-1 data; this implementation uses the earliest allowed boundary, major
3. A current, identical schema needs no transformation. Compatible alpha intake
is retained through the major following its introduction (browser/Safari 3,
Mac 2, Windows 0); delete expired import code when those product majors advance.
Sequential major upgrades are the supported data-preservation path.

Future/invalid schemas and expired transformations reject reads and writes.
The destination is checked again for each operation, so an editor or background
counter cannot reset a newer store to an empty default. Callback callers get
`runtime.lastError`; promise callers get a rejected promise. Metadata belongs to
the registry, including after clear/remove. Chrome storage operations serialize
within each context; Chrome has no cross-context compare-and-swap transaction.
The native hosts also guard their authoritative file independently.

Bump a schema only when its data format changes. Add and test the transformation,
including interrupted writes, restart/idempotence, existing rules/locks/usage,
and future-schema preservation. Bumping an app version does not bump storage.
A release still requires separate publication authorization; these private
changes do not rename the existing alpha builds to beta.
