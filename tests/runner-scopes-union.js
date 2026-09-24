/* Scopes, phase 2 — one group, several platforms (the union). A single group
   with YouTube, Reddit, X and a site list must act on every one of them from
   its ONE policy: feed filters per platform on that platform only, page
   matches on each, site entries in the blocked-site cache, shelf hides per
   host, one usage timer, and a flat (MCP / legacy) patch that replaces only
   the patched platform's lines. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

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
const run = (expr) => vm.runInContext(expr, context);
const sanitize = (groups) => run(`sanitizeGroups(${JSON.stringify(groups)})`);
const S = run("CBGroupScopes");
const now = Date.UTC(2026, 8, 24, 12, 0, 0);
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

// Build the union group the way the editor does: one platform view at a time,
// merged over the group's other lines.
let scopes = S.scopeLinesFromFlat({ sourceMode: "all", platformVideoMode: "short", blockHomePage: true, surfaceHides: ["shorts-button"] }, "youtube");
scopes = S.mergeFlatIntoScopes(scopes, { sourceMode: "include", sources: ["news"] }, "reddit");
scopes = S.mergeFlatIntoScopes(scopes, { sourceMode: "nobody", platformTagMode: "include", platformTags: [{ name: "Politics" }], platformTagEffect: "dim", platformTagBlockPage: true, surfaceHides: ["promoted"] }, "twitter");
scopes = S.mergeFlatIntoScopes(scopes, { sites: ["example.com", "news.ycombinator.com/best"] }, "site");
const raw = { id: "u1", name: "Union", groupType: "youtube", enabled: true, mode: "after-minutes", allowedMinutes: 20, activeDays: days, timeWindowsText: "", scopes };
const [group] = sanitize([raw]);
context.__groups = [group];

check("the sanitizer keeps every platform's lines", S.groupPlatforms(group).join(",") === "youtube,reddit,twitter,site", S.groupPlatforms(group));
check("the group type stays the platform the editor opened it on", group.groupType === "youtube", group.groupType);
check("line ids are unique within the group", new Set(group.scopes.map((l) => l.id)).size === group.scopes.length, group.scopes.map((l) => l.id));
check("re-sanitizing is byte-identical", JSON.stringify(sanitize([group])[0]) === JSON.stringify(group));

const pc = (url, pathname) => { const u = new URL(url); return run(`normalizePageContext(${JSON.stringify({ url, hostname: u.hostname, pathname })})`); };
const feed = (url, pathname, timers = {}) => { context.__pc = pc(url, pathname); context.__t = timers; return run(`buildPlatformFeedFilters(__pc, __groups, __t, {}, ${now})`); };
const session = (url, pathname, timers = {}) => { context.__pc = pc(url, pathname); context.__t = timers; return run(`buildPageSession(__pc, __groups, __t, {}, {}, ${now}, [])`); };

// YouTube: the Shorts source line only, keyed to the group.
const yt = feed("https://www.youtube.com/", "/");
check("YouTube gets the group's YouTube items line only", yt.length === 1 && yt[0].site === "youtube" && yt[0].videoMode === "short" && yt[0].authorMode === "all", yt);
check("feed-filter ids carry the group id as their base", yt[0].id.startsWith("u1␟") && yt[0].baseGroupId === "u1", yt[0]);
check("a count-down group within its allowance measures but does not enforce", yt[0].enforce === false, yt[0]);
check("…and enforces once the allowance is spent", feed("https://www.youtube.com/", "/", { u1: 30 * 60 * 1000 })[0].enforce === true);
// Reddit: the subreddit include line.
const rd = feed("https://www.reddit.com/", "/");
check("Reddit gets the subreddit line only", rd.length === 1 && rd[0].site === "reddit" && rd[0].authorMode === "include" && rd[0].authors.join() === "news", rd);
// X: the tag line only (source axis is "nobody" there).
const x = feed("https://x.com/home", "/home");
check("X gets the tag line only, with its page effect", x.length === 1 && x[0].site === "twitter" && x[0].tagFilter && x[0].tagFilter.tags[0].name === "Politics" && x[0].effectVerdict === "dim" && x[0].pageEffect === "block", x);
check("a platform the group does not name gets nothing", feed("https://www.bilibili.com/", "/").length === 0);

// Page matches per platform.
const shorts = session("https://www.youtube.com/shorts/abc", "/shorts/abc", { u1: 30 * 60 * 1000 });
check("a YouTube Shorts page is blocked by the YouTube pages line", shorts.shouldExitPage === true, shorts);
check("the YouTube home page is blocked by the home line", session("https://www.youtube.com/", "/", { u1: 30 * 60 * 1000 }).shouldExitPage === true);
check("r/news is blocked by the Reddit pages line", session("https://www.reddit.com/r/news/", "/r/news/", { u1: 30 * 60 * 1000 }).shouldExitPage === true);
check("r/programming is not (include list)", session("https://www.reddit.com/r/programming/", "/r/programming/", { u1: 30 * 60 * 1000 }).shouldExitPage === false);
check("an X profile is not page-blocked (only tagged pages, decided by the content script)", session("https://x.com/bbc", "/bbc", { u1: 30 * 60 * 1000 }).shouldExitPage === false);
check("a listed site is blocked by the site line", session("https://example.com/", "/", { u1: 30 * 60 * 1000 }).shouldExitPage === true);
check("a path entry blocks only its path", session("https://news.ycombinator.com/best", "/best", { u1: 30 * 60 * 1000 }).shouldExitPage === true && session("https://news.ycombinator.com/", "/", { u1: 30 * 60 * 1000 }).shouldExitPage === false);
check("one timer item for the whole group on every platform", [shorts, session("https://www.reddit.com/r/news/", "/r/news/"), session("https://example.com/", "/")].every((s) => s.items.length === 1 && s.items[0].id === "u1"));

// Site cache + surface hides.
context.__t = { u1: 30 * 60 * 1000 };
const hosts = run(`getBlockingHostnames(__groups, __t, {}, ${now})`);
check("the site line feeds the blocked-site cache once the allowance is spent", hosts.includes("example.com") && hosts.some((h) => h.startsWith("news.ycombinator.com")), hosts);
check("…and not before", run(`getBlockingHostnames(__groups, {}, {}, ${now})`).length === 0);
context.__pc = pc("https://www.youtube.com/", "/");
const ytHides = run(`buildSurfaceHideSelectors(__pc, __groups, {}, ${now})`);
context.__pc = pc("https://x.com/home", "/home");
const xHides = run(`buildSurfaceHideSelectors(__pc, __groups, {}, ${now})`);
check("shelf hides apply per host", ytHides.length > 0 && xHides.length > 0 && ytHides.join() !== xHides.join(), { ytHides, xHides });

// Flat patch (MCP / legacy): replaces the group's OWN platform lines only.
const [patched] = sanitize([{ ...group, sourceMode: "include", sources: ["@mrbeast"], platformVideoMode: "all" }]);
check("a flat patch rewrites the group type's lines and keeps the other platforms", S.groupPlatforms(patched).join(",") === "reddit,twitter,site,youtube" && S.flatFromScopes(patched, "youtube").sources.join() === "mrbeast" && S.flatFromScopes(patched, "reddit").sources.join() === "news" && S.flatFromScopes(patched, "site").sites.length === 2, patched.scopes);
// Removing a platform: its lines go, the type follows the remaining lines.
const without = sanitize([{ ...group, scopes: group.scopes.filter((l) => l.platform !== "youtube") }])[0];
check("dropping a platform's lines moves the group type to the next platform", without.groupType === "reddit" && S.groupPlatforms(without).join(",") === "reddit,twitter,site", without.groupType);
const siteOnly = sanitize([{ ...group, scopes: group.scopes.filter((l) => l.surface === "site") }])[0];
check("a group left with only a site list becomes a site group", siteOnly.groupType === "site" && S.groupPlatforms(siteOnly).join() === "site", siteOnly.groupType);
// Old lines without a platform belong to the group's platform.
const legacy = sanitize([{ id: "l1", name: "L", groupType: "reddit", enabled: true, scopes: [{ surface: "items", action: "hide", sourceMode: "all" }] }])[0];
check("a stored line without a platform takes the group's", legacy.scopes[0].platform === "reddit", legacy.scopes);

// Apps entry (desktop applications) + a website list patched onto a platform group.
const withApps = sanitize([{ ...group, scopes: [...group.scopes, { surface: "apps", action: "block", apps: [{ id: "com.apple.Safari", name: "Safari" }, "com.apple.Safari", { id: "com.x.y" }] }] }])[0];
check("an apps line is kept, deduplicated by bundle id, on any normal group", S.groupPlatforms(withApps).join(",") === "youtube,reddit,twitter,site,apps" && S.flatFromScopes(withApps, "apps").apps.length === 2, withApps.scopes.at(-1));
context.__groups = [withApps];
check("apps lines never match a page and emit no feed filters", session("https://example.com/", "/", { u1: 30 * 60 * 1000 }).shouldExitPage === true && session("https://x.com/home", "/home", { u1: 30 * 60 * 1000 }).shouldExitPage === false && feed("https://www.youtube.com/", "/").length === 1, withApps.scopes.length);
context.__groups = [group];
const customApps = sanitize([{ id: "c1", name: "C", groupType: "custom", enabled: true, scopes: [{ surface: "apps", action: "block", apps: [{ id: "a" }] }] }])[0];
check("a custom group drops apps lines", customApps.scopes.length === 0, customApps.scopes);
const ytPatched = sanitize([{ id: "y1", name: "Y", groupType: "youtube", enabled: true, scopes: S.scopeLinesFromFlat({ sourceMode: "all" }, "youtube"), sites: ["docs.example.org"] }])[0];
check("a `sites` patch on a platform group adds its Websites entry", S.groupPlatforms(ytPatched).join(",") === "youtube,site" && S.flatFromScopes(ytPatched, "site").sites.join() === "docs.example.org" && S.flatFromScopes(ytPatched, "youtube").sourceMode === "all", ytPatched.scopes);

console.log(`SCOPES UNION TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
