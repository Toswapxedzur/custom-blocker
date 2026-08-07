"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "local-hub-auth.js"), "utf8");
const calls = [];
let nativeResponse = { ok: true, proof: "p".repeat(43) };
const context = vm.createContext({
  CBLocalHubEnvironment: {
    current: {
      nativeHost: "com.adamancia.vault.local_hub.development"
    }
  },
  chrome: {
    runtime: {
      lastError: null,
      sendNativeMessage(host, message) {
        calls.push({ host, message });
        return Promise.resolve(nativeResponse);
      }
    }
  },
  Promise,
  Error
});
context.self = context;
vm.runInContext(source, context, { filename: "local-hub-auth.js" });

let failures = 0;
function assert(name, ok, detail) {
  if (ok) console.log(`PASS ${name}`);
  else { failures += 1; console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`); }
}

(async () => {
  const proof = await context.CBLocalHubAuthentication.proofForChallenge("chrome", "c".repeat(43));
  assert("uses the environment-specific native host", calls[0]?.host === "com.adamancia.vault.local_hub.development", calls);
  assert("sends only a fresh bounded challenge", calls[0]?.message?.kind === "local-hub-challenge" && calls[0]?.message?.v === 4 && calls[0]?.message?.challenge === "c".repeat(43) && !Object.hasOwn(calls[0]?.message || {}, "secret"), calls);
  assert("returns the native host proof", proof === "p".repeat(43));
  try {
    await context.CBLocalHubAuthentication.proofForChallenge("firefox", "c".repeat(43));
    assert("rejects browsers without the Chromium bootstrap", false);
  } catch (_) {
    assert("rejects browsers without the Chromium bootstrap", true);
  }
  nativeResponse = { ok: false };
  try {
    await context.CBLocalHubAuthentication.proofForChallenge("chrome", "d".repeat(43));
    assert("rejects an unavailable host response", false);
  } catch (_) {
    assert("rejects an unavailable host response", true);
  }
  context.CBLocalHubEnvironment.current = null;
  try {
    await context.CBLocalHubAuthentication.proofForChallenge("chrome", "e".repeat(43));
    assert("rejects an unrecognized extension environment", false);
  } catch (_) {
    assert("rejects an unrecognized extension environment", true);
  }
  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
