/* The tagging schedule (collection-info `tagging:false`): YouTube keeps
   collecting for History but injects no pill, and takes pills down when a
   window closes — the same gate the shared collector core applies. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function run({ tagging }) {
  const messages = [];
  const tagPresentations = [];
  const cleared = [];
  function element({ href = null, text = "", matchTags = [], query = {}, queryAll = {} } = {}) {
    return {
      nodeType: 1,
      parentElement: null,
      textContent: text,
      isConnected: true,
      getAttribute(name) { return name === "href" ? href : null; },
      matches(selector) { return typeof selector === "string" && matchTags.some((tag) => selector.indexOf(tag) !== -1); },
      closest() { return null; },
      querySelector(selector) { return query[selector] || null; },
      querySelectorAll(selector) { return queryAll[selector] || []; }
    };
  }
  const title = element({ text: "A scheduled video" });
  const video = element({ href: "/watch?v=dQw4w9WgXcQ" });
  const creator = element({ href: "/@VisibleCreator", text: "Visible Creator" });
  const feedCard = element({
    matchTags: ["ytd-video-renderer"],
    query: { "#video-title": title },
    queryAll: {
      'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [video],
      "a[href^='/@']": [creator],
      "a[href]": [creator]
    }
  });
  const document = { documentElement: {}, querySelector() { return null; }, querySelectorAll() { return [feedCard]; }, addEventListener() {} };
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        messages.push(message);
        if (message.type === "vault-classifier-collection-info") return callback({ ok: true, enabled: true, tagging });
        callback({ ok: true, accepted: true });
      }
    },
    storage: { local: { get(_key, callback) { callback({ globalSettings: {} }); } }, onChanged: { addListener() {} } }
  };
  const context = vm.createContext({
    chrome, console: { debug() {}, error() {} }, document,
    location: { href: "https://www.youtube.com/feed/subscriptions", pathname: "/feed/subscriptions" },
    MutationObserver: class { observe() {} },
    setTimeout, clearTimeout, setInterval() { return 0; }, TextEncoder, URL
  });
  context.window = context;
  context.globalThis = context;
  context.window.addEventListener = () => {};
  context.VaultClassifierTagUI = { observe(value) { tagPresentations.push(value); }, clearPlatform(platform) { cleared.push(platform); } };
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-youtube.js"), "utf8"), context, { filename: "vault-classifier-youtube.js" });
  return new Promise((resolve) => setTimeout(() => resolve({ messages, tagPresentations, cleared }), 700));
}

(async () => {
  const on = await run({ tagging: true });
  const off = await run({ tagging: false });
  const legacy = await run({ tagging: undefined });
  const collected = (r) => r.messages.some((m) => m.type === "vault-classifier-collect" && m.entry?.entryID === "youtube:video:dQw4w9WgXcQ");
  const checks = {
    "tagging on: the card is collected AND pilled": collected(on) && on.tagPresentations.length === 1,
    "tagging off (schedule window closed): collected for History, NO pill": collected(off) && off.tagPresentations.length === 0,
    "an older app that sends no `tagging` field still pills (default on)": collected(legacy) && legacy.tagPresentations.length === 1
  };
  let failed = false;
  for (const [label, ok] of Object.entries(checks)) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed = true; }
  if (failed) { console.error({ on: on.tagPresentations.length, off: off.tagPresentations.length, legacy: legacy.tagPresentations.length }); console.log("__CB_TEST_RESULT__: FAIL"); process.exitCode = 1; return; }
  console.log("__CB_TEST_RESULT__: OK");
})();
