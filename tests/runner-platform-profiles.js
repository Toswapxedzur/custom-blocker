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
    platformAuthorMode: "all",
    platformAuthors: [],
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
assertEqual("Facebook shared reel is short", detectVideoSiteContext("www.facebook.com", "/share/r/abc/"),
  { site: "facebook", form: "short" });
assertEqual("Facebook shared video is long", detectVideoSiteContext("www.facebook.com", "/share/v/abc/"),
  { site: "facebook", form: "long" });
assertEqual("Facebook /videos page is long", detectVideoSiteContext("www.facebook.com", "/videos/123/"),
  { site: "facebook", form: "long" });
assertEqual("Facebook share routes are not treated as creator names",
  normalizePlatformAuthorInput("/share/v/abc", "facebook"), null);
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
  groupType: "reddit", blockHomePage: false, redditMode: "include", redditSubreddits: ["focus"]
}, reddit));

const discord = pageContext("discord.com", "/channels/123456789012/987654321098");
assert("Discord include group matches a channel target", matchesProfileGroup({
  groupType: "discord", blockHomePage: false, discordMode: "include", discordTargets: ["987654321098"]
}, discord));

const twitter = pageContext("x.com", "/focus_account");
assert("X include group matches a profile handle", matchesProfileGroup({
  groupType: "twitter", blockHomePage: false, platformAuthorMode: "include", platformAuthors: ["focus_account"]
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
    groupType, blockHomePage: false, platformAuthorMode: "include", platformAuthors: [author]
  }, context));
}
assertEqual("Substack accepts a direct publication URL",
  normalizePlatformAuthorInput("https://focus.substack.com/p/example", "substack"), "focus");
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

log.section("P6: surface hides are composable only across verified card boundaries");
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
assertEqual("only live-verified card profiles expose a blank-feed control",
  verifiedCardPlatforms.sort(), ["bilibili", "peertube", "youtube"]);
assertEqual("all-content-cards directives parse back to their platform",
  parseSurfaceFeedCardsDirective(getSurfaceFeedCardsDirective("pixelfed")), "pixelfed");
assertEqual("untrusted surface directives fail closed",
  parseSurfaceFeedCardsDirective("__cb_surface_feed_cards__:not-a-platform"), null);
assert("YouTube exposes independent ads and recommendations controls", ["ads-sponsored", "recommendations"].every(
  (id) => getSurfaceHideEntries("youtube").some((entry) => entry.id === id)
));
assert("PeerTube exposes a live-card control without implying ads or recommendations", (() => {
  const ids = getSurfaceHideEntries("peertube").map((entry) => entry.id);
  return ids.includes("live-streams") && !ids.includes("ads-sponsored") && !ids.includes("recommendations");
})());
assertEqual("PeerTube retains its live-card and blank-feed selections together",
  normalizeSurfaceHides(["live-streams", "all-content-cards"], "peertube"),
  ["live-streams", "all-content-cards"]);
assert("PeerTube's live-card selector stays scoped to a video-card host", getSurfaceHideSelectors(
  "peertube", ["live-streams"], "app"
).includes("my-video-miniature:has(.live-overlay.live-streaming)"));
for (const platform of PLATFORM_GROUP_TYPES.filter((platform) => !verifiedCardPlatforms.includes(platform))) {
  assert(platform + " omits all-content-cards without a live-verified card boundary", !getSurfaceHideEntries(
    platform
  ).some((entry) => entry.id === "all-content-cards"));
}
assert("TikTok omits unverified category controls", !getSurfaceHideEntries("tiktok").some(
  (entry) => entry.id === "ads-sponsored" || entry.id === "comments-replies"
));

log.section("P7: YouTube creator-tag verdicts are state-aware and fail open");
const taggedSlugs = ["gaming", "gaming-genres-fps"];
assert("tagInclude matches a selected tag on a classified creator",
  matchesYouTubeTagSelection("tagInclude", ["gaming"], "tagged", taggedSlugs));
assert("tagInclude does not match a different tag",
  !matchesYouTubeTagSelection("tagInclude", ["music"], "tagged", taggedSlugs));
assert("tagExclude matches a classified creator carrying none of the selected tags",
  matchesYouTubeTagSelection("tagExclude", ["music"], "tagged", taggedSlugs));
assert("tagExclude does not match a classified creator carrying a selected tag",
  !matchesYouTubeTagSelection("tagExclude", ["gaming"], "tagged", taggedSlugs));
for (const unresolved of ["unknown", "pending", "below_floor", null]) {
  assert("tagExclude fails open for " + String(unresolved),
    !matchesYouTubeTagSelection("tagExclude", ["music"], unresolved, []));
  assert("tagInclude fails open for " + String(unresolved),
    !matchesYouTubeTagSelection("tagInclude", ["gaming"], unresolved, taggedSlugs));
}

const youtubeTagPage = {
  ...pageContext("www.youtube.com", "/watch?v=abcdefghijk"),
  isYouTubePage: true,
  videoSite: "youtube",
  videoForm: "long",
  channelTagState: "tagged",
  channelTagsKnown: true,
  channelTags: taggedSlugs
};
assert("YouTube tagInclude participates in the canonical page matcher",
  matchesProfileGroup({
    groupType: "youtube", blockHomePage: false, platformVideoMode: "long",
    platformAuthorMode: "tagInclude", platformAuthorTags: ["gaming"]
  }, youtubeTagPage));
assert("YouTube tagExclude page matcher fails open while pending",
  !matchesProfileGroup({
    groupType: "youtube", blockHomePage: false, platformVideoMode: "long",
    platformAuthorMode: "tagExclude", platformAuthorTags: ["music"]
  }, { ...youtubeTagPage, channelTagState: "pending", channelTagsKnown: false, channelTags: [] }));
assert("Entry-scoped surface rules share the creator-tag predicate",
  platformGroupAuthorAxisMatchesPage({
    groupType: "youtube", platformAuthorMode: "tagInclude", platformAuthorTags: ["gaming"]
  }, youtubeTagPage));

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
