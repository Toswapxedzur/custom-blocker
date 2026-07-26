// TikTok's video cards use data-e2e wrappers and encode the creator in the
// video URL. Keep that extraction local to TikTok rather than sharing it with
// a different platform's DOM.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)tiktok\.com$/i.test(location?.hostname || ""); }
  function isVideo(anchor) { return /\/@[^/]+\/video\//i.test(new URL(anchor.href).pathname); }
  function pageRoute(location) {
    const match = String(location?.pathname || "").match(/^\/@([^/]+)\/video\/([0-9]{6,32})\/?$/i);
    return match ? { handle: match[1], videoID: match[2] } : null;
  }

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
          presentationRoot: card,
          presentationAnchor: source,
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['[data-e2e*="title"]', '[data-testid*="title"]', 'h1, h2, h3']) || core.compactText(entry.textContent, 500),
          text: core.firstText(card, ['[data-e2e*="desc"]', '[data-testid*="desc"]'], 16000),
          suppliedTags: [...card.querySelectorAll?.('a[href*="/tag/"]') || []].map((tag) => tag.textContent),
          sourceIconURL: core.sourceIconFromVerifiedSource("tiktok", source, global.location.href),
          entryType: "short"
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = core.matchingContentRoot("tiktok", document, [
        '[data-e2e*="video-detail"]',
        '[data-e2e*="feed-item"]',
        "main"
      ], global.location.href, global.location.href)
        || document.querySelector('[data-e2e="browse-video-desc"]')?.closest?.("main");
      if (!root) return { ready: false, reason: "missing-content-root" };
      const sourceURL = `https://www.tiktok.com/@${route.handle}`;
      const source = core.matchingSourceAnchor("tiktok", root, sourceURL);
      const description = core.firstText(root, ['[data-e2e="browse-video-desc"]', '[data-e2e*="video-desc"]', 'h1'], 16000);
      const title = core.compactText(description, 500) || core.firstText(root, ["h1", "h2"]);
      if (!title && !description) return { ready: false, reason: "missing-title" };
      collect({
        presentationRoot: root,
        presentationAnchor: source,
        entryID: `tiktok:video:${route.videoID}`,
        surface: "page",
        sourceKind: "creator",
        entryURL: global.location.href,
        sourceURL,
        sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source?.textContent, 256) || `@${route.handle}`,
        title,
        text: description,
        suppliedTags: [...root.querySelectorAll?.('a[href*="/tag/"]') || []].map((tag) => tag.textContent),
        sourceIconURL: core.sourceIconFromVerifiedSource("tiktok", source, global.location.href),
        entryType: "short"
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
