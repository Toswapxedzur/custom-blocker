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
  function pageRoute(location) {
    const path = String(location?.pathname || "");
    const match = path.match(/\/(?:reel|watch|videos|posts|permalink|share\/r|share\/v)\/([A-Za-z0-9_-]{3,128})/i);
    return match ? { contentID: match[1], type: entryType(location.href) } : null;
  }
  function postBodyElement(root) {
    return core.firstElement(root, [
      '[data-ad-preview="message"]',
      '[data-ad-comet-preview="message"]',
      '[data-testid="post_message"]'
    ]);
  }
  function suppliedTags(element) {
    return [...element?.querySelectorAll?.('a[href*="/hashtag/"]') || []].map((tag) => tag.textContent);
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
        const source = core.firstVerifiedSourceAnchor("facebook", card, [
          'h2 a[href]',
          'strong a[href]',
          '[role="heading"] a[href]'
        ], entry.href);
        if (!source) continue;
        const bodyRoot = postBodyElement(card);
        const body = core.compactText(bodyRoot?.textContent, 16000);
        collect({
          presentationRoot: card,
          presentationAnchor: source,
          sourceKind: "creator",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.compactText(body, 500) || core.firstText(card, ['h1, h2, h3']) || core.compactText(entry.textContent, 500),
          text: body,
          suppliedTags: suppliedTags(bodyRoot),
          sourceIconURL: core.sourceIconFromVerifiedSource("facebook", source, global.location.href),
          entryType: entryType(entry.href)
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = core.matchingContentRoot("facebook", document, [
        '[role="dialog"] [role="article"]',
        '[role="main"] [role="article"]',
        '[role="article"]'
      ], global.location.href, global.location.href);
      if (!root) return { ready: false, reason: "missing-content-root" };
      const source = core.firstVerifiedSourceAnchor("facebook", root, [
        'h2 a[href]', 'strong a[href]', '[role="heading"] a[href]', 'a[role="link"][href]'
      ], global.location.href);
      if (!source) return { ready: false, reason: "missing-source" };
      const bodyRoot = postBodyElement(root);
      const body = core.compactText(bodyRoot?.textContent, 16000);
      const title = core.compactText(body, 500) || core.firstText(root, ["h1", "h2", "h3"]);
      if (!title && !body) return { ready: false, reason: "missing-title" };
      collect({
        presentationRoot: root,
        presentationAnchor: source,
        entryID: `facebook:${route.type}:${route.contentID}`,
        surface: "page",
        sourceKind: "creator",
        entryURL: global.location.href,
        sourceURL: source.href,
        sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
        title,
        text: body,
        suppliedTags: suppliedTags(bodyRoot),
        sourceIconURL: core.sourceIconFromVerifiedSource("facebook", source, global.location.href),
        entryType: route.type
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
