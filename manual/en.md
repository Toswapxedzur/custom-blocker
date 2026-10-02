# Vault browser extension user manual

Vault controls websites and supported platform content in the browser profile where it is installed. Open its editor from the extension's toolbar button. Mac Vault provides local tagging and Activity when connected; the extension enforces browser targets.

## Blocking groups

A **blocking group** applies a blocking policy. A **Classifier group** assigns tags to content; it does not block anything by itself.

1. Add a blocking group and give it a name.
2. Choose targets under **Applies to**.
3. Choose when blocking applies, then set any schedule or time allowance.
4. Enable the group. Its targets share the group's policy.

Routine edits save automatically. An error means the edit was not accepted; correct the field and try again. Disable a group to stop its policy while keeping its configuration. **Delete group** removes it. Drag groups to reorder them. More than one group can apply to a target; snoozing one does not lift another group's block.

**Export** copies a group configuration. **Import** replaces the selected group's configuration after confirmation.

### Time allowance and schedule

**Block immediately** applies whenever the enabled group matches and its schedule is active. **Block when the time allowance is used** permits matching use until its allowance runs out.

Set the allowance in minutes and the reset interval in hours. A rolling limit counts use within the preceding window. Resetting at midnight starts a new period at local midnight, including for a rolling limit.

Choose active weekdays and optional local-time windows, one per line, such as **09:00-12:00**. An empty window list applies throughout the selected days. A window must end later than it starts on the same day; split an overnight schedule into separate days.

### Snooze

Configure snooze in each blocking group. **Pause blocking** suspends that group's policy for its pause duration. **Add to the time allowance** adds usable minutes to a time-limited group. Only consumed extra allowance counts as snoozed time. Unused extra allowance expires at the next reset; for a rolling limit it expires after one window, or sooner at midnight if enabled.

**Activation delay** postpones snooze while blocking continues. **Cooldown** is the wait after snooze ends before another request. **Required confirmations** sets the number of confirmation steps. Snooze is available on a frozen group only if allowed before freezing.

### Freeze and PIN

**Freeze** prevents routine edits. Unfreezing requires ten confirmations, five seconds apart, plus any configured wait and six-digit PIN. **Wait before unfreezing** accepts 0–72 hours; 0 adds no wait.

While frozen, the wait can be extended and a PIN can be added if none exists. Those conditions cannot be weakened until the group is unfrozen. Deletion also respects the remaining wait and PIN.

### Linked groups

Use **Link** to connect explicitly selected groups in other Vault programs. Linked groups share their name, supported policy settings, usage, and freeze conditions. Each program retains its own targets and enforces the actions it supports. Unlinking keeps each group and its settings.

If a linked member is offline, editing can be unavailable. Open Mac Vault and the linked browser to reconnect. A local saved policy can continue to apply while a member is offline.

## Getting help

Click the small **i** beside a field to see its explanation. Click outside it or press Escape to close it. Lists stay inside scrollable boxes; scroll the box to reach more entries. Search filters the visible list without deleting entries.

Custom rules have their own [Code manual](../code-manual/en.md). It explains the editor, activation, logs, file access, and the supported API.

## Websites and platform content

Add domains or full URLs, one per entry. A domain includes its subdomains. A path limits matching to that path and its descendants. **Block everything except these sites** turns the list into an allowlist.

A target can cover a matching page or pause first and offer Continue after a countdown. A blocking target takes precedence over a pausing target in the same group. **When blocked: redirect address or message** accepts a web address or cover message; leave it blank to cover the page in place. A pause never redirects.

Platform targets use **Creators** for video platforms, **Accounts** for Twitter / X, **Communities** for Reddit, and server/channel IDs for Discord. Controls apply where Vault can identify the source and content type. Content controls hide supported page elements, such as ads or video cards. Browser permissions and website changes can affect these controls.

### Content tag filters

The Classifier connection and tag correction are currently available in supported Chromium browsers, such as Chrome and Edge.

Connect Mac Vault and configure its Classifier to obtain tags. A blocking group's tag filter chooses what to cover or hide. It does not start or pause tagging; use Mac Vault's Classifier settings or the individual Classifier group's pause control.

Choose certain tags, or everything except certain tags. A rule can combine tags (**Gaming + Drama**), require confidence (**Gaming @3**), or make an exception (**!Tutorial**). **Cover content** keeps tag correction available. **Hide content** removes the matching item.

**Also block content with no confident tag** includes completed results with no tag at the default confidence threshold, including low-confidence results. Explicit listed rules are checked first. **Untagged** means tagging finished with no tags; **Tagging** means a result is pending. The separate pending-content option controls covering items until tagging finishes.

### Correcting tags

Click an item's tag to open the correction chooser. Choose a suggested tag or enter a tag name and its confidence. Click a selected tag's remove control, or select it and press Delete once, to remove it. Corrections are sent to Mac Vault and used in future tagging. A failed lookup does not create an Untagged tag.

## Settings and connection

**Show the quick-add +** adds a small button to supported pages. Choose a group's + badge as the destination, then use the page button to add that page to its website list. On an allowlist this allows the page. Frozen groups do not accept quick additions.

The Classifier connection reports the local Mac Vault service. Configure Classifier groups, model downloads, Knowledge, research consent, and API providers in Mac Vault, not in this extension.

If tagging is missing, check that Mac Vault is open, the connection is established, tagging is enabled, the relevant Classifier group is resumed, and its platform feed is recorded. Check model download status in Mac Vault. If blocking does not apply, check the group's enabled state, targets, schedule, allowance, and snooze status.
