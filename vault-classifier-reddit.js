// Reddit collection is subreddit-scoped, not author-scoped. The subreddit is
// verified from the canonical post route and its source URL is composed
// locally. Only the matching post root may contribute title/body/flair data;
// comment bodies and post media are never read.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)reddit\.com$/i.test(location?.hostname || ""); }
  function postRoute(value) {
    try {
      const match = new URL(value, global.location.href).pathname.match(/^\/r\/([^/]+)\/comments\/([A-Za-z0-9_-]{3,128})(?:\/|$)/i);
      return match ? { subreddit: match[1], postID: match[2] } : null;
    } catch (_) {
      return null;
    }
  }
  function isPost(anchor) { return Boolean(postRoute(anchor.href)); }
  function pageRoute(location) {
    return postRoute(location?.href || location?.pathname || "");
  }
  function sourceURL(route) {
    return `https://www.reddit.com/r/${encodeURIComponent(route.subreddit)}/`;
  }
  function sourceName(root, route) {
    const rendered = core.compactText(
      root?.getAttribute?.("subreddit-prefixed-name")
        || root?.getAttribute?.("subreddit-name"),
      256
    );
    const candidate = rendered?.startsWith("r/") ? rendered : rendered ? `r/${rendered}` : null;
    return candidate && candidate.slice(2).toLowerCase() === route.subreddit.toLowerCase()
      ? candidate
      : `r/${route.subreddit}`;
  }
  function postText(root) {
    return core.firstText(root, [
      '[slot="text-body"]',
      '[data-post-click-location="text-body"]',
      '[data-testid="post-content"]'
    ], 16000);
  }
  function postTags(root) {
    return [...root?.querySelectorAll?.(
      '[slot="post-flair"], [data-post-click-location="post-flair"], a[href*="f=flair_name"]'
    ) || []].map((tag) => tag.textContent);
  }
  function postMetadata(root) {
    const fields = {
      authorName: root?.getAttribute?.("author"),
      score: root?.getAttribute?.("score"),
      commentCount: root?.getAttribute?.("comment-count"),
      published: root?.getAttribute?.("created-timestamp"),
      postType: root?.getAttribute?.("post-type"),
      language: root?.getAttribute?.("post-language"),
      domain: root?.getAttribute?.("domain")
    };
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => typeof value === "string" && value.trim()));
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
        const route = postRoute(entry.href);
        if (!route) continue;
        const composedSourceURL = sourceURL(route);
        const source = core.matchingSourceAnchor("reddit", card, composedSourceURL);
        collect({
          presentationRoot: card,
          presentationAnchor: source,
          entryID: `reddit:post:${route.postID}`,
          sourceKind: "subreddit",
          sourceIdentity: route.subreddit.toLowerCase(),
          entryURL: entry.href,
          sourceURL: composedSourceURL,
          sourceName: sourceName(card, route),
          title: core.firstText(card, ['[slot="title"]', 'a[href*="/comments/"] h1', 'h1, h2, h3'])
            || core.compactText(card.getAttribute?.("post-title"), 500)
            || core.compactText(entry.textContent, 500),
          text: postText(card),
          suppliedTags: postTags(card),
          metadata: postMetadata(card),
          sourceIconURL: core.sourceIconFromVerifiedSource("reddit", source, global.location.href),
          entryType: "post"
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = core.matchingContentRoot("reddit", document, [
        "shreddit-post",
        "article shreddit-post",
        "article"
      ], global.location.href, global.location.href);
      if (!root) return { ready: false, reason: "missing-content-root" };
      const title = core.firstText(root, ['[slot="title"]', 'h1', 'h2'])
        || core.compactText(root.getAttribute?.("post-title"), 500);
      const body = postText(root);
      if (!title && !body) return { ready: false, reason: "missing-title" };
      const composedSourceURL = sourceURL(route);
      const source = core.matchingSourceAnchor("reddit", root, composedSourceURL);
      collect({
        presentationRoot: root,
        presentationAnchor: source,
        entryID: `reddit:post:${route.postID}`,
        surface: "page",
        sourceKind: "subreddit",
        sourceIdentity: route.subreddit.toLowerCase(),
        entryURL: global.location.href,
        sourceURL: composedSourceURL,
        sourceName: sourceName(root, route),
        title,
        text: body,
        suppliedTags: postTags(root),
        metadata: postMetadata(root),
        sourceIconURL: core.sourceIconFromVerifiedSource("reddit", source, global.location.href),
        entryType: "post"
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
