// Twitch live previews deliberately use the channel URL as their entry ID;
// clips and uploaded videos retain their own permalink. All three are scoped
// to the verified channel source in this dedicated collector.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)twitch\.tv$/i.test(location?.hostname || ""); }
  function isPreview(anchor) { return anchor.matches?.('a[data-a-target="preview-card-image-link"], a[data-a-target="preview-card-title-link"]') || /\/(clip|videos)\//i.test(new URL(anchor.href).pathname); }
  function entryType(url) {
    const path = new URL(url).pathname.toLowerCase();
    return path.includes("/clip/") ? "short" : path.startsWith("/videos/") ? "video" : "live";
  }

  core.start({
    platform: "twitch",
    matchesPage,
    scan({ document, collect }) {
      const cards = core.uniqueElements([
        ...core.selectorElements(document, '[data-a-target="preview-card"]'),
        ...core.selectorElements(document, '[data-a-target="preview-card-image-link"]')
      ]).slice(0, 80);
      for (const card of cards) {
        const entry = core.firstAnchor(card, ['a[data-a-target="preview-card-image-link"]', 'a[data-a-target="preview-card-title-link"]', 'a[href*="/clip/"]', 'a[href^="/videos/"]'], isPreview);
        if (!entry) continue;
        const source = core.matchingSourceAnchor("twitch", card, entry.href) || entry;
        collect({
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(card, ['[data-a-target="preview-card-channel-link"]', '[data-a-target="preview-card-channel-name"]']) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['[data-a-target="preview-card-title"]', 'h1, h2, h3']) || core.compactText(entry.textContent, 500),
          creatorAvatarURL: core.avatarFromVerifiedSource("twitch", source, global.location.href),
          entryType: entryType(entry.href)
        });
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
