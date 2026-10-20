"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "local-hub-auth.js"), "utf8");
const calls = [];
let nativeResponse = { ok: true, proof: "p".repeat(43) };
let manifestVersion = "3.1.5";
const context = vm.createContext({
  CBLocalHubEnvironment: {
    current: {
      name: "development",
      nativeHost: "com.adamancia.vault.local_hub.development"
    }
  },
  chrome: {
    runtime: {
      lastError: null,
      getManifest: () => ({ version: manifestVersion }),
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
  assert("keeps a bounded legacy native connection", proof.proof === "p".repeat(43) && proof.browserIdentity === null);
  assert("requests native browser attestation", calls[0]?.message?.browserIdentityVersion === 1);
  const attestation = { v: 1, kind: "mac-bundle-id", value: "com.brave.browser", proof: "b".repeat(43) };
  nativeResponse = { ok: true, proof: "p".repeat(43), browserIdentityVersion: 1, browserIdentity: attestation };
  const credentials = await context.CBLocalHubAuthentication.proofForChallenge("chrome", "c".repeat(43));
  assert("forwards native Brave identity without replacing it with Chrome", credentials.browserIdentity.value === "com.brave.browser" && credentials.browserIdentity.proof === attestation.proof);
  attestation.value = "com.google.chrome";
  assert("retains an immutable copy across later response mutation", credentials.browserIdentity.value === "com.brave.browser" && Object.isFrozen(credentials.browserIdentity));
  async function refuses(name, response, version = "3.1.5", browser = "chrome") {
    nativeResponse = response; manifestVersion = version;
    try { await context.CBLocalHubAuthentication.proofForChallenge(browser, "c".repeat(43)); assert(name, false); }
    catch (_) { assert(name, true); }
    manifestVersion = "3.1.5";
  }
  const signed = (changes = {}) => ({ ok: true, proof: "p".repeat(43), browserIdentityVersion: 1,
    browserIdentity: { v: 1, kind: "mac-bundle-id", value: "com.google.chrome", proof: "b".repeat(43), ...changes } });
  await refuses("capability without identity does not downgrade", { ok: true, proof: "p".repeat(43), browserIdentityVersion: 1 });
  await refuses("identity without capability does not downgrade", { ok: true, proof: "p".repeat(43), browserIdentity: signed().browserIdentity });
  for (const v of [true, 1.5, "1", 2]) await refuses(`rejects descriptor version ${JSON.stringify(v)}`, signed({ v }));
  await refuses("rejects unrecognized identity fields", signed({ unchecked: "claim" }));
  await refuses("rejects noncanonical bundle identity", signed({ value: "com.google.Chrome" }));
  await refuses("rejects newline identity injection", signed({ value: "com.google.chrome\nkind=other" }));
  await refuses("rejects oversized identity", signed({ value: "a".repeat(256) }));
  await refuses("rejects malformed identity proof", signed({ proof: "b".repeat(42) }));
  await refuses("rejects trailing newline in identity proof", signed({ proof: "b".repeat(43) + "\n" }));
  await refuses("identity cannot replace the base proof", { ...signed(), proof: null });
  nativeResponse = signed({ kind: "windows-exe-sha256", value: "0".repeat(64) });
  assert("forwards a native Windows executable digest", (await context.CBLocalHubAuthentication.proofForChallenge("edge", "c".repeat(43))).browserIdentity.value === "0".repeat(64));
  await refuses("rejects Windows identity for Safari", { ...nativeResponse, environment: "development" }, "3.1.5", "safari");
  nativeResponse = { ok: true, proof: "p".repeat(43) }; manifestVersion = "4.0.0";
  assert("legacy remains supported through the next major", (await context.CBLocalHubAuthentication.proofForChallenge("chrome", "c".repeat(43))).browserIdentity === null);
  await refuses("legacy retires in the following major", nativeResponse, "5.0.0");
  await refuses("legacy before the published 3.1.0 baseline is unsupported", nativeResponse, "3.0.9");
  await refuses("earlier majors are unsupported", nativeResponse, "2.9.9");
  manifestVersion = "3.1.0";
  assert("published 3.1.0 remains the supported baseline", (await context.CBLocalHubAuthentication.proofForChallenge("chrome", "c".repeat(43))).browserIdentity === null);
  await refuses("unknown app version cannot extend legacy support", nativeResponse, "unknown");
  manifestVersion = "5.0.0"; nativeResponse = signed();
  assert("attested authentication survives legacy retirement", (await context.CBLocalHubAuthentication.proofForChallenge("chrome", "c".repeat(43))).browserIdentity.v === 1);
  manifestVersion = "3.1.5";
  try {
    await context.CBLocalHubAuthentication.proofForChallenge("firefox", "c".repeat(43));
    assert("rejects browsers without the Chromium bootstrap", false);
  } catch (_) {
    assert("rejects browsers without the Chromium bootstrap", true);
  }
  nativeResponse = { ok: true, proof: "s".repeat(43), environment: "development" };
  const safariProof = await context.CBLocalHubAuthentication.proofForChallenge("safari", "s".repeat(43));
  assert("Safari uses native challenge proof", safariProof.proof === "s".repeat(43) && calls.at(-1)?.message?.program === "safari");
  manifestVersion = "5.0.0";
  try {
    const futureSafari = await context.CBLocalHubAuthentication.proofForChallenge("safari", "s".repeat(43));
    assert("Safari ordinary association survives extra identity retirement", futureSafari.proof === "s".repeat(43) && futureSafari.browserIdentity === null);
  } catch (_) { assert("Safari ordinary association survives extra identity retirement", false); }
  const ordinarySafari = { ok: true, proof: "s".repeat(43), environment: "development" };
  await refuses("future Safari still requires the base proof", { ...ordinarySafari, proof: undefined }, "5.0.0", "safari");
  await refuses("future Safari rejects malformed base proof", { ...ordinarySafari, proof: "!".repeat(43) }, "5.0.0", "safari");
  await refuses("future Safari rejects capability without identity", { ...ordinarySafari, browserIdentityVersion: 1 }, "5.0.0", "safari");
  await refuses("future Safari rejects identity without capability", { ...ordinarySafari, browserIdentity: signed().browserIdentity }, "5.0.0", "safari");
  await refuses("future Safari rejects malformed provided identity", { ...signed({ v: true }), environment: "development" }, "5.0.0", "safari");
  await refuses("future Safari refuses native environment mismatch", { ...ordinarySafari, environment: "production" }, "5.0.0", "safari");
  manifestVersion = "3.1.5";
  nativeResponse = { ok: true, proof: "s".repeat(43), environment: "production" };
  try {
    await context.CBLocalHubAuthentication.proofForChallenge("safari", "s".repeat(43));
    assert("Safari refuses native environment mismatch", false);
  } catch (_) { assert("Safari refuses native environment mismatch", true); }
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
