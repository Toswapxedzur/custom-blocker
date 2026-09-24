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
// A multi-line `const NAME = Object.freeze({ … });` block.
function extractBlock(name) {
  const start = source.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`missing block ${name}`);
  const end = source.indexOf("\n});", start);
  return source.slice(start, end + 4);
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
  contains(node) { for (let n = node; n; n = n.parent) if (n === this) return true; return false; }
  addEventListener(type, fn, capture) { this.listeners.push({ type, fn, capture }); }
  removeEventListener(type, fn) { this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn)); }
}
class FakeVideo extends FakeEl {
  constructor() { super("video"); this.pauses = 0; }
  pause() { this.pauses += 1; }
}

const document = {
  player: null,
  // A document-level lookup answers the YouTube and Bilibili player selectors.
  querySelector(sel) { return (sel.includes("#movie_player") || sel.includes("#bilibili-player")) ? this.player : null; },
  querySelectorAll(sel) { const p = this.querySelector(sel); return p ? [p] : []; },
  createElement(tag) { return new FakeEl(tag); }
};
const context = vm.createContext({
  URLSearchParams, setTimeout, clearTimeout, document,
  getComputedStyle: () => ({ position: "static" }),
  location: { hostname: "www.youtube.com", href: "https://www.youtube.com/watch?v=abc123", search: "?v=abc123", pathname: "/watch" }
});
vm.runInContext([
  extractBlock("CB_CONTENT_BLOCK_PROFILES"), extractDecl("CB_PAGE_BLOCK_RETRY_MS"), extractDecl("CB_PAGE_BLOCK_RETRIES"),
  "let cbTagPageBlockedEntry = \"\";", "let cbTagPageRetryTimer = null;",
  extractFunction("cbContentBlockPlatformID"), extractFunction("cbContentBlockProfile"), extractFunction("cbFindMediaAll"), extractFunction("cbFindMedia"),
  extractFunction("cbEnsureRelative"), extractFunction("cbCoverMedia"), extractFunction("cbUncoverMedia"),
  extractFunction("cbTagPageEntryMatchesLocation"), extractFunction("cbFindPagePlayers"), extractFunction("cbFindPagePlayer"),
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
context.location = { hostname: "www.youtube.com", href: "https://www.youtube.com/watch?v=next9", search: "?v=next9", pathname: "/watch" };
apply("allow", "youtube:video:next9");
check("navigating to a new (allowed) video lifts the previous page's blackout", !panelOf(document.player) && root.dataset.cbContentBlocked === undefined);

// Player not rendered yet: the block waits for it (bounded retry).
document.player = null;
const early = apply("block", "youtube:video:next9");
setTimeout(() => { document.player = newPlayer(); }, 350);
setTimeout(() => {
  check("a block that arrives before the player renders blacks it out once it appears", early === true && document.player && panelOf(document.player) && document.player.video.pauses === 1);
  apply("allow", "youtube:video:next9");

  // Bilibili: same document-level player path, BV id matched from /video/BV…/.
  context.location = { hostname: "www.bilibili.com", href: "https://www.bilibili.com/video/BV1abc/", search: "", pathname: "/video/BV1abc/" };
  document.player = newPlayer();
  check("Bilibili: a foreign video id never blacks out the page", apply("block", "bilibili:video:BV9zz") === false && !panelOf(document.player));
  check("Bilibili: the page's own BV id blacks out the player", apply("block", "bilibili:video:BV1abc") === true && panelOf(document.player) && document.player.video.pauses === 1);
  apply("allow", "bilibili:video:BV1abc");
  check("Bilibili: allow lifts it", !panelOf(document.player));

  // Reddit: the page's main content lives inside the observed post root (no
  // global player), so the profile is root-scoped; a text post blacks its body.
  context.location = { hostname: "www.reddit.com", href: "https://www.reddit.com/r/test/comments/p0st1/title/", search: "", pathname: "/r/test/comments/p0st1/title/" };
  document.player = null;
  const body = new FakeEl("div");
  const postRoot = new FakeEl("shreddit-post");
  postRoot.querySelector = (sel) => (sel.includes('[slot="text-body"]') ? body : null);
  postRoot.querySelectorAll = (sel) => (sel.includes('[slot="text-body"]') ? [body] : []);
  context.__root = postRoot;
  check("Reddit: a foreign post id never blacks out the page", apply("block", "reddit:post:other") === false && !panelOf(body));
  check("Reddit: the page's own post id blacks out the post body (root-scoped)", apply("block", "reddit:post:p0st1") === true && panelOf(body) && postRoot.dataset.cbContentBlocked === "true");
  apply("allow", "reddit:post:p0st1");
  check("Reddit: allow lifts it", !panelOf(body) && postRoot.dataset.cbContentBlocked === undefined);
  // Feed-card media resolution follows the same per-host profile.
  const card = new FakeEl("shreddit-post");
  const thumb = new FakeEl("div");
  card.querySelector = (sel) => (sel.includes('[slot="thumbnail"]') ? thumb : null);
  card.querySelectorAll = (sel) => (sel.includes('[slot="thumbnail"]') ? [thumb] : []);
  context.__card = card;
  check("Reddit feed card: cbFindMedia resolves the thumbnail via the profile", vm.runInContext("cbFindMedia(__card)", context) === thumb);
  context.location = { hostname: "example.com", href: "https://example.com/", search: "", pathname: "/" };
  check("an unprofiled host never blacks anything", vm.runInContext("cbFindMedia(__card)", context) === null && apply("block", "reddit:post:p0st1") === false);
  console.log(`CONTENT PAGE VERDICT TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
}, 1100);
