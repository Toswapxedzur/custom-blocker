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
for (const file of ["platform-profiles.js", "group-scopes.js", "parental-pin.js", "group-actions.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"]) {
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
  run(`cbConnection.routeIsReady = (t) => t === "macapp"; cbConnection.usageTransferReceipts = true;`);
  context.__clusters = [{ ...cluster, shared: { scalars: {}, usageMs: 300000, usageResetAtMs: anchor } }];
  run(`cbConnection.clusters = __clusters;`);
  await run(`cbConnection.applySharedToStorage()`);
  const handed = context.__sent.find((f) => f.kind === "group-sync" && f.usageDeltaMs !== undefined);
  check("on return the offline time is handed over as an increment for its period", handed && handed.usageDeltaMs === 2000 && handed.usageDeltaAnchorMs === anchor, context.__sent);
  check("…the local counter shows shared + handed-over time, not the hub's older total", ((await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {}).L === 302000);
  check("…and it is handed over once", Object.keys((await context.chrome.storage.local.get("cbOfflineUsage")).cbOfflineUsage || {}).length === 0);
  let outbox = (await context.chrome.storage.local.get("cbOfflineUsageTransfers")).cbOfflineUsageTransfers || {};
  check("socket submission retains the immutable batch until hub receipt", Object.keys(outbox).length === 1 && outbox[handed?.usageTransferId]?.ms === 2000, outbox);
  await Promise.all([run(`cbConnection.applySharedToStorage()`), run(`cbConnection.applySharedToStorage()`)]);
  const retries = context.__sent.filter(f => f.usageTransferId);
  check("overlapping snapshots retry the same transfer id rather than create duplicate usage", new Set(retries.map(f => f.usageTransferId)).size === 1, retries);
  context.__clusters = [{ ...cluster, shared: { scalars: {}, usageMs: 302000, usageResetAtMs: anchor, usageTransferReceipts: { ["chrome:" + handed.usageTransferId]: clock } } }];
  run(`cbConnection.clusters = __clusters;`);
  await run(`cbConnection.applySharedToStorage()`);
  check("hub receipt removes the batch", Object.keys((await context.chrome.storage.local.get("cbOfflineUsageTransfers")).cbOfflineUsageTransfers || {}).length === 0);
  check("receipt-bearing shared usage does not double-count our accepted batch", ((await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {}).L === 302000);

  // A failed send is retried from durable storage without dropping its usage.
  await run(`cbRecordOfflineUsage({L:{ms:1000,buckets:{}}},{L:${anchor}})`);
  run(`cbConnection.sendWS = () => false;`);
  await run(`cbHandOverOfflineUsage([{group:__clusters[0] && {id:"L"},cluster:__clusters[0]}])`);
  outbox = (await context.chrome.storage.local.get("cbOfflineUsageTransfers")).cbOfflineUsageTransfers || {};
  check("failed send retains pending usage in the durable outbox", Object.values(outbox).some(entry => entry.ms === 1000));
  run(`cbConnection.sendWS = (frame) => { __sent.push(frame); return true; };`);

  // Online: the browser's own accrual reaches the hub as an increment.
  context.__sent.length = 0;
  clock += 1000; await run(`applyElapsedTime("example.com", 1000, [])`);
  const live = context.__sent.find((f) => f.kind === "group-sync" && f.program === "chrome" && f.groupId === "L" && f.usageDeltaMs > 0 && f.usageDeltaAnchorMs === undefined);
  check("while the hub is connected, time counted here is reported to it", live && live.usageDeltaMs === 1000, context.__sent);

  // Hold the older storage read, enqueue a newer snapshot and then release it.
  // The newer operation must wait and remain the final stored policy/usage.
  const originalGet = context.chrome.storage.local.get;
  let release, held = false;
  context.chrome.storage.local.get = async (keys, cb) => {
    const value = await originalGet(keys, cb);
    if (!held && keys && Object.hasOwn(keys, "blockedGroups")) {
      held = true; await new Promise(resolve => { release = resolve; });
    }
    return value;
  };
  context.__clusters = [{ ...cluster, shared: { scalars: {allowedMinutes: 10}, usageMs: 310000, usageResetAtMs: anchor } }];
  run(`cbConnection.clusters = __clusters;`);
  const older = run(`cbConnection.applySharedToStorage()`);
  while (!release) await new Promise(resolve => setImmediate(resolve));
  context.__clusters = [{ ...cluster, shared: { scalars: {allowedMinutes: 20}, usageMs: 320000, usageResetAtMs: anchor } }];
  run(`cbConnection.clusters = __clusters;`);
  const newer = run(`cbConnection.applySharedToStorage()`);
  release(); await Promise.all([older, newer]);
  const final = await originalGet({ blockedGroups: [], usageTimersMs: {} });
  check("newest queued snapshot remains final after a delayed older read", final.blockedGroups[0].allowedMinutes === 20 && final.usageTimersMs.L >= 320000, final);

  console.log(`OFFLINE HANDOVER TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
  process.exit(process.exitCode || 0);
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exit(1);
});
