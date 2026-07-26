/* Automatic one-socket local Vault hub routing tests. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "background.js"), "utf8");
const start = source.indexOf("const cbConnection = {");
const end = source.indexOf("\n};\n\n// Classifier requests share", start);
if (start < 0 || end < 0) throw new Error("Could not locate cbConnection.");

const pushes = [];
const sockets = [];
const timers = new Map();
let nextTimerID = 1;
let failures = 0;
let storageReads = 0;

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
      get() {
        storageReads += 1;
        throw new Error("Automatic transport must not read retired connection settings.");
      }
    }
  }
};

const context = vm.createContext({
  chrome,
  CB_FIXED_ADDRESS: "ws://127.0.0.1:8787",
  CB_CONNECTION_PROTOCOL_VERSION: 4,
  CB_CONNECTION_BURST_INTERVAL_MS: 100,
  CB_CONNECTION_BURST_WINDOW_MS: 5_000,
  CB_CONNECTION_SLOW_INTERVAL_MS: 5_000,
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
let automaticConnects = 0;
connection.connect = () => {
  automaticConnects += 1;
  connection.desired = true;
};

function assert(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  }
}

function targetStates() {
  return {
    mac: connection.statusForTarget("macapp"),
    classifier: connection.statusForTarget("classifier")
  };
}

(async () => {
  await connection.startAutomatically();
  assert(
    "startup always requests one durable connection without reading retired settings",
    automaticConnects === 1 && connection.desired === true && storageReads === 0,
    { automaticConnects, desired: connection.desired, storageReads }
  );

  connection.ws = { readyState: FakeWebSocket.OPEN, send() {} };
  connection.setStatus({ state: "connected", hubProgram: "classifier", peers: [] });
  let states = targetStates();
  assert(
    "Classifier-only presence routes classifier work while Mac group sync stays unavailable",
    connection.routeIsReady("classifier") &&
      !connection.routeIsReady("macapp") &&
      states.classifier.state === "connected" &&
      states.mac.state === "connected-not-listening",
    states
  );

  connection.setStatus({
    state: "connected",
    hubProgram: "macapp",
    peers: [{ program: "classifier", connected: true }]
  });
  states = targetStates();
  assert(
    "Mac Vault and Classifier are simultaneously routable on one socket",
    connection.routeIsReady("macapp") &&
      connection.routeIsReady("classifier") &&
      states.mac.state === "connected" &&
      states.classifier.state === "connected",
    states
  );

  connection.clusters = [{ id: "cluster" }];
  connection.setStatus({ state: "connected", hubProgram: "classifier", peers: [] });
  assert(
    "losing the Mac route clears runtime cluster state without stopping classifier transport",
    connection.clusters.length === 0 &&
      connection.routeIsReady("classifier") &&
      pushes.some((message) => message.type === "clusters-push" && message.clusters.length === 0),
    { clusters: connection.clusters, pushes }
  );

  assert(
    "transport publishes only contextual Mac group status, not user-facing classifier connection controls",
    pushes.some((message) => message.type === "connection-status-push") &&
      !pushes.some((message) => message.type === "classifier-connection-status-push"),
    pushes
  );

  connection.stop();
  connection.connect = liveConnect;
  connection.startAutomatically();
  const socket = sockets.at(-1);
  socket.open();
  runTimersWithDelay(5_000);
  assert(
    "an incomplete automatic handshake settles to disconnected and keeps retry intent",
    connection.status.state === "disconnected" && connection.desired === true && connection.ws === null,
    connection.status
  );
  connection.stop();

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
