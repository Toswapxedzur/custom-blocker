/* Shared-localhost-hub integration tests for the Vault Classifier adapter. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const storage = {
  vaultClassifierSettings: { enabled: false, policyID: "clash-royale-focus", feedHardBlock: false }
};
const listeners = [];
let hubCalls = 0;
let activeHubCalls = 0;
let maximumActiveHubCalls = 0;
let invalidNextResult = false;
let hubAvailable = true;

const hub = {
  request(operation, body) {
    if (!hubAvailable) return Promise.reject(new Error("shared hub unavailable"));
    hubCalls++;
    activeHubCalls++;
    maximumActiveHubCalls = Math.max(maximumActiveHubCalls, activeHubCalls);
    return new Promise((resolve) => setTimeout(() => {
      activeHubCalls--;
      if (operation === "bridge-info") {
        resolve(inExtensionRealm({ policies: [{ id: "clash-royale-focus", name: "Clash Royale focus" }] }));
        return;
      }
      if (operation === "collection-info") {
        resolve(inExtensionRealm({ enabledPlatformIDs: ["youtube"] }));
        return;
      }
      if (operation === "collect") {
        resolve(inExtensionRealm({ accepted: true, inserted: true }));
        return;
      }
      if (operation === "correct") {
        resolve(inExtensionRealm({ accepted: true }));
        return;
      }
      if (invalidNextResult) {
        invalidNextResult = false;
        resolve(inExtensionRealm({ result: { malformed: true } }));
        return;
      }
      resolve(inExtensionRealm({
        result: {
          selectedLeafTagIDs: ["content.entities.clash-royale"],
          decisions: [{ policyID: "clash-royale-focus", action: "block", matchedTagIDs: ["content.entities.clash-royale"], explanation: "Matched local focus policy." }]
        },
        ledgerID: "00000000-0000-4000-8000-000000000001"
      }));
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
  CBClassifierHub: hub
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

const trustedSender = { id: "vault-classifier-test-extension", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
const untrustedSender = { id: "vault-classifier-test-extension", url: "https://youtube.com.evil/watch?v=dQw4w9WgXcQ" };
let failures = 0;

function assert(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else { failures++; console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`); }
}

(async () => {
  const rejected = await dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Untrusted sender") }, untrustedSender);
  assert("rejects non-YouTube runtime senders before the shared hub", !rejected.waiting && hubCalls === 0);

  const untrustedBridgeInfo = await dispatch({ type: "vault-classifier-bridge-policies" }, { id: "another-extension" });
  assert("rejects policy inventory requests outside the extension", !untrustedBridgeInfo.waiting && hubCalls === 0);

  const bridgeInfo = await dispatch({ type: "vault-classifier-bridge-policies" }, { id: "vault-classifier-test-extension" });
  assert("loads the bounded named policy inventory through the shared hub", bridgeInfo.waiting && bridgeInfo.value && bridgeInfo.value.ok === true && bridgeInfo.value.policies.length === 1 && bridgeInfo.value.policies[0].id === "clash-royale-focus", bridgeInfo);
  hubCalls = 0;

  const untrustedCollection = await dispatch({ type: "vault-classifier-collect", entry: entry("dQw4w9WgXcQ", "Untrusted collection") }, untrustedSender);
  assert("rejects collection from a non-YouTube runtime sender", !untrustedCollection.waiting && hubCalls === 0);

  const collectionInfo = await dispatch({ type: "vault-classifier-collection-info" }, trustedSender);
  assert("reads the app-owned collection opt-in before sending page metadata", collectionInfo.waiting && collectionInfo.value && collectionInfo.value.ok === true && collectionInfo.value.enabled === true && hubCalls === 1, collectionInfo);

  const collected = await dispatch({ type: "vault-classifier-collect", entry: entry("dQw4w9WgXcQ", "Visible non-ad card") }, trustedSender);
  assert("sends one bounded rendered entry only after opt-in", collected.waiting && collected.value && collected.value.accepted === true && hubCalls === 2, collected);
  hubCalls = 0;

  const disabled = await dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Disabled setting") }, trustedSender);
  assert("fails open while the local feature is disabled", disabled.waiting && disabled.value && disabled.value.ok === false && disabled.value.failOpen === true && hubCalls === 0);

  storage.vaultClassifierSettings = { enabled: true, policyID: "clash-royale-focus", feedHardBlock: false };
  const duplicated = await Promise.all([
    dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Duplicate visible card") }, trustedSender),
    dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Duplicate visible card") }, trustedSender)
  ]);
  assert("coalesces identical concurrent shared-hub classifications", hubCalls === 1 && duplicated.every((item) => item.value && item.value.ok === true && item.value.action === "dim"), { hubCalls, duplicated });

  hubCalls = 0;
  activeHubCalls = 0;
  maximumActiveHubCalls = 0;
  const distinct = await Promise.all(Array.from({ length: 10 }, (_, index) => dispatch(
    { type: "vault-classifier-classify", entry: entry(`dQw4w9Wg${String(index).padStart(2, "0")}`, `Visible card ${index}`) }, trustedSender
  )));
  assert("bounds distinct shared-hub classifications to the local concurrency budget", hubCalls === 10 && maximumActiveHubCalls <= 4 && distinct.every((item) => item.value && item.value.ok === true), { hubCalls, maximumActiveHubCalls, responses: distinct.map((item) => item.value) });

  invalidNextResult = true;
  const malformed = await dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Malformed response") }, trustedSender);
  assert("fails open on an invalid shared-hub classifier response", malformed.value && malformed.value.ok === false && malformed.value.failOpen === true);

  hubAvailable = false;
  const unavailable = await dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Unavailable bridge") }, trustedSender);
  assert("fails open when the shared hub is unavailable", unavailable.value && unavailable.value.ok === false && unavailable.value.failOpen === true);

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
