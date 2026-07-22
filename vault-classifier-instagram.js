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
        const source = core.firstNormalizedSourceAnchor("instagram", card, entry.href);
        if (!source) continue;
        collect({
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['h1, h2, h3', '[aria-label*="caption" i]']) || core.compactText(entry.getAttribute("aria-label") || entry.textContent, 500),
          creatorAvatarURL: core.avatarFromVerifiedSource("instagram", source, global.location.href),
          entryType: entryType(entry.href)
        });
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
