/* Native Safari heartbeat port. Safari may reclaim the background page; its
 * containing app wakes it through the supported native port while Safari is
 * running. The containing app is independent of Mac Vault and stays active
 * after its onboarding window closes. */
(function (root) {
  "use strict";
  if (!root.CBLocalHubEnvironment?.current || !root.CB_SAFARI_RUNTIME_CONFIG) return;
  const host = root.CBLocalHubEnvironment.current.nativeHost;
  let port = null;
  let reconnect = null;
  function connect() {
    if (port || typeof chrome.runtime.connectNative !== "function") return;
    try {
      port = chrome.runtime.connectNative(host);
      port.onMessage.addListener(message => {
        // dispatchMessage wraps its dictionary as userInfo in Safari. The
        // marker is checked both directly and inside that native envelope.
        const payload = message?.userInfo || message?.message || message;
        if (message?.name !== "safari-lifecycle-tick" && payload?.type !== "safari-lifecycle-tick") return;
        if (typeof root.CBSafariLifetimeTick === "function") root.CBSafariLifetimeTick().catch(() => {});
      });
      port.onDisconnect.addListener(() => {
        port = null;
        if (!reconnect) reconnect = setTimeout(() => { reconnect = null; connect(); }, 1000);
      });
      chrome.runtime.sendNativeMessage(host, { type: "safari-lifecycle-activate" }).catch(() => {});
    } catch (_) {
      port = null;
    }
  }
  connect();
  root.CBSafariNativeLifecycle = Object.freeze({ connect });
})(typeof self !== "undefined" ? self : globalThis);
