// Custom Web Blocker — debug / diagnostic templates.
//
// These are not productivity rules — they exercise the helper
// surface to help you confirm a setup change worked. Pair with
// "Debug mode" in Settings for full trace output in the Log
// panel and devtools console.

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "log-every-event",
      title: "Log Every Custom Event",
      description: "Logs the URL and event type for every navigation and SPA change. Useful for verifying that a content script has loaded on the site you care about.",
      tags: ["debug"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerOpenWebEvent("debug-open", (ev, h) => {
    h.getLogHelper().log("openWebEvent", ev.url);
  });
  event.registerSwitchWebEvent("debug-switch", (ev, h) => {
    h.getLogHelper().log("switchWebEvent", ev.url);
  });
  event.registerWebChangedEvent("debug-changed", (ev, h) => {
    h.getLogHelper().log("webChangedEvent", ev.url);
  });
}`;
      }
    }
  ]);
})();
