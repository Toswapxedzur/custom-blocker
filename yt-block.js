// yt-block.js — resolve YouTube feed cards to stateful creator-tag verdicts.
//
// Read-only + fail-open by design:
//   * We resolve each on-screen video to a channel id (from /channel/UC links,
//     from /@handle links, or from a videoId→channelId map parsed out of
//     ytInitialData), then ask the background worker for that channel's tags.
//   * The background worker answers from one bounded local verdict cache and
//     only hits the read-only service for genuine misses or stale verdicts.
//   * Verdicts are published as card attributes. content.js applies them through
//     the canonical feed cascade, so schedules, snoozes, timers, video forms,
//     allow rules, and group order have exactly the same meaning as other rules.
//   * Anything we can't resolve remains unknown and therefore fails open.
//
// Lookups send only public YouTube channel ids. The lookup service does not save
// the request or browsing context. Saving a channel id for classification is a
// separate, consent-gated contribution path (yt-collect.js + background.js).
(function () {
  "use strict";
  if (window.__cbYtBlock) return;
  window.__cbYtBlock = true;

  const LEGACY_HIDDEN_ATTR = "data-cb-yt-hidden";
  const CH_ATTR = "data-cb-channel";
  const TAG_STATE_ATTR = "data-cb-tag-state";
  const TAGS_ATTR = "data-cb-tags";
  const ITEM_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-reel-item-renderer",
    "ytm-shorts-lockup-view-model",
    "ytd-rich-grid-media"
  ].join(",");

  let tagRulesConfigured = false;
  // channelId -> { slugs:string[], state:string, at:ms } — `at` lets us periodically re-ask
  // the background so stale-while-revalidate updates propagate to the page.
  const tagCache = new Map();
  const REASK_MS = 5000; // re-query an on-screen channel at most this often
  const videoToChannel = new Map(); // videoId -> channelId
  const handleToChannel = new Map(); // "@handle"(lower) -> channelId
  let harvested = false; // ytInitialData parsed for this navigation yet?
  let scanTimer = null;

  // ------------------------------------------- continuation harvest (page world)
  // ytInitialData only carries the FIRST batch of feed cards. Everything you
  // scroll to ("continuation") arrives via /youtubei/v1 XHR/fetch, which this
  // isolated content script can't read, and those cards expose only /@handle
  // links. yt-harvest-main.js runs in the page world, hooks those responses, and
  // posts handle→UC / videoId→UC pairs here so EVERY creator in the feed (not
  // just the first batch) resolves, gets looked up, and is cached.
  function ingestHarvest(handles, videos) {
    let added = false;
    if (Array.isArray(handles)) {
      for (const pair of handles) {
        if (pair && pair[0] && pair[1] && !handleToChannel.has(pair[0])) {
          handleToChannel.set(String(pair[0]).toLowerCase(), pair[1]);
          added = true;
        }
      }
    }
    if (Array.isArray(videos)) {
      for (const pair of videos) {
        if (pair && pair[0] && pair[1] && !videoToChannel.has(pair[0])) {
          videoToChannel.set(pair[0], pair[1]);
          added = true;
        }
      }
    }
    if (added) scheduleScan(); // re-resolve cards that were previously unmapped
  }
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.__cbYtHarvest !== true) return;
    ingestHarvest(d.handles, d.videos);
  });

  // ---------------------------------------------------------------- settings
  // Avoid creator lookups unless at least one enabled YouTube tag rule exists.
  // Runtime policy is deliberately NOT evaluated here; the background session
  // owns schedules/snoozes/timers and content.js owns the priority cascade.
  const BLOCKED_GROUPS_KEY = "blockedGroups";
  function hasConfiguredTagRules(groups) {
    if (!Array.isArray(groups)) return false;
    return groups.some((g) => {
      if (!g || g.enabled !== true || g.groupType !== "youtube") return false;
      if (g.platformAuthorMode !== "tagInclude" && g.platformAuthorMode !== "tagExclude") {
        return false;
      }
      return Array.isArray(g.platformAuthorTags) && g.platformAuthorTags.some(
        (slug) => typeof slug === "string" && slug.trim()
      );
    });
  }

  try {
    chrome.storage.local.get(BLOCKED_GROUPS_KEY, (r) => {
      tagRulesConfigured = hasConfiguredTagRules(r && r[BLOCKED_GROUPS_KEY]);
      scheduleScan();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[BLOCKED_GROUPS_KEY]) return;
      tagRulesConfigured = hasConfiguredTagRules(changes[BLOCKED_GROUPS_KEY].newValue);
      scheduleScan();
    });
  } catch (_) {
    // No extension storage (shouldn't happen in a content script) — do nothing.
  }

  // ------------------------------------------------ ytInitialData harvesting
  // Pull the JSON object literal that follows a `var X = ` assignment by
  // brace-matching (string-aware), so we can JSON.parse it safely.
  function extractObject(text, marker) {
    const at = text.indexOf(marker);
    if (at < 0) return null;
    let i = text.indexOf("{", at);
    if (i < 0) return null;
    const start = i;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch (_) {
            return null;
          }
        }
      }
    }
    return null;
  }

  function findUCInSubtree(node, depth) {
    if (depth > 6 || !node || typeof node !== "object") return null;
    if (
      typeof node.browseId === "string" &&
      node.browseId.startsWith("UC") &&
      node.browseId.length === 24
    ) {
      return node.browseId;
    }
    for (const k in node) {
      const v = node[k];
      if (v && typeof v === "object") {
        const found = findUCInSubtree(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function walk(node) {
    if (Array.isArray(node)) {
      for (const v of node) walk(v);
      return;
    }
    if (!node || typeof node !== "object") return;

    if (
      typeof node.browseId === "string" &&
      node.browseId.startsWith("UC") &&
      node.browseId.length === 24 &&
      typeof node.canonicalBaseUrl === "string" &&
      node.canonicalBaseUrl.startsWith("/@")
    ) {
      handleToChannel.set(node.canonicalBaseUrl.slice(1).toLowerCase(), node.browseId);
    }
    if (typeof node.videoId === "string" && node.videoId.length === 11) {
      const uc = findUCInSubtree(node, 0);
      if (uc) videoToChannel.set(node.videoId, uc);
    }
    for (const k in node) walk(node[k]);
  }

  function harvestInitialData() {
    if (harvested) return;
    harvested = true;
    const scripts = document.getElementsByTagName("script");
    for (const s of scripts) {
      const txt = s.textContent;
      if (!txt) continue;
      if (txt.indexOf("ytInitialData") >= 0) {
        const obj = extractObject(txt, "ytInitialData");
        if (obj) walk(obj);
      }
      // The watch page's own video lives in ytInitialPlayerResponse, not
      // ytInitialData. videoDetails gives the authoritative, exact-case channel
      // id for the currently-playing video, so map it videoId→channelId.
      if (txt.indexOf("ytInitialPlayerResponse") >= 0) {
        const pr = extractObject(txt, "ytInitialPlayerResponse");
        const vd = pr && pr.videoDetails;
        if (
          vd &&
          typeof vd.videoId === "string" &&
          typeof vd.channelId === "string" &&
          /^UC[0-9A-Za-z_-]{22}$/.test(vd.channelId)
        ) {
          videoToChannel.set(vd.videoId, vd.channelId);
        }
      }
    }
  }

  // Exact-case UC id of the page's PRIMARY channel (the watched video's
  // uploader, or the channel whose page we're on) — distinct from the per-card
  // resolution used for feed hiding. Published on a shared global so content.js
  // (same extension → same isolated world) can drive page-level tag blocking
  // without duplicating this resolution.
  function resolvePageChannelId() {
    let m = location.pathname.match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
    if (m) return m[1];
    m = location.pathname.match(/^\/(@[^/?&#]+)/);
    if (m) {
      const id = handleToChannel.get(m[1].toLowerCase());
      if (id) return id;
    }
    let v = null;
    try {
      v = new URLSearchParams(location.search).get("v");
    } catch (_) {}
    if (v && videoToChannel.has(v)) return videoToChannel.get(v);
    const owner = document.querySelector(
      "ytd-watch-metadata #owner, ytd-watch-metadata ytd-channel-name, ytd-video-owner-renderer"
    );
    if (owner) {
      const id = channelFromElement(owner);
      if (id) return id;
    }
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      m = (canonical.getAttribute("href") || "").match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
      if (m) return m[1];
    }
    return null;
  }

  // The watch/channel page's primary channel resolves a beat AFTER
  // yt-navigate-finish (ytInitialData/owner byline land late). content.js's
  // page-block evaluation reads window.__cbPageChannelId one-shot on
  // navigation, so without a signal it sees a stale/null id and never blocks
  // the page (only the feed hides). When the resolved id actually changes we
  // fire an event so content.js can re-run its session evaluation.
  let lastPublishedChannelId = null;
  function publishPageChannel() {
    try {
      const next = resolvePageChannelId() || null;
      window.__cbPageChannelId = next;
      if (next && next !== lastPublishedChannelId) {
        lastPublishedChannelId = next;
        try {
          window.dispatchEvent(
            new CustomEvent("cb-page-channel-resolved", { detail: { channelId: next } })
          );
        } catch (_) {}
      }
    } catch (_) {}
  }

  // ----------------------------------------------------- element resolution
  function channelFromElement(el) {
    // 1. Direct /channel/UC… link (most reliable when present).
    const direct = el.querySelector('a[href*="/channel/UC"]');
    if (direct) {
      const m = (direct.getAttribute("href") || "").match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
      if (m) return m[1];
    }
    // 2. /@handle link → resolve via the map parsed from ytInitialData.
    const handle = el.querySelector('a[href^="/@"], a[href*="youtube.com/@"]');
    if (handle) {
      const m = (handle.getAttribute("href") || "").match(/\/(@[^/?&#]+)/);
      if (m) {
        const id = handleToChannel.get(m[1].toLowerCase());
        if (id) return id;
      }
    }
    // 3. videoId → channelId map.
    const link = el.querySelector(
      'a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]'
    );
    if (link) {
      const href = link.getAttribute("href") || "";
      let m = href.match(/[?&]v=([0-9A-Za-z_-]{11})/);
      if (!m) m = href.match(/\/shorts\/([0-9A-Za-z_-]{11})/);
      if (m) {
        const id = videoToChannel.get(m[1]);
        if (id) return id;
      }
    }
    return null;
  }

  // ------------------------------------------------------------- publishing
  function restoreLegacyHides() {
    document.querySelectorAll("[" + LEGACY_HIDDEN_ATTR + "]").forEach((el) => {
      el.removeAttribute(LEGACY_HIDDEN_ATTR);
      if (el.style.display === "none") el.style.removeProperty("display");
    });
  }

  function annotate(el, entry) {
    if (!el || !entry) return false;
    const state = typeof entry.state === "string" ? entry.state : "unknown";
    const tags = state === "tagged" && Array.isArray(entry.slugs) ? entry.slugs : [];
    const encoded = tags.join(" ");
    let changed = false;
    if (el.getAttribute(TAG_STATE_ATTR) !== state) {
      el.setAttribute(TAG_STATE_ATTR, state);
      changed = true;
    }
    if (el.getAttribute(TAGS_ATTR) !== encoded) {
      el.setAttribute(TAGS_ATTR, encoded);
      changed = true;
    }
    return changed;
  }

  function notifyTagVerdicts() {
    try { window.dispatchEvent(new CustomEvent("cb-yt-tags-resolved")); } catch (_) {}
  }

  function applyCacheToAll() {
    let changed = false;
    document.querySelectorAll(ITEM_SELECTOR).forEach((el) => {
      const cid = el.getAttribute(CH_ATTR);
      const entry = cid && tagCache.get(cid);
      if (entry && annotate(el, entry)) changed = true;
    });
    return changed;
  }

  function scan() {
    harvestInitialData();
    publishPageChannel();
    if (!tagRulesConfigured) return;
    const items = document.querySelectorAll(ITEM_SELECTOR);
    const need = new Set();
    const now = Date.now();
    const pageChannelId =
      typeof window.__cbPageChannelId === "string" &&
      /^UC[0-9A-Za-z_-]{22}$/.test(window.__cbPageChannelId)
        ? window.__cbPageChannelId
        : null;
    if (pageChannelId) {
      const pageEntry = tagCache.get(pageChannelId);
      if (!pageEntry || now - pageEntry.at > REASK_MS) need.add(pageChannelId);
    }
    let annotationsChanged = false;
    items.forEach((el) => {
      let cid = el.getAttribute(CH_ATTR);
      if (!cid) {
        cid = channelFromElement(el);
        if (cid) el.setAttribute(CH_ATTR, cid);
      }
      if (!cid) return; // unresolved → fail open (leave visible)
      const entry = tagCache.get(cid);
      if (entry && annotate(el, entry)) annotationsChanged = true;
      // Ask (or re-ask) the background so stale-while-revalidate updates from
      // the server propagate: first time, or once our local copy is old enough.
      if (!entry || now - entry.at > REASK_MS) need.add(cid);
    });
    if (annotationsChanged) notifyTagVerdicts();
    if (!need.size) return;
    try {
      chrome.runtime.sendMessage(
        { type: "cb-yt-tags", ids: Array.from(need) },
        (resp) => {
          if (chrome.runtime.lastError || !resp) return; // fail open
          const tags = resp.tags || {};
          const states = resp.states || {};
          const stamp = Date.now();
          for (const id of need) {
            tagCache.set(id, {
              slugs: tags[id] || [],
              state: typeof states[id] === "string" ? states[id] : "unknown",
              at: stamp
            });
          }
          applyCacheToAll();
          // The primary page channel may not be represented by a feed card, so
          // always notify the page matcher after a completed verdict round.
          notifyTagVerdicts();
        }
      );
    } catch (_) {
      // Extension context invalidated (e.g. reload) — fail open.
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, 300);
  }

  // ------------------------------------------------------------- lifecycle
  const mo = new MutationObserver(() => scheduleScan());
  function startObserver() {
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) startObserver();
  else document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  if (document.body) restoreLegacyHides();
  else document.addEventListener("DOMContentLoaded", restoreLegacyHides, { once: true });

  // SPA navigations: re-harvest ytInitialData and re-scan.
  window.addEventListener("yt-navigate-finish", () => {
    harvested = false;
    scheduleScan();
  });

  // Safety net for lazily-injected content the observer might miss. scan()
  // itself skips lookups while no enabled tag rule is configured.
  setInterval(() => {
    scheduleScan();
  }, 2500);

  scheduleScan();
})();
