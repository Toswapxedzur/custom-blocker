/* content.js page-verdict seam: only the entry that IS this page may exit it, once per URL. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  let depth = 0; let i = source.indexOf("{", start);
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}

const exits = [];
const context = vm.createContext({
  URLSearchParams,
  location: { href: "https://www.youtube.com/watch?v=abc123", search: "?v=abc123", pathname: "/watch" },
  exitAttempted: true,
  attemptExitPage() { exits.push({ href: context.location.href, exitAttemptedWasReset: context.exitAttempted === false }); }
});
vm.runInContext("let cbTagPageBlockedHref = \"\";\n" + extract("cbTagPageEntryMatchesLocation") + "\n" + extract("cbApplyTagPagePolicy"), context);
const call = (action, entryID) => vm.runInContext(`cbApplyTagPagePolicy(null, ${JSON.stringify(action)}, { entryID: ${JSON.stringify(entryID)} })`, context);
const matches = (entryID, loc) => vm.runInContext(`cbTagPageEntryMatchesLocation(${JSON.stringify(entryID)}, ${JSON.stringify(loc)})`, context);

let pass = 0; let fail = 0;
function check(label, ok) { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label}`); } }

check("matches watch ?v=", matches("youtube:video:abc123", { search: "?v=abc123", pathname: "/watch" }));
check("matches /shorts/<id>", matches("youtube:video:abc123", { search: "", pathname: "/shorts/abc123" }));
check("rejects a different video", !matches("youtube:video:other", { search: "?v=abc123", pathname: "/watch" }));
check("rejects an id that is only a substring", !matches("youtube:video:bc12", { search: "?v=abc123", pathname: "/watch" }));
check("rejects a non-string entry", !matches(null, { search: "?v=abc123", pathname: "/watch" }));

check("allow never exits", call("allow", "youtube:video:abc123") === false && exits.length === 0);
check("dim never exits", call("dim", "youtube:video:abc123") === false && exits.length === 0);
check("a stale entry (previous SPA page) never exits", call("block", "youtube:video:previous") === false && exits.length === 0);
check("block for the page's own entry exits, resetting a prior platform exit guard", call("block", "youtube:video:abc123") === true && exits.length === 1 && exits[0].exitAttemptedWasReset);
check("a second block on the same URL is a no-op", call("block", "youtube:video:abc123") === false && exits.length === 1);
context.location = { href: "https://www.youtube.com/shorts/zzz9", search: "", pathname: "/shorts/zzz9" };
check("after navigating, the new page's own entry may block again", call("block", "youtube:video:zzz9") === true && exits.length === 2);

console.log(`CONTENT PAGE VERDICT TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
