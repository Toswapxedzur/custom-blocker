// X/Twitter status cards carry the account in their status URL. The dedicated
// collector verifies a matching in-card account anchor before accepting an
// account avatar or display name.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function matchesPage(location) { return /(^|\.)(x|twitter)\.com$/i.test(location?.hostname || ""); }
  function isStatus(anchor) { return /^\/[^/]+\/status\/[0-9]+/i.test(new URL(anchor.href).pathname); }

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
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
