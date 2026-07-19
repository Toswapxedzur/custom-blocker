/* Shared-localhost-hub integration tests for the Vault Classifier adapter. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const storage = {
  vaultClassifierSettings: {}
};
const listeners = [];
let hubCalls = 0;
const diagnostics = [];

const hub = {
  request(operation, body) {
    hubCalls++;
    return new Promise((resolve) => setTimeout(() => {
      if (operation === "collection-info") {
        resolve(inExtensionRealm({ enabledPlatformIDs: ["youtube", "reddit"] }));
        return;
      }
      if (operation === "collect") {
        resolve(inExtensionRealm({ accepted: true, inserted: true }));
        return;
      }
      if (operation === "diagnostic") {
        resolve(inExtensionRealm({ accepted: true }));
        return;
      }
      resolve(inExtensionRealm({ accepted: false, inserted: false }));
    }, 8));
  }
};

const chrome = {
  runtime: {
    id: "vault-classifier-test-extension",
    lastError: null,
    onMessage: { addListener(listener) { listeners.push(listener); } }
  },
  storage: {
    local: {
      get(keys, callback) {
        const result = {};
        const requested = Array.isArray(keys) ? keys : [keys];
        for (const key of requested) result[key] = storage[key];
        callback(result);
      }
    },
    onChanged: { addListener() {} }
  }
};

const context = vm.createContext({
  console,
  chrome,
  TextEncoder,
  setTimeout,
  clearTimeout,
  CBClassifierHub: hub,
  CBRecordVaultClassifierDiagnostic(entry) { diagnostics.push(entry); }
});
context.self = context;
context.globalThis = context;

function inExtensionRealm(value) {
  context.__hubResponse = JSON.stringify(value);
  return vm.runInContext("JSON.parse(__hubResponse)", context);
}

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-bridge.js"), "utf8"), context, { filename: "vault-classifier-bridge.js" });

function dispatch(message, sender) {
  return new Promise((resolve, reject) => {
    let waiting = false;
    let settled = false;
    const timer = setTimeout(() => reject(new Error("bridge test message timed out")), 1_500);
    const respond = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ waiting, value });
    };
    for (const listener of listeners) {
      if (listener(message, sender, respond) === true) waiting = true;
    }
    if (!waiting) {
      settled = true;
      clearTimeout(timer);
      resolve({ waiting: false, value: undefined });
    }
  });
}

function entry(id, title) {
  return {
    platform: "youtube",
    entryID: `youtube:video:${id}`,
    sourceID: "youtube:channel:UC1234567890123456789012",
    surface: "feed",
    evidence: { title, metadata: { sourceName: "Local test channel" } }
  };
}

function redditEntry(id, title) {
  return {
    platform: "reddit",
    entryID: `reddit:content:${id}`,
    sourceID: "reddit:creator:gaming",
    surface: "feed",
    evidence: { title, metadata: { sourceName: "r/gaming", entryType: "post", canonicalURL: `https://www.reddit.com/r/gaming/comments/${id}/post/` } }
  };
}

const trustedSender = { id: "vault-classifier-test-extension", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
const untrustedSender = { id: "vault-classifier-test-extension", url: "https://youtube.com.evil/watch?v=dQw4w9WgXcQ" };
const trustedRedditSender = { id: "vault-classifier-test-extension", url: "https://www.reddit.com/r/gaming/" };
let failures = 0;

function assert(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else { failures++; console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`); }
}

(async () => {
  const untrustedCollection = await dispatch({ type: "vault-classifier-collect", entry: entry("dQw4w9WgXcQ", "Untrusted collection") }, untrustedSender);
  assert("rejects collection from a non-YouTube runtime sender", !untrustedCollection.waiting && hubCalls === 0);

  const collectionInfo = await dispatch({ type: "vault-classifier-collection-info" }, trustedSender);
  assert("browser collection defaults on when the app enables YouTube", collectionInfo.waiting && collectionInfo.value && collectionInfo.value.ok === true && collectionInfo.value.enabled === true && hubCalls === 1, collectionInfo);

  const collected = await dispatch({ type: "vault-classifier-collect", entry: entry("dQw4w9WgXcQ", "Visible non-ad card") }, trustedSender);
  assert("sends one bounded rendered entry only after opt-in", collected.waiting && collected.value && collected.value.accepted === true && hubCalls === 2, collected);
  const diagnostic = await dispatch({ type: "vault-classifier-diagnostic", platform: "youtube", event: "collector-started" }, trustedSender);
  assert("forwards a fixed content-collector diagnostic without page metadata", diagnostic.waiting && diagnostic.value?.accepted === true && hubCalls === 3 && diagnostics.some((entry) => entry.event === "collector-started" && entry.platform === "youtube"), { diagnostic, diagnostics });
  const forgedDiagnostic = await dispatch({ type: "vault-classifier-diagnostic", platform: "youtube", event: "raw-page-title" }, trustedSender);
  assert("rejects diagnostic text outside the fixed privacy-safe vocabulary", !forgedDiagnostic.waiting && hubCalls === 3, forgedDiagnostic);
  hubCalls = 0;

  const redditCollectionInfo = await dispatch({ type: "vault-classifier-collection-info", platform: "reddit" }, trustedRedditSender);
  assert("reads a non-YouTube app-owned collection opt-in only from that platform", redditCollectionInfo.waiting && redditCollectionInfo.value && redditCollectionInfo.value.enabled === true && hubCalls === 1, redditCollectionInfo);
  const redditCollected = await dispatch({ type: "vault-classifier-collect", entry: redditEntry("123", "Visible Reddit card") }, trustedRedditSender);
  assert("routes a bounded non-YouTube collected entry through the shared hub", redditCollected.waiting && redditCollected.value && redditCollected.value.accepted === true && hubCalls === 2, redditCollected);
  const mismatchedCollection = await dispatch({ type: "vault-classifier-collect", entry: redditEntry("124", "Forged platform") }, trustedSender);
  assert("rejects a collection platform that does not match the sender origin", !mismatchedCollection.waiting && hubCalls === 2, mismatchedCollection);
  hubCalls = 0;

  const removedPolicyBridge = await dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "No browser policy") }, trustedSender);
  assert("does not expose browser-side classifier policy actions", !removedPolicyBridge.waiting && hubCalls === 0, removedPolicyBridge);

  storage.vaultClassifierSettings = { collectionEnabled: false };
  const collectionDisabled = await dispatch({ type: "vault-classifier-collection-info" }, trustedSender);
  assert("browser-side collection opt-out prevents metadata routing before the shared hub", collectionDisabled.waiting && collectionDisabled.value && collectionDisabled.value.ok === true && collectionDisabled.value.enabled === false && hubCalls === 0, collectionDisabled);

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
