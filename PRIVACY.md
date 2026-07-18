# Privacy Policy — Custom Web Blocker

_Last updated: 2026-07-15_

This page explains exactly what data the **Custom Web Blocker** browser
extension collects, where it goes, and why each browser permission is
requested. The short version is: your rules and personal browsing data are not
saved by us. Optional Vault Classifier collection and classification stay under
your control and use the paired local bridge.

## Summary

- **Your configuration stays in your browser.** Block groups, schedules,
  custom rules, logs, timers, and preferences are persisted only through
  Chrome's local extension storage (`chrome.storage.local`).
- **Vault Classifier is local-only.** If you explicitly enable the optional
  Vault Classifier integration, visible YouTube card/page evidence (such as a
  title, visible description, displayed tags, and public creator/video IDs) is
  routed only through the paired local Vault bridge to Vault Classifier on your
  Mac. It is not sent to our website, a model provider, YouTube's Data API, or
  any other server.
- **Collection is a separate opt-in.** Vault Classifier asks the extension for
  rendered, non-ad YouTube metadata only after you turn on YouTube collection
  in its Classification data workspace. When it is off, the extension sends no
  title or creator metadata for collection. When it is on, retained local
  fields can include a visible title, creator name/identifier, video type,
  duration, visible subscriber/view/published text, and canonical URL.
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
- When you explicitly enable Vault Classifier, its local app keeps a
  user-bounded local cache of the visible evidence, local scores, decisions,
  and corrections needed to classify and explain entries. This cache remains
  on your Mac and is not part of normal extension-to-server traffic.

Your configuration, runtime state, and activity log stay on your device and
are not saved by our service. Depending on the browser build and features you
enable, they may be processed by the extension, its device-local Safari
companion, or an explicitly linked local Vault bridge.

## What is NOT collected or transmitted

- Browsing history is not recorded, summarised, or transmitted.
- Page content is not exfiltrated, screenshotted, or logged.
- Vault Classifier evidence is not transmitted off-device. It is processed by
  the paired local bridge and app only when you explicitly enable that integration.
- Form input, passwords, and personal information are never read.
- No extension identifier, account identifier, device identifier, or rule
  configuration is transmitted for normal rule enforcement.

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
| `<all_urls>` host access | Apply your blocking rules and per-platform feed hiders on whichever sites you choose to block. The extension reads/modifies pages only on URLs you have actively configured a rule for, and only to enforce that rule; the optional Vault Classifier adapter is restricted to YouTube. |

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

## Website statistics

This section is about the **website**. The website
publishes a small **Statistics** panel, and to populate it the server keeps a
few aggregate counts:

- **Download counts** — how many times each product's download button was
  clicked (macOS, Windows, browser extension, Safari).
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
