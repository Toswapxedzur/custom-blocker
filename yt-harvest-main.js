// yt-harvest-main.js — runs in the PAGE (MAIN) world on YouTube.
//
// Why this exists: YouTube's home/feed is a SPA. Only the FIRST batch of cards
// is inlined in `ytInitialData`; everything you scroll to ("continuation") is
// fetched via /youtubei/v1/{browse,next,search} XHR/fetch calls and appended to
// the DOM. An isolated content script can't see those network responses, and
// the appended cards expose only `/@handle` links (no `/channel/UC…`), so the
// feed hider (yt-block.js) can't resolve scrolled-in creators to a channel id.
//
// This helper hooks fetch + XMLHttpRequest in the page world, extracts the
// handle→UC and videoId→UC mappings out of those continuation responses, and
// postMessages them to the isolated world so EVERY creator in the feed (not
// just the first batch) can be resolved, looked up, and cached.
//
// It reads only public channel ids already present in the page's own responses
// and sends nothing off-device — same posture as the rest of the YouTube code.
(function () {
  "use strict";
  if (window.__cbYtHarvestMain) return;
  window.__cbYtHarvestMain = true;

  var TARGET = "/youtubei/v1/";

  function isUC(s) {
    return typeof s === "string" && s.length === 24 && s.indexOf("UC") === 0;
  }

  // Find the first UC… browseId anywhere under a videoId node (bounded depth).
  function findUC(node, depth) {
    if (depth > 6 || !node || typeof node !== "object") return null;
    if (isUC(node.browseId)) return node.browseId;
    for (var k in node) {
      var v = node[k];
      if (v && typeof v === "object") {
        var found = findUC(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  // Collect [handleLower, UC] and [videoId, UC] pairs from a parsed response.
  function collect(root) {
    var handles = [];
    var videos = [];
    var seenHandles = Object.create(null);
    var seenVideos = Object.create(null);

    function walk(node, depth) {
      if (!node || typeof node !== "object" || depth > 40) return;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) walk(node[i], depth + 1);
        return;
      }
      if (
        isUC(node.browseId) &&
        typeof node.canonicalBaseUrl === "string" &&
        node.canonicalBaseUrl.indexOf("/@") === 0
      ) {
        var h = node.canonicalBaseUrl.slice(1).toLowerCase();
        if (!seenHandles[h]) {
          seenHandles[h] = 1;
          handles.push([h, node.browseId]);
        }
      }
      if (typeof node.videoId === "string" && node.videoId.length === 11) {
        if (!seenVideos[node.videoId]) {
          var uc = findUC(node, 0);
          if (uc) {
            seenVideos[node.videoId] = 1;
            videos.push([node.videoId, uc]);
          }
        }
      }
      for (var k in node) {
        var v = node[k];
        if (v && typeof v === "object") walk(v, depth + 1);
      }
    }

    try {
      walk(root, 0);
    } catch (e) {}
    return { handles: handles, videos: videos };
  }

  function post(handles, videos) {
    if ((!handles || !handles.length) && (!videos || !videos.length)) return;
    try {
      window.postMessage(
        { __cbYtHarvest: true, handles: handles || [], videos: videos || [] },
        window.location.origin || "*"
      );
    } catch (e) {}
  }

  function handleText(text) {
    if (!text || text.indexOf("browseId") === -1) return;
    var obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      return;
    }
    var r = collect(obj);
    post(r.handles, r.videos);
  }

  // ----------------------------------------------------------- fetch hook
  try {
    var origFetch = window.fetch;
    if (typeof origFetch === "function") {
      window.fetch = function (input, init) {
        var url = "";
        try {
          url = typeof input === "string" ? input : (input && input.url) || "";
        } catch (e) {}
        var p = origFetch.apply(this, arguments);
        if (url && url.indexOf(TARGET) !== -1) {
          try {
            p.then(function (resp) {
              try {
                resp
                  .clone()
                  .text()
                  .then(handleText)
                  .catch(function () {});
              } catch (e) {}
            }).catch(function () {});
          } catch (e) {}
        }
        return p;
      };
    }
  } catch (e) {}

  // ------------------------------------------------------------- XHR hook
  try {
    var XBP = XMLHttpRequest.prototype;
    var origOpen = XBP.open;
    var origSend = XBP.send;
    XBP.open = function (method, url) {
      try {
        this.__cbYtUrl = url || "";
      } catch (e) {}
      return origOpen.apply(this, arguments);
    };
    XBP.send = function () {
      try {
        var self = this;
        if (self.__cbYtUrl && self.__cbYtUrl.indexOf(TARGET) !== -1) {
          self.addEventListener("load", function () {
            try {
              var t = null;
              if (self.responseType === "" || self.responseType === "text") {
                t = self.responseText;
              } else if (self.responseType === "json" && self.response) {
                try {
                  t = JSON.stringify(self.response);
                } catch (e) {}
              }
              if (t) handleText(t);
            } catch (e) {}
          });
        }
      } catch (e) {}
      return origSend.apply(this, arguments);
    };
  } catch (e) {}
})();
