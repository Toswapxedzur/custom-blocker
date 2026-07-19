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

  // The adapter requests this before it reads or sends any rendered entry.
  // This makes the app-owned opt-in authoritative: absent or unavailable
  // settings mean no platform metadata leaves the page at all.
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
    const platform = message && message.entry && typeof message.entry.platform === "string" ? message.entry.platform : null;
    if (!message || message.type !== "vault-classifier-collect" || !collectionPlatformForSender(sender, platform)) return false;
    collect(message.entry, platform)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, accepted: false }));
    return true;
  });

})();
