/* Push-path regression tests: a completed classification broadcast must
   validate in the contract, fan out only to trusted platform tabs in the
   bridge, and swap a provisional "Tagging" pill in place in tag-ui without
   another request round-trip. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
let pass = 0;
let fail = 0;

function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}`, detail === undefined ? "" : detail);
  }
}

function finish() {
  console.log(`PUSH PATH TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  if (fail === 0) console.log("__CB_TEST_RESULT__: OK");
  process.exit(fail === 0 ? 0 : 1);
}

const VALID_TAGS = [
  { id: "games", name: "Games", lightColorHex: "#9EC5E8", darkColorHex: "#1A4775" }
];

// ---------------------------------------------------------------- contract --
{
  const context = vm.createContext({ console, URL, TextEncoder });
  context.self = context;
  context.globalThis = context;
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
  const C = context.VaultClassifierExtensionContract;

  // Payloads must be materialized inside the context: the contract's plain-
  // record check compares against the context's own Object.prototype, and a
  // cross-realm object from the test realm would fail it artificially.
  const inContext = (value) => {
    context.__payload = JSON.stringify(value);
    return vm.runInContext("JSON.parse(__payload)", context);
  };

  const good = C.normalizeVideoTagsBroadcast(inContext({
    platformID: "youtube",
    items: [{ entryID: "youtube:video:v1", tags: VALID_TAGS, predicted: false }]
  }));
  check(
    "contract accepts a well-formed broadcast",
    Boolean(good) && good.platformID === "youtube" && good.items.length === 1
      && good.items[0].entryID === "youtube:video:v1" && good.items[0].tags.length === 1,
    good
  );
  const rejected = [
    C.normalizeVideoTagsBroadcast(null),
    C.normalizeVideoTagsBroadcast(inContext({ platformID: "youtube", items: [] })),
    C.normalizeVideoTagsBroadcast(inContext({ platformID: "youtube", items: [{ entryID: "reddit:post:x", tags: [] }] })),
    C.normalizeVideoTagsBroadcast(inContext({ platformID: "youtube", items: [{ entryID: "youtube:video:v1", tags: [{ id: "x", name: "X", lightColorHex: "nope", darkColorHex: "#111111" }] }] }))
  ];
  check("contract rejects malformed broadcasts", rejected.every((value) => value === null), rejected);
}

// ------------------------------------------------------------------ bridge --
const sentToTabs = [];
{
  const chrome = {
    runtime: {
      id: "ext",
      lastError: null,
      onMessage: { addListener() {} }
    },
    storage: {
      local: { get(_, cb) { cb({}); }, set(_, cb) { cb && cb(); } },
      session: { get(_, cb) { cb({}); }, set(_, cb) { cb && cb(); } },
      onChanged: { addListener() {} }
    },
    tabs: {
      query(_, cb) {
        cb([
          { id: 1, url: "https://www.youtube.com/" },
          { id: 2, url: "https://example.com/" },
          { id: 3, url: "chrome://extensions/" },
          { url: "https://www.youtube.com/watch?v=x" }
        ]);
      },
      sendMessage(tabId, message, cb) {
        sentToTabs.push({ tabId, message });
        cb && cb();
      }
    }
  };
  const context = vm.createContext({ console, URL, TextEncoder, setTimeout, clearTimeout, Date, chrome });
  context.self = context;
  context.globalThis = context;
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-bridge.js"), "utf8"), context, { filename: "vault-classifier-bridge.js" });

  check("bridge registers the broadcast receiver", typeof context.CBClassifierBroadcastReceive === "function");
  // Same realm rule as above: frames must be parsed inside the context.
  const receiveInContext = (frame) => {
    context.__frame = JSON.stringify(frame);
    vm.runInContext("CBClassifierBroadcastReceive(JSON.parse(__frame))", context);
  };
  receiveInContext({
    kind: "classifier-broadcast",
    operation: "video-tags-updated",
    body: { platformID: "youtube", items: [{ entryID: "youtube:video:v1", tags: VALID_TAGS, predicted: false }] }
  });
  check(
    "bridge fans out only to trusted platform tabs",
    sentToTabs.length === 1 && sentToTabs[0].tabId === 1
      && sentToTabs[0].message.type === "vault-classifier-video-tags-updated"
      && sentToTabs[0].message.platform === "youtube"
      && sentToTabs[0].message.items[0].entryID === "youtube:video:v1",
    sentToTabs
  );
  const before = sentToTabs.length;
  receiveInContext({
    kind: "classifier-broadcast",
    operation: "video-tags-updated",
    body: { platformID: "youtube", items: [{ entryID: "reddit:post:x", tags: VALID_TAGS }] }
  });
  check("bridge drops a malformed broadcast", sentToTabs.length === before);
}

// ------------------------------------------------------------------ tag-ui --
{
  const closedShadows = new WeakMap();
  const messages = [];
  let pushListener = null;
  let context;

  class FakeElement {
    constructor(tagName, ownerDocument) {
      this.tagName = String(tagName).toUpperCase();
      this.ownerDocument = ownerDocument;
      this.children = [];
      this.parentNode = null;
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.isConnected = true;
      this.textContent = "";
      this.className = "";
      this.dir = "";
      this.dataset = {};
      this._attrs = {};
    }
    setAttribute(name, value) { this._attrs[name] = String(value); }
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null; }
    removeAttribute(name) { delete this._attrs[name]; }
    append(...children) { for (const child of children) this.appendChild(child); }
    appendChild(child) {
      child.parentNode = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
      return child;
    }
    replaceChildren(...children) {
      this.children.forEach((child) => { child.parentNode = null; child.isConnected = false; });
      this.children = [];
      this.append(...children);
    }
    contains(candidate) { return candidate === this || this.children.some((child) => child.contains?.(candidate)); }
    insertAdjacentElement(position, element) {
      if (position !== "afterend" || !this.parentNode) return null;
      const index = this.parentNode.children.indexOf(this);
      element.parentNode = this.parentNode;
      element.isConnected = this.parentNode.isConnected;
      this.parentNode.children.splice(index + 1, 0, element);
      return element;
    }
    attachShadow() {
      const shadow = new FakeElement("shadow-root", this.ownerDocument);
      closedShadows.set(this, shadow);
      return shadow;
    }
    get shadowRoot() { return null; }
    remove() {
      if (this.parentNode) {
        const index = this.parentNode.children.indexOf(this);
        if (index >= 0) this.parentNode.children.splice(index, 1);
      }
      this.parentNode = null;
      this.isConnected = false;
    }
  }

  const document = { createElement(tagName) { return new FakeElement(tagName, document); } };
  document.documentElement = new FakeElement("html", document);

  const chrome = {
    runtime: {
      id: "ext",
      lastError: null,
      onMessage: { addListener(listener) { pushListener = listener; } },
      // Always answers pending: the pill must show "Tagging" until the push.
      sendMessage(message, callback) {
        messages.push(message);
        const response = {
          ok: true,
          platformID: message.platform,
          items: (Array.isArray(message.items) ? message.items : []).map((item) => (
            { entryID: item.entryID, tags: [], predicted: false, pending: true }
          ))
        };
        setTimeout(() => {
          context.__tagResponse = JSON.stringify(response);
          callback(vm.runInContext("JSON.parse(__tagResponse)", context));
        }, 5);
      }
    }
  };

  context = vm.createContext({
    chrome, console, document, setTimeout, clearTimeout, Date, TextEncoder, URL,
    MutationObserver: class { observe() {} disconnect() {} }
  });
  context.window = context;
  context.self = context;
  context.globalThis = context;

  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-tag-ui.js"), "utf8"), context, { filename: "vault-classifier-tag-ui.js" });

  const cardRoot = new FakeElement("article", document);
  const entryID = "youtube:video:pushme";
  context.VaultClassifierTagUI.observe({
    platform: "youtube", entryID, creatorID: "youtube:channel:UC1",
    title: "A pending video", root: cardRoot, anchor: null
  });

  const chipNames = () => {
    const host = cardRoot.children[cardRoot.children.length - 1];
    // Chips live inside .chip-wrap spans (followed by the "+ tag" add button).
    return (closedShadows.get(host)?.children?.[1]?.children || [])
      .filter((el) => el.className === "chip-wrap")
      .map((wrap) => wrap.children[0].textContent);
  };

  setTimeout(() => {
    check("push listener registered", typeof pushListener === "function");
    check("pending answer renders the Tagging placeholder", JSON.stringify(chipNames()) === JSON.stringify(["Tagging"]), chipNames());

    const requestsBeforePush = messages.length;
    pushListener(
      {
        type: "vault-classifier-video-tags-updated",
        platform: "youtube",
        items: [{ entryID, tags: VALID_TAGS, predicted: false }]
      },
      { id: "ext" }
    );
    check("push swaps the pill in place", JSON.stringify(chipNames()) === JSON.stringify(["Games"]), chipNames());
    check("push does not trigger another request", messages.length === requestsBeforePush, messages);

    // A pushed empty result must read as the definitive "None" pill.
    pushListener(
      { type: "vault-classifier-video-tags-updated", platform: "youtube", items: [{ entryID, tags: [] }] },
      { id: "ext" }
    );
    check("pushed empty tags render the None pill", JSON.stringify(chipNames()) === JSON.stringify(["None"]), chipNames());

    // A push for a not-yet-observed video pre-fills the cache: the later
    // observe renders from it without a request round-trip.
    const prefetchedID = "youtube:video:prefetched";
    pushListener(
      { type: "vault-classifier-video-tags-updated", platform: "youtube", items: [{ entryID: prefetchedID, tags: VALID_TAGS }] },
      { id: "ext" }
    );
    const requestsBeforeObserve = messages.length;
    const prefetchedRoot = new FakeElement("article", document);
    context.VaultClassifierTagUI.observe({
      platform: "youtube", entryID: prefetchedID, creatorID: "youtube:channel:UC1",
      title: "Already pushed", root: prefetchedRoot, anchor: null
    });
    setTimeout(() => {
      const host = prefetchedRoot.children[prefetchedRoot.children.length - 1];
      const names = (closedShadows.get(host)?.children?.[1]?.children || [])
        .filter((el) => el.className === "chip-wrap")
        .map((wrap) => wrap.children[0].textContent);
      check("pushed cache serves a later observe", JSON.stringify(names) === JSON.stringify(["Games"]), names);
      check("cache hit skips the request round-trip", messages.length === requestsBeforeObserve, messages);
      finish();
    }, 20);
  }, 30);
}
