"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");
const start = source.indexOf("const cbConnection = {");
const end = source.indexOf("\n};", start) + 3;
if (start < 0 || end < 3) throw new Error("Missing connection implementation");
let failures = 0;
function assert(name, passed) {
  console[passed ? "log" : "error"](`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) failures++;
}
function connection(credentials, legacy = true, program = "chrome") {
  const sent = [];
  const socket = { readyState: 1, send(value) { sent.push(JSON.parse(value)); } };
  const context = vm.createContext({
    CB_FIXED_ADDRESS: "ws://127.0.0.1:18787", CB_CONNECTION_PROTOCOL_VERSION: 4, CB_CONNECTION_PING_MS: 10000,
    WebSocket: { OPEN: 1 }, cbDetectProgramId: () => program, cbJoinsSent: new Set(),
    CBLocalHubAuthentication: { proofForChallenge: async () => credentials,
      legacyAuthenticationAllowed: () => legacy },
    CBBridgeProtocol: { isHubProgram: p => p === "macapp" },
    setInterval: () => 1, clearInterval() {}, clearTimeout() {}, console
  });
  context.self = context;
  vm.runInContext(source.slice(start, end) + "\nself.connection = cbConnection;", context);
  const client = context.connection;
  let closed = 0;
  client.clearTimers = () => {};
  client.closeSocket = () => { closed++; client.ws = null; };
  client.scheduleSlowRetry = () => {};
  client.setStatus = patch => { client.status = { ...client.status, ...patch }; };
  client.ws = socket;
  return { client, context, sent, get closed() { return closed; } };
}

(async () => {
  const identity = { v: 1, kind: "mac-bundle-id", value: "com.brave.browser", proof: "b".repeat(43) };
  const fresh = connection({ proof: "p".repeat(43), browserIdentity: identity });
  fresh.client.answerChallenge("c".repeat(43));
  await new Promise(resolve => setImmediate(resolve));
  assert("hello retains v4 base proof and forwards exact native Brave attestation",
    fresh.sent.length === 1 && fresh.sent[0].v === 4 && fresh.sent[0].proof === "p".repeat(43)
    && fresh.sent[0].originalUsageVersion === 1 && typeof fresh.sent[0].originalUsageVersion === "number"
    && fresh.sent[0].browserIdentityVersion === 1
    && JSON.stringify(fresh.sent[0].browserIdentity) === JSON.stringify(identity));
  const old = connection({ proof: "p".repeat(43), browserIdentity: null });
  old.client.answerChallenge("c".repeat(43));
  await new Promise(resolve => setImmediate(resolve));
  assert("ordinary v4 hello declares original-usage capability independently of identity", old.sent.length === 1
    && old.sent[0].originalUsageVersion === 1 && typeof old.sent[0].originalUsageVersion === "number"
    && !Object.hasOwn(old.sent[0], "browserIdentity") && !Object.hasOwn(old.sent[0], "browserIdentityVersion"));
  const edge = connection({ proof: "e".repeat(43), browserIdentity: null }, true, "edge");
  edge.client.answerChallenge("c".repeat(43));
  await new Promise(resolve => setImmediate(resolve));
  assert("Edge declares the independent original-usage capability without changing base proof", edge.sent.length === 1
    && edge.sent[0].program === "edge" && edge.sent[0].originalUsageVersion === 1 && edge.sent[0].proof === "e".repeat(43));
  old.client.handleMessage({ kind: "welcome", v: 4, hubProgram: "macapp" });
  assert("bounded legacy hub remains usable", old.client.status.state === "connected" && old.closed === 0);
  const retired = connection({ proof: "p".repeat(43), browserIdentity: identity }, false);
  retired.client.handleMessage({ kind: "welcome", v: 4, hubProgram: "macapp" });
  assert("retired legacy hub gives upgrade requirement and closes", retired.client.status.error === "browser-identity-upgrade-required"
    && retired.closed === 1 && retired.client.handshakeComplete === false);
  const supported = connection({ proof: "p".repeat(43), browserIdentity: identity }, false);
  supported.client.handleMessage({ kind: "welcome", v: 4, hubProgram: "macapp", browserIdentityVersion: 1 });
  assert("attested-capable hub remains usable after retirement", supported.client.status.state === "connected");
  const invalid = connection(null);
  invalid.context.CBLocalHubAuthentication.proofForChallenge = async () => { throw Object.assign(new Error("invalid"), { code: "invalid-browser-identity" }); };
  invalid.client.answerChallenge("c".repeat(43));
  await new Promise(resolve => setImmediate(resolve));
  assert("invalid attestation closes without sending hello or downgrading", invalid.sent.length === 0
    && invalid.closed === 1 && invalid.client.status.error === "invalid-browser-identity");
  for (const [name, response, succeeds] of [
    ["ordinary", { ok: true, proof: "s".repeat(43), environment: "development" }, true],
    ["missing base proof", { ok: true, environment: "development" }, false],
    ["malformed base proof", { ok: true, proof: "!".repeat(43), environment: "development" }, false],
    ["partial identity", { ok: true, proof: "s".repeat(43), environment: "development", browserIdentityVersion: 1 }, false]
  ]) {
    const safari = connection(null, false, "safari");
    safari.context.chrome = { runtime: { getManifest: () => ({ version: "5.0.0" }), lastError: null, sendNativeMessage: () => Promise.resolve(response) } };
    safari.context.CBLocalHubEnvironment = { current: { name: "development", nativeHost: "test.fixture" } };
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "local-hub-auth.js"), "utf8"), safari.context);
    safari.client.answerChallenge("c".repeat(43));
    await new Promise(resolve => setImmediate(resolve));
    assert(`future Safari ${name} through actual authentication and hello transport`, succeeds
      ? safari.sent.length === 1 && safari.sent[0].program === "safari" && safari.sent[0].proof === response.proof && safari.sent[0].originalUsageVersion === 1
        && !Object.hasOwn(safari.sent[0], "browserIdentity") && !Object.hasOwn(safari.sent[0], "browserIdentityVersion")
      : safari.sent.length === 0 && safari.closed === 1);
    if (succeeds) {
      safari.client.handleMessage({ kind: "welcome", v: 4, hubProgram: "macapp" });
      assert("future ordinary Safari accepts authenticated v4 welcome without extra identity capability", safari.client.status.state === "connected" && safari.closed === 0);
    }
  }
  const wrongSafariProtocol = connection({ proof: "s".repeat(43), browserIdentity: null }, false, "safari");
  wrongSafariProtocol.client.handleMessage({ kind: "welcome", v: 3, hubProgram: "macapp" });
  assert("Safari ordinary association still rejects protocol downgrade", wrongSafariProtocol.client.status.error === "protocol-mismatch" && wrongSafariProtocol.closed === 1);
  let release;
  const stale = connection(null);
  stale.context.CBLocalHubAuthentication.proofForChallenge = () => new Promise(resolve => { release = resolve; });
  stale.client.answerChallenge("c".repeat(43));
  stale.client.ws = { readyState: 1, send() { throw new Error("stale proof reused"); } };
  release({ proof: "p".repeat(43), browserIdentity: identity });
  await new Promise(resolve => setImmediate(resolve));
  assert("proof from replaced socket is discarded", stale.sent.length === 0 && stale.closed === 0);
  console.log(`__CB_TEST_RESULT__: ${failures ? "FAIL" : "OK"} (${failures} failures)`);
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
