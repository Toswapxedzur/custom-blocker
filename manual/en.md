# Vault extension functional reference

## Purpose and status

This is the authoritative functional specification for the Vault browser extension. It documents the product contract: the data that a user can configure, the exact behaviours that configuration produces, the public Custom-rule language, and the limits that apply to it.

It is deliberately not a quick-start guide. The website tutorial is the learning path. This document is for people who need to configure, test, maintain, audit, or reproduce Vault's user-visible behaviour.

The code is the canonical truth when this document and the product disagree. Names in this document use the product's stored/public vocabulary where practical. A word such as "returns" means the return value made available to a Custom rule; it does not promise a browser-level result if the browser or page refuses the requested action.

## 1. Product boundary

Vault is a focus-control WebExtension. Its unit of configuration is a **block group**. A group can:

- decide that a top-level website, platform page, creator, community, server, channel, or account should be blocked;
- hide configured platform surfaces or matching feed cards;
- measure time spent in a matching scope;
- apply a schedule, freeze protection, or temporary snooze where that group type supports it;
- run a Custom JavaScript rule with an event API;
- show an on-page timer, panel, message, or page log;
- redirect, navigate, close a browser tab, or maintain a session-only rule-created site blocklist;
- optionally participate in a locally connected Vault bridge cluster.

Vault acts only inside the browser profile where it is installed and only where the browser permits its content script to run. It does not:

- install a native application or browser extension;
- block operating-system applications;
- bypass browser permission prompts, private-browsing restrictions, or a website's own security model;
- guarantee selector-based hiding when a third-party platform changes its DOM;
- make Custom-rule state portable across profiles unless the user exports/configures it separately;
- provide a network firewall, a proxy, account control, or a parental-monitoring service.

The following terminology is used throughout:

| Term | Meaning |
| --- | --- |
| Group | One independently named configuration object. Names must be unique within the extension, ignoring case. |
| Site group | A normal group whose domain list is its main matching condition. |
| Platform group | A normal group specialized for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, or Twitter/X. |
| Custom group | A group that owns a JavaScript rule and its event registrations. Its rule decides its behaviour. |
| Match | The page, feed item, or platform surface satisfies a group's configured conditions. |
| Active | The group is enabled, eligible for its schedule, and not currently snoozed. Custom groups are not governed by the normal schedule UI. |
| Block | Prevent the current top-level page from remaining usable, normally by redirecting to its fallback target. |
| Hide | Remove or conceal an element/card in the currently rendered page. Hiding is not a network block. |
| Fallback URL | A group-specific redirect target. If blank, the global fallback is used. |
| Allow/exception effect | A platform-card verdict that rescues matching content from lower-priority hide rules. It is not a general website allowlist. |

## 2. Group model and common lifecycle

Every stored group has a stable id, a name, a type, an enabled flag, and common policy fields. A new normal group is enabled by default. A group can be selected, saved by the editor's autosave behaviour, reordered, exported, imported, frozen, unfrozen, snoozed, disabled, or deleted.

### 2.1 Ordering and overlap

More than one group can match the same page. Vault evaluates stored groups from the end of the displayed list toward the beginning. Treat lower items in the list as later/higher-precedence matches when designing overlapping rules.

For ordinary top-level site blocking, any applicable blocking group can make the page unavailable. For feed-card filtering, the platform cascade uses each matching group's order and effect: a later matching allow/exception can rescue an item from lower-priority blocking predicates. This exception behaviour is limited to the platform-card filtering surface; it does not undo a normal whole-page site block.

### 2.2 Enabled state

Disabled groups are retained but do not participate in normal matching, timers, schedules, or ordinary snooze operations. Disabling a Custom group also unloads its active registrations. Re-enabling does not turn unsaved text into an active Custom rule; run the rule to load the saved source.

### 2.3 Common fields

| Field | Meaning and constraints |
| --- | --- |
| Name | Non-empty, trimmed, and unique case-insensitively within this endpoint. The bridge also identifies linkable groups by name and type, so stable names matter. |
| Enabled | Enables or disables normal matching. |
| Behaviour | Instant block, block after an allowance, or timer/count-up. Custom groups use their own rule rather than this normal behaviour selector. |
| Allowed minutes | Positive number used by the block-after-allowance behaviour. New groups default to 15 minutes. |
| Reset interval hours | Positive number used by timed normal groups. New groups default to 24 hours. |
| Active days | Monday through Sunday. A normal group is inactive when the current local weekday is not selected. |
| Time windows | Zero or more local-time windows, one per line, written as HHMM-HHMM. |
| Freeze mode | None, Frozen, Strict frozen, or Parental frozen. |
| Snooze policy | Whether the group allows snooze, with duration/delay/cooldown/confirmation controls for normal groups. |
| Fallback URL | Destination used if the group blocks a page. |
| Skip to next | When provided in the editor, asks the normal blocking flow to move past the blocked target rather than remain on it. |

### 2.4 Normal group behaviours

The normal editor offers three behaviours:

| Behaviour | Functional result |
| --- | --- |
| Block immediately | Once the group is active and matches, the normal page-block decision is immediate. |
| Block after a number of minutes | Matching visible-page time accrues toward the configured allowance. When the allowance is exhausted, the normal group blocks until its usage period is reset or the group is otherwise inactive/snoozed. |
| Timer (count up, no block) | Matching visible-page time is recorded and can be displayed. This mode never blocks merely because its timer reaches a value. |

Timed usage is based on visible-page time. It is not intended to charge time while a page is hidden in a background tab. The reset interval is a rolling policy interval for the normal timed group. Normal timers are independent by group.

### 2.5 Schedules

Schedules apply to normal groups. A Custom group has no normal schedule UI and is considered active for purposes of its JavaScript; the rule must impose any desired time condition itself.

The active-day policy is evaluated using local time:

1. If the current weekday is not selected, the normal group is inactive.
2. If no valid time windows are supplied, an active day means the full day.
3. If valid windows are supplied, the current local time must be in at least one window.

Each window has the exact form HHMM-HHMM, for example 0900-1200. Hours must be 00 through 23, minutes 00 through 59, and the start must be before the end on the same day. A window includes its start and excludes its end. Cross-midnight windows, such as 2300-0100, are not valid. Empty lines are ignored and duplicate windows are collapsed.

### 2.6 Snooze

For a normal group, snooze is a temporary inactive state with up to three phases:

| Phase | Result |
| --- | --- |
| Pending | The requested snooze exists but has not started because of its activation delay. The group is still active. |
| Active | The group is temporarily inactive for its snooze duration. |
| Cooldown | The snooze has ended, the group is active again, and another snooze cannot start until the cooldown expires. |

Normal-group configuration fields are:

| Field | Rule |
| --- | --- |
| Allow snooze | If off, normal snooze cannot be started. |
| Snooze duration | Positive minutes. A new normal group takes the global default, initially 30. |
| Activation delay | Zero or more minutes. Blank means zero. |
| Cooldown | Zero through five minutes. Blank means zero. |
| Confirmations | A non-negative whole number. The product requires that many confirmation interactions before granting the request. |

A Custom group treats the Snooze button as an input event only. Vault emits the Custom event named snoozePress for that group; it does not apply the normal duration/delay/cooldown fallback on the rule's behalf. A Custom rule can use the event, its own persistence, a panel, a timer, or no action at all.

### 2.7 Freeze

Freezing protects a group from ordinary configuration changes and from normal snooze changes. Choosing a freeze mode in the selector does not freeze the group by itself; the freeze action applies the chosen mode.

| Mode | Functional contract |
| --- | --- |
| Frozen | The group is locked until the product's normal unfreeze confirmation flow completes. |
| Strict frozen | The group cannot be unfrozen until its strict-freeze duration has elapsed. The duration must be greater than zero and no more than 72 hours; a new group defaults to 24 hours. |
| Parental frozen | A guardian password is required for freeze/unfreeze management. The configuration dialog uses a six-digit password. |

Frozen groups cannot be edited through ordinary fields. A bridge-linked cluster with an offline member may also lock freeze controls because Vault cannot safely coordinate the frozen state across the cluster. Freeze is protection against normal UI operations; it does not turn a browser profile into an immutable security boundary.

### 2.8 Import, export, clear, and reset

Export produces a compatible representation of the selected group. Import validates and normalizes compatible group data before adding it. Imported group names must still be unique. Delete group removes that group and its normal usage/snooze state. Clear removes all groups after confirmation.

Reset to defaults is a **global settings** operation. It discards extension-wide preferences; it is not an import/export substitute and should be treated as destructive.

## 3. Group types and matching contract

### 3.1 Default website group

A Site group owns a line-separated website list. Entries are normalized into host/domain form. A host entry matches that host and all of its subdomains.

| Setting | Result |
| --- | --- |
| Block everything except these sites off | The list is a blocklist. A matching host is blocked. |
| Block everything except these sites on | The list is an allowlist. Every host not in the list is blocked. An empty allowlist is therefore an intentional full-web lockdown. |
| Block home page | Applies the group's policy to the configured browser start/home surface where that control is available. |
| Fallback URL | Redirect destination for a block. A blank group value falls back to the global default. |

The normal Site-group domain list is the only declarative whole-site list exposed by the editor. Platform groups match their own platform and configured platform conditions instead.

### 3.2 Video-platform groups

YouTube, TikTok, Facebook, Instagram, and Twitch are video-platform groups. Each is limited to its own platform host. A group can target content form, author/account scope, the platform's home feed, and optional hide-element controls.

The general author modes are:

| Mode | Result |
| --- | --- |
| All | Do not restrict by author; other configured axes decide the match. |
| Include | Match only the listed normalized creators/accounts. |
| Exclude | Match all detected creators/accounts except the listed entries. |
| Nobody | Match no author. This is a deliberate no-match author axis. |
| Tag include | Match creators with any listed tag when Vault can classify them. Unknown/unclassified creators fail open. |
| Tag exclude | Match creators without the configured tag(s) when Vault can classify them. Unknown/unclassified creators fail open. |

The content-form choices are platform-specific:

| Platform | Content forms |
| --- | --- |
| YouTube | All pages, Shorts, long videos, posts. |
| TikTok | All pages, short videos. |
| Facebook | All pages, Reels, videos, posts. |
| Instagram | All pages, Reels, videos, posts. |
| Twitch | All pages, clips, streams/VODs, channel pages. |

Vault normalizes author input. The editor accepts the platform's ordinary handle/channel/page form and supported profile URLs. It may reject malformed entries or show them as invalid rather than silently turning them into a different target.

Surface-hide choices are independent of top-level blocking. They affect only the current platform UI and can stop working when the platform changes its markup.

| Platform | Shipped hide-element choices |
| --- | --- |
| YouTube | Shorts navigation/shelves/cards, home-feed promoted/ad surfaces, and comments. The ad-related option presents a warning because hiding ads may conflict with a platform's terms. |
| TikTok | Explore navigation. |
| Facebook | Reels navigation and reel surfaces. |
| Instagram | Reels and Explore navigation/surfaces. |
| Twitch | Browse navigation. |

YouTube creator-tag matching uses local/available channel classifications. A missing classification does not become a block merely because a tag mode was selected.

### 3.3 Reddit

A Reddit group applies only on Reddit. Its entity is a subreddit. Subreddit input accepts the ordinary community form and normalizes it before matching.

The subreddit modes are:

| Mode | Result |
| --- | --- |
| All | Apply to Reddit without a subreddit-list restriction. |
| Include | Apply to listed subreddits. |
| Exclude | Apply to all except listed subreddits. |
| Nobody | Apply to no subreddit. |

The shipped surface-hide option hides Popular/All navigation. Feed-card behaviour is dependent on Reddit's currently detectable card structure.

### 3.4 Discord

A Discord group applies only on Discord/Discordapp pages. Its target is a server id or a server/channel pair. The target editor accepts normalized Discord channel-path values.

| Mode | Result |
| --- | --- |
| All | Apply to Discord with no target-list restriction. |
| Include | Apply only to listed server or server/channel targets. |
| Exclude | Apply to all except listed targets. |
| Nobody | Apply to no target. |

Discord currently has no shipped hide-element choice in the normal platform profile.

### 3.5 Twitter / X

A Twitter/X group applies on X/Twitter. It can apply to all accounts or use the general account modes described for video platforms, with normalized handle/profile-link input.

The shipped hide-element choices are Explore, Messages, Grok, Trends, and promoted feed items. As with all selector-based surface controls, an X markup change can affect their operation.

### 3.6 Custom group declarative fields

A Custom group primarily runs its JavaScript source. It does not use the normal behaviour selector or normal schedule UI. It can nevertheless carry a domain list when imported or configured through compatible data:

- a non-empty Custom blocklist can participate in the ordinary whole-page site decision;
- a Custom allowlist can participate even when empty, producing a full-web declarative lockdown;
- an unconfigured Custom group does not accidentally block pages merely because it has a rule;
- Custom timers never block by themselves; a rule explicitly decides whether to block when a timer expires.

## 4. Global settings

Global settings apply to the extension rather than one group.

| Setting | Default | Behaviour |
| --- | --- | --- |
| Tick rate | 1000 ms | Frequency of the shared Custom tickEvent. Valid range is 250 through 60,000 ms. Lower values can make event-driven rules more responsive but use more CPU. |
| Autosave debounce | 400 ms | Delay after the last editor change before normal settings persist. Maximum is 5,000 ms. |
| Debug mode | Off | Enables verbose Custom-rule trace output and the on-page debug log overlay. It does not control whether a rule's ordinary log calls reach the popup log. |
| Show custom-rule logs on web pages | On | Controls ordinary page log toasts. Rule authors can still request screen-only or popup-only output explicitly. |
| Default snooze duration | 30 minutes | Seed used when creating new normal groups. Existing groups retain their own duration. |
| Default fallback URL | about:blank | Used when a blocking group has no group-specific fallback URL. |
| Help classify creators | Off | Explicit opt-in. It sends encountered YouTube channel ids only to the configured classification service; it does not send titles or watch history. |
| Local File Folder | None | Optional folder capability for Custom rules. See section 9. |
| Web-app bridge | Off | Optional connection to a compatible local Vault hub. See section 11. |

### 4.1 Editor interface and feedback surfaces

The extension editor has a persistent group list and a selected-group editor. The group list supplies the group-type picker, Add, Clear, selection, enable toggle, and drag ordering. Its divider is resizable. The selected-group editor supplies group-specific fields and the group Export/Import actions.

The editor autosaves ordinary field changes after the global debounce period. Validation errors are reported as status/toast feedback; invalid normal values are not silently converted into unrelated settings. A frozen group disables its ordinary editing controls.

The extension also has these user-visible feedback surfaces:

| Surface | Functional purpose |
| --- | --- |
| Instruction Manual | Opens this reference in the extension. |
| Language picker | Chooses the extension-interface language. |
| Settings | Opens the global settings described above. |
| Status/toast feedback | Reports save, import, validation, and action results. |
| On-page timer overlay | Shows active normal timer/countdown items and Custom timers that are in their display scope. Multiple items can coexist. |
| On-page log surface | Receives Custom log, warn, and error calls when permitted by global settings. |
| Custom Log | A live activity log for rule-created popup-visible entries. It can be cleared and downloaded. |

For Custom groups, the Rules field stores source text. Run first performs the rule syntax preflight and only loads the source when that succeeds. The editor also performs local source linting as text changes. The visible **Let AI Code** control opens a prompt field and copies a code-generation bundle containing the user's request, current rule, and a generated reference to the current Custom-rule API. It does not contact an AI service or automatically change the rule.

The Templates control opens the template browser. A template, when one is shipped, has a title, description, tags, parameters, and generated preview. Applying it replaces the current Rules text after confirmation. The currently shipped template catalog is empty; the browser remains available for future curated templates and must not be treated as a source of active rules.

## 5. Custom-rule language

### 5.1 Rule source forms

A Custom group's source is JavaScript. On **Run**, Vault removes the group's prior registrations and state created by the previous active source, then loads the new source.

The source may be either:

1. a function expression accepting events and helpers; or
2. bare statements that use the supplied events (or legacy event) and helpers variables.

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

Run performs the JavaScript syntax/preflight check and, only when it succeeds, makes the current source active. Saving text and running text are intentionally different: a rule can be saved without becoming the active event source.

The active source is unloaded when the Custom group is rerun, disabled, deleted, or explicitly stopped. Rerunning clears the rule's handlers, timers, panels, persistence bucket, and rule-created platform predicates before registration begins. A sandbox recovery can reload active source; rule authors must therefore make registration idempotent.

### 5.2 Execution model and safe assumptions

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Each handler receives:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Handlers for an event run by descending numeric priority; equal priority uses registration order. A handler can be replaced by registering the same event type and id again. There is a maximum of 1,000 registered handlers for one Custom group.

Vault bounds one handler's active work to about one second. Three deadline overruns for the same group within one minute quarantine the rule: Vault disables it rather than repeatedly running a problematic handler. Do not use busy waits, unbounded loops, synchronous polling, or a huge number of mutations/logs per event.

Per dispatch, Vault accepts at most:

| Item | Maximum |
| --- | --- |
| Rule log entries | 200 |
| Posted events | 64 |
| DOM operations | 256 |
| Action/intents | 256 |
| Panels per group | 24 |
| Controls in one panel | 32 |
| Options in select/radio control | 64 |

Excess log, posted-event, DOM-operation, and intent entries may be dropped. A Custom rule must not depend on excess entries being delivered.

### 5.3 Built-in event types

The following event-type strings are built in. A rule may also use its own non-empty type string, as long as it does not start with an underscore.

| Event type | When it is sent | Important data |
| --- | --- | --- |
| tickEvent | Shared periodic tick at the global tick-rate setting. | Current page/tab context where available. Use intervalMs registration option to rate-limit an individual handler. |
| openWebEvent | A top-level page becomes available to the rule. | URL, hostname, tab/page ids, time. |
| closeWebEvent | A top-level page/tab closes. | URL/hostname context where available. |
| webChangedEvent | A committed top-level navigation, including same-URL reloads. | data carries prior URL/hostname and navigation flags such as isFirstLoad, isReload, and sameDomain. |
| timerEnded | A Custom timer changes into its expired state. | data: timerId, displayName, direction, currentMs. It is delivered only to the timer's owning group. |
| snoozePress | The user presses Start Snooze for this Custom group. | The rule owns the response; no normal snooze fallback is performed. |
| panelEvent | A rendered Custom panel has an interaction. | data and convenience fields include panel/control/event/value information. |
| localFileEvent | A requested local-file action completes. | data and convenience fields include requestId, path, result, bytes, entries, and error. |
| pageHeartbeatEvent | A visible-page heartbeat, approximately every 250 ms while the tab is visible. | elapsedMs is visible-page elapsed time. Scoped Custom timers automatically use it even without a registered handler. |

### 5.4 Events registry API

The first argument to a function-style source is the Events registry. In bare-statement source, both events and event refer to this registry.

| Method | Contract |
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

The optional handler options object supports:

| Option | Meaning |
| --- | --- |
| priority | Numeric order. Higher values run before lower values. Default 0. |
| intervalMs | Positive number. For tickEvent only, suppresses calls until this much time has elapsed since the handler's previous call. |

Synthetic events default to group scope: only handlers belonging to the emitting group receive them. Use { scope: "global" } to send the event to every rule that registered the same type. Do not use a leading underscore in an event name; it is reserved.

### 5.5 Event object

Every handler receives a mutable event object with common fields:

| Field/method | Contract |
| --- | --- |
| type | Event type string. |
| groupId | Recipient Custom-group id. |
| tabId, pageId | Browser identifiers when available; otherwise null. |
| url, hostname | Current top-level URL and hostname, or empty strings. |
| time | Copy of the dispatch time object, or null. |
| data | Event-specific payload, or null. |
| preventDefault() | Marks the dispatch as a page-block action. The page is redirected to the current redirect link/result if one exists; otherwise Vault uses the normal exit/fallback path. |
| stopPropagation() | Stops later handlers for the current event dispatch. |
| setResult(value) | Stores a number or string result. A non-empty string is treated as a redirect target; result 1 suppresses an otherwise accumulated preventDefault result. |
| getResult() | Returns the result set by this event object, or null. |
| post(type, data, options) | Queue a synthetic event, with the same scope rules as Events.post. |
| setRedirectLink(url) | Set the redirect URL for this dispatch. Returns false only for a non-string input. |
| getRedirectLink() | Read this dispatch's redirect URL, or an empty string. |
| close(id) | Request closing a tab. A number is a tab id, a string identifies a URL, and an omitted value targets the active tab. |
| block(id) | Add a session-only dynamic site-block pattern. With no string id, use the event hostname. |
| unblock(id) | Remove a session-only dynamic site-block pattern. With no string id, use the event hostname. |
| open() | No-op in the browser extension. It cannot launch applications. |

A handler can attach arbitrary extra properties to event. Read them through event.custom or directly by the assigned name while that event object is alive. They are not persistent state and are not cross-event storage.

For panelEvent, these convenience fields are added: panelId, controlId, eventName, value, values, key, code, and keyInfo.

For localFileEvent, these convenience fields are added: eventName, action, path, directoryPath, requestId, ok, text, value, entries, exists, bytes, and error.

### 5.6 Helper entry points

The helpers object has these direct properties:

| Entry point | Meaning |
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. Custom helper reference

### 6.1 Domain helper

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Method | Return and behaviour |
| --- | --- |
| hostnameOf(url) | Normalized lower-case host without a leading www., or null for an invalid URL. |
| pathnameOf(url) | URL pathname, or / when the URL cannot be parsed. |
| matches(hostname, site) | True when hostname equals site or is its subdomain. |
| getPlatform(url) | youtube, tiktok, instagram, facebook, twitch, or null. |
| isYouTubeHost(host), isTikTokHost(host), isInstagramHost(host), isFacebookHost(host), isTwitchHost(host), isRedditHost(host), isDiscordHost(host) | Host classifiers. |
| youtube(), tiktok(), instagram(), facebook(), twitch() | Return that platform's URL-classifier object. |
| isEmptyStartPage(url) | True for the browser's supported blank/new-tab/start-page URLs. |
| matchesAny(url, patterns) | Match a URL against one RegExp, a RegExp array, or strings compiled as regular expressions. Invalid string patterns are ignored. |
| pathStartsWith(url, path) | True for an exact path or a descendant of path. A missing leading slash is supplied. |
| queryHas(url, key, value) | True if a query key exists; when value is supplied it must also equal the string value. |
| queryGet(url, key) | Query value or null. |
| isSearchPage(url) | Detects supported Google, Bing, DuckDuckGo, YouTube, Reddit, and X/Twitter search URLs. |
| isInfiniteFeedUrl(url) | Detects supported infinite-feed surfaces. |
| sameSection(a, b) | True only when both URLs share a host and the first pathname segment. |

Each platform URL-classifier object exposes isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url), and extractVideoId(url). A method can return false/null when the URL is valid but does not identify that kind of content.

### 6.2 Timer helper

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Create/get options:

| Option | Meaning |
| --- | --- |
| id | Required non-empty timer id. |
| displayName | Human-readable overlay label. |
| direction | forward for count-up; any other value becomes backward/countdown. |
| currentMs | Initial milliseconds, floored at zero and bounded if bounds exist. |
| minMs, maxMs | Optional positive minimum/maximum bounds. |
| stepMs | Optional positive quantization step for elapsed ticks. |
| overlayStyle | Optional strings for color, background, fontSize, fontWeight, border, borderRadius, padding, opacity, and icon. Unsupported/invalid parts are dropped. |
| scope(url) | Predicate that decides where visible-page time accrues. |
| domain(url) | Predicate that decides where the timer appears in the overlay; defaults to scope. |
| accrueWhen(url) | Optional extra predicate. Time accrues only when both scope and accrueWhen are true. |

| Method | Behaviour |
| --- | --- |
| create(options) | Create/replaces a timer and resets its state. Returns id or null. |
| getOrCreateTimer(options) | Create only if absent. Existing state remains unchanged. Returns id or null. |
| delete(id) | Remove timer and its scope/display predicates. |
| pause(id), resume(id) | Change paused state. Return true only when a state change is possible. |
| setDirection(id, direction) | Set forward or backward. |
| setCurrentMs(id, ms) | Set absolute count, enforcing bounds. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Adjust count, enforcing bounds. |
| setBounds(id, minMs, maxMs) | Set positive bounds; pass null for a bound to remove it. |
| setStep(id, stepMs) | Set a positive tick quantization. Pass null or zero to clear it. |
| setOverlayStyle(id, style) | Replace/clear allowed overlay styles. |
| setDisplayName(id, name) | Set overlay label. |
| getCurrentMs(id) | Number, zero for an absent timer. |
| isExpired(id) | True only when a timer exists and currentMs is zero. |
| isPaused(id) | Boolean. |
| getDirection(id), getDisplayName(id) | Direction/name or null. |
| exists(id) | Boolean. |
| getState(id) | Serializable timer snapshot or null. |
| list() | Serializable array of timer snapshots. |

Scope predicates are remembered while the Custom source remains loaded. Vault advances matching timers during visible pageHeartbeatEvent cycles, one tick per timer per dispatch. A backward timer stops at zero and emits timerEnded on the transition to zero. It remains zero until the rule changes/resets it. Use a timer-ended handler to decide whether an expired timer should call preventDefault, set a redirect, or perform another action.

### 6.3 Persistent and asynchronous storage

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Method | Behaviour |
| --- | --- |
| get(key, defaultValue) | Read a cloned value or defaultValue. |
| set(key, value) | Store a JSON-safe clone. Returns false for invalid key/value or key-cap exhaustion. |
| delete(key) | Delete existing key; returns whether it existed. |
| has(key) | Boolean. |
| keys() | Array of keys. |
| entries() | Array of cloned [key, value] pairs. |
| clear() | Delete all rule persistence for this group. |
| size() | Number of keys. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Method | Behaviour |
| --- | --- |
| requestAsyncGet(key) | Request an asynchronous storage read. Returns true when queued. Use a later event/your own state flow to respond; it is not a synchronous getter. |
| requestAsyncSet(key, value) | Request an asynchronous JSON-safe store. Returns true when queued. |

Rule persistence is cleared on Run because a new active source starts with a clean Custom-rule state.

### 6.4 Logging helper

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Method | Destination |
| --- | --- |
| log, warn, error | Popup activity log; page toast when global page-log toasts are enabled. |
| logScreen, warnScreen, errorScreen | Page toast/debug surface only; excluded from popup log. |
| logPopup, warnPopup, errorPopup | Popup activity log only; excluded from page toast. |

Logs also attempt to reach the browser console with a CustomBlocker group prefix. This is diagnostic output, not a persistence API. Use the persistence helper for state.

### 6.5 Redirect helper

Get it with helpers.getRedirectionHelper().

| Method | Behaviour |
| --- | --- |
| get(), getRedirectLink() | Return the current dispatch redirect URL or an empty string. |
| set(url), setRedirectLink(url) | Set the redirect URL for the current dispatch. |
| createMessageUrl(message) | Create an extension-local message page URL that displays the supplied message. |

Setting a redirect alone does not force navigation. Pair it with event.preventDefault(), or set a non-empty string through event.setResult(), according to the desired rule flow.

### 6.6 DOM helper

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Method | Requested action |
| --- | --- |
| hide(selector), show(selector) | Hide/show matching elements. |
| addClass(selector, className), removeClass(selector, className) | Mutate CSS class. |
| setText(selector, text) | Replace text content. |
| click(selector) | Click the matched element. |
| injectCss(css, id) | Add an identified CSS block. |
| removeInjectedCss(id) | Remove a previously identified injected CSS block. |
| scrollTo(selector) | Scroll a matched element into view. |

DOM actions do not provide unrestricted page scripting. They are a bounded action surface and should be idempotent when used from heartbeat/tick handlers.

### 6.7 Navigation, tabs, and browser-window helper

Get navigation with helpers.getNavigationHelper().

| Method | Requested action |
| --- | --- |
| back() | Navigate current tab back. |
| forward() | Navigate current tab forward. |
| reload() | Reload current tab. |
| goTo(url) | Navigate current tab to URL. |
| closeTab() | Close current tab. |

Get a snapshot helper with helpers.getTabHelper().

| Method | Return/action |
| --- | --- |
| list() | Copy of the current tab snapshot. |
| getActiveTab() | Active tab snapshot or null. |
| getById(id) | Matching tab snapshot or null. |
| countOpen() | Number of tabs in the snapshot. |
| requestRefresh() | Request a new tab snapshot for later rule work. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Method | Behaviour |
| --- | --- |
| current() | Current active tab object: id, url, hostname, title, isBrowser. |
| all() | Array of tab objects with id, url, hostname, title, active. |
| close(idOrUrl) | Close by numeric tab id, exact URL string, or active tab when omitted. |
| closeTab() | Close active tab. |
| block(pattern) | Add a normalized session-only domain block and apply it. |
| unblock(pattern) | Remove a normalized session-only domain block. |
| isBlocked(urlOrHostname) | Query the rule-created session blocklist. |
| getBlocked() | List current session-created patterns. |

Rule-created block patterns normalize http/https, leading www., and paths into a host pattern. They match the exact host and subdomains. This dynamic blocklist is session memory, not a saved normal Site group.

### 6.8 Local File Folder helper

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Method | Behaviour |
| --- | --- |
| isAvailable() | Reports that the API surface exists; it does not prove a folder is currently authorized. |
| requestRead(path) | Request text read. |
| requestWrite(path, text) | Request text write. |
| requestAppend(path, text) | Request text append. |
| requestList(path = "") | Request a directory listing. |
| requestExists(path) | Request existence test. |
| requestReadJson(path) | Request JSON read; path must end in .json. |
| requestWriteJson(path, value) | Request JSON write; path must end in .json and value must be JSON-safe. |

Paths are always relative to the selected root. They cannot be absolute, drive-qualified, dot-prefixed, or contain . or .. segments. Only .txt, .csv, and .json files are accepted for file operations. Folder selection can be revoked at any time; a failed request reports ok false and an error string in localFileEvent.

### 6.9 Platform helper

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

All raw platform APIs expose:

| Method | Behaviour |
| --- | --- |
| hide(predicate, options) | Set the same per-item predicate for every feed-card slot on that platform. |
| hide(slot, predicate, options) | Set one per-item predicate. The predicate receives the platform item/snapshot supplied by that platform. |
| allow(predicate, options), allow(slot, predicate, options) | Same as hide but creates an allow/exception verdict. |
| show(), show(slot) | Clear all or one installed predicate slot. |
| surface(name, "hide" or "show") | Hide/show a whole platform region. home is the public name for homePage. |
| timer(slot, options) | Configure a platform subsection timer. Returns options.id when supplied, otherwise null. |
| rescan() | Reevaluate already scanned feed cards after external rule state changes. |
| snapshot() | Return the current platform snapshot or null. |
| slots(), surfaces(), timerSlots() | Return the supported names for this platform. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | URL helpers for that platform. |

A slot owns one predicate for one group/platform. A later hide/allow call for the same slot replaces the earlier predicate; it is not an implicit OR. The optional options object recognizes:

| Option | Effect |
| --- | --- |
| blockPageOnVisit | When a matching card/page is visited, request a page block rather than only hiding the card. |
| effect | block (default) or allow. The allow helper sets allow automatically. |

Call rescan whenever a predicate depends on state that changed after cards were first evaluated, such as a panel checkbox, a quota, or a time threshold.

Raw platform support matrix:

| Platform | Predicate slots | Surface names | Timer slots |
| --- | --- | --- | --- |
| YouTube | shorts, videos, posts, comments, live | home, shortButton, comments, live | shorts, videos, posts |
| TikTok | videos, comments, live | home, comments, live | videos |
| Instagram | shorts, posts, comments | home, comments | shorts, posts |
| Facebook | shorts, videos, posts, comments, live | home, comments, live | shorts, videos, posts |
| Twitch | shorts, streams, videos, live | home, comments, live | shorts, streams, videos |

The raw Custom platform helper does not expose Reddit, Discord, or Twitter/X. Use general URL, DOM, timer, panel, and navigation capabilities for custom work on those sites.

## 7. Custom panels

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 Panel API

| Method | Behaviour |
| --- | --- |
| create(config) | Create or replace a panel. Returns normalized panel id or null. |
| getOrCreatePanel(config) | Create only when absent; returns id or null. |
| update(id, patch) | Replace specified panel fields after validation. |
| delete(id) | Remove a panel and its registered inline handlers. |
| show(id), hide(id) | Change visibility. |
| setValue(panelId, controlId, value) | Set a writable control value after validation. |
| updateControl(panelId, controlId, patch) | Replace a control's allowed fields. |
| disable(panelId, controlId), enable(panelId, controlId) | Toggle control availability. |
| setOptions(panelId, controlId, options) | Replace select/radio choices. |
| setText(panelId, controlId, text) | Update a button label, text/section text, or another control label. |
| setTheme(panelId, theme) | Replace panel theme. |
| setTitle(panelId, title), setDescription(panelId, description) | Update text. |
| getValue(panelId, controlId) | Return a cloned value or undefined. |
| getValues(panelId) | Return all writable values keyed by control id. |
| getState(id) | Return a serializable panel snapshot or null. |
| list() | Return serializable snapshots of all panels. |
| notice(config) | Create a compact bottom-right status panel with optional message/text. |
| confirm(config) | Create a centered dialog with generated confirm and cancel buttons. |
| checklist(config) | Create a panel of checkbox items. |
| form(config) | Create a form-layout panel from fields. |

### 7.2 Panel configuration

| Field | Accepted values/behaviour |
| --- | --- |
| id | Required. Normalized to letters, digits, underscore, hyphen; maximum 80 characters. |
| title | Panel title, maximum 240 characters. |
| description or body | Description, maximum 1,000 characters. |
| position | top-left, top-right, bottom-left, bottom-right, or center. Default bottom-right. |
| align | left, center, or right. Default left. |
| layout | vertical, compact, comfortable, spacious, inline, row, wrap, twoColumn, grid, split, form, toolbar, or stack. Default vertical. |
| priority | Numeric display order, clamped to -1000 through 1000. Higher panels display first. |
| width | small, medium, large, or 180 through 520 px. |
| textSize/fontSize | 10 through 32 px, or 0.65 through 2 rem/em. |
| ariaLabel/a11yLabel | Accessible label. |
| role | region, dialog, alert, status, form, or group. |
| autoFocus | Boolean. |
| theme/colors | background, foreground, accent, border, muted, fontSize/textSize, titleSize. |
| controls | Array of up to 32 controls, with section nesting up to three levels. |
| visible | False hides the panel. |
| scope(url), domain(url) | Functions controlling availability/display. domain takes precedence; without domain, scope controls display. |

Panel inline handler fields can appear on the panel or individual control: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey, and onKeyDown. Each receives the normal (event, helpers) parameters. An inline handler is replaced when that panel is recreated/updated with control definitions.

### 7.3 Controls

The available control types are text, checkbox, select, textInput, textarea, button, section, timer, numberInput, range, toggle, radio, date, time, color, pin, and html. Aliases input, dropdown, group, number, slider, switch, raw, and markup normalize to their corresponding type.

All controls accept id, type, label, value, disabled, priority, and where relevant layout, align, ariaLabel/a11yLabel, autoFocus, width, height, and rows.

| Type | Important fields and value contract |
| --- | --- |
| text | text (or label) rendered as non-input text. |
| checkbox, toggle | Boolean value. |
| select, radio | options as strings or { value, label } objects; maximum 64. Value is a short string. |
| textInput, textarea | String value, maximum 2,000 characters; optional placeholder. |
| button | label/text; optional action submit, cancel, or close. |
| section | text/description, role, and nested controls. |
| timer | timerId or timer snapshot; format ms, ss, mm:ss, or hh:mm:ss; showExpired defaults true. |
| numberInput, range | Numeric value clamped to supplied min/max; optional positive step. |
| date | YYYY-MM-DD value only. |
| time | HH:MM or HH:MM:SS value only. |
| color | Six-digit #RRGGBB input value. |
| pin | Digits only, length 3 through 12, masked by default, optional autoSubmit. |
| html | Sanitized markup. Script blocks, inline event attributes, and javascript: URLs are removed. |

Each rendered interaction generates panelEvent. The event's values object contains the panel's writable controls, excluding buttons, text, and timer controls. A close action hides the panel before handlers observe the event.

## 8. Custom-rule action recipes

The following examples are specifications of public composition, not a tutorial.

### 8.1 Redirect an opening page

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 Visible-time countdown with explicit block

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 Change a feed predicate from a panel

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

Predicates must be written for the platform snapshot/item values supplied by the active platform surface. If a platform cannot identify a field reliably, the predicate should fail open rather than assume a value is true.

## 9. Local-folder request protocol

Local Folder operations are not immediate file I/O. The complete functional sequence is:

1. The user selects a folder in Global Settings.
2. The rule queues a request and receives a request id.
3. Vault asks the authorized folder capability to perform the operation.
4. Vault sends localFileEvent to the same Custom group.
5. The handler correlates event.requestId with the original request id.

Successful read completes with text for text files or value for JSON. List returns entries. Exists returns exists. Write/append provides bytes where applicable. Failure provides ok false and error. Rules must never assume that a selected folder remains authorized after a reload, browser restart, or permission revocation.

## 10. Custom-rule safety and failure semantics

### 10.1 Compile and run errors

Check syntax reports compilation failure. Run can also report a runtime error during registration. If a function-like source has a syntax error, Vault does not silently fall back to treating it as harmless bare statements.

An empty source has zero handlers. It is valid as an inactive Custom rule, but it performs no configured Custom action.

### 10.2 Handler errors

An exception from one handler is isolated from the overall event dispatch. It is diagnostic output; it does not make later handlers magically succeed. Use narrow handlers and log actionable errors.

### 10.3 Quarantine

Vault can quarantine a Custom group after repeated deadline overruns or an overrun during registration. Quarantine disables the group and records its abort reason. Correct the source, save it, and explicitly run it again to restore active registrations.

### 10.4 Browser/page limits

No Custom rule receives unrestricted extension APIs. In particular:

- a DOM selector can find nothing on a platform that changed;
- navigation, tab close, and screen actions remain subject to browser capabilities;
- an extension cannot open native applications;
- local-folder operations require a user-granted folder and the supported file types;
- an event handler cannot rely on an invisible page continuing to produce visible-time heartbeats;
- a page can reload, navigate, be discarded, or invalidate a content script independently of the rule;
- rule-created dynamic site blocks are session-state actions, not permanent Site-group edits.

## 11. Web-app bridge

The bridge is optional. It connects a browser extension client to a compatible local Vault hub. The browser extension is a client; a native Vault app provides the hub. The fixed local endpoint is ws://127.0.0.1:8787 and protocol compatibility is required.

Connection states are Off, Connecting, Disconnected, Connected, and Error. With the client enabled, Vault first probes rapidly and then continues slower reconnect attempts until it connects or the user turns it off. Connection does not by itself merge all groups.

### 11.1 Linking groups

Groups are linkable only when their name and type match and they are eligible for linking. The user explicitly selects/links the participating programs. A linked group forms a cluster. Disconnecting leaves local group data intact; it stops live synchronization.

The bridge synchronizes shared scalar policy for supported linked groups, including normal blocking mode, allowance/reset values, snooze settings, active days/windows, freeze state/choice/duration, homepage policy, allowlist setting, fallback URL, and skip-to-next policy. It also coordinates usage and snooze state for cluster members.

The bridge does not promise that every product-specific field, platform selector, Custom source text, or browser-specific capability is transferable to a different program. A group can remain local and unlinked even while the bridge is connected.

Frozen bridge clusters require all relevant members to be online for freeze-state actions that need coordinated mutation. A connection is local transport, not a cloud backup or remote-control channel.

## 12. Verification checklist for maintainers

Use this checklist when auditing a release or reproducing behaviour:

1. Confirm the group has a non-empty unique name, correct type, enabled state, and intended list/order.
2. For normal groups, confirm active weekday, valid local time window, no active snooze, and non-frozen editing state.
3. For a Site group, test exact host, subdomain, and (for allowlist) a host outside the list.
4. For a platform group, separately test page-level matching, targeted item/card matching, author mode, content-form mode, and each enabled surface hide.
5. For timed normal groups, verify visible-page accrual, allowance expiry or count-up non-blocking behaviour, and reset interval.
6. For Custom rules, run syntax check, Run, inspect handler count/logs, test every registered built-in event, then test a reload/navigation.
7. Test each Custom timer at scope boundaries and at zero; verify that any block is explicit in the rule.
8. Test panels with each control value, disabled state, submit/cancel/close action, and panelEvent handler.
9. Test local-folder failure before success: no selected folder, revoked permission, invalid path, unsupported extension, then authorized read/write.
10. Test bridge connection-off, connection-on, linked/unlinked group, and an offline cluster member before relying on synchronization or freeze coordination.

## 13. Versioning rule

This English file is the maintained source manual. Localized manuals are translations of it and may require regeneration after a functional documentation update. Product source remains the canonical truth for implementation-level ambiguity.
