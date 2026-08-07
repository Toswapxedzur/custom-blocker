/* Regression test for nested feed cards. The home/subscriptions feed nests a
 * covered renderer (ytd-rich-grid-media) inside another covered renderer
 * (ytd-rich-item-renderer); the creator link, title, and avatar all live in the
 * INNER one. The pill must land on the OUTER card exactly once — never a second
 * pill on the inner renderer (the "tag twice" bug), and the outer card must
 * still re-process when a mutation lands inside the inner one (the "skip" bug). */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const tagPresentations = [];
const errors = [];

function element({ href = null, text = "", matchTags = [], attrs = {}, query = {}, queryAll = {}, closest = {}, parentElement = null } = {}) {
  return {
    nodeType: 1,
    parentElement,
    textContent: text,
    getAttribute(name) { return name === "href" ? href : (attrs[name] || null); },
    matches(selector) { return typeof selector === "string" && matchTags.some((tag) => selector.indexOf(tag) !== -1); },
    closest(selector) { return closest[selector] || null; },
    querySelector(selector) { return query[selector] || null; },
    querySelectorAll(selector) { return queryAll[selector] || []; }
  };
}

const handleLink = element({ href: "/@Nested", text: "Nested Creator" });
const watchLink = element({ href: "/watch?v=ccccccccccc" });
const titleEl = element({ text: "A nested feed video" });
const avatarImage = element({ attrs: { src: "https://yt3.ggpht.com/nested-avatar=s88" } });

// INNER covered renderer (ytd-rich-grid-media): owns the creator link, title,
// and avatar. It is NOT the outermost card, so it must never get its own pill.
const inner = element({
  matchTags: ["ytd-rich-grid-media"],
  query: { "#video-title": titleEl },
  queryAll: {
    'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [watchLink],
    "#metadata-line span": [],
    "a[href^='/@']": [handleLink],
    "a[href]": [handleLink]
  }
});

// OUTER covered renderer (ytd-rich-item-renderer): the outermost card, which is
// the one that gets pilled. Its queries reach the inner renderer's descendants.
const outer = element({
  matchTags: ["ytd-rich-item-renderer"],
  query: { "#video-title": titleEl },
  queryAll: {
    'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [watchLink],
    "#metadata-line span": [],
    "a[href^='/@']": [handleLink],
    "a[href]": [handleLink]
  }
});

// Wire the parent chain: avatar -> inner -> outer.
inner.parentElement = outer;
avatarImage.parentElement = inner;

const document = {
  documentElement: { nodeType: 1 },
  querySelector() { return null; },
  // The real DOM returns BOTH nested renderers for CARD_SELECTOR.
  querySelectorAll() { return [outer, inner]; },
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

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; FakeMutationObserver.instances.push(this); }
  observe() {}
  disconnect() {}
  static emit(records) { FakeMutationObserver.instances.forEach((mo) => mo.callback(records)); }
}
FakeMutationObserver.instances = [];

const context = vm.createContext({
  chrome,
  console: { debug() {}, error(error) { errors.push(error); } },
  document,
  location: { href: "https://www.youtube.com/feed/subscriptions", pathname: "/feed/subscriptions" },
  MutationObserver: FakeMutationObserver,
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
  // After the initial sweep: exactly one pill, on the OUTER card.
  const afterSweepRoots = tagPresentations.map((value) => value.root);
  const onlyOuterAfterSweep = afterSweepRoots.length === 1
    && afterSweepRoots[0] === outer
    && tagPresentations[0].sourceID === "youtube:handle:@nested";

  // The avatar's src loads late — a src mutation on an element INSIDE the inner
  // renderer. This previously pilled the inner card as a duplicate.
  FakeMutationObserver.emit([{ type: "attributes", attributeName: "src", target: avatarImage }]);

  setTimeout(() => {
    const innerEverPilled = tagPresentations.some((value) => value.root === inner);
    const everyPillOnOuter = tagPresentations.every((value) => value.root === outer);
    const stillProcessedOuter = tagPresentations.length >= 1;

    const passes = onlyOuterAfterSweep && !innerEverPilled && everyPillOnOuter
      && stillProcessedOuter && errors.length === 0;

    if (passes) {
      console.log("PASS pills the outer card once and never duplicates onto the nested inner renderer");
      console.log("__CB_TEST_RESULT__: OK");
      return;
    }
    console.error("FAIL nested feed card pipeline", {
      onlyOuterAfterSweep, innerEverPilled, everyPillOnOuter, stillProcessedOuter,
      roots: tagPresentations.map((value) => (value.root === outer ? "outer" : value.root === inner ? "inner" : "other")),
      errors
    });
    console.log("__CB_TEST_RESULT__: FAIL");
    process.exitCode = 1;
  }, 250);
}, 300);
