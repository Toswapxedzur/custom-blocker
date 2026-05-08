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

const handlersByType = new Map(); // type -> Array<{ groupId, id, handler, priority, intervalMs, registeredAt }>
const groupSources = new Map();   // groupId -> source string (last loaded)
const groupTimers = new Map();    // groupId -> { [timerId]: { ... persisted state ... } }
const groupPersistence = new Map(); // groupId -> { ... persisted state ... }
const groupPlatformPredicates = new Map(); // groupId -> { [platform]: { [slot]: [{predicate, blockPageOnVisit}] } }
const previouslyExpiredTimers = new Map(); // groupId -> Set<timerId>

function getGroupTimers(groupId) {
  if (!groupTimers.has(groupId)) {
    groupTimers.set(groupId, {});
  }
  return groupTimers.get(groupId);
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

function registerHandler(groupId, type, id, handler, options) {
  if (typeof type !== "string" || !type) return false;
  if (typeof id !== "string" || !id) return false;
  if (typeof handler !== "function") return false;
  const list = getHandlersForType(type);
  const idx = list.findIndex((entry) => entry.groupId === groupId && entry.id === id);
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
  return next.length !== before;
}

function unregisterAllForType(groupId, type) {
  const list = handlersByType.get(type);
  if (!list) return 0;
  const before = list.length;
  const next = list.filter((entry) => entry.groupId !== groupId);
  handlersByType.set(type, next);
  return before - next.length;
}

function unloadGroup(groupId) {
  for (const [type, list] of handlersByType.entries()) {
    handlersByType.set(type, list.filter((entry) => entry.groupId !== groupId));
  }
  groupSources.delete(groupId);
  groupHelpersCache.delete(groupId);
  groupPlatformPredicates.delete(groupId);
  previouslyExpiredTimers.delete(groupId);
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

// ────────────────────────────────────────────────────────────────────────
// Per-group Events registry. Each registration is silently tagged with
// the owning groupId so that "Run" or "delete group" can flush only that
// group's handlers, even though all groups share the same dispatcher.
// ────────────────────────────────────────────────────────────────────────

const RESERVED_EVENT_PREFIX = "_";
const BUILTIN_EVENT_TYPES = [
  "tickEvent",
  "openWebEvent",
  "closeWebEvent",
  "switchWebEvent",
  "switchDomainEvent",
  // webChangedEvent fires on EVERY navigation, including reloads that land
  // on the same URL — switchWebEvent only fires when the URL actually
  // changes, which makes it unreliable as a "page just (re)loaded" hook.
  // Use webChangedEvent when you need to re-evaluate something on every
  // page transition (open / switch / reload / SPA history update).
  "webChangedEvent",
  "timerEnded"
];

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
  // Also expose explicit alias counters that stay close to the user's
  // requested naming style.
  api.countTickRegistered = typedCount("tickEvent");
  api.countOpenWebRegistered = typedCount("openWebEvent");
  api.countCloseWebRegistered = typedCount("closeWebEvent");
  api.countSwitchWebRegistered = typedCount("switchWebEvent");
  api.countSwitchDomainRegistered = typedCount("switchDomainEvent");
  api.countWebChangedRegistered = typedCount("webChangedEvent");
  api.countTimerEndedRegistered = typedCount("timerEnded");
  // timerEnded uses a non-Event suffix in its wire type name, but user
  // code/docs call the registration helpers with the Event suffix.
  api.registerTimerEndedEvent = typedRegister("timerEnded");
  api.getTimerEndedEvent = typedGet("timerEnded");
  api.getTimerEndedEvents = typedGetAll("timerEnded");
  api.countTimerEndedEventRegistered = typedCount("timerEnded");

  return api;
}

// ────────────────────────────────────────────────────────────────────────
// Per-group helpers for the source's outermost call. When a handler runs
// later, we build a fresh helpers object scoped to that handler's group
// and the current event's tab/url. The persistent buckets (timers,
// persistence) live in this sandbox forever (until unload).
// ────────────────────────────────────────────────────────────────────────

// Single per-group helpers object, lazily built. Helpers internally
// look up their accumulator/dispatch context through a thunk that we
// swap before every handler invocation; this is what makes a `helpers`
// object stashed at registration time keep working in every later
// dispatch.
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

function makeAccumulator() {
  return {
    intents: [],
    logs: [],
    redirectUrl: null,
    domOps: []
  };
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
      // Per-handler tick interval. Track last-fired-at on the entry.
      const now = descriptor.time?.now ?? Date.now();
      if (!entry._lastFiredAt) entry._lastFiredAt = 0;
      if (now - entry._lastFiredAt < entry.intervalMs) {
        return false;
      }
      entry._lastFiredAt = now;
    }
    return true;
  });

  let lastResult = null;
  let anyPreventDefault = false;
  let anyStopPropagation = false;
  let lastSetResultEvent = null;

  for (const entry of filtered) {
    const helpers = getOrCreateGroupHelpers(entry.groupId);
    const evt = buildEventObject(descriptor, entry.groupId, accumulator);
    const dispatchContext = {
      tabId: descriptor.tabId ?? null,
      pageId: descriptor.pageId ?? null,
      currentUrl: descriptor.url,
      now: descriptor.time?.now ?? Date.now(),
      tabsSnapshot: descriptor.tabsSnapshot,
      platformSnapshot: descriptor.platformSnapshot
    };
    withDispatchContext(accumulator, dispatchContext, () => {
      try {
        entry.handler(evt, helpers);
      } catch (error) {
        accumulator.logs.push({
          level: "error",
          groupId: entry.groupId,
          args: ["[handler error]", entry.id, String(error && error.message ? error.message : error)]
        });
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

  // Numeric 1 (allow) overrides preventDefault per the spec.
  if (typeof lastResult === "number" && lastResult === 1) {
    anyPreventDefault = false;
  }

  return {
    defaultPrevented: anyPreventDefault,
    propagationStopped: anyStopPropagation,
    result: lastResult,
    redirectUrl: accumulator.redirectUrl ?? "",
    intents: accumulator.intents,
    domOps: accumulator.domOps,
    logs: accumulator.logs,
    posts: accumulator.posts || []
  };
}

// ────────────────────────────────────────────────────────────────────────
// Source loading
// ────────────────────────────────────────────────────────────────────────

function loadSource(groupId, source) {
  // Always wipe previous registrations for this group first.
  unloadGroup(groupId);
  const trimmed = String(source ?? "").trim();
  if (!trimmed) return { ok: true, handlers: 0, error: null };

  // Two source styles are supported:
  //   (event, helpers) => { ... }     ← function expression
  //   function (event, helpers) { ... }
  //   <bare statements>                ← treated as a function body
  // We try the function-expression form first by wrapping in parens; if
  // that compiles to a function we call it. Otherwise we fall back to
  // treating the source as a function body.
  let invoke;
  try {
    const candidate = new Function("return (" + trimmed + ");")();
    if (typeof candidate === "function") {
      invoke = (events, helpers) => candidate(events, helpers);
    }
  } catch (_) {}

  if (!invoke) {
    try {
      const fn = new Function("event", "helpers", trimmed);
      invoke = (events, helpers) => fn(events, helpers);
    } catch (error) {
      return {
        ok: false,
        handlers: 0,
        error: "Compile failed: " + (error && error.message ? error.message : String(error))
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
    try {
      invoke(events, helpers);
    } catch (error) {
      invokeError = error;
    }
  });
  if (invokeError) {
    return {
      ok: false,
      handlers: 0,
      error: "Runtime error during registration: " +
        (invokeError && invokeError.message ? invokeError.message : String(invokeError))
    };
  }

  groupSources.set(groupId, trimmed);
  const handlerCount = listHandlers(groupId).length;
  return { ok: true, handlers: handlerCount, error: null };
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

  if (payload.kind === "load-source") {
    const { groupId, source } = payload;
    const out = loadSource(String(groupId), String(source ?? ""));
    reply(msg.source, id, out);
    return;
  }

  if (payload.kind === "unload-group") {
    unloadGroup(String(payload.groupId));
    reply(msg.source, id, { ok: true });
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
