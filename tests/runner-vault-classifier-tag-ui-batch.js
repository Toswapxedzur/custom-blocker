/* Batching: several DISTINCT creators observed in the same tick resolve in ONE
 * batched request (not one per creator), and each card renders its own tags. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const closedShadows = new WeakMap();
const messages = [];
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
  }
  append(...children) { for (const child of children) this.appendChild(child); }
  appendChild(child) { child.parentNode = this; child.isConnected = this.isConnected; this.children.push(child); return child; }
  replaceChildren(...children) { this.children.forEach((c) => { c.parentNode = null; c.isConnected = false; }); this.children = []; this.append(...children); }
  contains(candidate) { return candidate === this || this.children.some((c) => c.contains?.(candidate)); }
  insertAdjacentElement(position, element) {
    if (position !== "afterend" || !this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    element.parentNode = this.parentNode;
    element.isConnected = this.parentNode.isConnected;
    this.parentNode.children.splice(index + 1, 0, element);
    return element;
  }
  attachShadow({ mode }) { const s = new FakeElement("shadow-root", this.ownerDocument); s.mode = mode; closedShadows.set(this, s); return s; }
  get shadowRoot() { return null; }
  remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); } this.parentNode = null; this.isConnected = false; }
}

class FakeMutationObserver { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} }

const document = { createElement(tag) { return new FakeElement(tag, document); } };
document.documentElement = new FakeElement("html", document);

const tagsBySource = {
  "youtube:channel:UCaaaaaaaaaaaaaaaaaaaaaa": [{ id: "games", name: "Games", lightColorHex: "#9EC5E8", darkColorHex: "#1A4775" }],
  "youtube:handle:@bbb": [{ id: "technology", name: "Technology", lightColorHex: "#E3B4E7", darkColorHex: "#6B246F" }]
};

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      messages.push(message);
      const items = Array.isArray(message.items) ? message.items : [];
      const response = { ok: true, platformID: message.platform, results: items.map((item) => ({ sourceID: item.sourceID, tags: tagsBySource[item.sourceID] || [] })) };
      setTimeout(() => { context.__resp = JSON.stringify(response); callback(vm.runInContext("JSON.parse(__resp)", context)); }, 5);
    }
  }
};

context = vm.createContext({ chrome, console, document, setTimeout, clearTimeout, Date, TextEncoder, URL, MutationObserver: FakeMutationObserver });
context.window = context; context.self = context; context.globalThis = context;

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-tag-ui.js"), "utf8"), context, { filename: "vault-classifier-tag-ui.js" });

const rootA = new FakeElement("article", document);
const rootB = new FakeElement("article", document);
const anchorA = rootA.appendChild(new FakeElement("a", document));
const anchorB = rootB.appendChild(new FakeElement("a", document));
const idA = "youtube:channel:UCaaaaaaaaaaaaaaaaaaaaaa";
const idB = "youtube:handle:@bbb";

// Two distinct creators observed in the same tick.
context.VaultClassifierTagUI.observe({ platform: "youtube", sourceID: idA, root: rootA, anchor: anchorA });
context.VaultClassifierTagUI.observe({ platform: "youtube", sourceID: idB, root: rootB, anchor: anchorB });

setTimeout(() => {
  const chips = (root) => closedShadows.get(root.children[root.children.length - 1])?.children?.[1]?.children?.map((c) => c.textContent);
  const namesA = chips(rootA);
  const namesB = chips(rootB);

  // ONE request carrying BOTH creators — not two requests.
  const oneBatch = messages.length === 1
    && messages[0].type === "vault-classifier-source-tags-batch"
    && Array.isArray(messages[0].items)
    && messages[0].items.length === 2;
  // Each card rendered its OWN tags from the single response.
  const renderedEach = JSON.stringify(namesA) === JSON.stringify(["Games"])
    && JSON.stringify(namesB) === JSON.stringify(["Technology"]);

  if (oneBatch && renderedEach) {
    console.log("PASS resolves multiple creators in one batched request, each rendering its own tags");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL tag-ui batch", { messageCount: messages.length, items: messages[0]?.items, namesA, namesB });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 60);
