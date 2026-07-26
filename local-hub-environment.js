/* Runtime identity boundary for the authenticated local Vault hub.
 *
 * Production and unpacked development extensions use different Chrome
 * identities, native hosts, and loopback ports. An unknown identity fails
 * closed instead of inheriting production transport.
 */
(function (root) {
  "use strict";

  const PRODUCTION_EXTENSION_ID = "mcbmcmephdaapjepopobikobjmfdeamm";
  const DEVELOPMENT_EXTENSION_ID = "opjogfpcmllpgplgofionfejkjeanhkc";
  const configurations = Object.freeze({
    [PRODUCTION_EXTENSION_ID]: Object.freeze({
      name: "production",
      address: "ws://127.0.0.1:8787",
      nativeHost: "com.adamancia.vault.local_hub"
    }),
    [DEVELOPMENT_EXTENSION_ID]: Object.freeze({
      name: "development",
      address: "ws://127.0.0.1:18787",
      nativeHost: "com.adamancia.vault.local_hub.development"
    })
  });

  function resolve(extensionID) {
    return configurations[String(extensionID || "")] || null;
  }

  const extensionID = root.chrome?.runtime?.id || "";
  const current = resolve(extensionID);
  root.CBLocalHubEnvironment = Object.freeze({
    extensionID,
    current,
    resolve,
    productionExtensionID: PRODUCTION_EXTENSION_ID,
    developmentExtensionID: DEVELOPMENT_EXTENSION_ID
  });
})(typeof self !== "undefined" ? self : globalThis);
