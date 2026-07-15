# Privacy Policy — Custom Web Blocker

_Last updated: 2026-07-13_

This page explains exactly what data the **Custom Web Blocker** browser
extension collects, where it goes, and why each browser permission is
requested. The short version is: your rules and personal browsing data are not
saved by us. Creator-tag rules may send public YouTube channel IDs for a
read-only lookup, but those lookup requests are not retained or linked to you.

## Summary

- **Your configuration stays in your browser.** Block groups, schedules,
  custom rules, logs, timers, and preferences are persisted only through
  Chrome's local extension storage (`chrome.storage.local`).
- **Creator-tag lookups contain only public channel IDs.** When an enabled
  YouTube tag rule needs a verdict, the extension may send a channel ID such as
  `UC…` to the configured tag service. It does not send the page URL, video ID,
  title, search query, timestamp, account identity, or extension settings.
- **Lookup requests are not saved.** The lookup endpoint is read-only, does not
  add unknown channels to the database, does not associate a request with a
  person or account, and runs behind origin servers with access logging off.
- **There is no analytics, advertising profile, telemetry, or crash reporter.**
- **No tracking** of browsing activity beyond what is strictly necessary
  to apply the blocking rules you yourself configured.

## What is stored locally

The extension stores the following in your browser's local extension
storage so it can do its job across sessions:

- The block groups you create: their names, rule types, lists of
  blocked sites, schedules, snooze settings, freeze state, and any
  custom-rule JavaScript you write.
- Per-group runtime state needed to enforce limits (e.g. how many
  minutes of a delayed-allowance budget remain today, when a snooze
  ends, when a strict-freeze period ends).
- Your own preferences set in **Settings** (tick rate, autosave
  debounce, default snooze duration, default fallback URL, debug-mode
  toggle, chosen UI language).
- Activity log entries shown in the in-app **Log** panel, which you can
  clear from the UI.
- Cached public creator-tag verdicts (channel ID, classification state, and
  tag slugs), which you can clear from Settings.

Your configuration, runtime state, and activity log stay on your device and
are not saved by our service. Depending on the browser build and features you
enable, they may be processed by the extension, its device-local Safari
companion, or an explicitly linked local Vault bridge. Creator-tag cache
entries are responses from the configured tag service and remain local after
lookup.

## What is NOT collected or transmitted

- Browsing history is not recorded, summarised, or transmitted. A public
  channel ID may be queried only to evaluate an enabled creator-tag rule; it is
  not sent with a URL, video title, search term, or viewing timestamp.
- Page content is not exfiltrated, screenshotted, or logged.
- Form input, passwords, and personal information are never read.
- No extension identifier, account identifier, device identifier, or rule
  configuration is attached to a creator-tag lookup.

## Why each permission is requested

| Permission | What it is used for |
| --- | --- |
| `storage` | Save and load your block groups, settings, and runtime state in your browser only. |
| `favicon` | Show browser-cached site icons beside rules in Chromium. This does not send browsing history or make a request to our service. |
| `nativeMessaging` | In Safari only, forward custom-rule sandbox requests to the device-local containing app. It is not a cloud transport. |
| `alarms` | Wake the background service worker on schedule to refresh time-based limits and update rule state when a snooze, freeze, or schedule window ends. |
| `offscreen` | Run sandboxed custom-rule JavaScript in an offscreen document so it cannot escape the extension or touch your pages directly. |
| `tabs` | Open the editor as a full tab when you click the toolbar icon, look up the active tab's URL to evaluate group rules, and reload tabs after a rule change you made in the editor. |
| `webNavigation` | Detect SPA URL changes (push-state navigation) so per-platform feed-hiders and event-driven rules can react to in-page navigation, not just full page loads. |
| `<all_urls>` host access | Apply your blocking rules and per-platform feed hiders on whichever sites you choose to block. The extension reads/modifies pages only on URLs you have actively configured a rule for, and only to enforce that rule. |

## Custom rules

If you write custom JavaScript rules, that code:

- Runs in a sandboxed offscreen document; it cannot directly reach the
  network, your pages, or other extensions.
- Communicates with content scripts only through a fixed message bridge
  defined by the extension's helper API.
- Is automatically quarantined (disabled with a log entry) if it
  exceeds the built-in CPU, log, post-message, or DOM-mutation caps.

Your custom rules are stored locally with the rest of your settings
and are never transmitted off the device.

## Website & creator-tag service statistics

This section is about the **website and creator-tag service**. The website
publishes a small **Statistics** panel, and to populate it the server keeps a
few aggregate counts:

- **Download counts** — how many times each product's download button was
  clicked (macOS, Windows, browser extension, Safari).
- **Creators classified** — how many YouTube creators have been tagged.
- **Accounts** — how many accounts exist.
- **Q&A activity** — the total number of forum posts and comments.

Once an hour the server records the current value of each aggregate count.
These snapshots contain no per-visitor event, clickstream, or session history.

- **Fully anonymous / de-identified.** These are plain running totals. They
  are **not** linked to your name, account, email, IP address, device, or any
  other identifier — there is no way to attribute a count back to a person.
- **Never commercial.** This data exists only to show the public Statistics
  panel. It is **never sold, shared with third parties, used for advertising,
  or used for any other commercial purpose.**
- **Read-only creator lookup.** An enabled creator-tag rule may query public
  YouTube channel IDs. The application does not store the lookup request, IP
  address, or browsing context, and unknown IDs are not added by this endpoint.
- **Optional channel-id contributions.** If — and only if — you opt in, the
  extension may save encountered public YouTube **channel IDs** to the shared
  classification queue. It never contributes video titles, URLs, search terms,
  viewing timestamps, watch history, or an extension/user identifier.
- **Manual website contributions.** A signed-in website user may deliberately
  submit channel IDs. To enforce the 50-per-24-hour quota, the website retains
  the account email/channel-ID association only for that rolling window; an
  hourly cleanup deletes expired records. The creator catalog itself retains
  the public channel ID and resulting public classification without the email.
- **Public queue.** The website may show public channel IDs and classification
  state while work is pending, but it does not publish submission timestamps or
  identify who supplied an ID.

## Children

The extension is a general-purpose productivity tool. It is not
directed at children, does not knowingly collect data from anyone, and
displays no advertising.

## Changes to this policy

If the data practices ever change in a future version, this file will
be updated and the change will be summarised in the version notes for
that release.

## Contact

Questions, concerns, or bug reports: please open an issue on the
extension's source repository, or use the support email listed on the
Chrome Web Store listing.
