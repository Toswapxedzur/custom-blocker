/* Browser-side bootstrap for protocol-v4 local-hub authentication. */
(function (root) {
  "use strict";
  const HOST = "com.adamancia.vault.local_hub";

  function nativeMessage(message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };
      try {
        const result = chrome.runtime.sendNativeMessage(HOST, message, (response) => {
          const error = chrome.runtime.lastError;
          if (error) finish(reject, new Error("Native host is unavailable."));
          else finish(resolve, response);
        });
        if (result && typeof result.then === "function") {
          result.then((response) => finish(resolve, response), () => finish(reject, new Error("Native host is unavailable.")));
        }
      } catch (_) {
        finish(reject, new Error("Native host is unavailable."));
      }
    });
  }

  async function proofForChallenge(program, challenge) {
    if (program !== "chrome" && program !== "edge") throw new Error("Unsupported browser.");
    if (typeof challenge !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      throw new Error("Invalid local-hub challenge.");
    }
    const response = await nativeMessage({ kind: "local-hub-challenge", v: 4, program, challenge });
    if (!response || response.ok !== true || typeof response.proof !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(response.proof)) {
      throw new Error("Native host authentication failed.");
    }
    return response.proof;
  }

  root.CBLocalHubAuthentication = { proofForChallenge };
})(typeof self !== "undefined" ? self : globalThis);
