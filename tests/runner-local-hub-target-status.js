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
const sockets = [];
const timers = new Map();
let nextTimerID = 1;
let failures = 0;

class FakeWebSocket {
  static OPEN = 1;

  constructor(address) {
    this.address = address;
    this.readyState = 0;
    this.sent = [];
    sockets.push(this);
  }

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
}

function fakeSetTimeout(callback, delay) {
  const id = nextTimerID++;
  timers.set(id, { callback, delay });
  return id;
}

function fakeClearTimeout(id) {
  timers.delete(id);
}

function runTimersWithDelay(delay) {
  const ready = [...timers.entries()].filter(([, timer]) => timer.delay === delay);
  for (const [id, timer] of ready) {
    timers.delete(id);
    timer.callback();
  }
}

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
  CB_CONNECTION_PROTOCOL_VERSION: 3,
  CB_CONNECTION_BURST_INTERVAL_MS: 100,
  CB_CONNECTION_BURST_WINDOW_MS: 5_000,
  CB_CONNECTION_SLOW_INTERVAL_MS: 5_000,
  CB_GLOBAL_SETTINGS_KEY: "globalSettings",
  cbDetectProgramId: () => "chrome",
  WebSocket: FakeWebSocket,
  clearInterval: () => {},
  clearTimeout: fakeClearTimeout,
  setInterval,
  setTimeout: fakeSetTimeout,
  console
});
context.self = context;
vm.runInContext(`${source.slice(start, end + 3)}\nself.__targetConnection = cbConnection;`, context, { filename: "background.js" });
const connection = context.__targetConnection;
const liveConnect = connection.connect.bind(connection);
const liveDisconnect = connection.disconnect.bind(connection);
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

function publishedStates(state, { hubProgram = "macapp", peers = [{ program: "macapp", connected: true }] } = {}) {
  pushes.length = 0;
  connection.setStatus({
    state,
    address: "ws://127.0.0.1:8787",
    peers,
    error: state === "error" ? "socket-error" : "",
    hubProgram
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
  states = publishedStates("connected", { hubProgram: "classifier", peers: [] });
  assert("Classifier-only selection leaves Mac connected but not listening", connection.primaryStream === "classifier" && states.mac?.state === "connected-not-listening" && states.classifier?.state === "connected", states);
  states = publishedStates("error");
  assert("a selected transport failure is presented as disconnected", states.mac?.state === "off" && states.classifier?.state === "disconnected", states);

  await select(true, true);
  states = publishedStates("connected", {
    hubProgram: "macapp",
    peers: [{ program: "classifier", connected: true }]
  });
  assert("both selected targets report connected on the one shared socket", connection.primaryStream === "classifier" && states.mac?.state === "connected" && states.classifier?.state === "connected", states);

  states = publishedStates("connected", { hubProgram: "macapp", peers: [] });
  assert("a selected target absent from the live hub reports connected but not listening", states.mac?.state === "connected" && states.classifier?.state === "connected-not-listening", states);

  await select(false, true);
  connection.connect = liveConnect;
  connection.connect();
  const socket = sockets.at(-1);
  socket.open();
  runTimersWithDelay(5_000);
  assert(
    "an incomplete socket welcome settles to disconnected after five seconds",
    connection.status.state === "disconnected" && connection.desired === true && connection.ws === null,
    connection.status
  );
  connection.disconnect = liveDisconnect;
  connection.disconnect();

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
