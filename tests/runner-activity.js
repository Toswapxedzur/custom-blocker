// Unit tests for the pure helpers in vault-activity.js (the web-visit dwell
// math, domain extraction, and buffer bounding). The chrome/hub-driven parts of
// cbActivity are exercised by the live E2E on the mini1 rig.
"use strict";

const path = require("path");
const { cbActivityDomainOf, cbActivityMakeVisit, cbActivityBoundBuffer } = require(
  path.join(__dirname, "..", "vault-activity.js")
);

let pass = 0;
let fail = 0;
function check(label, ok, detail) {
  if (ok) { pass += 1; console.log(`PASS ${label}`); }
  else { fail += 1; console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function eq(label, a, b) { check(label, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`); }

// domainOf
eq("domain strips www", cbActivityDomainOf("https://www.youtube.com/watch?v=x"), "youtube.com");
eq("domain keeps subdomain", cbActivityDomainOf("https://m.bilibili.com/x"), "m.bilibili.com");
eq("domain rejects non-http", cbActivityDomainOf("chrome://extensions"), null);
eq("domain rejects garbage", cbActivityDomainOf("not a url"), null);
eq("domain rejects empty", cbActivityDomainOf(""), null);

// makeVisit
const visit = cbActivityMakeVisit(
  { domain: "youtube.com", startMs: 1000, tabId: 5 },
  1000 + 30000,
  { minMs: 2000, makeId: () => "fixed" }
);
eq("visit id", visit.id, "fixed");
eq("visit category", visit.category, "web-visit");
eq("visit seconds", visit.seconds, 30);
eq("visit startedAtMs", visit.startedAtMs, 1000);
eq("visit key/label", [visit.key, visit.label], ["youtube.com", "youtube.com"]);

check("visit below min dwell is dropped",
  cbActivityMakeVisit({ domain: "x.com", startMs: 0 }, 1000, { minMs: 2000 }) === null);
check("visit with no domain is dropped",
  cbActivityMakeVisit({ startMs: 0 }, 999999, { minMs: 2000 }) === null);
check("visit from null session is null", cbActivityMakeVisit(null, 1) === null);

// boundBuffer
eq("buffer under cap unchanged", cbActivityBoundBuffer([1, 2, 3], 5), [1, 2, 3]);
eq("buffer over cap drops oldest", cbActivityBoundBuffer([1, 2, 3, 4, 5], 3), [3, 4, 5]);
eq("buffer non-array coerced", cbActivityBoundBuffer(undefined, 3), []);

console.log(`ACTIVITY TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
if (fail === 0) console.log("__CB_TEST_RESULT__: OK");
process.exit(fail === 0 ? 0 : 1);
