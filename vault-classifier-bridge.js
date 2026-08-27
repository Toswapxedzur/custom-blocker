// Vault Classifier collection route over the shared local Vault hub.
//
// The browser sends bounded rendered entries only after its collection setting
// and the corresponding local Vault Classifier platform binding are both on.
(function () {
  "use strict";
  if (self.__vaultClassifierBridge) return;
  self.__vaultClassifierBridge = true;

  const C = self.VaultClassifierExtensionContract;
  if (!C || typeof C.fitEntryForNativeTransport !== "function" || typeof C.isTrustedCollectionURL !== "function" || typeof chrome === "undefined" || !chrome.runtime) return;

  const SETTINGS_KEY = "vaultClassifierSettings";
  const COLLECTION_QUEUE_KEY = "__vault_classifier_collection_queue_v1__";
  const COLLECTION_QUEUE_VERSION = 1;
  const COLLECTION_QUEUE_MAX_ITEMS = 512;
  const COLLECTION_QUEUE_MAX_BYTES = 8 * 1024 * 1024;
  const COLLECTION_QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
  const DIAGNOSTIC_EVENTS = new Set([
    "collector-started",
    "collection-info-requested",
    "collection-info-enabled",
    "collection-info-disabled",
    "collection-info-failed",
    "page-evidence-ready",
    "page-evidence-missing",
    "collection-requested",
    "collection-accepted",
    "collection-rejected"
  ]);
  const DIAGNOSTIC_DETAILS = new Set([
    "missing-video-id",
    "missing-watch-root",
    "missing-content-id",
    "missing-content-root",
    "missing-title",
    "missing-creator",
    "missing-source",
    "runtime-last-error",
    "bridge-unavailable",
    "rejected",
    "timeout"
  ]);
  let collectionQueueState = null;
  let collectionQueueMutation = Promise.resolve();
  let collectionQueueFlush = null;
  let collectionQueueFlushScheduled = false;

  function storageGet(key) {
    return new Promise((resolve) => chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) return resolve({});
      resolve(result || {});
    }));
  }

  function sessionStorageGet(defaults) {
    return new Promise((resolve) => {
      if (typeof chrome.storage?.session?.get !== "function") {
        resolve(defaults);
        return;
      }
      try {
        chrome.storage.session.get(defaults, (result) => {
          if (chrome.runtime.lastError) return resolve(defaults);
          resolve(result || defaults);
        });
      } catch (_) {
        resolve(defaults);
      }
    });
  }

  function sessionStorageSet(value) {
    return new Promise((resolve) => {
      if (typeof chrome.storage?.session?.set !== "function") {
        resolve(false);
        return;
      }
      try {
        chrome.storage.session.set(value, () => resolve(!chrome.runtime.lastError));
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function settings() {
    const result = await storageGet(SETTINGS_KEY);
    const raw = result[SETTINGS_KEY];
    return {
      collectionEnabled: !raw || raw.collectionEnabled !== false
    };
  }

  function hubRequest(operation, body) {
    const hub = self.CBClassifierHub;
    if (!hub || typeof hub.request !== "function") {
      return Promise.reject(new Error("The shared Vault bridge is unavailable."));
    }
    return hub.request(operation, body);
  }

  function publishDiagnostic(entry) {
    try {
      if (typeof self.CBRecordVaultClassifierDiagnostic === "function") {
        self.CBRecordVaultClassifierDiagnostic(entry);
      }
    } catch (_) {}
  }

  function queueDiagnostic(event, state, outcome) {
    publishDiagnostic({
      platform: "bridge",
      event,
      detail: `pending-${state.items.length}`,
      outcome
    });
  }

  function queueEntryKey(entry) {
    return `${entry.platform}\u001f${entry.entryID}`;
  }

  function cleanQueuePlatformIDs(value) {
    return Array.isArray(value)
      ? [...new Set(value.filter((id) => typeof id === "string" && /^[a-z0-9-]{1,64}$/.test(id)))].sort()
      : [];
  }

  function boundedObservation(value, fallback) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : fallback;
  }

  function defaultQueueState() {
    return {
      version: COLLECTION_QUEUE_VERSION,
      authorizedPlatformIDs: [],
      items: [],
      droppedCount: 0
    };
  }

  function sanitizeQueueItem(value, now) {
    if (!value || typeof value !== "object") return null;
    const normalized = C.normalizeEvidence(value.entry);
    const entry = normalized && C.fitEntryForNativeTransport(normalized);
    if (!entry || !entry.platform || !entry.entryID || !entry.sourceID) return null;
    const firstObservedAtMilliseconds = boundedObservation(value.firstObservedAtMilliseconds, now);
    const lastObservedAtMilliseconds = Math.max(
      firstObservedAtMilliseconds,
      boundedObservation(value.lastObservedAtMilliseconds, firstObservedAtMilliseconds)
    );
    if (now - lastObservedAtMilliseconds > COLLECTION_QUEUE_TTL_MS) return null;
    return {
      key: queueEntryKey(entry),
      entry,
      firstObservedAtMilliseconds,
      lastObservedAtMilliseconds,
      observationCount: Math.min(Number.MAX_SAFE_INTEGER, boundedObservation(value.observationCount, 1)),
      revision: Math.min(Number.MAX_SAFE_INTEGER, boundedObservation(value.revision, 1))
    };
  }

  function queueByteLength(state) {
    return C.nativeBodyByteLength(state);
  }

  function enforceQueueBounds(state, now = Date.now()) {
    const priorDropped = state.droppedCount;
    const items = [];
    const indexes = new Map();
    for (const rawItem of state.items) {
      const item = sanitizeQueueItem(rawItem, now);
      if (!item) {
        state.droppedCount = Math.min(Number.MAX_SAFE_INTEGER, state.droppedCount + 1);
        continue;
      }
      const existingIndex = indexes.get(item.key);
      if (existingIndex === undefined) {
        indexes.set(item.key, items.length);
        items.push(item);
      } else if (items[existingIndex].revision <= item.revision) {
        items[existingIndex] = item;
      }
    }
    items.sort((lhs, rhs) =>
      lhs.firstObservedAtMilliseconds - rhs.firstObservedAtMilliseconds
      || lhs.key.localeCompare(rhs.key)
    );
    state.items = items;
    while (state.items.length > COLLECTION_QUEUE_MAX_ITEMS || queueByteLength(state) > COLLECTION_QUEUE_MAX_BYTES) {
      state.items.shift();
      state.droppedCount = Math.min(Number.MAX_SAFE_INTEGER, state.droppedCount + 1);
    }
    if (state.droppedCount > priorDropped) {
      queueDiagnostic("collection-dropped", state, "bounded");
    }
    return state;
  }

  async function loadQueueState() {
    if (collectionQueueState) return collectionQueueState;
    const stored = await sessionStorageGet({ [COLLECTION_QUEUE_KEY]: null });
    const raw = stored[COLLECTION_QUEUE_KEY];
    const state = defaultQueueState();
    if (raw && typeof raw === "object") {
      state.authorizedPlatformIDs = cleanQueuePlatformIDs(raw.authorizedPlatformIDs);
      state.items = Array.isArray(raw.items) ? raw.items : [];
      state.droppedCount = Math.min(
        Number.MAX_SAFE_INTEGER,
        Math.max(0, Number.isSafeInteger(raw.droppedCount) ? raw.droppedCount : 0)
      );
    }
    collectionQueueState = enforceQueueBounds(state);
    return collectionQueueState;
  }

  function mutateQueue(mutator) {
    const operation = collectionQueueMutation
      .catch(() => {})
      .then(async () => {
        const state = await loadQueueState();
        const result = await mutator(state);
        enforceQueueBounds(state);
        await sessionStorageSet({ [COLLECTION_QUEUE_KEY]: state });
        return result;
      });
    collectionQueueMutation = operation.catch(() => {});
    return operation;
  }

  function richerText(existing, incoming) {
    if (typeof incoming !== "string" || !incoming) return existing || null;
    if (typeof existing !== "string" || !existing) return incoming;
    return incoming.length >= existing.length ? incoming : existing;
  }

  function mergeQueuedEntries(existing, incoming) {
    if (existing.platform !== incoming.platform
      || existing.entryID !== incoming.entryID
      || existing.sourceID !== incoming.sourceID) {
      return incoming;
    }
    const oldEvidence = existing.evidence || {};
    const newEvidence = incoming.evidence || {};
    const tags = [...new Set([
      ...(Array.isArray(oldEvidence.suppliedTags) ? oldEvidence.suppliedTags : []),
      ...(Array.isArray(newEvidence.suppliedTags) ? newEvidence.suppliedTags : [])
    ])].slice(0, 64);
    return C.fitEntryForNativeTransport(C.normalizeEvidence({
      ...existing,
      ...incoming,
      requestID: incoming.requestID || existing.requestID,
      surface: existing.surface === "page" || incoming.surface === "page" ? "page" : "feed",
      evidence: {
        title: newEvidence.title || oldEvidence.title,
        text: richerText(oldEvidence.text, newEvidence.text),
        summary: richerText(oldEvidence.summary, newEvidence.summary),
        suppliedTags: tags,
        metadata: {
          ...(oldEvidence.metadata || {}),
          ...(newEvidence.metadata || {})
        }
      }
    })) || incoming;
  }

  async function replaceAuthorizedPlatforms(enabledPlatformIDs) {
    const enabled = cleanQueuePlatformIDs(enabledPlatformIDs);
    const enabledSet = new Set(enabled);
    return mutateQueue((state) => {
      const previousCount = state.items.length;
      state.authorizedPlatformIDs = enabled;
      state.items = state.items.filter((item) => enabledSet.has(item.entry.platform));
      const removed = previousCount - state.items.length;
      if (removed > 0) {
        state.droppedCount = Math.min(Number.MAX_SAFE_INTEGER, state.droppedCount + removed);
        queueDiagnostic("collection-dropped", state, "disabled");
      }
      return state;
    });
  }

  async function clearCollectionQueue(outcome = "disabled") {
    return mutateQueue((state) => {
      const removed = state.items.length;
      state.items = [];
      state.authorizedPlatformIDs = [];
      if (removed > 0) {
        state.droppedCount = Math.min(Number.MAX_SAFE_INTEGER, state.droppedCount + removed);
        queueDiagnostic("collection-dropped", state, outcome);
      }
      return state;
    });
  }

  async function enqueueCollection(entry) {
    if (typeof chrome.storage?.session?.set !== "function") {
      return { accepted: false, reason: "session-storage-unavailable" };
    }
    return mutateQueue((state) => {
      if (!state.authorizedPlatformIDs.includes(entry.platform)) {
        return { accepted: false, reason: "collection-not-authorized" };
      }
      const now = Date.now();
      const key = queueEntryKey(entry);
      const index = state.items.findIndex((item) => item.key === key);
      if (index >= 0) {
        const prior = state.items[index];
        state.items[index] = {
          key,
          entry: mergeQueuedEntries(prior.entry, entry),
          firstObservedAtMilliseconds: Math.min(prior.firstObservedAtMilliseconds, now),
          lastObservedAtMilliseconds: now,
          observationCount: Math.min(Number.MAX_SAFE_INTEGER, prior.observationCount + 1),
          revision: Math.min(Number.MAX_SAFE_INTEGER, prior.revision + 1)
        };
      } else {
        state.items.push({
          key,
          entry,
          firstObservedAtMilliseconds: now,
          lastObservedAtMilliseconds: now,
          observationCount: 1,
          revision: 1
        });
      }
      enforceQueueBounds(state, now);
      queueDiagnostic("collection-queued", state, "session");
      return {
        accepted: true,
        queued: true,
        queueDepth: state.items.length,
        droppedCount: state.droppedCount
      };
    });
  }

  async function flushCollectionQueue() {
    if (collectionQueueFlush) return collectionQueueFlush;
    collectionQueueFlush = (async () => {
      const current = await settings();
      if (!current.collectionEnabled) {
        await clearCollectionQueue();
        return { flushed: 0 };
      }
      let info;
      try {
        info = await hubRequest("collection-info", {});
      } catch (_) {
        return { flushed: 0 };
      }
      const enabledPlatformIDs = Array.isArray(info?.enabledPlatformIDs) ? info.enabledPlatformIDs : [];
      await replaceAuthorizedPlatforms(enabledPlatformIDs);
      let flushed = 0;
      for (;;) {
        const candidate = await mutateQueue((state) => state.items[0]
          ? JSON.parse(JSON.stringify(state.items[0]))
          : null);
        if (!candidate) break;
        let response;
        try {
          response = await hubRequest("collect", {
            entry: candidate.entry,
            firstObservedAtMilliseconds: candidate.firstObservedAtMilliseconds,
            lastObservedAtMilliseconds: candidate.lastObservedAtMilliseconds,
            observationCount: candidate.observationCount
          });
        } catch (_) {
          break;
        }
        const acknowledged = Boolean(response && typeof response.accepted === "boolean");
        if (!acknowledged) break;
        await mutateQueue((state) => {
          const index = state.items.findIndex((item) => item.key === candidate.key);
          if (index < 0 || state.items[index].revision !== candidate.revision) return;
          state.items.splice(index, 1);
          if (response.accepted !== true) {
            state.droppedCount = Math.min(Number.MAX_SAFE_INTEGER, state.droppedCount + 1);
            queueDiagnostic("collection-dropped", state, "rejected");
          }
        });
        if (response.accepted === true) {
          flushed += 1;
          const state = await loadQueueState();
          queueDiagnostic("collection-flushed", state, "vault");
        }
      }
      return { flushed };
    })().finally(() => {
      collectionQueueFlush = null;
    });
    return collectionQueueFlush;
  }

  function scheduleCollectionQueueFlush() {
    if (collectionQueueFlushScheduled) return;
    collectionQueueFlushScheduled = true;
    setTimeout(() => {
      collectionQueueFlushScheduled = false;
      void flushCollectionQueue();
    }, 0);
  }

  self.CBFlushVaultClassifierCollectionQueue = flushCollectionQueue;
  self.CBVaultClassifierCollectionQueueStatus = async () => {
    const state = await loadQueueState();
    return {
      pendingCount: state.items.length,
      droppedCount: state.droppedCount,
      bytes: queueByteLength(state)
    };
  };

  function validDiagnostic(event, detail) {
    return DIAGNOSTIC_EVENTS.has(event) && (detail == null || DIAGNOSTIC_DETAILS.has(detail));
  }

  async function forwardDiagnostic(platform, event, detail) {
    if (!validDiagnostic(event, detail)) return { ok: false, accepted: false };
    publishDiagnostic({ platform, event, detail, outcome: "extension" });
    try {
      const body = await hubRequest("diagnostic", {
        platformID: platform,
        event,
        ...(detail ? { detail } : {})
      });
      const accepted = Boolean(body && body.accepted === true);
      publishDiagnostic({ platform, event, detail, outcome: accepted ? "vault-received" : "rejected" });
      return { ok: accepted, accepted };
    } catch (_) {
      publishDiagnostic({ platform, event, detail: "bridge-unavailable", outcome: "unavailable" });
      return { ok: false, accepted: false };
    }
  }

  // The adapter requests this before it reads or sends any rendered entry.
  // This makes the app-owned opt-in authoritative: absent or unavailable
  // settings mean no platform metadata leaves the page at all.
  async function collectionInfo(platform) {
    try {
      const current = await settings();
      if (!current.collectionEnabled) {
        await clearCollectionQueue();
        return { ok: true, enabled: false };
      }
      const body = await hubRequest("collection-info", {});
      const enabledPlatformIDs = Array.isArray(body && body.enabledPlatformIDs)
        ? body.enabledPlatformIDs.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64)
        : [];
      await replaceAuthorizedPlatforms(enabledPlatformIDs);
      // Mirror the app's dev-env flag so content scripts auto-enable dev logging
      // (no manual "debug mode" toggle needed when talking to a dev app).
      await syncDevMode(body && body.developmentMode === true);
      scheduleCollectionQueueFlush();
      return { ok: true, enabled: enabledPlatformIDs.includes(platform) };
    } catch (error) {
      return { ok: false, enabled: false, reason: String(error && error.message || error) };
    }
  }

  async function collect(rawEntry, expectedPlatform) {
    const normalized = C.normalizeEvidence(rawEntry);
    if (!normalized || normalized.platform !== expectedPlatform || !normalized.entryID || !normalized.sourceID) {
      return { ok: false, accepted: false, reason: "invalid-collection-entry" };
    }
    const entry = C.fitEntryForNativeTransport(normalized);
    if (!entry) return { ok: false, accepted: false, reason: "oversized-collection-entry" };
    const current = await settings();
    if (!current.collectionEnabled) {
      await clearCollectionQueue();
      return { ok: true, accepted: false, reason: "collection-disabled" };
    }
    const queued = await enqueueCollection(entry);
    if (queued.accepted) scheduleCollectionQueueFlush();
    return { ok: Boolean(queued.accepted), ...queued };
  }

  // Local-LLM rework: resolves ONE video's tags, keyed by the video's entryID +
  // evidence (the pill is now per-video). Returns pending:true when the app has
  // queued classification and the caller should re-request shortly.
  async function videoTags(platform, entryID, creatorID, title, summary, text) {
    if (typeof entryID !== "string" || entryID.length === 0 || entryID.length > 256 || !entryID.startsWith(`${platform}:`)
      || typeof creatorID !== "string" || creatorID.length === 0 || creatorID.length > 256 || !creatorID.startsWith(`${platform}:`)
      || typeof title !== "string" || title.length === 0 || title.length > 500) {
      return { ok: false, tags: [], pending: false };
    }
    try {
      const current = await settings();
      if (!current.collectionEnabled) return { ok: true, platformID: platform, entryID, tags: [], pending: false };
      const body = await hubRequest("video-tags", {
        platformID: platform, entryID, creatorID, title,
        ...(typeof summary === "string" && summary ? { summary: summary.slice(0, 4000) } : {}),
        ...(typeof text === "string" && text ? { text: text.slice(0, 4000) } : {})
      });
      const normalized = C.normalizeVideoTagsResponse?.(body, platform, entryID);
      return normalized
        ? { ok: true, platformID: normalized.platformID, entryID: normalized.entryID, tags: normalized.tags, predicted: normalized.predicted, pending: normalized.pending, feedAction: normalized.feedAction, pageAction: normalized.pageAction }
        : { ok: false, tags: [], pending: false };
    } catch (_) {
      return { ok: false, tags: [], pending: false };
    }
  }

  // Batched per-video tags: a viewport of cards resolved in one hub round-trip.
  // Each item may come back pending:true (classification queued); the caller
  // re-requests shortly and the pill fills in from the decision cache.
  async function videoTagsBatch(platform, rawItems) {
    if (typeof platform !== "string" || !Array.isArray(rawItems) || rawItems.length === 0) {
      return { ok: false, items: [] };
    }
    const items = [];
    const seen = new Set();
    for (const raw of rawItems) {
      const entryID = raw && typeof raw.entryID === "string" ? raw.entryID : null;
      const creatorID = raw && typeof raw.creatorID === "string" ? raw.creatorID : null;
      const title = raw && typeof raw.title === "string" ? raw.title : null;
      if (!entryID || entryID.length === 0 || entryID.length > 256 || !entryID.startsWith(`${platform}:`)
        || !creatorID || creatorID.length === 0 || creatorID.length > 256 || !creatorID.startsWith(`${platform}:`)
        || !title || title.length === 0 || title.length > 500
        || seen.has(entryID)) {
        continue;
      }
      seen.add(entryID);
      const item = { entryID, creatorID, title };
      if (typeof raw.summary === "string" && raw.summary) item.summary = raw.summary.slice(0, 4000);
      if (typeof raw.text === "string" && raw.text) item.text = raw.text.slice(0, 4000);
      items.push(item);
      if (items.length >= 64) break;
    }
    if (!items.length) return { ok: true, platformID: platform, items: [] };
    try {
      const current = await settings();
      if (!current.collectionEnabled) return { ok: true, platformID: platform, items: [] };
      const body = await hubRequest("video-tags-batch", { platformID: platform, items });
      const expected = new Set(items.map((item) => item.entryID));
      const results = C.normalizeVideoTagsBatchResponse?.(body, platform, expected);
      if (!results) return { ok: false, items: [] };
      return {
        ok: true,
        platformID: platform,
        items: [...results.entries()].map(([entryID, value]) => ({ entryID, tags: value.tags, predicted: value.predicted, pending: value.pending, feedAction: value.feedAction, pageAction: value.pageAction }))
      };
    } catch (_) {
      return { ok: false, items: [] };
    }
  }

  // The predictable tag choices for a platform's classifier types — used by the
  // in-page pill UI to offer add-a-tag options. Read-only.
  function validTag(tag) {
    return tag && typeof tag.id === "string" && tag.id.length > 0 && tag.id.length <= 256
      && typeof tag.name === "string" && tag.name.length > 0 && tag.name.length <= 200
      && typeof tag.lightColorHex === "string" && typeof tag.darkColorHex === "string";
  }
  async function classifierTaxonomy(platform) {
    try {
      const current = await settings();
      if (!current.collectionEnabled) return { ok: true, platformID: platform, types: [] };
      const body = await hubRequest("classifier-taxonomy", { platformID: platform });
      if (!body || body.platformID !== platform || !Array.isArray(body.types)) return { ok: false, types: [] };
      const types = body.types.map((type) => ({
        typeID: typeof type.typeID === "string" ? type.typeID : "",
        name: typeof type.name === "string" ? type.name.slice(0, 200) : "",
        tags: Array.isArray(type.tags) ? type.tags.filter(validTag).slice(0, 64) : []
      })).filter((type) => type.typeID && type.tags.length).slice(0, 16);
      return { ok: true, platformID: platform, types };
    } catch (_) {
      return { ok: false, types: [] };
    }
  }

  // Apply a user correction: the authoritative tag set for one video under one
  // classifier type. Returns the resolved tags; the app also broadcasts the
  // update so every open tab's pill for this video refreshes.
  async function submitCorrection(platform, entryID, creatorID, typeID, correctTagIDs) {
    if (typeof entryID !== "string" || !entryID.startsWith(`${platform}:`) || entryID.length > 256
      || typeof creatorID !== "string" || !creatorID.startsWith(`${platform}:`) || creatorID.length > 256
      || typeof typeID !== "string" || typeID.length === 0 || typeID.length > 256
      || !Array.isArray(correctTagIDs) || correctTagIDs.length > 32
      || !correctTagIDs.every((id) => typeof id === "string" && id.length > 0 && id.length <= 256)) {
      return { ok: false };
    }
    try {
      const current = await settings();
      if (!current.collectionEnabled) return { ok: false };
      const uniqueTagIDs = [...new Set(correctTagIDs)];
      const body = await hubRequest("submit-correction", { platformID: platform, entryID, creatorID, typeID, correctTagIDs: uniqueTagIDs });
      if (!body || body.platformID !== platform || body.entryID !== entryID || !Array.isArray(body.tags)) return { ok: false };
      return { ok: true, platformID: platform, entryID, tags: body.tags.filter(validTag).slice(0, 16) };
    } catch (_) {
      return { ok: false };
    }
  }

  // Mirrors the native app's dev-env flag into local storage so content scripts
  // (tag-ui, collector) auto-enable dev logging without a manual "debug mode"
  // toggle. Only writes on change.
  let cbVaultDevMode = false;
  async function syncDevMode(dev) {
    const next = dev === true;
    if (next === cbVaultDevMode) return;
    cbVaultDevMode = next;
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ vaultDevMode: next }, () => { void chrome.runtime.lastError; resolve(); });
      });
    } catch (_) {}
  }

  // Dev-only: forward a structured log line from an extension layer into the
  // native unified dev log. Fire-and-forget; the native side only persists it in
  // the development environment.
  async function forwardDevLog(layer, event, fields) {
    try {
      await hubRequest("dev-log", {
        layer: String(layer || "ext").slice(0, 32),
        event: String(event || "").slice(0, 200),
        fields: fields && typeof fields === "object" && !Array.isArray(fields) ? fields : {}
      });
    } catch (_) {}
  }

  function collectionPlatformForSender(sender, requestedPlatform) {
    if (!sender || (sender.id && sender.id !== chrome.runtime.id)) return null;
    const pageURL = typeof sender.url === "string" ? sender.url : sender.tab && sender.tab.url;
    if (typeof requestedPlatform !== "string" || requestedPlatform.length === 0 || requestedPlatform.length > 64) return null;
    return C.isTrustedCollectionURL(requestedPlatform, pageURL) ? requestedPlatform : null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "vault-classifier-collection-info") return false;
    const platform = collectionPlatformForSender(sender, typeof message.platform === "string" ? message.platform : "youtube");
    if (!platform) return false;
    collectionInfo(platform)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, enabled: false }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "vault-classifier-diagnostic") return false;
    const platform = collectionPlatformForSender(sender, message.platform);
    const event = typeof message.event === "string" ? message.event : "";
    const detail = typeof message.detail === "string" ? message.detail : null;
    if (!platform || !validDiagnostic(event, detail)) return false;
    forwardDiagnostic(platform, event, detail)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, accepted: false }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = message && message.entry && typeof message.entry.platform === "string" ? message.entry.platform : null;
    if (!message || message.type !== "vault-classifier-collect" || !collectionPlatformForSender(sender, platform)) return false;
    publishDiagnostic({ platform, event: "collection-requested", detail: null, outcome: "extension" });
    collect(message.entry, platform)
      .then((response) => {
        if (!response.accepted) {
          publishDiagnostic({ platform, event: "collection-rejected", detail: "rejected", outcome: "rejected" });
        }
        sendResponse(response);
      })
      .catch(() => sendResponse({ ok: false, accepted: false }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = message && typeof message.platform === "string" ? message.platform : null;
    const entryID = message && typeof message.entryID === "string" ? message.entryID : null;
    const creatorID = message && typeof message.creatorID === "string" ? message.creatorID : null;
    if (!message
      || message.type !== "vault-classifier-video-tags"
      || !collectionPlatformForSender(sender, platform)
      || !entryID
      || !entryID.startsWith(`${platform}:`)
      || entryID.length > 256) {
      return false;
    }
    videoTags(platform, entryID, creatorID, typeof message.title === "string" ? message.title : "", message.summary, message.text)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, tags: [], pending: false }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = message && typeof message.platform === "string" ? message.platform : null;
    if (!message
      || message.type !== "vault-classifier-video-tags-batch"
      || !collectionPlatformForSender(sender, platform)
      || !Array.isArray(message.items)) {
      return false;
    }
    videoTagsBatch(platform, message.items)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, items: [] }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = message && typeof message.platform === "string" ? message.platform : null;
    if (!message || message.type !== "vault-classifier-classifier-taxonomy" || !collectionPlatformForSender(sender, platform)) return false;
    classifierTaxonomy(platform)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, types: [] }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = message && typeof message.platform === "string" ? message.platform : null;
    if (!message || message.type !== "vault-classifier-submit-correction" || !collectionPlatformForSender(sender, platform)) return false;
    submitCorrection(
      platform,
      typeof message.entryID === "string" ? message.entryID : "",
      typeof message.creatorID === "string" ? message.creatorID : "",
      typeof message.typeID === "string" ? message.typeID : "",
      Array.isArray(message.correctTagIDs) ? message.correctTagIDs : []
    )
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false }));
    return true;
  });

  // Unsolicited hub push: classification finished for one or more videos.
  // After contract validation, fan the resolved tags out to every tab trusted
  // for the platform; tag-ui swaps provisional pills in place without another
  // request round-trip.
  function handleClassifierBroadcast(frame) {
    if (!frame || frame.operation !== "video-tags-updated") return;
    const normalized = C.normalizeVideoTagsBroadcast?.(frame.body);
    if (!normalized || typeof chrome.tabs?.query !== "function") return;
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) return;
      for (const tab of tabs || []) {
        if (!tab || typeof tab.id !== "number" || typeof tab.url !== "string"
          || !C.isTrustedCollectionURL(normalized.platformID, tab.url)) {
          continue;
        }
        try {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "vault-classifier-video-tags-updated", platform: normalized.platformID, items: normalized.items },
            () => { void chrome.runtime.lastError; }
          );
        } catch (_) {}
      }
    });
  }
  self.CBClassifierBroadcastReceive = handleClassifierBroadcast;

  // Dev-only unified log forwarding from content-script layers. Fire-and-forget.
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!message || message.type !== "vault-classifier-dev-log"
      || (sender && sender.id && sender.id !== chrome.runtime.id)) {
      return false;
    }
    forwardDevLog(message.layer, message.event, message.fields);
    return false;
  });

  chrome.storage.onChanged?.addListener?.((changes, area) => {
    if (area === "local"
      && changes[SETTINGS_KEY]
      && changes[SETTINGS_KEY].newValue?.collectionEnabled === false) {
      void clearCollectionQueue();
    }
  });

  scheduleCollectionQueueFlush();

})();
