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
// It measures only when the content-watched category is enabled (asked once from
// the worker and cached); the worker gates again on receipt, and the native
// store is the final backstop.

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

  var enabled = false;
  try {
    chrome.runtime.sendMessage({ kind: "vault-activity-config" }, function (reply) {
      if (chrome.runtime.lastError) return;
      enabled = !!(reply && reply["content-watched"]);
      if (enabled) attach();
    });
  } catch (_) { return; }

  // Accrual state for the content being measured.
  var current = null; // { key, label, platform, startedAtMs, seconds, lastTickMs }
  var MIN_WATCH_MS = 3000;

  function playingVideo() {
    var videos = document.querySelectorAll("video");
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (!v.paused && !v.ended && v.readyState >= 2 && v.currentTime > 0) return v;
    }
    return null;
  }

  function tick() {
    if (!enabled) return;
    var content = document.visibilityState === "visible" ? contentFor(PLATFORM, location.href, document.title) : null;
    var counting = content && (!content.video || playingVideo());
    var now = Date.now();
    if (!counting) { flush(); return; }
    if (!current || current.key !== content.key) {
      flush();
      current = { key: content.key, platform: content.platform, label: content.label || location.hostname, startedAtMs: now, seconds: 0, lastTickMs: now };
    } else {
      current.seconds += Math.min((now - current.lastTickMs) / 1000, 5);
      current.lastTickMs = now;
      if (content.label) current.label = content.label; // titles settle after navigation
    }
  }

  function flush() {
    if (!current) return;
    var record = current;
    current = null;
    if (!(record.seconds * 1000 >= MIN_WATCH_MS)) return;
    try {
      chrome.runtime.sendMessage({
        kind: "vault-activity-watched",
        record: {
          startedAtMs: record.startedAtMs,
          seconds: record.seconds,
          key: record.key,
          label: record.label,
          platform: record.platform,
        },
      });
    } catch (_) { /* worker asleep or gone; a dropped watch record is acceptable */ }
  }

  function attach() {
    setInterval(tick, 4000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState !== "visible") flush(); });
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
  }
})();
