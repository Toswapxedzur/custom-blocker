// TikTok's video cards use data-e2e wrappers and encode the creator in the
// video URL. Keep that extraction local to TikTok rather than sharing it with
// a different platform's DOM.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)tiktok\.com$/i.test(location?.hostname || ""); }
  function isVideo(anchor) { return /\/@[^/]+\/video\//i.test(new URL(anchor.href).pathname); }

  core.start({
    platform: "tiktok",
    matchesPage,
    scan({ document, collect }) {
      const cards = core.uniqueElements([
        ...core.selectorElements(document, '[data-e2e="recommend-list-item-container"]'),
        ...core.selectorElements(document, '[data-e2e="search-card"]'),
        ...core.selectorElements(document, '[data-e2e="video-item"]'),
        ...core.selectorElements(document, '[data-e2e*="feed-item"]')
      ]).slice(0, 80);
      for (const card of cards) {
        const entry = core.firstAnchor(card, ['a[href*="/video/"]'], isVideo);
        if (!entry) continue;
        const source = core.matchingSourceAnchor("tiktok", card, entry.href) || entry;
        collect({
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['[data-e2e*="title"]', '[data-testid*="title"]', 'h1, h2, h3']) || core.compactText(entry.textContent, 500),
          creatorAvatarURL: core.avatarFromVerifiedSource("tiktok", source, global.location.href),
          entryType: "short"
        });
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
