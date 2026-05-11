# Privacy Policy — Custom Web Blocker

_Last updated: 2026-05-11_

This page explains exactly what data the **Custom Web Blocker** browser
extension collects, where it goes, and why each browser permission is
requested. The short version is: nothing leaves your browser.

## Summary

- **No data is sent to any server.** The extension makes zero network
  requests to any third party (or to us). It has no analytics, no
  telemetry, no crash reporter, no remote configuration, no automatic
  updates beyond the standard Chrome Web Store mechanism.
- **All data stays in your browser**, persisted via Chrome's local
  extension storage (`chrome.storage.local`). It is never synced unless
  Chrome itself syncs your local profile.
- **No personally identifiable information is collected** by the
  extension at any time.
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

This data is read and written only by the extension's own scripts, only
on your device, and only inside your own browser profile.

## What is NOT collected or transmitted

- Browsing history is not recorded, summarised, or transmitted.
- Page content is not exfiltrated, screenshotted, or logged.
- Form input, passwords, and personal information are never read.
- No information about you, your device, or your usage is sent to the
  extension author or any third party.

## Why each permission is requested

| Permission | What it is used for |
| --- | --- |
| `storage` | Save and load your block groups, settings, and runtime state in your browser only. |
| `declarativeNetRequest` | Tell Chrome which URLs to natively block, based on the rules you configured. The browser handles the blocking; the extension only registers and updates the rule list. |
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
