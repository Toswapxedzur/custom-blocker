/* Sandboxed compiler + executor.
 *
 * Both extension pages (popup) and content scripts run under a CSP that
 * forbids `new Function`. Sandboxed pages (declared in
 * manifest.sandbox.pages) get a relaxed CSP that allows it, so this page
 * is the only place we can compile and execute custom rule sources.
 *
 * Two protocols are handled, distinguished by the message `type`:
 *
 *   1. "compile" — used by the popup's "Check syntax" button.
 *      Parent posts { id, type: "compile", source }.
 *      We reply with { source: "custom-blocker-sandbox", id, result }
 *      where `result` is one of:
 *        { ok: true }
 *        { ok: false, kind: "empty" }
 *        { ok: false, kind: "syntax",       message }
 *        { ok: false, kind: "not-function" }
 *        { ok: false, kind: "runtime",      message }
 *
 *   2. "execute" — used by the content script every heartbeat.
 *      Parent posts { id, type: "execute", batch, context, platform,
 *      feedItems, pageItems } where `batch` is an array of
 *      { groupId, name, source, timersBucket, persistenceBucket },
 *      `context` carries the date/url/elapsed values, `platform` is the
 *      current page's platform (or null), `feedItems` is an array of
 *      { key, kind, item } collected from the page DOM, and `pageItems`
 *      is { short?, long?, post? } describing the current page (for
 *      blockPageOnVisit predicates).
 *      We reply with { source: "custom-blocker-sandbox", id,
 *      type: "execute-result", results, intents, feedDecisions,
 *      pageBlocked }.
 *        - `intents` has the predicate functions stripped (they cannot
 *          survive structured-clone). Predicate counts and the
 *          blockPageOnVisit flag are preserved so the host can still
 *          tell what intents were registered.
 *        - `feedDecisions` is { short: [keys], long: [keys], post: [keys] }
 *          — the keys to hide on the current page.
 *        - `pageBlocked` is { short: bool, long: bool, post: bool } —
 *          whether the current-page item triggered a blockPageOnVisit
 *          predicate for that kind.
 *
 *   3. "reapply" — sent on MutationObserver fires and on URL changes
 *      while the rules-side intents are unchanged. Parent posts
 *      { id, type: "reapply", platform, feedItems, pageItems }. We
 *      re-evaluate the *cached* predicates from the most recent execute
 *      against the fresh items and reply with { id,
 *      type: "reapply-result", feedDecisions, pageBlocked }.
 *      Page-block evaluation here is what gives URL navigation its
 *      sub-heartbeat block latency: we don't have to wait for the next
 *      heartbeat to re-run the rule batch through the background.
 *
 * The compile path uses a typed `helpers` stub for its smoke test.
 * The execute path uses the real `createCustomRuleHelpers` from
 * helpers.js (loaded into this same sandbox page) so rules see the same
 * API surface they would in the content script. Predicates created by
 * those rules cannot leave the sandbox — their closures live here — so
 * we evaluate them in-place and only return decisions, never functions.
 */

// Build a stub that mirrors the real `helpers` surface defined in
// helpers.js. Each method returns a benign value (no side effects). The
// stub MUST NOT use a wide-open Proxy: that lets typos like
// `helpers.nah()` silently succeed, defeating the whole point of the
// smoke test. With this enumerated stub, `helpers.nah` is undefined and
// invoking it throws TypeError, which is exactly what we report.
function makeHelpersStub() {
  const PLATFORMS = ["youtube", "tiktok", "facebook", "instagram", "twitch"];
  const noop = () => undefined;
  const returnNull = () => null;
  const returnFalse = () => false;
  const returnTrue = () => true;
  const returnZero = () => 0;
  const returnEmptyArray = () => [];

  function makeTimerHelperStub() {
    return {
      groupId: "stub",
      create: ({ id } = {}) => (typeof id === "string" ? id : "stub-id"),
      getOrCreateTimer: ({ id } = {}) => (typeof id === "string" ? id : "stub-id"),
      delete: returnFalse,
      pause: returnFalse,
      resume: returnFalse,
      setDirection: returnFalse,
      setCurrentMs: returnFalse,
      addMs: returnFalse,
      setDisplayName: returnFalse,
      getCurrentMs: returnZero,
      isExpired: returnFalse,
      isPaused: returnFalse,
      getDirection: returnNull,
      getDisplayName: returnNull,
      exists: returnFalse,
      getState: returnNull,
      list: returnEmptyArray
    };
  }

  function makePersistenceHelperStub() {
    return {
      get: (_key, defaultValue) => defaultValue,
      set: returnTrue,
      delete: returnTrue,
      has: returnFalse,
      keys: returnEmptyArray,
      entries: returnEmptyArray,
      clear: returnTrue,
      size: returnZero
    };
  }

  function makeLogHelperStub() {
    return { log: noop, warn: noop, error: noop };
  }

  function makeRedirectionHelperStub() {
    let current = "";
    return {
      get: () => current,
      set: (url) => {
        if (typeof url !== "string") return false;
        current = url.trim();
        return true;
      }
    };
  }

  function makePlatformApiStub() {
    return {
      hideShortButton: noop,
      showShortButton: noop,
      hideHomePage: noop,
      showHomePage: noop,
      hideShorts: noop,
      showShorts: noop,
      hideVideos: noop,
      showVideos: noop,
      hidePosts: noop,
      showPosts: noop,
      setShortsTimer: returnNull,
      setVideosTimer: returnNull,
      setPostsTimer: returnNull
    };
  }

  function makePlatformUrlOpsStub() {
    return {
      isPlatformUrl: returnFalse,
      isShortUrl: returnFalse,
      isVideoUrl: returnFalse,
      isPostUrl: returnFalse,
      isHomePage: returnFalse,
      extractAuthor: returnNull,
      extractVideoId: returnNull
    };
  }

  function makePlatformHelperStub() {
    const stub = {};
    for (const platform of PLATFORMS) {
      stub[platform] = makePlatformApiStub;
    }
    return stub;
  }

  function makeDomainUtilityStub() {
    const stub = {
      hostnameOf: () => "example.com",
      pathnameOf: () => "/",
      matches: returnFalse,
      getPlatform: returnNull,
      isYouTubeHost: returnFalse,
      isTikTokHost: returnFalse,
      isInstagramHost: returnFalse,
      isFacebookHost: returnFalse,
      isTwitchHost: returnFalse,
      isRedditHost: returnFalse,
      isDiscordHost: returnFalse
    };
    for (const platform of PLATFORMS) {
      stub[platform] = makePlatformUrlOpsStub;
    }
    return stub;
  }

  return {
    now: 0,
    elapsedMs: 0,
    currentUrl: "https://example.com/",
    groupId: "stub",
    tickedSet: new Set(),
    getTimerHelper: makeTimerHelperStub,
    getPersistenceHelper: makePersistenceHelperStub,
    getLogHelper: makeLogHelperStub,
    getRedirectionHelper: makeRedirectionHelperStub,
    getPlatformHelper: makePlatformHelperStub,
    getDomainUtility: makeDomainUtilityStub
  };
}

// Compiled-function cache shared between compile and execute paths.
// Keyed by source text so a rule the content script runs every heartbeat
// is only parsed once. Bounded loosely to avoid pathological growth if
// the user keeps editing a rule.
const compiledRuleCache = new Map();
const COMPILED_RULE_CACHE_MAX = 64;

// Latest predicate functions per platform/kind, captured from the most
// recent execute call. They live here forever because functions cannot
// be cloned across postMessage; the host (content script) calls back
// in via the "reapply" message, supplying items, and we evaluate
// predicates locally and return decisions. Replaced wholesale on every
// new execute, so stale predicates from removed groups never linger.
let latestPlatformPredicates = makeEmptyPlatformPredicates();

function makeEmptyPlatformPredicates() {
  const out = {};
  const platforms = (self.__customBlockerHelpers || {}).PLATFORM_LIST || [];
  for (const platform of platforms) {
    out[platform] = { short: [], long: [], post: [] };
  }
  return out;
}

function rebuildPredicateCache(intentsState) {
  const out = makeEmptyPlatformPredicates();
  if (!intentsState || typeof intentsState !== "object") {
    latestPlatformPredicates = out;
    return;
  }
  for (const platform of Object.keys(out)) {
    const ps = intentsState[platform] || {};
    out[platform] = {
      short: Array.isArray(ps.shortsPredicates) ? ps.shortsPredicates.slice() : [],
      long: Array.isArray(ps.videosPredicates) ? ps.videosPredicates.slice() : [],
      post: Array.isArray(ps.postsPredicates) ? ps.postsPredicates.slice() : []
    };
  }
  latestPlatformPredicates = out;
}

function evaluateFeedItems(platform, items) {
  const decisions = { short: [], long: [], post: [] };
  if (typeof platform !== "string" || !latestPlatformPredicates[platform]) return decisions;
  if (!Array.isArray(items) || items.length === 0) return decisions;
  const buckets = latestPlatformPredicates[platform];
  for (const entry of items) {
    if (!entry || typeof entry.key === "undefined") continue;
    const kind = entry.kind;
    if (kind !== "short" && kind !== "long" && kind !== "post") continue;
    const list = buckets[kind] || [];
    if (list.length === 0) continue;
    const item = entry.item;
    let hide = false;
    for (const { predicate } of list) {
      if (typeof predicate !== "function") continue;
      try { if (predicate(item) === true) { hide = true; break; } } catch {}
    }
    if (hide) decisions[kind].push(entry.key);
  }
  return decisions;
}

function evaluatePageItems(platform, pageItems) {
  const result = { short: false, long: false, post: false };
  if (typeof platform !== "string" || !latestPlatformPredicates[platform]) return result;
  if (!pageItems || typeof pageItems !== "object") return result;
  const buckets = latestPlatformPredicates[platform];
  for (const kind of ["short", "long", "post"]) {
    const item = pageItems[kind];
    if (!item) continue;
    const blockers = (buckets[kind] || []).filter((e) => e && e.blockPageOnVisit);
    for (const { predicate } of blockers) {
      if (typeof predicate !== "function") continue;
      try { if (predicate(item) === true) { result[kind] = true; break; } } catch {}
    }
  }
  return result;
}

// Custom rules now return an integer state in the closed range
// [-255, 255]. Meanings currently understood by the engine:
//   -1  block
//    0  no decision / continue to next rule
//    1  allow
// Any other in-range integer is preserved and surfaced in the debug
// overlay so future workflows can attach meaning to it, but the engine
// does not act on it yet.
function normalizeRuleState(raw) {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return {
      ok: false,
      value: 0,
      error: "Rule must return an integer in [-255, 255] (got " + typeof raw + ")."
    };
  }
  if (!Number.isInteger(raw)) {
    return {
      ok: false,
      value: 0,
      error: "Rule must return an integer in [-255, 255] (got non-integer " + raw + ")."
    };
  }
  if (raw < -255 || raw > 255) {
    return {
      ok: false,
      value: 0,
      error: "Rule must return an integer in [-255, 255] (got " + raw + ")."
    };
  }
  return { ok: true, value: raw, error: null };
}

function compileRuleSource(source) {
  const trimmed = String(source ?? "").trim();
  if (!trimmed) return { fn: null, error: "Empty rule source." };
  if (compiledRuleCache.has(trimmed)) return compiledRuleCache.get(trimmed);

  let entry;
  try {
    const fn = new Function("return (" + trimmed + ");")();
    entry =
      typeof fn === "function"
        ? { fn, error: null }
        : {
            fn: null,
            error:
              "Source did not evaluate to a function (got " + typeof fn + ")."
          };
  } catch (error) {
    entry = {
      fn: null,
      error: (error && error.message) || String(error)
    };
  }

  if (compiledRuleCache.size >= COMPILED_RULE_CACHE_MAX) {
    // Drop oldest entry. Map preserves insertion order.
    const firstKey = compiledRuleCache.keys().next().value;
    if (firstKey !== undefined) compiledRuleCache.delete(firstKey);
  }
  compiledRuleCache.set(trimmed, entry);
  return entry;
}

function handleCompile(data, replyTarget) {
  const reply = (result) => {
    if (replyTarget && typeof replyTarget.postMessage === "function") {
      replyTarget.postMessage(
        { source: "custom-blocker-sandbox", id: data.id, result },
        "*"
      );
    }
  };

  const trimmed = String(data.source ?? "").trim();
  if (!trimmed) {
    reply({ ok: false, kind: "empty" });
    return;
  }

  let compiled;
  try {
    compiled = new Function("return (" + trimmed + ");")();
  } catch (error) {
    reply({
      ok: false,
      kind: "syntax",
      message: (error && error.message) || String(error)
    });
    return;
  }

  if (typeof compiled !== "function") {
    reply({ ok: false, kind: "not-function" });
    return;
  }

  let smokeResult;
  try {
    smokeResult = compiled(1, 1, "Monday", 9, 0, "https://example.com/", makeHelpersStub());
  } catch (error) {
    reply({
      ok: false,
      kind: "runtime",
      message: (error && error.message) || String(error)
    });
    return;
  }

  const normalized = normalizeRuleState(smokeResult);
  if (!normalized.ok) {
    reply({
      ok: false,
      kind: "runtime",
      message: normalized.error
    });
    return;
  }

  reply({ ok: true });
}

function handleExecute(data, replyTarget) {
  const reply = (payload) => {
    if (replyTarget && typeof replyTarget.postMessage === "function") {
      replyTarget.postMessage(
        { source: "custom-blocker-sandbox", id: data.id, type: "execute-result", ...payload },
        "*"
      );
    }
  };

  const helperBundle = self.__customBlockerHelpers;
  if (!helperBundle) {
    reply({ error: "helpers.js is not loaded in the sandbox." });
    return;
  }

  const batch = Array.isArray(data.batch) ? data.batch : [];
  const context = data.context || {};
  const intentsState = helperBundle.createEmptyIntentsState();
  const redirectState = {
    url: typeof context.initialRedirectUrl === "string" ? context.initialRedirectUrl.trim() : ""
  };
  const results = [];

  for (const item of batch) {
    const groupId = item?.groupId ?? "";
    const name = item?.name ?? "";
    const source = item?.source ?? "";
    // The buckets are sent in by reference (cloned by the structured
    // postMessage clone). We mutate them here and ship them back so the
    // content script can detect dirty state and flush to background.
    const timersBucket =
      item?.timersBucket && typeof item.timersBucket === "object"
        ? item.timersBucket
        : {};
    const persistenceBucket =
      item?.persistenceBucket && typeof item.persistenceBucket === "object"
        ? item.persistenceBucket
        : {};

    const compiled = compileRuleSource(source);
    if (!compiled.fn) {
      results.push({
        groupId,
        name,
        source,
        result: undefined,
        error: "Compile failed: " + (compiled.error || "unknown error"),
        timersBucket,
        persistenceBucket,
        tickedTimerIds: [],
        displayedTimerIds: []
      });
      continue;
    }

    const tickedSet = new Set();
    const displayedSet = new Set();
    const ruleHelpers = helperBundle.createCustomRuleHelpers({
      groupId,
      timersBucket,
      persistenceBucket,
      intentsState,
      redirectState,
      currentUrl: context.currentUrl,
      now: context.now,
      elapsedMs: context.elapsedMs,
      tickedSet,
      displayedSet
    });

    let ruleResult;
    let ruleError;
    try {
      ruleResult = compiled.fn(
        context.month,
        context.dayOfMonth,
        context.dayName,
        context.hour,
        context.minute,
        context.currentUrl,
        ruleHelpers
      );
    } catch (error) {
      ruleError = (error && error.message) || String(error);
    }

    let normalizedResult = undefined;
    if (!ruleError) {
      const normalized = normalizeRuleState(ruleResult);
      if (!normalized.ok) {
        ruleError = normalized.error;
      } else {
        normalizedResult = normalized.value;
      }
    }

    results.push({
      groupId,
      name,
      source,
      result: ruleError ? undefined : normalizedResult,
      error: ruleError || null,
      timersBucket,
      persistenceBucket,
      tickedTimerIds: [...tickedSet],
      displayedTimerIds: [...displayedSet]
    });
  }

  // Cache predicates and evaluate items now while we still have the
  // closures intact. After this point the predicate functions are
  // dropped from `intentsState` (via toSerializableIntents) so the
  // result can survive the postMessage round-trip back to the host.
  rebuildPredicateCache(intentsState);
  const platform = typeof data.platform === "string" ? data.platform : null;
  const feedItems = Array.isArray(data.feedItems) ? data.feedItems : [];
  const pageItems = (data.pageItems && typeof data.pageItems === "object") ? data.pageItems : {};
  const feedDecisions = evaluateFeedItems(platform, feedItems);
  const pageBlocked = evaluatePageItems(platform, pageItems);

  reply({
    results,
    intents: helperBundle.toSerializableIntents(intentsState),
    feedDecisions,
    pageBlocked,
    redirectUrl: redirectState.url
  });
}

function handleReapply(data, replyTarget) {
  const reply = (payload) => {
    if (replyTarget && typeof replyTarget.postMessage === "function") {
      replyTarget.postMessage(
        { source: "custom-blocker-sandbox", id: data.id, type: "reapply-result", ...payload },
        "*"
      );
    }
  };

  const platform = typeof data.platform === "string" ? data.platform : null;
  const feedItems = Array.isArray(data.feedItems) ? data.feedItems : [];
  const pageItems = (data.pageItems && typeof data.pageItems === "object") ? data.pageItems : {};
  reply({
    feedDecisions: evaluateFeedItems(platform, feedItems),
    pageBlocked: evaluatePageItems(platform, pageItems)
  });
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data.id === "undefined") return;
  if (data.type === "compile") {
    handleCompile(data, event.source);
    return;
  }
  if (data.type === "execute") {
    handleExecute(data, event.source);
    return;
  }
  if (data.type === "reapply") {
    handleReapply(data, event.source);
  }
});
