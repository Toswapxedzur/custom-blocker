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
  function pageRoute(location) {
    const path = String(location?.pathname || "");
    const video = path.match(/^\/videos\/([0-9]{6,32})\/?$/i);
    if (video) return { id: video[1], type: "video", handle: null };
    const clip = path.match(/^\/([^/]+)\/clip\/([A-Za-z0-9_-]{3,128})\/?$/i);
    if (clip) return { id: clip[2], type: "short", handle: clip[1] };
    const channel = path.match(/^\/([A-Za-z0-9_]{3,64})\/?$/i);
    const reserved = new Set(["directory", "downloads", "jobs", "login", "search", "settings", "store", "wallet"]);
    return channel && !reserved.has(channel[1].toLowerCase()) ? { id: channel[1].toLowerCase(), type: "live", handle: channel[1] } : null;
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
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = document.querySelector("main") || document.querySelector('[data-a-target="channel-root"]');
      if (!root) return { ready: false, reason: "missing-content-root" };
      const directSourceURL = route.handle ? `https://www.twitch.tv/${route.handle}` : null;
      const source = directSourceURL
        ? core.matchingSourceAnchor("twitch", root, directSourceURL)
        : core.firstVerifiedSourceAnchor("twitch", root, [
          '[data-a-target="channel-header-container"] a[href]',
          '[data-a-target*="channel"] a[href]',
          'a[data-a-target="preview-card-channel-link"]'
        ], global.location.href);
      const sourceURL = source?.href || directSourceURL;
      if (!sourceURL) return { ready: false, reason: "missing-source" };
      const description = core.firstText(root, [
        '[data-a-target="about-panel-description"]', '[data-a-target="channel-description"]', '[data-a-target="stream-title"]'
      ], 16000);
      const title = core.firstText(root, ['[data-a-target="stream-title"]', 'h1', 'h2']) || core.compactText(description, 500);
      if (!title && !description) return { ready: false, reason: "missing-title" };
      collect({
        entryID: `twitch:${route.type === "live" ? "channel" : route.type}:${route.id}`,
        surface: "page",
        sourceKind: "creator",
        entryURL: global.location.href,
        sourceURL,
        sourceName: core.firstText(root, ['[data-a-target="channel-header-container"] h1', '[data-a-target="channel-header-container"] h2']) || core.compactText(source?.textContent, 256) || route.handle,
        title,
        text: description,
        creatorAvatarURL: core.avatarFromVerifiedSource("twitch", source, global.location.href),
        entryType: route.type
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
