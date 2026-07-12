# Manual Custom-Rule Stress Pack

These rules deliberately target behavior that cannot be verified from this
machine: a real browser's DOM and visibility state, Chrome extension lifecycle,
macOS permission boundaries, and Windows foreground-window behavior.

Run only one rule at a time in a disposable Custom group. Several extension
rules can exit a real tab. Disable and delete the group after each check.

After every extension **Run**, reload the test URL. Custom handlers attach only
to future committed navigations; pressing Run alone does not replay an event in
an already-open tab.

## Extension: SPA Shorts navigation

```js
(events, helpers) => {
  events.on("webChangedEvent", "block-shorts-after-spa-navigation", (ev, h) => {
    const youtube = h.getPlatformHelper().youtube();
    if (youtube.isShortUrl(ev.url)) ev.preventDefault();
  });
}
```

Manual check: open YouTube Home, then enter Shorts using the page navigation
without reloading the tab. The rule should still stop the visit. This is likely
to expose differences between a committed SPA navigation and a normal load.

## Extension: volatile feed-card fields

```js
(events, helpers) => {
  const youtube = helpers.getPlatformHelper().youtube();
  youtube.hide("videos", (card) => {
    const title = String(card.title || card.text || "");
    const creator = String(card.creator || card.author || "");
    return /spoiler|doomscroll|breaking now/i.test(title) && creator.length > 0;
  }, { blockPageOnVisit: true });
}
```

Manual check: load YouTube Home, search results, a subscribed feed, and a
channel page. The test is looking for malformed cards, late-loaded cards, and
cards with missing creator metadata. Unrelated videos must remain visible.

## Extension: visible-time timer

```js
(events, helpers) => {
  const youtube = helpers.getPlatformHelper().youtube();
  helpers.getTimerHelper().getOrCreateTimer({
    id: "manual-shorts-budget",
    displayName: "Manual Shorts budget",
    direction: "backward",
    currentMs: 45000,
    scope: (url) => youtube.isShortUrl(url)
  });
}
```

Manual check: spend 10 seconds with a Shorts tab visible, move to another tab
for 20 seconds, then return. Only the visible 10 seconds should be deducted.
This depends on real browser heartbeat and tab-visibility signals.

## Extension: Run replacement while a tab is open

First run this rule:

```js
(events, helpers) => {
  events.on("webChangedEvent", "route", (ev) => {
    helpers.getLogHelper().log("old route: " + ev.url);
    if (ev.url.includes("manual-old-rule")) ev.preventDefault();
  });
}
```

Then replace it with this rule using the same Custom group and press Run:

```js
(events, helpers) => {
  events.on("webChangedEvent", "route", (ev) => {
    helpers.getLogHelper().log("new route: " + ev.url);
    if (ev.url.includes("manual-new-rule")) ev.preventDefault();
  });
}
```

Manual check: after the first Run, reload
`https://example.com/?manual-old-rule`; the Log should record `old route` and
the extension should exit that page. Replace the source, press Run, then reload
the old URL again; it must stay open and log `new route`. Finally reload
`https://example.com/?manual-new-rule`; that page should exit. This probes the
offscreen iframe, handler teardown, and content-side reconciliation together.

## macOS: browser boundary

There is deliberately no macOS browser-control rule. The native app neither
receives browser navigation events nor reads, closes, blocks, hides, suspends,
or launches browser apps. Website and tab checks belong to the browser
extension only.

## macOS: foreground app identity under rapid switching

```js
(events) => {
  events.on("appChangedEvent", "close-test-app", (ev) => {
    if (ev.data.appId === "com.example.FocusTestApp") ev.close();
  });
}
```

Manual check: replace the identifier with a harmless throwaway app, then switch
rapidly between it, Finder, and Notes. It should only close the target app.
This probes stale foreground identity and accessibility timing; do not target a
work application.

## macOS: reload while a native timer is active

```js
(events, helpers) => {
  events.on("tickEvent", "make-timer", (ev, h) => {
    h.getTimerHelper().getOrCreateTimer({
      id: "native-reload-budget",
      displayName: "Native reload budget",
      direction: "backward",
      currentMs: 60000
    });
  });
}
```

Manual check: let the timer run, edit the source, and press Run again. The old
timer must not leak into the new rule version. This needs the running host's
actual runtime reload path, not just the JavaScript runtime.

## Windows: foreground identity for a packaged or elevated app

```js
(events) => {
  events.on("appChangedEvent", "close-focus-test", (ev) => {
    if (ev.data.appId === "FocusTest.exe") ev.close();
  });
}
```

Manual check: replace `FocusTest.exe` with a harmless local test application,
including a packaged or elevated variant if available. Focus it after switching
through Explorer and a browser. The rule must not act on a launcher, helper,
or stale process identity.

## Windows: browser boundary

Do not use the native Windows app to test browser tabs. Browser navigation and
tab behavior are extension-only checks; Windows app rules should target a
harmless standalone application instead.

## Windows: rule reload during a foreground switch

```js
(events) => {
  events.on("focusEvent", "focus-marker", (ev, h) => {
    h.log("focused " + String(ev.data.appId || "unknown"));
  });
}
```

Manual check: alternate between two harmless apps while repeatedly editing and
running this rule. The Log should not contain duplicate messages from old rule
versions. This probes WebView2 lifecycle timing and handler cleanup.
