/* Regression test: a YouTube Shorts-shelf card is creator-less by nature (no
 * channel link, no byline). It used to get no pill and was never tagged. Now a
 * Shorts card is pilled per-video (the `:collab:` synthetic-creator scheme), so
 * a whole content type becomes taggable — while a normal card that is merely
 * waiting for its author link to hydrate still gets no premature pill. */
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

const shortsId = "aBcShort123";
const title = element({ text: "Cat does a backflip #shorts" });
const video = element({ href: `/shorts/${shortsId}` });

// A Shorts card: matches the shorts renderer selector, has a /shorts/ link, and
// exposes NO channel link and NO collaborator byline.
const card = element({
  query: { "#video-title": title },
  queryAll: {
    'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [video],
    "#metadata-line span": [],
    "#channel-name a[href*='/channel/UC']": [], "ytd-channel-name a[href*='/channel/UC']": [],
    "#owner a[href*='/channel/UC']": [], "ytd-video-owner-renderer a[href*='/channel/UC']": [],
    "a[href*='/channel/UC']": [], "#channel-name a[href]": [], "ytd-channel-name a[href]": [],
    "#owner a[href]": [], "ytd-video-owner-renderer a[href]": [],
    "a[href^='/@']": [], "a[href*='youtube.com/@']": [], "a#avatar-link[href]": [], "a[href]": [video]
  }
});
card.matches = (selector) =>
  typeof selector === "string" &&
  (selector.includes("ytd-reel-item-renderer") || selector.includes("ytm-shorts-lockup-view-model"));

const document = {
  documentElement: {},
  querySelector() { return null; },
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
  const observed = tagPresentations.find((value) => value.root === card);
  const passes = Boolean(
    observed
    && observed.entryID === `youtube:video:${shortsId}`
    && observed.creatorID === `youtube:collab:${shortsId}`
    && typeof observed.title === "string" && observed.title.length > 0
    && errors.length === 0
  );
  if (passes) {
    console.log("PASS a creator-less Shorts card is pilled per-video");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL shorts card pill", { observed, errors });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 500);
