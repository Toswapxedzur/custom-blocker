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
load("vault-classifier-collector.js");
load("tests/log.js");

const VC = globalThis.VaultClassifierExtensionContract;
const Collector = globalThis.VaultClassifierCollector;
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

const envelope = {
  protocolVersion: 1,
  kind: "classification-response",
  requestID: "native-request-1",
  timestampMilliseconds: Date.now(),
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAA",
  bodyBase64: "e30=",
  bodyHash: "0".repeat(64),
  mac: "A".repeat(44)
};
assert("accepts a bounded authenticated native envelope shape", VC.isNativeEnvelope(envelope, { authenticated: true }));
assert("rejects a native envelope with an unsafe timestamp", !VC.isNativeEnvelope({ ...envelope, timestampMilliseconds: NaN }, { authenticated: true }));
assert("rejects a native envelope with a malformed MAC", !VC.isNativeEnvelope({ ...envelope, mac: "not-base64" }, { authenticated: true }));

assert("parses canonical YouTube watch and Shorts IDs", VC.youtubeVideoIDFromURL("/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/feed") === "dQw4w9WgXcQ" && VC.youtubeVideoIDFromURL("https://m.youtube.com/shorts/dQw4w9WgXcQ") === "dQw4w9WgXcQ");
assert("rejects lookalike YouTube origins", VC.youtubeVideoIDFromURL("https://youtube.com.evil/watch?v=dQw4w9WgXcQ") === null && !VC.isTrustedYouTubeURL("https://youtube.com.evil/watch?v=dQw4w9WgXcQ"));
assert("recognizes only YouTube sender origins", VC.isTrustedYouTubeURL("https://www.youtube.com/watch?v=dQw4w9WgXcQ") && VC.isTrustedYouTubeURL("https://m.youtube.com/feed"));
assert("recognizes only reviewed public-content collector origins", VC.isTrustedCollectionURL("tiktok", "https://www.tiktok.com/@creator/video/123") && VC.isTrustedCollectionURL("peertube", "https://peertube.tv/w/video-id") && !VC.isTrustedCollectionURL("discord", "https://discord.com/channels/1/2") && !VC.isTrustedCollectionURL("tiktok", "https://tiktok.com.evil/@creator/video/123"));

const collectorFixtures = [
  ["tiktok", "https://www.tiktok.com/@creator/video/123", "https://www.tiktok.com/@creator"],
  ["facebook", "https://www.facebook.com/reel/123", "https://www.facebook.com/creator"],
  ["instagram", "https://www.instagram.com/p/post-id/", "https://www.instagram.com/creator/"],
  ["twitch", "https://www.twitch.tv/videos/123", "https://www.twitch.tv/creator"],
  ["reddit", "https://www.reddit.com/r/gaming/comments/123/post/", "https://www.reddit.com/r/gaming/"],
  ["twitter", "https://x.com/creator/status/123", null],
  ["bluesky", "https://bsky.app/profile/creator.bsky.social/post/abc", null],
  ["threads", "https://www.threads.com/@creator/post/abc", null],
  ["substack", "https://creator.substack.com/p/post", "https://creator.substack.com/"],
  ["bilibili", "https://www.bilibili.com/video/BV1abc", "https://space.bilibili.com/123"],
  ["rumble", "https://rumble.com/vabc.html", "https://rumble.com/c/creator"],
  ["pinterest", "https://www.pinterest.com/pin/123/", "https://www.pinterest.com/creator/"],
  ["tumblr", "https://creator.tumblr.com/post/123/post", "https://creator.tumblr.com/"],
  ["peertube", "https://peertube.tv/w/video-id", "https://peertube.tv/a/creator"],
  ["pixelfed", "https://pixelfed.social/p/123", "https://pixelfed.social/creator"]
];
const collectedEntries = collectorFixtures.map(([platform, entryURL, sourceURL]) => Collector.makeCollectedEntry({
  platform,
  entryURL,
  sourceURL,
  title: `Visible ${platform} entry`,
  sourceName: "Visible creator"
}));
const everyCollectorEntryIsBounded = Collector.platformIDs.length === 15 && collectedEntries.every(Boolean) && collectedEntries.every((entry, index) => entry.platform === collectorFixtures[index][0] && entry.sourceID.startsWith(`${entry.platform}:creator:`) && entry.evidence.title === `Visible ${entry.platform} entry` && entry.evidence.metadata.sourceName === "Visible creator" && entry.evidence.metadata.canonicalURL);
assert("builds bounded creator-attributed titles and names for every reviewed non-YouTube collector", everyCollectorEntryIsBounded, everyCollectorEntryIsBounded ? null : collectedEntries.map((entry, index) => entry ? [entry.platform, entry.sourceID, entry.evidence.metadata.canonicalURL] : collectorFixtures[index][0]));
const sourceURLsStayAvailable = collectedEntries.every((entry, index) => {
  const sourceURL = collectorFixtures[index][2];
  return sourceURL ? entry.evidence.metadata.creatorURL === sourceURL : entry.evidence.metadata.creatorURL === undefined;
});
assert("retains a reviewed creator-page URL when the platform exposes one", sourceURLsStayAvailable, sourceURLsStayAvailable ? null : collectedEntries.map((entry) => [entry.platform, entry.evidence.metadata.creatorURL]));
assert("rejects a collector entry without a reviewed creator identity", Collector.makeCollectedEntry({ platform: "kick", entryURL: "https://kick.com/example", title: "Unknown card" }) === null);

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

const failures = log.counts().fail;
print("__CB_TEST_RESULT__: " + (failures === 0 ? "OK" : "FAIL") + " (" + failures + " failures)");
if (failures !== 0) throw new Error("Vault Classifier extension contract tests failed");
