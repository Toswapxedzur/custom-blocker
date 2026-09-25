/* Scopes, phase 1: the worker now stores groups as policy + scope lines and
   matches from the lines. This harness loads the PRE-change worker (pinned
   commit) and the current one side by side, feeds both the same flat groups,
   page contexts and usage states, and requires identical page sessions, feed
   filters, surface hides and blocked-site lists. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const PRE_SCOPES_COMMIT = "0edec81";

function gitShow(file) {
  return execFileSync("git", ["show", `${PRE_SCOPES_COMMIT}:${file}`], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function makeContext() {
  const storage = new Map();
  const inert = () => new Proxy(function () {}, { get: (_t, p) => (p === "addListener" || p === "removeListener" || p === "hasListener") ? () => {} : inert(), apply: () => Promise.resolve(undefined) });
  const chrome = new Proxy({
    storage: {
      local: {
        get: (keys, cb) => { const out = {}; if (keys && typeof keys === "object" && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; const r = Promise.resolve(out); if (cb) cb(out); return r; },
        set: (obj, cb) => { for (const [k, v] of Object.entries(obj)) storage.set(k, JSON.parse(JSON.stringify(v))); if (cb) cb(); return Promise.resolve(); },
        remove: () => Promise.resolve(), getBytesInUse: () => Promise.resolve(0)
      },
      session: { get: () => Promise.resolve({}), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: { addListener() {}, removeListener() {}, hasListener: () => false }
    },
    runtime: new Proxy({ id: "t", getManifest: () => ({ version: "0" }), getURL: (p) => `chrome-extension://t/${p}`, lastError: null }, { get: (t, p) => (p in t ? t[p] : inert()) })
  }, { get: (t, p) => (p in t ? t[p] : inert()) });
  const context = vm.createContext({
    chrome, console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    TextEncoder, TextDecoder, URL, URLSearchParams, crypto: globalThis.crypto, fetch: () => Promise.reject(new Error("offline")),
    WebSocket: class { constructor() { this.readyState = 3; } close() {} send() {} },
    importScripts() {}, location: { href: "chrome-extension://t/background.js" },
    navigator: { userAgent: "Chrome/999", userAgentData: { brands: [{ brand: "Google Chrome", version: "999" }] } },
    structuredClone: (v) => JSON.parse(JSON.stringify(v)),
    atob: (s) => Buffer.from(s, "base64").toString("binary"), btoa: (s) => Buffer.from(s, "binary").toString("base64")
  });
  context.self = context; context.globalThis = context; context.window = context;
  return context;
}

const files = ["platform-profiles.js", "group-scopes.js", "helpers.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"];
const oldCtx = makeContext();
for (const file of files) {
  if (file === "group-scopes.js") continue; // did not exist before
  let source; try { source = gitShow(file); } catch (_) { continue; }
  try { vm.runInContext(source, oldCtx, { filename: "old/" + file }); } catch (e) { console.error("old load", file, e.message); }
}
const newCtx = makeContext();
for (const file of files) {
  const p = path.join(root, file); if (!fs.existsSync(p)) continue;
  try { vm.runInContext(fs.readFileSync(p, "utf8"), newCtx, { filename: file }); } catch (e) { console.error("new load", file, e.message); }
}

// ── Fixtures: one flat group of every shape that existed before lines ──────
const base = (over) => ({ enabled: true, mode: "instant", allowedMinutes: 15, activeDays: ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"], timeWindowsText: "", ...over });
const groups = [
  base({ id: "site1", groupType: "site", name: "Sites", sites: ["example.com", "youtube.com/shorts"] }),
  base({ id: "site2", groupType: "site", name: "Allow only", sites: ["docs.example.org"], allowlist: true, mode: "after-minutes", allowedMinutes: 10, fallbackUrl: "Go work" }),
  base({ id: "yt1", groupType: "youtube", name: "YT all", sourceMode: "all", platformVideoMode: "short", blockHomePage: true, surfaceHides: ["shorts-button", "comments"] }),
  base({ id: "yt2", groupType: "youtube", name: "YT authors", sourceMode: "include", sources: ["@mrbeast"], platformVideoMode: "all", mode: "after-minutes", allowedMinutes: 30 }),
  base({ id: "yt3", groupType: "youtube", name: "YT tags", sourceMode: "nobody", platformTagMode: "include", platformTags: [{ name: "Gaming" }, { name: "Drama", confidence: 3 }], platformTagDefaultConfidence: 4, platformTagEffect: "block", platformTagBlockPage: true, platformTagCoverUntilTagged: true }),
  base({ id: "yt4", groupType: "youtube", name: "YT tags no page", sourceMode: "exclude", sources: ["@someone"], platformTagMode: "exclude", platformTags: [{ name: "Education" }], platformTagBlockPage: false, platformTagBlockUntagged: true }),
  base({ id: "yt5", groupType: "youtube", name: "YT inert tags", sourceMode: "nobody", platformTagMode: "include", platformTags: [{ name: "Tutorial", except: true }] }),
  base({ id: "rd1", groupType: "reddit", name: "Reddit include", sourceMode: "include", sources: ["news"], platformTagMode: "include", platformTags: [{ name: "Politics" }] }),
  base({ id: "rd2", groupType: "reddit", name: "Reddit all", sourceMode: "all", blockHomePage: true }),
  base({ id: "rd3", groupType: "reddit", name: "Reddit legacy", redditMode: "exclude", redditSubreddits: ["r/programming"] }),
  base({ id: "x1", groupType: "twitter", name: "X accounts", sourceMode: "exclude", sources: ["@elonmusk"], blockHomePage: true, surfaceHides: ["promoted"] }),
  base({ id: "x2", groupType: "twitter", name: "X legacy", platformAuthorMode: "include", platformAuthors: ["@bbc"] }),
  base({ id: "bl1", groupType: "bilibili", name: "Bili all", sourceMode: "all", platformTagMode: "include", platformTags: [{ name: "Gaming" }], platformTagEffect: "dim" }),
  base({ id: "tk1", groupType: "tiktok", name: "TikTok creators", sourceMode: "include", sources: ["@someone"], platformVideoMode: "all" }),
  base({ id: "dc1", groupType: "discord", name: "Discord", discordMode: "include", discordTargets: ["123456789012"], blockHomePage: true }),
  base({ id: "cu1", groupType: "custom", name: "Custom with sites", sites: ["news.ycombinator.com"], blockingRulesText: "(m,d,n,h,mi,u,helpers) => false" }),
  base({ id: "cu2", groupType: "custom", name: "Custom bare", blockingRulesText: "(m,d,n,h,mi,u,helpers) => false" }),
  base({ id: "off1", groupType: "youtube", name: "Disabled", enabled: false, sourceMode: "all" }),
  base({ id: "al1", groupType: "youtube", name: "Legacy allow", effect: "allow", sourceMode: "include", sources: ["@x"] }),
  base({ id: "tm1", groupType: "bilibili", name: "Count-up", mode: "timer", sourceMode: "all", platformTagMode: "include", platformTags: [{ name: "Gaming" }] }),
  base({ id: "sch1", groupType: "youtube", name: "Weekend only", activeDays: ["saturday", "sunday"], sourceMode: "all" }),
  base({ id: "site3", groupType: "site", name: "Timer site", mode: "timer", sites: ["news.ycombinator.com"] })
];

const pages = [
  ["https://www.youtube.com/", "/"], ["https://www.youtube.com/watch?v=abc", "/watch"], ["https://www.youtube.com/shorts/abc", "/shorts/abc"],
  ["https://www.youtube.com/@mrbeast", "/@mrbeast"], ["https://www.youtube.com/@someone/videos", "/@someone/videos"], ["https://www.youtube.com/feed/subscriptions", "/feed/subscriptions"],
  ["https://www.reddit.com/", "/"], ["https://www.reddit.com/r/news/", "/r/news/"], ["https://www.reddit.com/r/programming/comments/1/x/", "/r/programming/comments/1/x/"], ["https://www.reddit.com/r/popular/", "/r/popular/"],
  ["https://x.com/home", "/home"], ["https://x.com/elonmusk", "/elonmusk"], ["https://x.com/bbc/status/1", "/bbc/status/1"],
  ["https://www.bilibili.com/", "/"], ["https://www.bilibili.com/video/BV1", "/video/BV1"],
  ["https://www.tiktok.com/foryou", "/foryou"], ["https://www.tiktok.com/@someone/video/1", "/@someone/video/1"],
  ["https://discord.com/channels/@me", "/channels/@me"], ["https://discord.com/channels/111/123456789012", "/channels/111/123456789012"],
  ["https://example.com/", "/"], ["https://sub.example.com/page", "/page"], ["https://docs.example.org/a", "/a"], ["https://other.org/", "/"], ["https://news.ycombinator.com/", "/"]
];
function pageContextFor(ctx, url, pathname) {
  const u = new URL(url);
  return vm.runInContext(`normalizePageContext(${JSON.stringify({ url, hostname: u.hostname, pathname })})`, ctx);
}
const usageStates = [
  { label: "fresh", timers: {}, snoozes: {} },
  { label: "spent", timers: { site2: 60 * 60 * 1000, yt2: 60 * 60 * 1000 }, snoozes: {} },
  { label: "snoozed", timers: {}, snoozes: { yt1: { startsAtMs: 0, untilMs: Date.UTC(2026, 8, 24, 13, 0, 0) }, site1: { startsAtMs: 0, untilMs: Date.UTC(2026, 8, 24, 13, 0, 0) } } }
];
const now = Date.UTC(2026, 8, 24, 12, 0, 0); // a Thursday

let pass = 0; let fail = 0;
const check = (label, ok, detail) => { if (ok) pass += 1; else { fail += 1; console.log(`FAIL ${label}\n  ${detail}`); } };
// Feed-filter ids are per line since phase 2 (`<group>␟<line>`); the old worker
// used `<group>` / `<group>␟tag`. Compare the group part plus the entry kind.
const strip = (v) => JSON.stringify(v, function (k, val) {
  if (k === "id" && typeof val === "string" && val.includes("␟")) return val.split("␟")[0] + (this && this.tagFilter ? "␟tag" : "");
  if (k === "baseGroupId" && this && !this.tagFilter) return undefined;
  return val;
});

const oldGroups = vm.runInContext(`sanitizeGroups(${JSON.stringify(groups)})`, oldCtx);
const newGroups = vm.runInContext(`sanitizeGroups(${JSON.stringify(groups)})`, newCtx);
check("both workers keep every group", oldGroups.length === newGroups.length, `${oldGroups.length} vs ${newGroups.length}`);
check("the new worker stores scope lines and no flat scope fields", newGroups.every((g) => Array.isArray(g.scopes) && !("sites" in g) && !("sourceMode" in g) && !("platformTagMode" in g)), JSON.stringify(Object.keys(newGroups[0])));
check("group types are preserved", strip(oldGroups.map((g) => g.groupType)) === strip(newGroups.map((g) => g.groupType)), strip(newGroups.map((g) => g.groupType)));

oldCtx.__groups = oldGroups; newCtx.__groups = newGroups;
let compared = 0;
for (const state of usageStates) {
  oldCtx.__timers = state.timers; newCtx.__timers = state.timers; oldCtx.__snoozes = state.snoozes; newCtx.__snoozes = state.snoozes;
  const oldHosts = vm.runInContext(`getBlockingHostnames(__groups, __timers, __snoozes, ${now})`, oldCtx);
  const newHosts = vm.runInContext(`getBlockingHostnames(__groups, __timers, __snoozes, ${now})`, newCtx);
  check(`blocked-site entries (${state.label})`, strip(oldHosts) === strip(newHosts), `${strip(oldHosts)} vs ${strip(newHosts)}`);
  // Since 2026-09-25 a text message covers the page in place instead of
  // sending the tab to the message page: the old worker's message-page
  // targets compare as "no navigation".
  const oldTargets = vm.runInContext(`[...getBlockingTargets(__groups, __timers, __snoozes, ${now}).entries()]`, oldCtx)
    .map(([entry, target]) => [entry, /message-page\.html/.test(String(target)) ? "" : target]);
  const newTargets = vm.runInContext(`[...getBlockingTargets(__groups, __timers, __snoozes, ${now}).entries()]`, newCtx);
  check(`redirect targets (${state.label})`, strip(oldTargets) === strip(newTargets), `${strip(oldTargets)} vs ${strip(newTargets)}`);
  for (const [url, pathname] of pages) {
    oldCtx.__pc = pageContextFor(oldCtx, url, pathname); newCtx.__pc = pageContextFor(newCtx, url, pathname);
    for (const exposed of [[], ["yt2", "rd1"]]) {
      oldCtx.__exposed = exposed; newCtx.__exposed = exposed;
      const expr = `(() => { const s = buildPageSession(__pc, __groups, __timers, {}, __snoozes, ${now}, __exposed); return { shouldExitPage: s.shouldExitPage, showTimer: s.showTimer, items: s.items.map((i) => ({ id: i.id, blocksNow: i.blocksNow })), feedFilters: s.feedFilters, surfaceHides: s.surfaceHides, feedOrder: s.feedOrder }; })()`;
      const oldS = vm.runInContext(expr, oldCtx); const newS = vm.runInContext(expr, newCtx);
      compared += 1;
      check(`page session ${url} (${state.label}, exposed ${exposed.length})`, strip(oldS) === strip(newS), `old ${strip(oldS)}\n  new ${strip(newS)}`);
    }
  }
}
console.log(`SCOPES EQUIVALENCE compared ${compared} sessions; TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
