/* content.js page-verdict seam: block = black out the player in place (video kept
   paused, correctable); allow lifts it; only the entry that IS this page may act. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
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
function extractDecl(name) {
  const m = source.match(new RegExp(`^(?:const|let) ${name} = .*;$`, "m"));
  if (!m) throw new Error(`missing decl ${name}`);
  return m[0];
}

class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.className = ""; this.listeners = []; this.attrs = {};
    const self = this;
    this.style = { position: "", setProperty(k, v) { this[k] = v; }, removeProperty(k) { this[k] = ""; } }; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = v; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  querySelector(sel) { return sel === ":scope > .cb-block-panel" ? (this.children.find((c) => c.className === "cb-block-panel") || null) : null; }
  querySelectorAll(sel) { return sel === "video" ? this.children.filter((c) => c.tag === "video") : []; }
  addEventListener(type, fn, capture) { this.listeners.push({ type, fn, capture }); }
  removeEventListener(type, fn) { this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn)); }
}
class FakeVideo extends FakeEl {
  constructor() { super("video"); this.pauses = 0; }
  pause() { this.pauses += 1; }
}

const document = {
  player: null,
  querySelector(sel) { return sel.includes("#movie_player") ? this.player : null; },
  createElement(tag) { return new FakeEl(tag); }
};
const context = vm.createContext({
  URLSearchParams, setTimeout, clearTimeout, document,
  getComputedStyle: () => ({ position: "static" }),
  location: { href: "https://www.youtube.com/watch?v=abc123", search: "?v=abc123", pathname: "/watch" }
});
vm.runInContext([
  extractDecl("CB_PAGE_PLAYER_SELECTORS"), extractDecl("CB_PAGE_BLOCK_RETRY_MS"), extractDecl("CB_PAGE_BLOCK_RETRIES"),
  "let cbTagPageBlockedEntry = \"\";", "let cbTagPageRetryTimer = null;",
  extractFunction("cbEnsureRelative"), extractFunction("cbTagPageEntryMatchesLocation"), extractFunction("cbFindPagePlayer"),
  extractFunction("cbKeepPausedWhileBlocked"), extractFunction("cbBlackOutPagePlayer"), extractFunction("cbClearPagePlayer"),
  extractFunction("cbApplyTagPagePolicy")
].join("\n"), context);

const root = new FakeEl("ytd-watch-metadata");
context.__root = root;
const apply = (action, entryID) => vm.runInContext(`cbApplyTagPagePolicy(__root, ${JSON.stringify(action)}, { entryID: ${JSON.stringify(entryID)} })`, context);
const matches = (entryID, loc) => vm.runInContext(`cbTagPageEntryMatchesLocation(${JSON.stringify(entryID)}, ${JSON.stringify(loc)})`, context);
const panelOf = (player) => player.children.find((c) => c.className === "cb-block-panel") || null;
const newPlayer = () => { const p = new FakeEl("div"); p.video = p.appendChild(new FakeVideo()); return p; };

let pass = 0; let fail = 0;
function check(label, ok) { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label}`); } }

check("matches watch ?v=", matches("youtube:video:abc123", { search: "?v=abc123", pathname: "/watch" }));
check("matches /shorts/<id>", matches("youtube:video:abc123", { search: "", pathname: "/shorts/abc123" }));
check("rejects a different video", !matches("youtube:video:other", { search: "?v=abc123", pathname: "/watch" }));
check("rejects an id that is only a substring", !matches("youtube:video:bc12", { search: "?v=abc123", pathname: "/watch" }));

document.player = newPlayer();
check("allow with nothing blocked is a no-op", apply("allow", "youtube:video:abc123") === false && !panelOf(document.player));
check("dim never blacks out a page", apply("dim", "youtube:video:abc123") === false && !panelOf(document.player));
check("a stale entry (previous SPA page) never blacks out this page", apply("block", "youtube:video:previous") === false && !panelOf(document.player) && root.dataset.cbContentBlocked === undefined);

const blocked = apply("block", "youtube:video:abc123");
const panel = panelOf(document.player);
check("block for the page's own entry blacks out the player and pauses the video", blocked === true && panel && panel.attrs.style.includes("background:#000") && document.player.video.pauses === 1 && document.player.style.position === "relative");
check("the observed root carries the blocked marker (so the pill can see it)", root.dataset.cbContentBlocked === "true");
const playListener = document.player.video.listeners.find((l) => l.type === "play" && l.capture === true);
if (playListener) playListener.fn({ target: document.player.video });
check("an attempt to play while blocked is paused right back", document.player.video.pauses === 2);
check("a second block is idempotent (one panel)", apply("block", "youtube:video:abc123") === true && document.player.children.filter((c) => c.className === "cb-block-panel").length === 1);

apply("allow", "youtube:video:abc123");
check("correcting the tag (allow) lifts the blackout, restores position, unhooks play", !panelOf(document.player) && root.dataset.cbContentBlocked === undefined && document.player.video.listeners.length === 0 && document.player.style.position === "");
const pausesBeforePlay = document.player.video.pauses;
if (playListener) playListener.fn({ target: document.player.video });
check("after the lift, play is not paused any more", document.player.video.pauses === pausesBeforePlay);

apply("block", "youtube:video:abc123");
context.location = { href: "https://www.youtube.com/watch?v=next9", search: "?v=next9", pathname: "/watch" };
apply("allow", "youtube:video:next9");
check("navigating to a new (allowed) video lifts the previous page's blackout", !panelOf(document.player) && root.dataset.cbContentBlocked === undefined);

// Player not rendered yet: the block waits for it (bounded retry).
document.player = null;
const early = apply("block", "youtube:video:next9");
setTimeout(() => { document.player = newPlayer(); }, 350);
setTimeout(() => {
  check("a block that arrives before the player renders blacks it out once it appears", early === true && document.player && panelOf(document.player) && document.player.video.pauses === 1);
  apply("allow", "youtube:video:next9");
  console.log(`CONTENT PAGE VERDICT TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
}, 1100);
