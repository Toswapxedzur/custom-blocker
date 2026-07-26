// Instagram exposes reels and posts through stable permalink shapes. The
// profile link is verified separately so a tagged account or media thumbnail
// never becomes the collection source.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)instagram\.com$/i.test(location?.hostname || ""); }
  function isContent(anchor) { return /^\/(reel|p|tv)\//i.test(new URL(anchor.href).pathname); }
  function entryType(url) {
    const path = new URL(url).pathname.toLowerCase();
    return path.startsWith("/reel/") ? "short" : path.startsWith("/p/") ? "post" : "video";
  }
  function pageRoute(location) {
    const match = String(location?.pathname || "").match(/^\/(reel|p|tv)\/([A-Za-z0-9_-]{3,128})\/?$/i);
    return match ? { kind: match[1].toLowerCase(), contentID: match[2] } : null;
  }

  core.start({
    platform: "instagram",
    matchesPage,
    scan({ document, collect }) {
      const cards = core.uniqueElements([
        ...core.selectorElements(document, "article"),
        ...core.selectorElements(document, '[role="article"]'),
        ...core.selectorElements(document, '[role="button"]')
      ]).slice(0, 80);
      for (const card of cards) {
        const entry = core.firstAnchor(card, ['a[href^="/reel/"]', 'a[href^="/p/"]', 'a[href^="/tv/"]'], isContent);
        if (!entry) continue;
        const source = core.firstVerifiedSourceAnchor("instagram", card, [
          "article header a[href]",
          "header a[href]"
        ], entry.href);
        if (!source) continue;
        collect({
          presentationRoot: card,
          presentationAnchor: source,
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['h1, h2, h3', '[aria-label*="caption" i]']) || core.compactText(entry.getAttribute("aria-label") || entry.textContent, 500),
          text: core.firstText(card, [
            '[data-testid*="post-caption"]',
            '[aria-label*="caption" i]',
            'ul > div > li:first-child span[dir="auto"]'
          ], 16000),
          suppliedTags: [...card.querySelectorAll?.('a[href*="/explore/tags/"]') || []].map((tag) => tag.textContent),
          sourceIconURL: core.sourceIconFromVerifiedSource("instagram", source, global.location.href),
          entryType: entryType(entry.href)
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = core.matchingContentRoot("instagram", document, [
        '[role="dialog"] article',
        "article"
      ], global.location.href, global.location.href);
      if (!root) return { ready: false, reason: "missing-content-root" };
      const source = core.firstVerifiedSourceAnchor("instagram", root, [
        "article header a[href]", "header a[href]", '[role="dialog"] header a[href]'
      ], global.location.href);
      if (!source) return { ready: false, reason: "missing-source" };
      const caption = core.firstText(root, [
        '[data-testid*="post-caption"]',
        "h1",
        "h2",
        'ul > div > li:first-child span[dir="auto"]'
      ], 16000);
      const title = core.compactText(caption, 500) || core.firstText(root, ["h1", "h2"]);
      if (!title && !caption) return { ready: false, reason: "missing-title" };
      collect({
        presentationRoot: root,
        presentationAnchor: source,
        entryID: `instagram:${route.kind}:${route.contentID}`,
        surface: "page",
        sourceKind: "creator",
        entryURL: global.location.href,
        sourceURL: source.href,
        sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
        title,
        text: caption,
        suppliedTags: [...root.querySelectorAll?.('a[href*="/explore/tags/"]') || []].map((tag) => tag.textContent),
        sourceIconURL: core.sourceIconFromVerifiedSource("instagram", source, global.location.href),
        entryType: route.kind === "reel" ? "short" : route.kind === "p" ? "post" : "video"
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
