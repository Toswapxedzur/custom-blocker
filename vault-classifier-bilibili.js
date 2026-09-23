// Bilibili's public video cards link to a separate numeric space page for the
// uploader. The source is accepted only from that space URL, not a thumbnail
// or an unrelated card image.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)bilibili\.com$/i.test(location?.hostname || ""); }
  function isVideo(anchor) { return /\/video\/BV/i.test(new URL(anchor.href).pathname); }
  function videoIDFromHref(href) {
    try {
      const match = new URL(href, global.location.href).pathname.match(/\/video\/(BV[0-9A-Za-z_-]{3,128})/i);
      return match ? match[1] : null;
    } catch (_) {
      return null;
    }
  }
  function pageRoute(location) {
    const match = String(location?.pathname || "").match(/^\/video\/(BV[0-9A-Za-z_-]{3,128})\/?$/i);
    return match ? { videoID: match[1] } : null;
  }
  // Topics come only from the page's dedicated tag container (never from a
  // recommendation card). Bilibili has rendered them as /v/topic/ links and,
  // currently, as search-link chips (.tag-link) — accept both shapes.
  function topicTags(root) {
    const container = core.firstElement(root, [
      "#v_tag",
      ".video-tag-container",
      ".tag-panel",
      ".video-tag"
    ]);
    if (!container?.querySelectorAll) return [];
    const links = [...container.querySelectorAll('a[href*="/v/topic/"]'), ...container.querySelectorAll("a.tag-link")];
    return links.map((tag) => tag.textContent);
  }

  core.start({
    platform: "bilibili",
    matchesPage,
    scan({ document, collect, observe }) {
      const cards = core.uniqueElements([
        ...core.selectorElements(document, ".bili-video-card"),
        // The video page's "up next" / recommendation sidebar (verified live 2026-09-10).
        ...core.selectorElements(document, ".video-page-card-small"),
        ...core.selectorElements(document, "article")
      ]).slice(0, 80);
      for (const card of cards) {
        const entry = core.firstAnchor(card, ['a[href*="/video/BV"]'], isVideo);
        if (!entry) continue;
        const source = core.firstAnchor(card, ['a[href*="space.bilibili.com/"]'], (anchor) => Boolean(core.normalizedSourceIdentity("bilibili", anchor.href)));
        const videoID = videoIDFromHref(entry.href);
        if (!source) {
          // No uploader link (some search-result and ranking cards render the
          // uploader as plain text; verified live 2026-09-23: 5 of 50 search
          // cards). Still tag the title, keyed per video, like a creator-less
          // YouTube Short — nothing is collected without a verifiable source.
          if (videoID && typeof observe === "function") {
            observe({
              presentationRoot: card,
              entryID: `bilibili:video:${videoID}`,
              title: core.firstText(card, ['h1, h2, h3', '.title', '[title]']) || core.compactText(entry.getAttribute("title") || entry.textContent, 500)
            });
          }
          continue;
        }
        collect({
          presentationRoot: card,
          presentationAnchor: source,
          // Same id as the video page's own entry, so one classification serves
          // the feed card, the page pill, and the page verdict.
          ...(videoID ? { entryID: `bilibili:video:${videoID}` } : {}),
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['h1, h2, h3', '.title', '[title]']) || core.compactText(entry.getAttribute("title") || entry.textContent, 500),
          text: core.firstText(card, ['[class*="desc"]', '[class*="description"]'], 16000),
          sourceIconURL: core.sourceIconFromVerifiedSource("bilibili", source, global.location.href),
          entryType: "video"
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = document.querySelector("#viewbox_report") || document.querySelector(".video-info-container") || document.querySelector("main");
      if (!root) return { ready: false, reason: "missing-content-root" };
      // The uploader block only (verified live 2026-09-10: .up-info-container /
      // .up-name); recommendation cards also link to space pages and must never
      // be taken as this video's source.
      const source = core.firstVerifiedSourceAnchor("bilibili", document, [
        '.up-info-container .up-name[href*="space.bilibili.com/"]',
        '.up-info-container .up-detail-top a[href*="space.bilibili.com/"]',
        '.up-info-container a[href*="space.bilibili.com/"]',
        '#v_upinfo a[href*="space.bilibili.com/"]',
        '.upinfo-container a[href*="space.bilibili.com/"]'
      ], global.location.href);
      if (!source) return { ready: false, reason: "missing-source" };
      const descriptionRoot = core.firstElement(document, ["#v_desc", ".desc-info-text", '[data-testid="video-desc"]']);
      const description = core.compactText(descriptionRoot?.textContent, 16000);
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
        suppliedTags: topicTags(document),
        sourceIconURL: core.sourceIconFromVerifiedSource("bilibili", source, global.location.href),
        entryType: "video"
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
