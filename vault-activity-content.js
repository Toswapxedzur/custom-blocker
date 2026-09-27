// Activity log — watched-content feeder (see macosBlocker/docs/ACTIVITY-LOG.md).
//
// Runs on YouTube and Bilibili pages. Measures how long a video actually PLAYS
// (accrues only while the <video> is playing and the tab is visible), and on
// pause / end / tab-hide / navigation posts a `content-watched` record to the
// service worker, which buffers and flushes it. Watching is item-level (the
// video's id/title), reusing the platform descriptor the collectors already use.
//
// It measures only when the content-watched category is enabled (asked once from
// the worker and cached); the worker gates again on receipt, and the native
// store is the final backstop.

(function () {
  "use strict";
  if (window.__vaultActivityContentLoaded) return;
  window.__vaultActivityContentLoaded = true;

  // The only platforms with a watch key; every other site is left alone.
  function onHost(domain) {
    var host = location.hostname.toLowerCase();
    return host === domain || host.slice(-(domain.length + 1)) === "." + domain;
  }
  if (!onHost("youtube.com") && !onHost("bilibili.com")) return;

  var enabled = false;
  try {
    chrome.runtime.sendMessage({ kind: "vault-activity-config" }, function (reply) {
      if (chrome.runtime.lastError) return;
      enabled = !!(reply && reply["content-watched"]);
      if (enabled) attach();
    });
  } catch (_) { return; }

  // Accrual state for the currently-playing video.
  var current = null; // { key, label, platform, creator, startedAtMs, seconds, lastTickMs }
  var MIN_WATCH_MS = 3000;

  function watchKey() {
    try {
      if (onHost("youtube.com")) {
        var id = new URLSearchParams(location.search).get("v");
        return id ? { platform: "youtube", key: "youtube:" + id } : null;
      }
      if (onHost("bilibili.com")) {
        var m = location.pathname.match(/\/(BV[0-9A-Za-z]+)/);
        return m ? { platform: "bilibili", key: "bilibili:" + m[1] } : null;
      }
    } catch (_) { return null; }
    return null;
  }

  function pageTitle() {
    return (document.title || "").replace(/\s*-\s*YouTube\s*$/, "").trim() || location.hostname;
  }

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
    var visible = document.visibilityState === "visible";
    var video = visible ? playingVideo() : null;
    var now = Date.now();
    var id = watchKey();
    if (video && id) {
      if (!current || current.key !== id.key) {
        flush();
        current = { key: id.key, platform: id.platform, label: pageTitle(), creator: null, startedAtMs: now, seconds: 0, lastTickMs: now };
      } else {
        current.seconds += Math.min((now - current.lastTickMs) / 1000, 5);
        current.lastTickMs = now;
      }
    } else {
      flush();
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
