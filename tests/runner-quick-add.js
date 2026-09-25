/* The quick-add "+" (owner 2026-09-25): off by default; it means "block this
   page". The page's most detailed site entry (host + path, never query or
   fragment) is appended to the chosen group's Websites entry, creating it when
   missing; on an "everything except" list the entries letting the page through
   are removed instead. It only tightens, so a locked group accepts it. A
   repeat click changes nothing; custom groups cannot be targets. */
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
        get: (keys, cb) => { const out = {}; if (keys && typeof keys === "object" && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; else if (typeof keys === "string") out[keys] = storage.get(keys); if (cb) cb(out); return Promise.resolve(out); },
        set: (obj, cb) => { for (const [k, v] of Object.entries(obj)) storage.set(k, JSON.parse(JSON.stringify(v))); if (cb) cb(); return Promise.resolve(); },
        remove: () => Promise.resolve(), getBytesInUse: () => Promise.resolve(0)
      },
      session: { get: () => Promise.resolve({}), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: { addListener() {}, removeListener() {}, hasListener: () => false }
    },
    alarms: { clear: () => Promise.resolve(), create: () => Promise.resolve(), onAlarm: { addListener() {} } },
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
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const base = (over) => ({ enabled: true, mode: "instant", allowedMinutes: 15, activeDays: days, timeWindowsText: "", ...over });

check("the entry is host + path without query or fragment", run(`cbQuickAddEntry("https://www.Example.com/a/b/?utm=1#refreshtheme=1")`) === "example.com/a/b", run(`cbQuickAddEntry("https://www.Example.com/a/b/?utm=1#refreshtheme=1")`));
check("a front page is the host alone", run(`cbQuickAddEntry("https://news.example.com/")`) === "news.example.com");
check("only web pages qualify", run(`cbQuickAddEntry("chrome://extensions")`) === null && run(`cbQuickAddEntry("")`) === null);

(async () => {
  const groups = run(`sanitizeGroups(${JSON.stringify([
    base({ id: "y1", name: "YT", groupType: "youtube", sourceMode: "all" }),
    base({ id: "s1", name: "Sites", groupType: "site", sites: ["old.example.com"] }),
    base({ id: "c1", name: "Rule", groupType: "custom", blockingRulesText: "(m,d,n,h,mi,u,helpers) => false" }),
    base({ id: "a1", name: "Work only", groupType: "site", sites: ["work.com", "docs.example.com/guide"], allowlist: true, freezeMode: "frozen" }),
    base({ id: "f1", name: "Locked", groupType: "site", sites: ["old.example.org"], freezeMode: "strict", frozenAtMs: Date.now() })
  ])})`);
  await context.chrome.storage.local.set({ blockedGroups: groups, globalSettings: { quickAddEnabled: false }, quickAddGroupId: "y1" });
  context.__sent = []; run(`cbConnection.sendWS = (frame) => { __sent.push(frame); return true; };`);
  let state = await run(`cbQuickAddState()`);
  check("off by default: no target", state.enabled === false, state);
  let err = ""; try { await run(`cbQuickAdd("https://example.com/x")`); } catch (e) { err = String(e.message || e); }
  check("a click while off is refused", err === "quick-add-off", err);

  await context.chrome.storage.local.set({ globalSettings: { quickAddEnabled: true } });
  state = await run(`cbQuickAddState()`);
  check("on with a chosen group: the target is named", state.enabled === true && state.groupId === "y1" && state.groupName === "YT", state);

  let result = await run(`cbQuickAdd("https://docs.example.org/guide/intro?x=1#top")`);
  let stored = (await context.chrome.storage.local.get("blockedGroups")).blockedGroups;
  let yt = stored.find((g) => g.id === "y1");
  check("a platform group gains a Websites entry with the page's entry", result.added === true && result.entry === "docs.example.org/guide/intro" && yt.scopes.some((l) => l.surface === "site" && l.sites.join() === "docs.example.org/guide/intro"), yt.scopes);
  check("its YouTube lines are untouched", yt.scopes.filter((l) => l.platform === "youtube").length === 2, yt.scopes);
  check("the new entry is shared with linked members right away", context.__sent.some((f) => f.kind === "group-sync" && f.groupName === "YT" && Array.isArray(f.scopes)), context.__sent);

  result = await run(`cbQuickAdd("https://docs.example.org/guide/intro/")`);
  stored = (await context.chrome.storage.local.get("blockedGroups")).blockedGroups;
  yt = stored.find((g) => g.id === "y1");
  check("a repeat click adds nothing", result.added === false && yt.scopes.find((l) => l.surface === "site").sites.length === 1, yt.scopes);

  await context.chrome.storage.local.set({ quickAddGroupId: "s1" });
  result = await run(`cbQuickAdd("https://news.example.com/")`);
  stored = (await context.chrome.storage.local.get("blockedGroups")).blockedGroups;
  const sites = stored.find((g) => g.id === "s1");
  check("a site group's existing list grows", sites.scopes.find((l) => l.surface === "site").sites.join() === "old.example.com,news.example.com", sites.scopes);

  // "+" means "block this page": it only tightens, so a locked group accepts it.
  await context.chrome.storage.local.set({ quickAddGroupId: "a1" });
  result = await run(`cbQuickAdd("https://docs.example.com/guide/intro")`);
  stored = (await context.chrome.storage.local.get("blockedGroups")).blockedGroups;
  let allow = stored.find((g) => g.id === "a1").scopes.find((l) => l.surface === "site");
  check("on an allowlist, '+' removes the entries that let the page through", result.added === false && result.removed.join() === "docs.example.com/guide" && allow.sitesExcept === true && allow.sites.join() === "work.com", allow);
  result = await run(`cbQuickAdd("https://reddit.com/r/x")`);
  stored = (await context.chrome.storage.local.get("blockedGroups")).blockedGroups;
  allow = stored.find((g) => g.id === "a1").scopes.find((l) => l.surface === "site");
  check("an already blocked page leaves the allowlist alone", result.removed.length === 0 && allow.sites.join() === "work.com", allow);
  await context.chrome.storage.local.set({ quickAddGroupId: "f1" });
  result = await run(`cbQuickAdd("https://new.example.org/")`);
  stored = (await context.chrome.storage.local.get("blockedGroups")).blockedGroups;
  check("a locked blocklist still gains the page (tightening only)", result.added === true && stored.find((g) => g.id === "f1").scopes.find((l) => l.surface === "site").sites.join() === "old.example.org,new.example.org", stored.find((g) => g.id === "f1").scopes);

  await context.chrome.storage.local.set({ quickAddGroupId: "c1" });
  state = await run(`cbQuickAddState()`);
  check("a custom group is never a target", state.enabled === false, state);
  await context.chrome.storage.local.set({ quickAddGroupId: "gone" });
  state = await run(`cbQuickAddState()`);
  check("a deleted target means no target", state.enabled === false, state);

  console.log(`QUICK ADD TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
})();
