/* Resilience: when the batch op is unavailable (e.g. a stale service worker that
 * predates it), the tag UI falls back to single source-tags requests — which
 * every build handles — so pills still render instead of blanking. */
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

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      messages.push(message);
      let response;
      if (message.type === "vault-classifier-source-tags-batch") {
        response = { ok: false };                       // stale worker: batch op unknown
      } else if (message.type === "vault-classifier-source-tags") {
        response = { ok: true, platformID: message.platform, sourceID: message.sourceID,
          tags: [{ id: "games", name: "Games", lightColorHex: "#9EC5E8", darkColorHex: "#1A4775" }] };
      } else {
        response = { ok: false };
      }
      setTimeout(() => { context.__resp = JSON.stringify(response); callback(vm.runInContext("JSON.parse(__resp)", context)); }, 5);
    }
  }
};

context = vm.createContext({ chrome, console, document, setTimeout, clearTimeout, Date, TextEncoder, URL, MutationObserver: FakeMutationObserver });
context.window = context; context.self = context; context.globalThis = context;

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-tag-ui.js"), "utf8"), context, { filename: "vault-classifier-tag-ui.js" });

const rootA = new FakeElement("article", document);
const anchorA = rootA.appendChild(new FakeElement("a", document));
const idA = "youtube:handle:@creator";
context.VaultClassifierTagUI.observe({ platform: "youtube", sourceID: idA, root: rootA, anchor: anchorA });

setTimeout(() => {
  const names = closedShadows.get(rootA.children[rootA.children.length - 1])?.children?.[1]?.children?.map((c) => c.textContent);
  const triedBatch = messages.some((m) => m.type === "vault-classifier-source-tags-batch");
  const fellBackToSingle = messages.some((m) => m.type === "vault-classifier-source-tags" && m.sourceID === idA);
  const rendered = JSON.stringify(names) === JSON.stringify(["Games"]);

  if (triedBatch && fellBackToSingle && rendered) {
    console.log("PASS falls back to single requests when the batch op is unavailable, still rendering the pill");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL tag-ui batch fallback", { triedBatch, fellBackToSingle, rendered, names, types: messages.map((m) => m.type) });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 60);
