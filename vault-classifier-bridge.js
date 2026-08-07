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

  async function sourceTags(platform, sourceID, creatorNames = []) {
    if (typeof sourceID !== "string"
      || sourceID.length === 0
      || sourceID.length > 256
      || !sourceID.startsWith(`${platform}:`)) {
      return { ok: false, tags: [] };
    }
    try {
      const current = await settings();
      if (!current.collectionEnabled) return { ok: true, platformID: platform, sourceID, tags: [] };
      const names = C.cleanCreatorNames?.(creatorNames) || [];
      const body = await hubRequest("source-tags", names.length
        ? { platformID: platform, sourceID, creatorNames: names }
        : { platformID: platform, sourceID });
      const normalized = C.normalizeSourceTagsResponse?.(body, platform, sourceID);
      return normalized
        ? { ok: true, platformID: normalized.platformID, sourceID: normalized.sourceID, tags: normalized.tags }
        : { ok: false, tags: [] };
    } catch (_) {
      return { ok: false, tags: [] };
    }
  }

  // Resolves tags for many sources in one hub round-trip. The content collector
  // flushes a viewport of cards together, so batching turns N requests into one
  // WebSocket exchange and one @MainActor hop on the app. A malformed reply, a
  // disabled platform, or an unavailable hub yields ok:false so the caller can
  // fall back to per-source requests.
  async function sourceTagsBatch(platform, rawItems) {
    if (typeof platform !== "string" || !Array.isArray(rawItems) || rawItems.length === 0) {
      return { ok: false, items: [] };
    }
    const items = [];
    const seen = new Set();
    for (const raw of rawItems) {
      const sourceID = raw && typeof raw.sourceID === "string" ? raw.sourceID : null;
      if (!sourceID
        || sourceID.length === 0
        || sourceID.length > 256
        || !sourceID.startsWith(`${platform}:`)
        || seen.has(sourceID)) {
        continue;
      }
      seen.add(sourceID);
      const names = C.cleanCreatorNames?.(raw.creatorNames) || [];
      items.push(names.length ? { sourceID, creatorNames: names } : { sourceID });
      if (items.length >= 64) break;
    }
    if (!items.length) return { ok: true, platformID: platform, items: [] };
    try {
      const current = await settings();
      if (!current.collectionEnabled) return { ok: true, platformID: platform, items: [] };
      const body = await hubRequest("source-tags-batch", { platformID: platform, items });
      const expected = new Set(items.map((item) => item.sourceID));
      const results = C.normalizeSourceTagsBatchResponse?.(body, platform, expected);
      if (!results) return { ok: false, items: [] };
      return {
        ok: true,
        platformID: platform,
        items: [...results.entries()].map(([sourceID, tags]) => ({ sourceID, tags }))
      };
    } catch (_) {
      return { ok: false, items: [] };
    }
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
        ? { ok: true, platformID: normalized.platformID, entryID: normalized.entryID, tags: normalized.tags, predicted: normalized.predicted, pending: normalized.pending }
        : { ok: false, tags: [], pending: false };
    } catch (_) {
      return { ok: false, tags: [], pending: false };
    }
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
    const sourceID = message && typeof message.sourceID === "string" ? message.sourceID : null;
    if (!message
      || message.type !== "vault-classifier-source-tags"
      || !collectionPlatformForSender(sender, platform)
      || !sourceID
      || !sourceID.startsWith(`${platform}:`)
      || sourceID.length > 256) {
      return false;
    }
    sourceTags(platform, sourceID, Array.isArray(message.creatorNames) ? message.creatorNames : [])
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, tags: [] }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const platform = message && typeof message.platform === "string" ? message.platform : null;
    if (!message
      || message.type !== "vault-classifier-source-tags-batch"
      || !collectionPlatformForSender(sender, platform)
      || !Array.isArray(message.items)) {
      return false;
    }
    sourceTagsBatch(platform, message.items)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, items: [] }));
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

  chrome.storage.onChanged?.addListener?.((changes, area) => {
    if (area === "local"
      && changes[SETTINGS_KEY]
      && changes[SETTINGS_KEY].newValue?.collectionEnabled === false) {
      void clearCollectionQueue();
    }
  });

  scheduleCollectionQueueFlush();

})();
