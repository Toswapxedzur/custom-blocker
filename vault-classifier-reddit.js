// Reddit collection is subreddit-scoped, not creator-scoped. A post is kept
// only after both its canonical comments link and its enclosing /r/<name>/
// source are visible in the same rendered card.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)reddit\.com$/i.test(location?.hostname || ""); }
  function isPost(anchor) { return /^\/r\/[^/]+\/comments\//i.test(new URL(anchor.href).pathname); }
  function pageRoute(location) {
    const match = String(location?.pathname || "").match(/^\/r\/([^/]+)\/comments\/([A-Za-z0-9_-]{3,128})\/?/i);
    return match ? { subreddit: match[1], postID: match[2] } : null;
  }

  core.start({
    platform: "reddit",
    matchesPage,
    scan({ document, collect }) {
      const cards = core.uniqueElements([
        ...core.selectorElements(document, "shreddit-post"),
        ...core.selectorElements(document, "article:has(shreddit-post)"),
        ...core.selectorElements(document, "div.thing[data-subreddit]")
      ]).slice(0, 80);
      for (const card of cards) {
        const entry = core.firstAnchor(card, ['a[href*="/comments/"]'], isPost);
        if (!entry) continue;
        const source = core.firstAnchor(card, ['a[href^="/r/"]'], (anchor) => Boolean(core.normalizedSourceIdentity("reddit", anchor.href)));
        if (!source) continue;
        const subreddit = core.normalizedSourceIdentity("reddit", source.href);
        collect({
          sourceKind: "subreddit",
          sourceIdentity: subreddit,
          entryURL: entry.href,
          sourceName: `r/${subreddit}`,
          title: core.firstText(card, ['[slot="title"]', 'a[href*="/comments/"] h1', 'h1, h2, h3']) || core.compactText(entry.textContent, 500),
          entryType: "post"
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = document.querySelector("shreddit-post") || document.querySelector("article shreddit-post") || document.querySelector("article");
      if (!root) return { ready: false, reason: "missing-content-root" };
      const title = core.firstText(root, ['[slot="title"]', 'h1', 'h2']);
      const body = core.firstText(root, ['[slot="text-body"]', '[slot="comment"]', '[data-testid="post-content"]'], 16000);
      if (!title && !body) return { ready: false, reason: "missing-title" };
      const sourceURL = `https://www.reddit.com/r/${route.subreddit}/`;
      collect({
        entryID: `reddit:post:${route.postID}`,
        surface: "page",
        sourceKind: "subreddit",
        sourceIdentity: route.subreddit,
        entryURL: global.location.href,
        sourceURL,
        sourceName: `r/${route.subreddit}`,
        title,
        text: body,
        suppliedTags: [...root.querySelectorAll?.('a[href*="/r/"]') || []].map((tag) => tag.textContent),
        entryType: "post"
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
