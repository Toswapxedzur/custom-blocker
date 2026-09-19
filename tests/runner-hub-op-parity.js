// The classifier route's operation allowlist exists in FOUR places: the
// extension service worker (background.js), the classifier's bridge vocabulary
// (SharedBrowserBridgeOperation in SharedBrowserBridge.swift — its own hub
// derives both allowlists from that enum, so it is the single source there),
// and the Mac app's hub (ConnectionHub.swift, request + response guards). A
// missing entry silently drops the operation — this once blackholed the pill
// pipeline AND its dev-log diagnostics at once. This suite fails whenever any
// copy drifts, including the broadcast-op lists and the classifier-broadcast
// frame plumbing added for the push path.
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILES = {
  background: path.join(ROOT, "background.js"),
  bridge: path.join(ROOT, "vault-classifier-bridge.js"),
  classifierHub: path.join(ROOT, "../macosBlocker/classifier/Sources/VaultClassifierApp/LocalClassifierHub.swift"),
  classifierBridge: path.join(ROOT, "../macosBlocker/classifier/Sources/VaultClassifierBridge/SharedBrowserBridge.swift"),
  macHub: path.join(ROOT, "../macosBlocker/Sources/MacBlockerAppFeature/ConnectionHub.swift")
};

let pass = 0;
let fail = 0;

function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function quotedLists(source, regex) {
  const lists = [];
  for (const match of source.matchAll(regex)) {
    const items = [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
    if (items.length) lists.push(items);
  }
  return lists;
}

function sortedKey(list) {
  return [...list].sort().join("|");
}

const sources = {};
for (const [name, file] of Object.entries(FILES)) {
  sources[name] = fs.readFileSync(file, "utf8");
}

// The classifier's vocabulary is the SharedBrowserBridgeOperation enum: each
// `case name = "raw"` (or a bare `case name`, whose raw value is the name) is a
// request op, and the broadcast op is the `videoTagsUpdatedBroadcast` constant.
function classifierEnumOps(source) {
  const body = source.match(/enum SharedBrowserBridgeOperation[^{]*\{([\s\S]*?)\n\}/);
  if (!body) return [];
  const ops = [];
  for (const line of body[1].split("\n")) {
    const m = line.match(/^\s*case\s+([A-Za-z0-9_]+)(?:\s*=\s*"([a-z-]+)")?\s*$/);
    if (m) ops.push(m[2] || m[1]);
  }
  return ops;
}
function classifierBroadcastOps(source) {
  const m = source.match(/videoTagsUpdatedBroadcast\s*=\s*"([a-z-]+)"/);
  return m ? [m[1]] : [];
}

// Request-operation allowlists. In the Mac hub they are `[...].contains(operation)`
// guards; in the service worker it is the `operations:` array on the hub client.
const swiftLists = [
  classifierEnumOps(sources.classifierBridge),
  classifierBroadcastOps(sources.classifierBridge),
  ...quotedLists(sources.macHub, /\[((?:\s*"[a-z-]+",?)+)\]\.contains\(operation\)/g)
];
const requestLists = swiftLists.filter((list) => list.includes("bridge-info"));
const broadcastLists = swiftLists.filter((list) => list.includes("video-tags-updated"));
const backgroundLists = quotedLists(sources.background, /operations:\s*\[((?:\s*"[a-z-]+",?)+)\]/g);

check("extension allowlist found", backgroundLists.length === 1, `found ${backgroundLists.length}`);
check(
  "request allowlists found (classifier hub ×1, mac hub ×2)",
  requestLists.length === 3,
  `found ${requestLists.length}`
);
check(
  "broadcast allowlists found (classifier hub ×1, mac hub ×1)",
  broadcastLists.length === 2,
  `found ${broadcastLists.length}`
);

if (backgroundLists.length === 1 && requestLists.length === 3) {
  const reference = sortedKey(backgroundLists[0]);
  requestLists.forEach((list, index) => {
    check(
      `request allowlist ${index + 1} matches the extension`,
      sortedKey(list) === reference,
      `${sortedKey(list)} vs ${reference}`
    );
  });
}

if (broadcastLists.length === 2) {
  check(
    "broadcast allowlists match across hubs",
    sortedKey(broadcastLists[0]) === sortedKey(broadcastLists[1]),
    `${sortedKey(broadcastLists[0])} vs ${sortedKey(broadcastLists[1])}`
  );
  check(
    "bridge handles every broadcast operation",
    broadcastLists[0].every((operation) => sources.bridge.includes(`"${operation}"`)),
    "bridge is missing a broadcast operation literal"
  );
}

// The broadcast frame kind must be plumbed end to end: emitted or relayed by
// both hubs and dispatched by the service worker socket pump.
for (const name of ["background", "classifierHub", "macHub"]) {
  check(
    `${name} handles the classifier-broadcast frame kind`,
    sources[name].includes('"classifier-broadcast"'),
    "missing frame-kind literal"
  );
}

console.log(`HUB OP PARITY TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
if (fail === 0) console.log("__CB_TEST_RESULT__: OK");
process.exit(fail === 0 ? 0 : 1);
