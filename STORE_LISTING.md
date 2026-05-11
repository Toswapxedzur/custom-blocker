# Chrome Web Store — Listing Copy

Drop these strings straight into the Chrome Web Store dashboard fields when
submitting [dist/custom-web-blocker-1.1.0.zip](dist/). Keep this file out of
the upload zip — it ships only in the source repo.

---

## Extension name

```
Custom Web Blocker
```

(Localized via `_locales/<locale>/messages.json` → `appName`.)

## Short description (max 132 characters)

```
Block websites with native blocking, delayed usage limits, or event-driven custom rules. Stay focused on what matters.
```

(Localized via `_locales/<locale>/messages.json` → `appDescription`.)

## Category

`Productivity`

## Language

Primary: English. Localized listings auto-populate from `_locales/`.

---

## Detailed description (Web Store "Description" field)

```
Custom Web Blocker is a Manifest V3 focus tool for people who want more
than a simple block list.

WHAT IT DOES
- Block any list of websites natively (Chrome refuses the request, the
  page never loads).
- Or limit a site to N minutes per day, then auto-block.
- Or use a fixed countdown that allows the site for X minutes after each
  visit.
- Hide just the time-wasting parts of platforms you still need: YouTube
  Shorts, TikTok For You feed, Reddit subreddit cards, X / Twitter home,
  Instagram Reels, Facebook feed, LinkedIn home, and more — without
  blocking the rest of the site.
- Write your own rules in JavaScript with an event-driven helper API
  (page heartbeat, navigation, custom events, timers, persistence,
  scheduled windows, day-of-week filters, snooze and freeze controls).

POWER FEATURES
- Multiple independent block groups: name them, reorder them, toggle
  each one on or off.
- Per-group schedule (day-of-week + HH:MM time windows).
- Snooze with optional written justification, activation delay,
  cooldown, and confirmation count.
- Freeze and Strict Freeze: lock a group from edits; strict freeze also
  locks for N hours and requires a 20-step confirmation ritual to
  unlock. Designed so future-you can't casually undo it.
- 50+ built-in templates for common rules: timers, schedules, feed
  hiders, focus sessions, redirects, nudges, persistence, DOM tweaks.
- Quarantine: a misbehaving custom rule (infinite loop, runaway log
  spam, exceeded message caps) is auto-disabled with an explanatory
  log entry. The browser stays safe.
- Activity log feed of every event handler invocation for inspection.
- Drag to reorder groups; the top group has the last word.
- Localized into 20 languages, including the full instruction manual.

PRIVACY
- No data leaves your browser. No analytics, no telemetry, no remote
  configuration. All settings, rules, and runtime state are stored
  locally via chrome.storage.local. Full policy: see the privacy policy
  link below.

REQUIREMENTS
- Chrome 116+ (offscreen documents and declarativeNetRequest dynamic
  rules).

After install, click the toolbar icon — the editor opens as a full
page. The in-app Instruction Manual covers every feature, every event
type, every helper, every template.
```

---

## Single-purpose statement (required for MV3 listings)

```
Help users block, limit, or filter access to user-chosen websites, using
either native network blocking, time-based usage limits, or
user-authored event-driven rules.
```

## Privacy policy URL

Host [PRIVACY.md](PRIVACY.md) somewhere public (a GitHub Pages URL or
the project's README rendered on github.com both work) and paste the
URL into the dashboard's "Privacy policy" field.

---

## Per-permission justifications

The dashboard requires a one-line justification for each requested
permission. Paste these verbatim:

| Field | Justification |
| --- | --- |
| **Single purpose** | Help users block, limit, or filter access to user-chosen websites using native blocking, time-based limits, or event-driven custom rules. |
| **`storage` permission** | Persist user-defined block groups, rules, settings, and runtime state (e.g. remaining time budgets, snooze expiry) in the browser's local extension storage. |
| **`declarativeNetRequest` permission** | Convert each enabled block group into native blocking rules so Chrome blocks the configured URLs without reading or modifying request bodies. |
| **`alarms` permission** | Wake the background service worker on schedule to refresh time-based limits, expire snoozes, and tick the shared timer used by event-driven rules. |
| **`offscreen` permission** | Execute user-authored custom rules inside a sandboxed offscreen document so they cannot directly access pages, the network, or other extensions. |
| **`tabs` permission** | Open the editor as a full tab from the toolbar icon, read the active tab's URL to evaluate group rules, and reload tabs after the user edits a rule. |
| **`webNavigation` permission** | Detect single-page-app navigation events (history.pushState) so per-platform feed-hiders and event-driven rules react to in-page route changes, not just full page loads. |
| **Host permission `<all_urls>`** | Apply the user's blocking rules and per-platform DOM rules on whichever websites the user has chosen to block. The extension does not collect or transmit page contents. |
| **Remote code use** | None. The extension does not load or execute any remote code. User-authored custom rules are stored locally and run in a sandboxed offscreen document. |

---

## Asset checklist

| Asset | Spec | Status |
| --- | --- | --- |
| Icon 128×128 | PNG, opaque corners ok | [icons/icon-128.png](icons/icon-128.png) |
| Small promo tile | 440×280 PNG/JPG | TODO |
| Marquee promo tile (optional) | 1400×560 | TODO |
| Screenshots | 1280×800 or 640×400, 1–5 | TODO — capture from the editor (groups list + rule editor + schedule + freeze ritual) |
| Privacy policy URL | publicly accessible | TODO — host PRIVACY.md |
| Support email | one valid address | TODO |

---

## Pre-submit checklist

- [ ] `python3 tools/build_locales.py` re-run if any translation changed.
- [ ] `python3 tools/package.py` re-run; resulting zip in [dist/](dist/) is what you upload.
- [ ] `bash tests/run.sh` passes (137 tests).
- [ ] Version in [manifest.json](manifest.json) bumped from any prior store version.
- [ ] Privacy policy URL is live and reachable.
- [ ] Screenshots captured from a fresh Chrome profile (no personal data).
