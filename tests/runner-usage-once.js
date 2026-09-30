/* A group's budget counts each moment once (owner 2026-09-26): two visible
   tabs of the same group (two windows side by side) both send heartbeats for
   the same seconds; the group's time must advance like one tab's. */
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
  const groups = run(`sanitizeGroups(${JSON.stringify([
    { id: "a", name: "A", groupType: "site", sites: ["example.com"], enabled: true, mode: "after-minutes", allowedMinutes: 30, activeDays: days, timeWindowsText: "" },
    { id: "b", name: "B", groupType: "site", sites: ["other.org"], enabled: true, mode: "after-minutes", allowedMinutes: 30, activeDays: days, timeWindowsText: "" }
  ])})`);
  await context.chrome.storage.local.set({ blockedGroups: groups });
  const used = async (id) => ((await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {})[id] || 0;

  clock += 1000;
  await run(`applyElapsedTime("example.com", 1000, [])`);
  await run(`applyElapsedTime("example.com", 1000, [])`);
  check("two tabs reporting the same second count it once", await used("a") === 1000, await used("a"));
  clock += 1000;
  await run(`applyElapsedTime("example.com", 1000, [])`);
  await run(`applyElapsedTime("www.example.com", 1000, [])`);
  check("the next second counts once more", await used("a") === 2000, await used("a"));
  await run(`applyElapsedTime("other.org", 1000, [])`);
  check("another group's page counts for that group, on its own clock", await used("b") === 1000 && await used("a") === 2000, [await used("a"), await used("b")]);
  clock += 500;
  await run(`applyElapsedTime("example.com", 1000, [])`);
  check("a heartbeat overlapping counted time adds only the new part", await used("a") === 2500, await used("a"));

  // A budget snooze's time is counted as it is used, to the second (owner
  // 2026-09-30), also on a rolling limit whose usage is kept per minute.
  const budgetGroups = run(`sanitizeGroups(${JSON.stringify([
    { id: "c", name: "C", groupType: "site", sites: ["fixed.test"], enabled: true, mode: "after-minutes", allowedMinutes: 1, resetIntervalHours: 24, snoozeKind: "budget", snoozeMinutes: 1, activeDays: days, timeWindowsText: "" },
    { id: "d", name: "D", groupType: "site", sites: ["rolling.test"], enabled: true, mode: "after-minutes", allowedMinutes: 1, resetIntervalHours: 3, rollingLimit: true, snoozeKind: "budget", snoozeMinutes: 1, activeDays: days, timeWindowsText: "" }
  ])})`);
  const minute = Math.floor(clock / 60000) * 60000;
  const snooze = { kind: "budget", extraMs: 60000, startsAtMs: clock - 1000, untilMs: clock + 3600000, cooldownUntilMs: clock + 3600000, confirmationCount: 0, activeMsApplied: false, changedAtMs: clock - 1000 };
  await context.chrome.storage.local.set({
    blockedGroups: [...groups, ...budgetGroups],
    usageTimersMs: { ...((await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {}), c: 59500, d: 60000 },
    usageResetAtMs: { c: clock - 1000 },
    usageBucketsMs: { d: { [String(minute - 120000)]: 60000 } },
    groupSnoozes: { c: snooze, d: snooze },
    groupSnoozeTotalsMs: {}
  });
  const totals = async () => (await context.chrome.storage.local.get("groupSnoozeTotalsMs")).groupSnoozeTotalsMs || {};
  for (let i = 0; i < 3; i += 1) {
    clock += 1000;
    await run(`applyElapsedTime("fixed.test", 1000, [])`);
    await run(`applyElapsedTime("rolling.test", 1000, [])`);
  }
  const t = await totals();
  check("budget snooze, fixed budget: only the part past the allowance counts (0.5 s under it, then 3 s → 2.5 s)", t.c === 2500, t);
  check("budget snooze, rolling limit: each second used past the allowance counts (3 s)", t.d === 3000, t);
  check("…and the usage itself runs on", await used("c") === 62500 && await used("d") === 63000, [await used("c"), await used("d")]);

  console.log(`USAGE ONCE TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
  // The frozen test clock keeps the worker's own retry timers pending forever.
  process.exit(process.exitCode || 0);
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
