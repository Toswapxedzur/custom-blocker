/* First-run consent page for the YouTube creator-classification feature.
 * Writes the user's choice into globalSettings.contributeChannels and marks
 * contributeAsked so we never auto-open this page again. The popup Settings
 * panel reads/writes the same flag. */
(function () {
  "use strict";
  const KEY = "globalSettings";

  async function setChoice(enabled) {
    let settings = {};
    try {
      const r = await chrome.storage.local.get(KEY);
      if (r && r[KEY] && typeof r[KEY] === "object") settings = r[KEY];
    } catch (_) {}
    settings.contributeChannels = enabled === true;
    settings.contributeAsked = true;
    try {
      await chrome.storage.local.set({ [KEY]: settings });
    } catch (_) {}
  }

  function finish(enabled) {
    const done = document.getElementById("done");
    if (done) {
      done.textContent = enabled
        ? "Thanks! Sharing is on — you can turn it off in Settings anytime."
        : "No problem. Sharing stays off. You can turn it on later in Settings.";
    }
    const enable = document.getElementById("enable");
    const decline = document.getElementById("decline");
    if (enable) enable.disabled = true;
    if (decline) decline.disabled = true;
    setTimeout(() => {
      try { window.close(); } catch (_) {}
    }, 1400);
  }

  document.getElementById("enable").addEventListener("click", async () => {
    await setChoice(true);
    finish(true);
  });
  document.getElementById("decline").addEventListener("click", async () => {
    await setChoice(false);
    finish(false);
  });
})();
