/* A video that resolves but carries no tags renders a "None" pill; a lookup that
 * fails renders nothing (and never a misleading "None"). */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const closedShadows = new WeakMap();
let context;
let batchOutcome = "empty"; // "empty" -> tags:[]; "fail" -> ok:false everywhere

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
    this.attributes = {};
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
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

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
  disconnect() {}
}

const document = { createElement(tagName) { return new FakeElement(tagName, document); } };
document.documentElement = new FakeElement("html", document);

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      let response;
      if (batchOutcome === "empty" && message.type === "vault-classifier-video-tags-batch") {
        // The video was classified; the app simply produced no tags for it.
        response = {
          ok: true,
          platformID: message.platform,
          items: (Array.isArray(message.items) ? message.items : []).map((item) => ({ entryID: item.entryID, tags: [], predicted: false, pending: false }))
        };
      } else if (batchOutcome === "pending" && message.type === "vault-classifier-video-tags-batch") {
        // The app has queued classification and reports the video as pending.
        response = {
          ok: true,
          platformID: message.platform,
          items: (Array.isArray(message.items) ? message.items : []).map((item) => ({ entryID: item.entryID, tags: [], predicted: false, pending: true }))
        };
      } else {
        // Batch unavailable + single fallback both fail (bridge down).
        response = { ok: false, items: [], tags: [] };
      }
      setTimeout(() => {
        context.__noneResponse = JSON.stringify(response);
        callback(vm.runInContext("JSON.parse(__noneResponse)", context));
      }, 5);
    }
  }
};

context = vm.createContext({
  chrome, console, document, setTimeout, clearTimeout, Date, TextEncoder, URL,
  MutationObserver: FakeMutationObserver
});
context.window = context;
context.self = context;
context.globalThis = context;

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-tag-ui.js"), "utf8"), context, { filename: "vault-classifier-tag-ui.js" });

function chipNamesFor(hostRoot) {
  const host = hostRoot.children[hostRoot.children.length - 1];
  const shadow = closedShadows.get(host);
  // Chips are wrapped in .chip-wrap; the trailing "+ tag" add button is excluded.
  return (shadow?.children?.[1]?.children || [])
    .filter((el) => el.className === "chip-wrap")
    .map((wrap) => wrap.children[0].textContent);
}

// Phase 1: a classified video with no tags renders exactly one "None" chip.
const noneRoot = new FakeElement("article", document);
const noneAnchor = noneRoot.appendChild(new FakeElement("a", document));
batchOutcome = "empty";
context.VaultClassifierTagUI.observe({ platform: "youtube", entryID: "youtube:video:vnone", creatorID: "youtube:channel:UCnone", title: "A video title", root: noneRoot, anchor: noneAnchor });

setTimeout(() => {
  const noneNames = chipNamesFor(noneRoot);
  const rendersNone = JSON.stringify(noneNames) === JSON.stringify(["None"]);

  // Phase 2: a failed lookup renders nothing — never a misleading "None".
  const failRoot = new FakeElement("article", document);
  const failAnchor = failRoot.appendChild(new FakeElement("a", document));
  batchOutcome = "fail";
  context.VaultClassifierTagUI.observe({ platform: "youtube", entryID: "youtube:video:vfail", creatorID: "youtube:channel:UCfail", title: "A video title", root: failRoot, anchor: failAnchor });

  setTimeout(() => {
    // Only the anchor remains; no pill host was appended.
    const failBlank = failRoot.children.length === 1;

    // Phase 3: a video the app is still classifying (pending) shows exactly one
    // temporary "Tagging" placeholder chip.
    const pendingRoot = new FakeElement("article", document);
    const pendingAnchor = pendingRoot.appendChild(new FakeElement("a", document));
    batchOutcome = "pending";
    context.VaultClassifierTagUI.observe({ platform: "youtube", entryID: "youtube:video:vpending", creatorID: "youtube:channel:UCpending", title: "A video title", root: pendingRoot, anchor: pendingAnchor });

    setTimeout(() => {
      const pendingNames = chipNamesFor(pendingRoot);
      const rendersTagging = JSON.stringify(pendingNames) === JSON.stringify(["Tagging"]);

      if (rendersNone && failBlank && rendersTagging) {
        console.log("PASS tagless video -> None; failed lookup -> blank; pending video -> Tagging placeholder");
        console.log("__CB_TEST_RESULT__: OK");
        return;
      }
      console.error("FAIL none/tagging pill", { noneNames, rendersNone, failChildren: failRoot.children.length, pendingNames, rendersTagging });
      console.log("__CB_TEST_RESULT__: FAIL");
      process.exitCode = 1;
    }, 40);
  }, 40);
}, 40);
