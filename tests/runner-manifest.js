// Regression checks for the manifest routes that activate the platform
// collectors. Keep the apex and subdomain patterns separate: Chrome's
// `*.youtube.com` host pattern is for subdomains, while users frequently
// watch videos at the apex `youtube.com` host.
const fs = require("fs");
const path = require("path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
const workerEntry = manifest?.background?.service_worker;
const workerPath = path.join(__dirname, "..", String(workerEntry || ""));
const hasWorkerWrapper = workerEntry === "service-worker.js"
  && fs.existsSync(workerPath)
  && /\bimportScripts\(\s*["']background\.js["']\s*\)/.test(fs.readFileSync(workerPath, "utf8"));
const collector = (manifest.content_scripts || []).find((entry) =>
  Array.isArray(entry.js) && entry.js.includes("vault-classifier-youtube.js")
);
const matches = Array.isArray(collector && collector.matches) ? collector.matches : [];
const required = ["*://youtube.com/*", "*://*.youtube.com/*"];
const missing = required.filter((pattern) => !matches.includes(pattern));
const hasNativeMessaging = Array.isArray(manifest.permissions)
  && manifest.permissions.includes("nativeMessaging");

if (missing.length) {
  console.error(`FAIL YouTube collector is missing: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("PASS YouTube collector covers apex and subdomain hosts");
}

if (!hasWorkerWrapper) {
  console.error("FAIL Chromium manifest must use the guarded service-worker entry point");
  process.exitCode = 1;
} else {
  console.log("PASS Chromium service worker uses the guarded background entry point");
}

if (!hasNativeMessaging) {
  console.error("FAIL Chromium manifest must request Native Messaging for local-hub authentication");
  process.exitCode = 1;
} else {
  console.log("PASS Chromium manifest requests Native Messaging for local-hub authentication");
}

const genericCollectorPresent = (manifest.content_scripts || []).some((entry) =>
  Array.isArray(entry.js) && entry.js.includes("vault-classifier-collector.js")
);
const dedicatedCollectorScripts = [
  "vault-classifier-collector-core.js",
  "vault-classifier-tiktok.js",
  "vault-classifier-facebook.js",
  "vault-classifier-instagram.js",
  "vault-classifier-twitch.js",
  "vault-classifier-reddit.js",
  "vault-classifier-discord.js",
  "vault-classifier-twitter.js",
  "vault-classifier-bilibili.js"
];
const collectionEntry = (manifest.content_scripts || []).find((entry) =>
  Array.isArray(entry.js) && entry.js.includes("vault-classifier-collector-core.js")
);
const missingDedicatedCollectors = dedicatedCollectorScripts.filter((script) => !collectionEntry?.js?.includes(script));
const tagUIRegistrationInvalid = (manifest.content_scripts || []).some((entry) => {
  if (!Array.isArray(entry.js)) return false;
  const collectorIndex = entry.js.findIndex((script) =>
    script === "vault-classifier-collector-core.js" || script === "vault-classifier-youtube.js"
  );
  return collectorIndex >= 0 && (entry.js.indexOf("vault-classifier-tag-ui.js") < 0
    || entry.js.indexOf("vault-classifier-tag-ui.js") > collectorIndex);
});
const platformCollectorScripts = dedicatedCollectorScripts.slice(1).concat("vault-classifier-youtube.js");
const missingPresentationRoots = platformCollectorScripts.filter((script) =>
  !/\bpresentationRoot\b|TagUI\?\.observe/.test(fs.readFileSync(path.join(__dirname, "..", script), "utf8"))
);
if (genericCollectorPresent || missingDedicatedCollectors.length || tagUIRegistrationInvalid || missingPresentationRoots.length) {
  console.error(`FAIL dedicated platform collector registration is invalid${genericCollectorPresent ? "; generic collector remains" : ""}${missingDedicatedCollectors.length ? `; missing ${missingDedicatedCollectors.join(", ")}` : ""}`);
  process.exitCode = 1;
} else {
  console.log("PASS every classifier platform loads the shared tag presenter before its dedicated collector");
}

console.log(`__CB_TEST_RESULT__: ${missing.length || !hasWorkerWrapper || !hasNativeMessaging || genericCollectorPresent || missingDedicatedCollectors.length || tagUIRegistrationInvalid || missingPresentationRoots.length ? "FAIL" : "OK"}`);
