/* Regression coverage for current Reddit feed cards and detail overlays. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const messages = [];
const observations = [];

function element({
  tagName = "DIV",
  href = "",
  text = "",
  attrs = {},
  matches = [],
  query = {},
  queryAll = {},
  descendants = []
} = {}) {
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

function redditPost({ subreddit, postID, title, body, sourceIconURL, commentText, matches = ["shreddit-post"], descendants = [] }) {
  const permalink = `https://www.reddit.com/r/${subreddit}/comments/${postID}/post-title/`;
  const sourceIcon = element({ tagName: "IMG", attrs: { src: sourceIconURL } });
  const source = element({
    tagName: "A",
    href: `https://www.reddit.com/r/${subreddit}/`,
    text: `r/${subreddit}`,
    queryAll: { img: [sourceIcon] }
  });
  const entry = element({ tagName: "A", href: permalink, text: title });
  const titleElement = element({ text: title });
  const bodyElement = element({ text: body });
  const commentElement = element({ text: commentText });
  const flair = element({ text: "Discussion" });
  const postMedia = element({
    tagName: "IMG",
    attrs: { src: "https://i.redd.it/post-media.png" }
  });
  return element({
    attrs: {
      id: `t3_${postID}`,
      permalink: new URL(permalink).pathname,
      "post-title": title,
      "subreddit-name": subreddit,
      "subreddit-prefixed-name": `r/${subreddit}`,
      author: "rendered-author",
      score: "42",
      "comment-count": "7",
      "created-timestamp": "2026-07-26T12:00:00Z",
      "post-type": "text",
      "post-language": "en",
      domain: "self.reddit"
    },
    matches,
    descendants,
    query: {
      '[slot="title"]': titleElement,
      '[slot="text-body"]': bodyElement,
      '[slot="comment"]': commentElement
    },
    queryAll: {
      'a[href*="/comments/"]': [entry],
      "a[href]": [entry, source],
      img: [sourceIcon, postMedia],
      '[slot="title"]': [titleElement],
      '[slot="text-body"]': [bodyElement],
      '[slot="comment"]': [commentElement],
      '[slot="post-flair"], [data-post-click-location="post-flair"], a[href*="f=flair_name"]': [flair]
    }
  });
}

const unrelated = redditPost({
  subreddit: "unrelated",
  postID: "wrong111",
  title: "Unrelated background title",
  body: "Unrelated background body",
  sourceIconURL: "https://styles.redditmedia.com/t5_wrong/styles/communityIcon_wrong.png",
  commentText: "Unrelated comment"
});
const requested = redditPost({
  subreddit: "OpenAI",
  postID: "right222",
  title: "Requested post title",
  body: "Requested rendered post body",
  sourceIconURL: "https://styles.redditmedia.com/t5_openai/styles/communityIcon_openai.png",
  commentText: "COMMENT MUST NOT BE COLLECTED"
});
// The same post also appears as an <article> wrapping its <shreddit-post>. Both
// match the scan's selectors; the collector must inject only one pill (on the
// inner, data-bearing <shreddit-post>), never a second on the wrapper.
const requestedArticle = redditPost({
  subreddit: "OpenAI",
  postID: "right222",
  title: "Requested post title",
  body: "Requested rendered post body",
  sourceIconURL: "https://styles.redditmedia.com/t5_openai/styles/communityIcon_openai.png",
  commentText: "COMMENT MUST NOT BE COLLECTED",
  matches: ["article:has(shreddit-post)"],
  descendants: [requested]
});

const document = {
  documentElement: {},
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll(selector) {
    if (selector === "shreddit-post") return [unrelated, requested];
    if (selector === "article:has(shreddit-post)") return [requestedArticle];
    return [];
  }
};

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      messages.push(message);
      if (message.type === "vault-classifier-collection-info") {
        callback({ ok: true, enabled: true });
      } else {
        callback({ ok: true, accepted: true, queued: true });
      }
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
  location: {
    href: "https://www.reddit.com/r/OpenAI/comments/right222/post-title/#lightbox",
    hostname: "www.reddit.com",
    pathname: "/r/OpenAI/comments/right222/post-title/"
  },
  MutationObserver: class {
    constructor() {}
    observe() {}
  },
  setTimeout,
  clearTimeout,
  setInterval() { return 0; },
  TextEncoder,
  URL,
  addEventListener() {},
  VaultClassifierTagUI: {
    observe(value) { observations.push(value); },
    clearPlatform() {}
  }
});
context.window = context;
context.globalThis = context;

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "platform-profiles.js"), "utf8"), context, { filename: "platform-profiles.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-collector-core.js"), "utf8"), context, { filename: "vault-classifier-collector-core.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-reddit.js"), "utf8"), context, { filename: "vault-classifier-reddit.js" });

setTimeout(() => {
  const collections = messages.filter((message) => message.type === "vault-classifier-collect");
  const feed = collections.find((message) =>
    message.entry?.entryID === "reddit:post:right222"
    && message.entry?.surface === "feed"
  );
  const page = collections.find((message) =>
    message.entry?.entryID === "reddit:post:right222"
    && message.entry?.surface === "page"
  );
  const serialized = JSON.stringify({ feed, page });
  const passed = Boolean(
    feed
    && page
    && feed.entry.sourceID === "reddit:subreddit:openai"
    && feed.entry.evidence.metadata.sourceURL === "https://www.reddit.com/r/OpenAI/"
    && feed.entry.evidence.metadata.sourceIconURL === "https://styles.redditmedia.com/t5_openai/styles/communityIcon_openai.png"
    && feed.entry.evidence.metadata.authorName === "rendered-author"
    && feed.entry.evidence.text === "Requested rendered post body"
    && page.entry.evidence.title === "Requested post title"
    && page.entry.evidence.text === "Requested rendered post body"
    && page.entry.evidence.suppliedTags.includes("Discussion")
    && !serialized.includes("COMMENT MUST NOT BE COLLECTED")
    && !serialized.includes("i.redd.it/post-media.png")
    && !serialized.includes("Unrelated background title")
    && observations.some((value) => value.root === requested && value.creatorID === "reddit:subreddit:openai" && value.entryID === "reddit:post:right222" && typeof value.title === "string")
    // The wrapping <article> must be deduped away — only the inner <shreddit-post>
    // gets a pill, never the wrapper (which would double-inject on the feed).
    && observations.every((value) => value.root !== requestedArticle)
  );
  if (passed) {
    console.log("PASS derives subreddit identity from the post route, selects the matching overlay root, and excludes comments/post media");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL Reddit collector regression", { collections, observations });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 1_000);
