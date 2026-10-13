// Activity log — watched-content feeder (see macosBlocker/docs/ACTIVITY-LOG.md).
//
// Runs on the supported platforms. Measures time on ONE piece of content
// (owner 2026-09-30): a video counts while it PLAYS (YouTube, Bilibili, Twitch);
// a single post, thread or channel counts while its own page is open (Reddit,
// X, Instagram, Facebook, Discord). Time accrues only while the tab is
// visible; a scrolling feed is no one piece. On a change of content, tab-hide,
// pause or navigation it posts a `content-watched` record to the service
// worker, which buffers and flushes it.
//
// Fresh native snapshots authorize capture; disconnect/unsupported peers pause
// it. Each contiguous observed interval carries its native epoch/revision, and
// the native store remains the authoritative cutoff backstop.

(function () {
  "use strict";

  // The content an address shows: { platform, key, label, video } — `video`
  // = its time counts only while a video plays. null = no single piece.
  function contentFor(platform, href, title) {
    var url;
    try { url = new URL(href); } catch (_) { return null; }
    var path = url.pathname;
    var match;
    var clean = function (pattern) { return String(title || "").replace(pattern, "").trim(); };
    switch (platform) {
      case "youtube": {
        var id = globalThis.VaultClassifierExtensionContract && globalThis.VaultClassifierExtensionContract.youtubeVideoIDFromURL(href, href);
        return id ? { platform: "youtube", key: "youtube:" + id, label: clean(/\s*-\s*YouTube\s*$/), video: true } : null;
      }
      case "bilibili":
        match = path.match(/\/(BV[0-9A-Za-z]+)/);
        return match ? { platform: "bilibili", key: "bilibili:" + match[1], label: clean(/_哔哩哔哩_bilibili\s*$/), video: true } : null;
      case "twitch":
        match = path.match(/^\/videos\/(\d+)/);
        if (match) return { platform: "twitch", key: "twitch:video:" + match[1], label: clean(/\s*-\s*Twitch\s*$/), video: true };
        match = path.match(/^\/([A-Za-z0-9_]{3,25})\/?$/);
        if (match && !/^(directory|videos|settings|subscriptions|inventory|wallet|drops|search|downloads|jobs|p|turbo)$/i.test(match[1])) {
          return { platform: "twitch", key: "twitch:" + match[1].toLowerCase(), label: clean(/\s*-\s*Twitch\s*$/), video: true };
        }
        return null;
      case "reddit":
        match = path.match(/^\/r\/[^/]+\/comments\/([A-Za-z0-9_-]{3,128})(?:\/|$)/i);
        return match ? { platform: "reddit", key: "reddit:" + match[1], label: clean(/\s*:\s*r\/[^\s]+\s*$/), video: false } : null;
      case "twitter":
        match = path.match(/^\/[^/]+\/status\/(\d{6,32})(?:\/|$)/);
        return match ? { platform: "twitter", key: "twitter:" + match[1], label: clean(/\s*\/\s*X\s*$/), video: false } : null;
      case "instagram":
        match = path.match(/^\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,64})(?:\/|$)/);
        return match ? { platform: "instagram", key: "instagram:" + match[1], label: clean(/\s*•\s*Instagram.*$/), video: false } : null;
      case "facebook":
        match = path.match(/^\/(?:[^/]+\/)?(?:posts|videos|reel)\/([A-Za-z0-9_-]{5,128})(?:\/|$)/)
          || (/^\/(?:watch|photo|photo\.php|permalink\.php|story\.php)\/?$/.test(path) && (url.searchParams.get("v") || url.searchParams.get("fbid") || url.searchParams.get("story_fbid"))
            ? [null, url.searchParams.get("v") || url.searchParams.get("fbid") || url.searchParams.get("story_fbid")] : null);
        return match && match[1] ? { platform: "facebook", key: "facebook:" + match[1], label: clean(/\s*\|\s*Facebook\s*$/), video: false } : null;
      case "discord":
        // A server channel; direct messages (@me) are not recorded.
        match = path.match(/^\/channels\/(\d+)\/(\d+)/);
        return match ? { platform: "discord", key: "discord:" + match[1] + "/" + match[2], label: clean(/^Discord\s*\|\s*/), video: false } : null;
      default:
        return null;
    }
  }
  globalThis.VaultActivityContent = { contentFor: contentFor };

  if (typeof window === "undefined" || window.__vaultActivityContentLoaded) return;
  window.__vaultActivityContentLoaded = true;

  // The supported platforms (their hosts as platform-profiles.js knows them).
  var PLATFORM = typeof getPlatformGroupTypeForHost === "function"
    ? getPlatformGroupTypeForHost(location.hostname.toLowerCase().replace(/^www\./, ""))
    : null;
  if (!["youtube", "bilibili", "twitch", "reddit", "twitter", "instagram", "facebook", "discord"].includes(PLATFORM)) return;

  var config = null, enabled = false, current = null, episode = null, attached = false;
  var updates = 0, retiredTokens = new Set(), pending = new Map();
  var MIN_WATCH_MS = 3000, PENDING_CAP = 2000;

  function normalizeConfig(value) {
    if (!value || typeof value.token !== "string" || !value.token || value.token.length > 128
      || !Number.isSafeInteger(value.generation) || value.generation < 0 || typeof value.paused !== "boolean"
      || !Number.isFinite(value.cutoffMs) || value.cutoffMs < 0 || !value.flags || typeof value.flags["content-watched"] !== "boolean") return null;
    var a = value.authority;
    if (!value.paused && (!a || typeof a.epoch !== "string"
      || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(a.epoch)
      || !Number.isSafeInteger(a.revision) || a.revision < 0 || !Number.isFinite(a.changedAtMs) || a.changedAtMs < 0)) return null;
    return value;
  }

  function playingVideo() {
    var videos = document.querySelectorAll("video");
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (!v.paused && !v.ended && v.readyState >= 2 && v.currentTime > 0) return v;
    }
    return null;
  }

  function appendObserved(start, end) {
    if (!(end > start) || !current) return;
    var last = current.segments[current.segments.length - 1];
    if (last && last.end === start) last.end = end;
    else {
      current.segments.push({ start: start, end: end, id: crypto.randomUUID() });
      if (current.segments.length > PENDING_CAP) current.segments.shift();
    }
    episode.observedMS += end - start;
    if (episode.observedMS >= MIN_WATCH_MS) episode.eligible = true;
  }

  function tick() {
    retryPending();
    if (!enabled) return;
    var content = document.visibilityState === "visible" ? contentFor(PLATFORM, location.href, document.title) : null;
    var counting = content && (!content.video || playingVideo()), now = Date.now();
    if (!counting) { flush(Infinity); episode = null; return; }
    if (!current || current.key !== content.key) {
      flush(Infinity);
      if (!episode || episode.key !== content.key) episode = { key: content.key, observedMS: 0, eligible: false };
      current = { key: content.key, platform: content.platform, label: content.label || location.hostname,
        lastTickMs: now, segments: [], authorization: { epoch: config.authority.epoch, revision: config.authority.revision } };
    } else {
      // A suspended timer observes at most the existing five-second cap; the
      // unobserved gap is not represented as a contiguous watch interval.
      appendObserved(Math.max(current.lastTickMs, now - 5000, config.authority.changedAtMs), now);
      current.lastTickMs = now;
      if (content.label) current.label = content.label;
    }
  }

  function sendPending(id, entry) {
    if (entry.sending) return;
    entry.sending = true;
    try {
      chrome.runtime.sendMessage({ kind: "vault-activity-watched", record: entry.record }, function (reply) {
        entry.sending = false;
        if (chrome.runtime.lastError) return;
        if (reply?.ok === true || reply?.permanent === true) pending.delete(id);
      });
    } catch (_) { entry.sending = false; }
  }
  function retryPending() { for (var pair of pending) sendPending(pair[0], pair[1]); }

  function flush(cutoffMs, continuation) {
    if (!current) return;
    var closed = current;current = null;
    if (!episode?.eligible) return;
    for (var segment of closed.segments) {
      var parts = [{ start: segment.start, end: Math.min(segment.end, cutoffMs), id: segment.id, authorization: closed.authorization }];
      if (continuation && segment.end > cutoffMs) parts.push({ start: Math.max(segment.start, cutoffMs), end: segment.end,
        id: crypto.randomUUID(), authorization: { epoch: continuation.epoch, revision: continuation.revision } });
      for (var part of parts) {
        if (!(part.end > part.start)) continue;
        var record = { id: part.id, startedAtMs: part.start, observedEndedAtMs: part.end,
          seconds: (part.end - part.start) / 1000, key: closed.key, label: closed.label,
          platform: closed.platform, authorization: part.authorization };
        if (pending.size >= PENDING_CAP) pending.delete(pending.keys().next().value);
        var entry = { record: record, sending: false };pending.set(record.id, entry);sendPending(record.id, entry);
      }
    }
  }

  function applyConfig(value) {
    var next = normalizeConfig(value);
    if (!next || retiredTokens.has(next.token)) return;
    if (config?.token === next.token && next.generation <= config.generation) return;
    if (config && config.token !== next.token) { retiredTokens.add(config.token); if (retiredTokens.size > 16) retiredTokens.delete(retiredTokens.values().next().value); }
    // Close only already-observed intervals, never accrue time at flush.
    var cutoff = next.paused ? next.cutoffMs : next.authority.changedAtMs;
    var continues = enabled && !next.paused && next.flags["content-watched"]
      && config?.authority?.epoch === next.authority?.epoch;
    flush(cutoff, continues ? next.authority : null);
    if (config?.authority?.epoch && next.authority?.epoch !== config.authority.epoch) pending.clear();
    config = next;updates += 1;
    enabled = !next.paused && next.flags["content-watched"];
    if (!enabled) episode = null;
    if (!attached) attach();
    if (enabled) tick();
  }

  function attach() {
    if (attached) return;attached = true;
    setInterval(tick, 4000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState !== "visible") { flush(Infinity); episode = null; } });
    window.addEventListener("pagehide", function () { flush(Infinity); });
    window.addEventListener("beforeunload", function () { flush(Infinity); });
  }

  chrome.runtime.onMessage.addListener(function (message, sender) {
    if (sender?.id !== chrome.runtime.id || sender?.tab || message?.kind !== "vault-activity-settings-updated") return false;
    applyConfig(message.config);return false;
  });
  var requestedAt = updates;
  try {
    chrome.runtime.sendMessage({ kind: "vault-activity-config" }, function (reply) {
      if (chrome.runtime.lastError || requestedAt !== updates) return;
      applyConfig(reply);
    });
  } catch (_) { /* no fresh supported native configuration means no capture */ }
})();
