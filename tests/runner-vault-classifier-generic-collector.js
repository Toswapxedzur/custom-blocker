/* Regression test for the shared non-YouTube collector lifecycle. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const messages = [];
const debugLogs = [];
const observers = [];
let avatarURL = null;

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      messages.push(message);
      if (message.type === "vault-classifier-collection-info") return callback({ ok: true, enabled: true });
      callback({ ok: true, accepted: true });
    }
  },
  storage: {
    local: { get(_key, callback) { callback({ globalSettings: { debugMode: true } }); } },
    onChanged: { addListener() {} }
  }
};

const document = {
  documentElement: {},
  addEventListener() {},
  querySelectorAll() { return []; }
};

const context = vm.createContext({
  chrome,
  console: { debug(...parts) { debugLogs.push(parts.join(" ")); }, error() {} },
  document,
  location: { href: "https://www.tiktok.com/@visible/video/123", hostname: "www.tiktok.com", pathname: "/@visible/video/123" },
  MutationObserver: class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(_root, options) { this.options = options; }
  },
  setTimeout,
  clearTimeout,
  setInterval() { return 0; },
  TextEncoder,
  URL,
  addEventListener() {}
});
context.window = context;
context.globalThis = context;

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "platform-profiles.js"), "utf8"), context, { filename: "platform-profiles.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-collector-core.js"), "utf8"), context, { filename: "vault-classifier-collector-core.js" });

const Collector = context.VaultClassifierCollectorCore;
Collector.start({
  platform: "tiktok",
  matchesPage: (location) => location.hostname === "www.tiktok.com",
  scan({ collect }) {
    collect({
      entryID: "tiktok:video:123",
      sourceKind: "creator",
      entryURL: "https://www.tiktok.com/@visible/video/123",
      sourceURL: "https://www.tiktok.com/@visible",
      sourceName: "Visible creator",
      title: "Visible short",
      creatorAvatarURL: avatarURL,
      entryType: "short"
    });
  },
  scanPage({ collect }) {
    collect({
      entryID: "tiktok:video:456",
      surface: "page",
      sourceKind: "creator",
      entryURL: "https://www.tiktok.com/@visible/video/456",
      sourceURL: "https://www.tiktok.com/@visible",
      sourceName: "Visible creator",
      title: "Visible page title",
      text: "Visible rendered description",
      suppliedTags: ["guide"],
      entryType: "short"
    });
    return { ready: true };
  }
});

setTimeout(() => {
  avatarURL = "https://p16-sign-va.tiktokcdn.com/visible-avatar.jpeg";
  observers.forEach((observer) => observer.callback([{ type: "attributes", target: { matches: (selector) => selector === "img, source" } }]));
}, 350);

setTimeout(() => {
  const collections = messages.filter((message) => message.type === "vault-classifier-collect");
  const diagnostics = messages.filter((message) => message.type === "vault-classifier-diagnostic");
  const initial = collections.find((message) => message.entry?.entryID === "tiktok:video:123" && !message.entry?.evidence?.metadata?.creatorAvatarURL);
  const enriched = collections.find((message) => message.entry?.entryID === "tiktok:video:123" && message.entry?.evidence?.metadata?.creatorAvatarURL);
  const page = collections.find((message) => message.entry?.entryID === "tiktok:video:456");
  const passed = Boolean(
    initial
    && enriched?.entry?.evidence?.metadata?.creatorAvatarURL === "https://p16-sign-va.tiktokcdn.com/visible-avatar.jpeg"
    && page?.entry?.surface === "page"
    && page?.entry?.evidence?.text === "Visible rendered description"
    && diagnostics.some((message) => message.event === "collector-started")
    && diagnostics.some((message) => message.event === "page-evidence-ready")
    && observers.some((observer) => observer.options?.attributeFilter?.includes("src"))
    && debugLogs.includes("[VaultClassifier:avatar] tiktok:debug-ready")
    && debugLogs.includes("[VaultClassifier:avatar] tiktok:source-ready")
    && debugLogs.every((entry) => !/Visible|123|avatar\.jpeg/.test(entry))
  );
  if (passed) {
    console.log("PASS gives every dedicated collector YouTube-style late-avatar, page-evidence, and diagnostic handling");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL shared collector regression", { collections, diagnostics, debugLogs });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 1_000);
