/* Scopes, phase 1 — golden migration: every pre-2026-09-24 group shape becomes
   policy + the expected scope lines; migrating a migrated store changes
   nothing; flattening the lines gives back the flat fields the old sanitizer
   produced (the popup's form model). */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

// Load the whole worker under an inert chrome stub (same as the settings-ops
// and equivalence runners) so sanitizeGroups runs with every helper it needs.
function makeContext() {
  const storage = new Map();
  const inert = () => new Proxy(function () {}, { get: (_t, p) => (p === "addListener" || p === "removeListener" || p === "hasListener") ? () => {} : inert(), apply: () => Promise.resolve(undefined) });
  const chrome = new Proxy({
    storage: {
      local: {
        get: (keys, cb) => { const out = {}; if (keys && typeof keys === "object" && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; if (cb) cb(out); return Promise.resolve(out); },
        set: (obj, cb) => { for (const [k, v] of Object.entries(obj)) storage.set(k, JSON.parse(JSON.stringify(v))); if (cb) cb(); return Promise.resolve(); },
        remove: () => Promise.resolve(), getBytesInUse: () => Promise.resolve(0)
      },
      session: { get: () => Promise.resolve({}), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: { addListener() {}, removeListener() {}, hasListener: () => false }
    },
    runtime: new Proxy({ id: "t", getManifest: () => ({ version: "0" }), getURL: (p) => `chrome-extension://t/${p}`, lastError: null }, { get: (t, p) => (p in t ? t[p] : inert()) })
  }, { get: (t, p) => (p in t ? t[p] : inert()) });
  const ctx = vm.createContext({
    chrome, console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    TextEncoder, TextDecoder, URL, URLSearchParams, crypto: globalThis.crypto, fetch: () => Promise.reject(new Error("offline")),
    WebSocket: class { constructor() { this.readyState = 3; } close() {} send() {} },
    importScripts() {}, location: { href: "chrome-extension://t/background.js" },
    navigator: { userAgent: "Chrome/999", userAgentData: { brands: [{ brand: "Google Chrome", version: "999" }] } },
    structuredClone: (v) => JSON.parse(JSON.stringify(v)),
    atob: (s) => Buffer.from(s, "base64").toString("binary"), btoa: (s) => Buffer.from(s, "binary").toString("base64")
  });
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  return ctx;
}
const context = makeContext();
for (const file of ["platform-profiles.js", "group-scopes.js", "helpers.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"]) {
  const p = path.join(root, file); if (!fs.existsSync(p)) continue;
  vm.runInContext(fs.readFileSync(p, "utf8"), context, { filename: file });
}

let pass = 0; let fail = 0;
const check = (label, ok, detail) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); } };
const sanitize = (groups) => vm.runInContext(`sanitizeGroups(${JSON.stringify(groups)})`, context);
const flat = (group) => vm.runInContext(`CBGroupScopes.flatFromScopes(${JSON.stringify(group)})`, context);
const summary = (group) => group.scopes.map((l) => `${l.surface}:${l.action}${l.tagFilter ? "+tag" : ""}${l.shelf ? ":" + l.shelf : ""}`).join(" ");

const fixtures = {
  site: { groupType: "site", name: "S", enabled: true, sites: ["Example.com", "https://www.youtube.com/shorts/"] },
  allowlist: { groupType: "site", name: "A", enabled: true, sites: ["docs.example.org"], allowlist: true },
  ytAll: { groupType: "youtube", name: "Y", enabled: true, sourceMode: "all", platformVideoMode: "short", blockHomePage: true, surfaceHides: ["shorts-button", "comments"] },
  ytAuthors: { groupType: "youtube", name: "Y2", enabled: true, sourceMode: "include", sources: ["@mrbeast"] },
  ytTags: { groupType: "youtube", name: "Y3", enabled: true, sourceMode: "nobody", platformTagMode: "include", platformTags: [{ name: "Gaming" }], platformTagEffect: "block", platformTagBlockPage: true, platformTagCoverUntilTagged: true },
  ytTagsNoPage: { groupType: "youtube", name: "Y4", enabled: true, sourceMode: "exclude", sources: ["@x"], platformTagMode: "exclude", platformTags: [{ name: "Education" }], platformTagBlockPage: false },
  redditLegacy: { groupType: "reddit", name: "R", enabled: true, redditMode: "include", redditSubreddits: ["r/News"] },
  xLegacy: { groupType: "twitter", name: "X", enabled: true, platformAuthorMode: "exclude", platformAuthors: ["@bbc"], surfaceHides: ["promoted"] },
  discord: { groupType: "discord", name: "D", enabled: true, discordMode: "include", discordTargets: ["123456789012"], blockHomePage: true },
  customSites: { groupType: "custom", name: "C", enabled: true, sites: ["news.ycombinator.com"] },
  customBare: { groupType: "custom", name: "C2", enabled: true },
  legacyAllow: { groupType: "youtube", name: "L", enabled: true, effect: "allow", sourceMode: "all" }
};
const migrated = Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, sanitize([v])[0]]));

const expected = {
  site: "site:block", allowlist: "site:block",
  ytAll: "items:hide pages:block home:block shelf:hide:shorts-button shelf:hide:comments",
  ytAuthors: "items:hide pages:block",
  ytTags: "items:hide+tag pages:block+tag",
  ytTagsNoPage: "items:hide pages:block items:dim+tag",
  redditLegacy: "items:hide pages:block", xLegacy: "items:hide pages:block shelf:hide:promoted",
  discord: "pages:block home:block", customSites: "site:block", customBare: "", legacyAllow: "items:hide pages:block"
};
for (const [k, want] of Object.entries(expected)) check(`${k} → ${want || "(no lines)"}`, summary(migrated[k]) === want, summary(migrated[k]));
check("site entries are normalized inside the line", JSON.stringify(migrated.site.scopes[0].sites) === JSON.stringify(["example.com", "youtube.com/shorts"]), migrated.site.scopes[0].sites);
check("the allowlist flag becomes sitesExcept", migrated.allowlist.scopes[0].sitesExcept === true, migrated.allowlist.scopes[0]);
check("a legacy Reddit list rides as the line's sources", JSON.stringify(migrated.redditLegacy.scopes[0].sources) === JSON.stringify(["news"]) && migrated.redditLegacy.scopes[0].sourceMode === "include", migrated.redditLegacy.scopes[0]);
check("a tagged items line keeps cover-until-tagged, the pages line does not", migrated.ytTags.scopes[0].tagFilter.coverUntilTagged === true && migrated.ytTags.scopes[1].tagFilter.coverUntilTagged === false, migrated.ytTags.scopes);
check("no flat scope field survives on a stored group", Object.values(migrated).every((g) => !("sites" in g) && !("sourceMode" in g) && !("surfaceHides" in g) && !("platformTagMode" in g) && !("discordTargets" in g) && !("blockHomePage" in g)), Object.keys(migrated.ytAll));
check("a legacy allow group is kept disabled", migrated.legacyAllow.enabled === false, migrated.legacyAllow.enabled);
check("group types are preserved", Object.entries(fixtures).every(([k, v]) => migrated[k].groupType === v.groupType), Object.entries(migrated).map(([k, g]) => `${k}:${g.groupType}`));

// Idempotence: sanitizing the canonical shape again is a no-op.
for (const [k, g] of Object.entries(migrated)) {
  const again = sanitize([g])[0];
  check(`idempotent: ${k}`, JSON.stringify(again) === JSON.stringify(g), JSON.stringify(again.scopes));
}
// Round trip: flat(lines) is exactly what the form model expects.
const rt = flat(migrated.ytTagsNoPage);
check("flat view round-trips the source axis and the tag filter", rt.sourceMode === "exclude" && rt.sources[0] === "x" && rt.platformTagMode === "exclude" && rt.platformTagBlockPage === false && rt.platformTagEffect === "dim", rt);
check("flat view of a nobody group reads nobody", flat(migrated.ytTags).sourceMode === "nobody", flat(migrated.ytTags));
// A flat patch over a stored group wins over the lines underneath.
const patched = sanitize([{ ...migrated.ytAuthors, sourceMode: "all" }])[0];
check("a flat patch over a stored group rewrites its lines (untouched fields keep their stored values)", patched.scopes[0].sourceMode === "all" && patched.scopes[0].sources[0] === "mrbeast", patched.scopes);

console.log(`SCOPES MIGRATION TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
