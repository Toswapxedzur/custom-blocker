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
// S11: handler deadline + per-dispatch caps. Verifies that a runaway
// rule cannot freeze the browser.
// ────────────────────────────────────────────────────────────────────────
log.section("S11: deadline + caps protect Chrome from runaway rules");
{
  // The log helper is the canonical entry point — it's the most likely
  // surface a runaway loop hits. Build one with a fresh accumulator and
  // make sure it both caps log volume AND throws after the deadline.
  const acc = {};
  const accRef = { get: () => acc };
  const logHelper = H.createEventLogHelper("g1", accRef);

  // Drive the cap: 200 logs allowed, the next push should drop silently.
  for (let i = 0; i < 250; i++) logHelper.log("entry " + i);
  assertEqual("h.log() drops after the per-dispatch cap (200)",
    (acc.logs || []).length, 200);
  assert("h.log() records dropped overage in accumulator.logsDropped",
    acc.logsDropped >= 50);

  // Drive the deadline: a tight loop calling h.log() should throw
  // HandlerBudgetExceededError after ~1s, NOT lock up.
  const acc2 = {};
  const accRef2 = { get: () => acc2 };
  acc2._handlerDeadline = (typeof performance !== "undefined" && performance.now)
    ? performance.now() - 1
    : Date.now() - 1;
  // already-past deadline → first push must throw immediately.
  const helper2 = H.createEventLogHelper("g2", accRef2);
  let threw = null;
  try { helper2.log("should-throw"); } catch (e) { threw = e; }
  assert("h.log() throws when accumulator deadline is in the past",
    Boolean(threw && threw.__customBlockerBudgetAbort));

  // Once _handlerOverrun is sticky, every later helper call also throws —
  // user code can't escape the abort by wrapping in try/catch.
  let secondThrew = null;
  try { helper2.log("still-aborted"); } catch (e) { secondThrew = e; }
  assert("h.log() keeps throwing after first overrun (sticky abort)",
    Boolean(secondThrew && secondThrew.__customBlockerBudgetAbort));

  // DOM helper applies the same cap + deadline.
  const acc3 = {};
  const accRef3 = { get: () => acc3 };
  const dom = H.createDOMHelper(accRef3);
  for (let i = 0; i < 300; i++) dom.hide("#x" + i);
  assertEqual("dom.hide() caps domOps at 256",
    (acc3.domOps || []).length, 256);

  // Tab helper intent cap.
  const acc4 = {};
  const accRef4 = { get: () => acc4 };
  const dispatchCtxRef4 = () => ({ tabsSnapshot: [] });
  const tabs = H.createTabHelper(accRef4, dispatchCtxRef4);
  for (let i = 0; i < 300; i++) tabs.requestRefresh();
  assertEqual("tabs.requestRefresh() caps intents at 256",
    (acc4.intents || []).length, 256);

  // Helper-deadline integration with DOM: a past deadline causes
  // dom.hide() to throw, exactly like h.log().
  const acc5 = { _handlerDeadline: -1 };
  const dom5 = H.createDOMHelper({ get: () => acc5 });
  let domThrew = null;
  try { dom5.hide("#anything"); } catch (e) { domThrew = e; }
  assert("dom.hide() throws when accumulator deadline is in the past",
    Boolean(domThrew && domThrew.__customBlockerBudgetAbort));
}

// ────────────────────────────────────────────────────────────────────────
// S12: timer helper auto-ticks using per-dispatch elapsedMs.
// Regression for "always currentMs: 3000 even after 3s of dispatches"
// — proves the timer helper now reads the live dispatchContext rather
// than the stale 0 it was constructed with.
// ────────────────────────────────────────────────────────────────────────
log.section("S12: timer helper auto-ticks per-dispatch");
{
  // Simulate the sandbox plumbing: a single mutable dispatch context
  // and timersBucket. createEventGroupHelpers takes thunks that read
  // the live context, so we mutate `dc` between simulated dispatches.
  const dc = {
    currentUrl: "https://example.com/",
    elapsedMs: 0,
    tickedSet: new Set(),
    displayedSet: new Set()
  };
  const timersBucket = {};
  const helpers = H.createEventGroupHelpers({
    groupId: "g-timer",
    timersBucket,
    persistenceBucket: {},
    dispatchContextRef: () => dc
  });
  const t = helpers.getTimerHelper();

  // Create a 3000ms backward countdown scoped to this URL.
  t.create({
    id: "demo",
    displayName: "Demo countdown",
    direction: "backward",
    currentMs: 3000,
    scope: () => true
  });
  assertEqual("timer starts at 3000ms", timersBucket.demo.currentMs, 3000);

  // Simulate three 1-second dispatches. Between each we reset the
  // per-dispatch sets and bump elapsedMs, mirroring what
  // event-sandbox.js does for every real dispatch.
  for (let i = 0; i < 3; i++) {
    dc.elapsedMs = 1000;
    dc.tickedSet = new Set();
    dc.displayedSet = new Set();
    t.getOrCreateTimer({
      id: "demo",
      displayName: "Demo countdown",
      direction: "backward",
      currentMs: 3000,
      scope: () => true
    });
  }
  assertEqual("timer counted down 3000ms across 3 dispatches",
    timersBucket.demo.currentMs, 0);

  // A fourth dispatch should clamp at 0 (not go negative).
  dc.elapsedMs = 1000;
  dc.tickedSet = new Set();
  t.getOrCreateTimer({
    id: "demo",
    direction: "backward",
    currentMs: 3000,
    scope: () => true
  });
  assertEqual("timer clamps at 0 (no negatives)",
    timersBucket.demo.currentMs, 0);

  // tickedSet must dedupe within a SINGLE dispatch: calling
  // getOrCreateTimer twice in the same dispatch must only tick once.
  const dc2 = {
    currentUrl: "https://example.com/",
    elapsedMs: 1000,
    tickedSet: new Set(),
    displayedSet: new Set()
  };
  const bucket2 = {};
  const helpers2 = H.createEventGroupHelpers({
    groupId: "g-timer-2",
    timersBucket: bucket2,
    persistenceBucket: {},
    dispatchContextRef: () => dc2
  });
  const t2 = helpers2.getTimerHelper();
  t2.create({ id: "x", direction: "backward", currentMs: 5000, scope: () => true });
  // Inside ONE dispatch, three calls — only the first should tick.
  t2.getOrCreateTimer({ id: "x", direction: "backward", currentMs: 5000, scope: () => true });
  t2.getOrCreateTimer({ id: "x", direction: "backward", currentMs: 5000, scope: () => true });
  t2.getOrCreateTimer({ id: "x", direction: "backward", currentMs: 5000, scope: () => true });
  assertEqual("tickedSet dedupes within one dispatch (single tick of 1000ms)",
    bucket2.x.currentMs, 4000);

  // A new dispatch with a fresh tickedSet must allow another tick.
  dc2.tickedSet = new Set();
  dc2.elapsedMs = 1000;
  t2.getOrCreateTimer({ id: "x", direction: "backward", currentMs: 5000, scope: () => true });
  assertEqual("new dispatch with fresh tickedSet ticks again",
    bucket2.x.currentMs, 3000);

  // scope:false → no tick even with elapsedMs > 0.
  dc2.tickedSet = new Set();
  dc2.elapsedMs = 1000;
  t2.getOrCreateTimer({ id: "x", direction: "backward", currentMs: 5000, scope: () => false });
  assertEqual("scope predicate false suppresses auto-tick",
    bucket2.x.currentMs, 3000);

  // forward direction: counts up.
  const dc3 = {
    currentUrl: "https://example.com/",
    elapsedMs: 2500,
    tickedSet: new Set(),
    displayedSet: new Set()
  };
  const bucket3 = {};
  const helpers3 = H.createEventGroupHelpers({
    groupId: "g-timer-3",
    timersBucket: bucket3,
    persistenceBucket: {},
    dispatchContextRef: () => dc3
  });
  const t3 = helpers3.getTimerHelper();
  t3.create({ id: "up", direction: "forward", currentMs: 0, scope: () => true });
  t3.getOrCreateTimer({ id: "up", direction: "forward", currentMs: 0, scope: () => true });
  assertEqual("forward timer counts up by elapsedMs",
    bucket3.up.currentMs, 2500);

  // Paused timer is not advanced even when scope matches. Create the
  // timer in a 0-elapsed dispatch so create()'s own applyScopeAndDomain
  // doesn't tick, then pause, then verify a 1000ms dispatch is ignored.
  const dc4 = {
    currentUrl: "https://example.com/",
    elapsedMs: 0,
    tickedSet: new Set(),
    displayedSet: new Set()
  };
  const bucket4 = {};
  const helpers4 = H.createEventGroupHelpers({
    groupId: "g-timer-4",
    timersBucket: bucket4,
    persistenceBucket: {},
    dispatchContextRef: () => dc4
  });
  const t4 = helpers4.getTimerHelper();
  t4.create({ id: "p", direction: "backward", currentMs: 3000, scope: () => true });
  t4.pause("p");
  dc4.elapsedMs = 1000;
  dc4.tickedSet = new Set();
  t4.getOrCreateTimer({ id: "p", direction: "backward", currentMs: 3000, scope: () => true });
  assertEqual("paused timer ignores elapsedMs",
    bucket4.p.currentMs, 3000);
}

// ────────────────────────────────────────────────────────────────────────
// S13: persistent scope predicates + sandbox-driven heartbeat sweep.
// Models the pageHeartbeatEvent flow: rule registers a timer with a
// scope predicate ONCE; subsequent heartbeats auto-tick + auto-display
// without the rule re-passing the predicate.
// ────────────────────────────────────────────────────────────────────────
log.section("S13: scope predicates + heartbeat-driven sweep");
{
  const dc = {
    currentUrl: "https://www.youtube.com/shorts/abc",
    elapsedMs: 0,
    tickedSet: new Set(),
    displayedSet: new Set()
  };
  const timersBucket = {};
  const predicatesBucket = {};
  const helpers = H.createEventGroupHelpers({
    groupId: "g13",
    timersBucket,
    timerPredicatesBucket: predicatesBucket,
    persistenceBucket: {},
    dispatchContextRef: () => dc
  });
  const timer = helpers.getTimerHelper();

  // Rule registers ONCE — no scope re-pass on later sweeps.
  timer.getOrCreateTimer({
    id: "yt-shorts",
    direction: "backward",
    currentMs: 5000,
    displayName: "YT Shorts",
    scope: (url) => typeof url === "string" && url.includes("/shorts/"),
    domain: (url) => typeof url === "string" && url.includes("youtube.com")
  });

  // First heartbeat on a Shorts URL: auto-tick + auto-display.
  dc.elapsedMs = 1000;
  dc.tickedSet = new Set();
  dc.displayedSet = new Set();
  timer.__cb_tickAllScopedTimers();
  let snaps = timer.__cb_getDisplayedTimerSnapshots();
  assertEqual("S13: first heartbeat ticks the scoped timer",
    timersBucket["yt-shorts"].currentMs, 4000);
  assertEqual("S13: first heartbeat reports the displayed snapshot",
    snaps.length, 1);
  assertEqual("S13: snapshot carries displayName + direction",
    { name: snaps[0].displayName, dir: snaps[0].direction, ms: snaps[0].currentMs },
    { name: "YT Shorts", dir: "backward", ms: 4000 });

  // Second heartbeat on a NON-Shorts YouTube URL: domain still matches
  // (overlay shows), but scope does not (no tick).
  dc.currentUrl = "https://www.youtube.com/feed/subscriptions";
  dc.elapsedMs = 1000;
  dc.tickedSet = new Set();
  dc.displayedSet = new Set();
  timer.__cb_tickAllScopedTimers();
  snaps = timer.__cb_getDisplayedTimerSnapshots();
  assertEqual("S13: scope=false on non-shorts URL leaves currentMs",
    timersBucket["yt-shorts"].currentMs, 4000);
  assertEqual("S13: domain=true on non-shorts YT URL still displays",
    snaps.length, 1);

  // Third heartbeat on twitter.com: neither scope nor domain match.
  dc.currentUrl = "https://twitter.com/home";
  dc.elapsedMs = 1000;
  dc.tickedSet = new Set();
  dc.displayedSet = new Set();
  timer.__cb_tickAllScopedTimers();
  snaps = timer.__cb_getDisplayedTimerSnapshots();
  assertEqual("S13: off-domain heartbeat does not tick",
    timersBucket["yt-shorts"].currentMs, 4000);
  assertEqual("S13: off-domain heartbeat displays nothing",
    snaps.length, 0);

  // Forward (count-up) timer with same persistent-predicate flow.
  timer.getOrCreateTimer({
    id: "watch-time",
    direction: "forward",
    currentMs: 0,
    displayName: "Watch time",
    scope: (url) => typeof url === "string" && url.includes("youtube.com"),
    domain: (url) => typeof url === "string" && url.includes("youtube.com")
  });
  dc.currentUrl = "https://www.youtube.com/watch?v=xyz";
  for (let i = 0; i < 3; i++) {
    dc.elapsedMs = 1000;
    dc.tickedSet = new Set();
    dc.displayedSet = new Set();
    timer.__cb_tickAllScopedTimers();
  }
  assertEqual("S13: forward timer counts up across heartbeats",
    timersBucket["watch-time"].currentMs, 3000);
  snaps = timer.__cb_getDisplayedTimerSnapshots();
  assertEqual("S13: heartbeat snapshot lists both timers on YT watch page",
    snaps.length, 2);

  // Hidden-tab simulation: zero heartbeats. currentMs unchanged across
  // any number of ticks the renderer might run.
  const before = timersBucket["watch-time"].currentMs;
  // (no calls to __cb_tickAllScopedTimers here)
  assertEqual("S13: timer does not advance without a heartbeat dispatch",
    timersBucket["watch-time"].currentMs, before);

  // delete() removes both the persisted state and the predicates so a
  // subsequent re-create doesn't accidentally re-tick under stale rules.
  timer.delete("watch-time");
  assertEqual("S13: delete clears the persisted state",
    Object.prototype.hasOwnProperty.call(timersBucket, "watch-time"), false);
  assertEqual("S13: delete clears the predicates registry",
    Object.prototype.hasOwnProperty.call(predicatesBucket, "watch-time"), false);
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
