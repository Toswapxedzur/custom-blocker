/* Regression coverage for Bilibili feed/search cards and the video page: the
   pilled root, the pill-only path for uploader-less cards, and the page entry.
   Card shapes verified live 2026-09-23 (home feed, search, watch page). */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const messages = [];
const observations = [];

function element({ tagName = "DIV", href = "", text = "", attrs = {}, matches = [], query = {}, queryAll = {}, descendants = [] } = {}) {
  return {
    tagName,
    href,
    textContent: text,
    isConnected: true,
    getAttribute(name) {
      if (name === "href") return href || null;
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    matches(selector) { return matches.includes(selector); },
    closest() { return null; },
    contains(node) { return node === this || descendants.includes(node); },
    querySelector(selector) { return query[selector] || null; },
    querySelectorAll(selector) { return queryAll[selector] || []; }
  };
}

function videoCard({ videoID, title, spaceID, className = "bili-video-card" }) {
  const entry = element({ tagName: "A", href: `https://www.bilibili.com/video/${videoID}/`, text: title, attrs: { title } });
  const titleElement = element({ tagName: "H3", text: title });
  const icon = element({ tagName: "IMG", attrs: { src: `https://i0.hdslb.com/bfs/face/${spaceID || "x"}.jpg` } });
  const source = spaceID
    ? element({ tagName: "A", href: `https://space.bilibili.com/${spaceID}`, text: `uploader ${spaceID}`, queryAll: { img: [icon] } })
    : null;
  return element({
    attrs: { class: className },
    matches: [".bili-video-card"],
    query: { "h1, h2, h3": titleElement },
    queryAll: {
      "h1, h2, h3": [titleElement],
      'a[href*="/video/BV"]': [entry],
      'a[href*="space.bilibili.com/"]': source ? [source] : [],
      "a[href]": source ? [entry, source] : [entry],
      img: source ? [icon] : []
    }
  });
}

// A home/search card with an uploader link → collected + pilled under the uploader.
const withUploader = videoCard({ videoID: "BV16zhJ6KEht", title: "那些卖不出去的猫，都去了哪里？", spaceID: "12345" });
// A search card whose uploader is plain text (no space link) → pill-only, keyed per video.
const noUploader = videoCard({ videoID: "BV1abcdefgh1", title: "苦力怕来了！但是我们有……", spaceID: null });
// The watch page's "up next" card (.video-page-card-small) → collected like a feed card.
const related = videoCard({ videoID: "BV1relatedx1", title: "Related video", spaceID: "777", className: "video-page-card-small" });

// The watch page itself.
const pageTitle = element({ tagName: "H1", text: "那些卖不出去的猫，都去了哪里？" });
const pageRoot = element({ attrs: { id: "viewbox_report" }, query: { h1: pageTitle }, queryAll: { h1: [pageTitle] } });
const upName = element({ tagName: "A", href: "https://space.bilibili.com/12345", text: "和猫住", attrs: { class: "up-name" }, queryAll: { img: [] } });
const description = element({ attrs: { id: "v_desc" }, text: "Page description text" });
const topicA = element({ tagName: "A", href: "https://search.bilibili.com/all?keyword=cats", text: "猫", attrs: { class: "tag-link" } });
const tagContainer = element({ attrs: { id: "v_tag" }, queryAll: { 'a[href*="/v/topic/"]': [], "a.tag-link": [topicA] } });

const document = {
  documentElement: {},
  addEventListener() {},
  querySelector(selector) {
    if (selector === "#viewbox_report") return pageRoot;
    if (selector === "#v_desc") return description;
    if (selector === "#v_tag") return tagContainer;
    if (selector === '.up-info-container .up-name[href*="space.bilibili.com/"]') return upName;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === "#v_desc") return [description];
    if (selector === "#v_tag") return [tagContainer];
    if (selector === ".bili-video-card") return [withUploader, noUploader];
    if (selector === ".video-page-card-small") return [related];
    if (selector === '.up-info-container .up-name[href*="space.bilibili.com/"]') return [upName];
    return [];
  }
};

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      messages.push(message);
      if (message.type === "vault-classifier-collection-info") callback({ ok: true, enabled: true });
      else callback({ ok: true, accepted: true, queued: true });
    }
  },
  storage: {
    local: { get(_key, callback) { callback({ globalSettings: { debugMode: false } }); } },
    onChanged: { addListener() {} }
  }
};

const context = vm.createContext({
  chrome,
  console,
  document,
  location: { href: "https://www.bilibili.com/video/BV16zhJ6KEht/?spm_id_from=333.1007", hostname: "www.bilibili.com", pathname: "/video/BV16zhJ6KEht/" },
  MutationObserver: class { constructor() {} observe() {} },
  setTimeout,
  clearTimeout,
  setInterval() { return 0; },
  TextEncoder,
  URL,
  addEventListener() {},
  VaultClassifierTagUI: { observe(value) { observations.push(value); }, clearPlatform() {} }
});
context.window = context;
context.globalThis = context;

for (const file of ["vault-classifier-contract.js", "platform-profiles.js", "vault-classifier-collector-core.js", "vault-classifier-bilibili.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

setTimeout(() => {
  const collections = messages.filter((message) => message.type === "vault-classifier-collect");
  const byID = (id, surface) => collections.find((m) => m.entry?.entryID === id && m.entry?.surface === surface);
  const feed = byID("bilibili:video:BV16zhJ6KEht", "feed");
  const relatedFeed = byID("bilibili:video:BV1relatedx1", "feed");
  const page = byID("bilibili:video:BV16zhJ6KEht", "page");
  const checks = {
    "feed card collected under its uploader": Boolean(feed && feed.entry.sourceID === "bilibili:creator:space:12345"),
    "feed card pilled on its own root, keyed by the video": observations.some((v) => v.root === withUploader && v.entryID === "bilibili:video:BV16zhJ6KEht" && v.creatorID === "bilibili:creator:space:12345" && v.kind === "card"),
    "uploader-less card is NOT collected (no verifiable source)": !collections.some((m) => m.entry?.entryID === "bilibili:video:BV1abcdefgh1"),
    "uploader-less card still gets a per-video pill": observations.some((v) => v.root === noUploader && v.entryID === "bilibili:video:BV1abcdefgh1" && v.creatorID === "bilibili:collab:video:BV1abcdefgh1" && v.title === "苦力怕来了！但是我们有……"),
    "watch-page 'up next' card is collected like a feed card": Boolean(relatedFeed && relatedFeed.entry.sourceID === "bilibili:creator:space:777"),
    "watch page's own entry is collected as a page surface with its topics": Boolean(page && page.entry.sourceID === "bilibili:creator:space:12345" && page.entry.evidence.text === "Page description text" && page.entry.evidence.suppliedTags.includes("猫")),
    "watch page entry routes the page verdict (kind page), exactly once": observations.filter((v) => v.kind === "page").length === 1 && observations.some((v) => v.kind === "page" && v.root === pageRoot),
    "page entry shares the feed card's id (one classification serves both)": Boolean(page && feed && page.entry.entryID === feed.entry.entryID)
  };
  let failed = false;
  for (const [label, ok] of Object.entries(checks)) {
    console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
    if (!ok) failed = true;
  }
  if (failed) {
    console.error("Bilibili collector fixture", { collections: collections.map((m) => m.entry), observations, diagnostics: messages.filter((m) => m.type === "vault-classifier-diagnostic").map((m) => m.event + ":" + (m.detail || "")) });
    console.log("__CB_TEST_RESULT__: FAIL");
    process.exitCode = 1;
    return;
  }
  console.log("__CB_TEST_RESULT__: OK");
}, 1_000);
