/* Safari initiates each native heartbeat request. The native handler completes
 * the existing request after one second; no containing-app message opens Safari.
 * Companion startup is a separate, one-time bootstrap for its existing services. */
(function (root) {
  "use strict";
  if (!root.CBLocalHubEnvironment?.current || !root.CB_SAFARI_RUNTIME_CONFIG) return;
  const host = root.CBLocalHubEnvironment.current.nativeHost;
  const runtime = root.chrome?.runtime;
  const intervalMs = 1000;
  let bootstrapped = false;
  let pending = false;
  let reconnect = null;
  function connect() {
    if (pending || reconnect !== null || typeof runtime?.sendNativeMessage !== "function") return;
    pending = true;
    if (!bootstrapped) {
      bootstrapped = true;
      try { Promise.resolve(runtime.sendNativeMessage(host, { type: "safari-lifecycle-activate" })).catch(() => {}); } catch (_) {}
    }
    const started = Date.now();
    // A request cannot be cancelled through this API. Keep one pending until
    // the native reply or browser termination settles it; never overlap waits.
    Promise.resolve().then(() => runtime.sendNativeMessage(host, { type: "safari-lifecycle-wait" })).then(message => {
      if (message?.ok !== true || message?.type !== "safari-lifecycle-tick") return;
      if (typeof root.CBSafariLifetimeTick === "function") {
        // Shared background work returns void; other hosts may return a promise.
        try { Promise.resolve(root.CBSafariLifetimeTick()).catch(() => {}); } catch (_) {}
      }
    }, () => {}).then(() => {
      pending = false;
      // Native normally holds the request for this interval. Keep fast replies,
      // malformed replies and failures from creating a request/retry storm.
      const elapsed = Math.max(0, Date.now() - started);
      reconnect = setTimeout(() => { reconnect = null; connect(); }, Math.max(0, intervalMs - elapsed));
    });
  }
  connect();
  root.CBSafariNativeLifecycle = Object.freeze({ connect });
})(typeof self !== "undefined" ? self : globalThis);
