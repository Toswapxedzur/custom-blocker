/* Adversarial DOM fixtures for every non-YouTube/Reddit collector. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
let failures = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`PASS ${label}`);
    return;
  }
  failures += 1;
  console.error(`FAIL ${label}`, detail || "");
}

function element({
  tagName = "DIV",
  href = null,
  id = null,
  text = "",
  attrs = {},
  queryAll = {},
  queryOne = {},
  matches = [],
  closest = {}
} = {}) {
  const value = {
    tagName,
    href,
    id,
    textContent: text,
    isConnected: true,
    style: {},
    getAttribute(name) {
      if (name === "href") return href;
      if (name === "id") return id;
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    querySelectorAll(selector) {
      return queryAll[selector] || [];
    },
    querySelector(selector) {
      return Object.prototype.hasOwnProperty.call(queryOne, selector)
        ? queryOne[selector]
        : (queryAll[selector] || [])[0] || null;
    },
    matches(selector) {
      return matches.includes(selector);
    },
    closest(selector) {
      return closest[selector] || null;
    }
  };
  return value;
}

function documentFixture(queryAll = {}, queryOne = {}) {
  return {
    documentElement: {},
    querySelectorAll(selector) { return queryAll[selector] || []; },
    querySelector(selector) {
      return Object.prototype.hasOwnProperty.call(queryOne, selector)
        ? queryOne[selector]
        : (queryAll[selector] || [])[0] || null;
    }
  };
}

function harness(platform, adapterFile, location, document) {
  const context = vm.createContext({
    console,
    document,
    location,
    URL,
    TextEncoder,
    crypto: {
      getRandomValues(bytes) {
        for (let index = 0; index < bytes.length; index++) bytes[index] = index + 1;
      }
    },
    VaultClassifierTagUI: { observe() {}, clearPlatform() {} }
  });
  context.window = context;
  context.globalThis = context;
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "platform-profiles.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-collector-core.js"), "utf8"), context);
  let configuration = null;
  context.VaultClassifierCollectorCore = {
    ...context.VaultClassifierCollectorCore,
    start(value) { configuration = value; }
  };
  vm.runInContext(fs.readFileSync(path.join(root, adapterFile), "utf8"), context);
  const collected = [];
  const collect = (raw) => {
    const normalized = context.VaultClassifierCollectorCore.makeCollectedEntry({
      ...raw,
      platform,
      baseURL: location.href
    });
    if (normalized) collected.push(normalized);
  };
  return {
    collected,
    scan() { configuration.scan({ document, collect }); },
    scanPage() { return configuration.scanPage?.({ document, collect }); }
  };
}

function image(src) {
  return element({ tagName: "IMG", attrs: { src } });
}

// TikTok: the video URL normalizes to the same creator identity as the
// profile URL, but only the exact profile anchor may supply the source icon.
{
  const thumbnail = image("https://p16-sign-va.tiktokcdn.com/post-thumbnail.jpeg");
  const avatar = image("https://p16-sign-va.tiktokcdn.com/profile-avatar.jpeg");
  const ownTag = element({ text: "#guide" });
  const commentTag = element({ text: "#comment" });
  const description = element({
    text: "Creator caption #guide",
    queryAll: { 'a[href*="/tag/"]': [ownTag] }
  });
  const entry = element({
    tagName: "A",
    href: "https://www.tiktok.com/@visible/video/123456789",
    text: "Watch video",
    queryAll: { img: [thumbnail] }
  });
  const source = element({
    tagName: "A",
    href: "https://www.tiktok.com/@visible",
    text: "@visible",
    queryAll: { img: [avatar] }
  });
  const title = element({ text: "Visible short" });
  const card = element({ queryAll: {
    'a[href*="/video/"]': [entry],
    "a[href]": [entry, source],
    '[data-e2e*="title"]': [title],
    '[data-testid*="title"]': [],
    "h1, h2, h3": [],
    '[data-e2e="browse-video-desc"]': [],
    '[data-e2e*="video-desc"]': [],
    '[data-e2e*="desc"]': [description],
    '[data-testid*="desc"]': [],
    'a[href*="/tag/"]': [ownTag, commentTag]
  } });
  const document = documentFixture({
    '[data-e2e="recommend-list-item-container"]': [card],
    '[data-e2e="search-card"]': [],
    '[data-e2e="video-item"]': [],
    '[data-e2e*="feed-item"]': []
  });
  const run = harness("tiktok", "vault-classifier-tiktok.js", {
    href: "https://www.tiktok.com/foryou",
    hostname: "www.tiktok.com",
    pathname: "/foryou"
  }, document);
  run.scan();
  const entryResult = run.collected[0];
  assert("TikTok uses the exact creator control instead of the thumbnail link",
    run.collected.length === 1
      && entryResult.evidence.metadata.sourceURL === "https://www.tiktok.com/@visible"
      && entryResult.evidence.metadata.sourceIconURL === "https://p16-sign-va.tiktokcdn.com/profile-avatar.jpeg"
      && entryResult.evidence.suppliedTags.join(",") === "#guide"
      && !JSON.stringify(entryResult).includes("post-thumbnail"),
    run.collected);
}

// Twitch: live preview and channel profile links may share the same href.
// Element role, rather than href inequality, distinguishes the source.
{
  const thumbnail = image("https://static-cdn.jtvnw.net/previews-ttv/live_user_visible.jpg");
  const avatar = image("https://static-cdn.jtvnw.net/jtv_user_pictures/visible-profile_image.png");
  const entry = element({
    tagName: "A",
    href: "https://www.twitch.tv/visible",
    queryAll: { img: [thumbnail] },
    matches: ['a[data-a-target="preview-card-image-link"], a[data-a-target="preview-card-title-link"]']
  });
  const source = element({
    tagName: "A",
    href: "https://www.twitch.tv/visible",
    text: "Visible streamer",
    queryAll: { img: [avatar] }
  });
  const title = element({ text: "Visible livestream" });
  const card = element({ queryAll: {
    'a[data-a-target="preview-card-image-link"]': [entry],
    'a[data-a-target="preview-card-title-link"]': [],
    'a[href*="/clip/"]': [],
    'a[href^="/videos/"]': [],
    'a[data-a-target="preview-card-channel-link"]': [source],
    '[data-a-target="preview-card-channel-name"] a[href]': [],
    '[data-a-target="channel-header-container"] a[href]': [],
    '[data-a-target*="channel-header"] a[href]': [],
    '[data-a-target="preview-card-channel-link"]': [source],
    '[data-a-target="preview-card-channel-name"]': [],
    '[data-a-target="preview-card-title"]': [title],
    "h1, h2, h3": [],
    '[data-a-target*="description"]': []
  } });
  const document = documentFixture({
    '[data-a-target="preview-card"]': [card],
    '[data-a-target="preview-card-image-link"]': []
  });
  const run = harness("twitch", "vault-classifier-twitch.js", {
    href: "https://www.twitch.tv/directory/category/games",
    hostname: "www.twitch.tv",
    pathname: "/directory/category/games"
  }, document);
  run.scan();
  const entryResult = run.collected[0];
  assert("Twitch keeps same-URL preview media separate from the channel icon",
    run.collected.length === 1
      && entryResult.evidence.metadata.sourceIconURL === "https://static-cdn.jtvnw.net/jtv_user_pictures/visible-profile_image.png"
      && !JSON.stringify(entryResult).includes("previews-ttv"),
    run.collected);
}

// X: status and profile URLs normalize to one account, while quoted tweet
// hashtags and status media remain outside the retained tweet-text element.
{
  const statusMedia = image("https://pbs.twimg.com/media/post-image.jpg");
  const avatar = image("https://pbs.twimg.com/profile_images/123/avatar.jpg");
  const ownTag = element({ text: "#own" });
  const quotedTag = element({ text: "#quoted" });
  const entry = element({
    tagName: "A",
    href: "https://x.com/visible/status/123456789",
    queryAll: { img: [statusMedia] }
  });
  const source = element({
    tagName: "A",
    href: "https://x.com/visible",
    text: "@visible",
    queryAll: { img: [avatar] }
  });
  const tweetText = element({
    text: "Own tweet #own",
    queryAll: { 'a[href*="/hashtag/"]': [ownTag] }
  });
  const quotedText = element({
    text: "Quoted tweet #quoted",
    queryAll: { 'a[href*="/hashtag/"]': [quotedTag] }
  });
  const card = element({ queryAll: {
    'a[href*="/status/"]': [entry],
    '[data-testid="User-Name"] a[href]': [source],
    '[data-testid^="UserAvatar-Container"] a[href]': [],
    "a[href]": [entry, source],
    '[data-testid="tweetText"]': [tweetText],
    '[lang]': [quotedText],
    'a[href*="/hashtag/"]': [ownTag, quotedTag]
  } });
  const document = documentFixture({
    'article[data-testid="tweet"]': [card],
    '[data-testid="cellInnerDiv"]:has(article[data-testid="tweet"])': []
  });
  const run = harness("twitter", "vault-classifier-twitter.js", {
    href: "https://x.com/home",
    hostname: "x.com",
    pathname: "/home"
  }, document);
  run.scan();
  const entryResult = run.collected[0];
  assert("X binds source media to the exact profile and tags to own tweet text",
    run.collected.length === 1
      && entryResult.evidence.metadata.sourceIconURL === "https://pbs.twimg.com/profile_images/123/avatar.jpg"
      && entryResult.evidence.text === "Own tweet #own"
      && entryResult.evidence.suppliedTags.join(",") === "#own"
      && !JSON.stringify(entryResult).includes("post-image")
      && !JSON.stringify(entryResult).includes("Quoted"),
    run.collected);
}

// Instagram: a visible comment may precede the caption in the list. The
// caption must be the item bound to the verified post author.
{
  const avatar = image("https://instagram.fsjc1-3.fna.fbcdn.net/profile.jpg");
  const source = element({
    tagName: "A",
    href: "https://www.instagram.com/visible/",
    text: "visible",
    queryAll: { img: [avatar] }
  });
  const entry = element({ tagName: "A", href: "https://www.instagram.com/p/ABC123/", text: "Post" });
  const ownTag = element({ text: "#caption" });
  const commentTag = element({ text: "#comment" });
  const captionText = element({
    text: "Author caption #caption",
    queryAll: { 'a[href*="/explore/tags/"]': [ownTag] }
  });
  const commentText = element({
    text: "Comment body #comment",
    queryAll: { 'a[href*="/explore/tags/"]': [commentTag] }
  });
  const captionItem = element({ queryAll: {
    "a[href]": [source],
    'span[dir="auto"]': [captionText]
  } });
  const commentAuthor = element({ tagName: "A", href: "https://www.instagram.com/commenter/" });
  const commentItem = element({ queryAll: {
    "a[href]": [commentAuthor],
    'span[dir="auto"]': [commentText]
  } });
  const card = element({ queryAll: {
    'a[href^="/reel/"]': [],
    'a[href^="/p/"]': [entry],
    'a[href^="/tv/"]': [],
    "article header a[href]": [source],
    "header a[href]": [],
    '[data-testid*="post-caption"]': [],
    '[aria-label*="caption" i]': [],
    "ul li": [commentItem, captionItem],
    "h1, h2, h3": [],
    "a[href]": [entry, source],
    'a[href*="/explore/tags/"]': [commentTag, ownTag]
  } });
  const document = documentFixture({
    article: [card],
    '[role="article"]': [],
    '[role="button"]': []
  });
  const run = harness("instagram", "vault-classifier-instagram.js", {
    href: "https://www.instagram.com/",
    hostname: "www.instagram.com",
    pathname: "/"
  }, document);
  run.scan();
  const entryResult = run.collected[0];
  assert("Instagram selects an author-bound caption and excludes comment tags",
    run.collected.length === 1
      && entryResult.evidence.text === "Author caption #caption"
      && entryResult.evidence.suppliedTags.join(",") === "#caption"
      && !JSON.stringify(entryResult).includes("Comment body"),
    run.collected);
}

// Facebook: the broad story container includes a comment, while the dedicated
// message element contains only the authored post body.
{
  const avatar = image("https://scontent.fsjc1-3.fna.fbcdn.net/profile.jpg");
  const source = element({
    tagName: "A",
    href: "https://www.facebook.com/visible",
    text: "Visible page",
    queryAll: { img: [avatar] }
  });
  const entry = element({ tagName: "A", href: "https://www.facebook.com/visible/posts/123456789", text: "Permalink" });
  const ownTag = element({ text: "#post" });
  const commentTag = element({ text: "#comment" });
  const body = element({
    text: "Post body #post",
    queryAll: { 'a[href*="/hashtag/"]': [ownTag] }
  });
  const story = element({
    text: "Post body #post Comment body #comment",
    queryAll: { 'a[href*="/hashtag/"]': [ownTag, commentTag] }
  });
  const card = element({ queryAll: {
    'a[href*="/reel/"]': [],
    'a[href*="/watch/"]': [],
    'a[href*="/videos/"]': [],
    'a[href*="/posts/"]': [entry],
    'a[href*="/permalink/"]': [],
    'a[href*="/share/r/"]': [],
    'a[href*="/share/v/"]': [],
    "h2 a[href]": [source],
    "strong a[href]": [],
    '[role="heading"] a[href]': [],
    '[data-ad-preview="message"]': [body],
    '[data-ad-comet-preview="message"]': [],
    '[data-testid="post_message"]': [],
    '[data-testid*="story"]': [story],
    "h1, h2, h3": [],
    'a[href*="/hashtag/"]': [ownTag, commentTag]
  } });
  const document = documentFixture({
    '[role="article"]': [card],
    '[data-pagelet*="FeedUnit"]': [],
    '[data-pagelet*="Video"]': []
  });
  const run = harness("facebook", "vault-classifier-facebook.js", {
    href: "https://www.facebook.com/",
    hostname: "www.facebook.com",
    pathname: "/"
  }, document);
  run.scan();
  const entryResult = run.collected[0];
  assert("Facebook retains the dedicated post message instead of story comments",
    run.collected.length === 1
      && entryResult.evidence.text === "Post body #post"
      && entryResult.evidence.suppliedTags.join(",") === "#post"
      && !JSON.stringify(entryResult).includes("Comment body"),
    run.collected);
}

// Bilibili: never fall back to the first arbitrary space link on a detail
// document, and retain topics only from a dedicated tag container.
{
  const wrongSource = element({
    tagName: "A",
    href: "https://space.bilibili.com/999",
    text: "Recommended uploader",
    queryAll: { img: [image("https://i0.hdslb.com/recommended-avatar.jpg")] }
  });
  const rootElement = element({ queryAll: { "h1": [element({ text: "Visible video" })], "[title]": [] } });
  const description = element({ text: "Visible description" });
  const wrongOnlyDocument = documentFixture({
    '#v_upinfo a[href*="space.bilibili.com/"]': [],
    '.upinfo-container a[href*="space.bilibili.com/"]': [],
    'a[href*="space.bilibili.com/"]': [wrongSource],
    "#v_desc": [description],
    ".desc-info-text": [],
    '[data-testid="video-desc"]': []
  }, {
    "#viewbox_report": rootElement
  });
  const wrongRun = harness("bilibili", "vault-classifier-bilibili.js", {
    href: "https://www.bilibili.com/video/BV1234567",
    hostname: "www.bilibili.com",
    pathname: "/video/BV1234567"
  }, wrongOnlyDocument);
  const wrongResult = wrongRun.scanPage();
  assert("Bilibili rejects a detail page with only an unrelated uploader link",
    wrongRun.collected.length === 0 && wrongResult?.ready === false,
    { collected: wrongRun.collected, wrongResult });

  const source = element({
    tagName: "A",
    href: "https://space.bilibili.com/123",
    text: "Actual uploader",
    queryAll: { img: [image("https://i0.hdslb.com/actual-avatar.jpg")] }
  });
  const ownTag = element({ text: "Own topic" });
  const unrelatedTag = element({ text: "Recommended topic" });
  const tagContainer = element({ queryAll: { 'a[href*="/v/topic/"]': [ownTag] } });
  const document = documentFixture({
    '#v_upinfo a[href*="space.bilibili.com/"]': [source],
    '.upinfo-container a[href*="space.bilibili.com/"]': [],
    "#v_desc": [description],
    ".desc-info-text": [],
    '[data-testid="video-desc"]': [],
    "#v_tag": [tagContainer],
    ".video-tag-container": [],
    ".tag-panel": [],
    ".video-tag": [],
    'a[href*="/v/topic/"]': [unrelatedTag, ownTag]
  }, {
    "#viewbox_report": rootElement
  });
  const run = harness("bilibili", "vault-classifier-bilibili.js", {
    href: "https://www.bilibili.com/video/BV1234567",
    hostname: "www.bilibili.com",
    pathname: "/video/BV1234567"
  }, document);
  run.scanPage();
  const entryResult = run.collected[0];
  assert("Bilibili binds uploader and topics to dedicated controls",
    run.collected.length === 1
      && entryResult.evidence.metadata.sourceURL === "https://space.bilibili.com/123"
      && entryResult.evidence.suppliedTags.join(",") === "Own topic"
      && !JSON.stringify(entryResult).includes("Recommended"),
    run.collected);
}

// Discord: a reply preview or embed markup is not a substitute for the
// message's own stable content node.
{
  const server = element({
    attrs: { "aria-label": "Testing server" },
    queryAll: { img: [image("https://cdn.discordapp.com/icons/123456789012/server.png")] }
  });
  const ownContent = element({ id: "message-content-234567890123", text: "Own server message" });
  const replyMarkup = element({ text: "Quoted reply preview" });
  const ownMessage = element({
    id: "chat-messages-234567890123",
    queryOne: { "#message-content-234567890123": ownContent },
    queryAll: { '[class*="markup"]': [replyMarkup] }
  });
  const replyOnlyMessage = element({
    id: "chat-messages-345678901234",
    queryOne: { "#message-content-345678901234": null },
    queryAll: { '[class*="markup"]': [replyMarkup] }
  });
  const serverSelector = '[data-list-item-id="guildsnav___123456789012"]';
  const document = documentFixture({
    'li[id^="chat-messages-"]': [replyOnlyMessage, ownMessage],
    '[role="listitem"][id^="chat-messages-"]': []
  }, {
    [serverSelector]: server
  });
  const run = harness("discord", "vault-classifier-discord.js", {
    href: "https://discord.com/channels/123456789012/987654321098",
    hostname: "discord.com",
    pathname: "/channels/123456789012/987654321098"
  }, document);
  run.scan();
  assert("Discord collects only each message's own content node",
    run.collected.length === 1
      && run.collected[0].evidence.text === "Own server message"
      && !JSON.stringify(run.collected).includes("Quoted reply"),
    run.collected);
}

console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
if (failures) process.exitCode = 1;
