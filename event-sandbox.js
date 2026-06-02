/* Event-driven custom-rule sandbox.
 *
 * Lives inside an iframe of offscreen.html. Runs in the extension's
 * sandbox CSP, which permits new Function(). All custom-rule source for
 * every enabled custom group is compiled and executed here exactly once
 * per Run click; the source registers persistent event handlers that
 * survive across page navigations and tab switches until the group is
 * Run again, disabled, or deleted.
 *
 * Messages from the offscreen relay (offscreen.js):
 *   { source: "custom-blocker-offscreen", id, payload }
 *   payload.kind:
 *     "load-source"      { groupId, source }
 *     "unload-group"     { groupId }
 *     "dispatch-event"   { type, groupId?, tabId?, pageId?, url, hostname,
 *                          time, data }
 *     "post-event"       same shape as dispatch-event
 *     "list-handlers"    { groupId? }
 *
 * Replies (relayed back to background):
 *   {
 *     ok: boolean,
 *     defaultPrevented: boolean,
 *     stopPropagation: boolean,
 *     result: number | string | null,
 *     redirectUrl: string,
 *     intents: { ... },          // accumulated DOM/navigation intents
 *     logs: [{ level, args }],   // for debug overlay
 *     posts: [{ type, data, scope }] // events the handler synthesised
 *   }
 */

const helpersBundle = self.__customBlockerHelpers;

// Debug-mode flag. Updated by offscreen via a `set-debug-mode`
// postMessage (the iframe has no chrome.storage access). Off by
// default — when off, both verbose console.log AND the in-result
// "[trace]" log entries are suppressed so the popup's Log panel
// only shows what the rule itself emits.
let cbDebugMode = false;

const handlersByType = new Map(); // type -> Array<{ groupId, id, handler, priority, intervalMs, registeredAt }>
const groupSources = new Map();   // groupId -> source string (last loaded)
const groupTimers = new Map();    // groupId -> { [timerId]: { ... persisted state ... } }
const groupPanels = new Map();    // groupId -> { [panelId]: { ... persisted panel state ... } }
const groupPersistence = new Map(); // groupId -> { ... persisted state ... }
const groupPlatformPredicates = new Map(); // groupId -> { [platform]: { [slot]: [{predicate, blockPageOnVisit}] } }
// Sandbox-lifetime registry of timer scope/domain predicates. Lives
// only in this iframe (functions can't be JSON-persisted), so a hard
// reset of the sandbox loses them — but the rule is reloaded
// immediately afterwards which re-registers them.
const groupTimerPredicates = new Map(); // groupId -> { [timerId]: { scope?, domain? } }
const groupPanelPredicates = new Map(); // groupId -> { [panelId]: { scope?, domain? } }
const groupPanelHandlerIds = new Map(); // groupId -> { [panelId]: Set<handlerId> }
const previouslyExpiredTimers = new Map(); // groupId -> Set<timerId>

function getGroupTimers(groupId) {
  if (!groupTimers.has(groupId)) {
    groupTimers.set(groupId, {});
  }
  return groupTimers.get(groupId);
}

function getGroupTimerPredicates(groupId) {
  if (!groupTimerPredicates.has(groupId)) {
    groupTimerPredicates.set(groupId, {});
  }
  return groupTimerPredicates.get(groupId);
}

function getGroupPanels(groupId) {
  if (!groupPanels.has(groupId)) {
    groupPanels.set(groupId, {});
  }
  return groupPanels.get(groupId);
}

function getGroupPanelPredicates(groupId) {
  if (!groupPanelPredicates.has(groupId)) {
    groupPanelPredicates.set(groupId, {});
  }
  return groupPanelPredicates.get(groupId);
}

function getGroupPersistence(groupId) {
  if (!groupPersistence.has(groupId)) {
    groupPersistence.set(groupId, {});
  }
  return groupPersistence.get(groupId);
}

function getGroupPlatformPredicates(groupId) {
  if (!groupPlatformPredicates.has(groupId)) {
    groupPlatformPredicates.set(groupId, {
      youtube: {}, tiktok: {}, instagram: {}, facebook: {}, twitch: {}
    });
  }
  return groupPlatformPredicates.get(groupId);
}

function getHandlersForType(type) {
  if (!handlersByType.has(type)) {
    handlersByType.set(type, []);
  }
  return handlersByType.get(type);
}

function sortHandlers(list) {
  list.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.registeredAt - b.registeredAt;
  });
}

// Caps the number of handlers a single group can register, so a rule
// that does `for (let i = 0; i < 1e6; i++) events.register(...)` at
// load time can't blow up memory or sortHandlers' O(n log n) cost.
const MAX_HANDLERS_PER_GROUP = 1000;
const handlerCountByGroup = new Map(); // groupId -> count

// Repeated overruns from the same group are treated as a programming
// bug and trigger background-side quarantine (the rule gets disabled in
// storage). We tolerate a single slow dispatch (e.g. the user's handler
// is doing legitimate work that took just over the budget) but disable
// after this many overruns inside the rolling window.
const OVERRUN_QUARANTINE_THRESHOLD = 3;
const OVERRUN_WINDOW_MS = 60_000;
const overrunHistoryByGroup = new Map(); // groupId -> Array<timestamp>

function recordOverrun(groupId) {
  const now = Date.now();
  const list = (overrunHistoryByGroup.get(groupId) || []).filter(
    (t) => now - t < OVERRUN_WINDOW_MS
  );
  list.push(now);
  overrunHistoryByGroup.set(groupId, list);
  return list.length;
}

function countHandlersForGroup(groupId) {
  return handlerCountByGroup.get(groupId) || 0;
}

function registerHandler(groupId, type, id, handler, options) {
  if (typeof type !== "string" || !type) return false;
  if (typeof id !== "string" || !id) return false;
  if (typeof handler !== "function") return false;
  // Deadline check: if the registration body is itself a runaway loop
  // like `for (let i = 0; i < 1e5; i++) events.register(...)` the cap
  // would short-circuit each call, but the loop itself still burns CPU
  // calling findIndex 100k times. Throwing here unwinds the user loop
  // exactly like h.log() does, so the registration completes in ≤1s.
  // The throw is caught by loadSource's outer try, which records a
  // [register error] and quarantines on registration overrun.
  if (currentDispatchAccumulator) {
    try {
      // checkHandlerDeadline is provided by helpers.js (loaded into the
      // sandbox via the shared bundle); guard the lookup so a missing
      // bundle just degrades to no deadline check rather than throwing
      // a ReferenceError.
      const cb = self.__customBlockerHelpers;
      if (cb && typeof cb.checkHandlerDeadline === "function") {
        cb.checkHandlerDeadline(currentDispatchAccumulator);
      }
    } catch (error) {
      throw error;
    }
  }
  const list = getHandlersForType(type);
  const idx = list.findIndex((entry) => entry.groupId === groupId && entry.id === id);
  if (idx < 0 && countHandlersForGroup(groupId) >= MAX_HANDLERS_PER_GROUP) {
    return false;
  }
  const priority = Number.isFinite(options?.priority) ? Number(options.priority) : 0;
  const intervalMs = Number.isFinite(options?.intervalMs) && options.intervalMs > 0
    ? Math.floor(options.intervalMs)
    : null;
  const entry = {
    groupId,
    id,
    handler,
    priority,
    intervalMs,
    registeredAt: idx >= 0 ? list[idx].registeredAt : performance.now()
  };
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.push(entry);
    handlerCountByGroup.set(groupId, countHandlersForGroup(groupId) + 1);
  }
  sortHandlers(list);
  return true;
}

function unregisterHandler(groupId, type, id) {
  const list = handlersByType.get(type);
  if (!list) return false;
  const before = list.length;
  const next = list.filter((entry) => !(entry.groupId === groupId && entry.id === id));
  handlersByType.set(type, next);
  const removed = before - next.length;
  if (removed > 0) {
    handlerCountByGroup.set(groupId, Math.max(0, countHandlersForGroup(groupId) - removed));
  }
  return removed > 0;
}

function unregisterAllForType(groupId, type) {
  const list = handlersByType.get(type);
  if (!list) return 0;
  const before = list.length;
  const next = list.filter((entry) => entry.groupId !== groupId);
  handlersByType.set(type, next);
  const removed = before - next.length;
  if (removed > 0) {
    handlerCountByGroup.set(groupId, Math.max(0, countHandlersForGroup(groupId) - removed));
  }
  return removed;
}

function unregisterPanelHandlers(groupId, panelId) {
  const byPanel = groupPanelHandlerIds.get(groupId);
  const ids = byPanel && byPanel[panelId];
  if (!ids) return 0;
  let removed = 0;
  for (const id of ids) {
    if (unregisterHandler(groupId, "panelEvent", id)) removed += 1;
  }
  delete byPanel[panelId];
  return removed;
}

function registerInlinePanelHandler(groupId, panelId, controlId, eventName, handler, options) {
  if (typeof panelId !== "string" || !panelId || typeof handler !== "function") return false;
  const normalizedEvent = typeof eventName === "string" && eventName ? eventName : "*";
  const normalizedControl = typeof controlId === "string" && controlId ? controlId : "*";
  const handlerId = "_panel:" + panelId + ":" + normalizedControl + ":" + normalizedEvent;
  const wrapped = (ev, helpers) => {
    const data = ev && ev.data && typeof ev.data === "object" ? ev.data : {};
    if (data.panelId !== panelId) return;
    if (normalizedControl !== "*" && data.controlId !== normalizedControl) return;
    if (normalizedEvent !== "*" && data.eventName !== normalizedEvent) return;
    ev.panelId = data.panelId;
    ev.controlId = data.controlId || "";
    ev.eventName = data.eventName || "";
    ev.value = data.value;
    ev.values = data.values && typeof data.values === "object" ? data.values : {};
    ev.key = data.key || "";
    ev.code = data.code || "";
    ev.keyInfo = data.keyInfo && typeof data.keyInfo === "object" ? data.keyInfo : null;
    handler(ev, helpers);
  };
  const ok = registerHandler(groupId, "panelEvent", handlerId, wrapped, options || {});
  if (ok) {
    const byPanel = groupPanelHandlerIds.get(groupId) || {};
    const ids = byPanel[panelId] || new Set();
    ids.add(handlerId);
    byPanel[panelId] = ids;
    groupPanelHandlerIds.set(groupId, byPanel);
  }
  return ok;
}

function unloadGroup(groupId, { clearState = false } = {}) {
  const hadTimers = Boolean(groupTimers.get(groupId) && Object.keys(groupTimers.get(groupId)).length > 0);
  const hadPanels = Boolean(groupPanels.get(groupId) && Object.keys(groupPanels.get(groupId)).length > 0);
  const hadPersistence =
    Boolean(groupPersistence.get(groupId) && Object.keys(groupPersistence.get(groupId)).length > 0);
  for (const [type, list] of handlersByType.entries()) {
    handlersByType.set(type, list.filter((entry) => entry.groupId !== groupId));
  }
  groupSources.delete(groupId);
  groupHelpersCache.delete(groupId);
  groupPlatformPredicates.delete(groupId);
  overrunHistoryByGroup.delete(groupId);
  // Drop scope/domain predicates so a re-Run doesn't leak the previous
  // version's closures (which may close over now-stale module
  // references). The rule re-registers them on its next dispatch.
  groupTimerPredicates.delete(groupId);
  groupPanelPredicates.delete(groupId);
  groupPanelHandlerIds.delete(groupId);
  previouslyExpiredTimers.delete(groupId);
  handlerCountByGroup.delete(groupId);
  if (clearState) {
    groupTimers.delete(groupId);
    groupPanels.delete(groupId);
    groupPersistence.delete(groupId);
  }
  return {
    timerRegistryChanged: clearState && (hadTimers || hadPersistence),
    panelRegistryChanged: clearState && hadPanels
  };
}

function listHandlers(groupId) {
  const out = [];
  for (const [type, list] of handlersByType.entries()) {
    for (const entry of list) {
      if (groupId && entry.groupId !== groupId) continue;
      out.push({
        type,
        groupId: entry.groupId,
        id: entry.id,
        priority: entry.priority,
        intervalMs: entry.intervalMs
      });
    }
  }
  return out;
}

// Per-group Events registry. Each registration is tagged with the owning
// groupId so Run / delete flushes only that group's handlers.

const RESERVED_EVENT_PREFIX = "_";
const BUILTIN_EVENT_TYPES = [
  "tickEvent",
  "openWebEvent",
  "closeWebEvent",
  "switchWebEvent",
  "switchDomainEvent",
  // webChangedEvent fires on every navigation including same-URL reloads;
  // switchWebEvent fires only on actual URL change.
  "webChangedEvent",
  "timerEnded",
  // snoozePress fires when the user clicks Start Snooze in the popup for a
  // custom group. The rule owns the snooze semantics (no built-in fallback).
  "snoozePress",
  // panelEvent fires when a content-script-rendered panel control is used.
  "panelEvent",
  // localFileEvent fires after getLocalFolderHelper() async file requests.
  "localFileEvent",
  // pageHeartbeatEvent fires for every visibility-aware content-script
  // heartbeat (≈ every 250ms when the tab is visible and not hidden,
  // matching the default block group's countdown). It carries elapsedMs
  // since the previous heartbeat for THIS tab so timers advance only by
  // real visible-page time. Custom rules don't need to register a
  // handler for it: registerTickEvent / getOrCreateTimer({ scope })
  // already auto-tick under it.
  "pageHeartbeatEvent"
];

const PANEL_VISIBILITY_EVENT_TYPES = new Set([
  "panelRefreshEvent",
  "openWebEvent",
  "switchWebEvent",
  "switchDomainEvent",
  "webChangedEvent"
]);

function buildEventsRegistry(groupId, dispatchContext) {
  function typedRegister(type) {
    return (id, handler, options) => registerHandler(groupId, type, id, handler, options);
  }
  function typedGet(type) {
    return (id) => {
      const list = handlersByType.get(type) || [];
      const found = list.find((entry) => entry.groupId === groupId && entry.id === id);
      return found ? found.handler : null;
    };
  }
  function typedGetAll(type) {
    return () => {
      const list = handlersByType.get(type) || [];
      const out = {};
      for (const entry of list) {
        if (entry.groupId === groupId) {
          out[entry.id] = entry.handler;
        }
      }
      return out;
    };
  }
  function typedCount(type) {
    return () => {
      const list = handlersByType.get(type) || [];
      return list.filter((entry) => entry.groupId === groupId).length;
    };
  }

  const api = {
    register(type, id, handler, options) {
      if (typeof type !== "string" || !type) return false;
      if (type.startsWith(RESERVED_EVENT_PREFIX)) return false;
      return registerHandler(groupId, type, id, handler, options);
    },
    getEvent(type, id) {
      const list = handlersByType.get(type) || [];
      const found = list.find((entry) => entry.groupId === groupId && entry.id === id);
      return found ? found.handler : null;
    },
    getEvents(type) {
      const list = handlersByType.get(type) || [];
      const out = {};
      for (const entry of list) {
        if (entry.groupId === groupId) {
          out[entry.id] = entry.handler;
        }
      }
      return out;
    },
    countRegistered(type) {
      const list = handlersByType.get(type) || [];
      return list.filter((entry) => entry.groupId === groupId).length;
    },
    unregister(type, id) {
      return unregisterHandler(groupId, type, id);
    },
    unregisterAll(type) {
      return unregisterAllForType(groupId, type);
    },
    post(type, data, options) {
      if (typeof type !== "string" || !type) return;
      if (type.startsWith(RESERVED_EVENT_PREFIX)) return;
      if (dispatchContext.queuedPosts.length >= MAX_POSTS_PER_DISPATCH) {
        return;
      }
      dispatchContext.queuedPosts.push({
        type,
        data,
        scope: options?.scope === "global" ? "global" : "group",
        groupId
      });
    }
  };

  for (const type of BUILTIN_EVENT_TYPES) {
    const suffix = type[0].toUpperCase() + type.slice(1);
    api["register" + suffix] = typedRegister(type);
    api["get" + suffix] = typedGet(type);
    api["get" + suffix + "s"] = typedGetAll(type);
    api["count" + suffix.replace(/Event$/, "") + "Registered"] = typedCount(type);
  }
  // Aliased counters using shorter, friendlier names.
  api.countTickRegistered = typedCount("tickEvent");
  api.countOpenWebRegistered = typedCount("openWebEvent");
  api.countCloseWebRegistered = typedCount("closeWebEvent");
  api.countSwitchWebRegistered = typedCount("switchWebEvent");
  api.countSwitchDomainRegistered = typedCount("switchDomainEvent");
  api.countWebChangedRegistered = typedCount("webChangedEvent");
  api.countTimerEndedRegistered = typedCount("timerEnded");
  api.countSnoozePressRegistered = typedCount("snoozePress");
  api.countPanelRegistered = typedCount("panelEvent");
  api.countLocalFileRegistered = typedCount("localFileEvent");
  // timerEnded and snoozePress wire types lack the Event suffix; expose
  // friendlier aliases so user code can use registerXxxEvent uniformly.
  api.registerTimerEndedEvent = typedRegister("timerEnded");
  api.getTimerEndedEvent = typedGet("timerEnded");
  api.getTimerEndedEvents = typedGetAll("timerEnded");
  api.countTimerEndedEventRegistered = typedCount("timerEnded");
  api.registerSnoozePressEvent = typedRegister("snoozePress");
  api.getSnoozePressEvent = typedGet("snoozePress");
  api.getSnoozePressEvents = typedGetAll("snoozePress");
  api.countSnoozePressEventRegistered = typedCount("snoozePress");
  api.registerPanelEvent = typedRegister("panelEvent");
  api.getPanelEvent = typedGet("panelEvent");
  api.getPanelEvents = typedGetAll("panelEvent");
  api.countPanelEventRegistered = typedCount("panelEvent");
  api.registerLocalFileEvent = typedRegister("localFileEvent");
  api.getLocalFileEvent = typedGet("localFileEvent");
  api.getLocalFileEvents = typedGetAll("localFileEvent");
  api.countLocalFileEventRegistered = typedCount("localFileEvent");

  return api;
}

// One helpers object per group, lazily built. Internally helpers look up
// the accumulator and dispatch context via a thunk we swap before every
// handler call — that's why a helpers object stashed at registration
// time keeps working in every later dispatch.
const groupHelpersCache = new Map();
let currentDispatchAccumulator = null;
let currentDispatchContext = null;

function getOrCreateGroupHelpers(groupId) {
  if (groupHelpersCache.has(groupId)) return groupHelpersCache.get(groupId);
  if (!helpersBundle || !helpersBundle.createEventGroupHelpers) {
    groupHelpersCache.set(groupId, {});
    return {};
  }
  const helpers = helpersBundle.createEventGroupHelpers({
    groupId,
    currentUrl: "",
    timersBucket: getGroupTimers(groupId),
    timerPredicatesBucket: getGroupTimerPredicates(groupId),
    panelsBucket: getGroupPanels(groupId),
    panelPredicatesBucket: getGroupPanelPredicates(groupId),
    registerPanelHandler: (panelId, controlId, eventName, handler, options) =>
      registerInlinePanelHandler(groupId, panelId, controlId, eventName, handler, options),
    unregisterPanelHandlers: (panelId) => unregisterPanelHandlers(groupId, panelId),
    persistenceBucket: getGroupPersistence(groupId),
    platformPredicatesBucket: getGroupPlatformPredicates(groupId),
    accumulatorRef: { get: () => currentDispatchAccumulator || makeAccumulator() },
    dispatchContextRef: () => currentDispatchContext || {}
  });
  groupHelpersCache.set(groupId, helpers);
  return helpers;
}

function withDispatchContext(accumulator, context, fn) {
  const prevAcc = currentDispatchAccumulator;
  const prevCtx = currentDispatchContext;
  currentDispatchAccumulator = accumulator;
  currentDispatchContext = context;
  try {
    return fn();
  } finally {
    currentDispatchAccumulator = prevAcc;
    currentDispatchContext = prevCtx;
  }
}

// Hard caps that keep a runaway handler (e.g. `for (let i = 0; i < 1e6; i++)
// h.log(i)`) from flooding the IPC chain sandbox → offscreen → background →
// popup. Without these caps each iteration round-trips through structured
// clone and chrome.runtime.sendMessage, which freezes the browser process
// for minutes and persists across popup re-opens until the in-flight
// queue drains.
const MAX_LOGS_PER_DISPATCH = 200;
const MAX_POSTS_PER_DISPATCH = 64;
const MAX_INTENTS_PER_DISPATCH = 256;
const MAX_DOM_OPS_PER_DISPATCH = 256;
const HANDLER_TIME_BUDGET_MS = 1000;

function makeAccumulator() {
  const acc = {
    intents: [],
    logs: [],
    redirectUrl: null,
    domOps: [],
    timerRegistryChanged: false,
    panelRegistryChanged: false,
    logsDropped: 0,
    postsDropped: 0
  };
  return acc;
}

// Bounded push helpers shared by the in-sandbox helpers and the local log
// channel. Once the cap is hit we drop silently, but remember the count so
// dispatchEvent can append a single "[truncated N entries]" warning.
function boundedPush(list, item, cap, dropCounterKey, accumulator) {
  if (!Array.isArray(list)) return false;
  if (list.length >= cap) {
    if (accumulator && dropCounterKey) {
      accumulator[dropCounterKey] = (accumulator[dropCounterKey] || 0) + 1;
    }
    return false;
  }
  list.push(item);
  return true;
}

// ────────────────────────────────────────────────────────────────────────
// Event object construction & dispatch
// ────────────────────────────────────────────────────────────────────────

function buildEventObject(descriptor, recipientGroupId, accumulator) {
  const customFields = {};
  let resultValue = null;
  const evt = {
    type: descriptor.type,
    groupId: recipientGroupId,
    tabId: descriptor.tabId ?? null,
    pageId: descriptor.pageId ?? null,
    url: typeof descriptor.url === "string" ? descriptor.url : "",
    hostname: typeof descriptor.hostname === "string" ? descriptor.hostname : "",
    time: descriptor.time ? { ...descriptor.time } : null,
    data: descriptor.data ?? null,

    defaultPrevented: false,
    propagationStopped: false,

    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    setResult(value) {
      if (typeof value === "number" || typeof value === "string") {
        resultValue = value;
      }
    },
    getResult() {
      return resultValue;
    },
    post(type, data, options) {
      if (typeof type !== "string" || !type) return;
      if (type.startsWith(RESERVED_EVENT_PREFIX)) return;
      accumulator.posts = accumulator.posts || [];
      if (accumulator.posts.length >= MAX_POSTS_PER_DISPATCH) {
        accumulator.postsDropped = (accumulator.postsDropped || 0) + 1;
        return;
      }
      accumulator.posts.push({
        type,
        data,
        scope: options?.scope === "global" ? "global" : "group",
        groupId: recipientGroupId
      });
    },
    setRedirectLink(url) {
      if (typeof url !== "string") return false;
      accumulator.redirectUrl = url.trim();
      return true;
    },
    getRedirectLink() {
      return accumulator.redirectUrl ?? "";
    }
  };

  if (descriptor.type === "panelEvent" && descriptor.data && typeof descriptor.data === "object") {
    evt.panelId = descriptor.data.panelId || "";
    evt.controlId = descriptor.data.controlId || "";
    evt.eventName = descriptor.data.eventName || "";
    evt.value = descriptor.data.value;
    evt.values = descriptor.data.values && typeof descriptor.data.values === "object"
      ? descriptor.data.values
      : {};
    evt.key = descriptor.data.key || "";
    evt.code = descriptor.data.code || "";
    evt.keyInfo = descriptor.data.keyInfo && typeof descriptor.data.keyInfo === "object"
      ? descriptor.data.keyInfo
      : null;
  }

  if (descriptor.type === "localFileEvent" && descriptor.data && typeof descriptor.data === "object") {
    evt.eventName = descriptor.data.eventName || "";
    evt.action = descriptor.data.action || evt.eventName || "";
    evt.path = descriptor.data.path || "";
    evt.directoryPath = descriptor.data.directoryPath || "";
    evt.requestId = descriptor.data.requestId || "";
    evt.ok = descriptor.data.ok === true;
    evt.text = typeof descriptor.data.text === "string" ? descriptor.data.text : "";
    evt.value = descriptor.data.value;
    evt.entries = Array.isArray(descriptor.data.entries) ? descriptor.data.entries.slice() : [];
    evt.exists = descriptor.data.exists === true;
    evt.bytes = Number.isFinite(Number(descriptor.data.bytes)) ? Number(descriptor.data.bytes) : 0;
    evt.error = typeof descriptor.data.error === "string" ? descriptor.data.error : "";
  }

  // Allow free-form fields to be set by the user without touching our
  // reserved keys. We make them go through a property bag.
  return new Proxy(evt, {
    set(target, key, value) {
      if (key in target) {
        target[key] = value;
        return true;
      }
      customFields[key] = value;
      return true;
    },
    get(target, key) {
      if (key in target) return target[key];
      if (key === "custom") return customFields;
      return customFields[key];
    },
    has(target, key) {
      return key in target || key in customFields;
    }
  });
}

function dispatchEvent(descriptor) {
  const accumulator = makeAccumulator();
  accumulator.posts = [];

  const list = (handlersByType.get(descriptor.type) || []).slice();
  // descriptor.targetGroupId is set for posted events with scope "group"
  const filtered = list.filter((entry) => {
    if (descriptor.targetGroupId && entry.groupId !== descriptor.targetGroupId) {
      return false;
    }
    if (descriptor.type === "tickEvent" && entry.intervalMs) {
      const now = descriptor.time?.now ?? Date.now();
      if (!entry._lastFiredAt) entry._lastFiredAt = 0;
      if (now - entry._lastFiredAt < entry.intervalMs) {
        return false;
      }
      entry._lastFiredAt = now;
    }
    return true;
  });

  // Diagnostic trace. Gated behind Settings → Debug mode so a normal
  // user's popup Log panel doesn't fill up with one "[trace] …" entry
  // for every event. The log helper that user rules call is unaffected.
  if (cbDebugMode && descriptor.type !== "tickEvent" && descriptor.type !== "pageHeartbeatEvent") {
    try { console.log("[CustomBlocker:trace] sandbox dispatchEvent", descriptor.type, "registered:", list.length, "after-filter:", filtered.length, "targetGroupId:", descriptor.targetGroupId); } catch (_) {}
    boundedPush(
      accumulator.logs,
      {
        level: filtered.length === 0 ? "warn" : "log",
        groupId: "trace",
        args: ["[trace] " + descriptor.type + " · " + filtered.length + "/" + list.length + " handler(s)"]
      },
      MAX_LOGS_PER_DISPATCH,
      "logsDropped",
      accumulator
    );
  }

  let lastResult = null;
  let anyPreventDefault = false;
  let anyStopPropagation = false;
  let lastSetResultEvent = null;

  // Per-group, per-dispatch elapsedMs and tick deduplication state.
  // elapsedMs comes from the descriptor when the dispatching layer
  // (content.js heartbeat → background → sandbox) knows the
  // visibility-aware delta; this is the canonical "real visible-page
  // time" source so custom timers advance exactly like the default
  // block group countdown. For non-heartbeat events (open/switch/...)
  // elapsedMs is 0 — those events aren't responsible for advancing
  // timer state; they only fire predicates.
  const dispatchNow = descriptor.time?.now ?? Date.now();
  const tickedByGroup = new Map();    // groupId -> Set<timerId>
  const displayedByGroup = new Map(); // groupId -> Set<timerId>
  const panelDisplayedByGroup = new Map(); // groupId -> Set<panelId>
  const rawElapsed = Number(descriptor.elapsedMs);
  const dispatchElapsedMs = Number.isFinite(rawElapsed) && rawElapsed >= 0
    ? Math.min(rawElapsed, 60_000)
    : 0;

  const makeDispatchContext = (groupId) => {
    if (!tickedByGroup.has(groupId)) {
      tickedByGroup.set(groupId, new Set());
      displayedByGroup.set(groupId, new Set());
    }
    if (!panelDisplayedByGroup.has(groupId)) {
      panelDisplayedByGroup.set(groupId, new Set());
    }
    return {
      tabId: descriptor.tabId ?? null,
      pageId: descriptor.pageId ?? null,
      currentUrl: descriptor.url,
      now: dispatchNow,
      tabsSnapshot: descriptor.tabsSnapshot,
      platformSnapshot: descriptor.platformSnapshot,
      elapsedMs: dispatchElapsedMs,
      tickedSet: tickedByGroup.get(groupId),
      displayedSet: displayedByGroup.get(groupId),
      panelDisplayedSet: panelDisplayedByGroup.get(groupId)
    };
  };

  if (descriptor.type === "panelEvent" && descriptor.targetGroupId) {
    const helpers = getOrCreateGroupHelpers(descriptor.targetGroupId);
    const panelHelper = helpers && helpers.getPanelHelper && helpers.getPanelHelper();
    if (panelHelper && typeof panelHelper.__cb_applyPanelEvent === "function") {
      withDispatchContext(accumulator, makeDispatchContext(descriptor.targetGroupId), () => {
        try { panelHelper.__cb_applyPanelEvent(descriptor.data || {}); } catch (_) {}
      });
    }
  }

  for (const entry of filtered) {
    const helpers = getOrCreateGroupHelpers(entry.groupId);
    const evt = buildEventObject(descriptor, entry.groupId, accumulator);
    const dispatchContext = makeDispatchContext(entry.groupId);
    withDispatchContext(accumulator, dispatchContext, () => {
      const handlerStart = performance.now();
      accumulator._handlerDeadline = handlerStart + HANDLER_TIME_BUDGET_MS;
      accumulator._handlerOverrun = false;
      // Beacon: tell the offscreen relay which handler we're about to
      // invoke. If the iframe locks up inside this handler, offscreen
      // will know which group to blame in its hard-timeout reply.
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            source: "custom-blocker-event-sandbox",
            type: "handler-start",
            groupId: entry.groupId,
            handlerId: entry.id,
            eventType: descriptor.type
          }, "*");
        }
      } catch (_) {}
      try {
        if (cbDebugMode) { try { console.log("[CustomBlocker:trace] sandbox handler", descriptor.type, entry.groupId, entry.id); } catch (_) {} }
        entry.handler(evt, helpers);
      } catch (error) {
        boundedPush(
          accumulator.logs,
          {
            level: "error",
            groupId: entry.groupId,
            args: ["[handler error]", entry.id, String(error && error.message ? error.message : error)]
          },
          MAX_LOGS_PER_DISPATCH,
          "logsDropped",
          accumulator
        );
      } finally {
        if (accumulator._handlerOverrun) {
          const overrunCount = recordOverrun(entry.groupId);
          boundedPush(
            accumulator.logs,
            {
              level: "warn",
              groupId: entry.groupId,
              args: [
                "[handler aborted] " + entry.id +
                  " exceeded the " + HANDLER_TIME_BUDGET_MS + "ms time budget; remaining iterations were skipped" +
                  " (" + overrunCount + "/" + OVERRUN_QUARANTINE_THRESHOLD + " in the last " +
                  Math.round(OVERRUN_WINDOW_MS / 1000) + "s)"
              ]
            },
            MAX_LOGS_PER_DISPATCH,
            "logsDropped",
            accumulator
          );
          // Once we've crossed the threshold, surface a quarantine hint
          // on this dispatch's reply. background.js will pick it up and
          // disable the group in storage; the reconciler then unloads
          // its handlers so subsequent dispatches don't fire them at
          // all. Only the FIRST quarantine hint is set per dispatch.
          if (overrunCount >= OVERRUN_QUARANTINE_THRESHOLD && !accumulator.quarantine) {
            accumulator.quarantine = {
              groupId: entry.groupId,
              reason: "deadline-overrun",
              overrunCount
            };
          }
        }
        accumulator._handlerDeadline = 0;
        accumulator._handlerOverrun = false;
      }
    });
    if (evt.defaultPrevented) anyPreventDefault = true;
    if (evt.getResult() !== null) {
      lastResult = evt.getResult();
      lastSetResultEvent = entry;
    }
    if (evt.propagationStopped) {
      anyStopPropagation = true;
      break;
    }
  }

  // Now sweep every group that owns at least one timer, even if no
  // handler for THIS event type was registered. This is what lets
  // pageHeartbeatEvent advance timers via getOrCreateTimer({ scope })
  // without the rule needing a tickEvent / heartbeat handler. We also
  // run it on non-heartbeat dispatches (open/switch/...) — elapsedMs
  // is 0 there so no tick happens, but the displayedSet is rebuilt
  // for the new URL so the overlay updates instantly on navigation.
  const timerSnapshotsByGroup = {};
  for (const groupId of groupTimers.keys()) {
    const helpers = getOrCreateGroupHelpers(groupId);
    const tickFn = helpers && helpers.getTimerHelper && helpers.getTimerHelper();
    if (!tickFn || typeof tickFn.__cb_tickAllScopedTimers !== "function") continue;
    const dispatchContext = makeDispatchContext(groupId);
    withDispatchContext(accumulator, dispatchContext, () => {
      try { tickFn.__cb_tickAllScopedTimers(); } catch (_) {}
      try {
        const snaps = tickFn.__cb_getDisplayedTimerSnapshots();
        if (Array.isArray(snaps) && snaps.length > 0) {
          timerSnapshotsByGroup[groupId] = snaps;
        }
      } catch (_) {}
    });
  }

  const panelSnapshotsByGroup = {};
  const panelGroupsWithPanels = [];
  const shouldCollectPanelSnapshots =
    Boolean(accumulator.panelRegistryChanged) ||
    PANEL_VISIBILITY_EVENT_TYPES.has(descriptor.type);
  if (shouldCollectPanelSnapshots) {
    for (const groupId of groupPanels.keys()) {
      const panels = groupPanels.get(groupId);
      if (!panels || Object.keys(panels).length === 0) continue;
      panelGroupsWithPanels.push(groupId);
      const helpers = getOrCreateGroupHelpers(groupId);
      const panelFn = helpers && helpers.getPanelHelper && helpers.getPanelHelper();
      if (!panelFn || typeof panelFn.__cb_refreshDisplayedPanels !== "function") continue;
      const dispatchContext = makeDispatchContext(groupId);
      withDispatchContext(accumulator, dispatchContext, () => {
        try { panelFn.__cb_refreshDisplayedPanels(); } catch (_) {}
        try {
          const snaps = panelFn.__cb_getDisplayedPanelSnapshots();
          if (Array.isArray(snaps) && snaps.length > 0) {
            panelSnapshotsByGroup[groupId] = snaps;
          }
        } catch (_) {}
      });
    }
  }

  if (typeof lastResult === "number" && lastResult === 1) {
    anyPreventDefault = false;
  }

  if (accumulator.logsDropped > 0 && accumulator.logs.length < MAX_LOGS_PER_DISPATCH) {
    accumulator.logs.push({
      level: "warn",
      groupId: "trace",
      args: [
        "[truncated] " + accumulator.logsDropped +
          " log entr" + (accumulator.logsDropped === 1 ? "y was" : "ies were") +
          " dropped to keep the popup responsive (cap " + MAX_LOGS_PER_DISPATCH + ")"
      ]
    });
  }

  return {
    defaultPrevented: anyPreventDefault,
    propagationStopped: anyStopPropagation,
    result: lastResult,
    redirectUrl: accumulator.redirectUrl ?? "",
    intents: accumulator.intents,
    domOps: accumulator.domOps,
    logs: accumulator.logs,
    posts: accumulator.posts || [],
    logsDropped: accumulator.logsDropped || 0,
    postsDropped: accumulator.postsDropped || 0,
    quarantine: accumulator.quarantine || null,
    timerRegistryChanged: Boolean(accumulator.timerRegistryChanged),
    panelRegistryChanged: Boolean(accumulator.panelRegistryChanged),
    // Map of groupId -> [{id, displayName, direction, currentMs,
    // isPaused, isExpired}] for timers whose domain (or scope) matches
    // descriptor.url. background.js merges these into the page session
    // items so they render in the same overlay as the default block
    // group countdown.
    timerSnapshotsByGroup,
    panelSnapshotsByGroup,
    panelGroupsWithPanels
  };
}

// ────────────────────────────────────────────────────────────────────────
// Source loading
// ────────────────────────────────────────────────────────────────────────

function loadSource(groupId, source) {
  // Always wipe previous registrations and stale timer state for this
  // group first. A Run click should reflect the current script, not keep
  // orphaned timers from an older version.
  const unloadResult = unloadGroup(groupId, { clearState: true });
  const rawTrimmed = String(source ?? "").trim();
  if (!rawTrimmed) {
    return {
      ok: true,
      handlers: 0,
      error: null,
      timerRegistryChanged: Boolean(unloadResult.timerRegistryChanged),
      panelRegistryChanged: Boolean(unloadResult.panelRegistryChanged)
    };
  }

  // Two source styles are supported:
  //   (events, helpers) => { ... }     ← function expression
  //   function (events, helpers) { ... }
  //   <bare statements>                 ← treated as a function body
  //
  // We try the function-expression form first by wrapping in parens. We
  // strip ANY trailing semicolons so that a paste like
  //   (events, helpers) => { ... };
  // doesn't silently fall through to the function-body path (which would
  // turn the arrow expression into a discarded statement that registers
  // nothing). The IIFE compile error is now retained so we can surface it
  // when the body-path also yields 0 handlers — that's the diagnostic for
  // "your code looked like a function but had a stray syntax problem".
  const trimmed = rawTrimmed.replace(/;+\s*$/, "");
  let invoke;
  let exprCompileError = null;
  try {
    const candidate = new Function("return (" + trimmed + ");")();
    if (typeof candidate === "function") {
      invoke = (events, helpers) => candidate(events, helpers);
    }
  } catch (error) {
    exprCompileError = error;
  }

  if (!invoke) {
    try {
      // We bind BOTH "events" and "event" to the same registry, so user
      // code in the bare-statements path can reference either name. The
      // built-in default rule uses "event" (singular); newer examples
      // tend to use "events" (plural). Keeping both aliases avoids a
      // silent ReferenceError that would otherwise leave the rule with 0
      // handlers and no diagnostic.
      const fn = new Function("events", "event", "helpers", trimmed);
      invoke = (events, helpers) => fn(events, events, helpers);
    } catch (error) {
      const msg =
        "Compile failed: " + (error && error.message ? error.message : String(error)) +
        (exprCompileError && exprCompileError.message
          ? " (also failed as expression: " + exprCompileError.message + ")"
          : "");
      return {
        ok: false,
        handlers: 0,
        error: msg,
        timerRegistryChanged: Boolean(unloadResult.timerRegistryChanged),
        panelRegistryChanged: Boolean(unloadResult.panelRegistryChanged)
      };
    }
  }

  // Drop any cached helpers for this group; we rebuild them so the new
  // source's registration-time captures use the same thunk-backed helper
  // object that handler-time invocations will use.
  groupHelpersCache.delete(groupId);
  const accumulator = makeAccumulator();
  const events = buildEventsRegistry(groupId, { queuedPosts: [] });
  const helpers = getOrCreateGroupHelpers(groupId);

  let invokeError = null;
  withDispatchContext(accumulator, { tabId: null, pageId: null, currentUrl: "", now: Date.now() }, () => {
    // Apply the same time budget to the registration body so a source
    // like `(events) => { while (true) {} }` can't lock the iframe at
    // load time. The deadline is checked inside helpers; if the body
    // never calls a helper the offscreen-side hard timeout (5s) will
    // hard-reset the iframe.
    accumulator._handlerDeadline = performance.now() + HANDLER_TIME_BUDGET_MS;
    accumulator._handlerOverrun = false;
    try {
      invoke(events, helpers);
    } catch (error) {
      invokeError = error;
    } finally {
      accumulator._handlerDeadline = 0;
    }
  });
  // Forward any registration-time logs and an error/zero-handlers warning
  // through the same channel that handler-time logs use, so they show up
  // in the popup's Activity log feed instead of vanishing.
  const earlyLogs = Array.isArray(accumulator.logs) ? accumulator.logs.slice() : [];
  if (invokeError) {
    const isBudgetAbort = invokeError && invokeError.__customBlockerBudgetAbort;
    return {
      ok: false,
      handlers: 0,
      error: "Runtime error during registration: " +
        (invokeError && invokeError.message ? invokeError.message : String(invokeError)),
      logs: [
        ...earlyLogs,
        {
          level: "error",
          groupId,
          args: [
            "[register error] " +
              (invokeError && invokeError.message ? invokeError.message : String(invokeError))
          ]
        }
      ],
      // Registration body itself overran the time budget — that's a
      // hard programming error that warrants disabling the rule rather
      // than silently re-running it on every reload.
      quarantine: isBudgetAbort
        ? { groupId, reason: "registration-deadline-overrun" }
        : null,
      timerRegistryChanged: Boolean(unloadResult.timerRegistryChanged || accumulator.timerRegistryChanged),
      panelRegistryChanged: Boolean(unloadResult.panelRegistryChanged || accumulator.panelRegistryChanged)
    };
  }

  groupSources.set(groupId, trimmed);
  const handlerCount = listHandlers(groupId).length;
  const panelCount = Object.keys(groupPanels.get(groupId) || {}).length;
  const noteLogs = handlerCount === 0 && panelCount === 0
    ? [{
        level: "warn",
        groupId,
        args: [
          "[register] code ran without errors but registered 0 handler(s). " +
            "Check that you're calling events.registerWebChangedEvent (or similar), or creating a panel/timer, inside the function body."
        ]
      }]
    : [{
        level: "log",
        groupId,
        args: ["[register] " + handlerCount + " handler(s), " + panelCount + " panel(s) registered for group " + groupId]
      }];
  return {
    ok: true,
    handlers: handlerCount,
    error: null,
    logs: [...earlyLogs, ...noteLogs],
    timerRegistryChanged: Boolean(unloadResult.timerRegistryChanged || accumulator.timerRegistryChanged),
    panelRegistryChanged: Boolean(unloadResult.panelRegistryChanged || accumulator.panelRegistryChanged)
  };
}

// ────────────────────────────────────────────────────────────────────────
// Timer-ended detection. Called by the host after every dispatch so that
// any timer that just hit zero fires `timerEnded` for its owning group.
// ────────────────────────────────────────────────────────────────────────

function checkTimerEndedTransitions(descriptor) {
  const synthEvents = [];
  for (const [groupId, bucket] of groupTimers.entries()) {
    const previousExpired = previouslyExpiredTimers.get(groupId) || new Set();
    const nowExpired = new Set();
    for (const [timerId, timer] of Object.entries(bucket)) {
      if (timer && timer.currentMs === 0) {
        nowExpired.add(timerId);
        if (!previousExpired.has(timerId)) {
          synthEvents.push({
            type: "timerEnded",
            tabId: descriptor.tabId ?? null,
            pageId: descriptor.pageId ?? null,
            url: descriptor.url ?? "",
            hostname: descriptor.hostname ?? "",
            time: descriptor.time ?? null,
            data: {
              timerId,
              displayName: timer.displayName,
              direction: timer.direction,
              currentMs: timer.currentMs
            },
            targetGroupId: groupId
          });
        }
      }
    }
    previouslyExpiredTimers.set(groupId, nowExpired);
  }
  return synthEvents;
}

// ────────────────────────────────────────────────────────────────────────
// Message protocol
// ────────────────────────────────────────────────────────────────────────

function reply(parentSource, id, result) {
  if (parentSource && typeof parentSource.postMessage === "function") {
    parentSource.postMessage(
      { source: "custom-blocker-event-sandbox", type: "reply", id, result },
      "*"
    );
  }
}

window.addEventListener("message", (msg) => {
  const data = msg.data;
  if (!data || typeof data !== "object") return;
  if (data.source !== "custom-blocker-offscreen") return;
  const id = data.id;
  const payload = data.payload || {};

  if (payload.kind === "init") {
    // The offscreen relay sends us the chrome-extension:// URL prefix
    // right after the iframe reports ready. We stash it so helpers like
    // createMessageUrl() can build a fully-qualified URL even though
    // the sandbox itself has no chrome.runtime access.
    if (typeof payload.extensionUrlPrefix === "string") {
      self.__customBlockerExtensionUrlPrefix = payload.extensionUrlPrefix;
    }
    if (typeof payload.debugMode === "boolean") {
      cbDebugMode = payload.debugMode;
    }
    reply(msg.source, id, { ok: true });
    return;
  }

  if (payload.kind === "set-debug-mode") {
    cbDebugMode = payload.debugMode === true;
    reply(msg.source, id, { ok: true });
    return;
  }

  if (payload.kind === "load-source") {
    const { groupId, source } = payload;
    const out = loadSource(String(groupId), String(source ?? ""));
    reply(msg.source, id, out);
    return;
  }

  if (payload.kind === "check-source") {
    // Compile-only path used by the popup's "Check syntax" button. We
    // run loadSource under a synthetic groupId so it cannot touch any
    // real group's registered handlers, then immediately unload that
    // synthetic group regardless of outcome. The reply mirrors the
    // shape of load-source so the UI can read .ok / .error / .handlers.
    const syntheticGroupId = "__syntax_check__:" + (id || "0");
    let result;
    try {
      result = loadSource(syntheticGroupId, String(payload.source ?? ""));
    } catch (error) {
      result = {
        ok: false,
        handlers: 0,
        error: "Compile failed: " + (error && error.message ? error.message : String(error))
      };
    } finally {
      unloadGroup(syntheticGroupId, { clearState: true });
    }
    reply(msg.source, id, result);
    return;
  }

  if (payload.kind === "unload-group") {
    const result = unloadGroup(String(payload.groupId), {
      clearState: payload.clearState !== false
    });
    reply(msg.source, id, { ok: true, ...result });
    return;
  }

  if (payload.kind === "list-handlers") {
    reply(msg.source, id, { ok: true, handlers: listHandlers(payload.groupId) });
    return;
  }

  if (payload.kind === "evaluate-platform-items") {
    const platform = String(payload.platform || "");
    const slot = String(payload.slot || "");
    const items = Array.isArray(payload.items) ? payload.items : [];
    const results = items.map(() => ({ hide: false, blockPageOnVisit: false }));
    // Each group owns at most ONE predicate per (platform, slot). We OR
    // across groups so independent rules can each contribute their own
    // hide condition; within a single group, the latest call to
    // hideVideos/hideShorts/hidePosts/filterComments/filterLive wins.
    for (const [, bucket] of groupPlatformPredicates.entries()) {
      const entry = bucket && bucket[platform] && bucket[platform][slot];
      if (!entry || typeof entry.predicate !== "function") continue;
      for (let i = 0; i < items.length; i++) {
        let matched = false;
        try { matched = Boolean(entry.predicate(items[i])); } catch { matched = false; }
        if (matched) {
          results[i].hide = true;
          if (entry.blockPageOnVisit) results[i].blockPageOnVisit = true;
        }
      }
    }
    reply(msg.source, id, { ok: true, results });
    return;
  }

  if (payload.kind === "dispatch-event" || payload.kind === "post-event") {
    const descriptor = payload.descriptor || {};
    const dispatchResult = dispatchEvent(descriptor);
    const synthResults = [];

    // Re-dispatch anything the handlers post()-ed. Bounded depth so a
    // pathological rule that posts in response to its own post can't
    // wedge the sandbox.
    const queue = Array.isArray(dispatchResult.posts) ? dispatchResult.posts.slice() : [];
    let depth = 0;
    while (queue.length > 0 && depth < 16) {
      const post = queue.shift();
      const synthDescriptor = {
        type: post.type,
        url: descriptor.url,
        hostname: descriptor.hostname,
        time: descriptor.time,
        tabId: descriptor.tabId,
        pageId: descriptor.pageId,
        data: post.data ?? null,
        targetGroupId: post.scope === "global" ? null : (post.groupId || null)
      };
      const synth = dispatchEvent(synthDescriptor);
      synthResults.push({ descriptor: synthDescriptor, result: synth });
      if (Array.isArray(synth.posts)) {
        for (const next of synth.posts) queue.push(next);
      }
      depth += 1;
    }

    // After all event-driven dispatch finishes, look for timers that
    // just hit zero and fire timerEnded for their owning group.
    const synthTimerEvents = checkTimerEndedTransitions(descriptor);
    for (const synth of synthTimerEvents) {
      synthResults.push({ descriptor: synth, result: dispatchEvent(synth) });
    }

    reply(msg.source, id, { ok: true, ...dispatchResult, synthResults });
    return;
  }

  reply(msg.source, id, { ok: false, error: "unknown payload kind" });
});

// Notify offscreen that we are ready to receive messages.
if (window.parent && window.parent !== window) {
  window.parent.postMessage(
    { source: "custom-blocker-event-sandbox", type: "ready" },
    "*"
  );
}
