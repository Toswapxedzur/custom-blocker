/* Owner 2026-09-26: while Mac Vault is away the browser runs its linked
   groups itself; the time it counts is handed over when the hub is back and
   ADDED to the shared budget (two browsers' offline time adds up) — nothing
   counted is lost, and the local counter shows shared + handed-over time. */
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
for (const file of ["platform-profiles.js", "group-scopes.js", "parental-pin.js", "group-actions.js", "helpers.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"]) {
  const p = path.join(root, file); if (!fs.existsSync(p)) continue;
  vm.runInContext(fs.readFileSync(p, "utf8"), context, { filename: file });
}
let pass = 0; let fail = 0;
const check = (label, ok, detail) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); } };
const run = (expr) => vm.runInContext(expr, context);
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

(async () => {
  let clock = Date.now();
  run(`Date.now = () => __clock();`);
  context.__clock = () => clock;
  const anchor = clock - 60000;
  const groups = run(`sanitizeGroups(${JSON.stringify([
    { id: "L", name: "Linked", groupType: "site", sites: ["example.com"], enabled: true, mode: "after-minutes", allowedMinutes: 30, activeDays: days, timeWindowsText: "" }
  ])})`);
  await context.chrome.storage.local.set({ blockedGroups: groups, usageTimersMs: { L: 300000 }, usageResetAtMs: { L: anchor } });
  const cluster = { id: "c1", groupName: "Linked", members: [{ program: "chrome", groupName: "Linked", groupId: "L" }, { program: "macapp", groupName: "Linked", groupId: "m1" }] };
  context.__cluster = cluster;
  // Linked earlier; now the hub is away (route not ready, runtime links cleared).
  run(`cbSaveClusterCopy([__cluster]); cbConnection.clusters = []; cbConnection.routeIsReady = () => false;`);
  context.__sent = []; run(`cbConnection.sendWS = (frame) => { __sent.push(frame); return true; };`);

  clock += 1000; await run(`applyElapsedTime("example.com", 1000, [])`);
  clock += 1000; await run(`applyElapsedTime("example.com", 1000, [])`);
  const offline = (await context.chrome.storage.local.get("cbOfflineUsage")).cbOfflineUsage || {};
  check("time counted while the hub is away is kept apart for the linked group", offline.L && offline.L.ms === 2000 && offline.L.anchorMs === anchor, offline);
  check("…and the group keeps counting locally (the browser runs it)", ((await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {}).L === 302000);
  check("nothing is sent while the hub is away", context.__sent.length === 0, context.__sent);

  // The hub is back with the shared total it had (5 min, same period).
  run(`cbConnection.routeIsReady = (t) => t === "macapp";`);
  context.__clusters = [{ ...cluster, shared: { scalars: {}, usageMs: 300000, usageResetAtMs: anchor } }];
  run(`cbConnection.clusters = __clusters;`);
  await run(`cbConnection.applySharedToStorage()`);
  const handed = context.__sent.find((f) => f.kind === "group-sync" && f.usageDeltaMs !== undefined);
  check("on return the offline time is handed over as an increment for its period", handed && handed.usageDeltaMs === 2000 && handed.usageDeltaAnchorMs === anchor, context.__sent);
  check("…the local counter shows shared + handed-over time, not the hub's older total", ((await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {}).L === 302000);
  check("…and it is handed over once", Object.keys((await context.chrome.storage.local.get("cbOfflineUsage")).cbOfflineUsage || {}).length === 0);

  console.log(`OFFLINE HANDOVER TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
  process.exit(process.exitCode || 0);
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exit(1);
});
