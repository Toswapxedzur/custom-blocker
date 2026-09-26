/* Platform profile regression tests (jsc-compatible).
 *
 * These cover the non-YouTube URL classifications, page matchers, and the
 * mapping from a page's generic video form to the custom-rule API slot. The
 * latter is intentionally tested here because TikTok calls its short videos
 * "videos" and Twitch calls channel-path live streams "streams".
 */

load("platform-profiles.js");
load("tests/log.js");

const log = globalThis.__cbTestLog.makeLogger({ colour: true });

function assert(name, cond, data) {
  if (cond) log.pass(name, data);
  else log.fail(name, data);
  return Boolean(cond);
}

function assertEqual(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    log.pass(name);
    return true;
  }
  log.fail(name, { expected, actual });
  return false;
}

function pageContext(hostname, pathname) {
  const url = "https://" + hostname + pathname;
  const video = detectVideoSiteContext(hostname, pathname);
  return {
    hostname,
    pathname,
    url,
    isYouTubePage: false,
    platformAuthors: normalizePlatformAuthorsMap({}, pathname, url),
    isRedditPage: isRedditHost(hostname),
    redditSubreddit: parseRedditSubredditFromPath(pathname),
    isDiscordPage: isDiscordHost(hostname),
    discordServerId: parseDiscordServerIdFromPath(pathname),
    discordChannelId: parseDiscordChannelIdFromPath(pathname),
    isTwitterPage: isTwitterHost(hostname),
    videoSite: video.site,
    videoForm: video.form
  };
}

function videoGroup(groupType, videoMode) {
  return {
    groupType,
    blockHomePage: false,
    sourceMode: "all",
    sources: [],
    platformVideoMode: videoMode
  };
}

log.section("P1: non-YouTube URL classification");
assertEqual("TikTok video is short", detectVideoSiteContext("www.tiktok.com", "/@focus/video/123"),
  { site: "tiktok", form: "short" });
assertEqual("Instagram reel is short", detectVideoSiteContext("www.instagram.com", "/reel/ABC/"),
  { site: "instagram", form: "short" });
assertEqual("Instagram post is post", detectVideoSiteContext("www.instagram.com", "/p/ABC/"),
  { site: "instagram", form: "post" });
assertEqual("Reddit post permalink is post", detectVideoSiteContext("www.reddit.com", "/r/OpenAI/comments/abc123/title/"),
  { site: "reddit", form: "post" });
assertEqual("Reddit feed is unknown", detectVideoSiteContext("www.reddit.com", "/r/all/"),
  { site: "reddit", form: "unknown" });
assertEqual("Bilibili BV video is long", detectVideoSiteContext("www.bilibili.com", "/video/BV16zhJ6KEht/"),
  { site: "bilibili", form: "long" });
assertEqual("Bilibili av video is long", detectVideoSiteContext("www.bilibili.com", "/video/av170001"),
  { site: "bilibili", form: "long" });
assertEqual("Bilibili search is unknown", detectVideoSiteContext("search.bilibili.com", "/all"),
  { site: "bilibili", form: "unknown" });
assertEqual("X status permalink is post", detectVideoSiteContext("x.com", "/BrawlStars/status/2102730439869837540"),
  { site: "twitter", form: "post" });
assertEqual("X home is unknown", detectVideoSiteContext("x.com", "/home"), { site: "twitter", form: "unknown" });
assertEqual("X status maps to the posts slot", platformVideoFormToSlot("twitter", "post"), "posts");
assert("X feed profile names the status permalink as its href",
  PLATFORM_PROFILES.twitter.feed.hrefSelectors.includes('a[href*="/status/"]'));
assertEqual("Reddit post maps to the posts slot", platformVideoFormToSlot("reddit", "post"), "posts");
assertEqual("Bilibili video maps to the videos slot", platformVideoFormToSlot("bilibili", "long"), "videos");
assert("Bilibili feed containers include the watch page's up-next card",
  PLATFORM_PROFILES.bilibili.feed.containerSelectors.includes(".video-page-card-small"));
assert("Reddit feed profile names the post permalink as its href",
  PLATFORM_PROFILES.reddit.feed.hrefSelectors.includes('a[href*="/comments/"]'));
assertEqual("Facebook shared reel is short", detectVideoSiteContext("www.facebook.com", "/share/r/abc/"),
  { site: "facebook", form: "short" });
assertEqual("Facebook shared video is long", detectVideoSiteContext("www.facebook.com", "/share/v/abc/"),
  { site: "facebook", form: "long" });
assertEqual("Facebook /videos page is long", detectVideoSiteContext("www.facebook.com", "/videos/123/"),
  { site: "facebook", form: "long" });
assertEqual("Facebook share routes are not treated as creator names",
  normalizeSourceInput("/share/v/abc", "facebook"), null);
assertEqual("Twitch creator path is a stream form", detectVideoSiteContext("www.twitch.tv", "/some_streamer"),
  { site: "twitch", form: "post" });

log.section("P2: custom-rule slot mapping");
assertEqual("TikTok short-form maps to the videos helper slot",
  platformVideoFormToSlot("tiktok", "short"), "videos");
assertEqual("Instagram reel maps to the shorts helper slot",
  platformVideoFormToSlot("instagram", "short"), "shorts");
assertEqual("Facebook post maps to the posts helper slot",
  platformVideoFormToSlot("facebook", "post"), "posts");
assertEqual("Twitch channel-path stream maps to the streams helper slot",
  platformVideoFormToSlot("twitch", "post"), "streams");
assertEqual("Twitch clip maps to the shorts helper slot",
  platformVideoFormToSlot("twitch", "short"), "shorts");
assertEqual("Instagram legacy TV has no exposed custom helper slot",
  platformVideoFormToSlot("instagram", "long"), null);

log.section("P2b: a platform entry stays on its own platform (owner 2026-09-26)");
assert("a YouTube Shorts form never matches a TikTok video",
  !matchesProfileGroup(videoGroup("youtube", "short"), pageContext("www.tiktok.com", "/@focus/video/123")));
assert("a YouTube Posts form never matches a Reddit post or an X status",
  !matchesProfileGroup(videoGroup("youtube", "post"), pageContext("www.reddit.com", "/r/news/comments/1/x/"))
  && !matchesProfileGroup(videoGroup("youtube", "post"), pageContext("x.com", "/bbc/status/1")));
assert("a YouTube Shorts form still matches YouTube Shorts",
  matchesProfileGroup(videoGroup("youtube", "short"), Object.assign(pageContext("www.youtube.com", "/shorts/abc"), { isYouTubePage: true })));
assert("YouTube's own routes are not creators",
  normalizeYouTubeCreatorInput("/results") === null && normalizeYouTubeCreatorInput("/gaming") === null
  && normalizeYouTubeCreatorInput("/@alice/videos") === "alice" && normalizeYouTubeCreatorInput("/SomeName") === "somename");

log.section("P3: non-YouTube platform groups match their pages");
assert("TikTok short group matches a TikTok video",
  matchesProfileGroup(videoGroup("tiktok", "short"), pageContext("www.tiktok.com", "/@focus/video/123")));
assert("Instagram reel group matches an Instagram reel",
  matchesProfileGroup(videoGroup("instagram", "short"), pageContext("www.instagram.com", "/reel/ABC/")));
assert("Facebook long-video group matches the new /share/v URL",
  matchesProfileGroup(videoGroup("facebook", "long"), pageContext("www.facebook.com", "/share/v/abc/")));
assert("Twitch stream group matches a creator path",
  matchesProfileGroup(videoGroup("twitch", "post"), pageContext("www.twitch.tv", "/some_streamer")));

const reddit = pageContext("www.reddit.com", "/r/focus/comments/123/test/");
assert("Reddit include group matches its subreddit", matchesProfileGroup({
  groupType: "reddit", blockHomePage: false, sourceMode: "include", sources: ["focus"]
}, reddit));
assert("Reddit exclude group leaves its listed subreddit alone", !matchesProfileGroup({
  groupType: "reddit", blockHomePage: false, sourceMode: "exclude", sources: ["focus"]
}, reddit));
assert("Reddit nobody group blocks no subreddit (tag filter only)", !matchesProfileGroup({
  groupType: "reddit", blockHomePage: false, sourceMode: "nobody", sources: ["focus"]
}, reddit));
assertEqual("the page context carries the subreddit as Reddit's source", reddit.platformAuthors.reddit, ["focus"]);
assertEqual("a legacy Reddit list with no mode reads as include", normalizeSourceMode(undefined, ["focus"]), "include");
assertEqual("the legacy author mode 'none' reads as all", normalizeSourceMode("none"), "all");
assertEqual("subreddit input normalizes through the shared source normalizer", normalizeSourceInput("r/Focus", "reddit"), "focus");

const discord = pageContext("discord.com", "/channels/123456789012/987654321098");
assert("Discord include group matches a channel target", matchesProfileGroup({
  groupType: "discord", blockHomePage: false, discordMode: "include", discordTargets: ["987654321098"]
}, discord));

const twitter = pageContext("x.com", "/focus_account");
assert("X include group matches a profile handle", matchesProfileGroup({
  groupType: "twitter", blockHomePage: false, sourceMode: "include", sources: ["focus_account"]
}, twitter));

log.section("P4: public feed adapters share author matching without video forms");
const feedAdapters = [
  ["bluesky", "bsky.app", "/profile/focus.test", "focus.test"],
  ["threads", "threads.com", "/@focus", "focus"],
  ["substack", "substack.com", "/@focus", "focus"],
  ["bilibili", "www.bilibili.com", "/space/123456", "space:123456"],
  ["rumble", "rumble.com", "/user/focus", "user:focus"],
  ["pinterest", "www.pinterest.com", "/focus/", "focus"],
  ["kick", "kick.com", "/focus", "focus"],
  ["tumblr", "focus.tumblr.com", "/post/123/example", "blog:focus"],
  ["peertube", "peertube.tv", "/a/focus", "account:focus"],
  ["pixelfed", "pixelfed.social", "/focus", "focus"],
  ["kuaishou", "www.kuaishou.com", "/profile/abc123", "profile:abc123"]
];
for (const [groupType, hostname, pathname, author] of feedAdapters) {
  const context = pageContext(hostname, pathname);
  assert(groupType + " is available in the unified Platform selector", PLATFORM_GROUP_TYPES.includes(groupType));
  assertEqual(groupType + " normalizes its public author route", context.platformAuthors[groupType], [author]);
  assert(groupType + " include group matches its public author page", matchesProfileGroup({
    groupType, blockHomePage: false, sourceMode: "include", sources: [author]
  }, context));
}
assertEqual("Substack accepts a direct publication URL",
  normalizeSourceInput("https://focus.substack.com/p/example", "substack"), "focus");
assert("PeerTube does not overreach to unverified federation instances",
  !isPlatformHost("peertube", "example.peertube.instance"));
assert("Pixelfed does not overreach to unverified federation instances",
  !isPlatformHost("pixelfed", "example.pixelfed.social.example"));

log.section("P5: feed profiles retain platform-specific card anchors");
for (const platform of ["tiktok", "facebook", "instagram", "twitch"]) {
  const feed = PLATFORM_PROFILES[platform]?.feed;
  assert(platform + " has card anchor selectors", Array.isArray(feed?.anchorSelectors) && feed.anchorSelectors.length > 0);
  assert(platform + " has href selectors", Array.isArray(feed?.hrefSelectors) && feed.hrefSelectors.length > 0);
  assert(platform + " has a card-container fallback", Array.isArray(feed?.containerSelectors) && feed.containerSelectors.length > 0);
}
assert("Twitch includes live preview-card links", PLATFORM_PROFILES.twitch.feed.anchorSelectors.includes(
  'a[data-a-target="preview-card-image-link"]'
));

log.section("P6: content controls expose only recorded card types");
const verifiedCardPlatforms = PLATFORM_GROUP_TYPES.filter((platform) =>
  PLATFORM_PROFILES[platform]?.feed?.surfaceHideCards === true
);
for (const platform of verifiedCardPlatforms) {
  const entries = getSurfaceHideEntries(platform);
  const ids = entries.map((entry) => entry.id);
  assert(platform + " exposes an all-content-cards control", ids.includes("all-content-cards"));
  assertEqual(platform + " retains combined surface selections",
    normalizeSurfaceHides(["all-content-cards", "all-content-cards", "not-a-control"], platform),
    ["all-content-cards"]);
  assert(platform + " emits a dedicated all-content-cards directive", getSurfaceHideSelectors(
    platform, ["all-content-cards"], "app"
  ).includes(getSurfaceFeedCardsDirective(platform)));
}
assertEqual("only YouTube retains the legacy all-card control",
  verifiedCardPlatforms.sort(), ["youtube"]);
assertEqual("all-content-cards directives parse back to their platform",
  parseSurfaceFeedCardsDirective(getSurfaceFeedCardsDirective("pixelfed")), "pixelfed");
assertEqual("untrusted surface directives fail closed",
  parseSurfaceFeedCardsDirective("__cb_surface_feed_cards__:not-a-platform"), null);
assert("YouTube exposes independent ads and recommendations controls", ["ads-sponsored", "recommendations"].every(
  (id) => getSurfaceHideEntries("youtube").some((entry) => entry.id === id)
));
assert("Bilibili records its four verified homepage card types", (() => {
  const ids = getSurfaceHideEntries("bilibili").map((entry) => entry.id);
  return ["ads-sponsored", "live-streams", "recommendations", "featured-carousel"].every(
    (id) => ids.includes(id)
  ) && !ids.includes("all-content-cards");
})());
assert("Bilibili keeps sponsored videos separate from ordinary recommendations", (() => {
  const selectors = getSurfaceHideSelectors("bilibili", ["ads-sponsored", "recommendations"], "app");
  return selectors.includes('.bili-video-card:has(a[href*="cm.bilibili.com"])') &&
    selectors.includes('.bili-video-card:not(:has(a[href*="cm.bilibili.com"]))');
})());
assert("Bilibili's live and carousel controls stay scoped to their actual cards", (() => {
  const selectors = getSurfaceHideSelectors("bilibili", ["live-streams", "featured-carousel"], "app");
  return selectors.includes('.floor-single-card:has(a[href*="live.bilibili.com"])') &&
    selectors.includes(".carousel-area");
})());
assertEqual("Bilibili migrates its old blank-feed choice to recorded card types",
  normalizeSurfaceHides(["all-content-cards"], "bilibili"),
  ["ads-sponsored", "live-streams", "recommendations", "featured-carousel"]);
assert("PeerTube exposes separate ordinary-video and live-card controls", (() => {
  const ids = getSurfaceHideEntries("peertube").map((entry) => entry.id);
  return ids.includes("live-streams") && ids.includes("video-cards") &&
    !ids.includes("ads-sponsored") && !ids.includes("recommendations") && !ids.includes("all-content-cards");
})());
assertEqual("PeerTube migrates its old blank-feed choice to both card types",
  normalizeSurfaceHides(["all-content-cards"], "peertube"),
  ["live-streams", "video-cards"]);
assert("PeerTube's live-card selector stays scoped to a video-card host", getSurfaceHideSelectors(
  "peertube", ["live-streams"], "app"
).includes("my-video-miniature:has(.live-overlay.live-streaming)"));
assert("PeerTube's ordinary-video selector excludes its live-card variant", getSurfaceHideSelectors(
  "peertube", ["video-cards"], "app"
).includes("my-video-miniature:not(:has(.live-overlay.live-streaming))"));
for (const platform of PLATFORM_GROUP_TYPES.filter((platform) => !verifiedCardPlatforms.includes(platform))) {
  assert(platform + " omits the legacy all-content-cards control", !getSurfaceHideEntries(
    platform
  ).some((entry) => entry.id === "all-content-cards"));
}
assert("TikTok omits unverified category controls", !getSurfaceHideEntries("tiktok").some(
  (entry) => entry.id === "ads-sponsored" || entry.id === "comments-replies"
));

const counts = log.counts();
log.summary("─".repeat(60));
log.summary(
  "PLATFORM PROFILE TOTAL " + counts.total +
  "  PASS " + counts.pass +
  "  FAIL " + counts.fail +
  "  SKIP " + counts.skip
);
if (counts.fail > 0) {
  log.summary("__CB_TEST_RESULT__: FAIL");
  throw new Error("platform profile tests failed");
}
log.summary("__CB_TEST_RESULT__: OK");
