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
assert("rejects an entry without evidence", VC.normalizeEvidence({ platform: "youtube", surface: "feed", evidence: {} }) === null);
assert("rejects an unsupported surface", VC.normalizeEvidence({ platform: "youtube", surface: "shorts", evidence: { title: "x" } }) === null);

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

const failures = log.counts().fail;
print("__CB_TEST_RESULT__: " + (failures === 0 ? "OK" : "FAIL") + " (" + failures + " failures)");
if (failures !== 0) throw new Error("Vault Classifier extension contract tests failed");
