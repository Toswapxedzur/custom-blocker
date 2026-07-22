// Reddit collection is subreddit-scoped, not creator-scoped. A post is kept
// only after both its canonical comments link and its enclosing /r/<name>/
// source are visible in the same rendered card.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)reddit\.com$/i.test(location?.hostname || ""); }
  function isPost(anchor) { return /^\/r\/[^/]+\/comments\//i.test(new URL(anchor.href).pathname); }

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
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
