/* Per-target status tests for the one-socket local Vault hub. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "background.js"), "utf8");
const start = source.indexOf("const cbConnection = {");
const end = source.indexOf("\n};\n\n// Classifier requests share", start);
if (start < 0 || end < 0) throw new Error("Could not locate cbConnection.");

const storage = {
  globalSettings: { connection: { clientEnabled: false } },
  vaultClassifierSettings: { connectionEnabled: false }
};
const pushes = [];
let failures = 0;

const chrome = {
  runtime: {
    sendMessage(message) {
      pushes.push(message);
      return Promise.resolve();
    }
  },
  storage: {
    local: {
      get(keys) {
        const response = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) response[key] = storage[key];
        return Promise.resolve(response);
      }
    }
  }
};

const context = vm.createContext({
  chrome,
  CB_FIXED_ADDRESS: "ws://127.0.0.1:8787",
  CB_GLOBAL_SETTINGS_KEY: "globalSettings",
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout,
  console
});
context.self = context;
vm.runInContext(`${source.slice(start, end + 3)}\nself.__targetConnection = cbConnection;`, context, { filename: "background.js" });
const connection = context.__targetConnection;
connection.connect = () => {};
connection.disconnect = () => {};

function assert(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  }
}

async function select(macVault, classifier) {
  storage.globalSettings = { connection: { clientEnabled: macVault } };
  storage.vaultClassifierSettings = { connectionEnabled: classifier };
  await connection.applyFromSettings();
}

function publishedStates(state) {
  pushes.length = 0;
  connection.setStatus({
    state,
    address: "ws://127.0.0.1:8787",
    peers: [{ program: "macapp", connected: true }],
    error: state === "error" ? "socket-error" : "",
    hubProgram: "macapp"
  });
  const mac = pushes.find((message) => message.type === "connection-status-push")?.status;
  const classifier = pushes.find((message) => message.type === "classifier-connection-status-push")?.status;
  return { mac, classifier };
}

(async () => {
  await select(false, false);
  let states = publishedStates("off");
  assert("neither target selected stays off", connection.primaryStream === "none" && states.mac?.state === "off" && states.classifier?.state === "off", states);

  await select(true, false);
  states = publishedStates("connecting");
  assert("the selected Mac target reports connecting", connection.primaryStream === "macapp" && states.mac?.state === "connecting" && states.classifier?.state === "off", states);
  states = publishedStates("connected");
  assert("Mac-only selection leaves Classifier connected but not listening", states.mac?.state === "connected" && states.classifier?.state === "connected-not-listening", states);

  await select(false, true);
  states = publishedStates("connected");
  assert("Classifier-only selection leaves Mac connected but not listening", connection.primaryStream === "classifier" && states.mac?.state === "connected-not-listening" && states.classifier?.state === "connected", states);
  states = publishedStates("error");
  assert("a selected transport failure is presented as disconnected", states.mac?.state === "off" && states.classifier?.state === "disconnected", states);

  await select(true, true);
  states = publishedStates("connected");
  assert("both selected targets report connected on the one shared socket", connection.primaryStream === "classifier" && states.mac?.state === "connected" && states.classifier?.state === "connected", states);

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
