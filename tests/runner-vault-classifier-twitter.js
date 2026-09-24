/* Regression coverage for X/Twitter timeline cells and the status page. Shapes
   verified live 2026-09-23 on x.com/home and a status page: a
   [data-testid="cellInnerDiv"] wraps article[data-testid="tweet"]; the tweet
   carries /handle/status/<id> links, User-Name links, tweetText, and media
   (tweetPhoto / videoPlayer). */
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

function tweet({ handle, statusID, text, withMedia = true }) {
  const permalink = `https://x.com/${handle}/status/${statusID}`;
  const status = element({ tagName: "A", href: permalink, text: "3h" });
  const analytics = element({ tagName: "A", href: `${permalink}/analytics`, text: "" });
  const profile = element({ tagName: "A", href: `https://x.com/${handle}`, text: `Brawl Stars @${handle}` });
  const avatarImg = element({ tagName: "IMG", attrs: { src: "https://pbs.twimg.com/profile_images/2095429081026154496/didtFNy0_x96.jpg" } });
  const avatarLink = element({ tagName: "A", href: `https://x.com/${handle}`, queryAll: { img: [avatarImg] } });
  const hashtag = element({ tagName: "A", href: "https://x.com/hashtag/BrawlStars", text: "#BrawlStars" });
  const textRoot = element({ text, queryAll: { 'a[href*="/hashtag/"]': [hashtag] } });
  const media = element({ attrs: { "data-testid": "tweetPhoto" }, queryAll: { img: [element({ tagName: "IMG", attrs: { src: "https://pbs.twimg.com/media/abc.jpg" } })] } });
  const article = element({
    tagName: "ARTICLE",
    attrs: { "data-testid": "tweet" },
    matches: ['article[data-testid="tweet"]'],
    query: { '[data-testid="tweetText"]': textRoot, '[data-testid="tweetPhoto"]': withMedia ? media : null },
    queryAll: {
      'a[href*="/status/"]': [status, analytics],
      '[data-testid="User-Name"] a[href]': [profile, profile, status],
      '[data-testid^="UserAvatar-Container"] a[href]': [avatarLink],
      "a[href]": [avatarLink, profile, status, analytics, hashtag],
      '[data-testid="tweetText"]': [textRoot],
      img: [avatarImg]
    }
  });
  const cell = element({
    attrs: { "data-testid": "cellInnerDiv" },
    matches: ['[data-testid="cellInnerDiv"]:has(article[data-testid="tweet"])'],
    descendants: [article],
    query: article.query,
    queryAll: article.queryAll
  });
  return { article, cell, permalink };
}

const main = tweet({ handle: "BrawlStars", statusID: "2102730439869837540", text: "School games gone wrong 😱💥" });
const reply = tweet({ handle: "someone", statusID: "2102730500000000001", text: "great clip" });

const document = {
  documentElement: {},
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll(selector) {
    if (selector === 'article[data-testid="tweet"]') return [main.article, reply.article];
    if (selector === '[data-testid="cellInnerDiv"]:has(article[data-testid="tweet"])') return [main.cell, reply.cell];
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
  location: { href: main.permalink, hostname: "x.com", pathname: "/BrawlStars/status/2102730439869837540" },
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

for (const file of ["vault-classifier-contract.js", "platform-profiles.js", "vault-classifier-collector-core.js", "vault-classifier-twitter.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

setTimeout(() => {
  const collections = messages.filter((message) => message.type === "vault-classifier-collect");
  const byID = (id, surface) => collections.find((m) => m.entry?.entryID === id && m.entry?.surface === surface);
  const feed = byID("twitter:status:2102730439869837540", "feed");
  const replyFeed = byID("twitter:status:2102730500000000001", "feed");
  const page = byID("twitter:status:2102730439869837540", "page");
  const checks = {
    "a timeline tweet is collected under its account": Boolean(feed && feed.entry.sourceID === "twitter:account:brawlstars" && feed.entry.evidence.title === "School games gone wrong 😱💥"),
    "the account avatar is the source icon; the tweet's own photo never travels": Boolean(feed && feed.entry.evidence.metadata.sourceIconURL === "https://pbs.twimg.com/profile_images/2095429081026154496/didtFNy0_x96.jpg" && !JSON.stringify(feed).includes("pbs.twimg.com/media")),
    "hashtags ride as supplied tags": Boolean(feed && feed.entry.evidence.suppliedTags.includes("#BrawlStars")),
    "one pill per tweet, on the inner article (never the wrapping cell)": observations.filter((v) => v.entryID === "twitter:status:2102730439869837540").every((v) => v.root === main.article) && observations.every((v) => v.root !== main.cell && v.root !== reply.cell),
    "a reply under the post is a comment: never collected, never pilled (owner 2026-09-24)": !replyFeed && !observations.some((v) => v.root === reply.article),
    "the status page's own tweet routes the page verdict, exactly once, and shares the feed id": observations.filter((v) => v.kind === "page").length === 1 && observations.some((v) => v.kind === "page" && v.root === main.article && v.entryID === "twitter:status:2102730439869837540") && Boolean(page)
  };
  let failed = false;
  for (const [label, ok] of Object.entries(checks)) { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) failed = true; }
  if (failed) {
    console.error("X collector fixture", { collections: collections.map((m) => m.entry), observations: observations.map((o) => ({ entryID: o.entryID, kind: o.kind, isArticle: o.root === main.article || o.root === reply.article })), diagnostics: messages.filter((m) => m.type === "vault-classifier-diagnostic").map((m) => m.event + ":" + (m.detail || "")) });
    console.log("__CB_TEST_RESULT__: FAIL");
    process.exitCode = 1;
    return;
  }
  console.log("__CB_TEST_RESULT__: OK");
}, 1_000);
