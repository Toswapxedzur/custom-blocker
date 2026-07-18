// Vault Classifier route over the shared Vault localhost WebSocket hub.
//
// The classifier connection uses the same authenticated loopback protocol as
// the Web-app bridge, but its own browser socket and status lifecycle. This
// layer is fail-open: missing peers, invalid replies, and timeouts leave
// content shown.
(function () {
  "use strict";
  if (self.__vaultClassifierBridge) return;
  self.__vaultClassifierBridge = true;

  const C = self.VaultClassifierExtensionContract;
  if (!C || typeof C.fitEntryForNativeTransport !== "function" || typeof C.isTrustedYouTubeURL !== "function" || typeof C.entryFingerprint !== "function" || typeof chrome === "undefined" || !chrome.runtime) return;

  const SETTINGS_KEY = "vaultClassifierSettings";
  const MAX_CLASSIFICATION_JOBS = 48;
  const MAX_ACTIVE_CLASSIFICATIONS = 4;
  const classificationJobs = new Map();
  const classificationQueue = [];
  let activeClassifications = 0;

  function storageGet(key) {
    return new Promise((resolve) => chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) return resolve({});
      resolve(result || {});
    }));
  }

  async function settings() {
    const result = await storageGet(SETTINGS_KEY);
    const raw = result[SETTINGS_KEY];
    return {
      collectionEnabled: !raw || raw.collectionEnabled !== false,
      enabled: Boolean(raw && raw.enabled === true),
      policyID: raw && typeof raw.policyID === "string" && raw.policyID.length <= 128
        ? raw.policyID
        : "clash-royale-focus",
      feedHardBlock: Boolean(raw && raw.feedHardBlock === true)
    };
  }

  function hubRequest(operation, body) {
    const hub = self.CBClassifierHub;
    if (!hub || typeof hub.request !== "function") {
      return Promise.reject(new Error("The shared Vault bridge is unavailable."));
    }
    return hub.request(operation, body);
  }

  function enqueueClassification(run) {
    return new Promise((resolve) => {
      classificationQueue.push({ run, resolve });
      drainClassificationQueue();
    });
  }

  function drainClassificationQueue() {
    while (activeClassifications < MAX_ACTIVE_CLASSIFICATIONS && classificationQueue.length) {
      const next = classificationQueue.shift();
      activeClassifications++;
      Promise.resolve()
        .then(next.run)
        .then(next.resolve, () => next.resolve({ ok: false, failOpen: true, reason: "classification-failed" }))
        .finally(() => {
          activeClassifications--;
          drainClassificationQueue();
        });
    }
  }

  async function classifyEntry(entry, current) {
    try {
      // A card can wait in the bounded queue while its local setting changes.
      // Do not classify it under a disabled or replaced policy.
      const latest = await settings();
      if (!latest.enabled || latest.policyID !== current.policyID) return { ok: false, failOpen: true, reason: "settings-changed" };
      const body = await hubRequest("classify", { entry });
      const result = body && body.result;
      if (!C.isResult(result)) throw new Error("The shared Vault hub returned an invalid classifier result.");
      let action = C.strongestAction(result);
      if (entry.surface === "feed" && action === "block" && !latest.feedHardBlock) action = "dim";
      return { ok: true, result, action, explanation: C.explanation(result), ledgerID: typeof body.ledgerID === "string" ? body.ledgerID : null };
    } catch (error) {
      return { ok: false, failOpen: true, reason: String(error && error.message || error) };
    }
  }

  async function classify(rawEntry) {
    const current = await settings();
    if (!current.enabled) return { ok: false, failOpen: true, reason: "disabled" };
    const normalized = C.normalizeEvidence({ ...rawEntry, policyIDs: [current.policyID] });
    if (!normalized || normalized.policyIDs.length !== 1) return { ok: false, failOpen: true, reason: "invalid-evidence" };
    const entry = C.fitEntryForNativeTransport(normalized);
    if (!entry) return { ok: false, failOpen: true, reason: "oversized-evidence" };
    const key = C.entryFingerprint(entry);
    if (!key) return { ok: false, failOpen: true, reason: "invalid-evidence" };
    const existing = classificationJobs.get(key);
    if (existing) return existing;
    if (classificationJobs.size >= MAX_CLASSIFICATION_JOBS) return { ok: false, failOpen: true, reason: "classifier-busy" };
    const job = enqueueClassification(() => classifyEntry(entry, current));
    classificationJobs.set(key, job);
    job.then(
      () => classificationJobs.delete(key),
      () => classificationJobs.delete(key)
    );
    return job;
  }

  function isOwnExtensionSender(sender) {
    return Boolean(sender) && sender.id === chrome.runtime.id;
  }

  async function bridgePolicies() {
    try {
      const body = await hubRequest("bridge-info", {});
      const candidates = Array.isArray(body && body.policies) ? body.policies : [];
      const policies = [];
      const seen = new Set();
      for (const candidate of candidates) {
        if (!candidate || typeof candidate.id !== "string" || typeof candidate.name !== "string" || candidate.id.length === 0 || candidate.id.length > 128 || candidate.name.length > 256 || /[\u0000-\u001f\u007f]/.test(candidate.id) || seen.has(candidate.id)) continue;
        seen.add(candidate.id);
        policies.push({ id: candidate.id, name: candidate.name });
        if (policies.length >= 64) break;
      }
      return { ok: true, policies };
    } catch (error) {
      return { ok: false, policies: [], reason: String(error && error.message || error) };
    }
  }

  // The adapter requests this before it reads or sends any rendered entry.
  // This makes the app-owned opt-in authoritative even when classification is
  // disabled: absent/unavailable settings mean no platform metadata leaves
  // the page at all.
  async function collectionInfo(platform) {
    try {
      const current = await settings();
      if (!current.collectionEnabled) return { ok: true, enabled: false };
      const body = await hubRequest("collection-info", {});
      const enabledPlatformIDs = Array.isArray(body && body.enabledPlatformIDs)
        ? body.enabledPlatformIDs.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 64)
        : [];
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
    try {
      const body = await hubRequest("collect", { entry });
      return { ok: Boolean(body && body.accepted === true), accepted: Boolean(body && body.accepted === true), inserted: Boolean(body && body.inserted === true) };
    } catch (error) {
      return { ok: false, accepted: false, reason: String(error && error.message || error) };
    }
  }

  async function correct(ledgerID, correction) {
    if (typeof ledgerID !== "string" || !/^[0-9a-f-]{36}$/i.test(ledgerID)) return { ok: false, failOpen: true };
    if (correction !== "falseAllow" && correction !== "falseDim" && correction !== "falseBlock" && correction !== null) return { ok: false, failOpen: true };
    try {
      const body = await hubRequest("correct", { ledgerID, correction });
      return { ok: Boolean(body && body.accepted === true) };
    } catch (_) {
      return { ok: false, failOpen: true };
    }
  }

  function isTrustedYouTubeSender(sender) {
    if (!sender || (sender.id && sender.id !== chrome.runtime.id)) return false;
    const pageURL = typeof sender.url === "string" ? sender.url : sender.tab && sender.tab.url;
    return C.isTrustedYouTubeURL(pageURL);
  }

  function collectionPlatformForSender(sender, requestedPlatform) {
    if (!sender || (sender.id && sender.id !== chrome.runtime.id)) return null;
    const pageURL = typeof sender.url === "string" ? sender.url : sender.tab && sender.tab.url;
    if (typeof requestedPlatform !== "string" || requestedPlatform.length === 0 || requestedPlatform.length > 64) return null;
    return C.isTrustedCollectionURL(requestedPlatform, pageURL) ? requestedPlatform : null;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "vault-classifier-classify" || !isTrustedYouTubeSender(sender)) return false;
    classify(message.entry)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, failOpen: true }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "vault-classifier-correct" || !isTrustedYouTubeSender(sender)) return false;
    correct(message.ledgerID, message.correction)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, failOpen: true }));
    return true;
  });

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
    const platform = message && message.entry && typeof message.entry.platform === "string" ? message.entry.platform : null;
    if (!message || message.type !== "vault-classifier-collect" || !collectionPlatformForSender(sender, platform)) return false;
    collect(message.entry, platform)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, accepted: false }));
    return true;
  });

  // This inventory is only for the extension's own settings page. Evidence and
  // corrections remain restricted to trusted YouTube content-script senders.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "vault-classifier-bridge-policies" || !isOwnExtensionSender(sender)) return false;
    bridgePolicies()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, policies: [] }));
    return true;
  });
})();
