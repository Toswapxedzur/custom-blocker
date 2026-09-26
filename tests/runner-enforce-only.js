/* Owner 2026-09-26: Mac Vault holds a linked group's state. While it is away
   the browser only ENFORCES a linked group: no snooze from the cover, no
   quick-add into it (the editor refuses every change the same way). And the
   editor's link syncs reach the hub with the group's lock. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const __listeners = [];
function makeContext() {
  const storage = new Map();
  const changeListeners = [];
  const inert = () => new Proxy(function () {}, { get: (_t, p) => (p === "addListener" || p === "removeListener" || p === "hasListener") ? () => {} : inert(), apply: () => Promise.resolve(undefined) });
  const chrome = new Proxy({
    storage: {
      local: {
        get: (keys, cb) => { const out = {}; if (keys && typeof keys === "object" && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; else if (typeof keys === "string") out[keys] = storage.get(keys); if (cb) cb(out); return Promise.resolve(out); },
        // Like chrome.storage: every write reaches the onChanged listeners.
        set: (obj, cb) => { const changes = {}; for (const [k, v] of Object.entries(obj)) { const next = JSON.parse(JSON.stringify(v)); changes[k] = { oldValue: storage.get(k), newValue: next }; storage.set(k, next); } Promise.resolve().then(() => { for (const fn of changeListeners) fn(changes, "local"); }); if (cb) cb(); return Promise.resolve(); },
        remove: () => Promise.resolve(), getBytesInUse: () => Promise.resolve(0)
      },
      session: { get: () => Promise.resolve({}), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: { addListener: (fn) => changeListeners.push(fn), removeListener() {}, hasListener: () => false }
    },
    alarms: { clear: () => Promise.resolve(), create: () => Promise.resolve(), onAlarm: { addListener() {} } },
    runtime: new Proxy({ id: "t", onMessage: { addListener: (fn) => __listeners.push(fn), removeListener() {}, hasListener: () => false }, getManifest: () => ({ version: "0" }), getURL: (p) => `chrome-extension://t/${p}`, lastError: null }, { get: (t, p) => (p in t ? t[p] : inert()) })
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
for (const file of ["platform-profiles.js", "group-scopes.js", "parental-pin.js", "group-actions.js", "helpers.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"]) {
  const p = path.join(root, file); if (!fs.existsSync(p)) continue;
  vm.runInContext(fs.readFileSync(p, "utf8"), context, { filename: file });
}
let pass = 0; let fail = 0;
const check = (label, ok, detail) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); } };
const run = (expr) => vm.runInContext(expr, context);
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

(async () => {
  const groups = run(`sanitizeGroups(${JSON.stringify([
    { id: "L", name: "Linked", groupType: "site", sites: ["example.com"], enabled: true, mode: "instant", activeDays: days, timeWindowsText: "", snoozeConfirmations: 0 },
    { id: "U", name: "Alone", groupType: "site", sites: ["other.org"], enabled: true, mode: "instant", activeDays: days, timeWindowsText: "", snoozeConfirmations: 0 }
  ])})`);
  await context.chrome.storage.local.set({ blockedGroups: groups, globalSettings: { quickAddEnabled: true }, quickAddGroupId: "L" });
  context.__cluster = { id: "c1", groupName: "Linked", members: [{ program: "chrome", groupName: "Linked", groupId: "L" }, { program: "macapp", groupName: "Linked", groupId: "m1" }] };
  context.__sent = [];
  run(`cbSaveClusterCopy([__cluster]); cbConnection.clusters = []; cbConnection.routeIsReady = () => false; cbConnection.sendWS = (f) => { __sent.push(f); return true; };`);

  check("a linked group is enforce-only while Mac Vault is away", run(`cbEnforceOnly(${JSON.stringify(groups[0])})`) === true);
  check("…an unlinked group is not", run(`cbEnforceOnly(${JSON.stringify(groups[1])})`) === false);
  let err = ""; try { await run(`cbStartSnooze("L")`); } catch (e) { err = String(e.message || e); }
  check("the cover's Snooze is refused for it", err === "mac-vault-away", err);
  check("…but works for an unlinked group", (await run(`cbStartSnooze("U")`)).startsAtMs > 0);
  const quick = await run(`cbQuickAddState()`);
  check("the quick-add '+' offers no target while its group is enforce-only", quick.enabled === false, quick);
  const session = run(`buildPageSession(normalizePageContext("example.com"), ${JSON.stringify(groups)}, {}, {}, {}, Date.now(), [], new Set())`);
  check("the page is still blocked (enforced), with no Snooze on its cover", session.exit && session.exit.allowSnooze === false, session.exit);

  run(`cbConnection.routeIsReady = (t) => t === "macapp";`);
  check("with Mac Vault back the group can change again", run(`cbEnforceOnly(${JSON.stringify(groups[0])})`) === false);
  context.__sent.length = 0;
  // The editor only stores its change; the worker shares it with the link.
  const stored = (await context.chrome.storage.local.get({ blockedGroups: [] })).blockedGroups;
  const locked = stored.map((g) => (g.id === "L" ? { ...g, lockedAtMs: 5, lockWaitHours: 0, lockVersion: 3, lockSyncedVersion: 2 } : g));
  await context.chrome.storage.local.set({ blockedGroups: locked });
  await new Promise((resolve) => setTimeout(resolve, 30));
  const frame = context.__sent.find((f) => f.kind === "group-sync" && f.groupName === "Linked");
  check("an editor's stored lock change reaches the hub with its lock and base version", frame && frame.lock && frame.lock.lockVersion === 3 && frame.lockBase === 2, context.__sent);

  console.log(`ENFORCE ONLY TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exit(1);
});
