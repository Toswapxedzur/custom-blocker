/* The block cover (owner 2026-09-25): what the worker tells a blocked page to
   do. Blank field → cover in place; text → cover with that message; address →
   navigate; the "pause" page action → the cover with a countdown, and a pass
   lets the tab through; block beats pause; the redirect fast path only
   intercepts groups that navigate; a snooze started from the cover is the
   popup's entry and is shared over the hub. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sentFrames = [];
// Session storage outlives a worker; a second context sharing it is a restart.
const sessionStore = new Map();
const alarmsCreated = [];
function makeContext() {
  const storage = new Map();
  const inert = () => new Proxy(function () {}, { get: (_t, p) => (p === "addListener" || p === "removeListener" || p === "hasListener") ? () => {} : inert(), apply: () => Promise.resolve(undefined) });
  const tabs = { updates: [], messages: [], muted: new Map() };
  const chrome = new Proxy({
    storage: {
      local: {
        get: (keys, cb) => { const out = {}; if (keys && typeof keys === "object" && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; else if (typeof keys === "string") out[keys] = storage.get(keys); if (cb) cb(out); return Promise.resolve(out); },
        set: (obj, cb) => { for (const [k, v] of Object.entries(obj)) storage.set(k, JSON.parse(JSON.stringify(v))); if (cb) cb(); return Promise.resolve(); },
        remove: () => Promise.resolve(), getBytesInUse: () => Promise.resolve(0)
      },
      session: {
        get: (key) => Promise.resolve(sessionStore.has(key) ? { [key]: JSON.parse(JSON.stringify(sessionStore.get(key))) } : {}),
        set: (obj) => { for (const [k, v] of Object.entries(obj)) sessionStore.set(k, JSON.parse(JSON.stringify(v))); return Promise.resolve(); },
        remove: () => Promise.resolve()
      },
      onChanged: { addListener() {}, removeListener() {}, hasListener: () => false }
    },
    tabs: new Proxy({
      get: (id) => Promise.resolve({ id, mutedInfo: { muted: tabs.muted.get(id) === "user" } }),
      update: (id, props) => { tabs.updates.push([id, props]); if ("muted" in props) tabs.muted.set(id, props.muted ? "ext" : false); return Promise.resolve({ id }); },
      sendMessage: (id, msg) => { tabs.messages.push([id, msg]); return Promise.resolve({ ok: true }); }
    }, { get: (t, p) => (p in t ? t[p] : inert()) }),
    alarms: { clear: () => Promise.resolve(), create: (_name, info) => { alarmsCreated.push(info); return Promise.resolve(); }, onAlarm: { addListener() {} } },
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
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx; ctx.__tabs = tabs;
  return ctx;
}
function loadWorker() {
  const ctx = makeContext();
  for (const file of ["platform-profiles.js", "group-scopes.js", "helpers.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"]) {
    const p = path.join(root, file); if (!fs.existsSync(p)) continue;
    vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: file });
  }
  return ctx;
}
const context = loadWorker();

let pass = 0; let fail = 0;
const check = (label, ok, detail) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); } };
const run = (expr) => vm.runInContext(expr, context);
const sanitize = (groups) => run(`sanitizeGroups(${JSON.stringify(groups)})`);
// The real clock: pass and snooze expiry are checked against Date.now().
const now = Date.now();
const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const base = (over) => ({ enabled: true, mode: "instant", allowedMinutes: 15, activeDays: days, timeWindowsText: "", snoozeMinutes: 5, snoozeActivationDelayMinutes: 0, snoozeCooldownMinutes: 1, snoozeConfirmations: 2, ...over });
const pc = (url, pathname) => { const u = new URL(url); return run(`normalizePageContext(${JSON.stringify({ url, hostname: u.hostname, pathname })})`); };
const session = (groups, url, pathname, { timers = {}, snoozes = {}, passed = false } = {}) => {
  context.__g = sanitize(groups); context.__pc = pc(url, pathname); context.__t = timers; context.__s = snoozes;
  return run(`buildPageSession(__pc, __g, __t, {}, __s, ${now}, [], ${passed})`);
};

// 1. What a blocked page does.
let s = session([base({ id: "g1", name: "Sites", groupType: "site", sites: ["example.com"] })], "https://example.com/a?b=1", "/a");
check("blank field: the page is covered in place", s.shouldExitPage && s.exit.action === "cover" && s.exit.target === "" && s.exit.message === "" && s.exit.groupName === "Sites", s.exit);
check("the cover offers snooze with the group's confirmations", s.exit.allowSnooze === true && s.exit.snoozeConfirmations === 2 && s.exit.snoozePhase === "none", s.exit);
s = session([base({ id: "g1", name: "Sites", groupType: "site", sites: ["example.com"], fallbackUrl: "Go work" })], "https://example.com/", "/");
check("text: the cover shows the message", s.exit.action === "cover" && s.exit.message === "Go work", s.exit);
s = session([base({ id: "g1", name: "Sites", groupType: "site", sites: ["example.com"], fallbackUrl: "https://focus.example.org/" })], "https://example.com/", "/");
check("an address: the tab is sent there", s.exit.action === "navigate" && s.exit.target === "https://focus.example.org/", s.exit);
s = session([base({ id: "g1", name: "Sites", groupType: "site", sites: ["example.com"], fallbackUrl: "about:blank" })], "https://example.com/", "/");
check("about:blank stays a user's choice to leave", s.exit.action === "navigate" && s.exit.target === "about:blank", s.exit);
s = session([base({ id: "c1", name: "Rule", groupType: "custom", sites: ["example.com"], blockingRulesText: "(m,d,n,h,mi,u,helpers) => false" })], "https://example.com/", "/");
check("a custom group's site list covers without snooze", s.exit.action === "cover" && s.exit.allowSnooze === false, s.exit);
s = session([base({ id: "g1", name: "Sites", groupType: "site", sites: ["example.com"] })], "https://other.org/", "/");
check("an unblocked page has no exit", !s.shouldExitPage && s.exit === null, s);

// 2. The pause action.
const pauseSite = base({ id: "p1", name: "Pause news", groupType: "site", sites: ["news.example.com"], pageAction: "pause", pauseSeconds: 7 });
s = session([pauseSite], "https://news.example.com/x", "/x");
check("a pause line: the cover counts down", s.shouldExitPage && s.exit.action === "pause" && s.exit.pauseSeconds === 7, s.exit);
s = session([pauseSite], "https://news.example.com/x", "/x", { passed: true });
check("with a pass the page is let through", !s.shouldExitPage && s.exit === null, s.exit);
s = session([pauseSite, base({ id: "b1", name: "Hard", groupType: "site", sites: ["news.example.com"] })], "https://news.example.com/x", "/x", { passed: true });
check("block beats pause (a pass never lifts a block)", s.shouldExitPage && s.exit.action === "cover" && s.exit.groupName === "Hard", s.exit);
const ytPause = base({ id: "y1", name: "YT", groupType: "youtube", sourceMode: "all", pageAction: "pause", platformTagMode: "include", platformTags: [{ name: "Gaming" }] });
context.__g = sanitize([ytPause]);
check("pause applies to source pages lines, tagged pages keep blocking", context.__g[0].scopes.filter((l) => l.surface === "pages").map((l) => l.action).join(",") === "pause,block", context.__g[0].scopes);
s = session([ytPause], "https://www.youtube.com/watch?v=1", "/watch");
check("a YouTube page under a pause line pauses", s.exit && s.exit.action === "pause", s.exit);
check("a pause pass is per tab and host and expires", (() => {
  run(`cbPausePasses.set(7, { host: "news.example.com", until: ${now + 1000} })`);
  return run(`cbPausePassActive(7, "news.example.com")`) === true && run(`cbPausePassActive(7, "other.org")`) === false && run(`cbPausePassActive(8, "news.example.com")`) === false;
})());

// 3. The redirect fast path only intercepts groups that navigate.
context.__g = sanitize([
  base({ id: "g1", name: "Cover", groupType: "site", sites: ["cover.example.com"] }),
  base({ id: "g2", name: "Msg", groupType: "site", sites: ["msg.example.com"], fallbackUrl: "Later" }),
  base({ id: "g3", name: "Go", groupType: "site", sites: ["go.example.com"], fallbackUrl: "focus.example.org" }),
  pauseSite
]);
const targets = run(`Object.fromEntries(getBlockingTargets(__g, {}, {}, ${now}))`);
check("only the address group has a fast-path target", targets["cover.example.com"] === "" && targets["msg.example.com"] === "" && targets["go.example.com"] === "https://focus.example.org", targets);
check("a pause site is not in the fast-path cache at all", !("news.example.com" in targets), Object.keys(targets));
run(`__blockedHostnamesCache = getBlockingHostnames(__g, {}, {}, ${now}); __blockedTargetsCache = getBlockingTargets(__g, {}, {}, ${now});`);
check("blockedRedirectUrl is empty for a covering site and the address for a navigating one", run(`blockedRedirectUrl("cover.example.com", "/")`) === "" && run(`blockedRedirectUrl("go.example.com", "/")`) === "https://focus.example.org");

// 4. Tab mute + frame media messages.
(async () => {
  await run(`cbSetTabCovered(5, true)`);
  await run(`cbSetTabCovered(5, false)`);
  const tabs = context.__tabs;
  check("covering mutes the tab and asks every frame to pause; lifting unmutes", JSON.stringify(tabs.updates) === JSON.stringify([[5, { muted: true }], [5, { muted: false }]]) && tabs.messages.length === 2 && tabs.messages[0][1].paused === true && tabs.messages[1][1].paused === false, { u: tabs.updates, m: tabs.messages });
  tabs.updates.length = 0; tabs.muted.set(9, "user");
  await run(`cbSetTabCovered(9, true)`); await run(`cbSetTabCovered(9, false)`);
  check("a tab the user muted is never touched", tabs.updates.length === 0, tabs.updates);

  // 5. Snooze from the cover.
  const groups = sanitize([base({ id: "g1", name: "Sites", groupType: "site", sites: ["example.com"] }), base({ id: "c1", name: "Rule", groupType: "custom", blockingRulesText: "(m,d,n,h,mi,u,helpers) => false" }), base({ id: "n1", name: "NoSnooze", groupType: "site", sites: ["x.com"], allowSnooze: false })]);
  await context.chrome.storage.local.set({ blockedGroups: groups });
  context.__sent = []; run(`cbConnection.sendWS = (frame) => { __sent.push(frame); return true; };`);
  const entry = await run(`cbStartSnooze("g1", ${now})`);
  check("the cover's snooze creates the popup's entry", entry.startsAtMs === now && entry.untilMs === now + 5 * 60000 && entry.cooldownUntilMs === now + 6 * 60000 && entry.confirmationCount === 2 && entry.refreezeMode === "none", entry);
  const stored = (await context.chrome.storage.local.get("groupSnoozes")).groupSnoozes;
  check("…stores it", stored && stored.g1 && stored.g1.untilMs === entry.untilMs, stored);
  const frame = context.__sent.find((f) => f.kind === "group-sync");
  check("…and shares it with linked members", frame && frame.groupName === "Sites" && frame.snoozeTs === now && frame.snooze.untilMs === entry.untilMs, context.__sent);
  let err = ""; try { await run(`cbStartSnooze("g1", ${now + 1000})`); } catch (e) { err = String(e.message || e); }
  check("a second snooze during the first is refused", err === "snooze-in-progress", err);
  err = ""; try { await run(`cbStartSnooze("c1", ${now})`); } catch (e) { err = String(e.message || e); }
  check("custom groups do not snooze", err === "snooze-disabled", err);
  err = ""; try { await run(`cbStartSnooze("n1", ${now})`); } catch (e) { err = String(e.message || e); }
  check("a group with snooze off refuses", err === "snooze-disabled", err);
  s = session([base({ id: "g1", name: "Sites", groupType: "site", sites: ["example.com"] })], "https://example.com/", "/", { snoozes: { g1: entry } });
  check("the snoozed group no longer blocks the page", !s.shouldExitPage, s);

  // 6. A passed pause covers nothing, so it must not stop another group's budget.
  const timed = base({ id: "t1", name: "Timed news", groupType: "site", sites: ["news.example.com"], mode: "after-minutes", allowedMinutes: 30 });
  await context.chrome.storage.local.set({ blockedGroups: sanitize([pauseSite, timed]), usageTimersMs: {}, usageResetAtMs: {}, groupSnoozes: {} });
  const pageCtx = JSON.stringify({ url: "https://news.example.com/x", hostname: "news.example.com", pathname: "/x" });
  await run(`applyElapsedTime(${pageCtx}, 5000, [], false)`);
  let timers = (await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {};
  check("while the pause covers the page, nothing accrues", !(timers.t1 > 0), timers);
  await run(`applyElapsedTime(${pageCtx}, 5000, [], true)`);
  timers = (await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {};
  check("after Continue, the other group's budget runs", timers.t1 === 5000, timers);

  // …and a page covered for any reason counts for no group: here a spent
  // allowance covers it, and another timed group on the same site stays still.
  const spent = base({ id: "x1", name: "Spent", groupType: "site", sites: ["news.example.com"], mode: "after-minutes", allowedMinutes: 1 });
  await context.chrome.storage.local.set({ blockedGroups: sanitize([spent, timed]), usageTimersMs: { x1: 60000, t1: 0 } });
  await run(`applyElapsedTime(${pageCtx}, 5000, [], false)`);
  timers = (await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {};
  check("a page covered by a spent allowance counts for no other group", timers.t1 === 0 && timers.x1 === 60000, timers);

  // 7. Passes and muted tabs survive the worker stopping; a pass's end is a transition.
  const passUntil = Date.now() + 60_000;
  run(`cbPausePasses.set(11, { host: "news.example.com", until: ${passUntil} }); cbSaveCoverState();`);
  await run(`cbSetTabCovered(12, true)`);
  alarmsCreated.length = 0;
  await run(`scheduleNextTransitionAlarm([], {}, {}, Date.now())`);
  check("the transition alarm fires when a pause pass ends", alarmsCreated.length === 1 && alarmsCreated[0].when === passUntil, alarmsCreated);
  const restarted = loadWorker();
  await vm.runInContext(`cbCoverStateReady`, restarted);
  check("a restarted worker still honours the pass", vm.runInContext(`cbPausePassActive(11, "news.example.com")`, restarted) === true);
  check("…and still knows which tab it muted", vm.runInContext(`cbMutedTabs.has(12)`, restarted) === true);

  console.log(`PAGE EXIT TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
})();
