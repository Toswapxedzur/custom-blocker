// Browser DOM coverage for the rendered YouTube entry kinds and page surfaces.
// Run on the designated test host with PLAYWRIGHT_MODULE set to its installation.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || undefined,
  headless: true
});
const creator = '<a href="/@VaultTestCreator">Vault Test Creator</a>';
const feed = `<ytd-video-renderer><a id="thumbnail" href="/watch?v=AAA111bbb22"></a><a id="video-title" href="/watch?v=AAA111bbb22">Regular video</a>${creator}</ytd-video-renderer>
  <ytd-rich-item-renderer><ytm-shorts-lockup-view-model-v2><a href="/shorts/BBB222ccc33"></a><a id="video-title" href="/shorts/BBB222ccc33">Short video</a>${creator}</ytm-shorts-lockup-view-model-v2></ytd-rich-item-renderer>
  <ytd-compact-video-renderer><a id="thumbnail" href="/live/CCC333ddd44"></a><a id="video-title" href="/live/CCC333ddd44">Live stream</a>${creator}<span id="metadata-line"><span>LIVE</span></span></ytd-compact-video-renderer>
  <ytd-post-renderer><a href="/post/UgkxPost123"></a><div id="content-text">Creator community post</div>${creator}</ytd-post-renderer>`;
const pages = new Map([
  ["/feed/subscriptions", feed],
  ["/results", feed],
  ["/@VaultTestCreator", feed.replaceAll(creator, "")],
  ["/watch", `<ytd-watch-metadata><h1>Currently watched video</h1>${creator}<div id="info">Today</div></ytd-watch-metadata>${feed}`],
  ["/shorts/DDD444eee55", `<ytd-reel-video-renderer is-active><ytd-reel-player-overlay-renderer><h1>Currently watched Short</h1>${creator}</ytd-reel-player-overlay-renderer></ytd-reel-video-renderer>`],
  ["/live/EEE555fff66", `<ytd-watch-metadata><h1>Currently watched live stream</h1>${creator}<div id="info">LIVE</div></ytd-watch-metadata>`],
  ["/post/UgkxPage123", `<ytd-post-renderer><a href="/post/UgkxPage123"></a><div id="content-text">Currently viewed community post</div>${creator}</ytd-post-renderer>`]
]);

const contract = `window.VaultClassifierExtensionContract = {
  youtubeVideoIDFromURL(value, base) {
    try {
      const url = new URL(value, base);
      if (url.pathname === "/watch") return url.searchParams.get("v");
      return url.pathname.match(/^\\/(?:shorts|live)\\/([A-Za-z0-9_-]{11})/)?.[1] || null;
    } catch { return null; }
  }
};`;
const collector = fs.readFileSync(path.join(root, "vault-classifier-youtube.js"), "utf8");
const selectors = ["ytd-video-renderer", "ytd-rich-item-renderer", "ytd-compact-video-renderer", "ytd-post-renderer", "ytm-shorts-lockup-view-model-v2"];
const cases = [
  ["/feed/subscriptions", { "youtube:video:AAA111bbb22": "video", "youtube:video:BBB222ccc33": "short", "youtube:video:CCC333ddd44": "live", "youtube:post:UgkxPost123": "post" }],
  ["/results?search_query=games", { "youtube:video:AAA111bbb22": "video", "youtube:video:BBB222ccc33": "short", "youtube:video:CCC333ddd44": "live", "youtube:post:UgkxPost123": "post" }],
  ["/@VaultTestCreator", { "youtube:video:AAA111bbb22": "video", "youtube:video:BBB222ccc33": "short", "youtube:video:CCC333ddd44": "live", "youtube:post:UgkxPost123": "post" }],
  ["/watch?v=AAA111bbb22", { "youtube:video:AAA111bbb22": "video" }],
  ["/shorts/DDD444eee55", { "youtube:video:DDD444eee55": "short" }],
  ["/live/EEE555fff66", { "youtube:video:EEE555fff66": "live" }],
  ["/post/UgkxPage123", { "youtube:post:UgkxPage123": "post" }]
];

try {
  for (const [url, expected] of cases) {
    const page = await browser.newPage();
    try {
      await page.route("https://www.youtube.com/**", route => {
        const pathname = new URL(route.request().url()).pathname;
        return route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><html><body>${pages.get(pathname) || ""}</body></html>` });
      });
      await page.goto(`https://www.youtube.com${url}`);
      await page.evaluate(({ selectors, contract }) => {
        window.__tagged = [];
        window.__collected = [];
        window.PLATFORM_PROFILES = { youtube: { feed: { cardSelectors: selectors } } };
        window.VaultClassifierTagUI = { observe(item) {
          window.__tagged.push({ entryID: item.entryID, entryType: item.entryType, kind: item.kind });
        }, clearPlatform() {} };
        window.chrome = { runtime: { id: "fixture", lastError: null,
          sendMessage(message, callback) {
            if (message.type === "vault-classifier-collection-info") return callback({ ok: true, enabled: true, tagging: true });
            if (message.type === "vault-classifier-collect") window.__collected.push(message.entry);
            callback({ ok: true, accepted: true });
          }, onMessage: { addListener() {} } },
          storage: { local: { get(_key, callback) { callback({ globalSettings: {} }); } }, onChanged: { addListener() {} } } };
        (0, eval)(contract);
      }, { selectors, contract });
      await page.evaluate(collector);
      await page.waitForTimeout(900);
      const result = await page.evaluate(() => ({ tagged: window.__tagged, collected: window.__collected }));
      for (const [entryID, entryType] of Object.entries(expected)) {
        assert(result.tagged.some(item => item.entryID === entryID && item.entryType === entryType),
          `${url}: missing tagged ${entryType} ${entryID}: ${JSON.stringify(result.tagged)}`);
        assert(result.collected.some(item => item.entryID === entryID && item.evidence?.metadata?.entryType === entryType),
          `${url}: missing collected ${entryType} ${entryID}`);
      }
      if (url === "/@VaultTestCreator") {
        assert(result.collected.every(item => item.sourceID === "youtube:handle:@vaulttestcreator"),
          "creator page cards without owner links should inherit the page owner");
      }
      if (url.startsWith("/watch") || url.startsWith("/shorts/") || url.startsWith("/live/") || url.startsWith("/post/")) {
        const ownID = Object.keys(expected).find(id => !["youtube:video:BBB222ccc33", "youtube:video:CCC333ddd44", "youtube:post:UgkxPost123"].includes(id));
        assert(result.tagged.some(item => item.entryID === ownID && item.kind === "page"), `${url}: own entry not tagged as page`);
      }
    } finally { await page.close(); }
  }
  console.log("PASS rendered YouTube videos, Shorts, Live, posts, current pages, recommendations, search and creator feeds");
} finally { await browser.close(); }
