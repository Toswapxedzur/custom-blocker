/* Phase 2 Vault Classifier extension-contract tests (JavaScriptCore). */
// JavaScriptCore does not ship the browser URL constructor. The platform
// normalizer and public-feed collector both need its small parsing subset.
if (typeof URL === "undefined") {
  globalThis.URL = function TestURL(value, base) {
    let input = String(value || "");
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
      if (!base) throw new TypeError("Invalid URL");
      const baseMatch = String(base).match(/^(https?):\/\/([^/?#]+)(?:\/[^?#]*)?/i);
      if (!baseMatch) throw new TypeError("Invalid URL");
      input = `${baseMatch[1]}://${baseMatch[2]}${input.startsWith("/") ? input : `/${input}`}`;
    }
    const match = input.match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i);
    if (!match) throw new TypeError("Invalid URL");
    const query = new Map();
    for (const pair of (match[4] || "").slice(1).split("&")) {
      if (!pair) continue;
      const parts = pair.split("=");
      query.set(parts[0], parts.slice(1).join("="));
    }
    this.protocol = `${match[1].toLowerCase()}:`;
    this.hostname = match[2].replace(/:\d+$/, "").toLowerCase();
    this.pathname = match[3] || "/";
    this.hash = match[5] || "";
    this.searchParams = {
      get: (key) => query.get(key) ?? null,
      keys: () => query.keys(),
      delete: (key) => query.delete(key)
    };
    Object.defineProperty(this, "search", { get: () => {
      const parts = [];
      query.forEach((item, key) => parts.push(`${key}=${item}`));
      return parts.length ? `?${parts.join("&")}` : "";
    }});
    Object.defineProperty(this, "href", { get: () => `${this.protocol}//${this.hostname}${this.pathname}${this.search}${this.hash}` });
    this.toString = () => this.href;
  };
}

load("vault-classifier-contract.js");
load("platform-profiles.js");
load("vault-classifier-collector-core.js");
load("tests/log.js");

const VC = globalThis.VaultClassifierExtensionContract;
const Collector = globalThis.VaultClassifierCollectorCore;
const log = globalThis.__cbTestLog.makeLogger({ colour: true });

function assert(name, condition, data) {
  if (condition) log.pass(name, data);
  else log.fail(name, data);
}

log.section("Vault Classifier extension contract");

const valid = VC.normalizeEvidence({
  platform: "youtube",
  entryID: "youtube:video:abcdefghijk",
  sourceID: "youtube:channel:UC123",
  surface: "feed",
  evidence: {
    title: "  Clash   Royale deck gameplay  ",
    suppliedTags: ["clash royale", "clash royale", "guide"],
    metadata: { views: 1200, live: false, ignored: { nested: true } }
  },
  policyIDs: ["clash-royale-focus"]
});
assert("normalizes compact bounded entry evidence", valid && valid.evidence.title === "Clash Royale deck gameplay");
assert("deduplicates creator-provided tags", valid && JSON.stringify(valid.evidence.suppliedTags) === JSON.stringify(["clash royale", "guide"]));
assert("drops non-scalar metadata", valid && valid.evidence.metadata.ignored === undefined);
assert("does not coerce object IDs into evidence", VC.normalizeEvidence({
  platform: "youtube",
  entryID: { forged: true },
  surface: "feed",
  evidence: { title: "Visible title" }
}).entryID === null);
const dangerousMetadata = VC.normalizeEvidence({
  platform: "youtube",
  surface: "feed",
  evidence: { title: "Visible title", metadata: JSON.parse('{"__proto__":"bad","constructor":"bad","safe":"kept"}') }
});
assert("drops prototype-sensitive metadata keys", dangerousMetadata && dangerousMetadata.evidence.metadata.safe === "kept" && dangerousMetadata.evidence.metadata.constructor === undefined);
assert("rejects an entry without evidence", VC.normalizeEvidence({ platform: "youtube", surface: "feed", evidence: {} }) === null);
assert("rejects an unsupported surface", VC.normalizeEvidence({ platform: "youtube", surface: "shorts", evidence: { title: "x" } }) === null);

const byteHeavy = VC.normalizeEvidence({
  platform: "youtube",
  surface: "page",
  evidence: { title: "emoji transport", text: "🙂".repeat(8000), summary: "🙂".repeat(8000), suppliedTags: ["tag"] }
});
const fitted = VC.fitEntryForNativeTransport(byteHeavy);
assert("trims byte-heavy evidence to the native frame budget", fitted && VC.nativeBodyByteLength({ entry: fitted }) <= VC.maximumNativeBodyBytes);
assert("retains readable evidence after frame trimming", fitted && Boolean(fitted.evidence.title || fitted.evidence.text || fitted.evidence.summary || fitted.evidence.suppliedTags.length));

assert("parses canonical YouTube watch and Shorts IDs", VC.youtubeVideoIDFromURL("/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/feed") === "dQw4w9WgXcQ" && VC.youtubeVideoIDFromURL("https://m.youtube.com/shorts/dQw4w9WgXcQ") === "dQw4w9WgXcQ");
assert("rejects lookalike YouTube origins", VC.youtubeVideoIDFromURL("https://youtube.com.evil/watch?v=dQw4w9WgXcQ") === null && !VC.isTrustedYouTubeURL("https://youtube.com.evil/watch?v=dQw4w9WgXcQ"));
assert("recognizes only YouTube sender origins", VC.isTrustedYouTubeURL("https://www.youtube.com/watch?v=dQw4w9WgXcQ") && VC.isTrustedYouTubeURL("https://m.youtube.com/feed"));
assert("recognizes only reviewed public-content collector origins", VC.isTrustedCollectionURL("tiktok", "https://www.tiktok.com/@creator/video/123") && VC.isTrustedCollectionURL("discord", "https://discord.com/channels/123456/234567/345678") && !VC.isTrustedCollectionURL("discord", "https://discord.com/channels/@me/234567") && !VC.isTrustedCollectionURL("tiktok", "https://tiktok.com.evil/@creator/video/123"));
assert("accepts only reviewed creator-avatar asset hosts", VC.isTrustedCreatorAvatarURL("youtube", "https://yt3.ggpht.com/channel-avatar=s88") && VC.isTrustedCreatorAvatarURL("twitter", "https://pbs.twimg.com/profile_images/1/avatar.jpg") && !VC.isTrustedCreatorAvatarURL("youtube", "https://images.example/avatar.png") && !VC.isTrustedCreatorAvatarURL("youtube", "http://yt3.ggpht.com/avatar.png"));

const collectorFixtures = [
  ["tiktok", "creator", "https://www.tiktok.com/@creator/video/123", "https://www.tiktok.com/@creator"],
  ["facebook", "creator", "https://www.facebook.com/reel/123", "https://www.facebook.com/creator"],
  ["instagram", "creator", "https://www.instagram.com/p/post-id/", "https://www.instagram.com/creator/"],
  ["twitch", "creator", "https://www.twitch.tv/videos/123", "https://www.twitch.tv/creator"],
  ["reddit", "subreddit", "https://www.reddit.com/r/gaming/comments/123/post/", "https://www.reddit.com/r/gaming/"],
  ["twitter", "account", "https://x.com/creator/status/123", "https://x.com/creator"],
  ["bilibili", "creator", "https://www.bilibili.com/video/BV1abc", "https://space.bilibili.com/123"],
  ["discord", "server", "https://discord.com/channels/123456/234567/345678", null]
];
const collectedEntries = collectorFixtures.map(([platform, sourceKind, entryURL, sourceURL]) => Collector.makeCollectedEntry({
  platform,
  sourceKind,
  entryURL,
  sourceURL,
  ...(platform === "discord" ? { sourceID: "discord:server:123456", sourceName: "Testing server" } : {}),
  title: `Visible ${platform} entry`,
  sourceName: "Visible creator"
}));
const everyCollectorEntryIsBounded = collectedEntries.every(Boolean) && collectedEntries.every((entry, index) => entry.platform === collectorFixtures[index][0] && entry.sourceID.startsWith(`${entry.platform}:${collectorFixtures[index][1]}:`) && entry.evidence.title === `Visible ${entry.platform} entry` && entry.evidence.metadata.sourceKind === collectorFixtures[index][1] && entry.evidence.metadata.canonicalURL);
assert("builds bounded source-attributed entries for every dedicated non-YouTube collector", everyCollectorEntryIsBounded, everyCollectorEntryIsBounded ? null : collectedEntries.map((entry, index) => entry ? [entry.platform, entry.sourceID, entry.evidence.metadata.canonicalURL] : collectorFixtures[index][0]));
const sourceURLsStayAvailable = collectedEntries.every((entry, index) => {
  const [platform, sourceKind, , sourceURL] = collectorFixtures[index];
  return ["creator", "account"].includes(sourceKind) && sourceURL ? entry.evidence.metadata.creatorURL === sourceURL : entry.evidence.metadata.creatorURL === undefined;
});
assert("retains a reviewed creator-page URL only for creator-scoped collection", sourceURLsStayAvailable, sourceURLsStayAvailable ? null : collectedEntries.map((entry) => [entry.platform, entry.evidence.metadata.creatorURL]));
const discordCollectedEntry = collectedEntries.find((entry) => entry?.platform === "discord");
assert("keeps Discord server messages local without avatar or profile-fetch metadata", discordCollectedEntry?.sourceID === "discord:server:123456" && discordCollectedEntry?.evidence.metadata.creatorURL === undefined && discordCollectedEntry?.evidence.metadata.creatorAvatarURL === undefined);
const avatarEntry = Collector.makeCollectedEntry({
  platform: "tiktok",
  sourceKind: "creator",
  entryURL: "https://www.tiktok.com/@creator/video/123",
  sourceURL: "https://www.tiktok.com/@creator",
  creatorAvatarURL: "https://p16-sign-va.tiktokcdn.com/avatar.jpeg",
  title: "Visible creator entry",
  sourceName: "Visible creator"
});
const rejectedAvatarEntry = Collector.makeCollectedEntry({
  platform: "tiktok",
  sourceKind: "creator",
  entryURL: "https://www.tiktok.com/@creator/video/123",
  sourceURL: "https://www.tiktok.com/@creator",
  creatorAvatarURL: "https://images.example/avatar.jpeg",
  title: "Visible creator entry",
  sourceName: "Visible creator"
});
assert("retains only a verified author avatar URL", avatarEntry?.evidence.metadata.creatorAvatarURL === "https://p16-sign-va.tiktokcdn.com/avatar.jpeg" && rejectedAvatarEntry?.evidence.metadata.creatorAvatarURL === undefined);
assert("rejects a collector entry without a reviewed source identity", Collector.makeCollectedEntry({ platform: "kick", sourceKind: "creator", entryURL: "https://kick.com/example", title: "Unknown card" }) === null);
const enrichedPageEntry = Collector.makeCollectedEntry({
  platform: "tiktok",
  entryID: "tiktok:video:123",
  surface: "page",
  sourceKind: "creator",
  entryURL: "https://www.tiktok.com/@creator/video/123",
  sourceURL: "https://www.tiktok.com/@creator",
  sourceName: "Visible creator",
  title: "Visible page title",
  text: "Visible rendered description",
  summary: "Visible rendered summary",
  suppliedTags: ["gaming", "gaming", "guide"],
  metadata: { published: "today", ignored: { nested: true } }
});
assert("gives every dedicated collector YouTube-style bounded page evidence", enrichedPageEntry?.entryID === "tiktok:video:123" && enrichedPageEntry?.surface === "page" && enrichedPageEntry?.evidence.text === "Visible rendered description" && enrichedPageEntry?.evidence.summary === "Visible rendered summary" && JSON.stringify(enrichedPageEntry?.evidence.suppliedTags) === JSON.stringify(["gaming", "guide"]) && enrichedPageEntry?.evidence.metadata.published === "today" && enrichedPageEntry?.evidence.metadata.ignored === undefined);

const fingerprintOne = VC.entryFingerprint(VC.normalizeEvidence({
  platform: "youtube", surface: "page", evidence: { title: "A title", text: "A description", metadata: { b: "2", a: "1" } }, policyIDs: ["focus"]
}));
const fingerprintTwo = VC.entryFingerprint(VC.normalizeEvidence({
  platform: "youtube", surface: "page", evidence: { title: "A title", text: "A description", metadata: { a: "1", b: "2" } }, policyIDs: ["focus"]
}));
const fingerprintChanged = VC.entryFingerprint(VC.normalizeEvidence({
  platform: "youtube", surface: "page", evidence: { title: "A title", text: "An enriched description", metadata: { a: "1", b: "2" } }, policyIDs: ["focus"]
}));
assert("keeps evidence fingerprints stable across metadata ordering", fingerprintOne && fingerprintOne === fingerprintTwo);
assert("changes evidence fingerprints when page enrichment changes", fingerprintOne && fingerprintOne !== fingerprintChanged);

const result = {
  selectedLeafTagIDs: ["content.entities.clash-royale"],
  decisions: [
    { action: "dim", explanation: "Matched Clash Royale focus; dim this feed card." },
    { action: "block", explanation: "Hard block enabled." }
  ]
};
assert("uses the strongest local action", VC.strongestAction(result) === "block");
assert("preserves local explanation", VC.explanation(result) === "Matched Clash Royale focus; dim this feed card.");
assert("recognizes only structured classifier results", VC.isResult(result) && !VC.isResult({ selectedLeafTagIDs: [] }));
assert("rejects malformed classifier actions", !VC.isResult({ selectedLeafTagIDs: [], decisions: [{ action: "erase", explanation: "bad" }] }));
const sourceTags = VC.normalizeSourceTagsResponse({
  platformID: "youtube",
  sourceID: "youtube:channel:UC123",
  tags: [
    { id: "games", name: "Games", lightColorHex: "#9ec5e8", darkColorHex: "#1a4775" },
    { id: "technology", name: "Technology", lightColorHex: "#e3b4e7", darkColorHex: "#6B246F" }
  ]
}, "youtube", "youtube:channel:UC123");
assert("accepts bounded paired-color source-tag projections", sourceTags
  && sourceTags.tags.map((tag) => tag.name).join(",") === "Games,Technology"
  && sourceTags.tags.map((tag) => tag.lightColorHex).join(",") === "#9EC5E8,#E3B4E7"
  && sourceTags.tags.map((tag) => tag.darkColorHex).join(",") === "#1A4775,#6B246F");
assert("rejects source-tag responses for a different source", VC.normalizeSourceTagsResponse({
  platformID: "youtube",
  sourceID: "youtube:channel:forged",
  tags: [{ id: "games", name: "Games", lightColorHex: "#9EC5E8", darkColorHex: "#1A4775" }]
}, "youtube", "youtube:channel:UC123") === null);
assert("rejects duplicate or unbounded source tags", VC.normalizeSourceTagsResponse({
  platformID: "youtube",
  sourceID: "youtube:channel:UC123",
  tags: [
    { id: "games", name: "Games", lightColorHex: "#9EC5E8", darkColorHex: "#1A4775" },
    { id: "games", name: "Duplicate", lightColorHex: "#E3B4E7", darkColorHex: "#6B246F" }
  ]
}, "youtube", "youtube:channel:UC123") === null);
assert("rejects source tags without both assigned theme colors", VC.normalizeSourceTagsResponse({
  platformID: "youtube",
  sourceID: "youtube:channel:UC123",
  tags: [{ id: "games", name: "Games", lightColorHex: "#9EC5E8" }]
}, "youtube", "youtube:channel:UC123") === null);

const failures = log.counts().fail;
print("__CB_TEST_RESULT__: " + (failures === 0 ? "OK" : "FAIL") + " (" + failures + " failures)");
if (failures !== 0) throw new Error("Vault Classifier extension contract tests failed");
