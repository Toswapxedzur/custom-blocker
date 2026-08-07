# YouTube collaboration cards

How the Vault Classifier collector handles YouTube videos credited to more than
one channel ("collaboration" videos, e.g. *"Mark Rober and Cristiano"*,
*"Cleo Abram and Mark Rober"*, *"Atlas Arcade and Animated Subtitles"*).

## Summary

Collaboration cards **expose no creator link in the rendered DOM**. Normal cards
carry an `/@handle` or `/channel/UC…` anchor that `findSource` reads to form a
stable creator id; collaboration cards render the collaborators as **unlinked
text** and carry no channel id anywhere in the page we can scrape. Because we
never identify a creator by display name for the primary path (YouTube display
names are not unique), a collaboration card produces **no `sourceID`**, so before
this change it was silently skipped — no pill, no collection.

We now add a **best-effort, name-based fallback** used *only* when a card exposes
no linked identity: the collector forwards the byline display names, and the app
matches them against the user's **already-approved** classifications by name.

## What the DOM actually exposes (evidence)

Inspected a live feed collaboration card ("Atlas Arcade and Animated Subtitles",
a `ytd-rich-item-renderer`) via read-only DOM probes:

- **Byline:** the collaborators are plain `<span>` text inside
  `yt-content-metadata-view-model` → first `.ytContentMetadataViewModelMetadataRow`:
  `"Atlas Arcade and Animated Subtitles"`.
- **`allHrefs`:** only the two `/watch?v=…` video links. **No** `/@handle`, **no**
  `/channel/UC…`.
- **`avatarLink`:** `null` — the combined collaborator avatar is a bare `<div>`,
  not an anchor.
- **`anyUCAnywhereInHTML`: `[]`** — there is **no `UC…` channel id anywhere** in
  the card's entire `outerHTML`: not in an `href`, not in any attribute, not in
  any `data-*`.
- Normal cards rendered right next to it *do* expose a handle
  (`/@johnnyharris`, `/@MrBeast`, `/@GothamChess`). Collaboration cards do not.

**Conclusion:** for collaborations, YouTube keeps the per-creator navigation
target only in its closed Polymer/attributed-string view-model state, never as a
scrapable anchor or token in the rendered DOM. No `a[href]` selector can recover
it. This is a YouTube rendering choice, not a selector we are missing.

The only stable, scrapable identifiers on a collaboration card are:

- the **video id** (`/watch?v=…`), and
- the collaborators' **display names** (unlinked text).

The linked owner *is* available on the **watch page** (`ytd-watch-metadata`), so
collaboration videos are still captured/classified once opened — only the feed
card cannot resolve a creator id.

## The fallback

Triggered strictly when `resolveCardSource(card)` yields no `id` (i.e. no
`/@handle`, no `/channel/UC…`, and not a channel page).

### Extension (`vault-classifier-youtube.js`)

- `collabCreatorNames(card)` reads the first metadata row of
  `yt-content-metadata-view-model` (fallback: `#channel-name #text` etc.) and
  splits it into names on `,`, `·`, and ` and `. It refuses rows that look like a
  stats line (`… views`, `… ago`, `watching`) or a single-creator row (no
  separator), so name matching never fires on non-collaboration content.
- `collectCard`'s no-id branch observes the card under a **synthetic, per-video
  id** — `youtube:collab:<videoID>` — so the pill state stays stable per card
  (dedup, reattach, recycle all keep working), and forwards `creatorNames` for
  matching. It also passes `creatorName` (the joined names) for the local-name
  diagnostic mode.

### Transport

`TagUI.observe → request()` includes `creatorNames` in the
`vault-classifier-source-tags` message only when present. The bridge
(`vault-classifier-bridge.js`) cleans them (`contract.cleanCreatorNames`, bounded
to 4 names ≤120 chars each, de-duplicated) and forwards them in the
`source-tags` hub request body. Older payloads without the field decode fine.

### App (`VaultClassifierCore`)

- `NativeSourceTagsRequest` gains `creatorNames: [String]` (crash-guarded
  `decodeIfPresent`; validated to ≤4 non-empty names ≤120 chars).
- `LocalClassifierCoordinator.sourceTags(platformID:sourceID:creatorNames:)`
  computes the linked-id tags first; **only if that is empty** and names are
  present does it call the name fallback.
- `WorkspaceNeuralClassifier.sourceTags(platformID:anyOfCreatorNames:)` returns
  the tags of the **first approved classification** whose `creatorName` equals a
  supplied name (case-insensitive, whitespace-trimmed), then projects that
  creator's tags through the normal, fully-filtered `sourceTags(sourceID:)` path.

## Semantics & limitations (by design)

- **Approved only.** Only `review == .approved` classifications match. Unclassified
  or pending creators produce no pill.
- **Name collisions → pick any.** Display names are not unique. If two approved
  creators share a name, the first match wins. In practice collisions among a
  single user's own classified creators are rare.
- **Never widens the linked path.** The fallback runs only when the linked id
  resolves nothing, so a normal, linked card's behavior is unchanged.
- **Per-video keying.** The pill is keyed by `youtube:collab:<videoID>`, not by a
  creator id (there is none), so it is stable for that card but does not
  participate in creator-identity aliasing.
- **Feed only needs this.** On the watch page the linked owner resolves normally;
  the fallback is for the link-less feed/search grid.

## Tests

- Extension: `tests/runner-vault-classifier-youtube-collab.js` — a link-less
  collaboration card is observed under `youtube:collab:<videoID>` with both
  collaborator names forwarded.
- App: `testSourceTagsMatchByCreatorNameForLinklessCollaborationCards` — a byline
  name matching an approved classification projects its tags (case-insensitive);
  pending/unknown/empty names resolve nothing.
