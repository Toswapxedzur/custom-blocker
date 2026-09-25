// Runs in every sub-frame (the top document has content.js). While the top
// document is covered by Vault's block cover, the worker asks every frame to
// pause its media: embedded players live in frames the top document cannot
// reach. Sound is muted at the tab level by the worker regardless.
(function () {
  "use strict";
  if (typeof window === "undefined" || window.top === window) return;
  let covered = false;
  function allMedia(root, out) {
    let nodes = [];
    try { nodes = root.querySelectorAll("video, audio, *"); } catch { return out; }
    for (const node of nodes) {
      if (node.tagName === "VIDEO" || node.tagName === "AUDIO") out.push(node);
      if (node.shadowRoot) allMedia(node.shadowRoot, out);
    }
    return out;
  }
  function pauseAll() {
    for (const media of allMedia(document, [])) {
      try { if (!media.paused) media.pause(); } catch {}
    }
  }
  document.addEventListener("play", (event) => {
    if (!covered) return;
    const media = event.target;
    if (media && typeof media.pause === "function") { try { media.pause(); } catch {} }
  }, true);
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || message.type !== "cover-media") return false;
      covered = message.paused === true;
      if (covered) pauseAll();
      sendResponse({ ok: true });
      return true;
    });
  } catch {}
})();
