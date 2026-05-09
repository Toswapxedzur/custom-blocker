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

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") {
    return;
  }
  if (data.source !== "custom-blocker-event-sandbox") {
    return;
  }

  if (data.type === "ready") {
    sandboxReady = true;
    // Hand the sandbox the extension's chrome-extension:// origin so
    // helpers that build links into extension pages (e.g. createMessageUrl)
    // can produce a fully-qualified URL — the sandbox itself runs without
    // chrome.runtime access and can't compute this on its own.
    try {
      sandboxFrame.contentWindow.postMessage(
        {
          source: "custom-blocker-offscreen",
          id: 0,
          payload: { kind: "init", extensionUrlPrefix: chrome.runtime.getURL("") }
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
    resolver(data.result || null);
    return;
  }

  if (data.type === "intents") {
    // Forward any sandbox-originated intents (e.g. from a handler that
    // calls helpers.getDOMHelper().hide(...)) to background, which in
    // turn dispatches them to the right tab(s).
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
  postToSandbox({
    source: "custom-blocker-offscreen",
    id: requestId,
    payload: message.payload
  });
  return true;
});

// Drive the shared tickEvent from this long-lived document. The
// service-worker alarm has a 1-minute floor, so we ping background here
// instead. Background then fans the tick out to every open tab.
//
// The interval is user-configurable via the Settings menu (`tickRateMs`
// in `globalSettings`). When the user changes the rate, we tear down
// the current setInterval and recreate it so the rule's tickEvent
// cadence updates without needing an extension reload.
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

// chrome.storage isn't reliably exposed in every offscreen-document
// instance (we've seen it come up undefined when the document is opened
// via web_accessible_resources rather than chrome.offscreen.createDocument,
// and intermittently during a Chrome update). Feature-guard both reads
// so missing API ⇒ default tick rate, never a thrown TypeError.
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
