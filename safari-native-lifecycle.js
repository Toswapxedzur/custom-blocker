/* Safari initiates native heartbeat requests through an active native port.
 * Replies complete the browser's request; the companion never dispatches a
 * message that could reopen Safari. Its startup remains a one-time bootstrap. */
(function (root) {
  "use strict";
  if (!root.CBLocalHubEnvironment?.current || !root.CB_SAFARI_RUNTIME_CONFIG) return;
  const host = root.CBLocalHubEnvironment.current.nativeHost;
  const runtime = root.chrome?.runtime;
  const intervalMs = 1000;
  let bootstrapped = false;
  let connecting = false;
  let port = null;
  let pending = false;
  let requestStarted = 0;
  let nextRequest = null;
  let reconnect = null;

  function scheduleReconnect() {
    if (reconnect !== null) return;
    reconnect = setTimeout(() => { reconnect = null; connect(); }, intervalMs);
  }

  function retire(expected) {
    if (port !== expected) return;
    port = null;
    pending = false;
    if (nextRequest !== null) { clearTimeout(nextRequest); nextRequest = null; }
    // Invalidate before disconnect: its event may fire synchronously. Old port
    // replies and disconnect events must never affect a replacement port.
    try { expected.disconnect(); } catch (_) {}
    scheduleReconnect();
  }

  function requestTick(expected) {
    if (port !== expected || pending) return;
    pending = true;
    requestStarted = Date.now();
    try { expected.postMessage({ type: "safari-lifecycle-wait" }); }
    catch (_) { retire(expected); }
  }

  function receive(expected, message) {
    if (port !== expected || !pending) return;
    if (message?.ok !== true || message?.type !== "safari-lifecycle-tick") {
      retire(expected);
      return;
    }
    pending = false;
    if (typeof root.CBSafariLifetimeTick === "function") {
      // Shared background work returns void; other hosts may return a promise.
      try { Promise.resolve(root.CBSafariLifetimeTick()).catch(() => {}); } catch (_) {}
    }
    if (port !== expected) return;
    // Native holds the request for one second. Preserve a floor for fast
    // replies, and schedule rather than recursively posting another request.
    const elapsed = Math.max(0, Date.now() - requestStarted);
    nextRequest = setTimeout(() => { nextRequest = null; requestTick(expected); }, Math.max(0, intervalMs - elapsed));
  }

  function connect() {
    if (port || connecting || reconnect !== null || typeof runtime?.connectNative !== "function") return;
    connecting = true;
    if (!bootstrapped && typeof runtime.sendNativeMessage === "function") {
      bootstrapped = true;
      try { Promise.resolve(runtime.sendNativeMessage(host, { type: "safari-lifecycle-activate" })).catch(() => {}); } catch (_) {}
    }
    try {
      const current = runtime.connectNative(host);
      port = current;
      current.onMessage.addListener(message => receive(current, message));
      current.onDisconnect.addListener(() => retire(current));
      connecting = false;
      requestTick(current);
    } catch (_) {
      connecting = false;
      if (port) retire(port); else scheduleReconnect();
    }
  }
  connect();
  root.CBSafariNativeLifecycle = Object.freeze({ connect });
})(typeof self !== "undefined" ? self : globalThis);
