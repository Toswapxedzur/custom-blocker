/* content.js page DECISION: the extension's own content-tag filters decide whether
   the page's own entry is blacked out (the classifier only tags). Covers
   cbTagPageVerdict / cbEvaluateTagPage / cbReapplyTagFilters against real filter
   entries, with the executor (cbApplyTagPagePolicy) stubbed to record calls. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  let depth = 0; let i = source.indexOf("{", start);
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}

const applied = [];
let rescans = 0;
const tagsByRoot = new Map();
const context = vm.createContext({
  cbApplyTagPagePolicy(root, action, meta) { applied.push({ root, action, entryID: meta && meta.entryID }); return action === "block"; },
  scheduleApplyFeedFilters() { rescans += 1; },
  reconcilePageMutations() {},
  vaultTagsForCard: (root) => tagsByRoot.get(root) || []
});
context.window = context;
vm.runInContext([
  "let latestFeedFilters = [];", "let cbTagPageContext = null;",
  extractFunction("getFeedCardTags"), extractFunction("matchesTagFilter"), extractFunction("matchesFeedFilter"),
  extractFunction("cbTagPageVerdict"), extractFunction("cbEvaluateTagPage"),
  extractFunction("cbReapplyTagFilters"), extractFunction("updateFeedFilters")
].join("\n"), context);

const root = { id: "watch-root" };
context.__root = root;
const setFilters = (filters) => { context.__filters = filters; vm.runInContext("updateFeedFilters(__filters)", context); };
const evaluate = (meta) => { context.__meta = meta; return vm.runInContext("cbEvaluateTagPage(__root, __meta)", context); };
const last = () => applied[applied.length - 1];
const tagFilter = (over = {}) => ({
  id: "g1␟tag", baseGroupId: "g1", site: "youtube",
  tagFilter: { mode: "include", tags: [{ name: "Gaming" }], defaultConfidence: 4, blockUntagged: false },
  effectVerdict: "dim", pageEffect: "block", enforce: true, ...over
});
const META = { entryID: "youtube:video:abc123", platform: "youtube", settled: true };

let pass = 0; let fail = 0;
function check(label, ok) { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label}`); } }

setFilters([tagFilter()]);
tagsByRoot.set(root, [{ id: "t1", name: "Gaming", confidence: 5 }]);
check("include filter + a listed confident tag → block", evaluate(META) === "block" && last().action === "block" && last().entryID === META.entryID);

tagsByRoot.set(root, [{ id: "t1", name: "Gaming", confidence: 3 }]);
check("a listed tag BELOW the confidence floor → allow", evaluate(META) === "allow" && last().action === "allow");

tagsByRoot.set(root, [{ id: "t1", name: "Gaming", confidence: 3 }]);
setFilters([tagFilter({ tagFilter: { mode: "include", tags: [{ name: "Gaming", confidence: 3 }], defaultConfidence: 4, blockUntagged: false } })]);
check("a per-tag confidence override is honoured (and a filter update re-decides the page)", last().action === "block");

tagsByRoot.set(root, [{ id: "t1", name: "Gaming", confidence: 5 }]);
setFilters([tagFilter({ pageEffect: "allow" })]);
check("pageEffect allow (page blocking turned off) → never blocks the page", last().action === "allow");

setFilters([tagFilter({ enforce: false })]);
check("a count-down group still within its allowance does not block the page", last().action === "allow");

setFilters([tagFilter()]);
check("provisional (still Tagging…) never blocks, whatever the tags", evaluate({ ...META, settled: false }) === "allow" && last().action === "allow");

setFilters([tagFilter({ tagFilter: { mode: "exclude", tags: [{ name: "Education" }], defaultConfidence: 4, blockUntagged: false } })]);
tagsByRoot.set(root, [{ id: "t1", name: "Gaming", confidence: 5 }]);
check("exclude (allow-list): a confident tag NOT on the list → block", evaluate(META) === "block");
tagsByRoot.set(root, [{ id: "t2", name: "Education", confidence: 5 }]);
check("exclude (allow-list): a listed tag → allow", evaluate(META) === "allow");
tagsByRoot.set(root, []);
check("exclude: untagged passes unless blockUntagged", evaluate(META) === "allow");
setFilters([tagFilter({ tagFilter: { mode: "exclude", tags: [{ name: "Education" }], defaultConfidence: 4, blockUntagged: true } })]);
check("exclude + blockUntagged: a settled untagged page → block", last().action === "block");
check("exclude + blockUntagged: but NOT while provisional", evaluate({ ...META, settled: false }) === "allow");

// A correction flips it live: the tag pipeline updates its tags, then re-applies.
setFilters([tagFilter()]);
tagsByRoot.set(root, [{ id: "t1", name: "Gaming", confidence: 5 }]);
evaluate(META);
const blockedBefore = last().action === "block";
tagsByRoot.set(root, [{ id: "t3", name: "Music", confidence: 5 }]);
const rescansBefore = rescans;
vm.runInContext("cbReapplyTagFilters()", context);
check("correcting the tag away lifts the page block on re-apply (and rescans the feed)", blockedBefore && last().action === "allow" && rescans === rescansBefore + 1);

// ── List semantics: AND ("A + B"), carve-outs ("!C"), untagged in include mode.
const decide = (tf, tags) => { context.__tf = tf; context.__tags = tags; return vm.runInContext("matchesTagFilter(__tf, __tags)", context); };
const T = (name, confidence = 5) => ({ id: name, name, confidence });
const inc = (tags, extra = {}) => ({ mode: "include", tags, defaultConfidence: 4, blockUntagged: false, ...extra });
const exc = (tags, extra = {}) => ({ mode: "exclude", tags, defaultConfidence: 4, blockUntagged: false, ...extra });
check("AND: both tags present → block", decide(inc([{ name: "Gaming", also: ["Drama"] }]), [T("Gaming"), T("Drama")]) === true);
check("AND: only one of the two → no block", decide(inc([{ name: "Gaming", also: ["Drama"] }]), [T("Gaming")]) === false);
check("AND: the second tag below the floor → no block", decide(inc([{ name: "Gaming", also: ["Drama"] }]), [T("Gaming"), T("Drama", 3)]) === false);
check("carve-out: block Gaming except when Tutorial", decide(inc([{ name: "Gaming" }, { name: "Tutorial", except: true }]), [T("Gaming"), T("Tutorial")]) === false
  && decide(inc([{ name: "Gaming" }, { name: "Tutorial", except: true }]), [T("Gaming")]) === true);
check("carve-out in an allow-list: allowed Education, but not when also Drama", decide(exc([{ name: "Education" }, { name: "Drama", except: true }]), [T("Education")]) === false
  && decide(exc([{ name: "Education" }, { name: "Drama", except: true }]), [T("Education"), T("Drama")]) === true);
check("include + blockUntagged: untagged content is blocked, tagged-but-unlisted is not", decide(inc([{ name: "Gaming" }], { blockUntagged: true }), []) === true
  && decide(inc([{ name: "Gaming" }], { blockUntagged: true }), [T("Music")]) === false
  && decide(inc([{ name: "Gaming" }]), []) === false);
check("a per-tag lower threshold still decides before the untagged rule (allow-list rescue at @3)", decide(exc([{ name: "Education", confidence: 3 }], { blockUntagged: true }), [T("Education", 3)]) === false
  && decide(inc([{ name: "Gaming", confidence: 3 }]), [T("Gaming", 3)]) === true);
check("mode all / malformed filter never blocks", decide({ mode: "all", tags: [{ name: "Gaming" }] }, [T("Gaming")]) === false && decide(null, [T("Gaming")]) === false);

// Author-only filters (no tagFilter) never decide the page.
setFilters([{ id: "g2", site: "youtube", authorMode: "include", authors: ["x"], enforce: true }]);
tagsByRoot.set(root, [{ id: "t1", name: "Gaming", confidence: 5 }]);
check("a non-tag filter never blocks the page", evaluate(META) === "allow");

// Forgetting the page lifts whatever it owned and stops re-evaluation.
setFilters([tagFilter()]);
evaluate(META);
const n = applied.length;
evaluate(null);
const lifted = applied.length === n + 1 && last().action === "allow";
setFilters([tagFilter()]);
check("meta null forgets the page: one lifting allow, then filter updates no longer touch it", lifted && applied.length === n + 1);

console.log(`CONTENT TAG PAGE FILTER TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
