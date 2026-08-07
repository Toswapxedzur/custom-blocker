// X/Twitter status cards carry the account in their status URL. The dedicated
// collector verifies a matching in-card account anchor before accepting an
// account avatar or display name.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)(x|twitter)\.com$/i.test(location?.hostname || ""); }
  function isStatus(anchor) { return /^\/[^/]+\/status\/[0-9]+/i.test(new URL(anchor.href).pathname); }
  function statusRoute(value) {
    let pathname;
    try { pathname = new URL(value, global.location.href).pathname; }
    catch (_) { return null; }
    const match = String(pathname || "").match(/^\/([^/]+)\/status\/([0-9]{6,32})\/?$/i);
    return match ? { handle: match[1], statusID: match[2] } : null;
  }
  function pageRoute(location) { return statusRoute(location?.href || location?.pathname || ""); }
  function profileAnchor(root, handle) {
    const expectedPath = `/${handle}`.toLowerCase();
    return core.firstAnchor(root, [
      '[data-testid="User-Name"] a[href]',
      '[data-testid^="UserAvatar-Container"] a[href]',
      'a[href]'
    ], (anchor) => {
      try {
        const url = new URL(anchor.href, global.location.href);
        return /(^|\.)(x|twitter)\.com$/i.test(url.hostname)
          && url.pathname.replace(/\/+$/, "").toLowerCase() === expectedPath;
      } catch (_) {
        return false;
      }
    });
  }
  function tweetTextElement(root) {
    return core.firstElement(root, ['[data-testid="tweetText"]']);
  }
  function suppliedTags(element) {
    return [...element?.querySelectorAll?.('a[href*="/hashtag/"]') || []].map((tag) => tag.textContent);
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
        const route = statusRoute(entry.href);
        if (!route) continue;
        const sourceURL = `${new URL(entry.href).origin}/${route.handle}`;
        const source = profileAnchor(card, route.handle);
        const textRoot = tweetTextElement(card);
        const text = core.compactText(textRoot?.textContent, 16000);
        collect({
          presentationRoot: card,
          presentationAnchor: source,
          entryID: `twitter:status:${route.statusID}`,
          sourceKind: "account",
          entryURL: entry.href,
          sourceURL,
          sourceName: core.firstText(source, ["[aria-label]"]) || core.compactText(source?.textContent, 256) || `@${route.handle}`,
          title: core.compactText(text, 500) || core.compactText(entry.getAttribute("aria-label") || entry.textContent, 500),
          text,
          suppliedTags: suppliedTags(textRoot),
          sourceIconURL: core.sourceIconFromVerifiedSource("twitter", source, global.location.href),
          entryType: "post"
        });
      }
    },
    scanPage({ document, collect }) {
      const route = pageRoute(global.location);
      if (!route) return { ready: false, reason: "missing-content-id" };
      const root = core.matchingContentRoot("twitter", document, [
        'article[data-testid="tweet"]',
        "article"
      ], global.location.href, global.location.href);
      if (!root) return { ready: false, reason: "missing-content-root" };
      const sourceURL = `${new URL(global.location.href).origin}/${route.handle}`;
      const source = profileAnchor(root, route.handle);
      const textRoot = tweetTextElement(root);
      const text = core.compactText(textRoot?.textContent, 16000);
      const title = core.compactText(text, 500) || core.firstText(root, ['[data-testid="User-Name"]', "h1"]);
      if (!title && !text) return { ready: false, reason: "missing-title" };
      collect({
        presentationRoot: root,
        presentationAnchor: source,
        entryID: `twitter:status:${route.statusID}`,
        surface: "page",
        sourceKind: "account",
        entryURL: global.location.href,
        sourceURL,
        sourceName: core.firstText(root, ['[data-testid="User-Name"]']) || core.compactText(source?.textContent, 256) || `@${route.handle}`,
        title,
        text,
        suppliedTags: suppliedTags(textRoot),
        sourceIconURL: core.sourceIconFromVerifiedSource("twitter", source, global.location.href),
        entryType: "post"
      });
      return { ready: true };
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
