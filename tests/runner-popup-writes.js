/* What the editor writes (owner 2026-09-26): only what the user changed. It
   writes the groups it edited, by id, into the stored list as it is now; it
   never rewrites other groups, their lines or the runtime state (usage,
   snooze counting, links — the service worker / Mac Vault own those), and a
   change made elsewhere shows at once under the user's unsaved field edits.
   Boots popup.js under the inert DOM of runner-popup-boot.js. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const storage = new Map();
const inertFn = () => new Proxy(function () {}, { get: (_t, p) => (p === "then" ? undefined : inertFn()), apply: () => undefined });
function makeElement(id) {
  const listeners = [];
  const el = {
    id: id || "", tagName: "DIV", value: "", checked: false, disabled: false, hidden: false, textContent: "", innerHTML: "", innerText: "",
    style: new Proxy({}, { get: (t, p) => (p in t ? t[p] : (typeof p === "string" ? "" : undefined)), set: (t, p, v) => { t[p] = v; return true; } }),
    dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, attributes: [],
    children: [], childNodes: [], firstChild: null, lastChild: null, parentElement: null, parentNode: null, nextElementSibling: null,
    addEventListener: (type, fn) => listeners.push({ type, fn }), removeEventListener() {}, dispatchEvent: () => true,
    appendChild: (c) => c, removeChild: (c) => c, insertBefore: (c) => c, replaceChildren() {}, remove() {}, append() {}, prepend() {}, after() {}, before() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false, toggleAttribute() {},
    querySelector: () => makeElement(), querySelectorAll: () => [], closest: () => null, contains: () => false, matches: () => false,
    focus() {}, blur() {}, click() {}, select() {}, scrollIntoView() {}, getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }),
    getContext: () => null, cloneNode: () => makeElement(), insertAdjacentHTML() {}, insertAdjacentElement: (p, e) => e, replaceWith() {},
    options: [], selectedIndex: 0, add() {}, scrollTop: 0, scrollHeight: 0, clientHeight: 0, offsetHeight: 0, offsetWidth: 0, ownerDocument: null
  };
  return el;
}
const elements = new Map();
const documentStub = {
  documentElement: makeElement("html"), body: makeElement("body"), head: makeElement("head"),
  readyState: "complete", title: "", hidden: false, visibilityState: "visible", activeElement: null,
  getElementById: (id) => { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); },
  querySelector: () => makeElement(), querySelectorAll: () => [], createElement: (tag) => { const e = makeElement(); e.tagName = String(tag).toUpperCase(); return e; },
  createTextNode: (t) => ({ textContent: t }), createDocumentFragment: () => makeElement(),
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true, execCommand: () => false, hasFocus: () => false
};
const chrome = new Proxy({
  storage: {
    local: {
      get: (keys, cb) => { const out = {}; if (keys && typeof keys === "object" && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; else for (const k of [].concat(keys || [])) if (storage.has(k)) out[k] = storage.get(k); if (cb) cb(out); return Promise.resolve(out); },
      set: (obj, cb) => { for (const [k, v] of Object.entries(obj)) storage.set(k, JSON.parse(JSON.stringify(v))); if (cb) cb(); return Promise.resolve(); },
      remove: () => Promise.resolve()
    },
    session: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
    onChanged: { addListener() {}, removeListener() {} }
  },
  runtime: new Proxy({ id: "t", getManifest: () => ({ version: "0" }), getURL: (p) => `chrome-extension://t/${p}`, lastError: null, sendMessage: (m, cb) => { if (typeof cb === "function") cb({ ok: true }); return Promise.resolve({ ok: true }); } }, { get: (t, p) => (p in t ? t[p] : inertFn()) }),
  i18n: { getMessage: () => "", getUILanguage: () => "en" }
}, { get: (t, p) => (p in t ? t[p] : inertFn()) });

const errors = [];
const context = vm.createContext({
  chrome, document: documentStub, console: { log() {}, warn() {}, error: (...a) => errors.push("console.error " + a.map(String).join(" ").slice(0, 200)), debug() {}, info() {} },
  setTimeout: (fn) => { try { fn(); } catch (e) { errors.push("timer: " + e.message); } return 1; }, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
  requestAnimationFrame: (fn) => { try { fn(); } catch (e) { errors.push("raf: " + e.message); } return 1; }, cancelAnimationFrame() {},
  MutationObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { language: "en-US", languages: ["en-US"], clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve("") }, userAgent: "Chrome/999", userAgentData: { brands: [{ brand: "Google Chrome", version: "999" }] } },
  location: { href: "chrome-extension://t/popup.html", search: "", hash: "", hostname: "t", pathname: "/popup.html", origin: "chrome-extension://t" },
  URL, URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto, fetch: () => Promise.reject(new Error("offline")),
  indexedDB: { open: () => ({ addEventListener() {} }) }, structuredClone: (v) => JSON.parse(JSON.stringify(v)),
  atob: (s) => Buffer.from(s, "base64").toString("binary"), btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  getComputedStyle: () => ({ getPropertyValue: () => "" }), matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }, Event: class { constructor(type) { this.type = type; } },
  KeyboardEvent: class {}, HTMLElement: class {}, Node: class {}, Blob: class {}, FileReader: class {}, Image: class {}, performance: { now: () => 0 }
});
context.window = context; context.self = context; context.globalThis = context;
context.addEventListener = () => {}; context.removeEventListener = () => {}; context.dispatchEvent = () => true;


// The store before the editor opens: a site group that also names YouTube,
// and a custom group with a site list.
const SEED = [
  { id: "a1", name: "Focus", groupType: "site", enabled: true, mode: "instant", allowedMinutes: 15, resetIntervalHours: 24,
    activeDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], timeWindowsText: "",
    scopes: [
      { id: "site-1", surface: "site", platform: null, action: "block", sites: ["news.example.com"], sitesExcept: false },
      { id: "items-1", surface: "items", platform: "youtube", action: "hide", form: "all", sourceMode: "include", sources: ["somecreator"], tagFilter: null }
    ] },
  { id: "c1", name: "Rule", groupType: "custom", enabled: true, mode: "instant", blockingRulesText: "(m,d,n,h,mi,u,helpers) => false",
    activeDays: ["monday"], timeWindowsText: "",
    scopes: [{ id: "site-1", surface: "site", platform: null, action: "block", sites: ["rule.example.com"], sitesExcept: false }] }
];
storage.set("blockedGroups", JSON.parse(JSON.stringify(SEED)));

// Same script order as popup.html.
const html = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
let fatal = null;
for (const file of scripts) {
  try { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
  catch (e) { fatal = `${file}: ${e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e}`; break; }
}
let pass = 0; let fail = 0;
const check = (label, ok, detail) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — ${JSON.stringify(detail)}`); } };
const run = (code) => vm.runInContext(code, context);
const stored = () => storage.get("blockedGroups");
const byId = (id) => stored().find((g) => g.id === id);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  check("the popup boots", fatal === null, fatal);
  await run("loadGroups()");
  check("the editor loaded the store", run("state.groups.length") === 2, run("state.groups.length"));
  check("opening the editor writes nothing", same(stored(), SEED), stored());
  const seededC1 = JSON.stringify(byId("c1"));
  const seededLines = JSON.stringify(byId("a1").scopes);

  // A policy edit on one group.
  run(`state.selectedGroupId = "a1"; state.drafts.a1 = { allowedMinutes: "20", mode: "after-minutes" };`);
  await run("autosaveSelectedGroup()");
  check("the edited field is saved", byId("a1").allowedMinutes === 20 && byId("a1").mode === "after-minutes", byId("a1"));
  check("its lines are untouched (no empty lines, no reordering)", JSON.stringify(byId("a1").scopes) === seededLines, byId("a1").scopes);
  check("the other group is untouched", JSON.stringify(byId("c1")) === seededC1, byId("c1"));
  check("no runtime state is written", !storage.has("usageTimersMs") && !storage.has("groupSnoozes") && !storage.has("groupSnoozeTotalsMs"), [...storage.keys()]);
  check("the draft is gone once saved", run("!state.drafts.a1"));

  // Viewing another entry keeps the stored type.
  await run(`setGroupPlatformView("youtube")`);
  check("viewing the YouTube entry keeps the stored type", byId("a1").groupType === "site", byId("a1").groupType);
  run(`state.drafts.a1 = { snoozeMinutes: "12" };`);
  await run("autosaveSelectedGroup()");
  check("…also after a save from that view", byId("a1").groupType === "site" && byId("a1").snoozeMinutes === 12, byId("a1"));

  // A change made elsewhere shows at once; the unsaved edit stays on top.
  run(`state.drafts.a1 = { allowedMinutes: "25" };`);
  const outside = JSON.parse(JSON.stringify(stored()));
  outside.find((g) => g.id === "c1").name = "Rule (renamed elsewhere)";
  outside.find((g) => g.id === "a1").snoozeMinutes = 40;
  storage.set("blockedGroups", outside);
  run(`syncExternalState(${JSON.stringify({ blockedGroups: { newValue: outside } })})`);
  check("an outside change shows", run(`state.groups.find((g) => g.id === "c1").name`) === "Rule (renamed elsewhere)");
  check("the unsaved edit survives it", run(`state.drafts.a1 && state.drafts.a1.allowedMinutes`) === "25");
  await run("autosaveSelectedGroup()");
  check("saving keeps the outside change of another field", byId("a1").allowedMinutes === 25 && byId("a1").snoozeMinutes === 40, byId("a1"));
  check("…and of the other group", byId("c1").name === "Rule (renamed elsewhere)", byId("c1"));

  // A custom group keeps its site list.
  run(`state.selectedGroupId = "c1"; state.drafts.c1 = { blockingRulesText: "(m,d,n,h,mi,u,helpers) => true" };`);
  await run("autosaveSelectedGroup()");
  check("a custom group's rule is saved and its site list kept", byId("c1").blockingRulesText.endsWith("=> true") && same(byId("c1").scopes, JSON.parse(seededC1).scopes), byId("c1"));

  // A rename is saved when it is finished.
  run(`state.selectedGroupId = "a1"; state.nameEditing = { id: "a1", name: "Focus" }; state.drafts.a1 = { name: "Foc" };`);
  await run("autosaveSelectedGroup()");
  check("a half-typed name is not saved", byId("a1").name === "Focus", byId("a1").name);
  run(`state.drafts.a1 = { name: "Focus time" };`);
  await run("commitNameEdit()");
  check("the finished name is", byId("a1").name === "Focus time", byId("a1").name);

  // A deleted group leaves the list; the others stay as stored.
  const before = JSON.stringify(byId("a1"));
  run(`state.selectedGroupId = "c1";`);
  await run("deleteSelectedGroup()");
  check("delete writes the list without it", !byId("c1") && JSON.stringify(byId("a1")) === before, stored());

  console.log(`POPUP WRITES TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
})().catch((error) => { console.log("FAIL harness —", error && error.stack); console.log("__CB_TEST_RESULT__: FAIL"); process.exitCode = 1; });
