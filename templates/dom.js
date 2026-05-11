// Custom Web Blocker — DOM tweak templates.
//
// These don't block — they just hide / inject CSS rules to clean
// up specific UIs. All of them use webChangedEvent so the DOM
// helper re-applies after SPA navigations and feed mutations.

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "youtube-hide-autoplay",
      title: "Hide YouTube Autoplay Toggle",
      description: "Hide the autoplay toggle on the YouTube watch page so it can't be re-enabled by accident.",
      tags: ["dom", "youtube"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-yt-autoplay", (ev, h) => {
    if (!h.getDomainHelper().isYouTubeHost(h.getDomainHelper().hostnameOf(ev.url))) return;
    h.getDOMHelper().hide(".ytp-autonav-toggle-button");
  });
}`;
      }
    },
    {
      id: "twitter-hide-whats-happening",
      title: "Hide Twitter / X 'What's happening'",
      description: "Hide the right-rail 'What's happening' module on Twitter / X. The compose box and main column stay visible.",
      tags: ["dom", "twitter"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  event.registerWebChangedEvent("hide-x-whats-happening", (ev, h) => {
    if (!/twitter\\.com|x\\.com/.test(String(ev.url || ""))) return;
    h.getDOMHelper().hide("[aria-label=\\"Timeline: Trending now\\"]");
  });
}`;
      }
    },
    {
      id: "generic-hide-selectors",
      title: "Hide Custom Selectors On A Site",
      description: "Generic DOM-clean-up: pass a domain plus one or more CSS selectors and the rule hides them on every load. Selectors are comma separated.",
      tags: ["dom", "site"],
      params: [
        { id: "domainContains", label: "URL contains", type: "text", defaultValue: "example.com" },
        { id: "selectorsCsv", label: "Selectors (comma separated)", type: "text", span: 2, defaultValue: ".ad, .promo, [data-tracking]" }
      ],
      buildCode(values) {
        const items = String(values.selectorsCsv || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(quoteJs)
          .join(", ");
        return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};
  const SELECTORS = [${items}];

  event.registerWebChangedEvent("hide-custom-selectors", (ev, h) => {
    if (!String(ev.url || "").includes(TARGET)) return;
    for (const sel of SELECTORS) h.getDOMHelper().hide(sel);
  });
}`;
      }
    }
  ]);
})();
