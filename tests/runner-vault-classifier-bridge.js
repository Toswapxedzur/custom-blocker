/* Native-bridge integration tests with a deterministic MV3/native-host mock. */
"use strict";

const crypto = require("node:crypto").webcrypto;
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const secretBytes = new Uint8Array(32).fill(7);
const secretBase64 = Buffer.from(secretBytes).toString("base64");
const storage = {
  vaultClassifierSettings: { enabled: false, policyID: "clash-royale-focus", feedHardBlock: false },
  vaultClassifierPairingSecret: secretBase64,
  vaultClassifierClientID: "extension-test-client-000001"
};
const listeners = [];
let nativeCalls = 0;
let activeNativeCalls = 0;
let maximumActiveNativeCalls = 0;
let responseCounter = 0;
let tamperNextResponse = false;

function makePort() {
  let onMessage = null;
  return {
    onMessage: { addListener(listener) { onMessage = listener; } },
    onDisconnect: { addListener() {} },
    postMessage(envelope) {
      nativeCalls++;
      activeNativeCalls++;
      maximumActiveNativeCalls = Math.max(maximumActiveNativeCalls, activeNativeCalls);
      setTimeout(async () => {
        const response = await signedClassificationResponse(envelope, tamperNextResponse);
        tamperNextResponse = false;
        context.__nativeResponse = JSON.stringify(response);
        // Native messaging serializes JSON. Recreate it in the service-worker
        // realm so the strict plain-object guards see the browser shape.
        onMessage(vm.runInContext("JSON.parse(__nativeResponse)", context));
        activeNativeCalls--;
      }, 8);
    }
  };
}

const chrome = {
  runtime: {
    id: "vault-classifier-test-extension",
    lastError: null,
    connectNative(name) {
      if (name !== "com.adamancia.vault_classifier") throw new Error("unexpected native host");
      return makePort();
    },
    onMessage: { addListener(listener) { listeners.push(listener); } }
  },
  storage: {
    local: {
      get(keys, callback) {
        const result = {};
        const requested = Array.isArray(keys) ? keys : [keys];
        for (const key of requested) result[key] = storage[key];
        callback(result);
      },
      set(values, callback) {
        Object.assign(storage, values);
        callback();
      }
    },
    onChanged: { addListener() {} }
  }
};

const context = vm.createContext({
  console,
  chrome,
  crypto,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  setTimeout,
  clearTimeout,
  btoa(value) { return Buffer.from(value, "binary").toString("base64"); },
  atob(value) { return Buffer.from(value, "base64").toString("binary"); }
});
context.self = context;
context.globalThis = context;

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-bridge.js"), "utf8"), context, { filename: "vault-classifier-bridge.js" });

function hex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function base64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function signedClassificationResponse(request, tamper) {
  const body = {
    result: {
      selectedLeafTagIDs: ["content.entities.clash-royale"],
      decisions: [{ policyID: "clash-royale-focus", action: "block", matchedTagIDs: ["content.entities.clash-royale"], explanation: "Matched local focus policy." }]
    },
    ledgerID: "00000000-0000-4000-8000-000000000001"
  };
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const nonce = new Uint8Array(18);
  nonce[17] = ++responseCounter;
  const response = {
    protocolVersion: 1,
    kind: "classification-response",
    requestID: request.requestID,
    timestampMilliseconds: Date.now(),
    nonce: base64(nonce),
    bodyBase64: base64(bytes),
    bodyHash: hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))),
    mac: null
  };
  const canonical = `v=${response.protocolVersion}\nkind=${response.kind}\nid=${response.requestID}\nts=${response.timestampMilliseconds}\nnonce=${response.nonce}\nbody=${response.bodyHash}`;
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  response.mac = base64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical))));
  if (tamper) response.mac = `${response.mac[0] === "A" ? "B" : "A"}${response.mac.slice(1)}`;
  return response;
}

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
  assert("rejects non-YouTube runtime senders before native messaging", !rejected.waiting && nativeCalls === 0);

  const disabled = await dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Disabled setting") }, trustedSender);
  assert("fails open while the local feature is disabled", disabled.waiting && disabled.value && disabled.value.ok === false && disabled.value.failOpen === true && nativeCalls === 0);

  storage.vaultClassifierSettings = { enabled: true, policyID: "clash-royale-focus", feedHardBlock: false };
  const duplicated = await Promise.all([
    dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Duplicate visible card") }, trustedSender),
    dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Duplicate visible card") }, trustedSender)
  ]);
  assert("coalesces identical concurrent card classifications", nativeCalls === 1 && duplicated.every((item) => item.value && item.value.ok === true && item.value.action === "dim"), { nativeCalls, duplicated });

  nativeCalls = 0;
  activeNativeCalls = 0;
  maximumActiveNativeCalls = 0;
  const distinct = await Promise.all(Array.from({ length: 10 }, (_, index) => dispatch(
    { type: "vault-classifier-classify", entry: entry(`dQw4w9Wg${String(index).padStart(2, "0")}`, `Visible card ${index}`) },
    trustedSender
  )));
  assert("bounds distinct native classifications to the local concurrency budget", nativeCalls === 10 && maximumActiveNativeCalls <= 4 && distinct.every((item) => item.value && item.value.ok === true), { nativeCalls, maximumActiveNativeCalls, responses: distinct.map((item) => item.value) });

  tamperNextResponse = true;
  const tampered = await dispatch({ type: "vault-classifier-classify", entry: entry("dQw4w9WgXcQ", "Tampered response") }, trustedSender);
  assert("fails open on a response with an invalid HMAC", tampered.value && tampered.value.ok === false && tampered.value.failOpen === true);

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
