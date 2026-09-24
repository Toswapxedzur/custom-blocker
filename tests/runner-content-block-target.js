/* The group's "when blocked" field (owner 2026-09-24): a URL redirects the blocked tab;
   any other text is shown on
   Vault's message page; blank means the plain block. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function extract(file, name) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name} in ${file}`);
  let depth = 0; let end = source.indexOf("{", start);
  for (; end < source.length; end += 1) {
    if (source[end] === "{") depth += 1;
    else if (source[end] === "}") { depth -= 1; if (depth === 0) break; }
  }
  return source.slice(start, end + 1);
}
const context = vm.createContext({ chrome: { runtime: { getURL: (p) => "chrome-extension://abc/" + p } } });
// The content script resolves page-level blocks; the worker resolves the
// whole-site redirect fast path. Both must read the field the same way.
vm.runInContext(extract("content.js", "cbBlockTarget") + "\n" + extract("background.js", "cbWorkerBlockTarget"), context);
const target = (v) => vm.runInContext(`cbBlockTarget(${JSON.stringify(v)})`, context);
const workerTarget = (v) => vm.runInContext(`cbWorkerBlockTarget(${JSON.stringify(v)})`, context);

let pass = 0; let fail = 0;
const check = (label, ok, got) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — got ${JSON.stringify(got)}`); } };
const cases = [
  ["blank is the plain block", "", ""],
  ["whitespace is the plain block", "   ", ""],
  ["an https address is used as is", "https://example.com/focus?x=1", "https://example.com/focus?x=1"],
  ["an http address is used as is", "http://localhost:8080/", "http://localhost:8080/"],
  ["about: pages are addresses", "about:blank", "about:blank"],
  ["an extension page (e.g. a rule's message url) is an address", "chrome-extension://abc/message-page.html?msg=Go", "chrome-extension://abc/message-page.html?msg=Go"],
  ["a bare host gets https", "example.com", "https://example.com"],
  ["a host with a path and port gets https", "focus.example.org:3000/today", "https://focus.example.org:3000/today"],
  ["a sentence is shown on the message page", "Go and work. You said you would.", "chrome-extension://abc/message-page.html?msg=Go%20and%20work.%20You%20said%20you%20would."],
  ["a single word is a message, not a host", "Focus", "chrome-extension://abc/message-page.html?msg=Focus"],
  ["a host-looking text with a space is a message", "example.com is closed now", "chrome-extension://abc/message-page.html?msg=example.com%20is%20closed%20now"],
  ["unicode text is a message", "去工作吧", "chrome-extension://abc/message-page.html?msg=" + encodeURIComponent("去工作吧")]
];
for (const [label, input, expected] of cases) { const got = target(input); check(label, got === expected, got); }
for (const [label, input, expected] of cases) { const got = workerTarget(input); check(`worker fast path: ${label}`, got === expected, got); }
console.log(`BLOCK TARGET TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
