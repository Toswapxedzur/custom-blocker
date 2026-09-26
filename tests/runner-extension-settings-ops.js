/* The extension's settings over the hub (Mac Vault MCP → browser-request →
   service worker). Loads the REAL background.js under a stubbed chrome.* so the
   writes go through the same sanitizers the popup's saves use. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const storage = new Map();
const sessionStore = new Map();
const listeners = { storage: [] };
function storageGet(keys) {
  const out = {};
  if (typeof keys === "string") { if (storage.has(keys)) out[keys] = storage.get(keys); }
  else if (Array.isArray(keys)) { for (const k of keys) if (storage.has(k)) out[k] = storage.get(k); }
  else if (keys && typeof keys === "object") { for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; }
  else { for (const [k, v] of storage) out[k] = v; }
  return out;
}
function makeCallable(name) {
  const fn = (...args) => {
    const cb = args[args.length - 1];
    if (typeof cb === "function") { try { cb(); } catch (_) {} return undefined; }
    return Promise.resolve(undefined);
  };
  return fn;
}
// Deep stub: any chrome namespace/method exists and is inert, except storage.local.
const inert = new Proxy({}, { get: (_t, prop) => (prop === "addListener" || prop === "removeListener" || prop === "hasListener") ? () => {} : (typeof prop === "string" ? inertValue(prop) : undefined) });
function inertValue(prop) {
  const fn = makeCallable(prop);
  return new Proxy(fn, { get: (_t, p) => (p === "addListener" || p === "removeListener" || p === "hasListener") ? () => {} : (typeof p === "string" && p !== "then" ? inertValue(p) : undefined) });
}
const chrome = new Proxy({
  storage: {
    local: {
      get: (keys, cb) => { const r = storageGet(keys); if (typeof cb === "function") { cb(r); return; } return Promise.resolve(r); },
      set: (obj, cb) => { for (const [k, v] of Object.entries(obj)) storage.set(k, JSON.parse(JSON.stringify(v))); if (typeof cb === "function") { cb(); return; } return Promise.resolve(); },
      remove: (keys, cb) => { for (const k of [].concat(keys)) storage.delete(k); if (typeof cb === "function") { cb(); return; } return Promise.resolve(); },
      getBytesInUse: () => Promise.resolve(0)
    },
    session: {
      get: (defaults) => { const out = {}; for (const [k, d] of Object.entries(defaults || {})) out[k] = sessionStore.has(k) ? JSON.parse(JSON.stringify(sessionStore.get(k))) : d; return Promise.resolve(out); },
      set: (obj) => { for (const [k, v] of Object.entries(obj)) sessionStore.set(k, JSON.parse(JSON.stringify(v))); return Promise.resolve(); },
      remove: () => Promise.resolve()
    },
    sync: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
    onChanged: { addListener: (fn) => listeners.storage.push(fn), removeListener() {}, hasListener: () => false }
  },
  runtime: { id: "test-extension", getManifest: () => ({ version: "0.0.0" }), getURL: (p) => `chrome-extension://test/${p}`, lastError: null, onMessage: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onConnect: { addListener() {} }, onSuspend: { addListener() {} }, sendMessage: () => Promise.resolve(), connect: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener() {} }, postMessage() {} }) }
}, { get: (target, prop) => (prop in target ? target[prop] : (typeof prop === "string" ? inertValue(prop) : undefined)) });

const context = vm.createContext({
  chrome,
  console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
  TextEncoder, TextDecoder, URL, URLSearchParams, crypto: globalThis.crypto, fetch: () => Promise.reject(new Error("offline")),
  WebSocket: class { constructor() { this.readyState = 3; } close() {} send() {} },
  importScripts() {},
  location: { href: "chrome-extension://test/background.js" },
  navigator: { userAgent: "Chrome/999", userAgentData: { brands: [{ brand: "Google Chrome", version: "999" }] } },
  Intl, Date, Math, JSON, Promise, Map, Set, WeakMap, WeakSet, Symbol, Proxy, Reflect, Object, Array, String, Number, Boolean, RegExp, Error, TypeError, RangeError,
  structuredClone: (v) => JSON.parse(JSON.stringify(v)),
  atob: (s) => Buffer.from(s, "base64").toString("binary"), btoa: (s) => Buffer.from(s, "binary").toString("base64")
});
context.self = context; context.globalThis = context; context.window = context;
for (const file of ["platform-profiles.js", "group-scopes.js", "parental-pin.js", "group-actions.js", "helpers.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"]) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) continue;
  try { vm.runInContext(fs.readFileSync(p, "utf8"), context, { filename: file }); }
  catch (error) { console.error(`load ${file}:`, error.message); }
}

// Stored groups are canonical (policy + scope lines); read them back through
// the same flattening the popup uses.
const flatOf = (group) => vm.runInContext("(g) => CBGroupScopes.flatFromScopes(g)", context)(group);
const sent = [];
const connection = { sendWS(frame) { sent.push(frame); return true; }, routeIsReady: () => true };
async function op(operation, body) {
  sent.length = 0;
  await context.cbHandleBrowserRequest(connection, { kind: "browser-request", requestID: "r-" + operation, operation, body });
  await new Promise((r) => setTimeout(r, 20));
  const frame = sent.find((f) => f.kind === "browser-response");
  return frame;
}

(async () => {
  let pass = 0, fail = 0;
  const check = (label, ok, detail) => { if (ok) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label}${detail ? " — " + JSON.stringify(detail).slice(0, 300) : ""}`); } };

  const initial = await op("settings-get", {});
  check("settings-get answers with groups, classifier settings and the op list", initial?.body && Array.isArray(initial.body.groups) && initial.body.classifierSettings?.taggingMode === "whenFiltering" && initial.body.operations.includes("settings-set-group"), initial);

  const created = await op("settings-create-group", { groupType: "twitter", patch: { name: "X tags", platformTagMode: "include", platformTags: [{ name: "Gaming", confidence: 3 }, { name: "Sports" }], platformTagCoverUntilTagged: true } });
  const g = created?.body?.group;
  check("create-group builds a sanitized X group from the popup's defaults + patch", g && flatOf(g) && Array.isArray(g.scopes) && g.groupType === "twitter" && g.name === "X tags" && g.enabled === true && flatOf(g).platformTagMode === "include" && flatOf(g).platformTags?.length === 2 && flatOf(g).platformTags[0].confidence === 3 && flatOf(g).platformTagCoverUntilTagged === true && flatOf(g).platformTagBlockPage === true, created);
  const stored = storage.get("blockedGroups") || [];
  check("the new group is persisted where the popup reads it", stored.some((x) => x.id === g?.id));

  const bad = await op("settings-create-group", { groupType: "myspace" });
  check("an unknown group type is refused", bad?.error === "unknown-group-type", bad);

  const patched = await op("settings-set-group", { id: g.id, patch: { enabled: false, platformTags: [{ name: "Music" }], id: "hijack", lockedAtMs: 5, freezeMode: "strict" } });
  const p = patched?.body?.group;
  check("set-group patches through the sanitizer and never changes the id or the lock", p && p.id === g.id && p.enabled === false && flatOf(p).platformTags?.[0]?.name === "Music" && p.lockedAtMs === null, patched);

  // Sources (owner 2026-09-24): creators, accounts and subreddits share one
  // field pair; the legacy pairs are read once and never written back.
  const legacyReddit = await op("settings-create-group", { groupType: "reddit", patch: { name: "Legacy reddit", redditMode: "include", redditSubreddits: ["r/Focus", "https://www.reddit.com/r/programming/"] } });
  const lr = legacyReddit?.body?.group;
  check("a legacy Reddit patch migrates to sources/sourceMode", lr && flatOf(lr).sourceMode === "include" && JSON.stringify(flatOf(lr).sources) === JSON.stringify(["focus", "programming"]) && !("redditSubreddits" in lr) && !("redditMode" in lr), lr);
  const legacyAuthors = await op("settings-create-group", { groupType: "youtube", patch: { name: "Legacy authors", platformAuthorMode: "exclude", platformAuthors: ["@someone"] } });
  const la = legacyAuthors?.body?.group;
  check("a legacy author patch migrates to sources/sourceMode", la && flatOf(la).sourceMode === "exclude" && flatOf(la).sources.length === 1 && !("platformAuthors" in la) && !("platformAuthorMode" in la), la);
  const modern = await op("settings-set-group", { id: la.id, patch: { sourceMode: "include", sources: ["@other"] } });
  check("the new pair patches directly", modern?.body?.group && flatOf(modern.body.group).sourceMode === "include" && flatOf(modern.body.group).sources.length === 1, modern);

  // The group-level "allow" exception effect is gone (owner 2026-09-24); a
  // stored exception group is kept but disabled, never turned into a block.
  const legacyAllow = await op("settings-create-group", { groupType: "youtube", patch: { name: "Old exception", enabled: true, effect: "allow" } });
  const oa = legacyAllow?.body?.group;
  check("a legacy allow-effect group comes back disabled and without the field", oa && oa.enabled === false && !("effect" in oa), oa);

  // Scope lines (phase 1): a stored group carries policy + scopes, no flat scope
  // fields; a new-style patch may send scopes directly.
  check("stored groups carry scope lines and no flat scope fields", g && Array.isArray(g.scopes) && g.scopes.some((line) => line.surface === "items" && line.tagFilter) && !("platformTags" in g) && !("sources" in g), g && Object.keys(g));
  const scoped = await op("settings-set-group", { id: la.id, patch: { scopes: [{ surface: "items", platform: "youtube", form: "short", sourceMode: "include", sources: ["@a", "@b"], action: "hide" }, { surface: "home", platform: "youtube", action: "block" }, { surface: "shelf", platform: "youtube", shelf: "shorts-button", action: "dim" }] } });
  const sg = scoped?.body?.group;
  check("a scopes patch is sanitized line by line (illegal action corrected, ids assigned)", sg && sg.scopes.length === 3 && sg.scopes[0].surface === "items" && sg.scopes[0].form === "short" && sg.scopes[0].sources.length === 2 && sg.scopes[2].action === "hide" && sg.scopes.every((line) => typeof line.id === "string" && line.id), sg && sg.scopes);
  check("the flat view of a scoped group reads back the lines", sg && flatOf(sg).sourceMode === "include" && flatOf(sg).platformVideoMode === "short" && flatOf(sg).blockHomePage === true && JSON.stringify(flatOf(sg).surfaceHides) === JSON.stringify(["shorts-button"]), sg && flatOf(sg));

  const missing = await op("settings-set-group", { id: "nope", patch: { enabled: true } });
  check("patching an unknown group fails", missing?.error === "group-not-found", missing);

  // Freeze the group the way the popup would, then confirm MCP cannot touch it.
  const groups = storage.get("blockedGroups"); groups.find((x) => x.id === g.id).lockedAtMs = Date.now(); storage.set("blockedGroups", groups);
  const locked = await op("settings-set-group", { id: g.id, patch: { enabled: true } });
  const lockedDelete = await op("settings-delete-group", { id: g.id });
  check("a frozen group refuses patch and delete (parity with the popup)", locked?.error === "group-locked" && lockedDelete?.error === "group-locked", { locked, lockedDelete });
  groups.find((x) => x.id === g.id).lockedAtMs = null; storage.set("blockedGroups", groups);

  const mode = await op("settings-set-classifier", { taggingMode: "always" });
  check("set-classifier writes the tagging mode the bridge reads", mode?.body?.classifierSettings?.taggingMode === "always" && storage.get("vaultClassifierSettings")?.taggingMode === "always", mode);
  const badMode = await op("settings-set-classifier", { taggingMode: "sometimes" });
  check("an unknown tagging mode is refused", badMode?.error === "invalid-tagging-mode", badMode);

  const deleted = await op("settings-delete-group", { id: g.id });
  check("delete-group removes the group", deleted?.body?.deleted === g.id && !(storage.get("blockedGroups") || []).some((x) => x.id === g.id), deleted);

  const global = await op("settings-set-global", { patch: { debugMode: true, tickRateMs: 5 } });
  check("set-global sanitizes like the popup (debug on, tick rate clamped)", global?.body?.globalSettings?.debugMode === true && global.body.globalSettings.tickRateMs === 100 && storage.get("globalSettings")?.debugMode === true, global);
  const globalOff = await op("settings-set-global", { patch: { debugMode: false } });
  check("set-global turns debug off again", globalOff?.body?.globalSettings?.debugMode === false, globalOff);

  // Lock / unlock / move: the popup's own gates (owner 2026-09-26).
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const mk = async (name) => (await op("settings-create-group", { groupType: "site", patch: { name, sites: ["a.example"], activeDays: days } })).body.group.id;
  const [a, b, c] = [await mk("Lock A"), await mk("Lock B"), await mk("Lock C")];
  await op("settings-set-global", { patch: { defaultSnoozeMinutes: 7 } });
  const unnamed1 = (await op("settings-create-group", { groupType: "site" }))?.body?.group;
  const unnamed2 = (await op("settings-create-group", { groupType: "site" }))?.body?.group;
  check("unnamed tool-created groups get free numbered names, like the editor's", unnamed1 && unnamed2 && unnamed1.name !== unnamed2.name && / 2$/.test(unnamed2.name), [unnamed1?.name, unnamed2?.name]);
  check("…and the user's default snooze length", unnamed1?.snoozeMinutes === 7, unnamed1?.snoozeMinutes);
  const dup = await op("settings-create-group", { groupType: "site", patch: { name: "lock a" } });
  check("a name another group has (any case) is refused", dup?.error === "duplicate-name", dup);

  const stored_ = (id) => storage.get("blockedGroups").find((x) => x.id === id);
  // The confirmation needs 5 s between steps: age the pending step instead of waiting.
  const age = (id) => { const r = sessionStore.get("cbUnlockRequests"); r[id].confirm.nextAtMs = 0; sessionStore.set("cbUnlockRequests", r); };
  const confirmAll = async (id) => {
    let last = null;
    for (let i = 0; i < 10; i += 1) { age(id); last = await op("settings-unlock-group", { id, confirm: true }); }
    return last;
  };

  const frozen = await op("settings-lock-group", { id: a });
  check("lock-group freezes a group (no gates: only the confirmation)", Number.isFinite(frozen?.body?.group?.lockedAtMs) && Number.isFinite(stored_(a).lockedAtMs), frozen);
  check("a frozen group's patch/move is refused", (await op("settings-move-group", { id: a, index: 0 }))?.error === "group-locked");
  const looser = await op("settings-lock-group", { id: a, waitHours: 0 });
  check("the lock call on a frozen group only tightens (same wait is a no-op)", looser?.body?.group?.lockedAtMs === stored_(a).lockedAtMs, looser);
  const ask = await op("settings-unlock-group", { id: a });
  check("unlocking first asks: 10 confirmations, 5 s apart", ask?.body?.unlocked === false && ask.body.confirmationsLeft === 10 && ask.body.confirmAfterSeconds === 5, ask);
  const early = await op("settings-unlock-group", { id: a, confirm: true });
  check("…a confirmation inside the 5 s is refused", /^confirm-wait:/.test(early?.error || ""), early);
  age(a);
  const one = await op("settings-unlock-group", { id: a, confirm: true });
  check("…each confirmation counts one step", one?.body?.unlocked === false && one.body.confirmationsLeft === 9, one);
  let confirmed = null;
  for (let i = 0; i < 9; i += 1) { age(a); confirmed = await op("settings-unlock-group", { id: a, confirm: true }); }
  check("…and the tenth unlocks", confirmed?.body?.unlocked === true && stored_(a).lockedAtMs === null, confirmed);

  const waitLock = await op("settings-lock-group", { id: b, waitHours: 2 });
  check("a wait gate takes its hours", waitLock?.body?.group?.lockWaitHours === 2, waitLock);
  check("a frozen lock can be made stricter (a longer wait)", (await op("settings-lock-group", { id: b, waitHours: 5 }))?.body?.group?.lockWaitHours === 5);
  check("…never looser", (await op("settings-lock-group", { id: b, waitHours: 1 }))?.error === "not-stricter");
  check("wait hours above 72 are refused", (await op("settings-lock-group", { id: c, waitHours: 100 }))?.error?.startsWith("invalid-wait-hours"));
  const strictNow = await op("settings-unlock-group", { id: b, confirm: true });
  check("a wait gate does not open before its hours", /^strict-wait:/.test(strictNow?.error || ""), strictNow);

  const pinLock = await op("settings-lock-group", { id: c, pin: "482915", waitHours: 0 });
  check("a PIN given to the lock becomes its PIN gate (never returned)", Number.isFinite(pinLock?.body?.group?.lockedAtMs) && pinLock.body.group.hasParentalPin === true && !("parentalPasswordHash" in pinLock.body.group), pinLock);
  const wrong = await op("settings-unlock-group", { id: c, pin: "000000" });
  check("a wrong PIN is refused with the 1 s wait", wrong?.error === "pin-wrong:1", wrong);
  const waiting = await op("settings-unlock-group", { id: c, pin: "482915" });
  check("…inside the wait even the right PIN is not checked", waiting?.error === "pin-wait:1", waiting);
  await new Promise((r) => setTimeout(r, 1100));
  const pinOk = await op("settings-unlock-group", { id: c, pin: "482915" });
  check("…after the wait the right PIN starts the confirmation (always there)", pinOk?.body?.unlocked === false && pinOk.body.confirmationsLeft === 10, pinOk);
  const opened = await confirmAll(c);
  check("…and the confirmation unlocks", opened?.body?.unlocked === true && stored_(c).lockedAtMs === null && stored_(c).parentalPasswordHash, opened);

  const order = storage.get("blockedGroups").map((x) => x.id);
  const moved = await op("settings-move-group", { id: c, index: 0 });
  check("move-group reorders, like a drag", moved?.body?.order?.[0] === c && moved.body.order.length === order.length, moved);
  check("an index outside the list is refused", /^invalid-index/.test((await op("settings-move-group", { id: c, index: 99 }))?.error || ""));

  const retry = await op("settings-set-global", { patch: { closeRetrySeconds: 30 } });
  check("set-global takes the close-retry seconds (default 0)", retry?.body?.globalSettings?.closeRetrySeconds === 30 && (await op("settings-set-global", { patch: { closeRetrySeconds: -4 } }))?.body?.globalSettings?.closeRetrySeconds === 0, retry);

  const popupSource = fs.readFileSync(path.join(root, "popup.js"), "utf8");
  check("the tools and the popup take the confirmation from the same place",
    /UNFREEZE_CONFIRMATIONS_REQUIRED = CBGroupActions\.CONFIRMATIONS/.test(popupSource) &&
    vm.runInContext("CBGroupActions.CONFIRMATIONS", context) === 10 && vm.runInContext("CBGroupActions.CONFIRM_INTERVAL_MS", context) === 5000);

  const unknown = await op("settings-explode", {});
  check("an unsupported operation is answered, not dropped", unknown?.error === "unsupported-operation", unknown);

  console.log(`EXTENSION-SETTINGS TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail ? "__CB_TEST_RESULT__: FAIL" : "__CB_TEST_RESULT__: OK");
  if (fail) process.exitCode = 1;
})();
