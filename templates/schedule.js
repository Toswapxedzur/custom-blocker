// Custom Web Blocker — schedule / time-of-day templates.
//
// Every event has ev.time = { now, month, dayOfMonth, dayName,
// hour, minute }. We never call new Date() inside user code because
// the dispatch pipeline already snapshots a consistent "now" per
// event. dayName is "Sunday".."Saturday" (capitalized).

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "weekday-window-block",
      title: "Weekday Working-Hours Block",
      description: "Block the listed sites Monday–Friday between two clock hours. Outside the window the rule does nothing.",
      tags: ["schedule", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "youtube.com,reddit.com,twitter.com" },
        { id: "startHour", label: "Start hour (0-23)", type: "number", min: 0, max: 23, step: 1, defaultValue: 9 },
        { id: "endHour", label: "End hour (0-23)", type: "number", min: 0, max: 23, step: 1, defaultValue: 18 }
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
  const START_HOUR = ${Number(values.startHour) || 0};
  const END_HOUR = ${Number(values.endHour) || 0};
  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    if (!WEEKDAYS.includes(ev.time.dayName)) return;
    if (ev.time.hour < START_HOUR || ev.time.hour >= END_HOUR) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("weekday-block", maybeBlock);
  event.registerSwitchWebEvent("weekday-block", maybeBlock);
}`;
      }
    },
    {
      id: "weekend-only-allow",
      title: "Weekend-Only Sites",
      description: "Block listed sites every weekday (any hour). Saturday and Sunday they are free. Inverse of a working-hours block — useful for entertainment portals.",
      tags: ["schedule", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "netflix.com,disneyplus.com,hbomax.com" }
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
  const WEEKEND = ["Saturday", "Sunday"];

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    if (WEEKEND.includes(ev.time.dayName)) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("weekend-only", maybeBlock);
  event.registerSwitchWebEvent("weekend-only", maybeBlock);
}`;
      }
    },
    {
      id: "before-bedtime-shutoff",
      title: "Pre-Bedtime Shutoff",
      description: "Block listed sites every night between two clock hours (overnight aware — works across midnight). Designed to protect sleep without using a timer.",
      tags: ["schedule", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "youtube.com,tiktok.com,instagram.com,reddit.com" },
        { id: "startHour", label: "From hour (0-23)", type: "number", min: 0, max: 23, step: 1, defaultValue: 22 },
        { id: "endHour", label: "Until hour (0-23)", type: "number", min: 0, max: 23, step: 1, defaultValue: 6 }
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
  const START = ${Number(values.startHour) || 0};
  const END = ${Number(values.endHour) || 0};

  function inOvernightWindow(hour) {
    if (START === END) return false;
    if (START < END) return hour >= START && hour < END;
    return hour >= START || hour < END;
  }

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    if (!inOvernightWindow(ev.time.hour)) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("bedtime-block", maybeBlock);
  event.registerSwitchWebEvent("bedtime-block", maybeBlock);
}`;
      }
    },
    {
      id: "first-hour-of-day-only",
      title: "Allow Only In One Hour Of Day",
      description: "Mirror image of bedtime: lets you visit listed sites only during a single hour-of-day, then locks them down for the rest of the day.",
      tags: ["schedule", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "news.ycombinator.com,reddit.com" },
        { id: "wakeHour", label: "Allowed hour (0-23)", type: "number", min: 0, max: 23, step: 1, defaultValue: 7 }
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
  const ALLOW_HOUR = ${Number(values.wakeHour) || 0};

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    if (ev.time.hour === ALLOW_HOUR) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("first-hour-only", maybeBlock);
  event.registerSwitchWebEvent("first-hour-only", maybeBlock);
}`;
      }
    },
    {
      id: "lunch-break-news",
      title: "News Allowed Only During Lunch",
      description: "Lock news sites all day except during a lunch window (e.g. 12:00–13:00). Useful for capping reactive news consumption.",
      tags: ["schedule", "site"],
      params: [
        { id: "domainsCsv", label: "News domains (comma separated)", type: "text", span: 2, defaultValue: "news.ycombinator.com,nytimes.com,bbc.com" },
        { id: "startHour", label: "Lunch start hour", type: "number", min: 0, max: 23, step: 1, defaultValue: 12 },
        { id: "endHour", label: "Lunch end hour", type: "number", min: 0, max: 23, step: 1, defaultValue: 13 }
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
  const START = ${Number(values.startHour) || 0};
  const END = ${Number(values.endHour) || 0};

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    if (ev.time.hour >= START && ev.time.hour < END) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("news-lunch-only", maybeBlock);
  event.registerSwitchWebEvent("news-lunch-only", maybeBlock);
}`;
      }
    },
    {
      id: "monday-fresh-start",
      title: "Monday Fresh Start",
      description: "On Monday only, block social/feed sites for the whole day to ensure a clean week start. Other days the rule is a no-op.",
      tags: ["schedule", "feed", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "facebook.com,instagram.com,reddit.com,twitter.com" }
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

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    if (ev.time.dayName !== "Monday") return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("monday-fresh", maybeBlock);
  event.registerSwitchWebEvent("monday-fresh", maybeBlock);
}`;
      }
    },
    {
      id: "minute-of-hour-window",
      title: "Allow Only First N Minutes Of Each Hour",
      description: "Lets you visit listed sites only during minutes 0..N of any hour (e.g. first 10 minutes), then blocks them for the remaining 50.",
      tags: ["schedule", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "twitter.com,x.com" },
        { id: "minutes", label: "Allowed minutes per hour", type: "number", min: 1, max: 59, step: 1, defaultValue: 10 }
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
  const ALLOWED = ${Number(values.minutes) || 0};

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    if (ev.time.minute < ALLOWED) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("minute-window", maybeBlock);
  event.registerSwitchWebEvent("minute-window", maybeBlock);
}`;
      }
    },
    {
      id: "deep-work-strict-block",
      title: "Deep-Work Strict Block",
      description: "Hard-block a CSV list of distraction sites Monday–Friday between two hours. Same shape as the working-hours block but escalated wording for serious focus blocks.",
      tags: ["schedule", "focus", "site"],
      params: [
        { id: "domainsCsv", label: "Distraction domains (comma separated)", type: "text", span: 2, defaultValue: "youtube.com,reddit.com,twitter.com,tiktok.com,instagram.com" },
        { id: "startHour", label: "Start hour (0-23)", type: "number", min: 0, max: 23, step: 1, defaultValue: 10 },
        { id: "endHour", label: "End hour (0-23)", type: "number", min: 0, max: 23, step: 1, defaultValue: 17 }
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
  const START = ${Number(values.startHour) || 0};
  const END = ${Number(values.endHour) || 0};
  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    if (!WEEKDAYS.includes(ev.time.dayName)) return;
    if (ev.time.hour < START || ev.time.hour >= END) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("deep-work-strict", maybeBlock);
  event.registerSwitchWebEvent("deep-work-strict", maybeBlock);
}`;
      }
    }
  ]);
})();
