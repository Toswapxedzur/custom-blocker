# Vault browser extension code manual

[User manual](../manual/en.md)

## Rule contract

Source: one function expression `(on, v) => { ... }`. Only synchronous JavaScript and the API below are supported; no timers, network, extension APIs or direct DOM access. Time-based rules use `ev.now` and events.

- Editing saves a draft; **Run** activates it and enables the group. Frozen groups cannot Run. Empty source unloads the rule.
- Successful Run replaces handlers and panels, preserving `v.state`. Compilation/registration failure keeps the previous rule; a timeout can stop it. Reloading the engine registers the last activated source again; closure variables reset.
- Registration may initialize state, register handlers, show panels and log. Page/file actions and emits belong in handlers; their registration-time queue is discarded.
- Disable suppresses handlers and lifts managed panels, sheets, covers and item verdicts. Enable restores retained panels/sheets and requests items again. Run does not clear existing sheets, covers or item verdicts. Delete removes the rule and its state/effects. Navigation, DOM mutations and file writes are not undone.
- Events are not restricted by ordinary group targets; filter URLs/items in the rule. Actions are queued, then applied after dispatch. Exceptions stop that handler without rolling back its state/actions; later handlers may still run. No action acknowledgement exists except file/query events.

## Shared API

- `on(type, handler)` → boolean. Registers `handler(ev)`; multiple handlers run in registration order. False means invalid arguments or handler limit reached. `ev = { type: string, now: number, data }`; `now` is Unix milliseconds.
- `v.state`: mutable JSON object, persisted after event dispatch. Initialize missing fields rather than overwriting existing state. Assigning a non-object or array resets it to `{}`; nonserializable/oversized updates are not persisted.
- `v.log(...values)`: the only producer of this group's Log. Logs/Clear are independent per group. Load errors appear in Run status; handler diagnostics do not populate Log.
- `v.emit(type, data)`: queues a JSON copy of `data` for this group's handlers after the current event, with a fresh `now`; not a synchronous call.
- `v.panel(id, spec, tabId?)`: replaces this group's named panel; omit `tabId` for every accessible web page, or use an integer tab ID. Null `spec` removes it. See Panels.
- `v.file(op, path, payload?)` → request ID string. See Files.

Other shared calls return `undefined`. IDs/state belong to one group, not its display name.

## Browser events

Payload notation below describes types; it is not executable code. `?` marks optional fields.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` is approximate; use timestamps, not tick counts. `active` means selected within a browser window, not proof the user is looking at it. URLs may be empty/restricted.
- `visible` comes from accessible, non-hidden pages; `elapsedMs` is time since their last heartbeat, zero while covered. It is not accumulated usage or playback time.
- `items` reports new/changed supported feed items, and resends them after Run/re-enable. `ref` identifies a card on that page, not a durable content ID; `ref === "page"` denotes the page itself. Empty titles/URLs/authors are possible. `authors` contains platform-specific source identifiers.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Item availability depends on the page's supported markup.
- Tags require the connected desktop Classifier and a tagging-enabled build/platform (Chromium and Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence is 1–5. `tagsSettled === false` is pending/unavailable, not untagged; settled `tags: []` is untagged. Firefox builds do not provide this tagging integration.
- `snooze` means the group's Snooze button was pressed. It applies no pause by itself.
- Query/file replies target the requesting group. Correlate `requestId`, check `error`/`ok`, and set a deadline using ticks: replies can be lost when a page closes, the engine reloads or the group is disabled. Request IDs can repeat after Run; pending requests are not durable work.

## Browser actions

Integer `tabId` must come from an event. Page actions require a page where Vault has access; internal browser pages are unavailable. Invalid inputs/unavailable targets generally produce no effect.

- `v.item(tabId, ref, verdict)`: `"hide"` removes a feed card, `"dim"` covers its media, `"allow"` exempts it from lower groups, `null` clears this group's verdict. Unknown refs do nothing; use `v.cover` for `isPage`. Verdicts follow group-list order: higher hide wins; higher dim survives lower allow; allow prevents lower verdicts. A recycled/removed card needs a new decision.
- `v.cover(tabId, on, message?)`: true covers the page, false lifts its custom cover; message defaults to empty (max 500 characters). One custom-cover slot per page; the last applied cover call wins, irrespective of group order. Address changes lift it; ordinary blocking may still cover the page.
- `v.go(tabId, target)`: an HTTP(S) URL or `"back"`, `"forward"`, `"reload"` (target max 4096 characters).
- `v.close(tabId)`: closes the tab.
- `v.css(tabIdOrStar, id, css)`: integer tab ID or `"*"`; replace the group's sheet with that ID, or remove with null. Tab sheets end on address change; `"*"` sheets reach future pages. ID max 80, CSS max 100000 characters.
- `v.dom(tabId, selector, op, arg?)`: CSS selector (max 1000); all matches, except `scrollTo` uses the first. Ops: `hide` sets inline `display:none!important`; `show` removes inline display; `click`; `setText` replaces text with `arg`; `addClass`/`removeClass` use one class name; `scrollTo` scrolls into view. Arg max 2000. Mutations persist until explicitly reversed/page replacement.
- `v.query(tabId, selector)` → request ID string, or null for invalid arguments. Result is a later `query` event: up to 50 matches, lowercase `tag`, normalized text ≤1000 characters, attributes ≤2000, value ≤1000. No matches is successful `[]`; invalid CSS gives `error: "invalid-selector"`. A page without Vault's receiver may never reply.

## Panels

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

Defaults: position bottom-right; layout vertical; align left; role region; width content-sized. Width presets are 220/280/360px; numeric panel width clamps to 180–520px. Control width clamps to 32–520px, height to 20–360px. Numeric sizes also accept pixel strings. Vertical variants change spacing; inline/row do not wrap; wrap/toolbar wrap; twoColumn/grid/split/form use grids; stack minimizes spacing. Role supplies accessibility semantics, not modal blocking.

IDs normalize to ASCII letters/digits/`_`/`-` (max 80); choose unique stable IDs. Omitted control ID becomes `control-N`, omitted/unknown type becomes text. Omitted text/lists are empty; disabled is false. Calling `v.panel` replaces the whole spec. Omitted `value` reuses the last control event value, then applies type normalization; explicit `value` overrides it. Autofocus defaults to false. Unknown fields are discarded; rule-supplied panel colors/fonts/CSS are unsupported.

Control fields and values:

- `text`: `text` string; defaults to label. `html`: `html` string; scripts, event attributes, dangerous URLs and styling removed.
- `button`: `label`, optional `action: "submit" | "cancel" | "close"`; value is a string (default empty). Actions emit events; they do not submit/close anything automatically.
- `checkbox`, `toggle`: boolean `value` (default false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (default empty). Empty option values removed; labels default to value.
- `textInput`, `textarea`: string value (default empty), `placeholder`; textarea `rows` 1–12 (default 3).
- `numberInput`, `range`: numeric value (default 0), `min`, `max`, positive `step`. Values clamp to bounds; unspecified normalization bounds are −1000000…1000000. Range widgets default to 0…100; set explicit bounds.
- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` or `HH:MM:SS`; invalid initial formats become empty. `color`: `#RRGGBB` (default `#000000`).
- `pin`: digit string; `length` 3–12 (default 6), `masked` true by default, `autoSubmit` false. `section`: `text`, `controls`, optional layout/align/role (role default group); child sections at depth 3 have no children (root controls depth 0).

Panel events: input controls send `input`/`change` (text input changes on blur/Enter; textarea on blur/Ctrl-or-Cmd+Enter). Ordinary controls also send `focus`, `blur`, `key`; key metadata is not forwarded to the rule. Buttons send `click` **and** their configured action as separate events—handle one. PIN sends `change`, plus `submit` when autoSubmit fills it. Mount/unmount use `controlId: ""`, `value: true`. `values` contains current input values keyed by ID; it excludes buttons/text/HTML. Events have no originating tab ID; use separate panel IDs for tab-specific interactions.

Text limits: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; other value strings 512; option value/label 256. Excess is truncated.

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Requires **Custom-rule folder** in Settings and its permission. Safari's native transport returns `local-folder-not-available`.

- `path` is relative; `/` separates directories. Segments permit ASCII letters/digits, spaces and `_.,@()-`; no leading dot, `.`/`..`, absolute path or URL. File suffix: `.txt`, `.csv`, `.json` (case-insensitive). List path is a directory; `""` lists the chosen root.
- Read returns UTF-8 text. Write replaces/creates; append creates/appends without an automatic newline. Parent directories are created on writes. String payload is written verbatim; other JSON payloads are serialized; null/omitted means empty text. JSON/CSV parsing is the rule's job. Maximum file size: 1048576 UTF-8 bytes.
- List returns immediate visible subdirectories and supported files. Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension includes the dot on files. Exists returns a boolean for a supported file path.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Unused result fields are null; success has empty error. Failures include invalid-path, unsupported-file-type, permission/folder unavailable, missing file and file-too-large. Treat error as a string, not a fixed exhaustive enum. Requests have no transaction/order guarantee; serialize read-modify-write operations per path.

## Limits

Per event per group: 256 queued actions, 200 log calls, 64 emits; excess is dropped. Per rule: 1000 handlers, 24 panels; each control list has 32 entries and each choice 64 options; excess is ignored/truncated. Emit chains stop after 16 generations. Serialized state limit: 65536 JavaScript string characters. Keep registration and each event's combined handlers under 1 second; repeated overruns or a hard timeout stop the group until Run. Log retains 200 entries, accepts 50/sec per group, and truncates long messages near 4096 characters. Timers/replies are best-effort, not real-time guarantees.

## Complete rule

A five-minute pause, triggered by Snooze or its panel button:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```
