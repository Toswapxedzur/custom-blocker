// X/Twitter status cards carry the account in their status URL. The dedicated
// collector verifies a matching in-card account anchor before accepting an
// account avatar or display name.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)(x|twitter)\.com$/i.test(location?.hostname || ""); }
  function isStatus(anchor) { return /^\/[^/]+\/status\/[0-9]+/i.test(new URL(anchor.href).pathname); }
  function pageRoute(location) {
    const match = String(location?.pathname || "").match(/^\/([^/]+)\/status\/([0-9]{6,32})\/?$/i);
    return match ? { handle: match[1], statusID: match[2] } : null;
  }

  core.start({
    platform: "twitter",
    matchesPage,
    scan({ document, collect }) {
      const cards = core.uniqueElements([
        ...core.selectorElements(document, 'article[data-testid="tweet"]'),
        ...core.selectorElements(document, '[data-testid="cellInnerDiv"]:has(article[data-testid="tweet"])')
      ]).slice(0, 80);
      for (const card of cards) {
        const entry = core.firstAnchor(card, ['a[href*="/status/"]'], isStatus);
        if (!entry) continue;
        const source = core.matchingSourceAnchor("twitter", card, entry.href) || entry;
        collect({
          sourceKind: "account",
          entryURL: entry.href,
          sourceURL: source.href,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source.textContent, 256),
          title: core.firstText(card, ['[data-testid="tweetText"]', '[lang]']) || core.compactText(entry.getAttribute("aria-label") || entry.textContent, 500),
          creatorAvatarURL: core.avatarFromVerifiedSource("twitter", source, global.location.href),
          entryType: "post"
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = document.querySelector('article[data-testid="tweet"]') || document.querySelector("article") || document.querySelector("main");
      if (!root) return { ready: false, reason: "missing-content-root" };
      const sourceURL = `${new URL(global.location.href).origin}/${route.handle}`;
      const source = core.matchingSourceAnchor("twitter", root, sourceURL);
      const text = core.firstText(root, ['[data-testid="tweetText"]', '[lang]'], 16000);
      const title = core.compactText(text, 500) || core.firstText(root, ['[data-testid="User-Name"]', "h1"]);
      if (!title && !text) return { ready: false, reason: "missing-title" };
      collect({
        entryID: `twitter:status:${route.statusID}`,
        surface: "page",
        sourceKind: "account",
        entryURL: global.location.href,
        sourceURL,
        sourceName: core.firstText(root, ['[data-testid="User-Name"]']) || core.compactText(source?.textContent, 256) || `@${route.handle}`,
        title,
        text,
        suppliedTags: [...root.querySelectorAll?.('a[href*="/hashtag/"]') || []].map((tag) => tag.textContent),
        creatorAvatarURL: core.avatarFromVerifiedSource("twitter", source, global.location.href),
        entryType: "post"
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
