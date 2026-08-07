/* Regression test for the Chromium MV3 service-worker startup guard. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const errors = [];
const imported = [];
const context = vm.createContext({
  console: { error(...parts) { errors.push(parts); } },
  importScripts(script) {
    imported.push(script);
    throw new Error("synthetic background startup failure");
  }
});

try {
  vm.runInContext(
    fs.readFileSync(path.join(root, "service-worker.js"), "utf8"),
    context,
    { filename: "service-worker.js" }
  );
} catch (error) {
  console.error("FAIL guarded worker entry threw", error);
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
  return;
}

const passed = imported.length === 1
  && imported[0] === "background.js"
  && errors.length === 1
  && errors[0][0] === "[CustomBlocker] background worker failed to start";
console.log(passed ? "PASS keeps an MV3 worker registered after a startup import failure" : "FAIL MV3 worker startup guard");
console.log(`__CB_TEST_RESULT__: ${passed ? "OK" : "FAIL"}`);
if (!passed) process.exitCode = 1;
