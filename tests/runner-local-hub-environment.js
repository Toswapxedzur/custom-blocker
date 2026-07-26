"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "local-hub-environment.js"), "utf8");
let failures = 0;

function load(extensionID) {
  const context = vm.createContext({ chrome: { runtime: { id: extensionID } } });
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

const development = load("opjogfpcmllpgplgofionfejkjeanhkc");
assert(
  "development identity uses only the development hub and native host",
  development.current?.name === "development"
    && development.current?.address === "ws://127.0.0.1:18787"
    && development.current?.nativeHost === "com.adamancia.vault.local_hub.development",
  development.current
);

const unknown = load("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
assert("unknown extension identities fail closed", unknown.current === null, unknown.current);

console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
if (failures) process.exitCode = 1;
