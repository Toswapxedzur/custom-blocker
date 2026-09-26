/* The in-place cover (content.js): a blocked page is covered by a modal dialog,
   its media paused, the page inert underneath and the tab muted through the
   worker; the pause action counts down to Continue; the snooze button runs
   the group's confirmation steps; lifting restores the page untouched. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "content.js"), "utf8");
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  let depth = 0; let i = source.indexOf("{", start);
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") { depth -= 1; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}
function extractConst(name) {
  const start = source.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`missing const ${name}`);
  const end = source.indexOf("\n};", start);
  return source.slice(start, end + 3);
}
function extractLine(prefix) {
  const start = source.indexOf(prefix);
  if (start < 0) throw new Error(`missing ${prefix}`);
  return source.slice(start, source.indexOf("\n", start));
}

// A DOM small enough to read: elements with children, attributes, inert, a
// dialog that knows open/showModal/close, media that knows paused.
class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; this.attrs = {}; this.style = {}; this.listeners = {}; this.className = ""; this._text = ""; this.inert = false; this.paused = true; this.disabled = false; this.open = false; this.shadowRoot = null; }
  // Like the DOM: setting textContent replaces every child.
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); for (const c of this.children) c.parentElement = null; this.children = []; }
  get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n === doc.documentElement; }
  appendChild(k) { if (k.parentElement) k.remove(); k.parentElement = this; this.children.push(k); return k; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this); this.parentElement = null; }
  setAttribute(n, v) { this.attrs[n] = v; }
  getAttribute(n) { return this.attrs[n] ?? null; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((f) => f !== fn); }
  dispatch(t, event = {}) { for (const fn of this.listeners[t] || []) fn({ type: t, target: this, preventDefault() { event.prevented = true; }, ...event }); return event; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatch("close"); }
  pause() { this.paused = true; }
  play() { this.paused = false; doc.dispatch("play", { target: this }); }
  all(out = []) { for (const c of this.children) { out.push(c); c.all(out); } return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const nodes = this.all();
    if (sel === "video, audio, *") return nodes;
    const m = sel.match(/^\.([\w-]+)$/); if (m) return nodes.filter((n) => n.className.split(/\s+/).includes(m[1]));
    return nodes.filter((n) => n.tagName === sel.toUpperCase());
  }
  click() { this.dispatch("click"); }
}
const doc = new El("#document");
doc.documentElement = new El("html"); doc.documentElement.parentElement = null;
doc.body = new El("body"); doc.documentElement.appendChild(doc.body);
doc.hidden = false; doc.fullscreenElement = null; doc.pictureInPictureElement = null;
doc.listeners = {};
doc.addEventListener = (t, fn) => { (doc.listeners[t] ||= []).push(fn); };
doc.removeEventListener = (t, fn) => { doc.listeners[t] = (doc.listeners[t] || []).filter((f) => f !== fn); };
doc.dispatch = (t, event) => { for (const fn of doc.listeners[t] || []) fn({ type: t, ...event }); };
doc.createElement = (tag) => new El(tag);
doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);
doc.querySelector = (sel) => doc.documentElement.querySelector(sel);
doc.exitFullscreen = () => { doc.fullscreenElement = null; };
doc.exitPictureInPicture = () => { doc.pictureInPictureElement = null; };

const sent = [];
const timers = { intervals: new Map(), next: 1 };
const ctx = vm.createContext({
  document: doc,
  window: { setInterval: (fn, ms) => { const id = timers.next++; timers.intervals.set(id, { fn, ms }); return id; }, clearInterval: (id) => timers.intervals.delete(id) },
  MutationObserver: class { constructor(fn) { this.fn = fn; } observe() { ctx.__observer = this; } disconnect() { ctx.__observer = null; } },
  location: { href: "https://example.com/a", replaced: null, replace(url) { this.replaced = url; } },
  chrome: { runtime: { id: "t", getURL: (p) => "chrome-extension://t/" + p, sendMessage: (m, cb) => { sent.push(m); if (cb) cb({ ok: true, snooze: { startsAtMs: Date.now() } }); }, lastError: null } },
  Date, Number, Math, String, Boolean, Array, console: { log() {}, error() {} }
});
const code = [
  "let overlay = null; let exitAttempted = false; let extensionContextInvalid = false;",
  "function isExtensionContextValid() { return true; }",
  "function shutdownContentScript() {}",
  "let refreshCalls = 0; function refreshSession() { refreshCalls += 1; }",
  extractFunction("safeSendMessage"),
  extractLine("const CB_COVER_ID"), extractLine("const CB_SNOOZE_CONFIRM_INTERVAL_MS"),
  extractConst("cbCover"),
  ...["cbAllMedia", "cbPauseAllMedia", "cbCoverIsUp", "cbCoverStyle", "cbCoverElement", "cbShowCover", "cbReopenCover", "cbStopCoverTimers", "cbHideCover", "cbRenderCover", "cbCoverSnoozePress", "cbApplyExit", "attemptExitPage", "cbCustomCoverUp"].map(extractFunction)
].join("\n");
vm.runInContext(code, ctx, { filename: "content-cover-extract.js" });
const run = (expr) => vm.runInContext(expr, ctx);

let pass = 0; let fail = 0;
const show = (v) => { try { return typeof v === "string" ? v : JSON.stringify(v, (k, val) => (val instanceof El ? `<${val.tagName} ${val.className} open=${val.open}>` : val)); } catch { return String(v); } };
const check = (label, ok, detail) => { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label} — ${show(detail)}`); } };
const tick = (id) => { const t = timers.intervals.get(id); if (t) t.fn(); };
const dialog = () => doc.documentElement.children.find((c) => c.tagName === "DIALOG") || null;
const buttons = () => dialog() ? dialog().querySelectorAll("button") : [];

// Page content: an app root with a playing video, a text input holding a draft.
const app = new El("div"); app.className = "app"; doc.body.appendChild(app);
const video = new El("video"); video.paused = false; app.appendChild(video);
const host = new El("x-player"); host.shadowRoot = new El("#shadow"); const inner = new El("audio"); inner.paused = false; host.shadowRoot.appendChild(inner); app.appendChild(host);
const input = new El("input"); input.value = "half-written search"; app.appendChild(input);

// 1. Cover
run(`cbApplyExit({ action: "cover", target: "", message: "Go work", groupId: "g1", groupName: "Sites", allowSnooze: true, snoozeConfirmations: 2, snoozePhase: "none" })`);
check("a cover is a modal dialog in the top layer", dialog() && dialog().open === true && dialog().id === "cb-vault-cover", dialog());
check("the page underneath is inert, its content untouched", app.inert === true && input.value === "half-written search" && dialog().inert === false);
check("every video and audio is paused, shadow roots included", video.paused === true && inner.paused === true);
video.play();
check("media the site restarts under the cover is paused again", video.paused === true);
check("the worker is told to mute the tab", sent.some((m) => m.type === "cover-state" && m.covered === true), sent);
check("the message and the group show on the cover", dialog().querySelectorAll("h1")[0].textContent === "Go work" && dialog().querySelectorAll("p").some((p) => p.textContent === "Blocked by Sites"));
check("the cover does not poll: the worker pushes when the block lifts", ![...timers.intervals.values()].some((t) => t.ms === 3000));
check("no navigation happened", ctx.location.replaced === null);
// The site removes the cover → it is put back.
dialog().remove(); ctx.__observer.fn();
check("a removed cover is put back", dialog() !== null && dialog().open === true);
dialog().dispatch("cancel", {});
check("Escape does not dismiss it", dialog().open === true);

// 2. Snooze with two confirmation steps, 5 s apart.
let snooze = buttons().find((b) => b.className === "cb-snooze-button");
check("the cover carries the Snooze button only (no settings)", snooze && snooze.textContent === "Start Snooze" && !dialog().querySelectorAll("input").length);
snooze.click(); snooze = buttons().find((b) => b.className === "cb-snooze-button");
check("the first press starts the confirmation steps and waits", snooze.disabled === true && /Confirm \(2 left/.test(snooze.textContent), snooze.textContent);
run("cbCover.nextConfirmAt = Date.now() - 1; cbRenderCover();"); snooze = buttons().find((b) => b.className === "cb-snooze-button");
check("after the interval a confirmation can be given", snooze.disabled === false);
snooze.click(); run("cbCover.nextConfirmAt = Date.now() - 1; cbRenderCover();"); snooze = buttons().find((b) => b.className === "cb-snooze-button");
check("one step left", /Confirm \(1 left/.test(snooze.textContent), snooze.textContent);
snooze.click();
check("the last step asks the worker to start the snooze", sent.some((m) => m.type === "start-snooze" && m.groupId === "g1"), sent);
check("…and re-asks for the session", run("refreshCalls") >= 1);

// 3. Lift
run(`cbApplyExit(null)`);
check("lifting removes the dialog, un-inerts the page, unmutes", dialog() === null && app.inert === false && sent.at(-1).type === "cover-state" && sent.at(-1).covered === false);
check("nothing resumes on its own", video.paused === true);
check("the poll stops", timers.intervals.size === 0, [...timers.intervals.values()]);

// 4. Pause: countdown then Continue, which asks for a pass.
run(`cbApplyExit({ action: "pause", target: "", message: "", groupId: "p1", groupName: "News", pauseSeconds: 3, allowSnooze: false, snoozeConfirmations: 0, snoozePhase: "none" })`);
let go = buttons().find((b) => b.className === "cb-continue");
check("a pause cover counts down with Continue disabled", go && go.disabled === true && /Continue in 3s/.test(go.textContent) && !buttons().some((b) => b.className === "cb-snooze-button"), go && go.textContent);
const countdown = [...timers.intervals.entries()].find(([, t]) => t.ms === 1000)[0];
tick(countdown); tick(countdown); tick(countdown);
go = buttons().find((b) => b.className === "cb-continue");
check("after the countdown Continue is enabled", go.disabled === false && go.textContent === "Continue");
go.click();
check("Continue asks the worker for a pass and re-asks for the session", sent.some((m) => m.type === "pause-pass"));
run(`cbApplyExit(null)`);

// 5. Navigate
run(`cbApplyExit({ action: "navigate", target: "https://focus.example.org/", message: "", groupId: "g2", groupName: "Go" })`);
check("an address leaves the page", ctx.location.replaced === "https://focus.example.org/" && dialog() === null);

// 6. A custom rule's block: plain cover, no snooze.
run("exitAttempted = false; attemptExitPage();");
check("a custom rule's block is the plain cover without snooze", dialog() && dialog().querySelectorAll("h1")[0].textContent === "Blocked" && !buttons().some((b) => b.className === "cb-snooze-button"));
check("…and is marked as the rule's, so the worker's updates leave it up", run("cbCustomCoverUp()") === true);
run(`cbApplyExit({ action: "cover", target: "", message: "", groupId: "g1", groupName: "Sites", allowSnooze: false, snoozeConfirmations: 0, snoozePhase: "none" })`);
check("a worker block replaces it (and is not the rule's)", run("cbCustomCoverUp()") === false && run("cbCover.exit.groupName") === "Sites");

console.log(`CONTENT COVER TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
