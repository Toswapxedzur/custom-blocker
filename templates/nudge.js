// Custom Web Blocker — soft-nudge templates.
//
// Nudges don't block; they log a reminder, increment a counter,
// or insert a banner. Designed for awareness without friction.

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "log-distraction-visit",
      title: "Log Every Distraction Visit",
      description: "Append a Log entry every time you open one of the listed sites. No blocking, no redirect — just a paper trail you can review in the Log panel.",
      tags: ["nudge", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "youtube.com,reddit.com,twitter.com,tiktok.com" }
      ],
      buildCode(values) {
        const items = String(values.domainsCsv || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(quoteJs)
          .join(", ");
        return `(event, helpers) => {
  const DOMAINS = [${items}];

  event.registerOpenWebEvent("log-visit", (ev, h) => {
    const url = String(ev.url || "");
    const matched = DOMAINS.find((d) => url.includes(d));
    if (!matched) return;
    h.getLogHelper().log("visit", matched, "@", ev.time.hour + ":" + String(ev.time.minute).padStart(2, "0"));
  });
}`;
      }
    },
    {
      id: "warn-on-shorts-visit",
      title: "Warn On Each Shorts Visit",
      description: "Print a warn-level Log entry every time you open a YouTube Shorts URL. Soft-deterrent only.",
      tags: ["nudge", "shorts", "youtube"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();
  event.registerOpenWebEvent("warn-yt-shorts", (ev, h) => {
    if (!yt.isShortUrl(ev.url)) return;
    h.getLogHelper().warn("Shorts visit:", ev.url);
  });
}`;
      }
    },
    {
      id: "count-daily-visits",
      title: "Count Daily Visits To A Site",
      description: "Increments a per-day counter every time you open the target site, and logs the running total. Counter resets at midnight via the date in ev.time.",
      tags: ["nudge", "persistence", "site"],
      params: [
        { id: "domainContains", label: "URL contains", type: "text", defaultValue: "twitter.com" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};
  const persist = helpers.getPersistenceHelper();

  event.registerOpenWebEvent("count-visits", (ev, h) => {
    if (!String(ev.url || "").includes(TARGET)) return;
    const key = ev.time.month + "-" + ev.time.dayOfMonth;
    if (persist.get("countDay") !== key) {
      persist.set("countDay", key);
      persist.set("countN", 0);
    }
    const next = Number(persist.get("countN") || 0) + 1;
    persist.set("countN", next);
    h.getLogHelper().log(TARGET, "visits today:", next);
  });
}`;
      }
    }
  ]);
})();
