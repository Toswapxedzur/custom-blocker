// Custom Web Blocker — redirect templates.
//
// All redirect templates set ev.setRedirectLink(target) and call
// ev.preventDefault() / ev.setResult(-1). The target URL is taken
// verbatim from the params; we don't mangle it (besides the
// quoteJs() escaping). The popup helper layer treats redirect
// rules as a special kind of block — the user lands on `target`
// instead of seeing the block screen.

(function () {
  CB_REGISTER_TEMPLATES([
    {
      id: "redirect-distractions-to-focus",
      title: "Redirect Distractions To A Focus Page",
      description: "When you visit any of the listed sites, redirect to a focus page (e.g. a notes app, your task list, or example.com/focus).",
      tags: ["redirect", "site"],
      params: [
        { id: "domainsCsv", label: "Domains (comma separated)", type: "text", span: 2, defaultValue: "youtube.com,reddit.com,twitter.com" },
        { id: "target", label: "Redirect to", type: "text", span: 2, defaultValue: "https://example.com/focus" }
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
  const TARGET = ${quoteJs(values.target)};

  function maybeRedirect(ev) {
    const url = String(ev.url || "");
    if (!DOMAINS.some((d) => url.includes(d))) return;
    ev.setRedirectLink(TARGET);
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("focus-redirect", maybeRedirect);
  event.registerSwitchWebEvent("focus-redirect", maybeRedirect);
}`;
      }
    },
    {
      id: "redirect-shorts-to-watch",
      title: "Redirect YouTube Shorts → /feed/subscriptions",
      description: "Soft replacement for hard-blocking Shorts: every /shorts/ URL redirects to your subscriptions feed instead.",
      tags: ["redirect", "shorts", "youtube"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();
  function maybeRedirect(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    ev.setRedirectLink("https://www.youtube.com/feed/subscriptions");
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("yt-shorts-redirect", maybeRedirect);
  event.registerSwitchWebEvent("yt-shorts-redirect", maybeRedirect);
}`;
      }
    },
    {
      id: "redirect-reddit-to-old",
      title: "Force old.reddit.com",
      description: "Whenever you land on www.reddit.com, redirect to old.reddit.com — fewer distractions, faster page loads, no infinite-scroll feed.",
      tags: ["redirect", "reddit"],
      params: [],
      buildCode() {
        return `(event, helpers) => {
  function maybeRedirect(ev) {
    const url = String(ev.url || "");
    if (!/^https?:\\/\\/(www\\.)?reddit\\.com\\//.test(url)) return;
    const target = url.replace(/(www\\.)?reddit\\.com/, "old.reddit.com");
    ev.setRedirectLink(target);
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("reddit-old-redirect", maybeRedirect);
  event.registerSwitchWebEvent("reddit-old-redirect", maybeRedirect);
}`;
      }
    },
    {
      id: "redirect-twitter-to-nitter",
      title: "Redirect Twitter / X → Nitter",
      description: "Replace twitter.com / x.com with a privacy-respecting Nitter instance (configurable). Tweet links keep working.",
      tags: ["redirect", "twitter"],
      params: [
        { id: "nitterHost", label: "Nitter host", type: "text", span: 2, defaultValue: "nitter.net" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const NITTER = ${quoteJs(values.nitterHost)};
  function maybeRedirect(ev) {
    const url = String(ev.url || "");
    if (!/^https?:\\/\\/((www|mobile)\\.)?(twitter|x)\\.com\\//.test(url)) return;
    const target = url.replace(/((www|mobile)\\.)?(twitter|x)\\.com/, NITTER);
    ev.setRedirectLink(target);
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("twitter-nitter", maybeRedirect);
  event.registerSwitchWebEvent("twitter-nitter", maybeRedirect);
}`;
      }
    },
    {
      id: "redirect-newtab-to-task",
      title: "Redirect new tab to your task list",
      description: "Whenever you open chrome://newtab or about:blank, redirect to a task list URL (e.g. your daily plan).",
      tags: ["redirect", "focus"],
      params: [
        { id: "target", label: "Redirect to", type: "text", span: 2, defaultValue: "https://example.com/today" }
      ],
      buildCode(values) {
        return `(event, helpers) => {
  const TARGET = ${quoteJs(values.target)};
  function maybeRedirect(ev) {
    const url = String(ev.url || "");
    if (!/^chrome:\\/\\/newtab|^about:blank/.test(url)) return;
    ev.setRedirectLink(TARGET);
    ev.preventDefault();
    ev.setResult(-1);
  }
  event.registerOpenWebEvent("newtab-redirect", maybeRedirect);
  event.registerSwitchWebEvent("newtab-redirect", maybeRedirect);
}`;
      }
    }
  ]);
})();
