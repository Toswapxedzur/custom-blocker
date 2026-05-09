# Custom Web Blocker — Instruction Manual

This is the full reference manual for the extension. It starts with the easiest, most common workflows and gradually moves to advanced topics like custom JavaScript blocking rules and the helper API.

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
- Write custom JavaScript blocking rules with helpers for forward/backward timers, per-group persistent storage, per-platform DOM intents (hide nav buttons, hide feed cards by predicate, set per-subsection timers), URL utilities, and logging. Custom rules run in the page itself, so predicates passed to platform helpers can use closure variables.
- Use the extension in 20+ languages.

The extension is a Chrome Manifest V3 extension, with one editor page (the popup), one background service worker, and one content script that runs in every page. Custom blocking rules live in the content script — they are evaluated on every page visit and on every heartbeat (~250 ms), and they decide whether to block the current page by returning `true` or `false`.

---

## 2. UI tour

When you click the extension's icon, the editor opens as a full web page (not a tiny popup). The page has these areas:

- **Top bar**
  - **Instruction Manual** button (this document)
  - **Language** picker
- **Left panel — Block Groups**
  - List of your block groups. Each card shows the group name, a short summary line, and an enable/disable checkbox.
  - **Add** button creates a new group. The dropdown next to it picks the type.
  - **Delete All** removes every group, with extra confirmations if any group is frozen.
  - You can drag the `::` handle on a card up or down to reorder groups.
  - You can drag the vertical splitter to resize this panel.
- **Right panel — Editor**
  - Edits the currently selected group: name, blocking behavior, blocklists, type-specific filters, schedule, freeze, snooze.
  - All changes save automatically a fraction of a second after you stop typing or interacting.
- **Toast** (centered popup that fades)
  - Shows status messages such as "Saved changes" or input errors.

While a page is being blocked or has an active timer, an overlay appears in its top-left corner showing all the time constraints currently affecting it, in `hh:mm:ss` (or `mm:ss`) format. Multiple constraints stack on multiple lines.

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

---

## 4. Block groups overview

Everything in this extension is organized as **block groups**. A block group is one rule set:

- It has a name, a type, and an enabled/disabled state.
- It has a blocking behavior (immediate or after a number of minutes).
- It has an optional schedule (days + time windows) and optional freeze/snooze controls.
- Depending on the type, it has additional fields like a list of websites, YouTube creator filters, subreddit names, or a JavaScript function.

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

### 5.8 `Custom` — block by JavaScript function

You write a JavaScript function. The extension's content script compiles it once per source change and runs it on every page visit and on every heartbeat (~250 ms). The function returns an integer state (`-1` block, `0` continue, `1` allow) and can also call into a `helpers` object to mutate timers, persist state across runs, hide platform-specific buttons / feed cards, or set sub-section timers.

`Custom` groups don't show: blocking behavior, blocked sites, allowed minutes, reset interval, schedule days, or time windows. They keep the **Blocking Rules** editor plus standard freeze/snooze controls. There is also a **Templates** button that opens a preset browser with parameterized starter rules; applying a preset replaces the current rule after confirmation.

See **Section 11** for the full custom rules reference and helpers API.

---

## 6. Blocking behavior

For most group types you choose one of two modes:

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

---

### 6.3 Timer (count down, then block)

This mode shows a countdown timer and blocks once it reaches `0:00`.

- **Timer reset interval (hours)** (decimal): both the timer length and the reset frequency. Example: `24` for daily, `1` for hourly, `0.25` for every 15 minutes.

Unlike **Block after a number of minutes**, this mode does **not** have a separate "Allowed minutes before block" field. The timer simply starts at the reset interval, counts down while matching pages are open, then blocks until the next reset.

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

This applies to all group types except `Custom`.

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

Snooze temporarily disables a group without unfreezing it, but now supports delayed activation, post-snooze cooldown, confirmation steps, and a running total of snoozed time.

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

---

## 10. Bulk actions

- **Delete All** removes every group.
  - It always asks for confirmation.
  - If at least one group is frozen, it requires the same 20-step ritual as unfreezing.
  - If any group is strict-frozen and still locked, **Delete All** is disabled.

---

## 11. Custom groups — event-driven reference (v1.1+)

Starting with v1.1, custom rules are **event-driven**. Your rule is no longer a per-heartbeat function whose return value blocks the page. Instead, the rule body is a script that **registers handlers** for specific events (page open, URL change, tick, custom events, …). The handlers stay registered across page navigations and tab switches and live inside a long-lived offscreen sandbox.

The rule body executes **once per Run click** (or once when the group is enabled and an active source already exists). To re-load handlers, click **Run** in the editor.

### 11.1 Rule signature

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Two arguments:

- `event` — the **events registry** for this group. Use it to register, override, list, count, or unregister handlers, and to `post(...)` custom events.
- `helpers` — the helper bundle (see 11.3).

The function is **not** expected to return a value. The decision to block or allow is made later, when an event fires and one of your registered handlers calls `ev.preventDefault()` and/or `ev.setResult(...)`.

### 11.2 Lifecycle

- **Run** (per-group button in the editor): the engine first wipes every handler that was previously tagged with this group, then re-runs the rule body in every open tab's view of the offscreen sandbox. This is the only way to re-register after editing the source.
- **Disable group**: every handler tagged with this group is wiped. The group source is kept in storage but stops responding to events.
- **Re-enable group**: the engine automatically re-runs the active source for this group.
- **Delete group**: same as disable; all handlers tagged with the group are wiped.
- **Re-registering with the same `(eventType, id)`**: silently overrides the previous registration.

The offscreen sandbox is shared by **all** custom groups. Handlers from different groups co-exist there, each tagged internally with their owning group id so that "Run", disable, or delete only touches the right group.

### 11.2.1 The events registry (`event`)

Generic methods:

- `event.register(type, id, handler, options?)` — register a handler for an arbitrary event type. `id` is your own choice. `options.priority` (default `0`) — higher runs first. `options.intervalMs` — for `tickEvent` only; throttle this specific handler (the global tick is once per second). Re-registering with the same `(type, id)` overrides.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — fire a custom event. `scope: "global"` reaches every group; default `scope: "group"` only reaches handlers in the **same** group.

Per-event-type sugar (one set of methods per built-in type):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Same shape for `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Built-in event types

| Type | When it fires | `ev.data` payload |
|---|---|---|
| `tickEvent` | Universally shared 1-second tick across every open tab. Handlers run for every tab in priority order. | `{ intervalMs: 1000 }` |
| `openWebEvent` | A new tab is created OR a fresh navigation lands on a URL the engine has not seen for that tab yet. Does **not** re-fire for already-open tabs after a Run click. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | A tab is closed. | `{ reason, nextUrl }` |
| `switchWebEvent` | URL **changes** inside the same tab — back/forward, SPA route change, or a navigation that lands on a different URL than before. Does **not** fire on a plain reload (same URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | URL change crosses a hostname boundary (e.g. `youtube.com` → `wikipedia.org`). Fires alongside `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | The page (re)loads in any way: open, switch, SPA history update, **or a plain reload that keeps the same URL**. This is the reliable "the page changed, re-evaluate everything" hook. Fires alongside `openWebEvent` / `switchWebEvent` / `switchDomainEvent`, and is the only one that fires for same-URL reloads. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` where `transition` is `"tabCreated" \| "commit" \| "history"` |
| `timerEnded` | A timer managed by the group reaches `currentMs === 0`. Only delivered to the owning group. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | The user pressed **Start Snooze** in the popup for this **custom** group. Pure notification event — the handler can run arbitrary code (log, redirect, fire other events) but custom rules have **no programmatic snooze API**. Logs produced here surface as toasts on the active tab. Only delivered to the pressed group. | `{ triggeredAt }` |

URLs in `ev.url` and in event data are **normalized** for events: Chrome's New Tab Page (which renders Google's "Search Google or type URL" surface), `about:blank`, and equivalent newtab schemes are exposed as the empty string `""`. So a timer scoped to `ev.url === ""` only ticks while you are on the new-tab page. Regular `google.com` URLs are unchanged.

### 11.2.3 The event object (`ev`)

Every handler is invoked as `(ev, helpers) => void`. `ev` carries:

- `ev.type` — the dispatched event type.
- `ev.groupId` — the receiving group's id.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — context for the event.
- `ev.time` — `{ now, month, dayOfMonth, dayName, hour, minute }` snapshot at dispatch.
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

Accessor methods:

- `helpers.getLogHelper()` — `log/warn/error`, prefixed with `[CustomBlocker:groupId]`.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`) — URL inspection (see 11.3.5).
- `helpers.getTimerHelper()` — group-scoped timers (countdown / count-up); state persists across browser restarts.
- `helpers.getPersistenceHelper()` — JSON key/value store scoped to the group.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (and `set/get` aliases) plus `createMessageUrl(message)` which returns a `chrome-extension://...` URL that displays the given message. For custom rules, this is the **only** way to set the "redirect when blocked" URL.
- `helpers.getPlatformHelper()` — per-platform DOM intents (see 11.3.6).
- `helpers.getDOMHelper()` — generic DOM intents: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Operations are batched and applied after the handler returns.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Effects are applied to the tab the event came from.
- `helpers.getStorageHelper()` — superset of `getPersistenceHelper` plus async `requestAsyncGet(key)` / `requestAsyncSet(key, value)` hooks for cross-extension storage (results arrive as a follow-up custom event).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` against a snapshot bundled with the event.

All helper methods are safe: bad parameters return `null`, `false`, or an empty value instead of throwing.

#### 11.3.1 `getTimerHelper()`

Per-group timers. Each timer is identified by a string `id` you choose; identity is scoped to the group, so two groups can both use the id `"yt-shorts"` without colliding. State persists across browser restarts.

A timer's persisted state is exactly: `id`, `displayName`, `direction` (`"forward"` or `"backward"`), `isPaused`, and `currentMs`. There is no stored "initial duration" — `isExpired` is just `currentMs === 0`. Forward timers tick up forever and never expire on their own.

There are two construction methods. Pick the one whose semantics match what you want; this matters because rules typically run every heartbeat.

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **always (re)creates** the timer with the supplied init values, overwriting any existing state including `currentMs`. Use this when you mean "start fresh", e.g. inside a one-shot reset branch. If a rule calls `create` every heartbeat with the same `id`, the timer will reset every heartbeat and effectively never advance.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotent**. If a timer with that `id` already exists, its `displayName` and `direction` may be updated but `currentMs` is preserved. Otherwise it's created with the supplied init values. This is what you want for the common "ensure my timer exists, then let it tick" pattern.

Both methods accept two **transient** predicates that are evaluated this heartbeat only — they are never persisted:

- `scope: (url) => boolean` — when `true` for the current URL, the timer auto-ticks by the heartbeat interval (the same delta the default block group's usage timer uses, so the speeds match). At most one auto-tick per heartbeat across all rules in the group.
- `domain: (url) => boolean` — when `true` for the current URL, the timer is rendered in the in-page overlay (top-left). When `domain` is omitted, the system falls back to `scope` for display, so a "tick on /shorts/ pages" timer also shows up there with no extra wiring. Provide `domain` explicitly if you want a different display gate (e.g. tick only on `/shorts/`, but show the remaining time across all of `youtube.com`).

Other methods:

- `delete(id)`, `pause(id)`, `resume(id)` — standard lifecycle. Pause freezes `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — direct mutators.
- `setDisplayName(id, name)` — relabel.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` iff `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` or `null`.
- `list()` — every timer this group owns, as an array of state objects.

#### 11.3.2 `getPersistenceHelper()`

Map-like storage scoped to your group. Values must be JSON-serializable.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Soft limits: about 200 keys per group, 16 KB per value.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — write to the **page console** (since rules now run in the content script). Each line is prefixed with `[CustomBlocker:groupId]`.

#### 11.3.4 `getRedirectionHelper()`

Inspect / override the redirect URL the content script will use if the current page ends up blocked.

- `get()` — returns the current effective redirect URL for this heartbeat. Initially this is the built-in group's configured fallback URL (if any), otherwise `""`.
- `set(url)` — overrides that redirect URL for this heartbeat. Returns `true` on success, `false` for non-string input. Passing `""` clears the redirect override and falls back to the normal default exit behavior (`main page` / `about:blank` depending on context).
- `createMessageUrl(message)` — returns a `chrome-extension://<id>/message-page.html?msg=...` URL that, when navigated to, displays the message centred on a clean page. Useful for redirecting users to a "Go Work" / "Take a break" screen after a timer ends. Example: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Like the other custom-rule side effects, this state is shared across all rules in the current heartbeat. Because rules run bottom-to-top, the top-most rule to call `set(...)` wins.

#### 11.3.5 `getDomainHelper()` (alias `getDomainUtility()`)

URL inspection helpers. There is no `normalize()` because incoming URLs are already newtab-normalized.

Core:

- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — each returns `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

URL filtering and section helpers (new in v1.1):

- `isEmptyStartPage(url)` — `true` for the new-tab page and equivalents (the URLs that show up as `""` to handlers).
- `matchesAny(url, patterns)` — `patterns` may be a regex, a string regex, or an array of either.
- `pathStartsWith(url, path)` — boundary-aware (`pathStartsWith("/r/", "/r")` is true; `"/results/"` is not).
- `queryHas(url, key, value?)`, `queryGet(url, key)` — query-string inspection.
- `isSearchPage(url)` — recognizes Google / Bing / DuckDuckGo / YouTube results / Reddit / Twitter / X searches.
- `isInfiniteFeedUrl(url)` — recognizes the algorithmic-feed surfaces of YouTube, TikTok, Instagram, Facebook, Reddit, X.
- `sameSection(a, b)` — same hostname AND same first path segment.

#### 11.3.6 `getPlatformHelper()`

Per-platform DOM intents and sub-section timers, plus inspection. Each `helpers.getPlatformHelper().<platform>()` returns an object whose method set is **gated by the platform** — methods that don't make sense on a given platform are simply absent, so calling them throws `TypeError: ... is not a function` rather than silently no-op'ing. For example, `twitch().hidePosts` does not exist (Twitch has no posts), and `tiktok().hideShortButton` does not exist (TikTok's whole experience already _is_ short-form video). Use `helpers.getPlatformHelper().hasMethod(platform, name)` or `.listMethods(platform)` to introspect at runtime.

Per-platform method matrix:

|                                | youtube | tiktok | instagram | facebook | twitch |
|--------------------------------|:-:|:-:|:-:|:-:|:-:|
| `hideShorts` / `showShorts`    | ✓ |   |   |   |   |
| `hideReels` / `showReels`      |   |   | ✓ | ✓ |   |
| `hideClips` / `showClips`      |   |   |   |   | ✓ |
| `hideStreams` / `showStreams`  |   |   |   |   | ✓ |
| `hideVideos` / `showVideos`    | ✓ | ✓ |   | ✓ | ✓ (VODs) |
| `hidePosts` / `showPosts`      | ✓ |   | ✓ | ✓ |   |
| `hideShortButton` / `showShortButton` | ✓ |   |   |   |   |
| `hideHomePage` / `showHomePage`| ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (chat) |
| `filterComments`               | ✓ | ✓ | ✓ | ✓ |   |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |   | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |   |   |   | ✓ |
| `isCurrentChannelVerified`     | ✓ |   |   |   |   |
| `isLiveNow`                    | ✓ | ✓ |   | ✓ | ✓ |
| `isItemLive`                   | ✓ | ✓ |   | ✓ | ✓ |
| `isAlgorithmicRecommendation`  | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored`                  | ✓ | ✓ | ✓ | ✓ |   |
| `setShortsTimer`               | ✓ |   |   |   |   |
| `setReelsTimer`                |   |   | ✓ | ✓ |   |
| `setClipsTimer`                |   |   |   |   | ✓ |
| `setStreamsTimer`              |   |   |   |   | ✓ |
| `setVideosTimer`               | ✓ | ✓ |   | ✓ | ✓ |
| `setPostsTimer`                | ✓ |   | ✓ | ✓ |   |

The platform-native names (`hideReels`, `hideClips`, `hideStreams`) are NOT separate buckets from `hideShorts` / `hideVideos` — the storage slot is the same; only the user-visible name follows each platform's terminology.

> **Predicate lifetime & single-slot rule.** Each of `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` owns **one** persistent predicate per `(group, platform, slot)`. The predicate is **not** scoped to the current event — once you set it, it stays active across every page load and every dispatch until either the matching `show*()` is called or the group is unloaded. Calling the same method again with a new function **replaces** the previous one — the engine never OR-merges multiple predicates within a single group. To combine conditions, write one predicate that does the combining yourself, e.g. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. (Across **different** groups, each group contributes its own predicate and an item is hidden if any group's predicate matches.)

Inspection methods take their value at dispatch time from a snapshot bundled with the event; their availability is gated by the matrix above.

URL classifiers are always re-exposed regardless of platform: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.

Sub-section timers register the timer in the persistent group bucket and, when scoped, only tick on URLs that match that subsection. The timer methods accept `{ id, direction, currentMs, displayName }` and follow the same per-platform gating.

For predicate methods, the predicate is called per matching card with a normalized `item`: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Any field can be `null`; "innocent until proven guilty" — return `false` when the field you need is missing.

### 11.4 Examples

Easy — block YouTube Shorts pages on weekday mornings:

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

Medium — 30-minute daily budget for YouTube Shorts, with a redirect to a focus page when expired:

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts"
  });

  // Tick down once per second while the active page is a Short.
  event.registerTickEvent("budget-tick", (ev, h) => {
    if (!yt.isShortUrl(ev.url)) return;
    h.getTimerHelper().addMs(TIMER_ID, -1000);
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

Harder — hide individual YouTube Shorts whose author handle is too long, and inject a "this Short is hidden" CSS:

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
}
```

Hardest — broadcast a custom event from one handler to others:

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

## 12. Multi-page behavior

- All open tabs in the same group share the same timer.
- When you switch to a tab in the same group, its overlay refreshes immediately to show the current shared time.
- When a new rule is added, every open page detects the change and refreshes within a fraction of a second; you do not need to reload tabs manually.
- When a rule expires, hidden feed cards and nav buttons are restored on the next refresh.

---

## 13. Internationalization

The whole UI is fully translated. Use the **Language** picker in the top right.

Supported languages include English, Chinese (Simplified), Spanish, Japanese, Korean, plus partial coverage for Hindi, Arabic, Bengali, Portuguese, Russian, Punjabi, German, French, Turkish, Vietnamese, Italian, Thai, Dutch, Polish, Indonesian, Urdu, and Persian. Languages with partial coverage fall back to English for missing strings.

The instruction manual itself loads the markdown file matching your selected language, with English as a fallback.

---

## 14. Status messages

Status messages appear as a centered toast that fades out after about two seconds:

- "Saved changes."
- "Created \"Group name\"."
- Validation errors like "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

For input fields with format requirements, the message also appears next to the relevant button (for snooze).

---

## 15. Privacy and storage

- Everything is stored locally in `chrome.storage.local`. No data is sent anywhere.
- Stored items include: your groups, usage timers, last reset times, snooze records, custom timers, and custom persistent values.
- The extension does not read page content beyond what is needed to detect the page type (path/hostname/known DOM markers for video sites). It does not read your messages, posts, comments, or private content.

---

## 16. Permissions

- `storage` — for the data above.
- `declarativeNetRequest` — for native blocking of `Default` groups.
- `alarms` — to schedule rule transitions efficiently.
- `host_permissions: <all_urls>` — so the content script can show the timer overlay and detect platform context on any page.

---

## 17. Troubleshooting

- **A group I added does nothing.** Make sure the group is enabled, the schedule allows it now, no snooze is active, and (for platform groups) the page actually matches the chosen content type and author filter.
- **A timer is stuck or wrong on one tab.** Switch away and back, or focus the tab — that triggers a forced refresh from the shared timer.
- **Feed cards reappear after I think they should be hidden.** Feed hiding only runs while the rule is actively blocking. If you have an `after-minutes` rule, feed hiding kicks in once your time hits zero.
- **A YouTube nav button I expected to be hidden is still there.** Nav hiding requires the rule to be set to "do not filter by author" and the content type to be Shorts or YouTube posts. With author filters, hiding is per-card only.
- **Custom rule did nothing or threw silently.** Custom rules now run in the page itself. Open the page's DevTools (right-click → Inspect → Console) and look for `[CustomBlocker:groupId]` messages. Use `helpers.getLogHelper().log(...)` to trace your rule.
- **I cannot delete a group.** It is probably frozen. Strict-frozen groups cannot be deleted at all until their lock expires; non-strict frozen groups can be deleted via the unfreeze ritual.

---

## 18. Glossary

- **Block group** — one rule set with its own type, behavior, schedule, and freeze/snooze.
- **Instant block** — the rule blocks immediately whenever it is active.
- **After-minutes block** — the rule starts blocking only after the time budget for the period is exhausted.
- **Reset interval** — how often the after-minutes budget resets.
- **Schedule** — days + time windows during which a group is active.
- **Freeze / Strict freeze** — anti-tampering states.
- **Snooze** — temporary disable with a configurable confirmation ritual.
- **Author filter** — for platform groups, restricts the rule to certain content creators.
- **Content type** — for platform groups, restricts the rule to certain forms of content (short, long, post).
- **Helpers** — utilities passed to a custom rule's function.
- **Platform** — one of `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Each has its own group type and feed hiding logic.

---

## 19. Limitations

- Feed hiding depends on each platform's current DOM. If the platform changes its layout, the hiding selectors may need to be updated.
- Platform context detection for non-YouTube sites is mostly URL-based, so it is most reliable on canonical content URLs.
- Custom rules run in the content script of every page, so two tabs editing the same per-group timer concurrently use a "last write wins" strategy. For typical use this is fine; if you depend on exact accounting, expect occasional small drift.
- Predicates passed to `hideShorts/hideVideos/hidePosts` are evaluated synchronously per feed card. Heavy logic in a predicate can slow down feed scrolling; keep them cheap.
- The browser may suspend the background service worker when idle. The extension resumes it as soon as a page or alarm needs it; site/timed usage budgets keep counting via heartbeat replay.
