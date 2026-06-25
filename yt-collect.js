/* Custom Web Blocker — YouTube channel-id collector (content script).
 *
 * Runs only on YouTube. As the user browses (feed, watch pages, channel
 * pages, search, sidebar…), this scans the DOM for any YouTube channel ids
 * it can see and forwards the *ids only* to the background worker.
 *
 * PRIVACY: this never reads video titles, watch history, or anything that
 * identifies the user. It emits nothing more than 24-char "UC…" channel ids.
 * The background worker drops everything unless the user has explicitly
 * opted in (Settings → "Help classify creators"). Default is off.
 *
 * Why a content script: channel ids live in the page DOM and in the
 * inlined ytInitialData JSON. The background worker can't see either, so we
 * extract here and hand off the deduped ids.
 */
(function () {
  "use strict";

  // A YouTube channel id is "UC" + 22 chars of [A-Za-z0-9_-].
  const UC_RE = /UC[0-9A-Za-z_-]{22}/g;
  // Keys in ytInitialData / ytcfg JSON that hold a real channel id. We anchor
  // every value to the "UC" prefix, which is what makes "browseId" safe to
  // include: channel browse endpoints are "UC…", while playlists ("VL…") and
  // feeds ("FE…") never match. A blind UC-token scan is deliberately avoided —
  // base64 tracking blobs (clickTrackingParams…) contain "UC…" substrings that
  // are not channel ids.
  const JSON_KEY_RE =
    /"(?:channelId|externalChannelId|externalId|webChannelId|browseId)":"(UC[0-9A-Za-z_-]{22})"/g;

  const sentThisPage = new Set(); // ids already handed to background this session
  let pending = new Set(); // ids waiting for the next flush
  let flushTimer = null;

  function isValidId(id) {
    // 24 chars total, "UC" prefix. The regex already guarantees this, but
    // keep an explicit guard so callers can pass arbitrary strings.
    return typeof id === "string" && id.length === 24 && id.startsWith("UC");
  }

  function enqueue(id) {
    if (!isValidId(id) || sentThisPage.has(id)) return;
    pending.add(id);
  }

  function harvestFromString(str) {
    if (!str || str.indexOf("UC") === -1) return;
    let m;
    JSON_KEY_RE.lastIndex = 0;
    while ((m = JSON_KEY_RE.exec(str)) !== null) enqueue(m[1]);
  }

  function harvestAnchors() {
    const anchors = document.querySelectorAll('a[href*="/channel/UC"]');
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      UC_RE.lastIndex = 0;
      const m = UC_RE.exec(href);
      if (m) enqueue(m[0]);
    }
  }

  function harvestMeta() {
    // Channel/watch pages expose the owner id in <meta> / <link> tags.
    const meta = document.querySelector('meta[itemprop="channelId"]');
    if (meta && meta.content) enqueue(meta.content.trim());
    const links = document.querySelectorAll('link[href*="/channel/UC"]');
    for (const l of links) {
      UC_RE.lastIndex = 0;
      const m = UC_RE.exec(l.getAttribute("href") || "");
      if (m) enqueue(m[0]);
    }
    // The current URL when sitting on a channel page.
    UC_RE.lastIndex = 0;
    const u = UC_RE.exec(location.href);
    if (u) enqueue(u[0]);
  }

  // ytInitialData and the watch-page player response are inlined in <script>
  // tags. They carry channel ids for every item in the feed/sidebar, which is
  // far more complete than scraping rendered anchors.
  let scriptScanDone = false;
  function harvestScripts() {
    const scripts = document.querySelectorAll("script:not([src])");
    for (const s of scripts) {
      const txt = s.textContent;
      if (txt && txt.indexOf("UC") !== -1) harvestFromString(txt);
    }
    scriptScanDone = true;
  }

  function flush() {
    flushTimer = null;
    if (!pending.size) return;
    const ids = Array.from(pending);
    pending = new Set();
    ids.forEach((id) => sentThisPage.add(id));
    try {
      chrome.runtime.sendMessage({ type: "cb-yt-observe", ids }, () => {
        // Swallow "receiving end does not exist" during SW restarts.
        void chrome.runtime.lastError;
      });
    } catch (_) {
      // Extension context invalidated (reload/update) — ignore.
    }
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, 1500);
  }

  function scan(includeScripts) {
    try {
      harvestAnchors();
      harvestMeta();
      if (includeScripts) harvestScripts();
    } catch (_) {}
    scheduleFlush();
  }

  // Initial pass: anchors + meta + the inlined JSON (the richest source).
  scan(true);

  // YouTube is a SPA — it fires this on every in-app navigation. Re-scan the
  // freshly-inlined JSON for the new page.
  window.addEventListener("yt-navigate-finish", () => {
    scriptScanDone = false;
    scan(true);
  });

  // Lazy-loaded feed items add anchors over time; observe and re-harvest them
  // (debounced through scheduleFlush). Scripts are only re-read on navigation.
  let moTimer = null;
  const mo = new MutationObserver(() => {
    if (moTimer) return;
    moTimer = setTimeout(() => {
      moTimer = null;
      scan(false);
      if (!scriptScanDone) harvestScripts();
    }, 1200);
  });
  try {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  // Safety net for pages that hydrate without a navigation event.
  setInterval(() => scan(false), 5000);
})();
