// Activity log — browser feeders (see macosBlocker/docs/ACTIVITY-LOG.md).
//
// Records two of the three lenses from the browser: `web-visit` (time on the
// active, focused tab, domain-level) measured here in the service worker from
// tab/window events, and `content-watched` (a video actually watched on a
// supported platform) measured in the page by vault-activity-content.js and
// posted here. Records buffer in chrome.storage (so they survive the MV3 worker
// sleeping) and flush to the native app over the hub `activity-record` op; each
// record carries a uuid so a replay after reconnect is idempotent. Recording is
// gated on fresh supported native settings snapshots, including an initial
// `activity-settings` GET. Disconnect pauses capture; authorization and observed
// end metadata let the native store save eligible pre-OFF intervals only.
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
    && new TextEncoder().encode(dataURI).length <= CB_ACTIVITY_MAX_ICON_BYTES;
}

// Candidate pending icons; the request packer applies the smaller native
// classifier-body byte cap after selecting records.
function cbActivityIconsToSend(pending, limit) {
  const out = {};
  const max = typeof limit === "number" && limit > 0 ? limit : 20;
  for (const [domain, uri] of Object.entries(pending || {})) {
    if (Object.keys(out).length >= max) break;
    if (cbActivityIconAccepted(uri)) out[domain] = uri;
  }
  return out;
}

// The desktop hub reserializes the body with Foundation's default slash
// escaping. Count exact UTF-8 JSON bytes and bound numeric spelling differences
// (Foundation can retain a decimal suffix/exponent zero) without raising its cap.
const CB_ACTIVITY_MAX_BODY_BYTES = 88000;
const CB_ACTIVITY_FLUSH_BATCH = 400;
const CB_ACTIVITY_ICONS_PER_FLUSH = 20;
function cbActivityBodyBytes(body) { return new TextEncoder().encode(JSON.stringify(body)).length; }
function cbActivityNativeBodyBudget(value) {
  const json = JSON.stringify(value).replace(/\//g, "\\/");
  const numericCount = item => typeof item === "number" ? 1 : item && typeof item === "object"
    ? Object.values(item).reduce((sum, child) => sum + numericCount(child), 0) : 0;
  return new TextEncoder().encode(json).length + numericCount(value) * 3;
}
function cbActivityPackBody(records, pendingIcons) {
  const body = { records: [], icons: {} }, rejectedIDs = [];
  let bytes = cbActivityNativeBodyBudget(body);
  for (const record of records) {
    if (!cbActivityBrowserRecordShape(record)) {
      if (typeof record?.id === "string") rejectedIDs.push(record.id);continue;
    }
    let cost;
    try { cost = cbActivityNativeBodyBudget(record); } catch (_) { rejectedIDs.push(record.id); continue; }
    if (cost + cbActivityNativeBodyBudget({ records: [], icons: {} }) >= CB_ACTIVITY_MAX_BODY_BYTES) {
      rejectedIDs.push(record.id);continue;
    }
    if (body.records.length >= CB_ACTIVITY_FLUSH_BATCH || bytes + cost + (body.records.length ? 1 : 0) >= CB_ACTIVITY_MAX_BODY_BYTES) continue;
    bytes += cost + (body.records.length ? 1 : 0);body.records.push(record);
  }
  for (const [domain, uri] of Object.entries(cbActivityIconsToSend(pendingIcons, CB_ACTIVITY_ICONS_PER_FLUSH))) {
    const cost = cbActivityNativeBodyBudget({ [domain]: uri }) - 2 + (Object.keys(body.icons).length ? 1 : 0);
    if (bytes + cost >= CB_ACTIVITY_MAX_BODY_BYTES) continue;
    bytes += cost;body.icons[domain] = uri;
  }
  return { body, rejectedIDs, wireBytes: cbActivityBodyBytes(body), nativeBudgetBytes: bytes };
}

// Both normal GET replies and native notifications use the same strict flags.
// A malformed value must never become consent through truthiness coercion.
function cbActivitySettingsFlags(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const categories = settings.byCategory;
  if (!categories || typeof categories !== "object" || Array.isArray(categories)) return null;
  const flags = {};
  for (const key of ["web-visit", "content-watched"]) {
    const category = categories[key];
    if (!category || typeof category !== "object" || Array.isArray(category)
      || typeof category.enabled !== "boolean") return null;
    flags[key] = category.enabled;
  }
  return flags;
}

// Metadata belongs to a native store lifetime, not a persisted schema revision.
function cbActivityNativeSnapshot(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)
    || typeof body.epoch !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.epoch)
    || !Number.isSafeInteger(body.revision) || body.revision < 0
    || !Number.isFinite(body.changedAtMs) || body.changedAtMs < 0) return null;
  const flags = cbActivitySettingsFlags(body.settings);
  if (!flags) return null;
  return { epoch: body.epoch.toLowerCase(), revision: body.revision, changedAtMs: body.changedAtMs, flags };
}

// Persisted buffers can outlive the worker's in-memory grant cache. Native
// authority still validates their old revisions; malformed bytes cannot send.
function cbActivityBrowserRecordShape(record) {
  const auth = record?.authorization;
  return !!record && typeof record.id === "string" && !!record.id && record.id.length <= 128
    && ["web-visit", "content-watched"].includes(record.category)
    && typeof record.key === "string" && !!record.key
    && typeof auth?.epoch === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(auth.epoch)
    && Number.isSafeInteger(auth.revision) && auth.revision >= 0
    && Number.isFinite(record.startedAtMs) && record.startedAtMs >= 0
    && Number.isFinite(record.observedEndedAtMs) && record.observedEndedAtMs > record.startedAtMs
    && Number.isFinite(record.seconds) && record.seconds > 0
    && Math.abs(record.observedEndedAtMs - record.startedAtMs - record.seconds * 1000) <= 1;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    cbActivityDomainOf, cbActivityMakeVisit, cbActivityBoundBuffer, cbActivitySettingsFlags, cbActivityNativeSnapshot, cbActivityBrowserRecordShape,
    cbActivityIconAccepted, cbActivityIconsToSend, cbActivityBodyBytes, cbActivityNativeBodyBudget, cbActivityPackBody, CB_ACTIVITY_MAX_BODY_BYTES, CB_ACTIVITY_MAX_ICON_BYTES,
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
const CB_ACTIVITY_FLUSH_ALARM = "cb-activity-flush";
const CB_ACTIVITY_BUFFER_CAP = 2000;
const CB_ACTIVITY_MIN_VISIT_MS = 2000;

const cbActivity = {
  // Cached per-category enabled flags from the native settings.
  enabled: { "web-visit": false, "content-watched": false },
  ready: false,
  settingsGeneration: 0,
  settingsRequestEpoch: 0,
  settingsConnectionGeneration: 0,
  settingsEpoch: null,
  settingsRevision: -1,
  settingsChangedAtMs: null,
  capturePaused: true,
  contentToken: crypto.randomUUID(),
  captureAuthorization: null,
  contentCutoff: null,
  bufferEpoch: null,
  knownGrants: new Map(),
  sessionTail: Promise.resolve(),
  bufferTail: Promise.resolve(),
  flushInFlight: null,
  visitEpisode: null,
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
    if (typeof cbConnection === "undefined" || cbConnection.activitySettingsNotifications !== true) return;
    const generation = this.settingsGeneration;
    const requestEpoch = ++this.settingsRequestEpoch;
    const connectionGeneration = this.settingsConnectionGeneration;
    try {
      const reply = await cbClassifierHub.request("activity-settings", {});
      // A later accepted snapshot (including a push) or GET invalidates this
      // response. These counters are memory-only, not stored schema revisions.
      if (generation !== this.settingsGeneration || requestEpoch !== this.settingsRequestEpoch
        || connectionGeneration !== this.settingsConnectionGeneration) return;
      await this.applyNativeSettingsSnapshot(reply, connectionGeneration);
    } catch (_) {
      // Hub not ready; keep the last known flags (default off).
    }
  },

  beginSettingsConnection(generation) {
    this.settingsConnectionGeneration = generation;
    this.settingsGeneration += 1;
    this.settingsRequestEpoch += 1;
    this.settingsEpoch = null;
    this.settingsRevision = -1;
    this.settingsChangedAtMs = null;
    // Publish after invalidating the old connection. tabs.query completes
    // asynchronously and must see the final generation of this paused state.
    this.pauseCapture(Date.now(), "native-disconnect");
  },

  async applyNativeSettingsSnapshot(body, connectionGeneration) {
    if (connectionGeneration !== this.settingsConnectionGeneration) return false;
    const snapshot = cbActivityNativeSnapshot(body);
    if (!snapshot || (this.settingsEpoch !== null && this.settingsEpoch !== snapshot.epoch)) {
      this.pauseCapture(Date.now(), "invalid-native-settings");
      return false;
    }
    if (snapshot.revision < this.settingsRevision) return false;
    if (snapshot.revision === this.settingsRevision) {
      const previous = this.knownGrants.get(snapshot.revision);
      if (snapshot.changedAtMs !== this.settingsChangedAtMs
        || !previous || !Object.keys(snapshot.flags).every(key => snapshot.flags[key] === previous.flags[key])) {
        this.pauseCapture(Date.now(), "conflicting-native-settings");
        return false;
      }
      if (!this.capturePaused) return true;
    }
    const observedAtMs = Date.now(), wasPaused = this.capturePaused;
    const webContinues = !wasPaused && this.enabled["web-visit"] && snapshot.flags["web-visit"]
      && this.bufferEpoch === snapshot.epoch;
    if (this.bufferEpoch !== null && this.bufferEpoch !== snapshot.epoch) {
      this.knownGrants.clear();this.contentCutoff = null;
    }
    if (!snapshot.flags["content-watched"] && (this.enabled["content-watched"] || this.contentCutoff === null)) {
      this.contentCutoff = { epoch: snapshot.epoch, revision: snapshot.revision, changedAtMs: snapshot.changedAtMs };
    }
    this.bufferEpoch = snapshot.epoch;
    for (const grant of this.knownGrants.values()) {
      for (const key of ["web-visit", "content-watched"]) {
        if (!snapshot.flags[key] && grant.flags[key] && grant.cutoffs[key] === null) grant.cutoffs[key] = snapshot.changedAtMs;
      }
    }
    this.knownGrants.set(snapshot.revision, { ...snapshot, cutoffs: { "web-visit": null, "content-watched": null } });
    while (this.knownGrants.size > 256) this.knownGrants.delete(this.knownGrants.keys().next().value);
    this.settingsEpoch = snapshot.epoch;
    this.settingsRevision = snapshot.revision;
    this.settingsChangedAtMs = snapshot.changedAtMs;
    this.captureAuthorization = { epoch: snapshot.epoch, revision: snapshot.revision, changedAtMs: snapshot.changedAtMs };
    this.capturePaused = false;
    this.settingsGeneration += 1;
    this.enabled = snapshot.flags;
    const generation = this.settingsGeneration;
    // Notify pages immediately; storage and favicon work must not delay OFF.
    this.broadcastSettings(snapshot, snapshot.changedAtMs);
    await this._sessionOperation(async () => {
      if (generation !== this.settingsGeneration) return;
      const session = await this.loadSession();
      const cutoff = Math.min(observedAtMs, snapshot.changedAtMs);
      await this._closeSessionUnlocked(snapshot.flags["web-visit"] ? "native-settings-cutoff" : "native-settings-off", cutoff, observedAtMs);
      if (webContinues && session && generation === this.settingsGeneration && !this.capturePaused) {
        // This is the tail of the same already-observed focused episode, not
        // time synthesized across a disabled/disconnected gap.
        await chrome.storage.local.set({ [CB_ACTIVITY_SESSION_KEY]: { ...session,
          startMs: Math.max(session.startMs, snapshot.changedAtMs),
          authorization: { epoch: snapshot.epoch, revision: snapshot.revision } } });
      }
    });
    await this._bufferOperation(async () => {
      if (generation !== this.settingsGeneration || snapshot.epoch !== this.bufferEpoch) return;
      const stored = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
      const records = Array.isArray(stored[CB_ACTIVITY_BUFFER_KEY]) ? stored[CB_ACTIVITY_BUFFER_KEY] : [];
      const retained = records.filter(record => record?.authorization?.epoch?.toLowerCase() === snapshot.epoch);
      if (retained.length !== records.length) await chrome.storage.local.set({ [CB_ACTIVITY_BUFFER_KEY]: retained });
    });
    if (generation === this.settingsGeneration && !this.capturePaused) await this.resolveActive("native-settings-enabled");
    if (generation === this.settingsGeneration && connectionGeneration === this.settingsConnectionGeneration) {
      void this.flush();
    }
    return true;
  },

  contentSettings(cutoffMs = Date.now()) {
    return { token: this.contentToken, generation: this.settingsGeneration, paused: this.capturePaused,
      flags: { ...this.enabled }, authority: this.captureAuthorization, contentCutoff: this.contentCutoff, cutoffMs };
  },

  broadcastSettings(_snapshot, cutoffMs = Date.now()) {
    if (!chrome.tabs || typeof chrome.tabs.query !== "function") return;
    const config = this.contentSettings(cutoffMs), generation = this.settingsGeneration;
    chrome.tabs.query({}, tabs => {
      if (chrome.runtime.lastError || generation !== this.settingsGeneration) return;
      for (const tab of tabs || []) {
        if (!Number.isInteger(tab?.id) || !/^https?:/i.test(tab.url || tab.pendingUrl || "")) continue;
        try { chrome.tabs.sendMessage(tab.id, { kind: "vault-activity-settings-updated", config }, () => { void chrome.runtime.lastError; }); }
        catch (_) { /* a page without the supported receiver has no watch accumulator */ }
      }
    });
  },

  pauseCapture(cutoffMs, reason) {
    this.capturePaused = true;
    this.enabled = { "web-visit": false, "content-watched": false };
    this.settingsGeneration += 1;
    this.broadcastSettings(null, cutoffMs);
    void this.closeSession(reason, cutoffMs).catch(error => console.error("[CustomBlocker] Activity pause close failed", error));
  },

  _sessionOperation(operation) {
    const next = this.sessionTail.catch(() => {}).then(operation);
    this.sessionTail = next;
    return next;
  },

  _bufferOperation(operation) {
    const next = this.bufferTail.catch(() => {}).then(operation);
    this.bufferTail = next;
    return next;
  },

  authorizedRecord(record) {
    if (!cbActivityBrowserRecordShape(record)) return null;
    const auth = record.authorization;
    if (auth.epoch.toLowerCase() !== this.bufferEpoch) return null;
    const grant = this.knownGrants.get(auth.revision), category = record.category;
    if (!grant?.flags[category] || record.startedAtMs < grant.changedAtMs - 1) return null;
    const start = Math.max(record.startedAtMs, grant.changedAtMs);
    const end = Math.min(record.observedEndedAtMs, grant.cutoffs[category] ?? Infinity, Date.now());
    if (!(end > start)) return null;
    return { ...record, startedAtMs: start, observedEndedAtMs: end, seconds: (end - start) / 1000,
      authorization: { epoch: this.bufferEpoch, revision: auth.revision } };
  },


  async resolveActive(_reason) {
    return this._sessionOperation(async () => {
      const generation = this.settingsGeneration;
      if (!this.enabled["web-visit"]) { await this._closeSessionUnlocked("disabled"); return; }
      let tab;
      try {
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        tab = tabs && tabs[0];
        // lastFocusedWindow can still be the browser while another app is in
        // front. A settings refresh must not start a background visit.
        if (tab && chrome.windows && chrome.windows.get) {
          const window = await chrome.windows.get(tab.windowId);
          if (!window.focused) { await this._closeSessionUnlocked("window-unfocused"); return; }
        }
      } catch (_) { return; }
      // A covered page is not a visit, like its budget: the time counts nowhere.
      const covered = tab && typeof cbCoveredTabs !== "undefined" && cbCoveredTabs.has(tab.id);
      const domain = tab && !covered ? cbActivityDomainOf(tab.url) : null;
      const session = await this.loadSession();
      if (session && session.domain === domain && session.tabId === (tab && tab.id)
        && session.authorization?.epoch === this.captureAuthorization?.epoch
        && session.authorization?.revision === this.captureAuthorization?.revision) return;
      await this._closeSessionUnlocked("switch");
      if (domain && tab && this.enabled["web-visit"] && generation === this.settingsGeneration) {
        if (!this.visitEpisode || this.visitEpisode.domain !== domain || this.visitEpisode.tabId !== tab.id) this.visitEpisode = { domain, tabId: tab.id, eligible: false };
        await chrome.storage.local.set({
          [CB_ACTIVITY_SESSION_KEY]: { domain, tabId: tab.id, startMs: Math.max(Date.now(), this.captureAuthorization.changedAtMs), favicon: tab.favIconUrl || null, authorization: { epoch: this.captureAuthorization.epoch, revision: this.captureAuthorization.revision } },
        });
      }
    });
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
    return this._sessionOperation(async () => {
      const session = await this.loadSession();
      if (session && session.tabId === tabId) await this._closeSessionUnlocked("tab-removed");
    });
  },

  async loadSession() {
    try {
      const stored = await chrome.storage.local.get(CB_ACTIVITY_SESSION_KEY);
      return stored[CB_ACTIVITY_SESSION_KEY] || null;
    } catch (_) { return null; }
  },

  closeSession(reason, cutoffMs = Date.now(), observedEndMs = Date.now()) {
    return this._sessionOperation(() => this._closeSessionUnlocked(reason, cutoffMs, observedEndMs));
  },

  async _closeSessionUnlocked(reason, cutoffMs = Date.now(), observedEndMs = cutoffMs) {
    const session = await this.loadSession();
    if (!session) return;
    await chrome.storage.local.remove(CB_ACTIVITY_SESSION_KEY);
    const grantCutoff = this.knownGrants.get(session.authorization?.revision)?.cutoffs["web-visit"] ?? Infinity;
    // Disabled time cannot qualify an otherwise subthreshold episode. An ON
    // revision split may use the whole already-observed continuous ON episode.
    const eligibleEnd = Math.min(observedEndMs, Date.now(), grantCutoff,
      reason === "native-settings-off" ? cutoffMs : Infinity);
    const raw = cbActivityMakeVisit(session, eligibleEnd, {
      minMs: this.visitEpisode?.domain === session.domain && this.visitEpisode?.tabId === session.tabId && this.visitEpisode.eligible ? 0 : CB_ACTIVITY_MIN_VISIT_MS, makeId: () => crypto.randomUUID(),
    });
    if (raw) this.visitEpisode = { domain: session.domain, tabId: session.tabId, eligible: true };
    if (reason !== "native-settings-cutoff" || !this.enabled["web-visit"]) this.visitEpisode = null;
    const record = raw && this.authorizedRecord({ ...raw, observedEndedAtMs: raw.startedAtMs + raw.seconds * 1000, authorization: session.authorization });
    if (record && record.observedEndedAtMs > cutoffMs) {
      record.observedEndedAtMs = cutoffMs; record.seconds = (cutoffMs - record.startedAtMs) / 1000;
    }
    if (record && record.seconds > 0) {
      await this.captureIcon(session.domain, session.favicon || await this.currentFavicon(session));
      await this.enqueue(record);
    }
  },

  // Called by vault-activity-content.js for a watched video on a supported
  // platform. Gated on the content-watched flag; the native store is the backstop.
  async recordWatched(record) {
    if (!record || typeof record.id !== "string" || record.id.length > 128 || !record.id
      || typeof record.key !== "string" || !record.key) return { ok: false, permanent: true };
    const candidate = { ...record, category: "content-watched" };
    if (!cbActivityBrowserRecordShape(candidate)) return { ok: false, permanent: true };
    if (this.bufferEpoch === null) return { ok: false, permanent: false }; // wait for a fresh native snapshot
    if (candidate.authorization.epoch.toLowerCase() !== this.bufferEpoch) return { ok: false, permanent: true };
    const grant = this.knownGrants.get(candidate.authorization.revision);
    // A page can outlive an MV3 restart too. Preserve its immutable prior
    // interval for native admission, only after a fresh same-epoch snapshot.
    const authorized = grant ? this.authorizedRecord(candidate)
      : !this.capturePaused && candidate.authorization.revision <= this.settingsRevision ? candidate : null;
    if (!authorized) return { ok: false, permanent: !!grant || !this.capturePaused };
    const buffered = await this.enqueue(authorized);
    return { ok: buffered, permanent: false };
  },

  async enqueue(record) {
    try {
      await this._bufferOperation(async () => {
        const stored = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
        const current = Array.isArray(stored[CB_ACTIVITY_BUFFER_KEY]) ? stored[CB_ACTIVITY_BUFFER_KEY] : [];
        const duplicate = current.find(value => value?.id === record.id);
        if (duplicate) {
          if (JSON.stringify(duplicate) !== JSON.stringify(record)) throw new Error("Conflicting Activity record ID");
          return;
        }
        await chrome.storage.local.set({ [CB_ACTIVITY_BUFFER_KEY]: cbActivityBoundBuffer(current.concat([record]), CB_ACTIVITY_BUFFER_CAP) });
      });
    } catch (_) { return false; }
    void this.flush();
    return true;
  },

  flush() {
    if (this.flushInFlight) return this.flushInFlight;
    this.flushInFlight = this._flushAuthorized().finally(() => { this.flushInFlight = null; });
    return this.flushInFlight;
  },

  async _flushAuthorized() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (this.capturePaused || typeof cbConnection === "undefined" || cbConnection.activitySettingsNotifications !== true) return;
      let batch, icons, reply;
      try {
        const stored = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
        const current = Array.isArray(stored[CB_ACTIVITY_BUFFER_KEY]) ? stored[CB_ACTIVITY_BUFFER_KEY] : [];
        // Alpha buffers without valid authority cannot be replayed as consent.
        // Keep valid bytes unchanged: the native store owns the final cutoff.
        const canReplay = record => cbActivityBrowserRecordShape(record) && record.authorization.epoch.toLowerCase() === this.bufferEpoch;
        const valid = current.filter(canReplay);
        if (valid.length !== current.length) await this._bufferOperation(async () => {
          const latest = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
          const rows = Array.isArray(latest[CB_ACTIVITY_BUFFER_KEY]) ? latest[CB_ACTIVITY_BUFFER_KEY] : [];
          await chrome.storage.local.set({ [CB_ACTIVITY_BUFFER_KEY]: rows.filter(canReplay) });
        });
        const packed = cbActivityPackBody(valid, await this.loadPendingIcons());
        if (packed.rejectedIDs.length) {
          const rejected = new Set(packed.rejectedIDs);
          console.warn("[CustomBlocker] Activity records exceed native body budget", packed.rejectedIDs);
          await this._bufferOperation(async () => {
            const latest = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
            const rows = Array.isArray(latest[CB_ACTIVITY_BUFFER_KEY]) ? latest[CB_ACTIVITY_BUFFER_KEY] : [];
            await chrome.storage.local.set({ [CB_ACTIVITY_BUFFER_KEY]: rows.filter(record => !rejected.has(record?.id)) });
          });
        }
        batch = packed.body.records;icons = packed.body.icons;
        if (!batch.length) return;
        reply = await cbClassifierHub.request("activity-record", packed.body);
      } catch (_) { return; }
      const ids = new Set(batch.map(record => record.id)), classified = new Set();
      if (!["acceptedIDs", "rejectedIDs", "pendingIDs"].every(key => Array.isArray(reply?.[key]) && reply[key].length <= batch.length
        && reply[key].every(id => typeof id === "string" && ids.has(id) && !classified.has(id) && !!classified.add(id)))
        || classified.size !== ids.size) return;
      const removable = new Set([...reply.acceptedIDs, ...reply.rejectedIDs]);
      try {
        await this._bufferOperation(async () => {
          const stored = await chrome.storage.local.get(CB_ACTIVITY_BUFFER_KEY);
          await chrome.storage.local.set({ [CB_ACTIVITY_BUFFER_KEY]: (Array.isArray(stored[CB_ACTIVITY_BUFFER_KEY]) ? stored[CB_ACTIVITY_BUFFER_KEY] : []).filter(record => !removable.has(record?.id)) });
        });
        if (Object.keys(icons).length && reply.acceptedIDs.length && Number.isSafeInteger(reply.stored) && reply.stored > 0) {
          const latest = await this.loadPendingIcons();
          for (const domain of Object.keys(icons)) { delete latest[domain]; this.sentIconDomains.add(domain); }
          await chrome.storage.local.set({ [CB_ACTIVITY_ICONS_KEY]: latest });
        }
      } catch (_) { return; }
      if (reply.pendingIDs.length || !removable.size) return;
    }
  },

  onAlarm(alarm) {
    if (!alarm || alarm.name !== CB_ACTIVITY_FLUSH_ALARM) return;
    void this.flush();
  },
};
