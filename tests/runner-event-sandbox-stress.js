/* Event-sandbox stress coverage for the extension custom-rule contract. */

globalThis.self = globalThis;
globalThis.window = globalThis;
window.parent = window;
window.addEventListener = function () {};
if (typeof performance === "undefined") {
  globalThis.performance = { now: () => Date.now() };
}
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

load("helpers.js");
load("event-sandbox.js");
load("tests/log.js");

const log = globalThis.__cbTestLog.makeLogger({ colour: true });

function assert(name, condition, data) {
  if (condition) log.pass(name, data);
  else log.fail(name, data);
}

function dispatch(groupId, descriptor) {
  return dispatchEvent(Object.assign({
    type: "webChangedEvent",
    targetGroupId: groupId,
    url: "",
    hostname: "",
    time: { now: 1_800_000_000_000 },
    data: {}
  }, descriptor || {}));
}

const shortsRouteRule = `
(events, helpers) => {
  events.on("webChangedEvent", "block-youtube-shorts", (ev, h) => {
    const youtube = h.getPlatformHelper().youtube();
    if (youtube.isShortUrl(ev.url)) ev.preventDefault();
  });
}
`;

log.section("E1: mobile Shorts route");
let loaded = loadSource("e-mobile-shorts", shortsRouteRule);
let result = dispatch("e-mobile-shorts", { url: "https://m.youtube.com/shorts/abc?feature=share" });
assert("E1 mobile YouTube Shorts prevents navigation", loaded.ok && loaded.handlers === 1 && result.defaultPrevented === true);
unloadGroup("e-mobile-shorts", { clearState: true });

log.section("E2: foreign Shorts-like route");
loaded = loadSource("e-foreign-shorts", shortsRouteRule);
result = dispatch("e-foreign-shorts", { url: "https://example.com/shorts/abc" });
assert("E2 foreign /shorts/ route stays allowed", loaded.ok && result.defaultPrevented === false);
unloadGroup("e-foreign-shorts", { clearState: true });

log.section("E3: normal watch route");
loaded = loadSource("e-watch-page", shortsRouteRule);
result = dispatch("e-watch-page", { url: "https://www.youtube.com/watch?v=abc" });
assert("E3 normal YouTube watch page stays allowed", loaded.ok && result.defaultPrevented === false);
unloadGroup("e-watch-page", { clearState: true });

log.section("E4: priority and propagation");
loaded = loadSource("e-priority", `
(events) => {
  events.on("webChangedEvent", "block-first", (ev) => {
    ev.setResult(-1);
    ev.stopPropagation();
  }, { priority: 20 });
  events.on("webChangedEvent", "allow-second", (ev) => {
    ev.setResult(1);
  });
}
`);
result = dispatch("e-priority", { url: "https://example.com" });
assert("E4 higher-priority stop preserves block result", loaded.ok && result.result === -1 && result.propagationStopped === true);
unloadGroup("e-priority", { clearState: true });

log.section("E5: Run replaces stale handlers");
const alphaRule = `(events) => { events.on("webChangedEvent", "route", (ev) => { if (ev.url.includes("alpha")) ev.preventDefault(); }); }`;
const betaRule = `(events) => { events.on("webChangedEvent", "route", (ev) => { if (ev.url.includes("beta")) ev.preventDefault(); }); }`;
const firstLoad = loadSource("e-rerun", alphaRule);
const secondLoad = loadSource("e-rerun", betaRule);
const alphaResult = dispatch("e-rerun", { url: "https://example.com/alpha" });
const betaResult = dispatch("e-rerun", { url: "https://example.com/beta" });
assert("E5 rerun removes old route handler", firstLoad.ok && secondLoad.ok && secondLoad.handlers === 1 &&
  alphaResult.defaultPrevented === false && betaResult.defaultPrevented === true);
unloadGroup("e-rerun", { clearState: true });

log.section("E6: scoped timer heartbeat");
loaded = loadSource("e-scoped-timer", `
(events, helpers) => {
  const youtube = helpers.getPlatformHelper().youtube();
  helpers.getTimerHelper().getOrCreateTimer({
    id: "shorts-budget",
    displayName: "Shorts budget",
    direction: "backward",
    currentMs: 2000,
    scope: (url) => youtube.isShortUrl(url)
  });
}
`);
const shortsBeat = dispatch("e-scoped-timer", {
  type: "pageHeartbeatEvent",
  url: "https://www.youtube.com/shorts/abc",
  elapsedMs: 500
});
const watchBeat = dispatch("e-scoped-timer", {
  type: "pageHeartbeatEvent",
  url: "https://www.youtube.com/watch?v=abc",
  elapsedMs: 1000
});
const shortTimers = shortsBeat.timerSnapshotsByGroup["e-scoped-timer"] || [];
const watchTimers = watchBeat.timerSnapshotsByGroup["e-scoped-timer"] || [];
assert("E6 scoped timer ticks only on Shorts heartbeat", loaded.ok && shortTimers.length === 1 &&
  shortTimers[0].currentMs === 1500 && watchTimers.length === 0);
unloadGroup("e-scoped-timer", { clearState: true });

const counts = log.counts();
log.summary("EVENT SANDBOX STRESS TOTAL " + counts.total + " PASS " + counts.pass + " FAIL " + counts.fail);
if (counts.fail > 0) {
  log.summary("__CB_TEST_RESULT__: FAIL");
  throw new Error("event sandbox stress tests failed");
}
log.summary("__CB_TEST_RESULT__: OK");
