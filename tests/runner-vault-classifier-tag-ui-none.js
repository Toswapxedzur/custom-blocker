/* A video that resolves but carries no tags renders a "Untagged" pill; a lookup that
 * fails renders Untagged, while late pushes and root reuse remain safe. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const closedShadows = new WeakMap();
let context;
const runtimeListeners = [];
const delayedTimers = [];
let virtualTime = Date.now();
class TestDate extends Date { static now() { return virtualTime; } }
let heldJob = null;
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
    this.listeners = {};
    this.rect = { left: 10, right: 80, top: 10, bottom: 30 };
  }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  fire(type, event) { for (const listener of this.listeners[type] || []) listener(event); }
  getBoundingClientRect() { return this.rect; }
  getRootNode() { let node = this; while (node.parentNode) node = node.parentNode; return node; }
  closest(selector) {
    const names = selector.split(",").map(s => s.trim().slice(1));
    for (let node = this; node; node = node.parentNode) if (names.some(name => node.className.split(/\s+/).includes(name))) return node;
    return null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
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
    shadow.host = this;
    closedShadows.set(this, shadow);
    return shadow;
  }
  get classList() {
      return { toggle: (name, enabled) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        if (enabled) names.add(name); else names.delete(name);
        this.className = [...names].join(" ");
      } };
    }
    querySelectorAll(selector) {
      const found = [];
      const visit = (node) => {
        for (const child of node.children) {
          const matches = selector.startsWith(".")
            ? child.className.split(/\s+/).includes(selector.slice(1))
            : child.tagName === selector.toUpperCase();
          if (matches) found.push(child);
          visit(child);
        }
      };
      visit(this);
      return found;
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

const document = {
  listeners: {},
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); },
  fire(type, event) { for (const listener of this.listeners[type] || []) listener(event); },
  createElement(tagName) { return new FakeElement(tagName, document); }
};
document.documentElement = new FakeElement("html", document);

const chrome = {
  runtime: {
    lastError: null,
    onMessage: { addListener(callback) { runtimeListeners.push(callback); } },
    sendMessage(message, callback) {
      if (batchOutcome === "hold" && message.type === "vault-classifier-video-tags-batch") { heldJob = { message, callback }; return; }
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
  chrome, console, document, setTimeout: (fn, delay) => delay > 1000 ? (delayedTimers.push(fn), -delayedTimers.length) : setTimeout(fn, delay), clearTimeout, Date: TestDate, TextEncoder, URL,
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

// Phase 1: a classified video with no tags renders exactly one "Untagged" chip.
const noneRoot = new FakeElement("article", document);
const noneAnchor = noneRoot.appendChild(new FakeElement("a", document));
batchOutcome = "empty";
context.VaultClassifierTagUI.observe({ platform: "youtube", entryID: "youtube:video:vnone", creatorID: "youtube:channel:UCnone", title: "A video title", root: noneRoot, anchor: noneAnchor });

setTimeout(() => {
  const noneNames = chipNamesFor(noneRoot);
  const rendersNone = JSON.stringify(noneNames) === JSON.stringify(["Untagged"]);

  // Phase 2: a failed lookup renders Untagged and remains retryable.
  const failRoot = new FakeElement("article", document);
  const failAnchor = failRoot.appendChild(new FakeElement("a", document));
  batchOutcome = "fail";
  context.VaultClassifierTagUI.observe({ platform: "youtube", entryID: "youtube:video:vfail", creatorID: "youtube:channel:UCfail", title: "A video title", root: failRoot, anchor: failAnchor });

  setTimeout(() => {
    // Only the anchor remains; no pill host was appended.
    const failBlank = JSON.stringify(chipNamesFor(failRoot)) === JSON.stringify(["Untagged"]) && context.vaultTagsSettledForCard(failRoot);

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
        console.log("PASS tagless video -> Untagged; failed lookup -> Untagged; pending video -> Tagging placeholder");
        void raceChecks();
        return;
      }
      console.error("FAIL none/tagging pill", { noneNames, rendersNone, failChildren: failRoot.children.length, pendingNames, rendersTagging });
      console.log("__CB_TEST_RESULT__: FAIL");
      process.exitCode = 1;
    }, 40);
  }, 40);
}, 40);

async function raceChecks() {
  const wait = () => new Promise(resolve => setTimeout(resolve, 20));
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  try {
    const root = new FakeElement("article", document);
    batchOutcome = "hold";
    context.VaultClassifierTagUI.observe({ platform: "reddit", entryID: "reddit:post:race1", title: "", root });
    check(JSON.stringify(chipNamesFor(root)) === '["Tagging"]', "recognition renders immediately without title");
    await wait(); check(!heldJob, "classification waits for title evidence");
    context.VaultClassifierTagUI.observe({ platform: "reddit", entryID: "reddit:post:race1", title: "Hydrated title", root });
    await wait(); check(heldJob, "hydrated title starts classification");
    const old = heldJob;
    const pushed = { type: "vault-classifier-video-tags-updated", platform: "reddit", items: [{ entryID: "reddit:post:race1", tags: [{ id: "science", name: "Science", lightColorHex: "#E5E7EB", darkColorHex: "#3F3F46" }] }] };
    runtimeListeners.forEach(listener => listener(pushed, {}));
    old.callback({ ok: true, platformID: "reddit", items: [{ entryID: "reddit:post:race1", pending: true, tags: [] }] });
    await wait(); check(JSON.stringify(chipNamesFor(root)) === '["Science"]', "late pending reply cannot overwrite pushed tags");
    const shadow = closedShadows.get(root.children.find(child => closedShadows.has(child)));
    const wrap = shadow.querySelector(".chip-wrap"), chip = shadow.querySelector(".chip"), del = shadow.querySelector(".chip-del");
    del.rect = { left: 74, right: 88, top: 4, bottom: 18 };
    const hovered = element => element.className.split(/\s+/).includes("pointer-hover");
    for (let index = 0; index < 100; index++) {
      const event = { target: chip, clientX: 20 + index % 50, clientY: 20 };
      shadow.fire("pointermove", event); shadow.fire("pointerout", event);
      check(hovered(wrap), "continuous in-pill movement and false leave retain the delete affordance");
    }
    shadow.fire("pointerout", { target: chip, clientX: 85, clientY: 8 });
    check(hovered(wrap), "moving onto the protruding delete button retains its visibility");
    shadow.fire("pointerout", { target: chip, clientX: 100, clientY: 40 });
    check(!hovered(wrap), "an actual leave clears the pill highlight");
    const add = shadow.querySelector(".add-btn");
    shadow.fire("pointerover", { target: add, clientX: 20, clientY: 20 });
    shadow.fire("pointerout", { target: add, clientX: 40, clientY: 20 });
    check(hovered(add), "Plus Tag is stable across a false leave");
    const row = new FakeElement("button", document); row.className = "panel-item"; shadow.append(row);
    shadow.fire("pointermove", { target: row, clientX: 20, clientY: 20 });
    shadow.fire("pointerout", { target: row, clientX: 40, clientY: 20 });
    check(hovered(row) && !hovered(add), "chooser rows share stable highlighting and clear the previous control");
    shadow.fire("pointerout", { target: row, clientX: 100, clientY: 40 });
    check(!hovered(row), "leaving the chooser row clears highlighting");
    shadow.fire("pointerover", { target: row, clientX: 20, clientY: 20 });
    document.fire("pointermove", { target: root, clientX: 150, clientY: 80 });
    check(!hovered(row), "movement outside the private shadow clears highlighting even without a boundary event");
    console.log("PASS 100 continuous in-pill moves, false leaves, delete-button hit area, Plus Tag and chooser rows");
    heldJob = null;
    context.VaultClassifierTagUI.observe({ platform: "reddit", entryID: "reddit:post:race1", title: "Hydrated title", root });
    await wait(); check(JSON.stringify(chipNamesFor(root)) === '["Science"]' && !heldJob, "hydration keeps settled tags without another lookup");
    context.VaultClassifierTagUI.observe({ platform: "reddit", entryID: "reddit:post:race2", title: "Another post", root });
    await wait(); const second = heldJob;
    check(JSON.stringify(chipNamesFor(root)) === '["Tagging"]', "recycled root starts new identity");
    context.VaultClassifierTagUI.observe({ platform: "reddit", entryID: "reddit:post:race3", title: "Third post", root });
    await wait();
    second.callback({ ok: true, platformID: "reddit", items: [{ entryID: "reddit:post:race2", tags: [{ id: "old", name: "Old post", lightColorHex: "#E5E7EB", darkColorHex: "#3F3F46" }] }] });
    await wait(); check(JSON.stringify(chipNamesFor(root)) === '["Tagging"]', "old root response cannot affect recycled post");
    context.VaultClassifierTagUI.clearPlatform("reddit");
    batchOutcome = "pending";
    context.VaultClassifierTagUI.clearPlatform("youtube");
    const timeoutRoot = new FakeElement("article", document);
    context.VaultClassifierTagUI.observe({ platform: "youtube", entryID: "youtube:video:timeout", title: "Never finishes", root: timeoutRoot });
    await wait();
    for (let attempt = 0; attempt < 22; attempt++) {
      virtualTime += 3000;
      const timers = delayedTimers.splice(0); timers.forEach(fn => fn());
      await wait();
    }
    check(JSON.stringify(chipNamesFor(timeoutRoot)) === '["Untagged"]', "bounded pending timeout outputs Untagged");
    context.VaultClassifierTagUI.clearPlatform("youtube");
    console.log("PASS immediate recognition, evidence readiness, push ordering, stable hydration and recycled Reddit roots");
    console.log("__CB_TEST_RESULT__: OK");
  } catch (error) { console.error(error); process.exitCode = 1; console.log("__CB_TEST_RESULT__: FAIL"); }
}
