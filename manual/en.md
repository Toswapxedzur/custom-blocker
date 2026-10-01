# Vault browser extension manual

Vault blocks websites and supported platform content in the browser profile where it is installed. It needs permission to access the websites you want it to control. It cannot block native apps, override browser permissions, or guarantee that platform controls survive changes made by a website.

## Blocking groups

A **blocking group** applies one blocking policy to its selected targets. It is distinct from a **Classifier group**, which assigns tags to content.

- Add a group, give it a unique name, and choose its targets under **Applies to**. Targets in the same group share its schedule and time allowance.
- Routine field edits save automatically. Custom-rule source takes effect when you press **Run**.
- Disable a group to stop its policy while keeping its settings. Use **Delete group** to remove it. Import replaces the selected group's configuration after confirmation; Export copies its configuration as a group string.
- Drag groups to reorder them. Multiple blocking groups can apply to the same target; snoozing one does not remove another group's block.

### Time allowance and schedule

**Block immediately** applies whenever the enabled group matches and its schedule is active. **Block when the time allowance is used** allows matching use until the allowance runs out.

Set the allowance in minutes and its reset interval in hours. The rolling-limit option counts use within the preceding window rather than resetting the whole allowance periodically. The midnight option resets the period at local midnight.

Choose active weekdays and optional local-time windows, one per line, such as `09:00-12:00`. An empty window list applies throughout the selected days. A window's end must be later than its start on the same day; split an overnight schedule into separate days. Custom rules make their own scheduling decisions.

### Snooze

Configure snooze separately in each blocking group. New groups start with 30 minutes; there is no global duration setting.

- **Pause blocking** makes that group temporarily inactive for the configured pause duration.
- **Add to the time allowance**, available for time-limited groups, adds usable minutes instead of pausing blocking. Only consumed extra allowance counts as snoozed time. Unused extra time expires at the next allowance reset; for a rolling limit, it expires after one rolling window, or sooner at midnight if enabled.
- **Activation delay** postpones the effect; the group still applies while the request is pending.
- **Cooldown** controls how long you must wait after snooze ends before requesting another one.
- **Required confirmations** sets how many confirmation steps are needed.

The Snooze button on a custom-rule group sends its rule a `"snooze"` event. The rule decides what to do; normal-group snooze settings do not apply.

### Freeze and PIN

**Freeze** prevents routine edits. A frozen group has combined conditions for unfreezing rather than separate freeze modes:

- **Wait before unfreezing**: 0 means no wait; the maximum is 72 hours.
- **PIN**: when set, the group's six-digit PIN is required.
- **Confirmations**: every unfreeze requires ten confirmations, five seconds apart.

While frozen, the wait can be extended and a PIN can be added where none was set. These conditions cannot be weakened until the group is unfrozen. Snooze remains available only if it was allowed before freezing.

### Linked groups

Link explicitly selected groups through the local Vault bridge. Linked groups share supported policy and usage fields while the participating programs are connected. Browser-only and native-only actions still depend on the program enforcing them. An offline member can prevent coordinated edits; open the linked program to restore synchronization. Unlinking keeps the local group.

## Custom rules

A rule is one JavaScript function expression, `(on, v) => { ... }`. It registers event handlers rather than returning a decision on every tick. **Run** replaces its previous handlers. Disabling the group suspends its handlers and lifts its effects; enabling it resumes the loaded rule.

`v.state` holds the group's persistent JSON state. `v.log(...)` is the only source of entries in that group's **Log** panel. Logs are segregated by group. A run failure is shown by the Run status, not injected into Log.

Use **Write with AI**, describe the desired behavior, and **Copy AI prompt** to copy your request, current source, and the supported API reference. Paste the prompt into your AI tool, then paste its generated rule back into Vault and press Run.

Rules run in a sandbox. They have no direct network, DOM, or timer access. Use only the actions and events listed below. Select a **Custom-rule folder** in Settings for `v.file` access to `.txt`, `.csv`, and `.json` files. Paths stay inside that selected folder.

## Website and platform targets

Add domains or full URLs, one per entry. A domain matches its subdomains; a path limits matching to that path and its descendants. **Block everything except these sites** makes the list an allowlist.

Platform targets can filter supported content types and sources. YouTube and video platforms use **Creators**, Twitter / X uses **Accounts**, and Reddit uses **Communities** (subreddits). Discord uses server and channel IDs. Controls work where Vault can identify the source and content type.

Each target can cover a matching page or pause first and offer Continue after a countdown. A matching blocking target takes precedence over a pausing target within the same group. **When blocked: redirect address or message** accepts a web address or cover message. Blank means the page is covered in place. A pause never redirects.

Content controls hide supported parts of a platform page, such as ads or video cards. These are page changes, not network blocks.

### Content tag filters

Connect Mac Vault's Classifier to obtain tags. A blocking group's tag filter decides what to cover or hide; it does not activate or pause tagging. Classifier Settings controls tagging globally, and each Classifier group can pause independently.

A filter can target certain tags or everything except certain tags. Rules can combine tags (`Gaming + Drama`), require a minimum confidence (`Gaming @3`), or make an exception (`!Tutorial`). **Cover content** leaves tags editable; **Hide content** removes the matching item. Options can include untagged content, cover matching content pages, or cover items until tagging finishes.

**Untagged** means tagging finished without a tag. **Tagging** means a result is pending. A failed lookup does not create an Untagged tag.

## Settings

Vault settings apply across blocking groups. Enable **Show the quick-add +** to choose a target group with its + badge and add the current page to that group's website list. On an allowlist, this allows the added page. Frozen groups do not accept quick additions.

The extension's Classifier connection reports the locally connected Mac Vault service. Classifier groups, models, web research, and API providers are configured in Mac Vault.

## Supported custom-rule API

- CUSTOM RULE API — use only what is listed; there are no other helpers.

- A rule is ONE JavaScript function expression: (on, v) => { … }. It runs once when the user presses Run: register handlers there. Run replaces the old handlers; deleting the group removes them. While the group is disabled no handler runs and what the rule did is lifted (its panels, style sheets, covers, blocks); enabling it resumes the rule as it was.

- on(type, handler) adds a handler; several per type are fine. handler(ev) gets ev = { type, now (ms since 1970), data }. Handlers are synchronous and must finish within 1 s: no loops that wait, no network, no timers, no DOM of your own (you run in a sandbox).

- v.state is the group's memory: one JSON object (≤ 64 KB), kept across restarts and across Run (a new version of the rule finds what the old one saved), deleted with the group. Change it freely inside handlers.

- v.log(...values) writes to the group's log in the editor.

- v.emit(type, data) delivers a "type" event with that data to this group, right after the current one.

- v.panel(id, spec, tabId?) shows a panel (spec = { title, description, position: top-left|top-right|bottom-left|bottom-right|center, layout, width: small|medium|large, controls: [...] }); calling again replaces it; v.panel(id, null) removes it. Controls: { id, type, label, value, ... } with type text (text), html (html, sanitized; inherits Vault colors/font and discards CSS), button (action submit|cancel|close), checkbox, toggle, select / radio (options), textInput / textarea (placeholder), numberInput / range (min, max, step), date, time, color, pin (length, masked), section (controls). Interactions arrive as "panel" events: data = { panelId, controlId, eventName, value, values }.

- v.file(op, path, payload?) uses the folder the user chose in Settings (.txt, .csv, .json; paths relative to it): op read | write | append | list | exists. It returns a request id; the answer arrives as a "file" event: data = { requestId, ok, op, path, text, entries, exists, error }.

- Other events: "snooze" (the user pressed the group's Snooze), plus every type you v.emit.

- Limits per event: 256 actions, 200 log entries, 64 emits; 24 panels of 32 controls per group.

- ENGINE: the browser extension. It controls the browser only (never apps).

- "tick" every second: data = { tabs: [{ tabId, url, active }] }.

- "tab" when a tab opens, goes to an address or closes: data = { kind: open | navigate | close, tabId, url, previousUrl }.

- "visible" while a page is visible: data = { tabId, url, elapsedMs } (the visible time since the last one).

- "items" as a platform page (YouTube, Reddit, Bilibili, X…) shows items, each new or changed item once: data = { tabId, platform, items: [{ ref, url, title, authors, videoForm: short|long|post|unknown, tags: [{ name, confidence 1–5 }], tagsSettled, isPage }] }. The page itself is the item with isPage true (ref "page", title = the page's title); act on it with v.cover. tags come from Mac Vault's local classifier; tagsSettled is false until it answered — decide nothing about tags before that.

- v.item(tabId, ref, verdict) hides ("hide"), covers ("dim") or rescues ("allow") a feed item; null clears it. Groups higher in the list win.

- v.cover(tabId, on, message?) covers the page in place (or lifts it); a new address lifts it.

- v.go(tabId, url | "back" | "forward" | "reload") navigates. v.close(tabId) closes the tab.

- v.css(tabId | "*", id, css | null) adds (or removes) a style sheet: on a tab's page until the tab goes to another address, or ("*") on every page, pages opened later too.

- v.dom(tabId, selector, op, arg?) acts on the page's elements: op hide | show | click | setText (arg) | addClass (arg) | removeClass (arg) | scrollTo.

- v.query(tabId, selector) reads the page: it returns a request id; the answer arrives as a "query" event: data = { requestId, tabId, url, selector, matches: [{ tag, text, href, src, title, label, value }] (at most 50, text ≤ 1000 characters), error }. A tab without a web page never answers.

- EXAMPLE: (on, v) => { on("items", (ev) => { for (const item of ev.data.items) if (item.tagsSettled && item.tags.some((t) => t.name === "Gaming" && t.confidence >= 4)) v.item(ev.data.tabId, item.ref, "dim"); }); }
