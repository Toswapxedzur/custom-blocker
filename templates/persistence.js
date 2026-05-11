// Custom Web Blocker — persistence-driven templates.
//
// These templates use getPersistenceHelper() to remember state
// across browser sessions: monthly visit caps, weekly bans, etc.
// Persistence is per-rule, so two rules don't share keys.

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "monthly-visit-cap",
      title: "Monthly Visit Cap",
      description: "Allow at most N opens of a site per calendar month. Counter resets when the month changes (using ev.time.month).",
      tags: ["persistence", "site"],
      params: [
        { id: "domainContains", label: "URL contains", type: "text", defaultValue: "youtube.com" },
        { id: "limit", label: "Max visits per month", type: "number", min: 1, step: 1, defaultValue: 50 }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};
  const LIMIT = ${Number(values.limit) || 0};
  const persist = helpers.getPersistenceHelper();

  function maybeBlock(ev) {
    if (!String(ev.url || "").includes(TARGET)) return;
    const month = ev.time.month;
    if (persist.get("monthCapMonth") !== month) {
      persist.set("monthCapMonth", month);
      persist.set("monthCapCount", 0);
    }
    const count = Number(persist.get("monthCapCount") || 0);
    if (count >= LIMIT) {
      ev.preventDefault();
      ev.setResult(-1);
      return;
    }
    persist.set("monthCapCount", count + 1);
  }
  event.registerOpenWebEvent("monthly-cap", maybeBlock);
  event.registerSwitchWebEvent("monthly-cap", maybeBlock);
}`;
      }
    },
    {
      id: "weekly-ban",
      title: "Weekly Ban Toggle",
      description: "Adds a manual on/off persistence flag (banWeek). When set, the site is blocked. Useful when paired with a manual rule that flips the flag — e.g. via a tickEvent or another rule.",
      tags: ["persistence", "site"],
      params: [
        { id: "domainContains", label: "URL contains", type: "text", defaultValue: "tiktok.com" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};
  const persist = helpers.getPersistenceHelper();

  function maybeBlock(ev) {
    if (!String(ev.url || "").includes(TARGET)) return;
    if (!persist.get("banWeek")) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("week-ban", maybeBlock);
  event.registerSwitchWebEvent("week-ban", maybeBlock);
}`;
      }
    },
    {
      id: "track-discord-channels",
      title: "Track Discord Channels Visited",
      description: "Records every Discord channel URL you open with a timestamp. Read the running list back via the Log panel — useful for measuring how scattered your day is.",
      tags: ["persistence", "discord"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  const persist = helpers.getPersistenceHelper();
  event.registerOpenWebEvent("track-discord", (ev, h) => {
    const url = String(ev.url || "");
    if (!url.includes("discord.com")) return;
    const list = persist.get("discordList") || [];
    list.push(url + " @ " + ev.time.hour + ":" + ev.time.minute);
    if (list.length > 50) list.splice(0, list.length - 50);
    persist.set("discordList", list);
    h.getLogHelper().log("discord channels tracked:", list.length);
  });
}`;
      }
    }
  ]);
})();
