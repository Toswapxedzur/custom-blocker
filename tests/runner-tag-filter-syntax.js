/* Content-tag filter SYNTAX: the popup's line parser/formatter, the service
   worker's normalizer — which
   must make exactly the same decision as content.js matchesTagFilter. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  // Brace matching that skips string literals and comments (the rule generator
  // builds source text, so its strings hold unbalanced braces).
  // Begin at the BODY brace: a destructured parameter list has braces of its own.
  let depth = 0; let i = source.indexOf(") {", start) + 2;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i += 1; i < source.length && source[i] !== ch; i += 1) if (source[i] === "\\") i += 1;
    } else if (ch === "/" && source[i + 1] === "/") {
      i = source.indexOf("\n", i);
    } else if (ch === "/" && source[i + 1] === "*") {
      i = source.indexOf("*/", i) + 1;
    } else if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const popup = read("popup.js"); const background = read("background.js"); const content = read("content.js");

const context = vm.createContext({});
vm.runInContext([
  'const CONTENT_TAG_PLATFORMS = new Set(["youtube"]);',
  extractFunction(popup, "parseTagListTextarea"), extractFunction(popup, "tagListToText"),
  extractFunction(background, "normalizeTagList"), extractFunction(content, "matchesTagFilter")
].join("\n"), context);
const call = (expr, vars) => { Object.assign(context, vars); return vm.runInContext(expr, context); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let pass = 0; let fail = 0;
function check(label, ok, detail) { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label}${detail ? " — " + JSON.stringify(detail) : ""}`); } }

const TEXT = "Gaming\nDrama @3\nGaming + Drama\n!Tutorial\n!News & Politics + Live >=2\nScience & Education";
const parsed = call("parseTagListTextarea(__t)", { __t: TEXT });
check("parses plain, @N, AND, carve-out, and keeps '&' inside a tag name", same(parsed, [
  { name: "Gaming" }, { name: "Drama", confidence: 3 }, { name: "Gaming", also: ["Drama"] },
  { name: "Tutorial", except: true }, { name: "News & Politics", confidence: 2, also: ["Live"], except: true },
  { name: "Science & Education" }
]), parsed);
const text = call("tagListToText(__l)", { __l: parsed });
check("formatter round-trips through the parser", same(call("parseTagListTextarea(__t)", { __t: text }), parsed), text);
check("duplicates collapse regardless of AND order or case", same(call("parseTagListTextarea(__t)", { __t: "A + B\nb + a\nA\na" }), [{ name: "A", also: ["B"] }, { name: "A" }]));
check("a bare '+' or '!' line is ignored", same(call("parseTagListTextarea(__t)", { __t: "!\n +  \n@3\nOK" }), [{ name: "OK" }]));

const normalized = call("normalizeTagList(__l)", { __l: parsed });
check("the service-worker normalizer preserves also/except/confidence", same(normalized, parsed), normalized);
check("the normalizer still accepts legacy string + {name} entries", same(call("normalizeTagList(__l)", { __l: ["Gaming", { name: " Drama ", confidence: 9 }, { name: "" }, 7] }), [{ name: "Gaming" }, { name: "Drama" }]));
check("the normalizer drops junk in also[] and caps it", same(call("normalizeTagList(__l)", { __l: [{ name: "A", also: ["A", "", 3, "B", "b", "C", "D", "E", "F", "G"] }] }), [{ name: "A", also: ["B", "C", "D", "E", "F"] }]));


console.log(`TAG FILTER SYNTAX TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
