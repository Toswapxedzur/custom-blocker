/* Custom Web Blocker — platform helper test runner (jsc-compatible).
 *
 * Run with:
 *   tests/run.sh
 *
 * The runner exercises createEventPlatformHelper and PLATFORM_API_SPEC
 * with a structured log. Each test case asserts either a positive
 * (method exists and behaves) or a negative (method is absent and
 * calling it throws TypeError). Negative tests are how we enforce the
 * "twitch().hidePosts is a TypeError, not a no-op" guarantee.
 */

load("helpers.js");
load("tests/log.js");

const H = globalThis.__customBlockerHelpers;
const log = globalThis.__cbTestLog.makeLogger({ colour: true });

// ────────────────────────────────────────────────────────────────────────
// Tiny assertion harness. We intentionally don't import a framework —
// jsc has no module system and we want the runner to be ~one file with
// zero deps. assertX functions report into the structured log.
// ────────────────────────────────────────────────────────────────────────
function assert(name, cond, data) {
  if (cond) log.pass(name, data);
  else log.fail(name, data);
  return Boolean(cond);
}

function assertThrows(name, fn, expectedKind) {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  if (!threw) {
    log.fail(name, { expected: "throw " + (expectedKind || "any"), got: "did not throw" });
    return false;
  }
  if (expectedKind && !(threw instanceof expectedKind)) {
    log.fail(name, {
      expected: "throw " + (expectedKind.name || expectedKind),
      got: String(threw && threw.constructor && threw.constructor.name)
    });
    return false;
  }
  log.pass(name, { threw: String(threw && threw.message) });
  return true;
}

function assertEqual(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    log.pass(name);
    return true;
  }
  log.fail(name, { expected, actual });
  return false;
}

// ────────────────────────────────────────────────────────────────────────
// Fixture builder. A fresh helper bundle per test means scenarios cannot
// leak slot state between each other.
// ────────────────────────────────────────────────────────────────────────
function makeFixture(snapshotByPlatform = {}) {
  const accumulator = {};
  const persistentBucket = {};
  const accumulatorRef = { get: () => accumulator };
  const dispatchContextRef = () => ({ platformSnapshot: snapshotByPlatform });
  const platformHelpers = H.createEventPlatformHelper(
    accumulatorRef,
    dispatchContextRef,
    persistentBucket
  );
  return { accumulator, persistentBucket, platformHelpers };
}

function intentsFor(accumulator, platform) {
  const out = [];
  for (const i of accumulator.intents || []) {
    if (i && i.kind === "platform" && i.platform === platform) out.push(i.intent);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────
// Scenarios.
// ────────────────────────────────────────────────────────────────────────

log.section("S1: gating — methods absent on a platform throw TypeError");
{
  const { platformHelpers } = makeFixture();
  // YouTube has all three "hide*" content methods.
  assert("youtube().hideShorts is a function",
    typeof platformHelpers.youtube().hideShorts === "function");
  assert("youtube().hidePosts is a function",
    typeof platformHelpers.youtube().hidePosts === "function");

  // TikTok: no "Posts", no "Shorts" surface, no "Shorts button" toggle.
  const tiktok = platformHelpers.tiktok();
  assert("tiktok().hidePosts is undefined", tiktok.hidePosts === undefined);
  assert("tiktok().hideShorts is undefined", tiktok.hideShorts === undefined);
  assert("tiktok().hideReels is undefined", tiktok.hideReels === undefined);
  assert("tiktok().hideShortButton is undefined", tiktok.hideShortButton === undefined);
  assertThrows("tiktok().hidePosts() throws TypeError",
    () => platformHelpers.tiktok().hidePosts(() => true), TypeError);
  assertThrows("tiktok().hideShortButton() throws TypeError",
    () => platformHelpers.tiktok().hideShortButton(), TypeError);

  // Instagram: uses "Reels", not "Shorts".
  const ig = platformHelpers.instagram();
  assert("instagram().hideReels is a function", typeof ig.hideReels === "function");
  assert("instagram().hideShorts is undefined", ig.hideShorts === undefined);
  assertThrows("instagram().hideShorts() throws TypeError",
    () => platformHelpers.instagram().hideShorts(() => true), TypeError);

  // Twitch: no posts. hideComments is exposed and maps to STREAM CHAT
  // (Twitch's nearest analogue to comments) — see __cb_PLATFORM_CSS in
  // content.js, which already targets the chat container under the
  // "comments" intent. filterComments is intentionally NOT exposed
  // because Twitch chat doesn't have a per-message scraper yet.
  const tw = platformHelpers.twitch();
  assert("twitch().hidePosts is undefined", tw.hidePosts === undefined);
  assert("twitch().hideComments is a function (chat)",
    typeof tw.hideComments === "function");
  assert("twitch().showComments is a function",
    typeof tw.showComments === "function");
  assert("twitch().filterComments is undefined (no per-msg scraper)",
    tw.filterComments === undefined);
  assert("twitch().hideClips is a function", typeof tw.hideClips === "function");
  assert("twitch().hideStreams is a function", typeof tw.hideStreams === "function");
  assert("twitch().hideVideos is a function (VODs)", typeof tw.hideVideos === "function");
  assertThrows("twitch().hidePosts() throws TypeError",
    () => platformHelpers.twitch().hidePosts(() => true), TypeError);
}

log.section("S2: aliases write to the same internal slot");
{
  const { accumulator, persistentBucket, platformHelpers } = makeFixture();
  platformHelpers.instagram().hideReels((it) => it.bad === true, { blockPageOnVisit: true });
  platformHelpers.twitch().hideClips((it) => it.short === true);
  platformHelpers.twitch().hideStreams((it) => it.live === true);
  platformHelpers.facebook().hideReels((it) => true);

  // Verify intents recorded with the right slot names.
  assertEqual("instagram intent slot is 'shorts'",
    intentsFor(accumulator, "instagram").map((x) => x.slot), ["shorts"]);
  assertEqual("twitch intents slots are ['shorts','streams']",
    intentsFor(accumulator, "twitch").map((x) => x.slot), ["shorts", "streams"]);
  assertEqual("facebook intent slot is 'shorts'",
    intentsFor(accumulator, "facebook").map((x) => x.slot), ["shorts"]);

  // Verify persistent bucket holds the predicates under the same slot.
  assert("persistentBucket.instagram.shorts has predicate",
    typeof persistentBucket.instagram?.shorts?.predicate === "function");
  assert("persistentBucket.twitch.shorts has predicate",
    typeof persistentBucket.twitch?.shorts?.predicate === "function");
  assert("persistentBucket.twitch.streams has predicate",
    typeof persistentBucket.twitch?.streams?.predicate === "function");
  assert("persistentBucket.facebook.shorts has predicate",
    typeof persistentBucket.facebook?.shorts?.predicate === "function");

  // blockPageOnVisit option threads through to both intent and bucket.
  const igIntent = intentsFor(accumulator, "instagram")[0];
  assertEqual("instagram intent.blockPageOnVisit === true",
    igIntent.blockPageOnVisit, true);
  assertEqual("instagram persistent.blockPageOnVisit === true",
    persistentBucket.instagram.shorts.blockPageOnVisit, true);
}

log.section("S3: single-slot semantics — last writer wins, show() clears");
{
  const { persistentBucket, platformHelpers } = makeFixture();
  const yt = platformHelpers.youtube();
  const p1 = (it) => it.tag === "first";
  const p2 = (it) => it.tag === "second";
  yt.hideVideos(p1);
  yt.hideVideos(p2);
  assert("after two hideVideos calls, slot stores the LAST predicate",
    persistentBucket.youtube.videos.predicate === p2);
  assert("first predicate is no longer reachable",
    persistentBucket.youtube.videos.predicate !== p1);

  yt.showVideos();
  assert("after showVideos(), persistent slot is null",
    persistentBucket.youtube.videos === null);
}

log.section("S4: cross-platform isolation");
{
  const { persistentBucket, platformHelpers } = makeFixture();
  platformHelpers.youtube().hideVideos((it) => true);
  platformHelpers.facebook().hideVideos((it) => false);
  assert("youtube.videos predicate exists",
    typeof persistentBucket.youtube?.videos?.predicate === "function");
  assert("facebook.videos predicate exists and is different",
    persistentBucket.facebook.videos.predicate !==
      persistentBucket.youtube.videos.predicate);
  // Calling youtube.showVideos() does NOT clear facebook.
  platformHelpers.youtube().showVideos();
  assert("youtube cleared",
    persistentBucket.youtube.videos === null);
  assert("facebook untouched",
    typeof persistentBucket.facebook.videos.predicate === "function");
}

log.section("S5: snapshot accessors gated per platform");
{
  const snapshot = {
    youtube: { subscribed: true, verified: false, live: true, subscribedChannels: ["UC1", "UC2"] },
    twitch: { subscribed: false, live: true, subscribedChannels: ["camman18"] },
    tiktok: { live: false }
  };
  const { platformHelpers } = makeFixture(snapshot);
  assertEqual("youtube.isCurrentChannelSubscribed",
    platformHelpers.youtube().isCurrentChannelSubscribed(), true);
  assertEqual("youtube.isChannelSubscribed('UC1')",
    platformHelpers.youtube().isChannelSubscribed("UC1"), true);
  assertEqual("youtube.isChannelSubscribed('UC9')",
    platformHelpers.youtube().isChannelSubscribed("UC9"), false);
  assertEqual("youtube.isCurrentChannelVerified",
    platformHelpers.youtube().isCurrentChannelVerified(), false);
  assertEqual("youtube.isLiveNow", platformHelpers.youtube().isLiveNow(), true);

  assertEqual("twitch.isCurrentChannelSubscribed",
    platformHelpers.twitch().isCurrentChannelSubscribed(), false);
  assertEqual("twitch.isChannelSubscribed('camman18')",
    platformHelpers.twitch().isChannelSubscribed("camman18"), true);

  // TikTok should NOT expose channel-membership.
  assert("tiktok().isCurrentChannelSubscribed is undefined",
    platformHelpers.tiktok().isCurrentChannelSubscribed === undefined);
  assertThrows("tiktok().isCurrentChannelSubscribed() throws TypeError",
    () => platformHelpers.tiktok().isCurrentChannelSubscribed(), TypeError);

  // Instagram has no live → isLiveNow not exposed.
  assert("instagram().isLiveNow is undefined",
    platformHelpers.instagram().isLiveNow === undefined);
}

log.section("S6: item-property predicates");
{
  const { platformHelpers } = makeFixture();
  const yt = platformHelpers.youtube();
  assertEqual("isItemLive({live:true})", yt.isItemLive({ live: true }), true);
  assertEqual("isItemLive({live:false})", yt.isItemLive({ live: false }), false);
  assertEqual("isItemLive(null)", yt.isItemLive(null), false);
  assertEqual("isAlgorithmicRecommendation({algorithmic:true})",
    yt.isAlgorithmicRecommendation({ algorithmic: true }), true);
  assertEqual("isSponsored({sponsored:1}) (truthy non-true)",
    yt.isSponsored({ sponsored: 1 }), false);
}

log.section("S7: subsection-timer gating + return value");
{
  const { accumulator, platformHelpers } = makeFixture();
  const id = platformHelpers.youtube().setShortsTimer({ id: "shorts-cap" });
  assertEqual("setShortsTimer returns the id", id, "shorts-cap");
  const igId = platformHelpers.instagram().setReelsTimer({ id: "reels-cap" });
  assertEqual("setReelsTimer returns the id", igId, "reels-cap");
  // Timers without an id return null (forces the user to pass one).
  assertEqual("setShortsTimer with no id returns null",
    platformHelpers.youtube().setShortsTimer({}), null);

  // TikTok: no Shorts timer.
  assert("tiktok().setShortsTimer is undefined",
    platformHelpers.tiktok().setShortsTimer === undefined);
  assertThrows("tiktok().setShortsTimer() throws",
    () => platformHelpers.tiktok().setShortsTimer({ id: "x" }), TypeError);

  // Twitch streams timer + clips timer.
  const sId = platformHelpers.twitch().setStreamsTimer({ id: "s" });
  const cId = platformHelpers.twitch().setClipsTimer({ id: "c" });
  assertEqual("twitch.setStreamsTimer returns id", sId, "s");
  assertEqual("twitch.setClipsTimer returns id", cId, "c");

  // Verify the underlying intents were recorded against the right slot.
  const ytIntents = intentsFor(accumulator, "youtube");
  const ytSlots = ytIntents.filter((x) => x.kind === "subsectionTimer").map((x) => x.slot);
  assertEqual("youtube subsection-timer intents map to slots",
    ytSlots, ["shorts", "shorts"]);
}

log.section("S8: URL classifiers always present, regardless of schema");
{
  const { platformHelpers } = makeFixture();
  for (const plat of H.PLATFORM_LIST) {
    const api = platformHelpers[plat]();
    for (const fn of ["isPlatformUrl", "isShortUrl", "isVideoUrl",
                      "isPostUrl", "isHomePage", "extractAuthor",
                      "extractVideoId"]) {
      assert(plat + "()." + fn + " is a function",
        typeof api[fn] === "function");
    }
  }
}

log.section("S9: helpers.listMethods / hasMethod introspection");
{
  const { platformHelpers } = makeFixture();
  const ig = platformHelpers.listMethods("instagram");
  assert("listMethods('instagram') includes hideReels", ig.includes("hideReels"));
  assert("listMethods('instagram') excludes hideShorts", !ig.includes("hideShorts"));
  assert("listMethods('instagram') includes URL classifiers",
    ig.includes("isPlatformUrl") && ig.includes("extractAuthor"));

  assertEqual("hasMethod('twitch','hidePosts') === false",
    platformHelpers.hasMethod("twitch", "hidePosts"), false);
  assertEqual("hasMethod('twitch','hideClips') === true",
    platformHelpers.hasMethod("twitch", "hideClips"), true);
  assertEqual("hasMethod('youtube','hideShortButton') === true",
    platformHelpers.hasMethod("youtube", "hideShortButton"), true);
  assertEqual("hasMethod('tiktok','hideShortButton') === false",
    platformHelpers.hasMethod("tiktok", "hideShortButton"), false);
}

log.section("S10: edge cases that previously could regress silently");
{
  const { accumulator, persistentBucket, platformHelpers } = makeFixture();
  const yt = platformHelpers.youtube();

  // Calling hideVideos with a non-function silently no-ops (pre-existing
  // contract) — verify it really does no-op rather than throwing.
  yt.hideVideos("not a function");
  assertEqual("hideVideos with non-function records no intent",
    intentsFor(accumulator, "youtube").length, 0);
  assert("hideVideos with non-function leaves persistent bucket empty",
    !persistentBucket.youtube || !persistentBucket.youtube.videos);

  // showVideos on an empty slot is harmless.
  yt.showVideos();
  assertEqual("showVideos on empty slot adds exactly one clearPredicates intent",
    intentsFor(accumulator, "youtube").filter(x => x.kind === "clearPredicates").length, 1);

  // showComments clears the comments predicate slot too.
  yt.filterComments((c) => c.author === "spam");
  assert("filterComments installed predicate",
    typeof persistentBucket.youtube?.comments?.predicate === "function");
  yt.showComments();
  assert("showComments cleared the comments slot",
    persistentBucket.youtube.comments === null);

  // Twitch has filterLive but NOT filterComments. hideComments is
  // present (chat) and threads through the standard "comments" intent
  // — verify the recorded intent has the expected shape.
  const tw = platformHelpers.twitch();
  assert("twitch.filterLive is a function", typeof tw.filterLive === "function");
  assert("twitch.filterComments is undefined", tw.filterComments === undefined);
  assertThrows("twitch.filterComments() throws TypeError",
    () => platformHelpers.twitch().filterComments(() => true), TypeError);

  const { accumulator: twAcc, platformHelpers: ph2 } = makeFixture();
  ph2.twitch().hideComments();
  const twIntents = intentsFor(twAcc, "twitch");
  assertEqual("twitch.hideComments() records {kind:'comments',value:'hide'}",
    twIntents, [{ kind: "comments", value: "hide" }]);
  ph2.twitch().showComments();
  const twIntents2 = intentsFor(twAcc, "twitch");
  assertEqual("twitch.showComments() appends {kind:'comments',value:'show'}",
    twIntents2[1], { kind: "comments", value: "show" });
}

// ────────────────────────────────────────────────────────────────────────
// Final summary.
// ────────────────────────────────────────────────────────────────────────
const counts = log.counts();
log.summary("─".repeat(60));
log.summary(
  "TOTAL " + counts.total +
  "  PASS " + counts.pass +
  "  FAIL " + counts.fail +
  "  SKIP " + counts.skip
);
if (counts.fail > 0) {
  log.summary("FAILED");
  // jsc has no process.exit; rely on shell wrapper to scan stdout.
  print("__CB_TEST_RESULT__: FAILED");
} else {
  log.summary("OK");
  print("__CB_TEST_RESULT__: OK");
}
