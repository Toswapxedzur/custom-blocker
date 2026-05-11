// Custom Web Blocker — timer templates.
//
// Every template here uses the visibility-aware heartbeat path
// (pageHeartbeatEvent) under the hood: getOrCreateTimer({ scope })
// auto-ticks the timer ONLY while a tab is visible AND its scope(url)
// returns true. The on-page overlay shows a row whenever
// domain(url) (or scope by default) returns true. The timer helper
// itself never blocks; templates that want a hard block install an
// openWebEvent / switchWebEvent handler that calls preventDefault()
// when the timer hits zero.

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "demo-countdown-3s",
      title: "Demo Countdown (3s)",
      description: "Smoke test for the heartbeat-driven timer pipeline. Counts a tiny 3-second backward timer on every page; the overlay should reach 0 in 3 seconds and fire timerEnded once.",
      tags: ["timer", "debug"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  helpers.getTimerHelper().getOrCreateTimer({
    id: "demo",
    direction: "backward",
    currentMs: 3000,
    displayName: "Demo countdown",
    scope: () => true,
    domain: () => true
  });

  event.registerTimerEndedEvent("demo-ended", (ev, h) => {
    h.getLogHelper().log("demo timer ended:", ev.data);
  });
}`;
      }
    },
    {
      id: "site-time-budget",
      title: "Website Time Budget (countdown + block)",
      description: "Auto-tick a countdown while you are on the site, show it in the on-page overlay, and block when it hits zero. Only counts visible-page time — same source as the default block-group countdown.",
      tags: ["timer", "site"],
      params: [
        { id: "domainContains", label: "URL contains", type: "text", defaultValue: "reddit.com" },
        { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 20 },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "budget-site" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "Site Budget" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};
  const TIMER_ID = ${quoteJs(values.timerId)};
  const onTarget = (url) => typeof url === "string" && url.includes(TARGET);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)},
    scope: onTarget,
    domain: onTarget
  });

  function blockIfExpired(ev, h) {
    if (!onTarget(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("block-when-expired", blockIfExpired);
  event.registerSwitchWebEvent("block-when-expired", blockIfExpired);
}`;
      }
    },
    {
      id: "site-time-tracker-up",
      title: "Website Time Tracker (count up)",
      description: "Pure tracker: counts UP while you are on the site, shows the elapsed time in the on-page overlay, never blocks. Useful for awareness without a hard cap.",
      tags: ["timer", "count-up", "site"],
      params: [
        { id: "domainContains", label: "URL contains", type: "text", defaultValue: "youtube.com" },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "tracker-site" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "Time on site" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TARGET = ${quoteJs(values.domainContains)};
  const TIMER_ID = ${quoteJs(values.timerId)};
  const onTarget = (url) => typeof url === "string" && url.includes(TARGET);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "forward",
    currentMs: 0,
    displayName: ${quoteJs(values.displayName)},
    scope: onTarget,
    domain: onTarget
  });
}`;
      }
    },
    {
      id: "youtube-shorts-cap",
      title: "YouTube Shorts Daily Cap",
      description: "Auto-tick a Shorts-only countdown, render it in the page overlay only on Shorts, and block when it hits zero. timerEnded fires once.",
      tags: ["timer", "shorts", "youtube"],
      params: [
        { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 30 },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "yt-shorts" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "YT Shorts" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)},
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!onShorts(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("yt-shorts-block", maybeBlock);
  event.registerSwitchWebEvent("yt-shorts-block", maybeBlock);

  event.registerTimerEndedEvent("yt-shorts-ended", (ev, h) => {
    h.getLogHelper().log("YouTube Shorts time used up:", ev.data);
  });
}`;
      }
    },
    {
      id: "youtube-watch-tracker-up",
      title: "YouTube /watch Time Tracker",
      description: "Counts UP only on /watch pages (not Shorts, not the home feed). Use it to measure how much actual long-form video you consume — never blocks.",
      tags: ["timer", "count-up", "youtube"],
      params: [
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "yt-watch-up" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "YT Watch" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const yt = helpers.getDomainHelper().youtube();
  const onWatch = (url) => yt.isVideoUrl(url) && !yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "forward",
    currentMs: 0,
    displayName: ${quoteJs(values.displayName)},
    scope: onWatch,
    domain: (url) => yt.isPlatformUrl(url)
  });
}`;
      }
    },
    {
      id: "tiktok-feed-cap",
      title: "TikTok Feed Cap",
      description: "Auto-tick a TikTok-only countdown, show it in the overlay on TikTok pages, and block any TikTok URL once expired.",
      tags: ["timer", "shorts", "tiktok"],
      params: [
        { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 20 },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "tiktok-feed" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "TikTok" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const tiktok = helpers.getDomainHelper().tiktok();
  const tickWhen = (url) => tiktok.isShortUrl(url);
  const showWhen = (url) => tiktok.isPlatformUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)},
    scope: tickWhen,
    domain: showWhen
  });

  function maybeBlock(ev, h) {
    if (!tiktok.isPlatformUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("tt-block", maybeBlock);
  event.registerSwitchWebEvent("tt-block", maybeBlock);
}`;
      }
    },
    {
      id: "instagram-reels-cap",
      title: "Instagram Reels Cap",
      description: "Auto-tick on Reels only, render the overlay on any Instagram URL, and block once expired.",
      tags: ["timer", "shorts", "instagram"],
      params: [
        { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 15 },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "ig-reels" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "IG Reels" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const ig = helpers.getDomainHelper().instagram();
  const tickWhen = (url) => ig.isShortUrl(url);
  const showWhen = (url) => ig.isPlatformUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)},
    scope: tickWhen,
    domain: showWhen
  });

  function maybeBlock(ev, h) {
    if (!ig.isPlatformUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("ig-block", maybeBlock);
  event.registerSwitchWebEvent("ig-block", maybeBlock);
}`;
      }
    },
    {
      id: "facebook-reels-cap",
      title: "Facebook Reels Cap",
      description: "Auto-tick on Facebook Reels (the short-video tab) and block once expired. Other Facebook surfaces stay accessible.",
      tags: ["timer", "shorts", "facebook"],
      params: [
        { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 10 },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "fb-reels" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "FB Reels" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const fb = helpers.getDomainHelper().facebook();
  const tickWhen = (url) => fb.isShortUrl(url);
  const showWhen = (url) => fb.isPlatformUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)},
    scope: tickWhen,
    domain: showWhen
  });

  function maybeBlock(ev, h) {
    if (!fb.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("fb-reels-block", maybeBlock);
  event.registerSwitchWebEvent("fb-reels-block", maybeBlock);
}`;
      }
    },
    {
      id: "twitch-clips-cap",
      title: "Twitch Clips Cap",
      description: "Auto-tick a countdown only on Twitch clip pages and block clip pages once expired. Streams and the rest of Twitch are unaffected.",
      tags: ["timer", "shorts", "twitch"],
      params: [
        { id: "minutes", label: "Minutes", type: "number", min: 1, step: 1, defaultValue: 15 },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "twitch-clips" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "Twitch Clips" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TIMER_ID = ${quoteJs(values.timerId)};
  const tv = helpers.getDomainHelper().twitch();
  const onClips = (url) => tv.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: ${quoteJs(values.displayName)},
    scope: onClips,
    domain: onClips
  });

  function maybeBlock(ev, h) {
    if (!onClips(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("twitch-clips-block", maybeBlock);
  event.registerSwitchWebEvent("twitch-clips-block", maybeBlock);
}`;
      }
    },
    {
      id: "universal-distraction-budget",
      title: "Universal Distraction Budget",
      description: "ONE shared countdown that ticks on any of your distraction sites (CSV). Once it hits zero, every site in the list is blocked. Visiting any of them counts down the same shared budget.",
      tags: ["timer", "site"],
      params: [
        {
          id: "domainsCsv",
          label: "Domains (comma separated)",
          type: "text",
          span: 2,
          defaultValue: "youtube.com,reddit.com,twitter.com,tiktok.com,instagram.com"
        },
        { id: "minutes", label: "Total minutes per session", type: "number", min: 1, step: 1, defaultValue: 30 },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "distraction-budget" }
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
  const TIMER_ID = ${quoteJs(values.timerId)};
  const matchesAny = (url) => {
    if (typeof url !== "string") return false;
    for (const d of DOMAINS) { if (url.includes(d)) return true; }
    return false;
  };

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: "Distraction budget",
    scope: matchesAny,
    domain: matchesAny
  });

  function blockIfExpired(ev, h) {
    if (!matchesAny(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("distraction-block", blockIfExpired);
  event.registerSwitchWebEvent("distraction-block", blockIfExpired);
}`;
      }
    },
    {
      id: "daily-deep-work-up",
      title: "Daily Deep-Work Tracker (count up)",
      description: "Counts UP while you are on a focus-friendly site (CSV). No blocking — just an at-a-glance overlay showing how much real focus time you've accumulated this session.",
      tags: ["timer", "count-up", "focus", "site"],
      params: [
        {
          id: "domainsCsv",
          label: "Focus domains (comma separated)",
          type: "text",
          span: 2,
          defaultValue: "github.com,docs.google.com,notion.so,leetcode.com"
        },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "deep-work-up" },
        { id: "displayName", label: "Display name", type: "text", defaultValue: "Deep work" }
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
  const matchesAny = (url) => {
    if (typeof url !== "string") return false;
    for (const d of DOMAINS) { if (url.includes(d)) return true; }
    return false;
  };

  helpers.getTimerHelper().getOrCreateTimer({
    id: ${quoteJs(values.timerId)},
    direction: "forward",
    currentMs: 0,
    displayName: ${quoteJs(values.displayName)},
    scope: matchesAny,
    domain: matchesAny
  });
}`;
      }
    }
  ]);
})();
