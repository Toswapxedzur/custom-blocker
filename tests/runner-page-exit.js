/* The block cover (owner 2026-09-25): what the worker tells a blocked page to
   do. Blank field → cover in place; text → cover with that message; address →
   navigate; the "pause" page action → the cover with a countdown, and a pass
   (per group) lets the tab through; groups are walked from the top and the
   first that blocks decides; the early redirect asks the same decision; a snooze started from the cover is the
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
  const changeListeners = [];
  const inert = () => new Proxy(function () {}, { get: (_t, p) => (p === "addListener" || p === "removeListener" || p === "hasListener") ? () => {} : inert(), apply: () => Promise.resolve(undefined) });
  const tabs = { updates: [], messages: [], muted: new Map() };
  const chrome = new Proxy({
    storage: {
      local: {
        get: (keys, cb) => { const out = {}; if (keys && typeof keys === "object" && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; else if (typeof keys === "string") out[keys] = storage.get(keys); if (cb) cb(out); return Promise.resolve(out); },
        // Like chrome.storage: every write reaches the onChanged listeners.
        set: (obj, cb) => { const changes = {}; for (const [k, v] of Object.entries(obj)) { const next = JSON.parse(JSON.stringify(v)); changes[k] = { oldValue: storage.get(k), newValue: next }; storage.set(k, next); } Promise.resolve().then(() => { for (const fn of changeListeners) fn(changes, "local"); }); if (cb) cb(); return Promise.resolve(); },
        remove: () => Promise.resolve(), getBytesInUse: () => Promise.resolve(0)
      },
      session: {
        get: (key) => Promise.resolve(sessionStore.has(key) ? { [key]: JSON.parse(JSON.stringify(sessionStore.get(key))) } : {}),
        set: (obj) => { for (const [k, v] of Object.entries(obj)) sessionStore.set(k, JSON.parse(JSON.stringify(v))); return Promise.resolve(); },
        remove: () => Promise.resolve()
      },
      onChanged: { addListener: (fn) => changeListeners.push(fn), removeListener() {}, hasListener: () => false }
    },
    tabs: new Proxy({
      get: (id) => Promise.resolve({ id, mutedInfo: { muted: tabs.muted.get(id) === "user" } }),
      update: (id, props) => { tabs.updates.push([id, props]); if ("muted" in props) tabs.muted.set(id, props.muted ? "ext" : false); return Promise.resolve({ id }); },
      sendMessage: (id, msg) => { tabs.messages.push([id, msg]); return Promise.resolve({ ok: true }); },
      query: () => Promise.resolve([{ id: 21, url: "https://news.example.com/x" }, { id: 22, url: "https://other.example.org/" }])
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
  for (const file of ["platform-profiles.js", "group-scopes.js", "parental-pin.js", "group-actions.js", "helpers.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"]) {
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
const session = (groups, url, pathname, { timers = {}, snoozes = {}, passed = [] } = {}) => {
  context.__g = sanitize(groups); context.__pc = pc(url, pathname); context.__t = timers; context.__s = snoozes;
  return run(`buildPageSession(__pc, __g, __t, {}, __s, ${now}, [], new Set(${JSON.stringify(passed)}))`);
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
s = session([pauseSite], "https://news.example.com/x", "/x", { passed: ["p1"] });
check("with a pass the page is let through", !s.shouldExitPage && s.exit === null, s.exit);
const hard = base({ id: "b1", name: "Hard", groupType: "site", sites: ["news.example.com"] });
s = session([pauseSite, hard], "https://news.example.com/x", "/x");
check("the top group decides: a pause above a block pauses first", s.exit.action === "pause" && s.exit.groupName === "Pause news", s.exit);
s = session([pauseSite, hard], "https://news.example.com/x", "/x", { passed: ["p1"] });
check("after Continue the page is re-decided: the next group down blocks it", s.shouldExitPage && s.exit.action === "cover" && s.exit.groupName === "Hard", s.exit);
s = session([hard, pauseSite], "https://news.example.com/x", "/x");
check("a block above a pause covers (the top group decides)", s.exit.action === "cover" && s.exit.groupName === "Hard", s.exit);
const pauseTwo = base({ id: "p2", name: "Pause two", groupType: "site", sites: ["news.example.com"], pageAction: "pause", pauseSeconds: 4 });
s = session([pauseSite, pauseTwo], "https://news.example.com/x", "/x", { passed: ["p1"] });
check("Continue belongs to its group: a second pause group still gets its turn", s.exit.action === "pause" && s.exit.groupName === "Pause two" && s.exit.pauseSeconds === 4, s.exit);
const ytPause = base({ id: "y1", name: "YT", groupType: "youtube", sourceMode: "all", pageAction: "pause", platformTagMode: "include", platformTags: [{ name: "Gaming" }] });
context.__g = sanitize([ytPause]);
check("pause applies to source pages lines, tagged pages keep blocking", context.__g[0].scopes.filter((l) => l.surface === "pages").map((l) => l.action).join(",") === "pause,block", context.__g[0].scopes);
s = session([ytPause], "https://www.youtube.com/watch?v=1", "/watch");
check("a YouTube page under a pause line pauses", s.exit && s.exit.action === "pause", s.exit);
const ytHome = base({ id: "y2", name: "YT home", groupType: "youtube", sourceMode: "all", pageAction: "pause", blockHomePage: true });
s = session([ytHome], "https://www.youtube.com/", "/");
check("a 'block home feed' line blocks the home page (block beats pause within a group)", s.exit && s.exit.action === "cover", s.exit);
check("a pause pass is per tab, group and host, and expires", (() => {
  run(`cbPausePasses.set(cbPauseKey(7, "p1"), { host: "news.example.com", until: Date.now() + 60000 })`);
  run(`cbPausePasses.set(cbPauseKey(7, "p2"), { host: "news.example.com", until: Date.now() - 1 })`);
  const here = [...run(`cbPausePassedGroups(7, "news.example.com")`)];
  return here.join() === "p1" && run(`cbPausePassedGroups(7, "other.org")`).size === 0 && run(`cbPausePassedGroups(8, "news.example.com")`).size === 0;
})());

// 3. Priority: the top-most blocking group decides the whole cover.
const topMsg = base({ id: "a1", name: "Top", groupType: "site", sites: ["two.example.com"], fallbackUrl: "Go work" });
const bottom = base({ id: "z1", name: "Bottom", groupType: "site", sites: ["two.example.com"] });
s = session([topMsg, bottom], "https://two.example.com/", "/");
check("name and message come from the same, top-most group", s.exit.groupName === "Top" && s.exit.message === "Go work", s.exit);
s = session([bottom, topMsg], "https://two.example.com/", "/");
check("…and follow the order when it changes", s.exit.groupName === "Bottom" && s.exit.message === "", s.exit);
s = session([topMsg, bottom], "https://two.example.com/", "/", { snoozes: { a1: { startsAtMs: now - 1000, untilMs: now + 60000, cooldownUntilMs: now + 60000 } } });
check("snoozing the top group reveals the next one", s.exit.groupName === "Bottom", s.exit);
const pauseAddr = base({ id: "pa", name: "Pause addr", groupType: "site", sites: ["addr.example.com"], pageAction: "pause", fallbackUrl: "focus.example.org" });
s = session([pauseAddr], "https://addr.example.com/", "/");
check("a pause never redirects", s.exit.action === "pause" && s.exit.target === "", s.exit);

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
  context.__sent = []; run(`cbConnection.sendWS = (frame) => { __sent.push(frame); return true; }; cbConnection.routeIsReady = () => true; cbConnection.clusters = [{ id: "k1", groupName: "Sites", members: [{ program: cbDetectProgramId(), groupId: "g1" }], shared: { snoozeTs: 0 } }];`);
  const entry = await run(`cbStartSnooze("g1", ${now})`);
  await new Promise((resolve) => setTimeout(resolve, 30));
  check("the cover's snooze creates the popup's entry", entry.startsAtMs === now && entry.untilMs === now + 5 * 60000 && entry.cooldownUntilMs === now + 6 * 60000 && entry.confirmationCount === 2 && !("refreezeMode" in entry), entry);
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

  // 3b. The page decides on arrival (there is no early redirect): the top
  // group decides, and only an address sends the tab away.
  const arrival = [
    base({ id: "g1", name: "Cover", groupType: "site", sites: ["cover.example.com"] }),
    base({ id: "g2", name: "Msg", groupType: "site", sites: ["msg.example.com"], fallbackUrl: "Later" }),
    base({ id: "g3", name: "Go", groupType: "site", sites: ["go.example.com"], fallbackUrl: "focus.example.org" }),
    base({ id: "g4", name: "Cover first", groupType: "site", sites: ["both.example.com"] }),
    base({ id: "g5", name: "Go second", groupType: "site", sites: ["both.example.com"], fallbackUrl: "focus.example.org" }),
    pauseAddr,
    // Last: it blocks every other site, so anything above it decides first.
    base({ id: "g6", name: "Work only", groupType: "site", sites: ["reddit.com/r/learnprogramming", "focus.example.org"], allowlist: true, fallbackUrl: "focus.example.org" })
  ];
  const leave = (url) => { const u = new URL(url); const r = session(arrival, url, u.pathname); return r.shouldExitPage && r.exit.action === "navigate" ? r.exit.target : ""; };
  check("an address group sends the tab away", leave("https://go.example.com/") === "https://focus.example.org");
  check("a covering group or a message covers in place", leave("https://cover.example.com/") === "" && leave("https://msg.example.com/") === "");
  check("a pause never redirects", leave("https://addr.example.com/") === "");
  check("the top group decides: a cover above an address", leave("https://both.example.com/") === "");
  check("an 'everything except' path exception is honoured", leave("https://www.reddit.com/r/learnprogramming/") === "" && leave("https://www.reddit.com/r/news/") === "https://focus.example.org");
  const loop = [
    base({ id: "a", name: "A", groupType: "site", sites: ["a.example.com"], fallbackUrl: "b.example.com" }),
    base({ id: "b", name: "B", groupType: "site", sites: ["b.example.com"], fallbackUrl: "a.example.com" })
  ];
  const looped = session(loop, "https://a.example.com/", "/");
  check("a redirect to a page that is blocked too covers in place (no loop)", looped.shouldExitPage && looped.exit.action === "cover" && looped.exit.target === "", looped.exit);

  // 6. A passed pause covers nothing, so it must not stop another group's budget.
  const timed = base({ id: "t1", name: "Timed news", groupType: "site", sites: ["news.example.com"], mode: "after-minutes", allowedMinutes: 30 });
  await context.chrome.storage.local.set({ blockedGroups: sanitize([pauseSite, timed]), usageTimersMs: {}, usageResetAtMs: {}, groupSnoozes: {} });
  const pageCtx = JSON.stringify({ url: "https://news.example.com/x", hostname: "news.example.com", pathname: "/x" });
  await run(`applyElapsedTime(${pageCtx}, 5000, [])`);
  let timers = (await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {};
  check("while the pause covers the page, nothing accrues", !(timers.t1 > 0), timers);
  await run(`applyElapsedTime(${pageCtx}, 5000, [], new Set(["p1"]))`);
  timers = (await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {};
  check("after Continue, the other group's budget runs", timers.t1 === 5000, timers);

  // …and a page covered for any reason counts for no group: here a spent
  // allowance covers it, and another timed group on the same site stays still.
  const spent = base({ id: "x1", name: "Spent", groupType: "site", sites: ["news.example.com"], mode: "after-minutes", allowedMinutes: 1 });
  await context.chrome.storage.local.set({ blockedGroups: sanitize([spent, timed]), usageTimersMs: { x1: 60000, t1: 0 } });
  await run(`applyElapsedTime(${pageCtx}, 5000, [])`);
  timers = (await context.chrome.storage.local.get("usageTimersMs")).usageTimersMs || {};
  check("a page covered by a spent allowance counts for no other group", timers.t1 === 0 && timers.x1 === 60000, timers);

  // 7. Passes and muted tabs survive the worker stopping; a pass's end is a transition.
  const passUntil = Date.now() + 60_000;
  run(`cbPausePasses.clear(); cbPausePasses.set(cbPauseKey(11, "p1"), { host: "news.example.com", until: ${passUntil} }); cbSaveCoverState();`);
  await run(`cbSetTabCovered(12, true)`);
  alarmsCreated.length = 0;
  await run(`scheduleNextTransitionAlarm([], {}, {}, Date.now())`);
  check("the transition alarm fires when a pause pass ends", alarmsCreated.length === 1 && alarmsCreated[0].when === passUntil, alarmsCreated);
  const restarted = loadWorker();
  await vm.runInContext(`cbCoverStateReady`, restarted);
  check("a restarted worker still honours the pass", vm.runInContext(`[...cbPausePassedGroups(11, "news.example.com")].join()`, restarted) === "p1");
  check("…and still knows which tab it muted", vm.runInContext(`cbMutedTabs.has(12)`, restarted) === true);

  // 8. Push on change: open pages hear from the worker only when the state
  //    (which groups enforce, snooze phases, passes) or a definition changes.
  const pushes = () => context.__tabs.messages.filter(([, m]) => m && m.type === "session-refresh").length;
  await context.chrome.storage.local.set({ blockedGroups: sanitize([timed]), usageTimersMs: { t1: 0 }, groupSnoozes: {} });
  await run(`cbRecheckEnforcement()`);
  context.__tabs.messages.length = 0;
  await context.chrome.storage.local.set({ usageTimersMs: { t1: 60_000 } });
  let pushed = await run(`cbRecheckEnforcement()`);
  check("usage that changes no group's state pushes nothing", pushed === false && pushes() === 0, context.__tabs.messages);
  await context.chrome.storage.local.set({ usageTimersMs: { t1: 30 * 60_000 } });
  pushed = await run(`cbRecheckEnforcement()`);
  check("the allowance running out pushes to every open page", pushed === true && pushes() === 2, context.__tabs.messages);
  context.__tabs.messages.length = 0;
  pushed = await run(`cbRecheckEnforcement()`);
  check("…once: the same state again pushes nothing", pushed === false && pushes() === 0);
  pushed = await run(`cbRecheckEnforcement({ definitionChanged: true })`);
  check("an edited group definition pushes", pushed === true && pushes() === 2);
  context.__tabs.messages.length = 0;
  await context.chrome.storage.local.set({ groupSnoozes: { t1: { startsAtMs: Date.now() - 1000, untilMs: Date.now() + 600_000, cooldownUntilMs: Date.now() + 660_000 } } });
  pushed = await run(`cbRecheckEnforcement()`);
  check("a snooze starting pushes", pushed === true && pushes() === 2, context.__tabs.messages);

  // 9. Linked groups with the popup closed: the worker adopts the whole shared
  //    definition (settings AND entries) and the newest snooze change.
  const linked = base({ id: "L1", name: "Linked", groupType: "site", sites: ["old.example.com"] });
  const nowMs = Date.now();
  await context.chrome.storage.local.set({ blockedGroups: sanitize([linked]), groupSnoozes: {
    L1: { startsAtMs: nowMs - 60000, untilMs: nowMs + 600000, cooldownUntilMs: nowMs + 600000, confirmationCount: 0, activeMsApplied: false }
  } });
  context.__clusters = [{ groupName: "Linked", members: [
    { program: "chrome", groupName: "Linked", groupId: "L1" }, { program: "macapp", groupName: "Linked", groupId: "m1" }
  ], shared: {
    scalars: { pauseSeconds: 9 },
    scopes: [{ id: "site-1", surface: "site", platform: null, action: "block", sites: ["new.example.com"], sitesExcept: false }],
    snooze: { startsAtMs: nowMs - 60000, untilMs: nowMs - 1000, cooldownUntilMs: nowMs - 1000, changedAtMs: nowMs - 1000, activeMsApplied: true },
    snoozeTs: nowMs - 1000
  } }];
  run(`cbConnection.clusters = __clusters;`);
  await run(`cbConnection.applySharedToStorage()`);
  const after = (await context.chrome.storage.local.get("blockedGroups")).blockedGroups.find((g) => g.id === "L1");
  check("the worker adopts shared entries, not only settings", after.scopes.find((l) => l.surface === "site").sites.join() === "new.example.com" && after.pauseSeconds === 9, after);
  const snoozesAfter = (await context.chrome.storage.local.get("groupSnoozes")).groupSnoozes || {};
  check("a snooze ended on another device ends here too (its ended entry is kept as the latest change)",
    snoozesAfter.L1 && run(`CBGroupActions.snoozePhase(${JSON.stringify(snoozesAfter.L1)}, Date.now())`) === "none" && snoozesAfter.L1.changedAtMs === nowMs - 1000, snoozesAfter);
  // An older shared entry is not taken back over the ended one.
  context.__clusters[0].shared.snooze = { startsAtMs: nowMs - 60000, untilMs: nowMs + 600000, cooldownUntilMs: nowMs + 600000, changedAtMs: nowMs - 60000 };
  context.__clusters[0].shared.snoozeTs = nowMs - 60000;
  run(`cbConnection.clusters = __clusters;`);
  await run(`cbConnection.applySharedToStorage()`);
  const stillEnded = ((await context.chrome.storage.local.get("groupSnoozes")).groupSnoozes || {}).L1;
  check("an older snooze from the hub is never taken back after it ended", stillEnded && stillEnded.changedAtMs === nowMs - 1000, stillEnded);
  check("one list of shared settings; the lock is not among them (it travels as a versioned unit)",
    run("CB_SYNC_SCALAR_FIELDS").includes("pauseSeconds") &&
    !["lockedAtMs", "lockWaitHours", "parentalPasswordHash", "parentalPasswordSalt", "lockVersion"].some((f) => run("CB_SYNC_SCALAR_FIELDS").includes(f)) &&
    !run("CB_SYNC_SCALAR_FIELDS").includes("allowlist") && run("CB_SYNC_SCALAR_FIELDS") === run("CBGroupScopes.SYNC_SCALAR_FIELDS"));

  // 10. A lock stored before 2026-09-26 (exclusive modes) is kept, as gates.
  const kept = sanitize([base({ id: "k1", name: "Keep", groupType: "site", sites: ["x.example"], freezeMode: "strict", frozenAtMs: 1234, strictFreezeHours: 5 })])[0];
  check("an old strict lock stays locked, as a 5-hour wait gate", kept.lockedAtMs === 1234 && kept.lockWaitHours === 5 && !("freezeMode" in kept), kept);
  const linkedLock = sanitize([base({ id: "k2", name: "Keep 2", groupType: "site", sites: ["x.example"] })])[0];
  context.__clusters = [{ groupName: "Keep 2", members: [
    { program: "chrome", groupName: "Keep 2", groupId: "k2" }, { program: "macapp", groupName: "Keep 2", groupId: "m2" }
  ], shared: { scalars: {}, lock: { lockedAtMs: 777, lockWaitHours: 0, parentalPasswordHash: null, parentalPasswordSalt: null, lockVersion: 4 } } }];
  await context.chrome.storage.local.set({ blockedGroups: [linkedLock] });
  run(`cbConnection.clusters = __clusters;`);
  await run(`cbConnection.applySharedToStorage()`);
  const adopted = (await context.chrome.storage.local.get("blockedGroups")).blockedGroups.find((g) => g.id === "k2");
  check("the worker adopts the link's lock with its version", adopted.lockedAtMs === 777 && adopted.lockVersion === 4 && adopted.lockSyncedVersion === 4, adopted);

  // 11. An AI tool cannot create a locked group.
  const created = await run(`cbBrowserRequestBody("settings-create-group", { groupType: "site", patch: { name: "AI group", sites: ["ai.example"], lockedAtMs: Date.now(), lockWaitHours: 72, freezeMode: "strict" } })`);
  check("a created group never starts locked", created.group.lockedAtMs === null && created.group.lockWaitHours === 0, created.group);

  // 12. Tag lines act only where tagging exists.
  const tagFilters = (platform) => {
    context.__line = { id: "items-9", surface: "items", platform, action: "hide", tagFilter: { mode: "include", tags: [{ name: "Gaming" }] } };
    return run(`(() => { const f = []; pushTagFilterEntry(f, { id: "t9", scopes: [] }, __line, true); return f.length; })()`);
  };
  check("a tag line on YouTube filters; on Instagram (no tag pills) it is inert", tagFilters("youtube") === 1 && tagFilters("instagram") === 0);

  console.log(`PAGE EXIT TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
})();
