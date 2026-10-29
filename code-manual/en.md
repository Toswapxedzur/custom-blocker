# Vault browser extension code manual

[User manual](../manual/en.md)

## Rule contract

Source: one function expression `(on, v) => { ... }`. Only synchronous JavaScript and the API below are supported; no JavaScript scheduling callbacks, network, extension APIs or direct DOM access. Time-based rules use managed timers/trackers below, or `ev.now` and events.

- Editing saves a draft; **Run** activates it and enables the group. Frozen groups cannot Run. Empty source unloads the rule.
- Successful Run replaces handlers and panels, preserving `v.state`. Compilation/registration failure keeps the previous rule; a timeout can stop it. Reloading the engine registers the last activated source again; closure variables reset.
- Registration may initialize state, register handlers, show panels and log. Page/file actions and emits belong in handlers; their registration-time queue is discarded.
- Disable suppresses handlers and lifts managed panels, sheets, covers and item verdicts. Enable restores retained panels/sheets and requests items again. Run does not clear existing sheets, covers or item verdicts. Delete removes the rule and its state/effects. Navigation, DOM mutations and file writes are not undone.
- Events are not restricted by ordinary group targets; filter URLs/items in the rule. Actions are queued, then applied after dispatch. Exceptions stop that handler without rolling back its state/actions; later handlers may still run. File, query, AI and record requests have result events; visual actions have no acknowledgement.

## Shared API

- `on(type, handler)` → boolean. Registers `handler(ev)`; multiple handlers run in registration order. False means invalid arguments or handler limit reached. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` is Unix milliseconds. Actual rendered control events have `origin: "user"`; `v.emit` events have `origin: "rule"`.
- `v.state`: mutable JSON object, persisted after event dispatch. Initialize missing fields rather than overwriting existing state. Assigning a non-object or array resets it to `{}`; nonserializable/oversized updates are not persisted.
- `v.log(...values)`: writes this group's Log. Handler and reported page-action errors also appear here; reporting does not replay actions. Logs/Clear are independent per group. Load errors appear in Run status.
- `v.emit(type, data)`: queues a JSON copy of `data` for this group's handlers after the current event, with a fresh `now`; not a synchronous call.
- `v.panel(id, spec, tabId?)`: replaces this group's named panel; omit `tabId` for every accessible web page, or use an integer tab ID. Null `spec` removes it. See Panels.
- `v.file(op, path, payload?)` → request ID string. See Files.
- `v.store(request)` → request ID string. See Group records.

Other shared calls return `undefined` except the named managed-time factories below. IDs/state belong to one group, not its display name.

## Managed timers and rolling usage

`v.timer(id, {direction:"down", durationMs:300000})` creates or returns a named countdown, initially paused. Use `{direction:"up"}` for a count-up timer. The handle has `start()`, `pause()`, `resume()`, `reset()` and `snapshot()`. Start/resume are idempotent; reset returns to paused zero elapsed. Snapshot fields include `ready`, `error`, `elapsedMs`, `remainingMs` (null for count-up), `running` and `completed`.

Running timers advance by wall-clock time while the app/browser is closed or the rule is disabled. A completed countdown delivers `timerEnded` with `{id, direction, durationMs, generation, incarnation}` once per timer incarnation and generation for each member when its rule next runs; Run does not replay it. Delivery depends on host events; this is not a real-time alarm. Put `{type:"timer", timerId:"focus", label:"Focus"}` in a panel to display it through the existing text control.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` creates or returns a named active-use tracker. `assign({websites:["youtube.com","reddit.com"], apps:[]})` replaces this member's target assignments. Native rules can assign platform app IDs instead. Domains include subdomains. One tracker pools its targets; other IDs have independent allowances. `snapshot()` returns `ready`, `error`, `usedMs`, `remainingMs`, `available`, and `nextReturnAtMs` (the next millisecond that any recorded usage expires). `available(target?)` also checks assignment when a target is supplied. `reset()` clears this object's history.

All observed eligible usage counts, including usage beyond the allowance; the tracker itself does not block a page/app. Overlapping visible-page intervals count once, and native apps count observed foreground usage. Disabled rules add no usage; history still expires at exact interval boundaries. Availability returns only when the remaining history is below the limit. Heartbeat samples are bounded to five seconds; shutdown/disabled gaps do not manufacture activity. User-emitted events do not add usage.

Same object IDs in linked custom groups share one local native-hub authority. Linking combines tracker history and assignments and keeps the initiating timer state; incompatible configurations refuse linking. Each member receives its own completion event. Disconnection makes shared trackers unavailable and rejects timer controls until fresh authority returns. On unlink, each member keeps final shared usage and timer state, restores its own targets, and drops commands from the old link. The hub retains the final snapshot until the returning member saves and acknowledges it; pending handovers finish before a new link becomes available.

Named objects survive Run and restart in reserved `v.state.$vaultTime`; do not edit that field directly. Remove explicitly with `v.removeTime(id)`. IDs are 1–80 ASCII letters, digits, `_` or `-`; reserved property names are refused. Up to32 objects share the rule's64KiB UTF-8 state limit. Durations are integer milliseconds up to365days. Rolling history is bounded to1024 minute buckets and2048 merged intervals. History-capacity errors leave the tracker unavailable until explicitly reset; invalid configurations and oversized saves report errors without erasing saved data.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Browser events

Payload notation below describes types; it is not executable code. `?` marks optional fields.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` is approximate; use timestamps, not tick counts. `active` means selected within a browser window, not proof the user is looking at it. URLs may be empty/restricted.
- `visible` comes from accessible, non-hidden pages; `elapsedMs` is time since their last heartbeat, zero while covered. It is not accumulated usage or playback time.
- `items` reports each accessible HTTP(S) page (`platform: "web"` outside recognized sites), new/changed supported feed items, and resends them after Run/re-enable. `ref` identifies a card on that page, not a durable content ID; `ref === "page"` denotes the page itself. Empty titles/URLs/authors are possible. `authors` contains platform-specific source identifiers.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Item availability depends on the page's supported markup.
- Tags require the connected desktop Content tagging page and a tagging-enabled build/platform (Chromium and Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence is 1–5. `tagsSettled === false` is pending/unavailable, not untagged; settled `tags: []` is untagged.
- `snooze` means the group's Snooze button was pressed. It applies no pause by itself.
- Query/file replies target the requesting group. Correlate `requestId`, check `error`/`ok`, and set a deadline using ticks: replies can be lost when a page closes, the engine reloads or the group is disabled. Request IDs can repeat after Run; pending requests are not durable work.
- Record replies also target the requesting group. A changed rule or configuration drops obsolete replies. Record operations are asynchronous; the rule decides how to handle missing replies and conflicts.

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

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Requires **Custom-rule folder** in Settings and its permission. Safari uses its native folder picker and a retained security-scoped grant; only the chosen folder is available.

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

Per event per group: 256 queued actions, 200 log calls, 64 emits; excess is dropped. Per rule: 1000 handlers, 24 panels; each control list has 32 entries and each choice 64 options; excess is ignored/truncated. Emit chains stop after 16 generations. Serialized state limit:65536 UTF-8 bytes. Keep registration and each event's combined handlers under 1 second; repeated overruns or a hard timeout stop the group until Run. Log retains 200 entries, accepts 50/sec per group, and truncates long messages near 4096 characters. Timers/replies are best-effort, not real-time guarantees.

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


## AI calls from a running rule

Each custom group selects one connection/model and reasoning effort in **AI calls**.
Use the same API on Mac and in browser rules. Browser requests require connected
Mac Vault; provider credentials stay there. Linked groups share the selection and
optional daily request cap. Blank means no group cap; account limits still apply.
The cap uses the UTC day, persists across restart, and counts submitted attempts
including failures. Linking combines existing usage; unlinking retains prior usage.
New selections use Medium reasoning when that model supports it. Saved selections
keep their effort. The optional saved prompt and context are shared by linked
groups and survive restart. They are available as `v.context.ai.prompt` and
`v.context.ai.context` inside handlers; Vault does not automatically send them.
The rule chooses what to include in each `v.ai` call. Editing either value
invalidates replies from the old configuration.

`v.ai({ prompt, input? })` returns a request ID immediately. Call it inside a handler,
not while registering the rule. `input` may be any JSON value; each prompt/input is
limited to20KB. Replies arrive as `ai` events: `{requestId, ok, text, citations,
error}`. Success text is at most48KB; citations are `{url,title}`. Preserve visible,
clickable source links when displaying answers based on web search. Search is always
available to the model. Requests have a70-second deadline and bounded concurrency;
there is no provider fallback or automatic retry. Responses are data, never executed
as JavaScript. The rule decides which existing actions to take.

For a panel with an `ask` button and `note` field:

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

Outstanding calls are not replayed after restart. Run, disable/re-enable and deletion
discard obsolete replies; a disconnected browser reports `ai-unavailable`. Other
errors include `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`,
`ai-timeout`, `ai-request-failed` and `ai-usage-storage-unavailable`. Failed calls do
not overwrite a previous result the rule chose to retain. Rule state still has its
existing64KB limit.

Tools can discover credential-free choices with `rule_ai_models` on Mac, or the
browser's `settings-rule-ai-models`, and configure `ruleAI` through the existing
set-group path. Its fields are `providerModel`, `accountID`, `reasoningEffort`
 (`default`, `low`, `medium`, `high`), `dailyRequestLimit` (null or1–100000),
`prompt` and `context` (optional strings, at most16KB each).
Use a returned choice; do not put a key or provider URL into rule source.

## Group records

`v.store(request)` starts an asynchronous JSON record operation from a handler.
Records are private to this group, persist across Run and restart, and are removed
with the group. Linked groups have separate records. The rule chooses keys, values,
version strings, cache invalidation and feedback precedence. No classification or
filtering behavior is attached to a record automatically. Mac and browser rules
use the same API, but each app/browser store is separate.

| Request | Result |
| --- | --- |
| `{op:"get", key}` | `record` or `null` |
| `{op:"put", key, value, version?, ifRevision?}` | saved `record` |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | sorted `entries` of headers and `next` cursor |
| `{op:"clear", prefix?}` | `deleted` count |

Each record has `{value, revision, version, updatedAt}`. The opaque revision
changes on a real write. `version` is caller-owned metadata. `list` returns
headers without values; use `get` to read one. Use `after: next` for the next page.
For `put`/`delete`, omitted `ifRevision` means unconditional. `null` requires an
absent key; a revision string requires an exact match. A mismatch returns
`ok:false`, `error:"store-conflict"` and the current `record`. Use this to stop
late automatic replies from overwriting user feedback. `v.context.revision` is
an opaque rule-configuration marker; a rule may include it in its own cache
version. A user-origin control event can make a correction, but authority is
decided by the rule's code.

Limits: key1–2048 characters, version≤128, JSON value≤64KiB, depth≤32,
10000 keys per group,16MiB whole record document. `list` returns at most100
headers and96KiB per page. At most32 requests per group and128 total requests
start per second; overload reports one `store-busy` error per group per second
and drops further requests that second. Storage errors return `ok:false`; a
future or malformed record document is preserved and reported as
`store-unavailable`. There is no automatic retry or eviction. Use ticks for
deadlines when a reply matters.

## Saved content attachments

`v.attach(tabId, item, id, spec)` saves a pill or passive HTML/CSS view for an observed content item.
Pass the complete `item` from an `items` or `attachment` event; a bare `ref` is not
an attachment handle. `contentId` identifies saved content; `instanceId` identifies
its current appearance. Keep that original handle while awaiting AI. A removed,
recycled or navigated target refuses a late attachment rather than attaching it
to another item. Existing `v.item(tabId, ref, verdict)` behavior stays separate.

For a pill, `spec` is `{type:"pill", text, tone?, tooltip?}`; tones are `blue`,
`cyan`, `gold`, `pink` or `red`. Text is plain text, up to240 characters;
tooltip up to1000. For a view, use `{type:"html", html, css?, label?}`. HTML is
≤32000 characters, CSS≤16000, and label≤200. The view is rebuilt from allowed
passive HTML/SVG, in its own closed shadow root with scoped CSS. Scripts,
event attributes, remote resources, embeds and unsafe CSS are removed. The
visible view is constrained to the content card and scrolls at480px height.
IDs use1–80 ASCII letters, digits, underscores or hyphens. A null spec removes
that group's saved pill. Call inside a handler. Persistence/delivery failures
appear in the rule Log; the engine does not retry them automatically.

Each item exposes this group's saved attachments as `item.attachments`, a read-only
snapshot keyed by attachment ID. Other groups' attachments are not in that map.
If saved data is unavailable, `attachments` is null and `attachmentError` is set;
this is not an empty cache. Unrelated rule handlers continue running.
Use it to avoid requesting AI for content that already has a saved result:

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

Pointer, Enter and Space activation produce `attachment` events for the current
group. Pills send `click`. A view's controls use `data-control` or an `id` as
their `controlId` and send `click`, `input` or `change`, plus current `value` and
bounded `values` for named controls. Actual UI events have `ev.origin === "user"`;
rule-created events have `origin === "rule"`. These events include `tabId`,
`attachmentId` and the current `item`. The view does not execute rule code.
Both pills and views prevent their interactions from navigating the underlying card.
Saved data contains no callback or executable code. A stale pill revision or old
document cannot invoke a current attachment. Rule emit events are ordinary rule
logic; the browser validates actual UI click messages independently.

Attachments are saved in this browser profile per group/content/ID and return on other
occurrences, navigation, browser restart and Run. Disable hides them while retaining
the saved data; reenable restores them. Deleting the group removes its attachments.
Linked groups keep separate attachments. There is no automatic cross-browser/device sync.
Known YouTube, Reddit, X and Bilibili content use platform IDs. Other detected
content uses a conservative normalized URL, so availability follows supported
page markup; unresolved identities cannot receive saved pills.

Limits:8 attachments per group/content,32 across all groups for one content item,
10000 content entries per group and an8MB UTF-8 serialized attachment document.
Reaching a limit refuses the new mutation with `attachment-item-limit` or
`attachment-storage-limit` in the Log; existing saved data is preserved. A dispatch
batches its attachment writes, and identical specs do not rewrite the store.
Attachments are browser content UI, including Safari's native rule engine; Mac
application rules have no browser content handles or in-app attachment surface.

`code-manual/generic-example.js` is an executable policy example. It uses
records, AI calls, user-origin feedback, compare-and-swap, HTML controls, item
verdicts, and a rule-owned usage report. Those behaviors are in the example's
source, not special features of the record or attachment store.
