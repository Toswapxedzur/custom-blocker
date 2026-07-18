/* Independent shared-broker connection tests for the Vault Classifier bridge. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const storage = {
  vaultClassifierSettings: { connectionEnabled: true }
};
const listeners = [];
const sockets = [];
const pushes = [];
const received = [];
const rejections = [];
let failures = 0;

class FakeWebSocket {
  static OPEN = 1;

  constructor(address) {
    this.address = address;
    this.readyState = 0;
    this.sent = [];
    sockets.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  send(value) {
    this.sent.push(JSON.parse(value));
  }

  close() {
    const wasOpen = this.readyState === FakeWebSocket.OPEN;
    this.readyState = 3;
    if (wasOpen) this.onclose?.();
  }

  message(value) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}

const chrome = {
  runtime: {
    onMessage: { addListener(listener) { listeners.push(listener); } },
    sendMessage(message) {
      pushes.push(message);
      return Promise.resolve();
    }
  },
  storage: {
    local: {
      get(key) {
        return Promise.resolve({ [key]: storage[key] });
      }
    },
    onChanged: { addListener() {} }
  }
};

const context = vm.createContext({
  chrome,
  WebSocket: FakeWebSocket,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  console,
  CBBridgeProtocol: {
    PROTOCOL_VERSION: 3,
    isHubProgram(value) { return value === "vault-broker"; }
  },
  CBClassifierHub: {
    receive(message) { received.push(message); },
    rejectAll(reason) { rejections.push(reason); }
  }
});
context.self = context;

function assert(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  }
}

function dispatch(message) {
  let response;
  let handled = false;
  for (const listener of listeners) {
    if (listener(message, { id: "vault-classifier-test-extension" }, (value) => { response = value; }) === true) handled = true;
  }
  return { handled, response };
}

(async () => {
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-connection.js"), "utf8"), context, { filename: "vault-classifier-connection.js" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert("starts an independent classifier connection from classifier settings", sockets.length === 1 && sockets[0].address === "wss://customblocker.com/api/vault-bridge");

  const socket = sockets[0];
  socket.open();
  assert("identifies as a browser without a pairing key", socket.sent.length === 1 && socket.sent[0].kind === "hello" && socket.sent[0].program === "chrome" && !Object.hasOwn(socket.sent[0], "pairingKey"), socket.sent);

  socket.message({ kind: "welcome", v: 3, hubProgram: "vault-broker", peers: [] });
  assert("publishes the connected classifier status", context.CBClassifierConnection.status.state === "connected" && pushes.some((message) => message.type === "classifier-connection-status-push" && message.status.state === "connected"), pushes);

  socket.message({ kind: "classifier-response", requestID: "classifier-test", operation: "collect", body: { accepted: true } });
  assert("delivers classifier replies only to the classifier request listener", received.length === 1 && received[0].operation === "collect", received);

  const status = dispatch({ type: "classifier-connection-status" });
  assert("exposes an independent connection status for the popup", status.response?.ok === true && status.response.status.state === "connected", status);

  const disconnected = dispatch({ type: "classifier-connection-disconnect" });
  assert("disconnects without changing normal Web-app bridge state", disconnected.response?.ok === true && context.CBClassifierConnection.status.state === "off" && rejections.length > 0, { disconnected, rejections });

  const reconnect = dispatch({ type: "classifier-connection-connect" });
  assert("reconnects without prompting for a pairing key", reconnect.response?.ok === true && sockets.length === 2, reconnect);

  assert("keeps no collected page metadata or pairing material in extension storage", Object.keys(storage).length === 1 && Object.keys(storage.vaultClassifierSettings).every((key) => key === "connectionEnabled"), storage);

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
