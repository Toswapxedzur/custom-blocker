/* Phase 2 Vault Classifier extension-contract tests (JavaScriptCore). */
load("vault-classifier-contract.js");
load("tests/log.js");

const VC = globalThis.VaultClassifierExtensionContract;
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
