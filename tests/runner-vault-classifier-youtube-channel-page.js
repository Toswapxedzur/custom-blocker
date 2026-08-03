/* Regression test: on a channel/author page, video cards omit the per-card
 * creator link, so the pill must use the page owner (from URL + canonical). */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const tagPresentations = [];
const errors = [];

function element({ href = null, text = "", query = {}, queryAll = {} } = {}) {
  return {
    textContent: text,
    getAttribute(name) { return name === "href" ? href : null; },
    matches() { return false; },
    closest() { return null; },
    querySelector(selector) { return query[selector] || null; },
    querySelectorAll(selector) { return queryAll[selector] || []; }
  };
}

const title = element({ text: "A video on the channel page" });
const video = element({ href: "/watch?v=dQw4w9WgXcQ" });
// A channel-page grid card: a title and video link, but NO creator link.
const card = element({
  query: { "#video-title": title },
  queryAll: {
    'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [video],
    "#metadata-line span": [],
    "a[href*='/channel/UC']": [],
    "a[href^='/@']": [],
    "a[href]": []
  }
});
const canonical = element({ href: "https://www.youtube.com/channel/UCchannelpage1234567890a" });

const document = {
  documentElement: {},
  querySelector(selector) { return selector === 'link[rel="canonical"]' ? canonical : null; },
  querySelectorAll() { return [card]; },
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
  // A channel/author page URL.
  location: { href: "https://www.youtube.com/@somechannel/videos", pathname: "/@somechannel" },
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
  const observed = tagPresentations.find((value) => value.sourceID);
  const passes = Boolean(
    observed
    // Channel-first page identity from the canonical link, anchored to the title.
    && observed.sourceID === "youtube:channel:UCchannelpage1234567890a"
    && observed.anchor === title
    && errors.length === 0
  );
  if (passes) {
    console.log("PASS renders the page owner's tag on channel-page cards with no per-card creator link");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL channel-page owner fallback", { observed, errors });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 500);
