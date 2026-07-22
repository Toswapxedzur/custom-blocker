// Bilibili's public video cards link to a separate numeric space page for the
// uploader. The source is accepted only from that space URL, not a thumbnail
// or an unrelated card image.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)bilibili\.com$/i.test(location?.hostname || ""); }
  function isVideo(anchor) { return /\/video\/BV/i.test(new URL(anchor.href).pathname); }

  core.start({
    platform: "bilibili",
    matchesPage,
    scan({ document, collect }) {
      const cards = core.uniqueElements([
        ...core.selectorElements(document, ".bili-video-card"),
        ...core.selectorElements(document, "article")
      ]).slice(0, 80);
      for (const card of cards) {
        const entry = core.firstAnchor(card, ['a[href*="/video/BV"]'], isVideo);
        if (!entry) continue;
        const source = core.firstAnchor(card, ['a[href*="space.bilibili.com/"]'], (anchor) => Boolean(core.normalizedSourceIdentity("bilibili", anchor.href)));
        if (!source) continue;
        collect({
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['h1, h2, h3', '[title]']) || core.compactText(entry.getAttribute("title") || entry.textContent, 500),
          creatorAvatarURL: core.avatarFromVerifiedSource("bilibili", source, global.location.href),
          entryType: "video"
        });
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
