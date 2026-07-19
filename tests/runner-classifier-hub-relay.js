/* The one local browser socket must relay Classifier work through Mac Vault. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "background.js"), "utf8");
const start = source.indexOf("const CB_CLASSIFIER_HUB_MAX_PENDING =");
const end = source.indexOf("\nself.CBClassifierHub = cbClassifierHub;", start);
if (start < 0 || end < 0) throw new Error("Could not locate classifier hub.");

const sent = [];
const fallbackSockets = [];
let classifierPresent = true;
let settingsGate = Promise.resolve();
class FakeWebSocket {
  static OPEN = 1;

  constructor(address) {
    this.address = address;
    this.readyState = 0;
    this.sent = [];
    fallbackSockets.push(this);
  }

  send(value) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; }
  open() { this.readyState = FakeWebSocket.OPEN; this.onopen?.(); }
  message(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const connection = {
  primaryStream: "macapp",
  ws: { readyState: FakeWebSocket.OPEN },
  status: { state: "connected" },
  targetIsPresent(target) { return target === "classifier" && classifierPresent; },
  waitForSettings() { return settingsGate; },
  send(message) { sent.push(message); return true; }
};
const context = vm.createContext({
  cbConnection: connection,
  WebSocket: FakeWebSocket,
  CB_FIXED_ADDRESS: "ws://127.0.0.1:8787",
  CB_CONNECTION_PROTOCOL_VERSION: 3,
  cbDetectProgramId: () => "chrome",
  CBBridgeProtocol: { isHubProgram: (value) => value === "macapp" || value === "classifier" },
  TextEncoder,
  setTimeout,
  clearTimeout,
  console,
  VaultClassifierExtensionContract: { randomID: (prefix) => `${prefix}-test` }
});
context.self = context;
vm.runInContext(`${source.slice(start, end)}\nself.__classifierHub = cbClassifierHub;`, context, { filename: "background.js" });
const hub = context.__classifierHub;
let failures = 0;

function assert(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  }
}

(async () => {
  // A collector message can wake an MV3 worker before its asynchronous
  // settings read resolves. It must wait rather than mistaking the initial
  // primaryStream `none` default for the user's explicit Off choice.
  let releaseSettings;
  settingsGate = new Promise((resolve) => { releaseSettings = resolve; });
  connection.primaryStream = "none";
  connection.ws = null;
  connection.status = { state: "off" };
  const startupPending = hub.request("collection-info", {});
  await new Promise((resolve) => setImmediate(resolve));
  assert("waits for service-worker settings before checking the bridge", sent.length === 0 && fallbackSockets.length === 0, { sent, fallbackSockets });
  connection.primaryStream = "macapp";
  connection.ws = { readyState: FakeWebSocket.OPEN };
  connection.status = { state: "connected" };
  classifierPresent = true;
  releaseSettings();
  await new Promise((resolve) => setImmediate(resolve));
  assert("uses the shared relay after service-worker settings resolve", sent.length === 1 && sent[0].kind === "classifier-request", sent);
  hub.receive({
    kind: "classifier-response",
    requestID: "classifier-test",
    operation: "collection-info",
    body: { enabledPlatformIDs: ["youtube"] }
  });
  const startupResponse = await startupPending;
  assert("accepts the post-settings relay response", startupResponse.enabledPlatformIDs?.[0] === "youtube", startupResponse);

  const pending = hub.request("collection-info", {});
  await new Promise((resolve) => setImmediate(resolve));
  assert(
    "relays a Classifier request while Mac Vault is the primary stream",
    sent.length === 2 && sent.at(-1).kind === "classifier-request" && sent.at(-1).operation === "collection-info",
    sent
  );
  hub.receive({
    kind: "classifier-response",
    requestID: "classifier-test",
    operation: "collection-info",
    body: { enabledPlatformIDs: ["youtube"] }
  });
  const response = await pending;
  assert("accepts the matching relay response regardless of primary stream", response.enabledPlatformIDs?.[0] === "youtube", response);

  classifierPresent = false;
  const fallbackPending = hub.request("collection-info", {});
  await new Promise((resolve) => setImmediate(resolve));
  const fallback = fallbackSockets.at(-1);
  fallback.open();
  fallback.message({ kind: "welcome", v: 3, hubProgram: "macapp", peers: [{ program: "classifier", connected: true }] });
  await new Promise((resolve) => setImmediate(resolve));
  assert(
    "uses a temporary fallback socket when the durable worker socket is stale",
    fallback.sent.some((message) => message.kind === "classifier-request" && message.operation === "collection-info"),
    fallback.sent
  );
  fallback.message({
    kind: "classifier-response",
    requestID: "classifier-fallback-test",
    operation: "collection-info",
    body: { enabledPlatformIDs: ["youtube"] }
  });
  const fallbackResponse = await fallbackPending;
  assert("accepts the fallback relay response", fallbackResponse.enabledPlatformIDs?.[0] === "youtube", fallbackResponse);

  try {
    const noPeer = hub.request("collection-info", {});
    await new Promise((resolve) => setImmediate(resolve));
    const rejectedSocket = fallbackSockets.at(-1);
    rejectedSocket.open();
    rejectedSocket.message({ kind: "welcome", v: 3, hubProgram: "macapp", peers: [] });
    await noPeer;
    assert("rejects a hub that has no Classifier peer", false);
  } catch (error) {
    assert("rejects a hub that has no Classifier peer", /unavailable/.test(String(error && error.message)));
  }

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
