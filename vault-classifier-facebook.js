// Facebook's feed cards can be reels, videos, or posts. Their creator link is
// separate from the content permalink, so this collector keeps that boundary
// explicit before reading an avatar or source name.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)facebook\.com$/i.test(location?.hostname || ""); }
  function isContent(anchor) { return /\/(reel|watch|videos|posts|permalink|share\/r|share\/v)\//i.test(new URL(anchor.href).pathname); }
  function entryType(url) {
    const path = new URL(url).pathname.toLowerCase();
    return path.includes("/reel/") || path.includes("/share/r/") ? "short" : path.includes("/posts/") || path.includes("/permalink/") ? "post" : "video";
  }

  core.start({
    platform: "facebook",
    matchesPage,
    scan({ document, collect }) {
      const cards = core.uniqueElements([
        ...core.selectorElements(document, '[role="article"]'),
        ...core.selectorElements(document, '[data-pagelet*="FeedUnit"]'),
        ...core.selectorElements(document, '[data-pagelet*="Video"]')
      ]).slice(0, 80);
      for (const card of cards) {
        const entry = core.firstAnchor(card, ['a[href*="/reel/"]', 'a[href*="/watch/"]', 'a[href*="/videos/"]', 'a[href*="/posts/"]', 'a[href*="/permalink/"]', 'a[href*="/share/r/"]', 'a[href*="/share/v/"]'], isContent);
        if (!entry) continue;
        const source = core.firstNormalizedSourceAnchor("facebook", card, entry.href);
        if (!source) continue;
        collect({
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['[data-ad-preview="message"]', '[data-testid*="story"]', 'h1, h2, h3']) || core.compactText(entry.textContent, 500),
          creatorAvatarURL: core.avatarFromVerifiedSource("facebook", source, global.location.href),
          entryType: entryType(entry.href)
        });
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
