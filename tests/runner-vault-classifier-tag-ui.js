/* Closed-shadow, coalescing regression tests for source tag annotations. */
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
    this.style = {};
    this.isConnected = true;
    this.textContent = "";
    this.className = "";
    this.dir = "";
  }
  append(...children) {
    for (const child of children) this.appendChild(child);
  }
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
  contains(candidate) {
    return candidate === this || this.children.some((child) => child.contains?.(candidate));
  }
  insertAdjacentElement(position, element) {
    if (position !== "afterend" || !this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    element.parentNode = this.parentNode;
    element.isConnected = this.parentNode.isConnected;
    this.parentNode.children.splice(index + 1, 0, element);
    return element;
  }
  attachShadow({ mode }) {
    const shadow = new FakeElement("shadow-root", this.ownerDocument);
    shadow.mode = mode;
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

const document = {
  createElement(tagName) { return new FakeElement(tagName, document); }
};

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      messages.push(message);
      const response = {
        ok: true,
        platformID: message.platform,
        sourceID: message.sourceID,
        tags: [
          { id: "games", name: "Games" },
          { id: "technology", name: "Technology" }
        ]
      };
      setTimeout(() => {
        context.__tagResponse = JSON.stringify(response);
        callback(vm.runInContext("JSON.parse(__tagResponse)", context));
      }, 5);
    }
  }
};

context = vm.createContext({
  chrome,
  console,
  document,
  setTimeout,
  clearTimeout,
  Date,
  TextEncoder,
  URL
});
context.window = context;
context.self = context;
context.globalThis = context;

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-tag-ui.js"), "utf8"), context, { filename: "vault-classifier-tag-ui.js" });

const firstRoot = new FakeElement("article", document);
const secondRoot = new FakeElement("article", document);
const firstAnchor = firstRoot.appendChild(new FakeElement("a", document));
const secondAnchor = secondRoot.appendChild(new FakeElement("a", document));
const sourceID = "youtube:channel:UC123";

context.VaultClassifierTagUI.observe({ platform: "youtube", sourceID, root: firstRoot, anchor: firstAnchor });
context.VaultClassifierTagUI.observe({ platform: "youtube", sourceID, root: secondRoot, anchor: secondAnchor });

setTimeout(() => {
  const firstHost = firstRoot.children[1];
  const secondHost = secondRoot.children[1];
  const firstShadow = closedShadows.get(firstHost);
  const secondShadow = closedShadows.get(secondHost);
  const firstNames = firstShadow?.children?.[1]?.children?.map((chip) => chip.textContent);
  const secondNames = secondShadow?.children?.[1]?.children?.map((chip) => chip.textContent);
  const genericHostIsPrivate = firstHost
    && firstHost.shadowRoot === null
    && firstHost.textContent === ""
    && firstHost.className === ""
    && firstHost.children.length === 0
    && !Object.values(firstHost.style).join(" ").includes("Games");
  const coalesced = messages.length === 1
    && messages[0].type === "vault-classifier-source-tags"
    && messages[0].sourceID === sourceID;
  const renderedEveryEntry = JSON.stringify(firstNames) === JSON.stringify(["Games", "Technology"])
    && JSON.stringify(secondNames) === JSON.stringify(["Games", "Technology"]);

  context.VaultClassifierTagUI.clearPlatform("youtube");
  const cleared = firstRoot.children.length === 1 && secondRoot.children.length === 1;
  if (coalesced && renderedEveryEntry && genericHostIsPrivate && cleared) {
    console.log("PASS coalesces source lookups and renders private closed-shadow tags on every entry");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL source tag presenter", {
    messages,
    firstNames,
    secondNames,
    genericHostIsPrivate,
    cleared
  });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 50);
