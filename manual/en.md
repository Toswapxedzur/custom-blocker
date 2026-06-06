# Custom Web Blocker — Instruction Manual

This is the full reference manual for the extension. It starts with the easiest, most common workflows and gradually moves to advanced topics such as custom event-driven blocking rules and the helper API.

If you are brand new, just read **Quick start** and **Block groups overview**. Everything below those sections is optional, depending on what you want to do.

---

## 1. What this extension does

Custom Web Blocker lets you block websites and online distractions according to rules you define yourself. You can:

- Block sites immediately with the browser's native network blocking (the same kind of block that produces `ERR_BLOCKED_BY_CLIENT`).
- Allow yourself a certain number of minutes per day on a site, then block it once you go over that limit.
- Block specific kinds of content on YouTube, TikTok, Facebook, Instagram, Twitch, and Reddit (not the whole site).
- Hide blocked content from feeds on supported platforms instead of only blocking single pages.
- Schedule when a rule is active by day of the week and by `HHMM-HHMM` time windows.
- Freeze a rule so you cannot easily change it. Strict freeze locks it for a specified number of hours and requires a 20-step confirmation ritual to undo.
- Snooze a rule temporarily, but only after writing a long enough justification.
- Write **event-driven** custom rules in JavaScript with helpers for forward / backward timers, per-group persistent storage, per-platform DOM intents (hide nav buttons, hide feed cards by predicate, set per-subsection timers), URL utilities, and structured logging.
- Pick from a built-in library of 50+ ready-made templates (timers, schedules, feed hiding, focus sessions, redirects, nudges, persistence, DOM tweaks, debug helpers).
- Use the extension in 20+ languages.

The extension is a Chrome Manifest V3 extension with one editor page (the popup), one background service worker, one offscreen sandbox that hosts custom-rule code, and one content script that runs in every page. Custom rules live in the offscreen sandbox; they are loaded once per Run click and stay registered until the rule is disabled or deleted.

---

## 2. UI tour

When you click the extension's icon, the editor opens as a full web page (not a tiny popup). The page has these areas:

- **Top bar**
  - **Instruction Manual** button (this document)
  - **Language** picker
  - **Settings** gear (advanced toggles, including **Debug mode**)
- **Left panel — Block Groups**
  - List of your block groups. Each card shows the group name, a short summary line, and an enable/disable checkbox.
  - **Add** button creates a new group. The dropdown next to it picks the type.
  - **Clear** removes every group, with extra confirmations if any group is frozen.
  - You can drag the `::` handle on a card up or down to reorder groups.
  - You can drag the vertical splitter to resize this panel.
- **Right panel — Editor**
  - Edits the currently selected group: name, blocking behavior, blocklists, type-specific filters, schedule, freeze, snooze.
  - All changes save automatically a fraction of a second after you stop typing or interacting.
  - For **Custom** groups, the editor also shows the **Templates** browser, the **Run** button, and the **Log** panel (renamed from *Activity log* in v1.1).
- **Toast** (centered popup that fades) — shows status messages such as "Saved changes." or input errors.
- **In-page overlay** — while a tab has any active timer or block, an overlay appears in its top-left corner showing every constraint affecting it in `hh:mm:ss` (or `mm:ss`) format. Multiple constraints stack on multiple lines. Default block-group countdowns and Custom-rule timers share this overlay.

---

## 3. Quick start

1. Click the extension icon. The editor opens as a full page.
2. In the **Block Groups** panel, choose a group type from the dropdown:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit`, or `Custom`.
3. Click **Add**. A new group appears, and the editor opens it.
4. Give it a name.
5. Fill in the type-specific fields (for `Default`, that means the **Blocked websites** list).
6. Make sure the group's checkbox in the left panel is on.
7. Visit one of the listed sites. The block should take effect immediately.

That is the entire happy path. The rest of this manual is just options on top of this.

> When you press **Run** on a Custom group, the new rule attaches to **future** page events. Already-open tabs keep running the previous rule until you reload them. The popup shows a reminder to that effect after every successful Run.

---

## 4. Block groups overview

Everything in this extension is organized as **block groups**. A block group is one rule set:

- It has a name, a type, and an enabled/disabled state.
- It has a blocking behavior (immediate, after a number of minutes, or fixed countdown).
- It has an optional schedule (days + time windows) and optional freeze/snooze controls.
- Depending on the type, it has additional fields like a list of websites, YouTube creator filters, subreddit names, or an event-driven JavaScript rule.

You can have any number of groups. Multiple groups may apply to the same page; in that case the **strictest** rule wins:

- "Block immediately" beats "block after some time".
- A group with less time remaining beats a group with more time remaining.

So adding more groups can only make a page block sooner, never later.

**Evaluation order is bottom-to-top.** When the extension iterates your block groups, it starts with the group at the bottom of the list and works its way up. The group at the top of the list is evaluated last and gets the "last word" — for example, if a bottom group calls `helpers.getPlatformHelper().youtube().hideShortButton()` and a top group calls `showShortButton()`, the button stays visible. Drag the `::` handle on a card to change this order.

---

## 5. Group types

### 5.1 `Default` — block ordinary websites

For blocking specific domains (the typical use case).

- **Blocked websites**: one site per line. Both `facebook.com` and `https://www.facebook.com/somepage` work; the extension extracts and normalizes the hostname.
- A site rule applies to that hostname and all its subdomains.
- This group type uses Chrome's native network blocking, similar to `ERR_BLOCKED_BY_CLIENT`. That means navigation to a blocked URL is stopped before the page even loads.

### 5.2 `YouTube` — block YouTube and similar video sites

Adds a **Filters** section to the editor:

- **Content type**:
  - `Apply to all YouTube pages` — every YouTube page counts.
  - `Apply to Shorts` — only Shorts pages count.
  - `Apply to long videos` — only `/watch`, `/live/`, `/embed/`, etc.
  - `Apply to YouTube posts` — community posts (`/post/...`, channel community/posts tabs).
- **Author filter**:
  - `Do not filter by author` — author identity does not matter.
  - `Apply to certain authors` — only listed authors trigger this group.
  - `Apply to all except certain authors` — listed authors are exempt.
- **Authors**: one author per line. Accepts `@handle`, full URLs, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed**: while this group is actively blocking, matching cards in YouTube feeds are hidden. When the block becomes inactive, they come back on the next refresh.

For Shorts and Posts content types, when no author filter is set and the group is currently blocking, the extension also hides relevant nav entries (Shorts sidebar entry, Community/Posts channel tabs) and the matching shelves like "Latest YouTube posts".

The short-vs-long detection extends to other video sites such as TikTok, Vimeo, Twitch clips/VODs, and Dailymotion when their page form can be detected.

### 5.3 `TikTok` — block TikTok content

Same editor card as the platform-video editor, but with TikTok-specific labels:

- Content types: short videos, videos, profile pages.
- Authors: TikTok handles (`@handle`) or profile URLs.
- Feed hiding hides matching cards on TikTok pages while the group is active.

### 5.4 `Facebook` — block Facebook content

- Content types: Reels, videos, posts.
- Authors: page name (`page.name`), profile URL, or `profile.php?id=...` form (the numeric id is preserved as `id:<number>`).
- Feed hiding hides matching feed cards on Facebook.

### 5.5 `Instagram` — block Instagram content

- Content types: Reels, videos, posts.
- Authors: Instagram handles or profile URLs.
- Reserved paths like `/reel/`, `/p/`, `/tv/`, `/explore/` are not treated as authors.
- Feed hiding hides matching cards on Instagram.

### 5.6 `Twitch` — block Twitch content

- Content types: clips, streams/VODs, channel pages.
- Authors: channel names or channel URLs.
- Reserved paths like `/directory`, `/videos`, `/settings`, etc. are not treated as channel names.
- Feed hiding hides matching cards on Twitch.

### 5.7 `Reddit` — block Reddit or specific subreddits

- **Subreddits**: one subreddit per line. Empty list means the group applies to all of Reddit. Both `productivity` and `r/productivity` are accepted.

### 5.8 `Custom` — block by event-driven JavaScript

You write a JavaScript function that **registers handlers** for events such as page open, URL change, page heartbeat, timer end, and your own custom events. The function runs once per Run click; the registered handlers stay active across navigations until you hit Run again, disable the group, or delete it.

`Custom` groups don't show: blocking behavior, blocked sites, allowed minutes, reset interval, schedule days, or time windows. They keep the **Blocking Rules** editor plus standard freeze/snooze controls. There is also a **Templates** button that opens a preset browser with parameterized starter rules; applying a preset replaces the current rule after confirmation.

See **Section 11** for the full custom-rules reference and helpers API.

---

## 6. Blocking behavior

For most group types you choose one of three modes.

### 6.1 Block immediately

The rule is active whenever the group is on, the schedule allows it, and (for platform groups) the page matches.

For `Default` groups this uses Chrome's native blocking. For platform groups it uses the in-page overlay/exit logic.

### 6.2 Block after a number of minutes

This is a usage budget.

- **Allowed minutes before block** (decimal): how many minutes you allow yourself per period. Example: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (decimal): how often the budget resets. Example: `24` for daily, `1` for hourly, `0.25` for every 15 minutes.

While you have time left, the page works normally and shows the timer overlay. When the budget hits zero, the page is blocked for the rest of the period and the overlay shows `0:00`, then the tab attempts to exit.

The extension is per-group, per-period:

- Each group has its own budget.
- Time spent on any page that matches the group counts toward that group's budget.
- Multiple tabs in the same group share the budget. Their timers stay synchronized; switching to another tab also forces a refresh so it shows the current shared time immediately.

If multiple time-limited groups apply to the same page, the strictest one wins.

### 6.3 Timer (count down, then block)

This mode shows a countdown timer and blocks once it reaches `0:00`.

- **Timer reset interval (hours)** (decimal): both the timer length and the reset frequency. Example: `24` for daily, `1` for hourly, `0.25` for every 15 minutes.

Unlike **Block after a number of minutes**, this mode does **not** have a separate "Allowed minutes before block" field. The timer simply starts at the reset interval, counts down while matching pages are open, then blocks until the next reset.

Default-group countdowns and Custom-group timers (see **Section 11.3.1**) both **only advance while the tab is visible**. Switching tabs, minimising the window, or locking the screen pauses the countdown automatically.

---

## 7. Schedule

In the **Schedule** card you can restrict when a group is active:

- **Days to block**: pick the days the group applies. Unchecked days mean the group is inactive that day.
- **Time windows**: free-form list, one window per line in `HHMM-HHMM` format, for example:

  ```
  0900-1000
  1200-1300
  ```

  The group is active only inside those windows. Empty list means all-day.

This applies to all group types except `Custom`. (Custom rules can implement their own schedule using `ev.time.dayName` / `ev.time.hour`; see **Section 11.4**.)

---

## 8. Freeze (anti-tampering)

Freezing makes a group hard to disable on impulse.

In the **Freeze** card you choose:

- **Frozen** — you cannot edit or delete the group, and you cannot uncheck its enable toggle. To change anything you must run the unfreeze ritual (see below).
- **Strict frozen** — same as Frozen, but it stays locked for a number of hours you choose (decimal, up to 72). Until that timer expires, even the unfreeze ritual is unavailable.

When a frozen group is unlockable, the **Unfreeze** button appears. Clicking it starts the **20-step ritual**:

- The modal shows a self-discipline message.
- You must click `Confirm` 20 times.
- There is a forced 5-second wait between clicks.
- If you cancel at any point, you must restart from step 1.
- The 20 messages rotate so you actually read them.

If the group is also marked "no snooze" (see next section), you cannot snooze it either while frozen.

The freeze status is shown in the meta line of the group card, including the time remaining for strict freeze.

---

## 9. Snooze (temporary disable)

Snooze temporarily disables a group without unfreezing it. It supports delayed activation, post-snooze cooldown, confirmation steps, and a running total of snoozed time.

In the **Snooze** card:

- **Allow snooze for this group** — if off, this group cannot be snoozed at all (including while frozen).
- **Snooze for (minutes)** — decimal, how long the snooze lasts.
- **Activation delay (minutes)** — decimal `>= 0`. After you confirm the snooze, the group keeps blocking until this delay has passed; only then does the snooze become active.
- **Cooldown after snooze (minutes)** — decimal from `0` to `5`. After the snooze finishes, you cannot start another snooze for this group until the cooldown ends.
- **Times of confirmation** — integer `>= 0`. If this is `0`, snooze is scheduled immediately. Otherwise, starting snooze launches a confirmation ritual with exactly that many steps.

Each snooze confirmation step has a forced **5-second wait** before the next click is allowed. The modal tells you this explicitly and shows the live countdown on the button.

If the group is frozen, the snooze settings are locked at the values chosen before the freeze. You can still snooze it, as long as snooze is allowed, but you must use the saved delay / cooldown / confirmation settings.

The Snooze card also shows **Total snoozed time** for that group. This total counts the full active snooze duration even if the site becomes reachable for some other reason during that window.

When a snooze finishes, the rule comes back immediately. If the group was not already frozen, the extension automatically freezes it again at snooze end.

A status message confirms the snooze. When the snooze ends, the group automatically returns to normal.

You can also end a snooze early with the **End Snooze** button.

For Custom groups, pressing **Start Snooze** also dispatches a `snoozePress` event into the rule (see the events table in **Section 11**), so a custom rule can record the press, log a justification, or fire follow-up events. The rule has **no programmatic snooze API** — it can react to the press, but cannot cancel or extend it.

---

## 10. Bulk actions

- **Clear** removes every group.
  - It always asks for confirmation.
  - If at least one group is frozen, it requires the same 20-step ritual as unfreezing.
  - If any group is strict-frozen and still locked, **Clear** is disabled.

---

## 11. Custom groups — event-driven reference (v1.1+)

Starting with v1.1, custom rules are **event-driven**. Your rule is no longer a per-heartbeat function whose return value blocks the page. Instead, the rule body is a script that **registers handlers** for specific events (page open, URL change, page heartbeat, custom events, …). The handlers stay registered across page navigations and tab switches and live inside a long-lived **offscreen sandbox**.

The rule body executes **once per Run click** (or once when the group is enabled and an active source already exists). To re-load handlers, click **Run** in the editor. The popup shows a reminder asking you to reload any already-open page so the new rule applies there too.

### 11.1 Rule signature

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Two arguments:

- `event` — the **events registry** for this group. Use it to register, override, list, count, or unregister handlers, and to `post(...)` custom events.
- `helpers` — the helper bundle (see **11.3**).

The function is **not** expected to return a value. The decision to block or allow is made later, when an event fires and one of your registered handlers calls `ev.preventDefault()` and/or `ev.setResult(...)`.

### 11.2 Lifecycle

- **Run** (per-group button in the editor): the engine first wipes every handler that was previously tagged with this group, then re-runs the rule body in the offscreen sandbox. This is the only way to re-register after editing the source.
- **Disable group**: every handler tagged with this group is wiped. The group source is kept in storage but stops responding to events.
- **Re-enable group**: the engine automatically re-runs the active source for this group.
- **Delete group**: same as disable; all handlers tagged with the group are wiped.
- **Re-registering with the same `(eventType, id)`**: silently overrides the previous registration.

The offscreen sandbox is shared by **all** custom groups. Handlers from different groups co-exist there, each tagged internally with their owning group id so that "Run", disable, or delete only touches the right group.

If a custom rule misbehaves (synchronous infinite loop, runaway log spam, etc.) the sandbox quarantines it: the group is auto-disabled and the failure is recorded so you can see it in the Log panel. To re-enable a quarantined rule, fix the source and click **Run** — the engine clears the abort reason and reloads the rule.

### 11.2.1 The events registry (`event`)

Generic methods:

- `event.register(type, id, handler, options?)` — register a handler for an arbitrary event type. `id` is your own choice. `options.priority` (default `0`) — higher runs first. `options.intervalMs` — for `tickEvent` only; throttle this specific handler relative to the global tick. Re-registering with the same `(type, id)` overrides.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — fire a custom event. `scope: "global"` reaches every group; default `scope: "group"` only reaches handlers in the **same** group.

Per-event-type sugar (one set of methods per built-in type):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Same shape for `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`, `panelEvent`, `localFileEvent`.

### 11.2.2 Built-in event types

| Type | When it fires | `ev.data` payload |
|---|---|---|
| `tickEvent` | 1-second tick for each open tab. Fires regardless of tab visibility, with at most one tick per tab per second. Use this for clock-style logic that must keep running even when no tab is focused. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | ~250 ms heartbeat from the **active**, **visible** tab. Drives all tab-visibility-aware logic, including the auto-tick built into `getOrCreateTimer({ scope })`. Does **not** fire from background tabs or while the screen is locked. | `{ elapsedMs }` |
| `openWebEvent` | A new tab is created. Does not fire when an existing new-tab/search page navigates to a website, and does not re-fire for already-open tabs after a Run click. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | A tab is closed. | `{ reason, nextUrl }` |
| `switchWebEvent` | URL **changes** on a committed top-level navigation inside the same tab — back/forward or a navigation that lands on a different URL than before. Does **not** fire on a plain reload (same URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | URL change crosses a hostname boundary (e.g. `youtube.com` → `wikipedia.org`). Fires alongside `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | A committed top-level page navigation happens: open, switch, cross-domain switch, back/forward, or a plain reload that keeps the same URL. This is the reliable "the page changed, re-evaluate everything" hook. It is emitted once from the same committed navigation record that may also produce `openWebEvent` / `switchWebEvent` / `switchDomainEvent`, and is the only one that fires for same-URL reloads. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` where `transition` is `"commit"` |
| `timerEnded` | A timer managed by the group reaches `currentMs === 0`. Only delivered to the owning group. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | The user pressed **Start Snooze** in the popup for this **custom** group. Pure notification event — the handler can run arbitrary code (log, redirect, fire other events) but custom rules have **no programmatic snooze API**. Logs produced here surface as toasts on the active tab. Only delivered to the pressed group. | `{ triggeredAt }` |
| `panelEvent` | A page panel control rendered by `helpers.getPanelHelper()` was used. Delivered to the owning group, and also available through `event.registerPanelEvent(...)` for group-level handling. | `{ panelId, controlId, eventName, value, values }`; shortcuts also exist as `ev.panelId`, `ev.controlId`, `ev.eventName`, `ev.value`, `ev.values` |
| `localFileEvent` | A `helpers.getLocalFolderHelper()` request finished. Delivered to the owning group. | `{ eventName, action, path, directoryPath, requestId, ok, text, value, entries, exists, bytes, error }`; shortcuts exist on `ev` with the same names |

URLs in `ev.url` and in event data are **normalized** for events: Chrome's New Tab Page (which renders Google's "Search Google or type URL" surface), `about:blank`, and equivalent newtab schemes are exposed as the empty string `""`. So a timer scoped to `ev.url === ""` only ticks while you are on the new-tab page. Regular `google.com` URLs are unchanged.

### 11.2.3 The event object (`ev`)

Every handler is invoked as `(ev, helpers) => void`. `ev` carries:

- `ev.type` — the dispatched event type.
- `ev.groupId` — the receiving group's id.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — context for the event.
- `ev.time` — `{ now, month, dayOfMonth, dayName, hour, minute }` snapshot at dispatch. `dayName` is `"Sunday"`..`"Saturday"`.
- `ev.data` — event-specific payload (see table above).

Methods:

- `ev.preventDefault()` — mark the dispatch as "blocked". The host content script will exit the page (or follow `setRedirectLink`) unless a higher-priority handler later sets `setResult(1)`.
- `ev.stopPropagation()` — halt this dispatch immediately. **No further handlers across any group** are invoked for this event.
- `ev.setResult(value)` — set the dispatch result. `value` may be a **number** in `[-255, 255]` (`-1` block, `0` neutral, `1` allow; other integers are preserved for your own debug logic), or a **string** (interpreted as a redirect URL). The last `setResult` call across all handlers wins. A numeric `1` overrides any earlier `preventDefault`.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — the URL the host should navigate to when the dispatch ends as blocked. This is the **only** way to redirect from custom rules; the editor no longer exposes the "Redirect URL when blocked" field for Custom groups.
- `ev.post(type, data, { scope })` — fire a follow-up event from inside a handler.

In addition, `ev` is a Proxy: any field you set on it (e.g. `ev.foo = 42`) is stored in a `custom` map and can be read back from the same handler or from later handlers in the same dispatch.

### 11.3 The `helpers` object

Every handler call gets a fresh `helpers` bundle scoped to the receiving group and the event's URL. Constant fields:

- `helpers.now` — epoch milliseconds at dispatch.
- `helpers.currentUrl` — the event URL, after newtab/blank normalization.
- `helpers.groupId` — receiving group id.

Convenience shortcuts (route to the same accumulator-aware functions used by the helpers below, so the output still lands in the Log panel):

- `helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.
- `helpers.logScreen(...)`, `helpers.warnScreen(...)`, `helpers.errorScreen(...)`.
- `helpers.logPopup(...)`, `helpers.warnPopup(...)`, `helpers.errorPopup(...)`.

Accessor methods:

- `helpers.getLogHelper()` — `log` / `warn` / `error`, plus `logScreen` / `warnScreen` / `errorScreen` and `logPopup` / `warnPopup` / `errorPopup`. Output is rate-limited and capped per dispatch to prevent runaway rules from freezing the popup.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`) — URL inspection (see **11.3.6**).
- `helpers.getTimerHelper()` — group-scoped timers (countdown / count-up); state persists across browser restarts.
- `helpers.getPanelHelper()` — fixed-layout on-page panels with configurable content, colors, position, and event handlers.
- `helpers.getPersistenceHelper()` — JSON key/value store scoped to the group.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (and `set` / `get` aliases) plus `createMessageUrl(message)` which returns a `chrome-extension://...` URL that displays the given message.
- `helpers.getPlatformHelper()` — per-platform DOM intents (see **11.3.8**).
- `helpers.getDOMHelper()` — generic DOM intents: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Operations are batched and applied after the handler returns.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Effects are applied to the tab the event came from.
- `helpers.getStorageHelper()` — superset of `getPersistenceHelper` plus async `requestAsyncGet(key)` / `requestAsyncSet(key, value)` hooks for cross-extension storage (results arrive as a follow-up custom event).
- `helpers.getLocalFolderHelper()` — async access to a user-granted local folder. Supports `.txt`, `.csv`, and `.json` files inside that folder only; results arrive as `localFileEvent`.
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` against a snapshot bundled with the event.

All helper methods are safe: bad parameters return `null`, `false`, or an empty value instead of throwing.

#### 11.3.1 `getTimerHelper()`

Per-group timers. Each timer is identified by a string `id` you choose; identity is scoped to the group, so two groups can both use the id `"yt-shorts"` without colliding. State persists across browser restarts.

A timer's persisted state is exactly: `id`, `displayName`, `direction` (`"forward"` or `"backward"`), `isPaused`, and `currentMs`. There is no stored "initial duration" — `isExpired` is just `currentMs === 0`. Forward timers tick up forever and never expire on their own. Backward timers stop ticking at `0` (no negative values).

There are two construction methods. Pick the one whose semantics match what you want:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **always (re)creates** the timer with the supplied init values, overwriting any existing state including `currentMs`. Use this when you mean "start fresh", e.g. inside a one-shot reset branch.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotent**. If a timer with that `id` already exists, it is returned unchanged; init fields such as `displayName`, `direction`, and `currentMs` apply only when the timer is first created. Use explicit setters such as `setDirection`, `setCurrentMs`, `addMs`, or `setDisplayName` when you want to mutate an existing timer.

When a timer is created, both methods accept two predicate functions that the engine remembers for the lifetime of the rule (they survive across heartbeats and across `webChangedEvent` re-evaluations, but they are **never persisted** to storage). Existing `getOrCreateTimer()` calls reuse the remembered predicates instead of replacing them:

- `scope: (url) => boolean` — when `true` for the current visible URL on each `pageHeartbeatEvent`, the timer auto-ticks by the heartbeat interval (~250 ms). The helper itself never blocks; it only updates `currentMs`. At most one auto-tick per heartbeat per timer.
- `domain: (url) => boolean` — when `true` for the current visible URL, the timer is rendered in the in-page overlay (top-left). When `domain` is omitted, the engine falls back to `scope` for display, so a "tick on /shorts/ pages" timer also shows up there with no extra wiring. Provide `domain` explicitly if you want a different display gate (e.g. tick only on `/shorts/`, but show the remaining time across all of `youtube.com`).

> **Important — a timer never blocks on its own.** When a backward timer hits zero it just stops at zero and fires `timerEnded` once. Whether to actually block the page is up to a separate `openWebEvent` / `switchWebEvent` handler that calls `ev.preventDefault()` after checking `helpers.getTimerHelper().isExpired(id)`. This separation lets you build "warning only" timers, count-up trackers, soft nudges, or hard blocks — same primitive, your choice.

Other methods:

- `delete(id)`, `pause(id)`, `resume(id)` — standard lifecycle. Pause freezes `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — direct mutators (most rules don't need these — let the heartbeat tick the timer for you).
- `setDisplayName(id, name)` — relabel.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` iff `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` or `null`.
- `list()` — every timer this group owns, as an array of state objects.

#### 11.3.2 `getPanelHelper()`

Group-scoped on-page panels. A panel is defined by a safe schema; the extension owns exact positioning, while the rule controls content, preset layout, priority, alignment, colors, text sizes, accessibility labels, and handlers.

Construction:

- `create({ id, title?, description?, position?, align?, layout?, priority?, width?, textSize?, theme?, ariaLabel?, role?, autoFocus?, scope?, domain?, controls?, onEvent?, onChange?, onClick?, onInput?, onFocus?, onBlur?, onSubmit?, onClose?, onMount?, onUnmount?, onKey? })` — creates or replaces the panel and resets its stored control values.
- `getOrCreatePanel(config)` — creates the panel only if missing. If the `id` already exists, it returns the existing panel unchanged.
- `update(id, patch)`, `delete(id)`, `show(id)`, `hide(id)`.
- Preset builders: `notice(config)`, `confirm(config)`, `checklist(config)`, and `form(config)` create common panel shapes on top of the same schema.

Display:

- `scope(url)` / `domain(url)` decide where the panel appears, like timer display predicates. If neither is provided, the panel can appear on every page where the custom rule is active.
- `position` is one of `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`, or `"center"`.
- `align` is `"left"`, `"center"`, or `"right"`.
- `layout` is a safe preset: `"vertical"`, `"compact"`, `"comfortable"`, `"spacious"`, `"inline"`, `"row"`, `"wrap"`, `"twoColumn"`, `"grid"`, `"split"`, `"form"`, `"toolbar"`, or `"stack"`.
- `priority` controls stacking/layout order. Higher priority panels are placed closer to the selected corner; higher priority controls/sections are laid out earlier within their container.
- If panel `width` is omitted, the outer panel auto-fits its content as tightly as possible. Set panel `width` only when you want a fixed container width.
- `theme` accepts color tokens such as `background`, `foreground`, `accent`, `border`, and `muted`, plus `fontSize` / `titleSize`. Use safe color strings such as hex, `rgb(...)`, `rgba(...)`, `hsl(...)`, or named colors.
- `ariaLabel`, `role`, and `autoFocus` improve keyboard/screen-reader behavior.

Controls:

- Supported control types: `"text"`, `"checkbox"`, `"select"`, `"textInput"`, `"textarea"`, `"button"`, `"section"`, `"timer"`, `"numberInput"`, `"range"`, `"toggle"`, `"radio"`, `"date"`, `"time"`, and `"color"`.
- `section` is a real element/group with its own `{ id, type:"section", label?, text?, layout?, priority?, width?, height?, align?, ariaLabel?, role?, controls? }`.
- `timer` is a display element. Use `{ id, type:"timer", timerId, format?, showExpired? }` to hydrate from the group timer bucket, or `{ timer: helpers.getTimerHelper().getState(id) }` to pass a timer object snapshot.
- Control schema: `{ id, type, label?, text?, placeholder?, value?, options?, min?, max?, step?, timerId?, timer?, format?, showExpired?, action?, layout?, priority?, width?, height?, rows?, disabled?, ariaLabel?, autoFocus?, onEvent?, onChange?, onClick?, onInput?, onFocus?, onBlur?, onSubmit?, onClose?, onMount?, onUnmount?, onKey? }`.
- `width` accepts pixel numbers/strings, percentages, `"full"`, or `"auto"`; `height` accepts pixel numbers/strings or `"auto"`; `rows` controls textarea row count. These scale the control itself while the extension still controls ordering and position.
- `numberInput` and `range` support `min`, `max`, and `step`; `toggle` is a switch-style boolean; `radio` uses the same `options` shape as `select`; `date`, `time`, and `color` use native browser input values.
- `setValue(panelId, controlId, value)`, `updateControl(panelId, controlId, patch)`, `enable(panelId, controlId)`, `disable(panelId, controlId)`, `setOptions(panelId, controlId, options)`, `setText(panelId, controlId, text)`, `setTheme(panelId, theme)`, `setTitle(panelId, title)`, `setDescription(panelId, text)`, `getValue(panelId, controlId)`, `getValues(panelId)`, `getState(id)`, and `list()` read/mutate panel state.

Events:

- Inline handlers can live on the panel or individual controls/sections. Supported inline handlers include `onEvent`, `onChange`, `onClick`, `onInput`, `onFocus`, `onBlur`, `onSubmit`, `onClose`, `onMount`, `onUnmount`, and `onKey`.
- `event.registerPanelEvent(id, handler, opts)` registers a group-level handler that can detect every panel event for the group.
- Checkbox/select changes fire immediately. Text inputs fire change on Enter or blur. Textareas fire change on blur or Cmd/Ctrl+Enter. Inputs also emit `input`, `focus`, `blur`, and `key`; key events include `ev.key`, `ev.code`, and `ev.keyInfo` with modifier flags. Buttons fire `click`, or `submit` / `cancel` / `close` when `action` is set.
- Panel handlers receive the normal `(ev, helpers)` object and can block/redirect with `ev.preventDefault()`, `ev.setResult(...)`, and `ev.setRedirectLink(...)`.

#### 11.3.3 `getPersistenceHelper()`

Map-like storage scoped to your group. Values must be JSON-serializable.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Soft limits: about 200 keys per group, 16 KB per value.

#### 11.3.4 `getLocalFolderHelper()`

`getLocalFolderHelper()` lets custom rules request reads and writes in a folder the user explicitly chooses in **Settings → Local File Folder**. Browser security still applies: the rule never receives unrestricted filesystem access, and all paths are constrained to the granted folder.

Safety rules:

- Supported file extensions are `.txt`, `.csv`, and `.json`.
- Paths must be relative, for example `notes/focus.txt` or `data/today.csv`.
- Absolute paths, URL-like paths, `..` traversal, and hidden files/folders such as `.env` are rejected.
- Files over 1 MB are rejected.
- Operations are asynchronous. Request methods return a `requestId`; handle the result in `event.registerLocalFileEvent(...)`.

Methods:

- `requestRead(path)` — reads a text file. Result: `ev.eventName === "read"`, `ev.text`, `ev.bytes`.
- `requestWrite(path, text)` — writes/replaces a text file. Result: `ev.eventName === "write"`, `ev.bytes`.
- `requestAppend(path, text)` — appends by reading the current file and writing the combined text. Result: `ev.eventName === "append"`.
- `requestList(directoryPath?)` — lists supported files and subfolders. Result: `ev.eventName === "list"`, `ev.entries`.
- `requestExists(path)` — checks for a supported file. Result: `ev.eventName === "exists"`, `ev.exists`.
- `requestReadJson(path)` — reads and parses a `.json` file. Result: `ev.eventName === "read"`, `ev.text`, `ev.value`.
- `requestWriteJson(path, value)` — JSON-serializes and writes a `.json` file. Result: `ev.eventName === "write"`.

Example:

```js
(event, helpers) => {
  const files = helpers.getLocalFolderHelper();

  event.registerOpenWebEvent("load-config", (ev, h) => {
    h.getLocalFolderHelper().requestReadJson("config/focus.json");
  });

  event.registerLocalFileEvent("use-config", (ev, h) => {
    if (ev.eventName === "error") {
      h.warn("Local file error", ev.path, ev.error);
      return;
    }
    if (ev.path === "config/focus.json" && ev.value && ev.value.redirectUrl) {
      h.getPersistenceHelper().set("redirectUrl", ev.value.redirectUrl);
    }
  });
}
```

#### 11.3.5 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — write to the **Log** panel in the popup. They also show on-page toasts when **Settings → Show custom rule logs on web pages** is enabled.
- `logScreen(...args)`, `warnScreen(...args)`, `errorScreen(...args)` — show an on-page toast only. These do not write to the popup Log panel.
- `logPopup(...args)`, `warnPopup(...args)`, `errorPopup(...args)` — write to the popup only and never show an on-page toast.
- The helper has hard caps: roughly **200 log entries per dispatch** and a maximum string length per entry. Excess entries are dropped and counted in `accumulator.logsDropped`. This is what protects the popup from a `for (let i = 0; i < 100000; i++) helpers.log(i)` runaway.
- When **Debug mode** is off (default), trace-level entries the engine itself emits (dispatch start / handler timing) are suppressed everywhere — they don't show in the Log panel and don't print to the console. Your own `log` / `warn` / `error` calls always go through.

#### 11.3.6 `getRedirectionHelper()`

Inspect / override the redirect URL the content script will use if the current page ends up blocked.

- `get()` — returns the current effective redirect URL for this dispatch. Initially this is the built-in group's configured fallback URL (if any), otherwise `""`.
- `set(url)` — overrides that redirect URL for this dispatch. Returns `true` on success, `false` for non-string input. Passing `""` clears the redirect override and falls back to the normal default exit behavior.
- `createMessageUrl(message)` — returns a `chrome-extension://<id>/message-page.html?msg=...` URL that, when navigated to, displays the message centred on a clean page. Useful for redirecting users to a "Go Work" / "Take a break" screen after a timer ends. Example: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Like the other custom-rule side effects, this state is shared across all rules in the current dispatch. Because rules run bottom-to-top, the top-most rule to call `set(...)` wins.

#### 11.3.7 `getDomainHelper()` (alias `getDomainUtility()`)

URL inspection helpers. There is no `normalize()` because incoming URLs are already newtab-normalized.

Core:

- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — each returns `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

URL filtering and section helpers:

- `isEmptyStartPage(url)` — `true` for the new-tab page and equivalents (the URLs that show up as `""` to handlers).
- `matchesAny(url, patterns)` — `patterns` may be a regex, a string regex, or an array of either.
- `pathStartsWith(url, path)` — boundary-aware (`pathStartsWith("/r/", "/r")` is true; `"/results/"` is not).
- `queryHas(url, key, value?)`, `queryGet(url, key)` — query-string inspection.
- `isSearchPage(url)` — recognizes Google / Bing / DuckDuckGo / YouTube results / Reddit / Twitter / X searches.
- `isInfiniteFeedUrl(url)` — recognizes the algorithmic-feed surfaces of YouTube, TikTok, Instagram, Facebook, Reddit, X.
- `sameSection(a, b)` — same hostname AND same first path segment.

#### 11.3.8 `getPlatformHelper()`

Per-platform DOM intents and sub-section timers, plus inspection. Each `helpers.getPlatformHelper().<platform>()` returns an object whose method set is **gated by the platform** — methods that don't make sense on a given platform are simply absent, so calling them throws `TypeError: ... is not a function` rather than silently no-op'ing. For example, `twitch().hidePosts` does not exist (Twitch has no posts), and `tiktok().hideShortButton` does not exist (TikTok's whole experience already _is_ short-form video). Use `helpers.getPlatformHelper().hasMethod(platform, name)` or `.listMethods(platform)` to introspect at runtime.

Per-platform method matrix:

| method | youtube | tiktok | instagram | facebook | twitch |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VODs) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (chat) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

The platform-native names (`hideReels`, `hideClips`, `hideStreams`) are NOT separate buckets from `hideShorts` / `hideVideos` — the storage slot is the same; only the user-visible name follows each platform's terminology.

> **Predicate lifetime & single-slot rule.** Each of `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` owns **one** persistent predicate per `(group, platform, slot)`. The predicate is **not** scoped to the current event — once you set it, it stays active across every page load and every dispatch until either the matching `show*()` is called or the group is unloaded. Calling the same method again with a new function **replaces** the previous one — the engine never OR-merges multiple predicates within a single group. To combine conditions, write one predicate that does the combining yourself, e.g. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. Across **different** groups, each group contributes its own predicate and an item is hidden if any group's predicate matches.

Inspection methods take their value at dispatch time from a snapshot bundled with the event; their availability is gated by the matrix above.

URL classifiers are always re-exposed regardless of platform: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.

Sub-section timers register the timer in the persistent group bucket and, when scoped, only tick on URLs that match that subsection. The timer methods accept `{ id, direction, currentMs, displayName }` and follow the same per-platform gating.

For predicate methods, the predicate is called per matching card with a normalized `item`: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Any field can be `null`; "innocent until proven guilty" — return `false` when the field you need is missing.

### 11.4 Examples

**Easy** — block YouTube Shorts pages on weekday mornings:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Medium** — 30-minute daily budget for YouTube Shorts. The timer auto-ticks on `pageHeartbeatEvent`s while a Shorts URL is visible; a separate handler enforces the block when the timer hits zero.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Harder** — hide individual YouTube Shorts whose author handle is too long, and inject a "this Short is hidden" CSS:

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**Hardest** — broadcast a custom event from one handler to others:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Templates

Each Custom group has a **Templates** picker that opens a searchable preset browser. The library now ships **50+ templates** organized into nine categories so you can browse instead of writing rules from scratch:

| Category | Examples |
|---|---|
| **Timers** | Site time budget (countdown + block), site time tracker (count up), YouTube Shorts cap, TikTok feed cap, Instagram Reels cap, Facebook Reels cap, Twitch Clips cap, Universal distraction budget, Daily deep-work tracker |
| **Schedule** | Weekday working-hours block, weekend-only sites, pre-bedtime shutoff, allow-only-one-hour, lunch-only news, Monday fresh start, allow-first-N-minutes-of-each-hour, deep-work strict block |
| **Feed / Shorts** | Block YouTube Shorts URLs, hide Shorts cards, hide Shorts by keyword, hide YouTube home feed / comments / trending, block TikTok FYP, hide TikTok shorts, block Instagram Reels URLs, hide Instagram Reels feed, hide Facebook feed / Reels, hide Reddit / Twitter / LinkedIn home |
| **Redirect** | Distractions → focus page, Shorts → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, new tab → task list |
| **Focus** | Allowlist-only focus session, Pomodoro 25/5, block during meeting, block after N visits today, block on streak loss |
| **Nudge** | Log every distraction visit, warn on each Shorts visit, count daily visits to a site |
| **Persistence** | Monthly visit cap, weekly ban toggle, track Discord channels visited |
| **DOM tweaks** | Hide YouTube autoplay toggle, hide Twitter / X "What's happening", generic "hide selectors on a site" |
| **Debug** | Demo countdown (3 s), log every custom event |

Filter chips at the top of the picker narrow the list by category (`Timer`, `Schedule`, `Feed`, …) and platform (`YouTube`, `TikTok`, `Instagram`, …). Selecting a template:

1. Loads its parameter inputs (URL, minutes, hour ranges, etc.) into a small form.
2. **Apply preset** previews the generated source.
3. After confirming **Replace the current custom rule with this preset?**, the source is written into the editor.
4. You then click **Run** to register the rule's handlers in the offscreen sandbox.

Templates are defined under `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …). Each file calls `CB_REGISTER_TEMPLATES([...])` at load time, and the popup consumes the merged list. Adding a new template means writing one entry into the appropriate file — no other plumbing.

---

## 13. Multi-page behavior

- All open tabs in the same group share the same timer.
- When you switch to a tab in the same group, its overlay refreshes immediately to show the current shared time.
- Custom-rule timers tick only on the **active visible** tab — driven by `pageHeartbeatEvent`. Background tabs and minimised windows do not advance them. This matches the default block-group countdown.
- When a new rule is added, every open page detects the change and re-evaluates within a fraction of a second; **but** newly registered handlers do not retroactively "open" already-open tabs. The popup shows a reload reminder after each Run for that reason.
- When a rule expires, hidden feed cards and nav buttons are restored on the next refresh.

---

## 14. Settings

Open the **Settings** dialog via the gear icon in the top bar.

- **Heartbeat interval** — how often the content script reports tab time and drives `pageHeartbeatEvent`. Default 250 ms. Lower values are more responsive but use more CPU.
- **Tick interval** — how often the global `tickEvent` fires. Default 1000 ms.
- **Debug mode** — *off* by default. When *on*, the engine emits `[CustomBlocker:trace]` lines to the browser console. The popup Log panel stays reserved for rule-created helper logs. Leave debug mode off in everyday use; turn it on while diagnosing a misbehaving rule. `pageHeartbeatEvent` is excluded from trace logging even when debug mode is on, because it fires four times per second and would drown out the rest.
- **Show custom rule logs on web pages** — when on, normal `helpers.log()`, `helpers.warn()`, and `helpers.error()` calls appear as page toasts as well as popup Log entries. When off, normal logs are popup-only; rules can still write screen-only toasts with `helpers.logScreen()` or force popup-only with `helpers.logPopup()`.

---

## 15. Internationalization

The whole UI is translated. Use the **Language** picker in the top right.

Supported languages include English, Chinese (Simplified), Spanish, Japanese, Korean, plus partial coverage for Hindi, Arabic, Bengali, Portuguese, Russian, Punjabi, German, French, Turkish, Vietnamese, Italian, Thai, Dutch, Polish, Indonesian, Urdu, and Persian. Languages with partial coverage fall back to English for missing strings.

The instruction manual itself loads the markdown file matching your selected language, with English as a fallback.

---

## 16. Status messages

Status messages appear as a centered toast that fades out after about two seconds:

- "Saved changes."
- "Created \"Group name\"."
- Validation errors like "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

For input fields with format requirements, the message also appears next to the relevant button (for snooze).

---

## 17. Privacy and storage

- Everything is stored locally in `chrome.storage.local`. No data is sent anywhere.
- Stored items include: your groups, usage timers, last reset times, snooze records, custom timers, and custom persistent values.
- The extension does not read page content beyond what is needed to detect the page type (path / hostname / known DOM markers for video sites) and to evaluate user-written predicates. It does not read your messages, posts, comments, or private content.

---

## 18. Permissions

- `storage` — for the data above.
- `declarativeNetRequest` — for native blocking of `Default` groups.
- `alarms` — to schedule rule transitions efficiently.
- `tabs`, `webNavigation` — to detect tab creation, URL changes, and page heartbeats so events can be dispatched.
- `offscreen` — to host the long-lived custom-rule sandbox.
- `host_permissions: <all_urls>` — so the content script can show the timer overlay and detect platform context on any page.

---

## 19. Troubleshooting

- **A group I added does nothing.** Make sure the group is enabled, the schedule allows it now, no snooze is active, and (for platform groups) the page actually matches the chosen content type and author filter.
- **A timer is stuck or wrong on one tab.** Switch away and back, or focus the tab — that triggers a forced refresh from the shared timer.
- **Feed cards reappear after I think they should be hidden.** Feed hiding only runs while the rule is actively blocking. If you have an `after-minutes` rule, feed hiding kicks in once your time hits zero.
- **A YouTube nav button I expected to be hidden is still there.** Nav hiding requires the rule to be set to "do not filter by author" and the content type to be Shorts or YouTube posts. With author filters, hiding is per-card only.
- **Custom rule did nothing or threw silently.** Open Settings → enable **Debug mode**, then click **Run** again and watch the browser console for `[CustomBlocker:trace]` lines. Use `helpers.getLogHelper().log(...)` to add your own trace points in the popup Log panel. If a misbehaving rule kept getting auto-quarantined, fix the source and click Run — Run clears the abort reason.
- **My new Custom rule does not affect already-open tabs.** Reload them. Custom rules attach to *future* page events; the popup shows a reminder to reload after every Run.
- **My countdown timer is not advancing.** Custom-rule timers only tick on the **active visible** tab via `pageHeartbeatEvent`. Background tabs, minimised windows, and locked screens pause them by design — same behavior as the default block-group countdown.
- **I cannot delete a group.** It is probably frozen. Strict-frozen groups cannot be deleted at all until their lock expires; non-strict frozen groups can be deleted via the unfreeze ritual.
- **The popup shows "Running…" forever.** A custom rule probably got into a tight loop. The engine kills it after a hard timeout and quarantines the rule. Open the Log panel for the abort reason; fix the rule and click Run.

---

## 20. Glossary

- **Block group** — one rule set with its own type, behavior, schedule, and freeze/snooze.
- **Instant block** — the rule blocks immediately whenever it is active.
- **After-minutes block** — the rule starts blocking only after the time budget for the period is exhausted.
- **Reset interval** — how often the after-minutes budget resets.
- **Schedule** — days + time windows during which a group is active.
- **Freeze / Strict freeze** — anti-tampering states.
- **Snooze** — temporary disable with a configurable confirmation ritual.
- **Author filter** — for platform groups, restricts the rule to certain content creators.
- **Content type** — for platform groups, restricts the rule to certain forms of content (short, long, post).
- **Helpers** — utilities passed to a custom rule's handler.
- **Platform** — one of `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Each has its own group type and feed-hiding logic.
- **Heartbeat** — the ~250 ms `pageHeartbeatEvent` dispatched from the active visible tab.
- **Tick** — the 1 s globally shared `tickEvent` (visibility-independent).
- **Debug mode** — a setting that surfaces internal trace logging in the Log panel and the browser console.
- **Quarantine** — automatic disable of a custom rule that exceeded a runtime safety cap (deadline, log spam, …). Cleared on the next Run.

---

## 21. Limitations

- Feed hiding depends on each platform's current DOM. If the platform changes its layout, the hiding selectors may need to be updated.
- Platform context detection for non-YouTube sites is mostly URL-based, so it is most reliable on canonical content URLs.
- Custom-rule timers tick at heartbeat resolution (~250 ms). Don't rely on them for sub-second timing.
- Predicates passed to `hideShorts` / `hideVideos` / `hidePosts` are evaluated synchronously per feed card. Heavy logic in a predicate can slow down feed scrolling; keep them cheap.
- Two tabs editing the same per-group timer concurrently use a "last write wins" strategy. For typical use this is fine; if you depend on exact accounting, expect occasional small drift.
- The browser may suspend the background service worker when idle. The extension resumes it as soon as a page or alarm needs it; site / timed usage budgets keep counting via heartbeat replay.

## v1.2 note

The custom-rule editor now colors JavaScript syntax, and the template browser uses the same colors for code previews. The bulk group action is called **Clear**.

