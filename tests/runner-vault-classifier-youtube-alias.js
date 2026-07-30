/* Regression test: the YouTube collector records a creator's channel/UC and
 * @handle forms together, so the native side can link and de-duplicate them. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const messages = [];
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

const title = element({ text: "A ranked match" });
const video = element({ href: "/watch?v=dQw4w9WgXcQ" });
const channelLink = element({ href: "/channel/UCabcdefghijklmnopqrstuv", text: "Visible Creator" });
const handleLink = element({ href: "/@VisibleCreator", text: "Visible Creator" });

// The owner block exposes both the channel/UC avatar link and the @handle name
// link — as a real watch/owner section does.
const cardQueryAll = {
  'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [video],
  "#metadata-line span": [],
  "#channel-name a[href*='/channel/UC']": [channelLink],
  "a[href*='/channel/UC']": [channelLink],
  "a[href^='/@']": [handleLink],
  "a[href]": [channelLink, handleLink],
  "#channel-name #text": [],
  "yt-lockup-metadata-view-model yt-avatar-shape img": []
};
const card = element({ query: { "#video-title": title }, queryAll: cardQueryAll });

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
      messages.push(message);
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
  location: { href: "https://www.youtube.com/feed/subscriptions", pathname: "/feed/subscriptions" },
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
  const collected = messages.filter((message) => message.type === "vault-classifier-collect").map((message) => message.entry);
  const entry = collected[0];
  const observed = tagPresentations.find((value) => value.sourceID);
  const passes = Boolean(
    entry
    // Channel-first primary identity, with the @handle recorded as an alias.
    && entry.sourceID === "youtube:channel:UCabcdefghijklmnopqrstuv"
    && Array.isArray(entry.sourceAliases)
    && entry.sourceAliases.length === 1
    && entry.sourceAliases[0] === "youtube:handle:@visiblecreator"
    // The tag lookup is requested under that same primary identity.
    && observed && observed.sourceID === "youtube:channel:UCabcdefghijklmnopqrstuv"
    && errors.length === 0
  );
  if (passes) {
    console.log("PASS records the creator's channel and @handle forms together as aliases");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL alias capture", { entry, observed, errors });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 500);
