/* The group's "when blocked" field (owner 2026-09-24): a URL redirects the blocked tab;
   any other text is shown on
   Vault's message page; blank means the plain block. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
const start = source.indexOf("function cbBlockTarget(");
let depth = 0; let end = source.indexOf("{", start);
for (; end < source.length; end += 1) {
  if (source[end] === "{") depth += 1;
  else if (source[end] === "}") { depth -= 1; if (depth === 0) break; }
}
const context = vm.createContext({ chrome: { runtime: { getURL: (p) => "chrome-extension://abc/" + p } } });
vm.runInContext(source.slice(start, end + 1), context);
const target = (v) => vm.runInContext(`cbBlockTarget(${JSON.stringify(v)})`, context);

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
console.log(`BLOCK TARGET TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
