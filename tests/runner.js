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

// JavaScriptCore on macOS does not expose the browser URL constructor. The
// helper bundle uses URL only for its pure URL-classifier helpers, so provide
// the tiny subset those tests need without changing the browser runtime code.
if (typeof URL === "undefined") {
  globalThis.URL = function TestUrl(value) {
    const match = String(value).match(/^https?:\/\/([^/?#]+)([^?#]*)?(\?[^#]*)?/i);
    if (!match) throw new TypeError("Invalid URL");
    this.hostname = match[1].toLowerCase();
    this.pathname = match[2] || "/";
    const query = new Map();
    for (const pair of (match[3] || "").slice(1).split("&")) {
      if (!pair) continue;
      const parts = pair.split("=");
      query.set(parts[0], parts.slice(1).join("="));
    }
    this.searchParams = { get: (key) => query.get(key) ?? null };
  };
}

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

log.section("S1: raw slot gating — unknown slots throw TypeError");
{
  const { platformHelpers } = makeFixture();
  // YouTube exposes shorts/videos/posts/comments/live as predicate slots.
  assertEqual("youtube().slots()",
    platformHelpers.youtube().slots().sort(),
    ["comments", "live", "posts", "shorts", "videos"]);
  // TikTok: no posts, no shorts surface — just videos/comments/live.
  assertEqual("tiktok().slots()",
    platformHelpers.tiktok().slots().sort(),
    ["comments", "live", "videos"]);
  assertThrows("tiktok().hide('posts', …) throws TypeError",
    () => platformHelpers.tiktok().hide("posts", () => true), TypeError);
  assertThrows("tiktok().hide('shorts', …) throws TypeError",
    () => platformHelpers.tiktok().hide("shorts", () => true), TypeError);
  // Instagram: shorts (Reels)/posts/comments, no videos.
  assertEqual("instagram().slots()",
    platformHelpers.instagram().slots().sort(),
    ["comments", "posts", "shorts"]);
  // Twitch: clips map to the 'shorts' slot, plus streams/videos/live. No
  // comments predicate (no per-message scraper).
  assertEqual("twitch().slots()",
    platformHelpers.twitch().slots().sort(),
    ["live", "shorts", "streams", "videos"]);
  assertThrows("twitch().hide('posts', …) throws TypeError",
    () => platformHelpers.twitch().hide("posts", () => true), TypeError);
  assertThrows("twitch().hide('comments', …) throws TypeError",
    () => platformHelpers.twitch().hide("comments", () => true), TypeError);
}

log.section("S2: hide(slot, predicate, opts) records intent + bucket");
{
  const { accumulator, persistentBucket, platformHelpers } = makeFixture();
  platformHelpers.instagram().hide("shorts", (it) => it.bad === true, { blockPageOnVisit: true });
  platformHelpers.twitch().hide("shorts", (it) => it.short === true);
  platformHelpers.twitch().hide("streams", (it) => it.live === true);
  platformHelpers.facebook().hide("shorts", (it) => true);

  assertEqual("instagram intent slot is 'shorts'",
    intentsFor(accumulator, "instagram").map((x) => x.slot), ["shorts"]);
  assertEqual("twitch intents slots are ['shorts','streams']",
    intentsFor(accumulator, "twitch").map((x) => x.slot), ["shorts", "streams"]);
  assertEqual("facebook intent slot is 'shorts'",
    intentsFor(accumulator, "facebook").map((x) => x.slot), ["shorts"]);

  assert("persistentBucket.instagram.shorts has predicate",
    typeof persistentBucket.instagram?.shorts?.predicate === "function");
  assert("persistentBucket.twitch.streams has predicate",
    typeof persistentBucket.twitch?.streams?.predicate === "function");

  // blockPageOnVisit + effect default thread through to intent and bucket.
  const igIntent = intentsFor(accumulator, "instagram")[0];
  assertEqual("instagram intent.blockPageOnVisit === true", igIntent.blockPageOnVisit, true);
  assertEqual("instagram intent.effect defaults to 'block'", igIntent.effect, "block");
  assertEqual("instagram persistent.blockPageOnVisit === true",
    persistentBucket.instagram.shorts.blockPageOnVisit, true);
  assertEqual("instagram persistent.effect === 'block'",
    persistentBucket.instagram.shorts.effect, "block");
}

log.section("S3: single-slot semantics — last writer wins, show(slot) clears");
{
  const { persistentBucket, platformHelpers } = makeFixture();
  const yt = platformHelpers.youtube();
  const p1 = (it) => it.tag === "first";
  const p2 = (it) => it.tag === "second";
  yt.hide("videos", p1);
  yt.hide("videos", p2);
  assert("after two hide('videos') calls, slot stores the LAST predicate",
    persistentBucket.youtube.videos.predicate === p2);

  yt.show("videos");
  assert("after show('videos'), persistent slot is null",
    persistentBucket.youtube.videos === null);
}

log.section("S4: cross-platform isolation");
{
  const { persistentBucket, platformHelpers } = makeFixture();
  platformHelpers.youtube().hide("videos", (it) => true);
  platformHelpers.facebook().hide("videos", (it) => false);
  assert("youtube.videos predicate exists",
    typeof persistentBucket.youtube?.videos?.predicate === "function");
  assert("facebook.videos predicate is different",
    persistentBucket.facebook.videos.predicate !== persistentBucket.youtube.videos.predicate);
  platformHelpers.youtube().show("videos");
  assert("youtube cleared", persistentBucket.youtube.videos === null);
  assert("facebook untouched",
    typeof persistentBucket.facebook.videos.predicate === "function");
}

log.section("S5: snapshot() returns the raw per-platform snapshot");
{
  const snapshot = {
    youtube: { subscribed: true, verified: false, live: true, subscribedChannels: ["UC1", "UC2"] },
    twitch: { subscribed: false, live: true, subscribedChannels: ["camman18"] },
    tiktok: { live: false }
  };
  const { platformHelpers } = makeFixture(snapshot);
  assertEqual("youtube().snapshot().subscribed",
    platformHelpers.youtube().snapshot().subscribed, true);
  assertEqual("youtube().snapshot().subscribedChannels",
    platformHelpers.youtube().snapshot().subscribedChannels, ["UC1", "UC2"]);
  assertEqual("twitch().snapshot().subscribed",
    platformHelpers.twitch().snapshot().subscribed, false);
  // Platforms with no snapshot return null rather than throwing.
  assertEqual("instagram().snapshot() is null when absent",
    platformHelpers.instagram().snapshot(), null);
}

log.section("S6: no-slot hide(predicate) targets every feed slot");
{
  const { persistentBucket, platformHelpers } = makeFixture();
  const pred = (it) => it.author === "example-channel";
  platformHelpers.youtube().hide(pred, { blockPageOnVisit: false });
  // YouTube feed slots are shorts/videos/posts (comments/live are excluded).
  assert("youtube.shorts predicate set", persistentBucket.youtube.shorts.predicate === pred);
  assert("youtube.videos predicate set", persistentBucket.youtube.videos.predicate === pred);
  assert("youtube.posts predicate set", persistentBucket.youtube.posts.predicate === pred);
  assert("youtube.comments NOT touched by no-slot hide",
    !persistentBucket.youtube.comments);
  // show() with no slot clears everything.
  platformHelpers.youtube().show();
  assert("show() clears shorts", persistentBucket.youtube.shorts === null);
  assert("show() clears videos", persistentBucket.youtube.videos === null);
}

log.section("S7: timer(slot, opts) gating + return value");
{
  const { accumulator, platformHelpers } = makeFixture();
  assertEqual("youtube().timer('shorts', {id}) returns the id",
    platformHelpers.youtube().timer("shorts", { id: "shorts-cap" }), "shorts-cap");
  assertEqual("youtube().timer('shorts', {}) returns null without an id",
    platformHelpers.youtube().timer("shorts", {}), null);
  assertEqual("youtube().timerSlots()",
    platformHelpers.youtube().timerSlots().sort(), ["posts", "shorts", "videos"]);
  assertThrows("tiktok().timer('shorts', …) throws (no such slot)",
    () => platformHelpers.tiktok().timer("shorts", { id: "x" }), TypeError);
  assertEqual("twitch().timer('streams', {id})",
    platformHelpers.twitch().timer("streams", { id: "s" }), "s");

  const ytSlots = intentsFor(accumulator, "youtube")
    .filter((x) => x.kind === "subsectionTimer").map((x) => x.slot);
  assertEqual("youtube subsection-timer intents map to slot", ytSlots, ["shorts", "shorts"]);
}

log.section("S8: URL classifiers always present");
{
  const { platformHelpers } = makeFixture();
  for (const plat of H.PLATFORM_LIST) {
    const api = platformHelpers[plat]();
    for (const fn of ["isPlatformUrl", "isShortUrl", "isVideoUrl",
                      "isPostUrl", "isHomePage", "extractAuthor",
                      "extractVideoId"]) {
      assert(plat + "()." + fn + " is a function", typeof api[fn] === "function");
    }
  }
}

log.section("S8b: Facebook current video routes");
{
  const { platformHelpers } = makeFixture();
  const facebook = platformHelpers.facebook();
  assert("facebook().isShortUrl recognises /share/r/",
    facebook.isShortUrl("https://www.facebook.com/share/r/abc/"));
  assert("facebook().isVideoUrl recognises /share/v/",
    facebook.isVideoUrl("https://www.facebook.com/share/v/abc/"));
  assert("facebook().isVideoUrl recognises /videos/",
    facebook.isVideoUrl("https://www.facebook.com/videos/123/"));
  assertEqual("facebook().extractVideoId reads /share/v/",
    facebook.extractVideoId("https://www.facebook.com/share/v/abc/"), "abc");
  assertEqual("facebook().extractAuthor rejects the /share route",
    facebook.extractAuthor("https://www.facebook.com/share/v/abc/"), null);
}

log.section("S9: surface(name, action) toggles whole regions");
{
  const { accumulator, persistentBucket, platformHelpers } = makeFixture();
  const yt = platformHelpers.youtube();
  assertEqual("youtube().surfaces() lists home + region toggles",
    yt.surfaces().sort(), ["comments", "home", "live", "shortButton"]);

  yt.surface("home", "hide");
  assertEqual("surface('home','hide') records {kind:'homePage',value:'hide'}",
    intentsFor(accumulator, "youtube"), [{ kind: "homePage", value: "hide" }]);

  // Showing a region that also has a per-item filter clears its predicate.
  yt.hide("comments", (c) => c.author === "spam");
  assert("filter installed comments predicate",
    typeof persistentBucket.youtube.comments.predicate === "function");
  yt.surface("comments", "show");
  assert("surface('comments','show') cleared the comments predicate",
    persistentBucket.youtube.comments === null);

  assertThrows("surface('nope', …) throws TypeError",
    () => platformHelpers.youtube().surface("nope", "hide"), TypeError);
}

log.section("S10: allow(...) records effect:'allow' (rescue cascade)");
{
  const { accumulator, persistentBucket, platformHelpers } = makeFixture();
  const yt = platformHelpers.youtube();
  yt.allow("videos", (it) => it.creator && it.creator.author === "education-channel");
  assertEqual("allow intent carries effect:'allow'",
    intentsFor(accumulator, "youtube")[0].effect, "allow");
  assertEqual("allow persistent bucket carries effect:'allow'",
    persistentBucket.youtube.videos.effect, "allow");

  // hide with a non-function silently no-ops.
  const { accumulator: acc2, platformHelpers: ph2 } = makeFixture();
  ph2.youtube().hide("videos", "not a function");
  assertEqual("hide with non-function records no intent",
    intentsFor(acc2, "youtube").length, 0);
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

  const accScreen = {};
  const helperScreen = H.createEventLogHelper("g-screen", { get: () => accScreen });
  helperScreen.log("default");
  helperScreen.warnScreen("screen");
  helperScreen.errorPopup("popup");
  assertEqual("h.log* records routing preference metadata",
    accScreen.logs.map((entry) => ({ level: entry.level, screen: entry.screen, popup: entry.popup, args: entry.args })),
    [
      { level: "log", args: ["default"] },
      { level: "warn", screen: true, popup: false, args: ["screen"] },
      { level: "error", screen: false, popup: true, args: ["popup"] }
    ]);

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

  // Existing getOrCreateTimer calls are strict "get" operations: the
  // original scope predicate is preserved, so this still ticks.
  dc2.tickedSet = new Set();
  dc2.elapsedMs = 1000;
  t2.getOrCreateTimer({ id: "x", direction: "backward", currentMs: 5000, scope: () => false });
  assertEqual("existing getOrCreateTimer does not replace the original scope predicate",
    bucket2.x.currentMs, 2000);

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
// S12b: expanded timer capabilities — bounds, step, accrueWhen, subMs,
// overlayStyle. All opt-in; verifies they clamp/gate as documented.
// ────────────────────────────────────────────────────────────────────────
log.section("S12b: timer bounds / step / accrueWhen / subMs / overlayStyle");
{
  // maxMs clamps a forward timer's accrual.
  const dcA = { currentUrl: "https://x.test/", elapsedMs: 5000, tickedSet: new Set(), displayedSet: new Set() };
  const bA = {};
  const hA = H.createEventGroupHelpers({ groupId: "g12b-a", timersBucket: bA, persistenceBucket: {}, dispatchContextRef: () => dcA });
  const tA = hA.getTimerHelper();
  tA.create({ id: "cap", direction: "forward", currentMs: 0, maxMs: 3000, scope: () => true });
  assertEqual("forward timer clamps to maxMs", bA.cap.currentMs, 3000);

  // stepMs quantizes the tick (3400ms with step 1000 -> rounds to 3000).
  const dcB = { currentUrl: "https://x.test/", elapsedMs: 3400, tickedSet: new Set(), displayedSet: new Set() };
  const bB = {};
  const hB = H.createEventGroupHelpers({ groupId: "g12b-b", timersBucket: bB, persistenceBucket: {}, dispatchContextRef: () => dcB });
  const tB = hB.getTimerHelper();
  tB.create({ id: "q", direction: "forward", currentMs: 0, stepMs: 1000, scope: () => true });
  assertEqual("stepMs quantizes the tick", bB.q.currentMs, 3000);

  // accrueWhen gates ticking even when scope matches.
  const dcC = { currentUrl: "https://x.test/", elapsedMs: 1000, tickedSet: new Set(), displayedSet: new Set() };
  const bC = {};
  const pC = {};
  const hC = H.createEventGroupHelpers({ groupId: "g12b-c", timersBucket: bC, timerPredicatesBucket: pC, persistenceBucket: {}, dispatchContextRef: () => dcC });
  const tC = hC.getTimerHelper();
  let playing = false;
  tC.create({ id: "w", direction: "forward", currentMs: 0, scope: () => true, accrueWhen: () => playing });
  assertEqual("accrueWhen=false blocks the tick", bC.w.currentMs, 0);
  playing = true;
  dcC.tickedSet = new Set();
  tC.__cb_tickAllScopedTimers();
  assertEqual("accrueWhen=true allows the tick", bC.w.currentMs, 1000);

  // subMs and minMs floor.
  const dcD = { currentUrl: "https://x.test/", elapsedMs: 0, tickedSet: new Set(), displayedSet: new Set() };
  const bD = {};
  const hD = H.createEventGroupHelpers({ groupId: "g12b-d", timersBucket: bD, persistenceBucket: {}, dispatchContextRef: () => dcD });
  const tD = hD.getTimerHelper();
  tD.create({ id: "b", direction: "backward", currentMs: 5000, minMs: 2000 });
  tD.subMs("b", 4000);
  assertEqual("subMs clamps to minMs", bD.b.currentMs, 2000);

  // overlayStyle is sanitized and surfaced in getState.
  const dcE = { currentUrl: "https://x.test/", elapsedMs: 0, tickedSet: new Set(), displayedSet: new Set() };
  const bE = {};
  const hE = H.createEventGroupHelpers({ groupId: "g12b-e", timersBucket: bE, persistenceBucket: {}, dispatchContextRef: () => dcE });
  const tE = hE.getTimerHelper();
  tE.create({ id: "s", direction: "forward", currentMs: 0, overlayStyle: { color: "#fff", evil: () => 1 } });
  const st = tE.getState("s");
  assertEqual("overlayStyle kept known field", st.overlayStyle && st.overlayStyle.color, "#fff");
  assertEqual("overlayStyle dropped non-string field", st.overlayStyle && "evil" in st.overlayStyle, false);
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
// S14: panel helper schema, predicates, values, and inline handlers.
// ────────────────────────────────────────────────────────────────────────
log.section("S14: panel helper state + snapshots");
{
  const dc = {
    currentUrl: "https://www.youtube.com/watch?v=abc",
    panelDisplayedSet: new Set()
  };
  const panelsBucket = {};
  const predicatesBucket = {};
  const registered = [];
  const helpers = H.createEventGroupHelpers({
    groupId: "g-panel",
    panelsBucket,
    panelPredicatesBucket: predicatesBucket,
    persistenceBucket: {},
    dispatchContextRef: () => dc,
    registerPanelHandler(panelId, controlId, eventName, handler) {
      registered.push({ panelId, controlId, eventName, handler });
      return true;
    },
    unregisterPanelHandlers() {}
  });
  const panel = helpers.getPanelHelper();
  const id = panel.create({
    id: "yt-panel",
    title: "Creator filter",
    position: "bottom-right",
    align: "center",
    layout: "twoColumn",
    priority: 9,
    ariaLabel: "Creator filter panel",
    role: "dialog",
    theme: { background: "rgb(1,2,3)", foreground: "#fff", accent: "dodgerblue" },
    scope: (url) => typeof url === "string" && url.includes("youtube.com"),
    controls: [
      { id: "block", type: "checkbox", label: "Block creator", value: false, onChange() {} },
      { id: "reason", type: "select", label: "Reason", value: "game", options: ["game", "politics"], width: "70%", height: 44 },
      { id: "note", type: "textInput", label: "Note", value: "hello", width: "full" },
      { id: "details", type: "textarea", label: "Details", value: "", width: 240, height: "160px", rows: 6 },
      {
        id: "advanced",
        type: "section",
        label: "Advanced",
        layout: "compact",
        priority: 5,
        controls: [
          { id: "shortcut", type: "textInput", label: "Shortcut", value: "", onKey() {} }
        ]
      }
    ]
  });
  assertEqual("S14: create returns panel id", id, "yt-panel");
  assertEqual("S14: inline control handlers registered", registered.length, 2);
  panel.__cb_refreshDisplayedPanels();
  let snaps = panel.__cb_getDisplayedPanelSnapshots();
  assertEqual("S14: scope-matching URL displays panel", snaps.length, 1);
  assertEqual("S14: snapshot carries checkbox value", snaps[0].values.block, false);
  assertEqual("S14: snapshot carries layout + priority + a11y fields",
    { layout: snaps[0].layout, priority: snaps[0].priority, role: snaps[0].role, ariaLabel: snaps[0].ariaLabel },
    { layout: "twoColumn", priority: 9, role: "dialog", ariaLabel: "Creator filter panel" });
  assertEqual("S14: select control keeps custom dimensions",
    { width: snaps[0].controls[1].width, height: snaps[0].controls[1].height },
    { width: "70%", height: "44px" });
  assertEqual("S14: textarea control keeps custom dimensions",
    { width: snaps[0].controls[3].width, height: snaps[0].controls[3].height, rows: snaps[0].controls[3].rows },
    { width: "240px", height: "160px", rows: 6 });
  assertEqual("S14: section control keeps nested controls",
    { type: snaps[0].controls[4].type, layout: snaps[0].controls[4].layout, nested: snaps[0].controls[4].controls[0].id },
    { type: "section", layout: "compact", nested: "shortcut" });

  panel.setValue("yt-panel", "block", true);
  panel.setValue("yt-panel", "note", "stored");
  panel.setValue("yt-panel", "shortcut", "k");
  snaps = panel.__cb_getDisplayedPanelSnapshots();
  assertEqual("S14: setValue persists checkbox", snaps[0].values.block, true);
  assertEqual("S14: setValue persists text", snaps[0].values.note, "stored");
  assertEqual("S14: setValue reaches nested section controls", snaps[0].values.shortcut, "k");

  panel.disable("yt-panel", "note");
  panel.setOptions("yt-panel", "reason", ["game", "study"]);
  panel.setText("yt-panel", "advanced", "More settings");
  panel.setTheme("yt-panel", { background: "#111", foreground: "#eee" });
  snaps = panel.__cb_getDisplayedPanelSnapshots();
  assertEqual("S14: convenience helpers mutate controls/theme",
    {
      disabled: snaps[0].controls[2].disabled,
      option: snaps[0].controls[1].options[1].value,
      sectionText: snaps[0].controls[4].text,
      bg: snaps[0].theme.background
    },
    { disabled: true, option: "study", sectionText: "More settings", bg: "#111" });

  assertEqual("S14: notice builder creates text panel",
    panel.notice({ id: "notice", message: "Heads up", scope: (url) => typeof url === "string" && url.includes("youtube.com") }),
    "notice");
  assertEqual("S14: confirm builder creates submit/cancel buttons",
    panel.confirm({ id: "confirm-delete", message: "Are you sure?", scope: (url) => typeof url === "string" && url.includes("youtube.com") }),
    "confirm-delete");
  assertEqual("S14: builder button action is preserved",
    panelsBucket["confirm-delete"].controls[1].action,
    "submit");

  panel.getOrCreatePanel({
    id: "yt-panel",
    title: "Should not replace",
    controls: [{ id: "block", type: "checkbox", value: false }]
  });
  assertEqual("S14: existing getOrCreatePanel leaves title unchanged",
    panelsBucket["yt-panel"].title, "Creator filter");
  assertEqual("S14: existing getOrCreatePanel leaves value unchanged",
    panelsBucket["yt-panel"].controls[0].value, true);

  panel.__cb_applyPanelEvent({ panelId: "yt-panel", eventName: "close", values: panel.getValues("yt-panel") });
  dc.panelDisplayedSet = new Set();
  panel.__cb_refreshDisplayedPanels();
  snaps = panel.__cb_getDisplayedPanelSnapshots();
  assertEqual("S14: close panel event hides the target panel",
    snaps.some((snap) => snap.id === "yt-panel"), false);

  panel.show("yt-panel");
  dc.panelDisplayedSet = new Set();
  panel.__cb_refreshDisplayedPanels();
  snaps = panel.__cb_getDisplayedPanelSnapshots();
  assertEqual("S14: show() restores an in-scope panel",
    snaps.some((snap) => snap.id === "yt-panel"), true);

  dc.currentUrl = "https://example.com/";
  dc.panelDisplayedSet = new Set();
  panel.__cb_refreshDisplayedPanels();
  snaps = panel.__cb_getDisplayedPanelSnapshots();
  assertEqual("S14: off-scope URL hides panel", snaps.length, 0);

  panel.hide("yt-panel");
  panel.show("yt-panel");
  dc.panelDisplayedSet = new Set();
  panel.__cb_refreshDisplayedPanels();
  snaps = panel.__cb_getDisplayedPanelSnapshots();
  assertEqual("S14: show() still respects scope", snaps.length, 0);

  const acc = {};
  const accHelpers = H.createEventGroupHelpers({
    groupId: "g-panel-change",
    panelsBucket: {},
    panelPredicatesBucket: {},
    persistenceBucket: {},
    accumulatorRef: { get: () => acc },
    dispatchContextRef: () => ({
      currentUrl: "https://example.com/",
      panelDisplayedSet: new Set()
    })
  });
  const panel2 = accHelpers.getPanelHelper();
  panel2.create({
    id: "stable",
    title: "Stable",
    controls: [{ id: "flag", type: "checkbox", value: false }]
  });
  assertEqual("S14: create marks panel changed",
    acc.panelRegistryChanged, true);
  assertEqual("S14: panel changes record the affected group",
    acc.panelGroupsChanged, ["g-panel-change"]);
  acc.panelRegistryChanged = false;
  panel2.update("stable", {
    title: "Stable",
    controls: [{ id: "flag", type: "checkbox", value: false }]
  });
  assertEqual("S14: identical update does not mark panel changed",
    acc.panelRegistryChanged, false);
  panel2.update("stable", {
    title: "Changed",
    controls: [{ id: "flag", type: "checkbox", value: false }]
  });
  assertEqual("S14: real update marks panel changed",
    acc.panelRegistryChanged, true);
}

// ────────────────────────────────────────────────────────────────────────
// S15: expanded panel control types and timer elements.
// ────────────────────────────────────────────────────────────────────────
log.section("S15: expanded panel controls + timer element");
{
  const dc = {
    currentUrl: "https://example.com/",
    elapsedMs: 0,
    tickedSet: new Set(),
    displayedSet: new Set(),
    panelDisplayedSet: new Set()
  };
  const timersBucket = {};
  const panelsBucket = {};
  const helpers = H.createEventGroupHelpers({
    groupId: "g-panel-controls",
    timersBucket,
    panelsBucket,
    panelPredicatesBucket: {},
    persistenceBucket: {},
    dispatchContextRef: () => dc
  });
  const timer = helpers.getTimerHelper();
  const panel = helpers.getPanelHelper();

  timer.create({
    id: "focus",
    displayName: "Focus",
    direction: "backward",
    currentMs: 90000,
    scope: () => true,
    domain: () => true
  });

  panel.create({
    id: "expanded",
    title: "Expanded controls",
    controls: [
      { id: "liveTimer", type: "timer", timerId: "focus", format: "mm:ss" },
      { id: "snapshotTimer", type: "timer", timer: timer.getState("focus"), format: "ss" },
      { id: "minutes", type: "numberInput", value: 25, min: 1, max: 120, step: 5 },
      { id: "strictness", type: "range", value: 7, min: 1, max: 10, step: 1 },
      { id: "enabled", type: "toggle", value: true },
      { id: "mode", type: "radio", value: "strict", options: ["soft", "strict", "lockdown"] },
      { id: "startDate", type: "date", value: "2026-06-02" },
      { id: "startTime", type: "time", value: "09:30" },
      { id: "accent", type: "color", value: "#3366ff" }
    ]
  });

  panel.__cb_refreshDisplayedPanels();
  let snap = panel.__cb_getDisplayedPanelSnapshots()[0];
  assertEqual("S15: new control types are preserved",
    snap.controls.map((control) => control.type),
    ["timer", "timer", "numberInput", "range", "toggle", "radio", "date", "time", "color"]);
  assertEqual("S15: timerId control hydrates live timer snapshot",
    { timerId: snap.controls[0].timerId, currentMs: snap.controls[0].timer.currentMs, displayName: snap.controls[0].timer.displayName },
    { timerId: "focus", currentMs: 90000, displayName: "Focus" });
  assertEqual("S15: timer object snapshot is preserved",
    { timerId: snap.controls[1].timer.id, currentMs: snap.controls[1].timer.currentMs },
    { timerId: "focus", currentMs: 90000 });
  assertEqual("S15: timer controls are display-only values",
    Object.prototype.hasOwnProperty.call(snap.values, "liveTimer") || Object.prototype.hasOwnProperty.call(snap.values, "snapshotTimer"),
    false);
  assertEqual("S15: values keep typed new input semantics",
    {
      minutes: snap.values.minutes,
      strictness: snap.values.strictness,
      enabled: snap.values.enabled,
      mode: snap.values.mode,
      startDate: snap.values.startDate,
      startTime: snap.values.startTime,
      accent: snap.values.accent
    },
    {
      minutes: 25,
      strictness: 7,
      enabled: true,
      mode: "strict",
      startDate: "2026-06-02",
      startTime: "09:30",
      accent: "#3366ff"
    });

  panel.setValue("expanded", "minutes", 999);
  panel.setValue("expanded", "strictness", -5);
  panel.setValue("expanded", "enabled", false);
  panel.setValue("expanded", "mode", "lockdown");
  panel.setValue("expanded", "startDate", "bad-date");
  panel.setValue("expanded", "startTime", "25:00");
  panel.setValue("expanded", "accent", "red");
  snap = panel.__cb_getDisplayedPanelSnapshots()[0];
  assertEqual("S15: new input values sanitize on setValue",
    {
      minutes: snap.values.minutes,
      strictness: snap.values.strictness,
      enabled: snap.values.enabled,
      mode: snap.values.mode,
      startDate: snap.values.startDate,
      startTime: snap.values.startTime,
      accent: snap.values.accent
    },
    {
      minutes: 120,
      strictness: 1,
      enabled: false,
      mode: "lockdown",
      startDate: "",
      startTime: "",
      accent: "#000000"
    });

  dc.elapsedMs = 30000;
  dc.tickedSet = new Set();
  timer.__cb_tickAllScopedTimers();
  snap = panel.__cb_getDisplayedPanelSnapshots()[0];
  assertEqual("S15: timer element reflects current timer bucket state",
    snap.controls[0].timer.currentMs,
    60000);
}

// ────────────────────────────────────────────────────────────────────────
// S15b: raw "html" panel control — sanitized markup mount.
// ────────────────────────────────────────────────────────────────────────
log.section("S15b: panel raw html control sanitization");
{
  const dc = { currentUrl: "https://x.test/", elapsedMs: 0, tickedSet: new Set(), displayedSet: new Set() };
  const helpers = H.createEventGroupHelpers({
    groupId: "g15b",
    timersBucket: {},
    panelsBucket: {},
    persistenceBucket: {},
    dispatchContextRef: () => dc
  });
  const panel = helpers.getPanelHelper();
  panel.create({
    id: "raw",
    title: "Raw",
    controls: [
      {
        id: "markup",
        type: "html",
        html: "<b>Hi</b><script>steal()</script><img src=x onerror=\"hack()\"><a href=\"javascript:bad()\">x</a>"
      }
    ]
  });
  panel.__cb_refreshDisplayedPanels();
  const snap = panel.__cb_getDisplayedPanelSnapshots()[0];
  const ctrl = snap.controls[0];
  assertEqual("S15b: html control type preserved", ctrl.type, "html");
  assertEqual("S15b: <script> stripped", /script/i.test(ctrl.html), false);
  assertEqual("S15b: on* handler stripped", /onerror/i.test(ctrl.html), false);
  assertEqual("S15b: javascript: URL neutralized", /javascript:/i.test(ctrl.html), false);
  assertEqual("S15b: safe markup kept", /<b>Hi<\/b>/.test(ctrl.html), true);
}

// ────────────────────────────────────────────────────────────────────────
// S16: local folder helper async intents.
// ────────────────────────────────────────────────────────────────────────
log.section("S16: local folder helper intents");
{
  const accumulator = {};
  const helpers = H.createEventGroupHelpers({
    groupId: "g-local",
    persistenceBucket: {},
    accumulatorRef: { get: () => accumulator },
    dispatchContextRef: () => ({ currentUrl: "https://example.com/" })
  });
  const folder = helpers.getLocalFolderHelper();
  const readId = folder.requestRead("notes/focus.txt");
  const writeId = folder.requestWrite("data/today.csv", "time,site\n1,example.com\n");
  const appendId = folder.requestAppend("notes/focus.txt", "more\n");
  const listId = folder.requestList("notes");
  const rootListId = folder.requestList();
  const existsId = folder.requestExists("config/settings.json");
  const readJsonId = folder.requestReadJson("config/settings.json");
  const writeJsonId = folder.requestWriteJson("config/settings.json", { enabled: true, count: 2 });

  assert("S16: request methods return request ids",
    [readId, writeId, appendId, listId, rootListId, existsId, readJsonId, writeJsonId].every((id) => typeof id === "string" && id));
  assertEqual("S16: local file intents carry action/path/group",
    accumulator.intents.map((intent) => ({ kind: intent.kind, action: intent.action, path: intent.path, groupId: intent.groupId })),
    [
      { kind: "localFile", action: "read", path: "notes/focus.txt", groupId: "g-local" },
      { kind: "localFile", action: "write", path: "data/today.csv", groupId: "g-local" },
      { kind: "localFile", action: "append", path: "notes/focus.txt", groupId: "g-local" },
      { kind: "localFile", action: "list", path: "notes", groupId: "g-local" },
      { kind: "localFile", action: "list", path: "", groupId: "g-local" },
      { kind: "localFile", action: "exists", path: "config/settings.json", groupId: "g-local" },
      { kind: "localFile", action: "readJson", path: "config/settings.json", groupId: "g-local" },
      { kind: "localFile", action: "writeJson", path: "config/settings.json", groupId: "g-local" }
    ]);
  assertEqual("S16: write text and JSON payloads are preserved",
    {
      text: accumulator.intents[1].text,
      value: accumulator.intents[7].value,
      directoryPath: accumulator.intents[3].directoryPath
    },
    {
      text: "time,site\n1,example.com\n",
      value: { enabled: true, count: 2 },
      directoryPath: "notes"
    });

  const beforeInvalid = accumulator.intents.length;
  assertEqual("S16: rejects unsupported extension", folder.requestRead("notes/focus.md"), "");
  assertEqual("S16: rejects traversal", folder.requestWrite("../secrets.txt", "bad"), "");
  assertEqual("S16: rejects hidden path", folder.requestRead(".hidden.txt"), "");
  assertEqual("S16: rejects invalid JSON helper extension", folder.requestWriteJson("notes/focus.txt", { bad: true }), "");
  assertEqual("S16: invalid local folder requests do not enqueue intents",
    accumulator.intents.length,
    beforeInvalid);
}

// ────────────────────────────────────────────────────────────────────────
// S17: rule-created window blocks are group-owned and unload-safe.
// ────────────────────────────────────────────────────────────────────────
log.section("S17: window blocklist group ownership");
{
  const accA = {};
  const accB = {};
  const make = (groupId, accumulator) => H.createEventGroupHelpers({
    groupId,
    persistenceBucket: {},
    accumulatorRef: { get: () => accumulator },
    dispatchContextRef: () => ({ currentUrl: "https://example.com/", tabsSnapshot: [] })
  });
  const winA = make("g-window-a", accA).getWindowHelper();
  const winB = make("g-window-b", accB).getWindowHelper();

  winA.block("https://www.example.com/path");
  winB.block("other.example");
  assert("S17: group A sees its own subdomain block", winA.isBlocked("sub.example.com"));
  assertEqual("S17: group A does not see group B block", winA.isBlocked("other.example"), false);
  assertEqual("S17: group B does not see group A block", winB.isBlocked("example.com"), false);
  assertEqual("S17: block intents carry owning group ids",
    [accA.intents[0].groupId, accB.intents[0].groupId],
    ["g-window-a", "g-window-b"]);

  H.clearEventWindowBlocklist("g-window-a");
  const reloadedA = make("g-window-a", {}).getWindowHelper();
  const reloadedB = make("g-window-b", {}).getWindowHelper();
  assertEqual("S17: unloading A clears only A", reloadedA.getBlocked(), []);
  assertEqual("S17: unloading A preserves B", reloadedB.getBlocked(), ["other.example"]);

  winB.unblock("other.example");
  assertEqual("S17: unblock intent stays group-owned",
    { action: accB.intents[1].action, groupId: accB.intents[1].groupId },
    { action: "unblockSite", groupId: "g-window-b" });
  H.clearEventWindowBlocklist("g-window-b");
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
