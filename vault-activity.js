// Activity log — browser feeders (see macosBlocker/docs/ACTIVITY-LOG.md).
//
// Records two of the three lenses from the browser: `web-visit` (time on the
// active, focused tab, domain-level) measured here in the service worker from
// tab/window events, and `content-watched` (a video actually watched on a
// supported platform) measured in the page by vault-activity-content.js and
// posted here. Records buffer in chrome.storage (so they survive the MV3 worker
// sleeping) and flush to the native app over the hub `activity-record` op; each
// record carries a uuid so a replay after reconnect is idempotent. Recording is
// gated on the per-category enabled flags fetched from the native settings via
// `activity-settings` — a disabled category is never captured, and the native
// store is the backstop.
//
// This file is loaded into the service worker with importScripts(); its pure
// helpers are also exported for the node test runner.

"use strict";

// ---- pure helpers (unit tested) -------------------------------------------

function cbActivityDomainOf(url) {
  if (typeof url !== "string") return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname;
  if (!host) return null;
  return host.replace(/^www\./, "");
}

// Turns an open session into a web-visit record, or null when it is too short or
// carries no domain. `nowMs` is the close time; dwell is close - start.
function cbActivityMakeVisit(session, nowMs, options) {
  const opts = options || {};
  const minMs = typeof opts.minMs === "number" ? opts.minMs : 2000;
  const makeId = opts.makeId || (() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  if (!session || !session.domain || typeof session.startMs !== "number") return null;
  const dwell = nowMs - session.startMs;
  if (!(dwell >= minMs)) return null;
  return {
    id: makeId(),
    category: "web-visit",
    startedAtMs: session.startMs,
    seconds: dwell / 1000,
    key: session.domain,
    label: session.domain,
  };
}

function cbActivityBoundBuffer(buffer, cap) {
  const list = Array.isArray(buffer) ? buffer : [];
  const max = typeof cap === "number" && cap > 0 ? cap : 2000;
  return list.length > max ? list.slice(list.length - max) : list;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { cbActivityDomainOf, cbActivityMakeVisit, cbActivityBoundBuffer };
}

// ---- service-worker runtime ------------------------------------------------
// Everything below touches chrome.* / the hub and runs only in the extension.

const CB_ACTIVITY_SESSION_KEY = "cbActivitySession";
const CB_ACTIVITY_BUFFER_KEY = "cbActivityBuffer";
const CB_ACTIVITY_FLUSH_ALARM = "cb-activity-flush";
const CB_ACTIVITY_BUFFER_CAP = 2000;
const CB_ACTIVITY_FLUSH_BATCH = 400; // under ActivityWire.maxRecordsPerFlush (500)
const CB_ACTIVITY_MIN_VISIT_MS = 2000;

const cbActivity = {
  // Cached per-category enabled flags from the native settings.
  enabled: { "web-visit": false, "content-watched": false },
  ready: false,
  // domain → favicon data URI, gathered from tabs and flushed with the records
  // (kept local: converted to a data URI here so the dashboard never fetches).
  pendingIcons: {},

  async init() {
    if (this.ready || typeof chrome === "undefined" || !chrome.tabs) return;
    this.ready = true;
    await this.refreshSettings();

    chrome.tabs.onActivated.addListener(() => { this.resolveActive("tab-activated"); });
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      if (changeInfo.url && tab && tab.active) this.resolveActive("tab-url");
    });
    chrome.tabs.onRemoved.addListener((tabId) => { this.onTabGone(tabId); });
    if (chrome.windows && chrome.windows.onFocusChanged) {
      chrome.windows.onFocusChanged.addListener((windowId) => {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
          this.closeSession("window-blur");
        } else {
          this.resolveActive("window-focus");
        }
      });
    }
    chrome.alarms.create(CB_ACTIVITY_FLUSH_ALARM, { periodInMinutes: 1 });

    this.resolveActive("init");
  },

  async refreshSettings() {
    try {
      const reply = await cbClassifierHub.request("activity-settings", {});
      const byCategory = reply && reply.settings && reply.settings.byCategory;
      if (byCategory) {
        const next = {
          "web-visit": !!(byCategory["web-visit"] && byCategory["web-visit"].enabled),
          "content-watched": !!(byCategory["content-watched"] && byCategory["content-watched"].enabled),
        };
        const webWasOn = this.enabled["web-visit"];
        this.enabled = next;
        if (webWasOn && !next["web-visit"]) await this.closeSession("web-visit-disabled");
      }
    } catch (_) {
      // Hub not ready; keep the last known flags (default off) and try later.
    }
  },

  async resolveActive(_reason) {
    if (!this.enabled["web-visit"]) { await this.closeSession("disabled"); return; }
    let tab;
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      tab = tabs && tabs[0];
    } catch (_) { return; }
    const domain = tab ? cbActivityDomainOf(tab.url) : null;
    const session = await this.loadSession();
    if (session && session.domain === domain && session.tabId === (tab && tab.id)) return;
    await this.closeSession("switch");
    if (domain && tab) {
      await chrome.storage.local.set({
        [CB_ACTIVITY_SESSION_KEY]: { domain, tabId: tab.id, startMs: Date.now(), favicon: tab.favIconUrl || null },
      });
    }
  },

  // Best-effort local favicon → data URI (so the native dashboard renders it
  // without any network). Skips oversized icons; failure just means no icon.
  async captureIcon(domain, favicon) {
    if (!domain || !favicon || this.pendingIcons[domain]) return;
    try {
      if (favicon.startsWith("data:image/")) { this.pendingIcons[domain] = favicon; return; }
      const response = await fetch(favicon);
      const blob = await response.blob();
      if (!blob.type.startsWith("image/") || blob.size > 24000) return;
      const dataURI = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (dataURI && dataURI.startsWith("data:image/")) this.pendingIcons[domain] = dataURI;
    } catch (_) { /* no icon for this domain */ }
  },

  async onTabGone(tabId) {
    const session = await this.loadSession();
    if (session && session.tabId === tabId) await this.closeSession("tab-removed");
  },

  async loadSession() {
    try {
      const stored = await chrome.storage.local.get(CB_ACTIVITY_SESSION_KEY);
      return stored[CB_ACTIVITY_SESSION_KEY] || null;
    } catch (_) { return null; }
  },

  async closeSession(_reason) {
    const session = await this.loadSession();
    if (!session) return;
    await chrome.storage.local.remove(CB_ACTIVITY_SESSION_KEY);
    if (!this.enabled["web-visit"]) return;
    const record = cbActivityMakeVisit(session, Date.now(), {
      minMs: CB_ACTIVITY_MIN_VISIT_MS,
      makeId: () => crypto.randomUUID(),
    });
    if (record) {
      await this.captureIcon(session.domain, session.favicon);
      await this.enqueue(record);
    }
  },

  // Called by vault-activity-content.js for a watched video on a supported
  // platform. Gated on the content-watched flag; the native store is the backstop.
  async recordWatched(record) {
    if (!this.enabled["content-watched"]) return;
    if (!record || typeof record !== "object") return;
    const seconds = Number(record.seconds);
    if (!(seconds > 0) || typeof record.key !== "string" || !record.key) return;
    await this.enqueue({
      id: crypto.randomUUID(),
      category: "content-watched",
      startedAtMs: Number(record.startedAtMs) || Date.now(),
      seconds,
      key: record.key,
      label: typeof record.label === "string" ? record.label : record.key,
      platform: typeof record.platform === "string" ? record.platform : undefined,
      creator: typeof record.creator === "string" ? record.creator : undefined,
    });
  },

  async enqueue(record) {
    try {
      const stored = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
      const buffer = cbActivityBoundBuffer((stored[CB_ACTIVITY_BUFFER_KEY] || []).concat([record]), CB_ACTIVITY_BUFFER_CAP);
      await chrome.storage.local.set({ [CB_ACTIVITY_BUFFER_KEY]: buffer });
    } catch (_) { return; }
    this.flush();
  },

  async flush() {
    let buffer;
    try {
      const stored = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
      buffer = stored[CB_ACTIVITY_BUFFER_KEY] || [];
    } catch (_) { return; }
    if (!buffer.length) return;
    const batch = buffer.slice(0, CB_ACTIVITY_FLUSH_BATCH);
    // Include favicons for the domains in this batch (local data URIs; the
    // native side dedupes them into a per-domain cache).
    const icons = {};
    for (const record of batch) {
      if (record.category === "web-visit" && this.pendingIcons[record.key]) icons[record.key] = this.pendingIcons[record.key];
    }
    try {
      await cbClassifierHub.request("activity-record", { records: batch, icons });
    } catch (_) {
      return; // hub unavailable; keep the buffer and retry on the next alarm
    }
    for (const domain of Object.keys(icons)) delete this.pendingIcons[domain];
    // Drop exactly the flushed records (identified by id); a concurrent enqueue
    // is preserved.
    try {
      const stored = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
      const flushed = new Set(batch.map((r) => r.id));
      const remaining = (stored[CB_ACTIVITY_BUFFER_KEY] || []).filter((r) => !flushed.has(r.id));
      await chrome.storage.local.set({ [CB_ACTIVITY_BUFFER_KEY]: remaining });
      if (remaining.length) this.flush();
    } catch (_) { /* best effort */ }
  },

  onAlarm(alarm) {
    if (!alarm || alarm.name !== CB_ACTIVITY_FLUSH_ALARM) return;
    this.refreshSettings().finally(() => this.flush());
  },
};
