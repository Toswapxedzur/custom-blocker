/* The popup must run to completion at load. A stale identifier anywhere in
   popup.js (a removed field's element, a renamed helper) throws once at
   start-up and leaves the editor empty; node --check cannot see that, so this
   boots popup.js under a minimal inert DOM and fails on any exception. */
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

// Same script order as popup.html.
const html = fs.readFileSync(path.join(root, "popup.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
let fatal = null;
for (const file of scripts) {
  try { vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }); }
  catch (e) { fatal = `${file}: ${e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e}`; break; }
}
let pass = 0; let fail = 0;
const check = (label, ok, detail) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — ${detail}`); } };
check(`popup scripts load without throwing (${scripts.join(", ")})`, fatal === null, fatal);
check("no console.error during boot", errors.length === 0, errors.slice(0, 3).join("\n"));
console.log(`POPUP BOOT TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
