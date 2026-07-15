// Vault Classifier native-messaging bridge (Chrome/Edge MV3).
//
// Normal browsing is fail-open: this file never makes an HTTP request and any
// unavailable/invalid native response becomes { ok:false, failOpen:true }.
// It is dormant unless the local `vaultClassifierSettings.enabled` flag is on.
(function () {
  "use strict";
  if (self.__vaultClassifierBridge) return;
  self.__vaultClassifierBridge = true;

  const C = self.VaultClassifierExtensionContract;
  if (!C || typeof chrome === "undefined" || !chrome.runtime) return;

  const HOST_NAME = "com.adamancia.vault_classifier";
  const SETTINGS_KEY = "vaultClassifierSettings";
  const SECRET_KEY = "vaultClassifierPairingSecret";
  const CLIENT_KEY = "vaultClassifierClientID";
  const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
  const pending = new Map();
  const seenResponseNonces = new Map();
  let nativePort = null;
  let pairingPromise = null;

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, (result) => resolve(result || {})));
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => chrome.storage.local.set(value, () => {
      const error = chrome.runtime.lastError;
      error ? reject(new Error(error.message)) : resolve();
    }));
  }

  async function settings() {
    const result = await storageGet(SETTINGS_KEY);
    const raw = result[SETTINGS_KEY];
    return {
      enabled: Boolean(raw && raw.enabled === true),
      policyID: raw && typeof raw.policyID === "string" && raw.policyID.length <= 128
        ? raw.policyID
        : "clash-royale-focus",
      feedHardBlock: Boolean(raw && raw.feedHardBlock === true)
    };
  }

  function bytesToBase64(bytes) {
    let output = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      output += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
    }
    return btoa(output);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const output = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) output[index] = binary.charCodeAt(index);
    return output;
  }

  function hex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function randomNonce() {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return bytesToBase64(bytes);
  }

  function canonical(envelope) {
    return `v=${envelope.protocolVersion}\nkind=${envelope.kind}\nid=${envelope.requestID}\nts=${envelope.timestampMilliseconds}\nnonce=${envelope.nonce}\nbody=${String(envelope.bodyHash).toLowerCase()}`;
  }

  async function bodyHash(bodyBase64) {
    const bytes = base64ToBytes(bodyBase64);
    return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
  }

  async function mac(canonicalText, secretBase64) {
    const key = await crypto.subtle.importKey("raw", base64ToBytes(secretBase64), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return bytesToBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalText))));
  }

  async function makeEnvelope(kind, body, secretBase64, requestID) {
    const bodyBytes = new TextEncoder().encode(JSON.stringify(body));
    const envelope = {
      protocolVersion: C.protocolVersion,
      kind,
      requestID: requestID || C.randomID("native"),
      timestampMilliseconds: Date.now(),
      nonce: randomNonce(),
      bodyBase64: bytesToBase64(bodyBytes),
      bodyHash: hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bodyBytes))),
      mac: null
    };
    if (secretBase64) envelope.mac = await mac(canonical(envelope), secretBase64);
    return envelope;
  }

  async function decodeBody(envelope) {
    if (!envelope || typeof envelope.bodyBase64 !== "string" || typeof envelope.bodyHash !== "string") throw new Error("Malformed native response.");
    if ((await bodyHash(envelope.bodyBase64)) !== envelope.bodyHash.toLowerCase()) throw new Error("Native response body failed integrity verification.");
    return JSON.parse(new TextDecoder().decode(base64ToBytes(envelope.bodyBase64)));
  }

  async function verifyResponse(envelope, secretBase64) {
    if (!envelope || envelope.protocolVersion !== C.protocolVersion || typeof envelope.nonce !== "string" || Math.abs(Date.now() - Number(envelope.timestampMilliseconds)) > MAX_CLOCK_SKEW_MS) {
      throw new Error("Stale or malformed native response.");
    }
    if (seenResponseNonces.has(envelope.nonce)) throw new Error("Replayed native response.");
    const expected = await mac(canonical(envelope), secretBase64);
    if (typeof envelope.mac !== "string" || !constantTimeTextEquals(expected, envelope.mac)) throw new Error("Invalid native response MAC.");
    seenResponseNonces.set(envelope.nonce, Date.now());
    if (seenResponseNonces.size > 1024) {
      const oldest = Array.from(seenResponseNonces.entries()).sort((a, b) => a[1] - b[1]).slice(0, seenResponseNonces.size - 1024);
      oldest.forEach(([nonce]) => seenResponseNonces.delete(nonce));
    }
    return decodeBody(envelope);
  }

  function constantTimeTextEquals(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  }

  function connectPort() {
    if (nativePort) return nativePort;
    nativePort = chrome.runtime.connectNative(HOST_NAME);
    nativePort.onMessage.addListener((message) => {
      const requestID = message && message.requestID;
      const waiter = requestID && pending.get(requestID);
      if (!waiter) return;
      pending.delete(requestID);
      waiter.resolve(message);
    });
    nativePort.onDisconnect.addListener(() => {
      const reason = chrome.runtime.lastError?.message || "Vault Classifier native host disconnected.";
      nativePort = null;
      for (const waiter of pending.values()) waiter.reject(new Error(reason));
      pending.clear();
    });
    return nativePort;
  }

  function roundTrip(envelope) {
    return new Promise((resolve, reject) => {
      let port;
      try { port = connectPort(); } catch (error) { reject(error); return; }
      const timer = setTimeout(() => {
        if (pending.delete(envelope.requestID)) reject(new Error("Vault Classifier native request timed out."));
      }, 6_000);
      pending.set(envelope.requestID, {
        resolve(message) { clearTimeout(timer); resolve(message); },
        reject(error) { clearTimeout(timer); reject(error); }
      });
      try { port.postMessage(envelope); } catch (error) {
        pending.delete(envelope.requestID);
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  async function pairedSecret() {
    const saved = await storageGet([SECRET_KEY, CLIENT_KEY]);
    if (typeof saved[SECRET_KEY] === "string") {
      try {
        if (base64ToBytes(saved[SECRET_KEY]).length === 32) return saved[SECRET_KEY];
      } catch (_) {}
    }
    if (pairingPromise) return pairingPromise;
    pairingPromise = (async () => {
      const clientID = typeof saved[CLIENT_KEY] === "string" && saved[CLIENT_KEY].length >= 16
        ? saved[CLIENT_KEY]
        : C.randomID("extension");
      const envelope = await makeEnvelope("pair", { clientID }, null);
      const response = await roundTrip(envelope);
      if (!response || response.kind !== "pair-response" || response.requestID !== envelope.requestID) throw new Error("Native pairing failed.");
      const body = await decodeBody(response);
      if (!body || typeof body.secretBase64 !== "string" || base64ToBytes(body.secretBase64).length !== 32) throw new Error("Native pairing returned an invalid secret.");
      await storageSet({ [SECRET_KEY]: body.secretBase64, [CLIENT_KEY]: clientID });
      return body.secretBase64;
    })();
    try { return await pairingPromise; }
    finally { pairingPromise = null; }
  }

  async function classify(rawEntry) {
    const current = await settings();
    if (!current.enabled) return { ok: false, failOpen: true, reason: "disabled" };
    const entry = C.normalizeEvidence({ ...rawEntry, policyIDs: [current.policyID] });
    if (!entry) return { ok: false, failOpen: true, reason: "invalid-evidence" };
    try {
      const secret = await pairedSecret();
      const envelope = await makeEnvelope("classify", { entry }, secret);
      const response = await roundTrip(envelope);
      if (!response || response.kind !== "classification-response" || response.requestID !== envelope.requestID) throw new Error("Invalid native classification response.");
      const body = await verifyResponse(response, secret);
      const result = body && body.result;
      if (!C.isResult(result)) throw new Error("Native classifier returned an invalid result.");
      let action = C.strongestAction(result);
      if (entry.surface === "feed" && action === "block" && !current.feedHardBlock) action = "dim";
      return { ok: true, result, action, explanation: C.explanation(result), ledgerID: typeof body.ledgerID === "string" ? body.ledgerID : null };
    } catch (error) {
      return { ok: false, failOpen: true, reason: String(error && error.message || error) };
    }
  }

  async function correct(ledgerID, correction) {
    if (typeof ledgerID !== "string" || !/^[0-9a-f-]{36}$/i.test(ledgerID)) return { ok: false, failOpen: true };
    if (correction !== "falseAllow" && correction !== "falseDim" && correction !== "falseBlock" && correction !== null) return { ok: false, failOpen: true };
    try {
      const secret = await pairedSecret();
      const envelope = await makeEnvelope("correct", { ledgerID, correction }, secret);
      const response = await roundTrip(envelope);
      if (!response || response.kind !== "correction-response" || response.requestID !== envelope.requestID) throw new Error("Invalid correction response.");
      const body = await verifyResponse(response, secret);
      return { ok: Boolean(body && body.accepted === true) };
    } catch (_) {
      return { ok: false, failOpen: true };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "vault-classifier-classify") return false;
    classify(message.entry)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, failOpen: true }));
    return true;
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "vault-classifier-correct") return false;
    correct(message.ledgerID, message.correction)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, failOpen: true }));
    return true;
  });
})();
