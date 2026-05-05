# Custom Web Blocker

A minimal Chrome/Edge extension that blocks any sites you add to its list.
When a blocked page is opened, the browser shows its normal extension-blocked
screen, similar to `ERR_BLOCKED_BY_CLIENT`.

## Features

- Create multiple named block groups
- Enable or disable each block group independently
- Drag block groups to reorder them
- Choose between immediate blocking and blocking after a number of browsing minutes
- Set a decimal-hour reset interval for each timed block group
- Freeze or strict-freeze a group to protect it from edits
- Snooze a group temporarily with a required written reason
- Show a small top-left countdown while tracked pages are still allowed to load
- Automatically block future visits once a group's timer runs out
- Add one website per line inside each group
- Accept domains like `facebook.com` or full URLs like `https://facebook.com/feed`
- Save your changes automatically as you type
- Block both direct page visits and embedded frames

## Install

1. Open `chrome://extensions` in Chrome or Edge.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder: `customBlocker`.

## Use

1. Click the extension icon.
2. Click **Add Group** to create a named block group.
3. Add one site per line inside that group.
4. Choose whether the group should block immediately or only after a certain number of browsing minutes.
5. If you choose timed blocking, set how often the timer resets in hours. Decimal values are allowed.
6. Changes save automatically.
7. Optional: freeze the group, or strict-freeze it for a decimal number of hours.
8. Optional: snooze the group temporarily by entering a reason with more than 20 words.
9. Use the checkbox beside each group to enable or disable it instantly.
10. Drag groups in the left column to reorder them.
11. Visit one of the tracked sites to confirm the timer appears.
12. Keep the page open until the timer reaches zero and confirm future visits are blocked.

## Notes

- Full URLs are converted to hostnames, so `https://example.com/page` blocks
  `example.com`.
- `www.` is removed automatically, so entering `www.youtube.com` will block
  `youtube.com` and its usual site matches.
- If you used the older single-list version, your existing sites are migrated
  into a default block group automatically.
- The top-left timer only counts while the page is visible. When the timer runs
  out, the extension tries to close the current page and falls back to sending
  it to `about:blank`.
- The in-page timer is intentionally minimal and only shows `hh:mm:ss`.
- Snoozes and reset intervals are scheduled in the background, so rules should
  update even when the popup is closed.
- Once Chrome blocks a page natively, the browser error page cannot be
  customized by the extension.
