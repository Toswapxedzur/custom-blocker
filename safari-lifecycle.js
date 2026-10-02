/* Safari may suspend its MV3 background page. A visible granted page wakes it
 * for current rule events and reconnects the authenticated hub. No rendered
 * evidence is sent here; collection remains owned by the opt-in collectors. */
(function () {
  "use strict";
  if (window.top !== window || typeof chrome?.runtime?.sendMessage !== "function") return;
  let running = false;
  async function wake() {
    if (running || document.visibilityState === "hidden") return;
    running = true;
    try { await chrome.runtime.sendMessage({ type: "safari-lifecycle-tick" }); } catch (_) {}
    finally { running = false; }
  }
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("pageshow", wake);
  wake();
  setInterval(wake, 1000);
})();
