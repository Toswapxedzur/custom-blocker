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
    this.style = {
      setProperty(name, value) { this[name] = value; }
    };
    this.isConnected = true;
    this.textContent = "";
    this.className = "";
    this.dir = "";
    this.dataset = {};
    this.attributes = {};
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name]; }
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

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; FakeMutationObserver.instances.push(this); }
  observe() {}
  disconnect() {}
  static emit(records) { FakeMutationObserver.instances.forEach((observer) => observer.callback(records)); }
}
FakeMutationObserver.instances = [];

const document = {
  createElement(tagName) { return new FakeElement(tagName, document); }
};
document.documentElement = new FakeElement("html", document);

const chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      messages.push(message);
      const tags = [
        { id: "games", name: "Games", lightColorHex: "#9EC5E8", darkColorHex: "#1A4775" },
        { id: "technology", name: "Technology", lightColorHex: "#E3B4E7", darkColorHex: "#6B246F" }
      ];
      const response = message.type === "vault-classifier-video-tags-batch"
        ? {
            ok: true,
            platformID: message.platform,
            items: (Array.isArray(message.items) ? message.items : []).map((item) => ({ entryID: item.entryID, tags, predicted: false, pending: false }))
          }
        : { ok: true, platformID: message.platform, entryID: message.entryID, tags, predicted: false, pending: false };
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
  URL,
  MutationObserver: FakeMutationObserver
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
const entryID = "youtube:video:v123";
const creatorID = "youtube:channel:UC123";
const title = "A great video";

context.VaultClassifierTagUI.observe({ platform: "youtube", entryID, creatorID, title, root: firstRoot, anchor: firstAnchor });
context.VaultClassifierTagUI.observe({ platform: "youtube", entryID, creatorID, title, root: secondRoot, anchor: secondAnchor });

setTimeout(() => {
  const firstHost = firstRoot.children[1];
  const secondHost = secondRoot.children[1];
  const firstShadow = closedShadows.get(firstHost);
  const secondShadow = closedShadows.get(secondHost);
  // Chips are wrapped in .chip-wrap (for the hover delete affordance), followed
  // by the trailing "+ tag" add button. Reach into the wrap for the chip.
  const chipsOf = (shadow) => (shadow?.children?.[1]?.children || [])
    .filter((el) => el.className === "chip-wrap")
    .map((wrap) => wrap.children[0]);
  const firstNames = chipsOf(firstShadow).map((chip) => chip.textContent);
  const secondNames = chipsOf(secondShadow).map((chip) => chip.textContent);
  const firstLightColors = chipsOf(firstShadow).map((chip) => chip.style["--vault-tag-color-light"]);
  const secondLightColors = chipsOf(secondShadow).map((chip) => chip.style["--vault-tag-color-light"]);
  const firstDarkColors = chipsOf(firstShadow).map((chip) => chip.style["--vault-tag-color-dark"]);
  const secondDarkColors = chipsOf(secondShadow).map((chip) => chip.style["--vault-tag-color-dark"]);
  const pillStyle = firstShadow?.children?.[0]?.textContent || "";
  const genericHostIsPrivate = firstHost
    && firstHost.shadowRoot === null
    && firstHost.textContent === ""
    && firstHost.className === ""
    && firstHost.children.length === 0
    && !Object.values(firstHost.style).join(" ").includes("Games");
  // Two observes of the same video coalesce onto one queued request, which the
  // drain sends as a single batch carrying exactly that one video.
  const coalesced = messages.length === 1
    && messages[0].type === "vault-classifier-video-tags-batch"
    && Array.isArray(messages[0].items)
    && messages[0].items.length === 1
    && messages[0].items[0].entryID === entryID;
  const renderedEveryEntry = JSON.stringify(firstNames) === JSON.stringify(["Games", "Technology"])
    && JSON.stringify(secondNames) === JSON.stringify(["Games", "Technology"])
    && JSON.stringify(firstLightColors) === JSON.stringify(["#9EC5E8", "#E3B4E7"])
    && JSON.stringify(secondLightColors) === JSON.stringify(["#9EC5E8", "#E3B4E7"])
    && JSON.stringify(firstDarkColors) === JSON.stringify(["#1A4775", "#6B246F"])
    && JSON.stringify(secondDarkColors) === JSON.stringify(["#1A4775", "#6B246F"])
    && pillStyle.includes("border-radius:999px")
    && pillStyle.includes("background:var(--vault-tag-color-light)")
    && pillStyle.includes("color:#000")
    && pillStyle.includes("@media (prefers-color-scheme:dark)")
    && pillStyle.includes("background:var(--vault-tag-color-dark)")
    && pillStyle.includes("color:#fff");

  const firstRenderOK = coalesced && renderedEveryEntry && genericHostIsPrivate;

  // Reattach regression: the page detaches our host as it re-renders/recycles a
  // row. The reattach observer must re-mount it immediately from cache — not
  // wait for a scan — with the chips repopulated (not an empty host).
  const detachedHost = firstHost;
  detachedHost.remove();
  FakeMutationObserver.emit([{ removedNodes: [detachedHost] }]);
  const remountedHost = firstRoot.children[firstRoot.children.length - 1];
  const remountedShadow = closedShadows.get(remountedHost);
  const remountedNames = chipsOf(remountedShadow).map((chip) => chip.textContent);
  const reattached = remountedHost !== detachedHost
    && JSON.stringify(remountedNames) === JSON.stringify(["Games", "Technology"]);

  context.VaultClassifierTagUI.clearPlatform("youtube");
  const cleared = firstRoot.children.length === 1 && secondRoot.children.length === 1;

  if (firstRenderOK && reattached && cleared) {
    console.log("PASS coalesces lookups, renders closed-shadow tags, and reattaches a detached pill");
    console.log("__CB_TEST_RESULT__: OK");
    return;
  }
  console.error("FAIL source tag presenter", {
    messages, firstNames, secondNames, firstLightColors, secondLightColors,
    firstDarkColors, secondDarkColors, pillStyle, genericHostIsPrivate,
    remountedNames, reattached, cleared
  });
  console.log("__CB_TEST_RESULT__: FAIL");
  process.exitCode = 1;
}, 50);
