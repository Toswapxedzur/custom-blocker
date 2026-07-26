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
let startupGate = Promise.resolve();
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
  ws: { readyState: FakeWebSocket.OPEN },
  status: { state: "connected" },
  targetIsPresent(target) { return target === "classifier" && classifierPresent; },
  waitForStartup() { return startupGate; },
  sendWS(message) { sent.push(message); return true; }
};
const context = vm.createContext({
  cbConnection: connection,
  WebSocket: FakeWebSocket,
  CB_FIXED_ADDRESS: "ws://127.0.0.1:8787",
  CB_CONNECTION_PROTOCOL_VERSION: 4,
  cbDetectProgramId: () => "chrome",
  CBLocalHubAuthentication: { proofForChallenge: async () => "a".repeat(43) },
  CBBridgeProtocol: { isHubProgram: (value) => value === "macapp" || value === "classifier" },
  TextEncoder,
  setTimeout,
  clearTimeout,
  console,
  VaultClassifierExtensionContract: { randomID: (prefix) => `${prefix}-test` }
});
context.self = context;
vm.runInContext(
  `${source.slice(start, end)}\nself.__classifierHub = cbClassifierHub;\nself.__classifierHubTimeoutMs = CB_CLASSIFIER_HUB_TIMEOUT_MS;`,
  context,
  { filename: "background.js" }
);
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
  assert(
    "browser timeout leaves a response margin after the native relay expires",
    context.__classifierHubTimeoutMs === 32_000,
    context.__classifierHubTimeoutMs
  );

  // A collector message can wake an MV3 worker while its automatic transport
  // is starting. It waits for that startup rather than creating a second
  // durable socket.
  let releaseStartup;
  startupGate = new Promise((resolve) => { releaseStartup = resolve; });
  connection.ws = null;
  connection.status = { state: "connecting" };
  const startupPending = hub.request("collection-info", {});
  await new Promise((resolve) => setImmediate(resolve));
  assert("waits for automatic service-worker transport startup", sent.length === 0 && fallbackSockets.length === 0, { sent, fallbackSockets });
  connection.ws = { readyState: FakeWebSocket.OPEN };
  connection.status = { state: "connected" };
  classifierPresent = true;
  releaseStartup();
  await new Promise((resolve) => setImmediate(resolve));
  assert("uses the shared relay after automatic transport starts", sent.length === 1 && sent[0].kind === "classifier-request", sent);
  hub.receive({
    kind: "classifier-response",
    requestID: "classifier-test",
    operation: "collection-info",
    body: { enabledPlatformIDs: ["youtube"] }
  });
  const startupResponse = await startupPending;
  assert("accepts the post-startup relay response", startupResponse.enabledPlatformIDs?.[0] === "youtube", startupResponse);

  const pending = hub.request("collection-info", {});
  await new Promise((resolve) => setImmediate(resolve));
  assert(
    "relays a Classifier request while Mac Vault hosts the shared socket",
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
  assert("accepts the matching shared relay response", response.enabledPlatformIDs?.[0] === "youtube", response);

  const tagPending = hub.request("source-tags", {
    platformID: "youtube",
    sourceID: "youtube:channel:UC123"
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert(
    "allows the bounded source-tag operation on the shared classifier relay",
    sent.length === 3 && sent.at(-1).operation === "source-tags",
    sent
  );
  hub.receive({
    kind: "classifier-response",
    requestID: "classifier-test",
    operation: "source-tags",
    body: {
      platformID: "youtube",
      sourceID: "youtube:channel:UC123",
      tags: [{
        id: "games",
        name: "Games",
        lightColorHex: "#9EC5E8",
        darkColorHex: "#1A4775"
      }]
    }
  });
  const tagResponse = await tagPending;
  assert("returns the matching paired-color source-tag relay response", tagResponse.tags?.[0]?.name === "Games"
    && tagResponse.tags?.[0]?.lightColorHex === "#9EC5E8"
    && tagResponse.tags?.[0]?.darkColorHex === "#1A4775", tagResponse);

  classifierPresent = false;
  const fallbackPending = hub.request("collection-info", {});
  await new Promise((resolve) => setImmediate(resolve));
  const fallback = fallbackSockets.at(-1);
  fallback.open();
  fallback.message({ kind: "challenge", v: 4, challenge: "c".repeat(43) });
  await new Promise((resolve) => setImmediate(resolve));
  assert("authenticates the fallback socket with a native-host challenge proof", fallback.sent.some((message) => message.kind === "hello" && message.proof === "a".repeat(43)), fallback.sent);
  fallback.message({ kind: "welcome", v: 4, hubProgram: "macapp", peers: [{ program: "classifier", connected: true }] });
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
    rejectedSocket.message({ kind: "challenge", v: 4, challenge: "d".repeat(43) });
    await new Promise((resolve) => setImmediate(resolve));
    rejectedSocket.message({ kind: "welcome", v: 4, hubProgram: "macapp", peers: [] });
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
