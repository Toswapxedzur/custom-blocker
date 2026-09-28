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

// A favicon data URI Mac Vault will keep: an image, and no longer than its
// per-icon cap (ActivityStore.maxWebIconBytes measures the whole data URI).
const CB_ACTIVITY_MAX_ICON_BYTES = 24000;
function cbActivityIconAccepted(dataURI) {
  return typeof dataURI === "string"
    && dataURI.startsWith("data:image/")
    && dataURI.length <= CB_ACTIVITY_MAX_ICON_BYTES;
}

// The pending icons a flush carries: at most `limit` (a flush stays far under
// the hub's 1 MiB message cap), oldest first.
function cbActivityIconsToSend(pending, limit) {
  const out = {};
  const max = typeof limit === "number" && limit > 0 ? limit : 20;
  for (const [domain, uri] of Object.entries(pending || {})) {
    if (Object.keys(out).length >= max) break;
    if (cbActivityIconAccepted(uri)) out[domain] = uri;
  }
  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    cbActivityDomainOf, cbActivityMakeVisit, cbActivityBoundBuffer,
    cbActivityIconAccepted, cbActivityIconsToSend, CB_ACTIVITY_MAX_ICON_BYTES,
  };
}

// ---- service-worker runtime ------------------------------------------------
// Everything below touches chrome.* / the hub and runs only in the extension.

const CB_ACTIVITY_SESSION_KEY = "cbActivitySession";
const CB_ACTIVITY_BUFFER_KEY = "cbActivityBuffer";
// domain → favicon data URI waiting to reach Mac Vault. Kept in storage, not in
// the worker's memory, so an icon survives the worker sleeping while the hub is
// unreachable; removed only once a flush carrying it succeeded.
const CB_ACTIVITY_ICONS_KEY = "cbActivityPendingIcons";
const CB_ACTIVITY_PENDING_ICONS_CAP = 200;
const CB_ACTIVITY_ICONS_PER_FLUSH = 20;
const CB_ACTIVITY_FLUSH_ALARM = "cb-activity-flush";
const CB_ACTIVITY_BUFFER_CAP = 2000;
const CB_ACTIVITY_FLUSH_BATCH = 400; // under ActivityWire.maxRecordsPerFlush (500)
const CB_ACTIVITY_MIN_VISIT_MS = 2000;

const cbActivity = {
  // Cached per-category enabled flags from the native settings.
  enabled: { "web-visit": false, "content-watched": false },
  ready: false,
  // Domains whose icon reached Mac Vault during this worker's life (no need to
  // read it again on every visit).
  sentIconDomains: new Set(),

  async init() {
    if (this.ready || typeof chrome === "undefined" || !chrome.tabs) return;
    this.ready = true;
    await this.refreshSettings();

    chrome.tabs.onActivated.addListener(() => { this.resolveActive("tab-activated"); });
    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      if (changeInfo.url && tab && tab.active) this.resolveActive("tab-url");
      // A page reports its icon only after it starts loading — well after the
      // visit began — so take the icon when the tab says it has one.
      if (changeInfo.favIconUrl && tab && tab.active) this.noteFavicon(tab);
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
    // A covered page is not a visit, like its budget: the time counts nowhere.
    const covered = tab && typeof cbCoveredTabs !== "undefined" && cbCoveredTabs.has(tab.id);
    const domain = tab && !covered ? cbActivityDomainOf(tab.url) : null;
    const session = await this.loadSession();
    if (session && session.domain === domain && session.tabId === (tab && tab.id)) return;
    await this.closeSession("switch");
    if (domain && tab) {
      await chrome.storage.local.set({
        [CB_ACTIVITY_SESSION_KEY]: { domain, tabId: tab.id, startMs: Date.now(), favicon: tab.favIconUrl || null },
      });
    }
  },

  async noteFavicon(tab) {
    if (!this.enabled["web-visit"]) return;
    const domain = cbActivityDomainOf(tab.url);
    if (domain) await this.captureIcon(domain, tab.favIconUrl);
  },

  async loadPendingIcons() {
    try {
      const stored = await chrome.storage.local.get(CB_ACTIVITY_ICONS_KEY);
      return stored[CB_ACTIVITY_ICONS_KEY] || {};
    } catch (_) { return {}; }
  },

  // Best-effort local favicon → data URI (so the native dashboard renders it
  // without any network). An icon Mac Vault would refuse (too big, not an
  // image) is skipped; failure just means no icon.
  async captureIcon(domain, favicon) {
    if (!domain || !favicon || this.sentIconDomains.has(domain)) return;
    const pending = await this.loadPendingIcons();
    if (pending[domain]) return;
    let dataURI = null;
    try {
      if (favicon.startsWith("data:image/")) {
        dataURI = favicon;
      } else {
        const response = await fetch(favicon);
        const blob = await response.blob();
        if (!blob.type.startsWith("image/") || blob.size > CB_ACTIVITY_MAX_ICON_BYTES) return;
        dataURI = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch (_) { return; /* no icon for this domain */ }
    if (!cbActivityIconAccepted(dataURI)) return;
    try {
      const latest = await this.loadPendingIcons();
      latest[domain] = dataURI;
      const domains = Object.keys(latest);
      for (const old of domains.slice(0, Math.max(0, domains.length - CB_ACTIVITY_PENDING_ICONS_CAP))) delete latest[old];
      await chrome.storage.local.set({ [CB_ACTIVITY_ICONS_KEY]: latest });
    } catch (_) { /* best effort */ }
  },

  // The icon the visit's tab shows now (the one noted when the visit started
  // may have been taken before the page had loaded any).
  async currentFavicon(session) {
    try {
      const tab = await chrome.tabs.get(session.tabId);
      return tab && cbActivityDomainOf(tab.url) === session.domain ? tab.favIconUrl || null : null;
    } catch (_) { return null; }
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
      await this.captureIcon(session.domain, session.favicon || await this.currentFavicon(session));
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
    // Pending favicons ride along (local data URIs; the native side keeps one
    // per domain). They leave storage only once this flush succeeded.
    const icons = cbActivityIconsToSend(await this.loadPendingIcons(), CB_ACTIVITY_ICONS_PER_FLUSH);
    try {
      await cbClassifierHub.request("activity-record", { records: batch, icons });
    } catch (_) {
      return; // hub unavailable; keep the buffer and the icons, retry on the next alarm
    }
    if (Object.keys(icons).length) {
      try {
        const latest = await this.loadPendingIcons();
        for (const domain of Object.keys(icons)) {
          delete latest[domain];
          this.sentIconDomains.add(domain);
        }
        await chrome.storage.local.set({ [CB_ACTIVITY_ICONS_KEY]: latest });
      } catch (_) { /* best effort */ }
    }
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
