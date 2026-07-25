// Bilibili's public video cards link to a separate numeric space page for the
// uploader. The source is accepted only from that space URL, not a thumbnail
// or an unrelated card image.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)bilibili\.com$/i.test(location?.hostname || ""); }
  function isVideo(anchor) { return /\/video\/BV/i.test(new URL(anchor.href).pathname); }
  function pageRoute(location) {
    const match = String(location?.pathname || "").match(/^\/video\/(BV[0-9A-Za-z_-]{3,128})\/?$/i);
    return match ? { videoID: match[1] } : null;
  }

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
          presentationRoot: card,
          presentationAnchor: source,
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['h1, h2, h3', '[title]']) || core.compactText(entry.getAttribute("title") || entry.textContent, 500),
          creatorAvatarURL: core.avatarFromVerifiedSource("bilibili", source, global.location.href),
          entryType: "video"
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = document.querySelector("#viewbox_report") || document.querySelector(".video-info-container") || document.querySelector("main");
      if (!root) return { ready: false, reason: "missing-content-root" };
      const source = core.firstVerifiedSourceAnchor("bilibili", document, [
        '#v_upinfo a[href*="space.bilibili.com/"]', '.upinfo-container a[href*="space.bilibili.com/"]', 'a[href*="space.bilibili.com/"]'
      ], global.location.href);
      if (!source) return { ready: false, reason: "missing-source" };
      const description = core.firstText(document, ["#v_desc", ".desc-info-text", '[data-testid="video-desc"]'], 16000);
      const title = core.firstText(root, ["h1", '[title]']) || core.compactText(description, 500);
      if (!title && !description) return { ready: false, reason: "missing-title" };
      collect({
        presentationRoot: root,
        presentationAnchor: source,
        entryID: `bilibili:video:${route.videoID}`,
        surface: "page",
        sourceKind: "creator",
        entryURL: global.location.href,
        sourceURL: source.href,
        sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
        title,
        text: description,
        suppliedTags: [...document.querySelectorAll?.('a[href*="/v/topic/"]') || []].map((tag) => tag.textContent),
        creatorAvatarURL: core.avatarFromVerifiedSource("bilibili", source, global.location.href),
        entryType: "video"
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
