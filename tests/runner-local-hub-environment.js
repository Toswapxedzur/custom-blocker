"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "local-hub-environment.js"), "utf8");
let failures = 0;

function load(extensionID, config, runtimeURL = "") {
  const context = vm.createContext({ CB_SAFARI_RUNTIME_CONFIG: config, chrome: { runtime: { id: extensionID, getURL: () => runtimeURL } } });
  context.self = context;
  vm.runInContext(source, context, { filename: "local-hub-environment.js" });
  return context.CBLocalHubEnvironment;
}

function assert(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  }
}

const production = load("mcbmcmephdaapjepopobikobjmfdeamm");
assert(
  "production identity uses only the production hub and native host",
  production.current?.name === "production"
    && production.current?.address === "ws://127.0.0.1:8787"
    && production.current?.nativeHost === "com.adamancia.vault.local_hub",
  production.current
);

const development = load("fjichnkbaoilbfbjcjkggllmbicmeegk");
assert(
  "development identity uses only the development hub and native host",
  development.current?.name === "development"
    && development.current?.address === "ws://127.0.0.1:18787"
    && development.current?.nativeHost === "com.adamancia.vault.local_hub.development",
  development.current
);

const unknown = load("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
assert("unknown extension identities fail closed", unknown.current === null, unknown.current);

const safariConfig = {
  environment: "development", address: "ws://127.0.0.1:18787", nativeHost: "com.adamancia.vault.safari.development.extension"
};
const safari = load("opaque-safari-id", safariConfig, "safari-web-extension://random/");
assert("Safari opaque ID uses signed package environment", safari.current?.name === "development" && safari.current?.address === safariConfig.address);
assert("Safari config cannot switch a Chromium identity", load("mcbmcmephdaapjepopobikobjmfdeamm", safariConfig, "chrome-extension://mcbmcmephdaapjepopobikobjmfdeamm/").current === null);
assert("Safari refuses arbitrary loopback hosts", load("opaque", { ...safariConfig, address: "ws://127.0.0.1:1234" }, "safari-web-extension://random/").current === null);
assert("Safari refuses native identity/environment mismatch", load("opaque", { ...safariConfig, nativeHost: "com.adamancia.vault.safari.extension" }, "safari-web-extension://random/").current === null);

console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
if (failures) process.exitCode = 1;
