/* content.js "rule-apply": what the custom rules ask of a page — item verdicts,
   style sheets, the cover, and v.query answers (read-only, bounded). */
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

let pass = 0; let fail = 0;
const check = (name, ok, data) => { if (ok) { pass += 1; console.log("PASS " + name); } else { fail += 1; console.log("FAIL " + name, data ?? ""); } };

const el = (tag, text, attrs = {}, props = {}) => ({
  tagName: tag.toUpperCase(), textContent: text, getAttribute: (name) => attrs[name] ?? null, ...props
});
const nodes = {
  "#desc": [el("div", "  A long\n description  ", { "aria-label": "Description" })],
  "a.more": Array.from({ length: 60 }, (_, i) => el("a", "link " + i, {}, { href: "https://example.com/" + i }))
};
const sent = []; const verdicts = []; const covers = [];
const context = vm.createContext({
  document: {
    querySelectorAll(selector) {
      if (selector === "((") throw new SyntaxError("bad selector");
      return nodes[selector] || [];
    }
  },
  safeSendMessage: (message) => sent.push(message),
  cbRuleRefs: new Map([["i1", { card: 1 }]]),
  cbRuleStyles: new Map(),
  cbSetCardVerdict: (card, groupId, verdict, source) => verdicts.push({ card, groupId, verdict, source }),
  cbApplyCard() {},
  cbRuleDomOp() {},
  cbSetRuleCover: (cover) => covers.push(cover)
});
vm.runInContext([extractFunction("cbRuleQuery"), extractFunction("cbApplyRuleMessage")].join("\n"), context);
context.__msg = {
  type: "rule-apply",
  items: [{ groupId: "g", ref: "i1", verdict: "dim" }, { groupId: "g", ref: "gone", verdict: "hide" }],
  css: [], dom: [],
  cover: { groupId: "g", on: true, message: "no" },
  queries: [
    { groupId: "g", requestId: "g:1", selector: "#desc" },
    { groupId: "g", requestId: "g:2", selector: "a.more" },
    { groupId: "g", requestId: "g:3", selector: "((" }
  ]
};
vm.runInContext("cbApplyRuleMessage(__msg)", context);

check("an item verdict reaches its card, as a custom verdict", verdicts.length === 1 && verdicts[0].verdict === "dim" && verdicts[0].source === "custom", verdicts);
check("the cover is the rule's", covers.length === 1 && covers[0].message === "no");
check("each query is answered once, to its group", sent.length === 3 && sent.every((m) => m.type === "rule-query" && m.groupId === "g"), sent);
const [desc, more, bad] = sent;
check("an answer carries the element's text (collapsed) and label", desc.matches[0].text === "A long description" && desc.matches[0].label === "Description" && desc.matches[0].tag === "div", desc);
check("links come with their address; at most 50 matches", more.matches.length === 50 && more.matches[0].href === "https://example.com/0", more.matches.length);
check("an invalid selector answers with an error, no matches", bad.error === "invalid-selector" && bad.matches.length === 0, bad);

console.log(`CONTENT RULE APPLY TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
