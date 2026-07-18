// Independent connection to the shared ephemeral Vault broker.
//
// This deliberately does not reuse the Web-app bridge socket. Both listeners
// use the same broker protocol, but classifier requests have an independent
// lifecycle and status so collection continues
// when ordinary group synchronization is disabled. Page evidence is never
// persisted here: only short-lived request correlation lives in the worker.
(function () {
  "use strict";
  if (self.CBClassifierConnection) return;

  const bridge = self.CBBridgeProtocol;
  if (!bridge || typeof bridge.isHubProgram !== "function" || typeof WebSocket === "undefined" || typeof chrome === "undefined" || !chrome.runtime || !chrome.storage?.local) return;

  const SETTINGS_KEY = "vaultClassifierSettings";
  const ADDRESS = "wss://customblocker.com/api/vault-bridge";
  const PROTOCOL_VERSION = bridge.PROTOCOL_VERSION;
  const PING_INTERVAL_MS = 20_000;
  const RETRY_INTERVAL_MS = 5_000;
  const HANDSHAKE_TIMEOUT_MS = 5_000;

  function classifierHub() {
    return self.CBClassifierHub && typeof self.CBClassifierHub.receive === "function"
      ? self.CBClassifierHub
      : null;
  }

  function rejectPending(reason) {
    const hub = self.CBClassifierHub;
    if (hub && typeof hub.rejectAll === "function") hub.rejectAll(reason);
  }

  const connection = {
    ws: null,
    pingTimer: null,
    handshakeTimer: null,
    reconnectTimer: null,
    desired: false,
    status: { running: false, state: "off", address: "", peers: [], error: "", hubProgram: "" },

    setStatus(patch) {
      this.status = { ...this.status, ...patch };
      this.broadcast();
    },

    broadcast() {
      try {
        chrome.runtime.sendMessage({ type: "classifier-connection-status-push", status: this.status }).catch(() => {});
      } catch (_) {}
    },

    send(object) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
      try {
        this.ws.send(JSON.stringify(object));
        return true;
      } catch (_) {
        return false;
      }
    },

    clearTimers() {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.pingTimer = null;
      this.handshakeTimer = null;
      this.reconnectTimer = null;
    },

    closeSocket() {
      if (!this.ws) return;
      try {
        this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    },

    connect() {
      this.desired = true;
      this.clearTimers();
      this.closeSocket();
      rejectPending("The Vault Classifier bridge is reconnecting.");
      this.setStatus({ state: "connecting", address: ADDRESS, peers: [], error: "", hubProgram: "" });

      let socket;
      try {
        socket = new WebSocket(ADDRESS);
      } catch (_) {
        this.setStatus({ state: "disconnected", error: "socket-error" });
        this.scheduleRetry();
        return;
      }
      this.ws = socket;
      socket.onopen = () => {
        try {
          socket.send(JSON.stringify({
            kind: "hello",
            v: PROTOCOL_VERSION,
            program: this.browserProgram()
          }));
        } catch (_) {}
        this.handshakeTimer = setTimeout(() => {
          if (this.ws !== socket || this.status.state === "connected") return;
          this.closeSocket();
          this.setStatus({ state: "disconnected", peers: [], error: "handshake-timeout", hubProgram: "" });
          this.scheduleRetry();
        }, HANDSHAKE_TIMEOUT_MS);
      };
      socket.onmessage = (event) => this.handleMessage(event && event.data);
      socket.onerror = () => {
        if (this.ws === socket && this.status.state !== "connected") {
          this.setStatus({ state: "disconnected", error: "socket-error" });
        }
      };
      socket.onclose = () => {
        if (this.ws === socket) this.ws = null;
        this.clearTimers();
        rejectPending("The Vault Classifier bridge disconnected.");
        if (!this.desired) {
          this.setStatus({ state: "off", peers: [], error: "", hubProgram: "" });
          return;
        }
        this.setStatus({ state: "disconnected", peers: [], hubProgram: "" });
        this.scheduleRetry();
      };
    },

    browserProgram() {
      const detected = typeof self.cbDetectProgramId === "function" ? self.cbDetectProgramId() : "chrome";
      return ["chrome", "edge", "firefox", "safari", "opera", "browser"].includes(detected) ? detected : "chrome";
    },

    scheduleRetry() {
      if (!this.desired || this.reconnectTimer) return;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.desired) this.connect();
      }, RETRY_INTERVAL_MS);
    },

    disconnect() {
      this.desired = false;
      this.clearTimers();
      this.closeSocket();
      rejectPending("The Vault Classifier bridge is off.");
      this.setStatus({ state: "off", peers: [], error: "", hubProgram: "" });
    },

    handleMessage(raw) {
      let message;
      try {
        message = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (_) {
        return;
      }
      if (!message || typeof message !== "object") return;
      if (message.kind !== "welcome" && message.kind !== "rejected" && this.status.state !== "connected") return;
      switch (message.kind) {
        case "welcome":
          if (message.v !== PROTOCOL_VERSION || !bridge.isHubProgram(message.hubProgram)) {
            this.desired = false;
            this.clearTimers();
            this.closeSocket();
            this.setStatus({ state: "error", peers: [], error: "protocol-mismatch", hubProgram: "" });
            return;
          }
          if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
          this.handshakeTimer = null;
          this.setStatus({
            state: "connected",
            peers: Array.isArray(message.peers) ? message.peers : [],
            error: "",
            hubProgram: message.hubProgram
          });
          this.pingTimer = setInterval(() => this.send({ kind: "ping", t: Date.now() }), PING_INTERVAL_MS);
          return;
        case "rejected":
          this.desired = false;
          this.clearTimers();
          this.closeSocket();
          rejectPending("The Vault Classifier bridge rejected the connection.");
          this.setStatus({ state: "error", peers: [], error: message.reason || "rejected", hubProgram: "" });
          return;
        case "peers":
          this.setStatus({ peers: Array.isArray(message.peers) ? message.peers : [] });
          return;
        case "classifier-response":
          classifierHub()?.receive(message);
          return;
        default:
          return;
      }
    },

    async applyFromSettings() {
      let raw;
      try {
        const result = await chrome.storage.local.get(SETTINGS_KEY);
        raw = result && result[SETTINGS_KEY];
      } catch (_) {}
      const enabled = Boolean(raw && raw.connectionEnabled === true);
      if (enabled) this.connect();
      else this.disconnect();
    }
  };

  self.CBClassifierConnection = connection;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return false;
    switch (message.type) {
      case "classifier-connection-connect":
        connection.connect();
        sendResponse({ ok: true, status: connection.status });
        return false;
      case "classifier-connection-disconnect":
        connection.disconnect();
        sendResponse({ ok: true, status: connection.status });
        return false;
      case "classifier-connection-status":
        sendResponse({ ok: true, status: connection.status });
        return false;
      default:
        return false;
    }
  });

  if (chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[SETTINGS_KEY]) connection.applyFromSettings();
    });
  }
  connection.applyFromSettings();
})();
