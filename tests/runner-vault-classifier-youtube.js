/* Regression test for the YouTube collector's creator-link fallbacks. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const messages = [];
const errors = [];
const debugLogs = [];
const tagPresentations = [];

function element({ href = null, text = "", matches = false, attrs = {}, query = {}, queryAll = {}, closest = {} } = {}) {
  return {
    textContent: text,
    getAttribute(name) { return name === "href" ? href : (attrs[name] || null); },
    matches() { return matches; },
    closest(selector) { return closest[selector] || null; },
    querySelector(selector) { return query[selector] || null; },
    querySelectorAll(selector) { return queryAll[selector] || []; }
  };
}

const title = element({ text: "Visible related video" });
const video = element({ href: "/watch?v=dQw4w9WgXcQ" });
const creator = element({ href: "/@VisibleCreator", text: "Visible Creator" });
const avatarMetadata = element({ queryAll: { "a[href]": [creator] } });
const otherCreator = element({ href: "/@OtherCreator", text: "Other Creator" });
const otherAvatarMetadata = element({ queryAll: { "a[href]": [otherCreator] } });
const creatorImage = element({
  attrs: { src: "https://yt3.ggpht.com/visible-creator-avatar=s88" },
  closest: { "yt-lockup-metadata-view-model": avatarMetadata }
});
const otherCreatorImage = element({
  attrs: { src: "https://yt3.ggpht.com/other-creator-avatar=s88" },
  closest: { "yt-lockup-metadata-view-model": otherAvatarMetadata }
});
const feedCardQueryAll = {
  'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [video],
  "#metadata-line span": [],
  "#channel-name a[href*='/channel/UC']": [],
  "ytd-channel-name a[href*='/channel/UC']": [],
  "#owner a[href*='/channel/UC']": [],
  "ytd-video-owner-renderer a[href*='/channel/UC']": [],
  "a[href*='/channel/UC']": [],
  "#channel-name a[href]": [],
  "ytd-channel-name a[href]": [],
  "#owner a[href]": [],
  "ytd-video-owner-renderer a[href]": [],
  "a[href^='/@']": [creator],
  "a[href*='youtube.com/@']": [],
  "a#avatar-link[href]": [],
  "a[href]": [creator],
  "yt-lockup-metadata-view-model yt-avatar-shape img": []
};
const feedCard = element({
  query: { "#video-title": title },
  queryAll: feedCardQueryAll
});

const document = {
  documentElement: {},
  querySelector() { return null; },
  querySelectorAll() { return [feedCard]; },
  addEventListener() {}
};

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      messages.push(message);
      if (message.type === "vault-classifier-collection-info") {
        callback({ ok: true, enabled: true });
        return;
      }
      if (message.type === "vault-classifier-collect") {
        callback({ ok: true, accepted: true });
        return;
      }
      callback({ ok: true, accepted: true });
    }
  },
  storage: {
    local: {
      get(_key, callback) { callback({ globalSettings: { debugMode: true } }); }
    },
    onChanged: { addListener() {} }
  }
};

const mutationObservers = [];
const observedMutationOptions = [];

const context = vm.createContext({
  chrome,
  console: {
    debug(...parts) { debugLogs.push(parts.join(" ")); },
    error(error) { errors.push(error); }
  },
  document,
  location: { href: "https://www.youtube.com/feed/subscriptions", pathname: "/feed/subscriptions" },
  MutationObserver: class {
    constructor(callback) { mutationObservers.push(callback); }
    observe(_root, options) { observedMutationOptions.push(options); }
  },
  setTimeout,
  clearTimeout,
  setInterval() { return 0; },
  TextEncoder,
  URL
});
context.window = context;
context.globalThis = context;
context.window.addEventListener = () => {};
context.VaultClassifierTagUI = {
  observe(value) { tagPresentations.push(value); },
  clearPlatform() {}
};

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-youtube.js"), "utf8"), context, { filename: "vault-classifier-youtube.js" });

setTimeout(() => {
  // YouTube's current feed DOM supplies a non-link avatar shape in the same
  // metadata component as the verified creator handle.
  feedCardQueryAll["yt-lockup-metadata-view-model yt-avatar-shape img"] = [otherCreatorImage, creatorImage];
  mutationObservers.forEach((callback) => callback([{ type: "attributes", attributeName: "src" }]));
}, 350);

setTimeout(() => {
  const collections = messages.filter((message) => message.type === "vault-classifier-collect");
  const initial = collections[0];
  const enriched = collections[1];
  const passes = Boolean(collections.length === 2
    && initial.entry?.sourceID === "youtube:handle:@visiblecreator"
    && initial.entry?.evidence?.metadata?.creatorAvatarURL === undefined
    && enriched.entry?.sourceID === "youtube:handle:@visiblecreator"
    && enriched.entry?.evidence?.metadata?.sourceName === "Visible Creator"
    && enriched.entry?.evidence?.title === "Visible related video"
    && enriched.entry?.evidence?.metadata?.creatorAvatarURL === "https://yt3.ggpht.com/visible-creator-avatar=s88"
    && observedMutationOptions.some((options) => options.attributes === true && options.attributeFilter?.includes("src"))
    && debugLogs.includes("[VaultClassifier:avatar] debug-ready")
    && debugLogs.includes("[VaultClassifier:avatar] image-missing")
    && debugLogs.includes("[VaultClassifier:avatar] source-ready")
    && debugLogs.includes("[VaultClassifier:avatar] enrichment-requested")
    && debugLogs.includes("[VaultClassifier:avatar] delivery-accepted")
    && tagPresentations.some((value) => value.root === feedCard && value.sourceID === "youtube:handle:@visiblecreator" && value.anchor === creator)
    && debugLogs.every((entry) => !/Visible Creator|dQw4w9WgXcQ|yt3\.ggpht\.com/.test(entry))
    && errors.length === 0);
  if (passes) {
    console.log("PASS refreshes a creator after its verified avatar appears late");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL YouTube late-avatar collector fixture", { collections, debugLogs, errors, messages });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 900);
