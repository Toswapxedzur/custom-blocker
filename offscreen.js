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

// ────────────────────────────────────────────────────────────────────────
// Local folder broker. Popup stores a user-granted directory handle in
// IndexedDB; custom rules enqueue async intents; background asks this
// offscreen window to perform the file operation.
// ────────────────────────────────────────────────────────────────────────
const LOCAL_FOLDER_DB_NAME = "custom-blocker-local-folder";
const LOCAL_FOLDER_DB_VERSION = 1;
const LOCAL_FOLDER_STORE = "handles";
const LOCAL_FOLDER_ROOT_KEY = "root";
const LOCAL_FOLDER_MAX_BYTES = 1024 * 1024;
const LOCAL_FOLDER_EXTENSIONS = new Set([".txt", ".csv", ".json"]);

function openLocalFolderDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_FOLDER_DB_NAME, LOCAL_FOLDER_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_FOLDER_STORE)) db.createObjectStore(LOCAL_FOLDER_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local folder storage."));
  });
}

async function readLocalFolderDbValue(key) {
  const db = await openLocalFolderDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_FOLDER_STORE, "readonly");
    const store = tx.objectStore(LOCAL_FOLDER_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not read local folder storage."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      try { db.close(); } catch (_) {}
      reject(tx.error || new Error("Could not read local folder storage."));
    };
  });
}

function localFolderExtensionOf(path) {
  const match = String(path || "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

function normalizeLocalFolderPath(path, { allowDirectory = false } = {}) {
  const raw = String(path ?? "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  if (!raw && allowDirectory) return { ok: true, path: "", parts: [], ext: "" };
  if (!raw || raw.startsWith("/") || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return { ok: false, error: "invalid-path" };
  }
  const parts = raw.split("/").filter(Boolean);
  if (parts.length === 0) return { ok: false, error: "invalid-path" };
  for (const part of parts) {
    if (part === "." || part === ".." || part.startsWith(".")) return { ok: false, error: "invalid-path" };
    if (!/^[A-Za-z0-9 _.,@()\-]+$/.test(part)) return { ok: false, error: "invalid-path" };
  }
  const normalized = parts.join("/");
  const ext = localFolderExtensionOf(normalized);
  if (!allowDirectory && !LOCAL_FOLDER_EXTENSIONS.has(ext)) {
    return { ok: false, error: "unsupported-file-type" };
  }
  return { ok: true, path: normalized, parts, ext };
}

async function getLocalFolderRootHandle() {
  const handle = await readLocalFolderDbValue(LOCAL_FOLDER_ROOT_KEY);
  if (!handle || handle.kind !== "directory") {
    throw new Error("local-folder-not-connected");
  }
  return handle;
}

async function ensureLocalFolderPermission(handle) {
  if (!handle || typeof handle.queryPermission !== "function") return "granted";
  try {
    const state = await handle.queryPermission({ mode: "readwrite" });
    return state;
  } catch (_) {
    return "denied";
  }
}

async function getDirectoryByParts(root, parts, { create = false } = {}) {
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

async function getFileByPath(root, normalized, { create = false } = {}) {
  const dirParts = normalized.parts.slice(0, -1);
  const fileName = normalized.parts[normalized.parts.length - 1];
  const directory = await getDirectoryByParts(root, dirParts, { create });
  return await directory.getFileHandle(fileName, { create });
}

function byteLengthOf(text) {
  return new TextEncoder().encode(String(text ?? "")).byteLength;
}

function baseLocalFileResponse(request, patch = {}) {
  return {
    ok: patch.ok === true,
    eventName: patch.eventName || request.action || "",
    action: request.action || "",
    path: typeof request.path === "string" ? request.path : "",
    directoryPath: typeof request.directoryPath === "string" ? request.directoryPath : "",
    requestId: typeof request.requestId === "string" ? request.requestId : "",
    ...patch
  };
}

async function handleLocalFileRequest(request) {
  const action = typeof request?.action === "string" ? request.action : "";
  if (action === "status") {
    const root = await getLocalFolderRootHandle();
    const permission = await ensureLocalFolderPermission(root);
    return baseLocalFileResponse(request || {}, {
      ok: permission === "granted",
      eventName: "status",
      hasFolder: true,
      permission,
      error: permission === "granted" ? "" : "local-folder-permission-required"
    });
  }
  const allowDirectory = action === "list";
  const normalized = normalizeLocalFolderPath(
    allowDirectory ? (request.directoryPath || request.path || "") : request.path,
    { allowDirectory }
  );
  if (!normalized.ok) {
    return baseLocalFileResponse(request || {}, { ok: false, eventName: "error", error: normalized.error });
  }
  const root = await getLocalFolderRootHandle();
  const permission = await ensureLocalFolderPermission(root);
  if (permission !== "granted") {
    return baseLocalFileResponse(request || {}, { ok: false, eventName: "error", error: "local-folder-permission-required" });
  }

  if (action === "list") {
    const directory = await getDirectoryByParts(root, normalized.parts, { create: false });
    const entries = [];
    for await (const [name, handle] of directory.entries()) {
      if (!name || name.startsWith(".")) continue;
      const entryPath = normalized.path ? normalized.path + "/" + name : name;
      if (handle.kind === "directory") {
        entries.push({ name, path: entryPath, kind: "directory" });
      } else if (handle.kind === "file" && LOCAL_FOLDER_EXTENSIONS.has(localFolderExtensionOf(name))) {
        entries.push({ name, path: entryPath, kind: "file", extension: localFolderExtensionOf(name) });
      }
    }
    entries.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    return baseLocalFileResponse(request, { ok: true, eventName: "list", directoryPath: normalized.path, entries });
  }

  if (action === "exists") {
    try {
      await getFileByPath(root, normalized, { create: false });
      return baseLocalFileResponse(request, { ok: true, eventName: "exists", exists: true });
    } catch (_) {
      return baseLocalFileResponse(request, { ok: true, eventName: "exists", exists: false });
    }
  }

  if (action === "read" || action === "readJson") {
    const handle = await getFileByPath(root, normalized, { create: false });
    const file = await handle.getFile();
    if (file.size > LOCAL_FOLDER_MAX_BYTES) {
      return baseLocalFileResponse(request, { ok: false, eventName: "error", error: "file-too-large", bytes: file.size });
    }
    const text = await file.text();
    if (action === "readJson") {
      try {
        return baseLocalFileResponse(request, {
          ok: true,
          eventName: "read",
          text,
          value: JSON.parse(text),
          bytes: file.size
        });
      } catch (_) {
        return baseLocalFileResponse(request, { ok: false, eventName: "error", error: "invalid-json", text });
      }
    }
    return baseLocalFileResponse(request, { ok: true, eventName: "read", text, bytes: file.size });
  }

  if (action === "write" || action === "writeJson" || action === "append") {
    let text = "";
    if (action === "writeJson") {
      text = JSON.stringify(request.value, null, 2);
    } else {
      text = String(request.text ?? "");
    }
    if (action === "append") {
      const existingHandle = await getFileByPath(root, normalized, { create: true });
      let existing = "";
      try {
        const existingFile = await existingHandle.getFile();
        if (existingFile.size > LOCAL_FOLDER_MAX_BYTES) {
          return baseLocalFileResponse(request, { ok: false, eventName: "error", error: "file-too-large", bytes: existingFile.size });
        }
        existing = await existingFile.text();
      } catch (_) {}
      text = existing + text;
    }
    const bytes = byteLengthOf(text);
    if (bytes > LOCAL_FOLDER_MAX_BYTES) {
      return baseLocalFileResponse(request, { ok: false, eventName: "error", error: "file-too-large", bytes });
    }
    const handle = await getFileByPath(root, normalized, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return baseLocalFileResponse(request, {
      ok: true,
      eventName: action === "append" ? "append" : "write",
      bytes
    });
  }

  return baseLocalFileResponse(request || {}, { ok: false, eventName: "error", error: "unsupported-action" });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }
  if (message.type === "local-file-request") {
    (async () => {
      try {
        const result = await handleLocalFileRequest(message.request || {});
        sendResponse({ ok: true, result });
      } catch (error) {
        sendResponse({
          ok: true,
          result: baseLocalFileResponse(message.request || {}, {
            ok: false,
            eventName: "error",
            error: String(error?.message || error || "local-file-error")
          })
        });
      }
    })();
    return true;
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
