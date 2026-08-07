/* Regression test: cards are injected in FEED (Y) ORDER — top-of-feed first —
 * regardless of their DOM/discovery order, so pills fill top-to-bottom. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const tagPresentations = [];
const errors = [];

function element({ href = null, text = "", matchTags = [], top = 0, query = {}, queryAll = {} } = {}) {
  return {
    nodeType: 1,
    parentElement: null,
    textContent: text,
    getAttribute(name) { return name === "href" ? href : null; },
    matches(selector) { return typeof selector === "string" && matchTags.some((tag) => selector.indexOf(tag) !== -1); },
    closest() { return null; },
    getBoundingClientRect() { return { top }; },
    querySelector(selector) { return query[selector] || null; },
    querySelectorAll(selector) { return queryAll[selector] || []; }
  };
}

function card(handle, top) {
  const link = element({ href: `/@${handle}` });
  const watch = element({ href: "/watch?v=dQw4w9WgXcQ" });
  return element({
    matchTags: ["ytd-video-renderer"],
    top,
    query: { "#video-title": element({ text: `Title ${handle}` }) },
    queryAll: {
      'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [watch],
      "#metadata-line span": [],
      "a[href^='/@']": [link],
      "a[href]": [link]
    }
  });
}

// DOM order (A, B, C) deliberately differs from vertical order: B is highest
// (top 50), then C (150), then A (300).
const cardA = card("creatorA", 300);
const cardB = card("creatorB", 50);
const cardC = card("creatorC", 150);

const document = {
  documentElement: {},
  querySelector() { return null; },
  querySelectorAll() { return [cardA, cardB, cardC]; },
  addEventListener() {}
};

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      if (message.type === "vault-classifier-collection-info") return callback({ ok: true, enabled: true });
      return callback({ ok: true, accepted: true });
    }
  },
  storage: { local: { get(_k, cb) { cb({ globalSettings: { debugMode: false } }); } }, onChanged: { addListener() {} } }
};

const context = vm.createContext({
  chrome,
  console: { debug() {}, error(error) { errors.push(error); } },
  document,
  location: { href: "https://www.youtube.com/", pathname: "/" },
  MutationObserver: class { observe() {} },
  setTimeout,
  clearTimeout,
  setInterval() { return 0; },
  TextEncoder,
  URL
});
context.window = context;
context.globalThis = context;
context.window.addEventListener = () => {};
context.VaultClassifierTagUI = { observe(value) { tagPresentations.push(value); }, clearPlatform() {} };

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-youtube.js"), "utf8"), context, { filename: "vault-classifier-youtube.js" });

setTimeout(() => {
  const order = tagPresentations.map((value) => value.sourceID);
  // Top-of-feed first: B (50), then C (150), then A (300) — NOT DOM order A,B,C.
  const passes = JSON.stringify(order) === JSON.stringify([
    "youtube:handle:@creatorb",
    "youtube:handle:@creatorc",
    "youtube:handle:@creatora"
  ]) && errors.length === 0;

  if (passes) {
    console.log("PASS injects cards top-of-feed first, regardless of DOM order");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL youtube y-order", { order, errors });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 500);
