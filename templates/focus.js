// Custom Web Blocker — focus-mode templates.
//
// "Focus" templates are about temporarily denying access (or
// allowing only an allowlist) for a session, often combined with a
// timer. They're conceptually similar to schedule rules but the
// trigger is user-driven rather than calendar-driven.

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "allowlist-only-session",
      title: "Allowlist-Only Focus Session",
      description: "While the session timer is running, ONLY the listed domains are reachable; every other URL is blocked. When the timer ends the rule lapses.",
      tags: ["focus", "timer", "site"],
      params: [
        { id: "domainsCsv", label: "Allowed domains (comma separated)", type: "text", span: 2, defaultValue: "github.com,docs.google.com,notion.so" },
        { id: "minutes", label: "Session minutes", type: "number", min: 1, step: 1, defaultValue: 50 },
        { id: "timerId", label: "Timer ID", type: "text", defaultValue: "focus-session" }
      ],
      buildCode(values) {
        const items = String(values.domainsCsv || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map(quoteJs)
          .join(", ");
        return `(event, helpers) => {
  const ALLOW = [${items}];
  const TIMER_ID = ${quoteJs(values.timerId)};

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: ${minutesToMsLiteral(values.minutes)},
    displayName: "Focus session",
    scope: () => true,
    domain: () => true
  });

  function maybeBlock(ev, h) {
    if (h.getTimerHelper().isExpired(TIMER_ID)) return;
    const url = String(ev.url || "");
    if (ALLOW.some((d) => url.includes(d))) return;
    if (/^chrome:|^about:|^chrome-extension:/.test(url)) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("focus-allowlist", maybeBlock);
  event.registerSwitchWebEvent("focus-allowlist", maybeBlock);
}`;
      }
    },
    {
      id: "pomodoro-25-5",
      title: "Pomodoro 25/5 Mode",
      description: "Enforce a 25-minute focus + 5-minute break cycle: distraction sites are blocked during focus, allowed during break. Uses two timers that drive each other via timerEnded.",
      tags: ["focus", "timer", "site"],
      params: [
        { id: "domainsCsv", label: "Distraction domains (comma separated)", type: "text", span: 2, defaultValue: "youtube.com,reddit.com,twitter.com,instagram.com" }
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
  const FOCUS_MS = 25 * 60 * 1000;
  const BREAK_MS = 5 * 60 * 1000;
  const persist = helpers.getPersistenceHelper();

  if (!persist.get("pomodoroPhase")) persist.set("pomodoroPhase", "focus");

  helpers.getTimerHelper().getOrCreateTimer({
    id: "pomodoro-focus",
    direction: "backward",
    currentMs: FOCUS_MS,
    displayName: "Focus 25",
    scope: () => persist.get("pomodoroPhase") === "focus",
    domain: () => persist.get("pomodoroPhase") === "focus"
  });
  helpers.getTimerHelper().getOrCreateTimer({
    id: "pomodoro-break",
    direction: "backward",
    currentMs: BREAK_MS,
    displayName: "Break 5",
    scope: () => persist.get("pomodoroPhase") === "break",
    domain: () => persist.get("pomodoroPhase") === "break"
  });

  function maybeBlock(ev, h) {
    if (h.getPersistenceHelper().get("pomodoroPhase") !== "focus") return;
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("pomodoro-focus-block", maybeBlock);
  event.registerSwitchWebEvent("pomodoro-focus-block", maybeBlock);

  event.registerTimerEndedEvent("pomodoro-cycle", (ev, h) => {
    const phase = h.getPersistenceHelper().get("pomodoroPhase");
    if (ev?.data?.id === "pomodoro-focus" && phase === "focus") {
      h.getPersistenceHelper().set("pomodoroPhase", "break");
      h.getTimerHelper().setCurrentMs("pomodoro-break", BREAK_MS);
    } else if (ev?.data?.id === "pomodoro-break" && phase === "break") {
      h.getPersistenceHelper().set("pomodoroPhase", "focus");
      h.getTimerHelper().setCurrentMs("pomodoro-focus", FOCUS_MS);
    }
  });
}`;
      }
    },
    {
      id: "block-during-meeting",
      title: "Block Distractions While In A Meeting",
      description: "Blocks listed sites whenever a meeting URL (Google Meet / Zoom / Teams) is open in any tab. Uses persistence to remember meeting state across dispatches.",
      tags: ["focus", "site"],
      params: [
        { id: "domainsCsv", label: "Distractions (comma separated)", type: "text", span: 2, defaultValue: "youtube.com,reddit.com,twitter.com" }
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
  const persist = helpers.getPersistenceHelper();
  const MEETING_HOSTS = ["meet.google.com", "zoom.us", "teams.microsoft.com"];
  const isMeetingUrl = (url) => MEETING_HOSTS.some((h) => String(url || "").includes(h));

  function trackMeeting(ev) {
    if (isMeetingUrl(ev.url)) persist.set("inMeeting", true);
  }
  event.registerOpenWebEvent("meet-track", trackMeeting);
  event.registerSwitchWebEvent("meet-track", trackMeeting);

  function maybeBlock(ev, h) {
    if (!h.getPersistenceHelper().get("inMeeting")) return;
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("meet-block", maybeBlock);
  event.registerSwitchWebEvent("meet-block", maybeBlock);
}`;
      }
    },
    {
      id: "block-after-n-distraction-visits",
      title: "Block After N Visits Today",
      description: "Counts how many times you have OPENED any of the listed sites today. After N opens, all of them are blocked until tomorrow (counter resets at midnight).",
      tags: ["focus", "persistence", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "twitter.com,reddit.com,instagram.com" },
        { id: "limit", label: "Visits before block", type: "number", min: 1, step: 1, defaultValue: 5 }
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
  const LIMIT = ${Number(values.limit) || 0};
  const persist = helpers.getPersistenceHelper();

  function todayKey(t) {
    return t.dayName + "-" + t.month + "-" + t.dayOfMonth;
  }

  function maybeBlock(ev, h) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;

    const key = todayKey(ev.time);
    if (persist.get("visitDay") !== key) {
      persist.set("visitDay", key);
      persist.set("visitCount", 0);
    }
    const count = Number(persist.get("visitCount") || 0);

    if (count >= LIMIT) {
      ev.preventDefault();
      ev.setResult(-1);
      return;
    }
    persist.set("visitCount", count + 1);
  }
  event.registerOpenWebEvent("visit-cap", maybeBlock);
  event.registerSwitchWebEvent("visit-cap", maybeBlock);
}`;
      }
    },
    {
      id: "block-on-streak-loss",
      title: "Block Hardest Sites After A Loss",
      description: "If you visited any 'penalty' site yesterday, the rule blocks them for the entire next day. Encourages a streak. Resets when a clean day completes.",
      tags: ["focus", "persistence", "site"],
      params: [
        { id: "domainsCsv", label: "Penalty domains (comma separated)", type: "text", span: 2, defaultValue: "tiktok.com,instagram.com" }
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
  const persist = helpers.getPersistenceHelper();

  function dateKey(t) {
    return t.month + "-" + t.dayOfMonth;
  }

  function maybeBlock(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;

    const today = dateKey(ev.time);
    const lastVisit = persist.get("lastPenaltyDay");
    const penaltyUntil = persist.get("penaltyUntil");

    if (penaltyUntil && penaltyUntil === today) {
      ev.preventDefault();
      ev.setResult(-1);
      return;
    }

    if (lastVisit && lastVisit !== today) {
      persist.set("penaltyUntil", today);
      ev.preventDefault();
      ev.setResult(-1);
      return;
    }

    persist.set("lastPenaltyDay", today);
  }
  event.registerOpenWebEvent("streak-loss", maybeBlock);
  event.registerSwitchWebEvent("streak-loss", maybeBlock);
}`;
      }
    }
  ]);
})();
