/* Browser-side bootstrap for protocol-v4 local-hub authentication. */
(function (root) {
  "use strict";

  // Chromium legacy identity authentication remains supported through app
  // major 4 and is retired at major 5. Safari uses its ordinary association.
  const LEGACY_RETIRE_APP_MAJOR = 5;
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const proofShape = (value) => typeof value === "string" && value.length === 43 && /^[A-Za-z0-9_-]{43}$/.test(value);

  function legacyAuthenticationAllowed() {
    let version = "";
    try { version = chrome.runtime.getManifest().version; } catch (_) {}
    const match = typeof version === "string" && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*))?$/.exec(version);
    // Protocol v4's published compatibility baseline is extension 3.1.0.
    return Boolean(match) && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 1))
      && Number(match[1]) < LEGACY_RETIRE_APP_MAJOR;
  }

  function authenticationError(message, code = "authentication-unavailable") {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function browserIdentity(response, program) {
    const capability = has(response, "browserIdentityVersion");
    const identity = has(response, "browserIdentity");
    if (!capability && !identity) {
      // Safari's ordinary program association needs the base proof, not an
      // additional browser descriptor. Provided metadata is still strict below.
      if (program !== "safari" && !legacyAuthenticationAllowed()) {
        throw authenticationError("Update Vault and its native helper to verify the browser application.", "browser-identity-upgrade-required");
      }
      return null;
    }
    const value = response.browserIdentity;
    if (response.browserIdentityVersion !== 1 || !value || typeof value !== "object" || Array.isArray(value)
        || Object.keys(value).length !== 4 || !["v", "kind", "value", "proof"].every((key) => has(value, key))
        || value.v !== 1 || !proofShape(value.proof)) {
      throw authenticationError("Invalid native browser identity.", "invalid-browser-identity");
    }
    const bundle = value.kind === "mac-bundle-id" && typeof value.value === "string"
      && value.value.length <= 255 && /^[a-z0-9]/.test(value.value) && !/[^a-z0-9.-]/.test(value.value);
    const executable = program !== "safari" && value.kind === "windows-exe-sha256"
      && typeof value.value === "string" && value.value.length === 64 && /^[0-9a-f]{64}$/.test(value.value);
    if (!bundle && !executable) throw authenticationError("Invalid native browser identity.", "invalid-browser-identity");
    // JavaScript forwards the native attestation; the hub verifies its HMAC.
    return Object.freeze({ v: 1, kind: value.kind, value: value.value, proof: value.proof });
  }

  function nativeMessage(host, message) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };
      try {
        const result = chrome.runtime.sendNativeMessage(host, message, (response) => {
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
    if (program !== "chrome" && program !== "edge" && program !== "safari") throw new Error("Unsupported browser.");
    if (typeof challenge !== "string" || challenge.length !== 43 || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      throw new Error("Invalid local-hub challenge.");
    }
    const host = root.CBLocalHubEnvironment?.current?.nativeHost;
    if (typeof host !== "string" || !host) throw new Error("Unrecognized extension environment.");
    const response = await nativeMessage(host, { kind: "local-hub-challenge", v: 4, program, challenge, browserIdentityVersion: 1 });
    if (!response || response.ok !== true || !proofShape(response.proof)) {
      throw new Error("Native host authentication failed.");
    }
    if (program === "safari" && response.environment !== root.CBLocalHubEnvironment?.current?.name) {
      throw new Error("Safari native environment does not match this extension.");
    }
    return Object.freeze({ proof: response.proof, browserIdentity: browserIdentity(response, program) });
  }

  root.CBLocalHubAuthentication = { proofForChallenge, legacyAuthenticationAllowed };
})(typeof self !== "undefined" ? self : globalThis);
