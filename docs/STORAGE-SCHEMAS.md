# Local storage schemas

Format versions and product releases are independent. The browser editor store
uses `schemaVersion: 7` and `storageMetadata` with `format: vault.web-store`,
`schemaVersion`, `product`, and `writtenByAppVersion`. Ordinary worker startup,
installation and editor reads all enter the same registry. Metadata and migrated
payload keys commit in one storage operation; a failed operation leaves the old
schema and reruns the idempotent migration on retry.

Compatible alpha roots (unversioned or schema 1–6) are imported. Scope lines are
normalized with the current canonical sanitizer; retired flat scope fields do
not survive a browser migration. Runtime usage, pending transfers, receipt IDs,
rule state and unrelated storage keys remain. This is a bounded data import,
not a guarantee for every historical alpha shape or retired feature.

Beginning with the first publicly distributed Beta 1 build, each later public
release must support a direct upgrade from every public version of the same
product released in the preceding rolling 30 days, regardless of version
number. The baseline is protected while it remains in that window. Earlier
alpha data is imported on a best-effort basis, without a compatibility
guarantee. The reader uses `schemaVersion` to choose a transformation; an app
major change alone does not expire one. Release acceptance requires installed
package fixtures for every protected data family and origin in the window;
this registry check alone does not establish compatibility.

Future, malformed and otherwise unsupported schemas reject reads and writes.
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

Schema 4 adds optional credential-free `ruleAI` configuration to custom groups. Older groups remain unconfigured, with their rules, state and usage preserved. Linked groups share the selection, UTC daily cap, saved prompt and saved context. Rule code reads the two saved texts through `v.context.ai` and chooses what to include in each call. Mac Vault owns the private reservation ledger. No keys, pending requests or AI responses enter browser storage automatically.

Schema5 adds `cbRuleAttachments`, a version1 browser-profile document whose `groups` map owns per-content, per-attachment records (`spec` and opaque revision). Reads of unknown/corrupt attachment formats refuse mutations without resetting data. Only the worker writes; one dispatch saves a batch atomically. Disabled groups retain records; deletion removes their namespace. Linked synchronization excludes these records. No executable callback or DOM references are stored.

Schema6 adds `cbRuleRecords`, a version1 group-owned JSON document with caller-chosen
keys, values, versions, opaque revisions and timestamps. It also advances
`cbRuleAttachments` to version2 for passive HTML/CSS view specs; version1 pill
data remains readable and is normalized on the next mutation. Both documents
stay separate from shared link definitions and Classifier state. Unknown or
malformed document versions are preserved; ordinary rules continue while
record/attachment operations report their own storage errors. Group deletion
prunes each group's own namespace. No pending requests or executable markup
are persisted.

Schema7 removes the retired one-model-per-group rule AI selection. Existing
group caps, saved prompts and saved context survive; model and reasoning effort
move to each `v.ai` call. Named conversation transcripts live in the connected
desktop Vault's local files and are not imported into browser storage.
