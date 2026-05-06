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

## 11. Custom groups (full reference)

A `Custom` group runs a JavaScript function inside the **content script** of every page the user visits. The function is called once when the page loads and once on every heartbeat (~250 ms). Its return value decides whether the page is blocked, and its side effects on the `helpers` object decide what happens to the DOM and to the per-group timer / persistence state.

Because the function runs in the page itself (not in the background worker), every closure variable you declare inside the function is reachable from the predicates you pass to `hideShorts`, `hideVideos`, and `hidePosts`.

### 11.1 Function signature

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  // your logic
  return 0;
}
```

Parameters:

- `month` — `1` to `12`.
- `dayOfMonth` — `1` to `31`.
- `dayName` — for example `"Monday"`.
- `hour` — `0` to `23`.
- `minute` — `0` to `59`.
- `url` — the current page URL as a string. Already normalized; pass it directly into `helpers.getDomainUtility()` methods.
- `helpers` — a bundle of helper accessors (see below).

Return value:

- `-1` — block the page.
- `0` — no decision; pass to the next rule.
- `1` — allow.
- any other integer in `[-255, 255]` — preserved as a custom state for debug / future logic, but the engine does not treat it as block or allow yet.

Rules still run bottom-to-top. The **last non-zero state wins**, so a top rule can override a lower rule's `-1` with `1`, or vice versa. Independently of the numeric return state, helper side effects still apply: feed-card hides still hide cards, timers still tick, etc. The one exception is page-exit intents created by custom rules (`hideHomePage()`, `blockPageOnVisit`) — a final return state of `1` suppresses those custom-rule page exits for that heartbeat.

The popup does **not** validate syntax automatically while you type — that would constantly flag half-finished edits. Click the **Check syntax** button next to the Blocking Rules textarea to validate on demand. The button does three things:

1. Flushes any pending autosave so the rule actually shipped to storage by the time the result appears (you don't have to wait for the 400 ms debounce or trust that switching tabs commits in time — leaving the textarea also flushes immediately on blur).
2. Compiles the source in a sandboxed iframe (Chrome forbids `new Function` in normal extension pages).
3. Runs a one-shot smoke test by invoking the compiled function once with dummy arguments and a *typed* `helpers` stub that mirrors the real API exactly. This catches typos and `ReferenceError`s on the always-executed path: `return truel;`, `helpers.nah()`, and `helpers.getPlatformHelper().myspace()` are all reported. The stub is deliberately not a wide-open Proxy — that would let arbitrary typos succeed silently. Branches that the dummy inputs don't exercise are still **not** validated; only code that runs with the stub helpers is checked.

Invalid rules are still saved as text; the content script silently skips any rule that fails to compile. If your function throws at runtime, the extension catches it, logs to the page console (prefixed with `[CustomBlocker:groupId]`), and the remaining rules in the same heartbeat continue.

Every page that has at least one in-scope custom rule shows a **debug overlay** in the bottom-right corner. For each rule it lists the group name, the source the content script is actually running, and the value the most recent heartbeat returned (`true`, `false`, or the runtime error message). Click the `×` in the overlay header to dismiss it for the rest of that page session; reload to bring it back.

### 11.2 Execution model

- Custom rules execute in **bottom-to-top** storage order. The bottom-most group runs first; the top-most group runs last and gets the "last word" on intents (see show/hide semantics below).
- The content script does not compile or run rules itself. Chrome's default extension CSP forbids `new Function`/`eval` everywhere except sandboxed pages, so the content script ships a hidden iframe of `sandbox.html` into each page and routes every heartbeat's rule batch through `postMessage`. The iframe loads `helpers.js` and runs the rules; the result, the mutated timer/persistence buckets, and the accumulated DOM intents come back over `postMessage`. The content script then applies intents to the page DOM and decides whether to exit.
- Because rule execution is a `postMessage` round-trip, the first block decision after a fresh page load lags by a fraction of a second (typically <50 ms). Subsequent heartbeats hit the iframe's compiled-source cache and are essentially instant.
- Mutations you perform on `helpers.getTimerHelper()` and `helpers.getPersistenceHelper()` are flushed back to the background service worker on the next heartbeat. Two tabs running rules concurrently use a "last write wins" strategy — perfectly fine for the typical case but worth knowing.
- Custom groups **no longer contribute to the network-level (`declarativeNetRequest`) blocklist**. Only `Default` (site) groups produce native `ERR_BLOCKED_BY_CLIENT` blocks. Custom rules block by exiting the page from the content script.
- A rare failure mode: if the host page enforces a strict `frame-src` CSP that excludes `chrome-extension:`, the sandbox iframe will fail to load and the debug overlay will surface that error. Custom rules simply won't run on those pages; site/timed groups still work normally.

### 11.3 The `helpers` object

`helpers` exposes a few accessor methods plus three constant fields:

- `helpers.now` — current epoch time in milliseconds.
- `helpers.elapsedMs` — milliseconds since the previous heartbeat in this tab. Useful if you're advancing a timer manually.
- `helpers.currentUrl` — same as the `url` parameter; provided for convenience inside predicates.
- `helpers.getTimerHelper()`
- `helpers.getPersistenceHelper()`
- `helpers.getLogHelper()`
- `helpers.getRedirectionHelper()`
- `helpers.getPlatformHelper()`
- `helpers.getDomainUtility()`

All helper methods are designed to be safe: bad parameters return `null`, `false`, or an empty value instead of throwing.

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

Like the other custom-rule side effects, this state is shared across all rules in the current heartbeat. Because rules run bottom-to-top, the top-most rule to call `set(...)` wins.

#### 11.3.5 `getDomainUtility()`

URL inspection helpers. The merged replacement for the old `domainHelper` + `platformHelper`. There is no `normalize()` because incoming URLs are already normalized — pass them straight in.

- `hostnameOf(url)` — returns `"youtube.com"`, etc., or `null`. Strips `www.`.
- `pathnameOf(url)` — returns `"/"` if absent.
- `matches(hostname, site)` — `true` if `hostname` is `site` or a subdomain of it.
- `getPlatform(url)` — `"youtube" | "tiktok" | "instagram" | "facebook" | "twitch" | null`.
- `isYouTubeHost(host)`, `isTikTokHost(host)`, `isInstagramHost(host)`, `isFacebookHost(host)`, `isTwitchHost(host)`, `isRedditHost(host)`, `isDiscordHost(host)`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — each returns an object with the same shape:
  - `isPlatformUrl(url)`, `isShortUrl(url)`, `isVideoUrl(url)`, `isPostUrl(url)`, `isHomePage(url)` — booleans.
  - `extractAuthor(url)` — normalized handle (e.g. `"mkbhd"`, `"channel:UC..."`, `"id:1234"`) or `null`.
  - `extractVideoId(url)` — platform-specific id (`v=...`, the path segment, etc.) or `null`.

#### 11.3.6 `getPlatformHelper()`

Per-platform DOM intents and sub-section timers. Use these to do everything a built-in `YouTube` / `TikTok` / etc. block group can do — and more, because you can drive them from arbitrary JavaScript.

The helper itself has one method per platform:

- `helpers.getPlatformHelper().youtube()`
- `helpers.getPlatformHelper().tiktok()`
- `helpers.getPlatformHelper().instagram()`
- `helpers.getPlatformHelper().facebook()`
- `helpers.getPlatformHelper().twitch()`

Each returns an object with the methods listed below. Where a method takes a `predicate`, the predicate is called once per matching feed card with an `item` shaped like:

```ts
{
  url:          string | null,  // canonical URL of the item
  name:         string | null,  // title / caption
  author:       string | null,  // normalized author handle
  length:       number | null,  // seconds
  views:        number | null,
  publishedAt:  string | null,  // free-form, e.g. "3 days ago"
  description:  string | null
}
```

Any field can be `null` if the page DOM doesn't expose it. The "innocent until proven guilty" rule applies: if a field a predicate cares about is `null`, the predicate should return `false` (don't block). The system never calls a predicate when it can't even produce an `item`.

Methods on each platform helper:

- `hideShortButton()` / `showShortButton()` — hide or restore the platform's "Shorts" / "For You" / "Reels" / "Clips" entry points. On YouTube specifically this matches the YouTube block group's `videoMode: short, authorMode: none` behaviour: the side-nav `Shorts` button (regular guide, mini guide, mobile pivot bar, channel-page tabs) **and** the in-feed Shorts shelves on home / subscriptions / search are all hidden. On other platforms it hides the nav anchor and its closest navigation-row container.
- `hideHomePage()` / `showHomePage()` — when the user is on the platform's home feed (`/`, `/feed/...`, `/foryou`, etc.), `hideHomePage()` exits the page. `showHomePage()` undoes this for groups above.
- `hideShorts(predicate, opts?)` / `showShorts()` — hide individual short-form videos in the feed. Each call adds a predicate; cards are hidden if **any** active predicate returns `true`. `showShorts()` clears all hide predicates registered by groups below.
  - `opts.blockPageOnVisit: true` — also evaluate the predicate against the current page when the user opens a Shorts URL directly. If it returns `true`, the page is exited.
- `hideVideos(predicate, opts?)` / `showVideos()` — same, for long-form videos.
- `hidePosts(predicate, opts?)` / `showPosts()` — same, for community posts (YouTube / Facebook / Instagram).
- `setShortsTimer({ id, direction, currentMs, displayName? })` — convenience for a per-subsection timer. Equivalent to `helpers.getTimerHelper().getOrCreateTimer({ ..., scope: u => helpers.getDomainUtility().youtube().isShortUrl(u) })`. Treats `youtube.com/shorts/*` as if it were its own website. Because it uses `getOrCreateTimer` internally, calling it every heartbeat is safe — the timer keeps ticking and `currentMs` is preserved.
- `setVideosTimer({ ... })` — same, for long videos.
- `setPostsTimer({ ... })` — same, for posts.

Show/hide semantics (because rules run bottom-to-top): the top-most group's call wins for `hideShortButton`/`showShortButton` and `hideHomePage`/`showHomePage`. For predicate-based hides, every still-active `hideShorts` predicate is OR'd together; calling `showShorts()` from a higher group clears all the `hideShorts` predicates collected so far.

### 11.4 Examples

Easy: hide the YouTube Shorts nav button entirely on weekday mornings.

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);
  if (isWeekday && hour >= 9 && hour < 12) {
    helpers.getPlatformHelper().youtube().hideShortButton();
  }
  return 0;
}
```

Medium: 30 minutes per day on YouTube Shorts, with a visible countdown only while you're actually on a Shorts page.

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  const yt = helpers.getPlatformHelper().youtube();

  const id = yt.setShortsTimer({
    id: "yt-shorts-budget",
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts"
  });

  // Reset the budget at the start of every new local day.
  const persistence = helpers.getPersistenceHelper();
  const today = `${month}-${dayOfMonth}`;
  if (persistence.get("lastDay") !== today) {
    helpers.getTimerHelper().setCurrentMs(id, 30 * 60 * 1000);
    persistence.set("lastDay", today);
  }

  return helpers.getTimerHelper().isExpired(id) ? -1 : 0;
}
```

Harder: hide YouTube Shorts whose author handle is longer than 16 characters, and exit the page if the user opens such a Short directly.

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  var maxAuthorLength = 16;
  helpers.getPlatformHelper().youtube().hideShorts(
    (item) => item.author && item.author.length > maxAuthorLength,
    { blockPageOnVisit: true }
  );
  return 0;
}
```

The closure variable `maxAuthorLength` is captured by the predicate — that's only possible because the rule runs in the page itself.

Hardest: rotating "platform of the day" with per-platform daily caps, plus a forward-counting tracker that records total time spent on social media this session.

```js
(month, dayOfMonth, dayName, hour, minute, url, helpers) => {
  const platforms = ["youtube", "tiktok", "instagram"];
  const today = `${month}-${dayOfMonth}`;
  const persistence = helpers.getPersistenceHelper();
  const timer = helpers.getTimerHelper();
  const domain = helpers.getDomainUtility();

  if (persistence.get("lastDay") !== today) {
    for (const t of timer.list()) timer.delete(t.id);
    persistence.set("lastDay", today);
  }

  const platformOfTheDay = platforms[(month + dayOfMonth) % platforms.length];

  const sessionTotal = timer.getOrCreateTimer({
    id: "social-total",
    direction: "forward",
    currentMs: 0,
    displayName: "Social total",
    scope: (u) => platforms.includes(domain.getPlatform(u))
  });

  const cap = timer.getOrCreateTimer({
    id: "platform-of-the-day",
    direction: "backward",
    currentMs: 20 * 60 * 1000,
    displayName: `${platformOfTheDay} budget`,
    scope: (u) => domain.getPlatform(u) === platformOfTheDay
  });

  return timer.isExpired(cap) ? -1 : 0;
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
