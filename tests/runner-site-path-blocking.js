/* Site entries may carry a path prefix (owner 2026-09-24): "youtube.com/shorts"
   blocks only that path and everything under it, while "youtube.com" keeps
   blocking the host and its subdomains. The worker and the popup must
   normalize entries identically. */
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
const worker = vm.createContext({ URL });
vm.runInContext(["normalizeSiteInput", "hostnameMatchesSite", "siteEntryParts", "siteEntryMatches", "siteLineBlocks"].map((n) => extract("background.js", n)).join("\n"), worker);
const popup = vm.createContext({ URL });
vm.runInContext(extract("popup.js", "normalizeSiteInput"), popup);

let pass = 0; let fail = 0;
const check = (label, ok, got) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — got ${JSON.stringify(got)}`); } };
const norm = (v) => vm.runInContext(`normalizeSiteInput(${JSON.stringify(v)})`, worker);
const matches = (h, p, e) => vm.runInContext(`siteEntryMatches(${JSON.stringify(h)}, ${JSON.stringify(p)}, ${JSON.stringify(e)})`, worker);
const blocks = (line, h, p) => vm.runInContext(`siteLineBlocks(${JSON.stringify(line)}, ${JSON.stringify(h)}, ${JSON.stringify(p)})`, worker);

const normCases = [
  ["a bare host stays a host", "YouTube.com", "youtube.com"],
  ["www. and scheme are dropped", "https://www.youtube.com/", "youtube.com"],
  ["a path prefix is kept, trailing slash dropped", "https://www.youtube.com/shorts/", "youtube.com/shorts"],
  ["query and hash are dropped", "reddit.com/r/all?sort=new#top", "reddit.com/r/all"],
  ["a deep path is kept as typed (lowercased)", "x.com/Explore/Tabs", "x.com/explore/tabs"],
  ["garbage is rejected", "not a site at all", null]
];
for (const [label, input, expected] of normCases) {
  const got = norm(input); check(label, got === expected, got);
  const popupGot = vm.runInContext(`normalizeSiteInput(${JSON.stringify(input)})`, popup);
  check(`popup agrees: ${label}`, popupGot === expected, popupGot);
}

check("a host entry covers the host", matches("youtube.com", "/watch", "youtube.com"));
check("a host entry covers subdomains", matches("m.youtube.com", "/", "youtube.com"));
check("a host entry never matches a longer unrelated host", !matches("notyoutube.com", "/", "youtube.com"));
check("a path entry matches the path itself", matches("youtube.com", "/shorts", "youtube.com/shorts"));
check("a path entry matches children of the path", matches("www.youtube.com", "/shorts/abc123", "youtube.com/shorts"));
check("a path entry respects the segment boundary", !matches("youtube.com", "/shortsfeed", "youtube.com/shorts"));
check("a path entry leaves the rest of the host alone", !matches("youtube.com", "/watch?v=1", "youtube.com/shorts"));
check("a path entry with a trailing slash in the URL still matches", matches("reddit.com", "/r/all/", "reddit.com/r/all"));
check("path matching is case-insensitive", matches("reddit.com", "/R/All", "reddit.com/r/all"));

const blocklist = { surface: "site", sitesExcept: false, sites: ["youtube.com/shorts", "reddit.com/r/all"] };
check("blocklist: the scoped path is blocked", blocks(blocklist, "youtube.com", "/shorts/xyz"));
check("blocklist: the rest of the host is not", !blocks(blocklist, "youtube.com", "/watch"));
const allowlist = { surface: "site", sitesExcept: true, sites: ["example.com/docs"] };
check("allowlist: only the scoped path is allowed", !blocks(allowlist, "example.com", "/docs/intro"));
check("allowlist: the rest of the host is blocked", blocks(allowlist, "example.com", "/pricing"));
check("allowlist: other hosts are blocked", blocks(allowlist, "other.com", "/"));

console.log(`SITE PATH TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
