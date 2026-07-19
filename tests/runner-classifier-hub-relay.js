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
let classifierPresent = true;
const connection = {
  primaryStream: "macapp",
  ws: { readyState: 1 },
  status: { state: "connected" },
  targetIsPresent(target) { return target === "classifier" && classifierPresent; },
  send(message) { sent.push(message); return true; }
};
const context = vm.createContext({
  cbConnection: connection,
  WebSocket: { OPEN: 1 },
  TextEncoder,
  setTimeout,
  clearTimeout,
  console,
  VaultClassifierExtensionContract: { randomID: () => "classifier-relay-test" }
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
  const pending = hub.request("collection-info", {});
  await new Promise((resolve) => setImmediate(resolve));
  assert(
    "relays a Classifier request while Mac Vault is the primary stream",
    sent.length === 1 && sent[0].kind === "classifier-request" && sent[0].operation === "collection-info",
    sent
  );
  hub.receive({
    kind: "classifier-response",
    requestID: "classifier-relay-test",
    operation: "collection-info",
    body: { enabledPlatformIDs: ["youtube"] }
  });
  const response = await pending;
  assert("accepts the matching relay response regardless of primary stream", response.enabledPlatformIDs?.[0] === "youtube", response);

  classifierPresent = false;
  try {
    await hub.request("collection-info", {});
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
