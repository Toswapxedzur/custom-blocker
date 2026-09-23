/* content.js feed pass on an X timeline: a tweet whose settled tags match the
   group's tag filter gets its photo blacked out in place (dim), one that does
   not is left alone. The cell is the filter's card; the pill sits on the inner
   article, so the tag lookup resolves through containment. */
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
function extractBlock(name) {
  const start = source.indexOf(`const ${name} = `);
  if (start < 0) throw new Error(`missing block ${name}`);
  const end = source.indexOf("\n});", start);
  return source.slice(start, end + 4);
}

class El {
  constructor(tag, attrs = {}) { this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.children = []; this.parentElement = null; this.dataset = {}; this.style = { removeProperty() {} }; this.isConnected = true; this.className = attrs.class || ""; }
  append(...kids) { for (const k of kids) { k.parentElement = this; this.children.push(k); } return this; }
  appendChild(k) { this.append(k); return k; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((c) => c !== this); this.parentElement = null; }
  getAttribute(n) { return n === "class" ? this.className : (this.attrs[n] ?? null); }
  setAttribute(n, v) { if (n === "class") this.className = v; else this.attrs[n] = v; }
  removeAttribute(n) { delete this.attrs[n]; }
  matchesOne(sel) {
    sel = sel.trim();
    if (sel.startsWith(":scope > ")) return false;
    const m = sel.match(/^([a-z0-9-]*)((?:\[[^\]]+\]|\.[\w-]+)*)$/i);
    if (!m) return false;
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    for (const part of (m[2].match(/\[[^\]]+\]|\.[\w-]+/g) || [])) {
      if (part.startsWith(".")) { if (!this.className.split(/\s+/).includes(part.slice(1))) return false; continue; }
      const a = part.slice(1, -1).match(/^([\w.-]+)(?:([\^*]?)="([^"]*)")?$/);
      if (!a) return false;
      const val = this.getAttribute(a[1]);
      if (a[3] === undefined) { if (val === null) return false; continue; }
      if (a[2] === "^") { if (!String(val ?? "").startsWith(a[3])) return false; }
      else if (a[2] === "*") { if (!String(val ?? "").includes(a[3])) return false; }
      else if (val !== a[3]) return false;
    }
    return true;
  }
  matches(selector) { return selector.split(",").some((s) => this.matchesOne(s)); }
  all() { const out = []; const walk = (n) => { for (const c of n.children) { out.push(c); walk(c); } }; walk(this); return out; }
  querySelectorAll(selector) {
    if (selector.startsWith(":scope > ")) return this.children.filter((c) => c.matches(selector.slice(9)));
    return this.all().filter((n) => n.matches(selector));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let n = this; n; n = n.parentElement) if (n.matches(selector)) return n; return null; }
  contains(node) { for (let n = node; n; n = n.parentElement) if (n === this) return true; return false; }
}

function tweet({ statusID, handle, photo }) {
  const cell = new El("div", { "data-testid": "cellInnerDiv" });
  const article = new El("article", { "data-testid": "tweet" });
  const name = new El("div", { "data-testid": "User-Name" }).append(new El("a", { href: `/${handle}` }), new El("a", { href: `/${handle}/status/${statusID}` }));
  const text = new El("div", { "data-testid": "tweetText" });
  article.append(name, text);
  if (photo) article.append(new El("div", { "data-testid": "tweetPhoto" }).append(new El("img", { src: "https://pbs.twimg.com/media/x.jpg" })));
  cell.append(article);
  return { cell, article };
}
const news = tweet({ statusID: "1", handle: "bbcchinese", photo: true });
const gaming = tweet({ statusID: "2", handle: "someone", photo: true });
const body = new El("body").append(news.cell, gaming.cell);
const document = {
  body, documentElement: body,
  querySelectorAll: (s) => body.querySelectorAll(s),
  querySelector: (s) => body.querySelector(s),
  createElement: (tag) => new El(tag),
  addEventListener() {}
};
// The tag pipeline: pills live on the ARTICLES; lookup by containment (tag-ui's stateForCard).
const tagsByArticle = new Map([[news.article, [{ id: "t1", name: "News & Politics", confidence: 5 }]], [gaming.article, [{ id: "t2", name: "Gaming", confidence: 5 }]]]);
const resolve = (rootEl) => { if (tagsByArticle.has(rootEl)) return rootEl; let found = null; for (const a of tagsByArticle.keys()) if (rootEl.contains(a)) { if (found) return null; found = a; } return found; };

const context = vm.createContext({
  document, window: null, location: { hostname: "x.com", pathname: "/home", href: "https://x.com/home" },
  console, getComputedStyle: () => ({ position: "static" }),
  requestAnimationFrame: (fn) => { fn(); return 1; },
  vaultTagsForCard: (rootEl) => { const a = resolve(rootEl); return a ? tagsByArticle.get(a) : []; },
  vaultTagsSettledForCard: (rootEl) => Boolean(resolve(rootEl)),
  cbInstallClickInterceptor() {}, applySurfaceHides() {}, applyNavShelfHides() {}, __cb_maybeReplenishFeed() {},
  stopFeedObserver() {}, restoreSurfaceHidden() {}, cbResetCustomSigCache() {}, reconcilePageMutations() {}, cbEvaluateTagPage() {}
});
context.window = context;
vm.runInContext(fs.readFileSync(path.join(root, "platform-profiles.js"), "utf8"), context, { filename: "platform-profiles.js" });
vm.runInContext([
  "let latestFeedFilters = []; let latestSurfaceHides = []; let latestExposedGroupIds = []; let feedApplyRafId = null; let cbTagPageContext = null; let cbDebugMode = false; function cbDebugLog() {}",
  "const cbVerdictLedger = new WeakMap(); const cbTrackedCards = new Set(); let cbGroupIndex = new Map(); let cbGroupEffect = new Map(); let cbGroupOrderKey = '';",
  extractBlock("CB_CONTENT_BLOCK_PROFILES"),
  ...["normalizeHostname", "getCurrentFeedSite", "cbContentBlockPlatformID", "cbContentBlockProfile", "cbFindMedia", "getFeedCardElements", "getFeedCardTags", "getFeedCardData",
      "matchesTagFilter", "matchesFeedFilter", "cbSetGroupOrder", "cbEffectVerdict", "cbSetCardVerdict", "cbClearSource", "cbResolveCardVerdict", "cbApplyCard",
      "cbEnsureRelative", "dimElement", "undimElement", "hideElement", "showElement", "applyFeedFilters", "extractRedditSubredditFromCard", "isPostCard", "getFeedCardHref", "getFeedCardCreators"].map(extractFunction)
].join("\n"), context);

context.__filters = [{ id: "g␟tag", baseGroupId: "g", site: "twitter", tagFilter: { mode: "include", tags: [{ name: "News & Politics" }], defaultConfidence: 4, blockUntagged: false }, effectVerdict: "dim", pageEffect: "block", tagCoverUntilTagged: false, enforce: true }];
vm.runInContext("latestFeedFilters = __filters; applyFeedFilters();", context);

let pass = 0, fail = 0;
const check = (label, ok, detail) => { if (ok) { pass++; console.log(`PASS ${label}`); } else { fail++; console.log(`FAIL ${label}${detail ? " — " + detail : ""}`); } };
check("the site resolves to twitter on x.com", vm.runInContext("getCurrentFeedSite()", context) === "twitter");
check("the filter's cards are the timeline cells", vm.runInContext("getFeedCardElements('twitter').length", context) === 2);
check("a matching tweet's photo is blacked out in place", news.cell.dataset.cbContentBlocked === "true" && news.cell.querySelector('[data-testid="tweetPhoto"]').children.some((c) => c.className === "cb-block-panel"), JSON.stringify(news.cell.dataset));
check("a non-matching tweet is untouched", news.cell !== gaming.cell && gaming.cell.dataset.cbContentBlocked === undefined && !gaming.cell.querySelector(".cb-block-panel"));
vm.runInContext("latestFeedFilters = []; applyFeedFilters();", context);
check("removing the filter lifts the blackout", news.cell.dataset.cbContentBlocked === undefined && !news.cell.querySelector(".cb-block-panel"));
console.log(fail ? "__CB_TEST_RESULT__: FAIL" : "__CB_TEST_RESULT__: OK");
if (fail) process.exitCode = 1;
