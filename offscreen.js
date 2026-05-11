/* Offscreen document — long-lived host for the event sandbox.
 *
 * The custom-rule event registry lives in event-sandbox.html (a sandboxed
 * page, so new Function() works there). This offscreen document keeps
 * that iframe alive across page navigations and tab switches and acts as
 * a relay between background.js and the sandbox iframe.
 */

const sandboxFrame = document.getElementById("eventSandbox");
const pendingReplies = new Map();
let nextRequestId = 1;
let sandboxReady = false;
const queuedToSandbox = [];

// Mirrors the Settings → Debug mode flag. We hydrate it from storage
// on load and forward changes down to the sandbox so trace output
// inside the iframe matches the user's preference without us having
// to round-trip through background.
let cbDebugMode = false;
function pushDebugModeToSandbox() {
  if (!sandboxFrame || !sandboxFrame.contentWindow) return;
  if (!sandboxReady) return;
  try {
    sandboxFrame.contentWindow.postMessage(
      {
        source: "custom-blocker-offscreen",
        id: 0,
        payload: { kind: "set-debug-mode", debugMode: cbDebugMode }
      },
      "*"
    );
  } catch (_) {}
}
try {
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("globalSettings", (r) => {
      const s = r && r.globalSettings;
      if (s && typeof s === "object") cbDebugMode = s.debugMode === true;
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.globalSettings) return;
        const next = changes.globalSettings.newValue;
        cbDebugMode = next && typeof next === "object" ? next.debugMode === true : false;
        pushDebugModeToSandbox();
      });
    }
  }
} catch (_) {}

// Hard kill: any single sandbox request that doesn't reply within this
// budget triggers an iframe reload, which kills the locked event loop
// (the only way to recover from a `while (true)` user handler with no
// helper calls). The cap is generous enough to not interfere with normal
// dispatches that fire many handlers in sequence.
const SANDBOX_REQUEST_HARD_TIMEOUT_MS = 5000;
// Tracks the requestId currently being timed; cleared on every reply.
const requestTimeouts = new Map();
let lastResetAt = 0;

function postToSandbox(message) {
  if (!sandboxFrame || !sandboxFrame.contentWindow) {
    return;
  }
  if (!sandboxReady) {
    queuedToSandbox.push(message);
    return;
  }
  sandboxFrame.contentWindow.postMessage(message, "*");
}

// Tracks the most recent handler the sandbox said it was about to
// invoke. When a hard-timeout fires we cannot ask the locked iframe
// "which handler are you stuck in?", but the sandbox sent us a
// "handler-start" beacon right before calling the handler — so this is
// the best available identifier for the runaway group.
let lastSeenHandler = null; // { groupId, handlerId, eventType, ts }

// Hard-resets the sandbox iframe by reassigning its src. This drops the
// JS event loop currently locked inside the user handler. Any in-flight
// requests are failed with a synthetic timeout reply so the background
// SW (and the popup it's awaiting) unstick instead of hanging forever.
function resetSandboxIframe(reason) {
  if (!sandboxFrame) return;
  const now = Date.now();
  // Debounce: avoid reset storms if many requests time out at once
  // (they all come from the same locked dispatch).
  if (now - lastResetAt < 1000) return;
  lastResetAt = now;
  sandboxReady = false;
  // Drain pending replies with a synthetic timeout result so callers
  // unblock. The result.quarantine hint flows to background which will
  // disable the offending group.
  // Attach the last beaconed groupId so background.js can quarantine
  // the rule that caused the lock instead of guessing. If we never saw
  // a beacon (e.g. the lock happened in a registration body before the
  // first dispatch), groupId is empty and background's safety net
  // falls through to load-source quarantine if applicable.
  const beacon = lastSeenHandler;
  for (const [id, resolver] of pendingReplies.entries()) {
    try {
      resolver({
        ok: false,
        error: "sandbox-timeout",
        quarantine: {
          reason: "hard-timeout",
          source: reason || "unknown",
          groupId: beacon ? beacon.groupId : "",
          handlerId: beacon ? beacon.handlerId : "",
          eventType: beacon ? beacon.eventType : ""
        }
      });
    } catch (_) {}
  }
  lastSeenHandler = null;
  pendingReplies.clear();
  for (const t of requestTimeouts.values()) {
    try { clearTimeout(t); } catch (_) {}
  }
  requestTimeouts.clear();
  // Tell background to eagerly reload all enabled groups' source after
  // the iframe comes back up, so legitimate rules keep working.
  try {
    chrome.runtime.sendMessage({
      type: "event-sandbox-reset",
      reason: reason || "hard-timeout"
    }).catch(() => {});
  } catch (_) {}
  // Reload the iframe by reassigning src. Reading current src first is
  // important because Chrome ignores `src = src` if it's literally the
  // same string in some versions.
  try {
    const baseSrc = sandboxFrame.getAttribute("src") || "event-sandbox.html";
    sandboxFrame.src = "about:blank";
    setTimeout(() => {
      try { sandboxFrame.src = baseSrc; } catch (_) {}
    }, 0);
  } catch (_) {}
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") {
    return;
  }
  if (data.source !== "custom-blocker-event-sandbox") {
    return;
  }

  if (data.type === "handler-start") {
    // Beacon: record which group's handler is about to run. If the
    // sandbox locks during the handler, the hard-timeout path uses
    // this to identify the rule that should be quarantined.
    lastSeenHandler = {
      groupId: typeof data.groupId === "string" ? data.groupId : "",
      handlerId: typeof data.handlerId === "string" ? data.handlerId : "",
      eventType: typeof data.eventType === "string" ? data.eventType : "",
      ts: Date.now()
    };
    return;
  }

  if (data.type === "ready") {
    sandboxReady = true;
    // Pass the chrome-extension:// origin so helpers like createMessageUrl
    // can build fully-qualified URLs (the sandbox has no chrome.runtime).
    // Also send the current debugMode so verbose tracing inside the
    // sandbox is silenced from the very first dispatch when off.
    try {
      sandboxFrame.contentWindow.postMessage(
        {
          source: "custom-blocker-offscreen",
          id: 0,
          payload: {
            kind: "init",
            extensionUrlPrefix: chrome.runtime.getURL(""),
            debugMode: cbDebugMode === true
          }
        },
        "*"
      );
    } catch (_) {}
    while (queuedToSandbox.length > 0) {
      sandboxFrame.contentWindow.postMessage(queuedToSandbox.shift(), "*");
    }
    return;
  }

  if (data.type === "reply" && pendingReplies.has(data.id)) {
    const resolver = pendingReplies.get(data.id);
    pendingReplies.delete(data.id);
    const timeoutHandle = requestTimeouts.get(data.id);
    if (timeoutHandle) {
      try { clearTimeout(timeoutHandle); } catch (_) {}
      requestTimeouts.delete(data.id);
    }
    // The sandbox replied successfully — any earlier handler-start
    // beacon is stale (its handler must have completed normally).
    lastSeenHandler = null;
    resolver(data.result || null);
    return;
  }

  if (data.type === "intents") {
    chrome.runtime.sendMessage({
      type: "event-sandbox-intents",
      payload: data.payload
    }).catch(() => {});
    return;
  }

  if (data.type === "log") {
    chrome.runtime.sendMessage({
      type: "event-sandbox-log",
      payload: data.payload
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }
  if (message.type !== "event-sandbox-request") {
    return false;
  }

  const requestId = nextRequestId++;
  pendingReplies.set(requestId, (result) => sendResponse({ ok: true, result }));
  // Arm the hard kill — if the sandbox doesn't reply within the budget,
  // we assume the iframe's JS loop is locked and force-reset it.
  const timeoutHandle = setTimeout(() => {
    if (!pendingReplies.has(requestId)) return;
    requestTimeouts.delete(requestId);
    const kind = (message.payload && message.payload.kind) || "unknown";
    const groupHint =
      (message.payload && (message.payload.groupId ||
        (message.payload.descriptor && message.payload.descriptor.targetGroupId))) || "";
    resetSandboxIframe("request-timeout:" + kind + (groupHint ? ":" + groupHint : ""));
  }, SANDBOX_REQUEST_HARD_TIMEOUT_MS);
  requestTimeouts.set(requestId, timeoutHandle);
  postToSandbox({
    source: "custom-blocker-offscreen",
    id: requestId,
    payload: message.payload
  });
  return true;
});

// Drive the shared tickEvent from this long-lived document. The SW alarm
// has a 1-minute floor, so we ping background here instead. The interval
// is user-configurable via globalSettings.tickRateMs.
const TICK_RATE_DEFAULT_MS = 1000;
const TICK_RATE_MIN_MS = 250;
const TICK_RATE_MAX_MS = 60_000;
let tickIntervalHandle = null;

function clampTickRate(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return TICK_RATE_DEFAULT_MS;
  return Math.max(TICK_RATE_MIN_MS, Math.min(TICK_RATE_MAX_MS, parsed));
}

function applyTickRate(rateMs) {
  const next = clampTickRate(rateMs);
  if (tickIntervalHandle !== null) {
    clearInterval(tickIntervalHandle);
  }
  tickIntervalHandle = setInterval(() => {
    chrome.runtime.sendMessage({ type: "offscreen-tick" }).catch(() => {});
  }, next);
}

// chrome.storage may be undefined in some offscreen-document contexts;
// feature-guard so a missing API falls back to the default tick rate.
function applyTickRateFromStorage() {
  try {
    if (!chrome?.storage?.local?.get) {
      applyTickRate(TICK_RATE_DEFAULT_MS);
      return;
    }
    chrome.storage.local.get({ globalSettings: null }).then((result) => {
      const settings = result?.globalSettings;
      applyTickRate(settings?.tickRateMs ?? TICK_RATE_DEFAULT_MS);
    }).catch(() => {
      applyTickRate(TICK_RATE_DEFAULT_MS);
    });
  } catch (_) {
    applyTickRate(TICK_RATE_DEFAULT_MS);
  }
}

function subscribeToSettingsChanges() {
  try {
    if (!chrome?.storage?.onChanged?.addListener) return;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes.globalSettings) return;
      const next = changes.globalSettings.newValue;
      applyTickRate(next?.tickRateMs ?? TICK_RATE_DEFAULT_MS);
    });
  } catch (_) {}
}

applyTickRateFromStorage();
subscribeToSettingsChanges();
