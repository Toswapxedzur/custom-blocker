/* Regression test for the event-driven card pipeline: a card's pill is injected
 * as soon as its AUTHOR is known — immediately at discovery when the creator link
 * is already present, or the moment it hydrates for cards that render their link
 * late — never gated on scrolling into view. Steady-state mutations re-process
 * only the affected card and never trigger a full-page rescan. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const tagPresentations = [];
const errors = [];

function element({ href = null, text = "", matchTags = [], query = {}, queryAll = {}, parentElement = null } = {}) {
  return {
    nodeType: 1,
    parentElement,
    textContent: text,
    getAttribute(name) { return name === "href" ? href : null; },
    matches(selector) { return typeof selector === "string" && matchTags.some((tag) => selector.indexOf(tag) !== -1); },
    closest() { return null; },
    querySelector(selector) { return query[selector] || null; },
    querySelectorAll(selector) { return queryAll[selector] || []; }
  };
}

// A card whose author (creator handle) is already resolvable.
function knownAuthorCard(handle, videoID) {
  const handleLink = element({ href: `/@${handle}`, text: handle });
  return element({
    matchTags: ["ytd-video-renderer"],
    query: { "#video-title": element({ text: `Title ${handle}` }) },
    queryAll: {
      'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [element({ href: `/watch?v=${videoID}` })],
      "#metadata-line span": [],
      "a[href^='/@']": [handleLink],
      "a[href]": [handleLink]
    }
  });
}

const existingCard = knownAuthorCard("Existing", "aaaaaaaaaaa");

// A card that renders before its creator link hydrates: initially no author.
const hydratingQueryAll = {
  'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]': [element({ href: "/watch?v=bbbbbbbbbbb" })],
  "#metadata-line span": [],
  "a[href^='/@']": [],
  "a[href]": []
};
const hydratingCard = element({
  matchTags: ["ytd-video-renderer"],
  query: { "#video-title": element({ text: "Title pending author" }) },
  queryAll: hydratingQueryAll
});

let documentScans = 0;
const document = {
  documentElement: { nodeType: 1 },
  querySelector() { return null; },
  querySelectorAll() { documentScans += 1; return [existingCard]; },
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

const observedFor = (card) => tagPresentations.find((value) => value.root === card);

// Stage 1: after the initial sweep, the card whose author is already known is
// processed immediately — no view/scroll event required.
setTimeout(() => {
  const scansAfterSweep = documentScans;
  const knownProcessedOnDiscovery = Boolean(observedFor(existingCard)
    && observedFor(existingCard).sourceID === "youtube:handle:@existing");

  // Stage 2: a card with no author link yet arrives. It is registered but, with
  // the author still unknown, injects no pill.
  FakeMutationObserver.emit([{ type: "childList", target: document.documentElement, addedNodes: [hydratingCard] }]);
  // Unrelated mutations must not rescan the whole feed.
  for (let i = 0; i < 5; i += 1) {
    FakeMutationObserver.emit([{ type: "childList", target: document.documentElement, addedNodes: [] }]);
  }

  setTimeout(() => {
    const noPillWhileAuthorUnknown = !observedFor(hydratingCard);

    // Stage 3: the creator link hydrates and the card mutates in place. The pill
    // appears now — keyed to the author becoming known, not to scrolling.
    hydratingQueryAll["a[href^='/@']"] = [element({ href: "/@Arrived", text: "Arrived" })];
    hydratingQueryAll["a[href]"] = hydratingQueryAll["a[href^='/@']"];
    FakeMutationObserver.emit([{ type: "childList", target: hydratingCard, addedNodes: [] }]);

    setTimeout(() => {
      const pillAfterAuthorKnown = Boolean(observedFor(hydratingCard)
        && observedFor(hydratingCard).sourceID === "youtube:handle:@arrived");
      const noFullRescan = documentScans === scansAfterSweep;

      const passes = knownProcessedOnDiscovery && noPillWhileAuthorUnknown
        && pillAfterAuthorKnown && noFullRescan && errors.length === 0;

      if (passes) {
        console.log("PASS injects a card's pill once its author is known, not on scroll, without a full rescan");
        console.log("__CB_TEST_RESULT__: OK");
        return;
      }
      console.error("FAIL author-known card pipeline", {
        knownProcessedOnDiscovery, noPillWhileAuthorUnknown, pillAfterAuthorKnown,
        noFullRescan, documentScans, scansAfterSweep, errors
      });
      console.log("__CB_TEST_RESULT__: FAIL");
      process.exitCode = 1;
    }, 250);
  }, 250);
}, 300);
