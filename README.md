# Custom Web Blocker

A Chrome / Edge extension (Manifest V3) for serious focus work.

Block websites with native network blocking, time-budget them, hide
specific content on social platforms, or write your own event-driven
rules in JavaScript. Strict freeze a rule so even a future you cannot
disable it without a long ritual. Snooze it only after writing a real
justification.

The popup is a full editor page, not a tiny menu. Every group, rule,
template, and setting lives there.

## Features

- **Multiple block groups.** Create, name, reorder, enable, and disable
  any number of independent rule sets.
- **Group types.** Default (any URL list), YouTube, TikTok, Facebook,
  Instagram, Twitch, Reddit, Discord, and Custom (user JavaScript).
- **Three blocking modes.** Immediate (`ERR_BLOCKED_BY_CLIENT`-style),
  delayed-by-minutes (allow N minutes then block), or fixed-countdown
  (the page is allowed for the countdown then blocked).
- **Per-platform feed control.** Hide YouTube Shorts, TikTok FYP cards,
  Reddit subreddit cards, Twitter / X home, Instagram Reels, Facebook
  feeds, LinkedIn home, and more — without blocking the rest of the
  site.
- **Event-driven custom rules.** Write a `(events, helpers) => { ... }`
  function and register handlers for `tickEvent`, `pageHeartbeatEvent`,
  `openWebEvent`, `switchWebEvent`, `webChangedEvent`, `timerEnded`,
  `snoozePress`, plus your own custom events. Sandboxed; cannot escape
  the extension.
- **50+ templates.** Timers, schedules, feed hiders, focus sessions,
  redirects, nudges, persistence, DOM tweaks, debug helpers — pick a
  preset, tweak parameters, apply.
- **Helpers API.** Forward / backward timers (auto-tick when scope is
  visible), per-group persistent storage, platform-specific DOM intents
  (hide nav, hide feed cards by predicate), URL utilities, structured
  log feed.
- **Schedule.** Day-of-week and `HHMM-HHMM` windows on every group.
- **Freeze + Strict Freeze.** Lock a group from edits; strict freeze
  also locks it for N hours and requires a 20-step confirmation ritual
  to unlock.
- **Snooze.** Temporarily disable a group, with optional written
  justification (configurable minimum length), activation delay,
  cooldown, and confirmation count.
- **Quarantine.** A misbehaving custom rule (infinite loop, runaway
  registration, exceeded log/post/DOM caps) is auto-disabled with an
  explanatory log entry instead of crashing the browser.
- **Debug mode.** A single toggle in Settings turns on the on-page
  debug overlay and verbose `[CustomBlocker]` console output. Off by
  default; your own `helpers.log()` calls always work.
- **Activity log feed.** Every event handler invocation is summarised
  in the Log panel for inspection.
- **Drag to reorder.** Groups evaluate bottom-up; the top group has the
  last word.
- **Localized into 20 languages.** UI strings and the full instruction
  manual ship in each.

## Install

1. Clone or download this repo.
2. Open `chrome://extensions` (Chrome, Edge, Brave, etc.).
3. Enable **Developer mode**.
4. Click **Load unpacked** and pick this folder.

Minimum browser: Chrome 116+ (the manifest declares this for offscreen
documents and `declarativeNetRequest`).

## Quick start

1. Click the extension icon. The editor opens as a full page.
2. In **Block Groups**, choose a type from the dropdown (start with
   `Default`).
3. Click **Add**. A new group appears and the editor opens it.
4. Name it.
5. Fill in the type-specific fields (for `Default` that means the
   **Blocked sites** list, one site per line — `facebook.com`,
   `https://example.com/page`, etc. — `www.` is stripped, the
   hostname is normalized, subdomains match).
6. Make sure the group's checkbox in the left panel is on.
7. Visit one of the listed sites. The block should be in effect
   immediately.

That's the whole happy path. Every other section in the in-app
**Instruction Manual** is optional.

## Custom rules — minimal example

```js
(events, helpers) => {
  events.registerWebChangedEvent("blockShortsTitlesWithA", (ev, h) => {
    h.getPlatformHelper().youtube().hideShorts(
      (video) => video.title && video.title.toLowerCase().includes("a"),
      { blockPageOnVisit: true }
    );
  });
};
```

Click **Run** in the Custom group editor to attach the rule. New
navigations pick it up; reload existing tabs to apply.

The full helper API, every event payload, all 50+ templates, the
quarantine rules, and the freeze ritual are documented in the in-app
**Instruction Manual**.

## Project layout

| Path | Purpose |
| --- | --- |
| [manifest.json](manifest.json) | MV3 manifest |
| [popup.html](popup.html) / [popup.js](popup.js) / [popup.css](popup.css) | Editor UI |
| [background.js](background.js) | Service worker, dNR rules, timer book-keeping |
| [content.js](content.js) | In-page overlay, DOM intents, SPA hooks |
| [helpers.js](helpers.js) | Helper API used by both content + sandbox |
| [event-sandbox.html](event-sandbox.html) / [event-sandbox.js](event-sandbox.js) | Sandboxed JS runtime for custom rules |
| [offscreen.html](offscreen.html) / [offscreen.js](offscreen.js) | Bridge between sandbox and service worker |
| [translations.js](translations.js) | In-app language registry |
| [translation/*.json](translation/) | Per-locale UI strings (loaded at runtime) |
| [_locales/](_locales/) | Chrome Web Store name + description per locale |
| [manual/*.md](manual/) | Per-locale instruction manual |
| [templates/*.js](templates/) | Built-in custom-rule templates |
| [icons/](icons/) | Toolbar / store icons (16/32/48/128 + 1024 master) |
| [tests/](tests/) | JavaScriptCore unit tests |
| [tools/](tools/) | Dev scripts: icon generator, translation pass, store packager, locale builder |
| [PRIVACY.md](PRIVACY.md) | Privacy policy |
| [STORE_LISTING.md](STORE_LISTING.md) | Chrome Web Store listing copy + permission justifications |

## Tests

```bash
bash tests/run.sh
```

137 tests, all green.

## Release / packaging

To build a Chrome Web Store upload zip:

```bash
python3 tools/build_locales.py    # regen _locales/ from translation/*.json
python3 tools/generate_icons.py   # regen icons/ from the design script
python3 tools/package.py          # writes dist/custom-web-blocker-<version>.zip
```

The packager uses an explicit allowlist, so dev files (`tools/`, `tests/`,
dotfiles, IDE folders, `__pycache__`) are guaranteed to stay out of the
upload. Listing copy and permission justifications live in
[STORE_LISTING.md](STORE_LISTING.md); the privacy policy is
[PRIVACY.md](PRIVACY.md).

## Notes

- The in-page overlay only counts time while the tab is active and
  visible. Background tabs do not consume the budget.
- Once Chrome blocks a page natively, the browser error page cannot be
  customized by the extension — that's by design and by browser policy.
- Strict-freeze is intentional friction. The ritual is long because the
  whole point is that future-you cannot circumvent it casually.
- Translations for languages other than English are machine-generated
  starting points; pull requests to improve them are welcome.
