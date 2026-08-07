/* Regression test: a YouTube collaboration card exposes NO creator link — the
 * collaborators are unlinked text in yt-content-metadata-view-model. The
 * collector must fall back to the byline names: observe the card under a
 * per-video synthetic id and forward the names for app-side name matching. */
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

const title = element({ text: "Ronaldo vs My Unbeatable Goalie Robot" });
const video = element({ href: "/watch?v=SUP7x_DiyXw" });
// The collaborators row: two creators as plain, unlinked text.
const metadataRow = element({ text: "Atlas Arcade and Animated Subtitles" });
const metadataVM = element({ query: { ".ytContentMetadataViewModelMetadataRow": metadataRow } });

const card = element({
  query: { "#video-title": title, "yt-content-metadata-view-model": metadataVM },
  queryAll: {
    'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [video],
    "#metadata-line span": [],
    // No creator link of any kind — the collaboration card omits them entirely.
    "#channel-name a[href*='/channel/UC']": [], "ytd-channel-name a[href*='/channel/UC']": [],
    "#owner a[href*='/channel/UC']": [], "ytd-video-owner-renderer a[href*='/channel/UC']": [],
    "a[href*='/channel/UC']": [], "#channel-name a[href]": [], "ytd-channel-name a[href]": [],
    "#owner a[href]": [], "ytd-video-owner-renderer a[href]": [],
    "a[href^='/@']": [], "a[href*='youtube.com/@']": [], "a#avatar-link[href]": [], "a[href]": []
  }
});

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
    // Keyed by the video (stable per card), not by a creator id we cannot form.
    && observed.sourceID === "youtube:collab:SUP7x_DiyXw"
    // Both collaborator names forwarded for name matching.
    && Array.isArray(observed.creatorNames)
    && observed.creatorNames.length === 2
    && observed.creatorNames[0] === "Atlas Arcade"
    && observed.creatorNames[1] === "Animated Subtitles"
    && observed.anchor === title
    && errors.length === 0
  );
  if (passes) {
    console.log("PASS falls back to byline names for a link-less collaboration card");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL collab card fallback", { observed, errors });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 500);
