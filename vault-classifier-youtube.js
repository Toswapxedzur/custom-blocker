// Vault Classifier YouTube adapter — Phase 2 vertical slice.
//
// This adapter is independent from the legacy creator-tag resolver. It collects
// only rendered DOM values, asks the paired local app through native messaging,
// and fails open on any missing evidence, selector drift, or transport error.
(function () {
  "use strict";
  if (window.__vaultClassifierYouTube) return;
  window.__vaultClassifierYouTube = true;
  const C = globalThis.VaultClassifierExtensionContract;
  if (!C || typeof C.youtubeVideoIDFromURL !== "function" || typeof C.entryFingerprint !== "function") return;

  const SETTINGS_KEY = "vaultClassifierSettings";
  const CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-reel-item-renderer",
    "ytm-shorts-lockup-view-model",
    "ytd-rich-grid-media"
  ].join(",");
  const STYLE_ID = "vault-classifier-youtube-style";
  const CARD_BANNER = "[data-vault-classifier-banner]";
  const PAGE_OVERLAY_ID = "vault-classifier-page-overlay";
  const CARD_REVEALED_FINGERPRINT = "data-vault-classifier-revealed-fingerprint";
  const PAGE_FINGERPRINT = "data-vault-classifier-page";
  const PAGE_REVEALED_ENTRY = "data-vault-classifier-page-revealed-entry";
  let enabled = false;
  let scanTimer = null;
  let pageTimer = null;
  let settingsEpoch = 0;
  let presentationGeneration = 0;

  function compactText(value, maximum) {
    if (typeof value !== "string") return null;
    const output = value.replace(/\s+/g, " ").trim();
    return output && output.length <= maximum ? output : null;
  }

  function selectorElement(root, selectors) {
    if (!root || typeof root.querySelector !== "function") return null;
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function selectorText(root, selectors, maximum) {
    const element = selectorElement(root, selectors);
    return compactText(element && element.textContent, maximum);
  }

  function findVideoID(root) {
    const links = root.querySelectorAll('a#thumbnail[href], a#video-title-link[href], a[href*="watch?v="], a[href*="/shorts/"]');
    for (const link of links) {
      const id = C.youtubeVideoIDFromURL(link.getAttribute("href") || "", location.href);
      if (id) return id;
    }
    return null;
  }

  function findSource(root) {
    const channel = root.querySelector('a[href*="/channel/UC"]');
    const channelMatch = (channel && (channel.getAttribute("href") || "")).match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
    if (channelMatch) return { id: `youtube:channel:${channelMatch[1]}`, name: compactText(channel.textContent, 256) };
    const handle = root.querySelector('a[href^="/@"], a[href*="youtube.com/@"]');
    const handleMatch = (handle && (handle.getAttribute("href") || "")).match(/\/(\@[^/?#]+)/);
    if (handleMatch) return { id: `youtube:handle:${handleMatch[1].toLowerCase()}`, name: compactText(handle.textContent, 256) };
    return { id: null, name: selectorText(root, ["#channel-name #text", "ytd-channel-name #text", "#owner #text"], 256) };
  }

  function feedEvidence(card) {
    const title = selectorText(card, ["#video-title", "a#video-title-link", "a#video-title", "h3 a"], 500);
    if (!title) return null;
    const source = findSource(card);
    const videoID = findVideoID(card);
    const duration = selectorText(card, ["ytd-thumbnail-overlay-time-status-renderer span", ".ytd-thumbnail-overlay-time-status-renderer"], 64);
    const metadataLine = Array.from(card.querySelectorAll("#metadata-line span")).map((item) => compactText(item.textContent, 128)).filter(Boolean).slice(0, 3);
    return {
      platform: "youtube",
      entryID: videoID ? `youtube:video:${videoID}` : null,
      sourceID: source.id,
      surface: "feed",
      evidence: {
        title,
        suppliedTags: [],
        metadata: {
          sourceName: source.name || "",
          duration: duration || "",
          metadata: metadataLine.join(" · ")
        }
      }
    };
  }

  function visibleSummary(root) {
    // This intentionally reads only an already-rendered summary surface. If
    // YouTube changes/removes it, the field simply remains absent.
    return selectorText(root, [
      "ytd-video-summary-renderer",
      "[data-testid='video-summary']",
      "[data-testid='ai-summary']",
      "ytd-engagement-panel-section-list-renderer[target-id*='ai-summary' i] #content-text",
      "ytd-engagement-panel-section-list-renderer[data-target-id*='ai-summary' i] #content-text"
    ], 16000);
  }

  function watchEvidence() {
    const root = document;
    const videoID = C.youtubeVideoIDFromURL(location.href, location.href);
    if (!videoID) return null;
    // Never fall back to a document-wide heading: on a channel/search page it
    // could turn unrelated rendered text into a full-page video decision.
    const watchRoot = root.querySelector("ytd-watch-metadata")
      || root.querySelector("ytd-reel-player-overlay-renderer")
      || root.querySelector("#above-the-fold")
      || root.querySelector("ytd-shorts");
    if (!watchRoot) return null;
    const title = selectorText(watchRoot, ["h1.ytd-watch-metadata", "h1", "h2", ".title"], 500);
    if (!title) return null;
    const source = findSource(watchRoot);
    const descriptionRoot = selectorElement(watchRoot, ["#description", "#description-inline-expander", "ytd-text-inline-expander#description"]);
    const description = compactText(descriptionRoot && descriptionRoot.textContent, 16000);
    // Hashtags from comments/related videos are not evidence for this video.
    const suppliedTags = Array.from(descriptionRoot ? descriptionRoot.querySelectorAll('a[href*="/hashtag/"]') : [])
      .map((item) => compactText(item.textContent, 256))
      .filter(Boolean)
      .slice(0, 64);
    const details = selectorText(watchRoot, ["#info", "#above-the-fold #info"], 512);
    return {
      platform: "youtube",
      entryID: `youtube:video:${videoID}`,
      sourceID: source.id,
      surface: "page",
      evidence: {
        title,
        text: description,
        summary: visibleSummary(root),
        suppliedTags,
        metadata: { sourceName: source.name || "", details: details || "", canonicalURL: `https://www.youtube.com/watch?v=${videoID}` }
      }
    };
  }

  function requestClassification(entry) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "vault-classifier-classify", entry }, (response) => {
          if (chrome.runtime.lastError) return resolve({ ok: false, failOpen: true });
          resolve(response && typeof response === "object" ? response : { ok: false, failOpen: true });
        });
      } catch (_) {
        resolve({ ok: false, failOpen: true });
      }
    });
  }

  function requestCorrection(ledgerID, correction) {
    try {
      chrome.runtime.sendMessage({ type: "vault-classifier-correct", ledgerID, correction }, () => void chrome.runtime.lastError);
    } catch (_) {}
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .vault-classifier-dim { opacity: .24 !important; filter: saturate(.25) !important; transition: opacity 160ms ease, filter 160ms ease; }
      .vault-classifier-dim:hover, .vault-classifier-revealed { opacity: 1 !important; filter: none !important; }
      .vault-classifier-block { min-height: 84px !important; }
      .vault-classifier-block > :not([data-vault-classifier-banner]) { visibility: hidden !important; }
      .vault-classifier-block.vault-classifier-revealed > :not([data-vault-classifier-banner]) { visibility: visible !important; }
      [data-vault-classifier-banner] { position: relative; z-index: 3; display: flex; align-items: center; gap: 8px; min-height: 32px; margin: 8px; padding: 8px 10px; border: 1px solid rgba(30,58,138,.22); border-radius: 10px; box-sizing: border-box; background: rgba(248,250,252,.97); color: #1f2937; font: 12px/1.35 Arial,sans-serif; box-shadow: 0 5px 16px rgba(15,23,42,.12); }
      [data-vault-classifier-banner] strong { color: #1e3a8a; font-size: 11px; letter-spacing: .035em; text-transform: uppercase; }
      [data-vault-classifier-banner] span { flex: 1; min-width: 0; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      [data-vault-classifier-banner] button { border: 0; border-radius: 7px; padding: 5px 8px; color: #1e3a8a; background: #eef2ff; font: 600 11px/1 Arial,sans-serif; cursor: pointer; }
      [data-vault-classifier-banner] button:hover { background: #c7d2fe; }
      #${PAGE_OVERLAY_ID} { position: fixed; z-index: 2147483646; inset: 0; display: grid; place-items: center; padding: 24px; background: rgba(15,23,42,.84); color: #f8fafc; font-family: Arial,sans-serif; }
      #${PAGE_OVERLAY_ID} > div { max-width: 520px; padding: 28px; border-radius: 18px; background: #fff; color: #1f2937; box-shadow: 0 24px 72px rgba(0,0,0,.35); }
      #${PAGE_OVERLAY_ID} h2 { margin: 0 0 8px; color: #1e3a8a; font-size: 20px; }
      #${PAGE_OVERLAY_ID} p { margin: 0 0 18px; color: #475569; font-size: 13px; line-height: 1.5; }
      #${PAGE_OVERLAY_ID} button { margin-right: 8px; border: 0; border-radius: 9px; padding: 9px 12px; background: #1e3a8a; color: #fff; font: 600 12px/1 Arial,sans-serif; cursor: pointer; }
      #${PAGE_OVERLAY_ID} button.secondary { background: #eef2ff; color: #1e3a8a; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function clearCard(card) {
    card.classList.remove("vault-classifier-dim", "vault-classifier-block", "vault-classifier-revealed");
    card.removeAttribute("data-vault-classifier-state");
    card.removeAttribute("data-vault-classifier-fingerprint");
    card.removeAttribute(CARD_REVEALED_FINGERPRINT);
    const banner = card.querySelector(CARD_BANNER);
    if (banner) banner.remove();
  }

  function cardBanner(card, verdict, fingerprint) {
    let banner = card.querySelector(CARD_BANNER);
    if (!banner) {
      banner = document.createElement("div");
      banner.setAttribute("data-vault-classifier-banner", "");
      card.insertBefore(banner, card.firstChild);
    }
    banner.replaceChildren();
    const label = document.createElement("strong");
    label.textContent = verdict.action === "block" ? "Blocked locally" : "Dimmed locally";
    const copy = document.createElement("span");
    copy.textContent = verdict.explanation || "Matched a local policy.";
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.textContent = "Reveal";
    reveal.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      card.classList.add("vault-classifier-revealed");
      if (fingerprint) card.setAttribute(CARD_REVEALED_FINGERPRINT, fingerprint);
      requestCorrection(verdict.ledgerID, verdict.action === "block" ? "falseBlock" : "falseDim");
      reveal.textContent = "Revealed";
      reveal.disabled = true;
    });
    const why = document.createElement("button");
    why.type = "button";
    why.textContent = "Why";
    why.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copy.textContent = verdict.explanation || "This entry matched a local Vault Classifier policy.";
      copy.title = copy.textContent;
    });
    banner.append(label, copy, reveal, why);
  }

  function presentCard(card, verdict, fingerprint) {
    if (!verdict || verdict.ok !== true || verdict.action === "allow") {
      clearCard(card);
      return;
    }
    // Keep an explicit reveal visible for this exact entry evidence until the
    // user changes settings, navigates, or YouTube supplies new evidence.
    if (fingerprint && card.getAttribute(CARD_REVEALED_FINGERPRINT) === fingerprint) return;
    clearCard(card);
    ensureStyles();
    card.setAttribute("data-vault-classifier-state", verdict.action);
    card.classList.add(verdict.action === "block" ? "vault-classifier-block" : "vault-classifier-dim");
    cardBanner(card, verdict, fingerprint);
  }

  function clearPageOverlay() {
    document.getElementById(PAGE_OVERLAY_ID)?.remove();
  }

  function presentPage(verdict, entryID) {
    clearPageOverlay();
    if (!verdict || verdict.ok !== true || verdict.action !== "block") return;
    ensureStyles();
    const overlay = document.createElement("section");
    overlay.id = PAGE_OVERLAY_ID;
    const panel = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = "Blocked locally";
    const copy = document.createElement("p");
    copy.textContent = verdict.explanation || "This page matched a local Vault Classifier policy.";
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.textContent = "Reveal page";
    reveal.addEventListener("click", () => {
      requestCorrection(verdict.ledgerID, "falseBlock");
      if (entryID) document.documentElement.setAttribute(PAGE_REVEALED_ENTRY, entryID);
      overlay.remove();
    });
    const why = document.createElement("button");
    why.type = "button";
    why.className = "secondary";
    why.textContent = "Why this happened";
    why.addEventListener("click", () => { copy.textContent = verdict.explanation || copy.textContent; });
    panel.append(title, copy, reveal, why);
    overlay.appendChild(panel);
    document.documentElement.appendChild(overlay);
  }

  async function classifyCard(card) {
    if (!enabled) { clearCard(card); return; }
    const evidence = feedEvidence(card);
    if (!evidence) { clearCard(card); return; }
    const fingerprint = C.entryFingerprint(evidence);
    if (!fingerprint) return;
    if (card.getAttribute("data-vault-classifier-fingerprint") === fingerprint) return;
    const generation = presentationGeneration;
    card.setAttribute("data-vault-classifier-fingerprint", fingerprint);
    const verdict = await requestClassification(evidence);
    // A card can be recycled by YouTube while native messaging is in flight.
    const latestEvidence = feedEvidence(card);
    if (!enabled || generation !== presentationGeneration || card.getAttribute("data-vault-classifier-fingerprint") !== fingerprint || C.entryFingerprint(latestEvidence) !== fingerprint) return;
    if (!verdict || verdict.ok !== true) { clearCard(card); return; }
    card.setAttribute("data-vault-classifier-fingerprint", fingerprint);
    presentCard(card, verdict, fingerprint);
    card.setAttribute("data-vault-classifier-fingerprint", fingerprint);
  }

  async function classifyPage() {
    if (!enabled) {
      clearPageOverlay();
      document.documentElement.removeAttribute(PAGE_FINGERPRINT);
      return;
    }
    const evidence = watchEvidence();
    if (!evidence) {
      clearPageOverlay();
      document.documentElement.removeAttribute(PAGE_FINGERPRINT);
      document.documentElement.removeAttribute(PAGE_REVEALED_ENTRY);
      return;
    }
    const fingerprint = C.entryFingerprint(evidence);
    if (!fingerprint) return;
    const entryID = evidence.entryID || fingerprint;
    const revealedEntry = document.documentElement.getAttribute(PAGE_REVEALED_ENTRY);
    if (revealedEntry && revealedEntry !== entryID) document.documentElement.removeAttribute(PAGE_REVEALED_ENTRY);
    if (document.documentElement.getAttribute(PAGE_FINGERPRINT) === fingerprint) return;
    const generation = presentationGeneration;
    document.documentElement.setAttribute(PAGE_FINGERPRINT, fingerprint);
    const verdict = await requestClassification(evidence);
    const latestEvidence = watchEvidence();
    if (!enabled || generation !== presentationGeneration || document.documentElement.getAttribute(PAGE_FINGERPRINT) !== fingerprint || C.entryFingerprint(latestEvidence) !== fingerprint) return;
    if (!verdict || verdict.ok !== true) { clearPageOverlay(); return; }
    if (document.documentElement.getAttribute(PAGE_REVEALED_ENTRY) === entryID) {
      clearPageOverlay();
      return;
    }
    presentPage(verdict, entryID);
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      if (!enabled) return;
      document.querySelectorAll(CARD_SELECTOR).forEach((card) => void classifyCard(card));
    }, 250);
  }

  function schedulePageCheck() {
    if (pageTimer) return;
    pageTimer = setTimeout(() => { pageTimer = null; void classifyPage(); }, 450);
  }

  function applySettings(raw) {
    presentationGeneration++;
    enabled = Boolean(raw && raw.enabled === true);
    clearPageOverlay();
    document.documentElement.removeAttribute(PAGE_FINGERPRINT);
    document.documentElement.removeAttribute(PAGE_REVEALED_ENTRY);
    document.querySelectorAll(CARD_SELECTOR).forEach(clearCard);
    if (!enabled) return;
    scheduleScan();
    schedulePageCheck();
  }

  function refreshEnabled() {
    const epoch = ++settingsEpoch;
    chrome.storage.local.get(SETTINGS_KEY, (result) => {
      if (epoch !== settingsEpoch) return;
      applySettings(chrome.runtime.lastError ? null : result && result[SETTINGS_KEY]);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[SETTINGS_KEY]) return;
    settingsEpoch++;
    applySettings(changes[SETTINGS_KEY].newValue);
  });
  window.addEventListener("yt-navigate-finish", () => {
    presentationGeneration++;
    clearPageOverlay();
    document.documentElement.removeAttribute(PAGE_FINGERPRINT);
    document.documentElement.removeAttribute(PAGE_REVEALED_ENTRY);
    document.querySelectorAll(CARD_SELECTOR).forEach(clearCard);
    scheduleScan();
    schedulePageCheck();
  });
  const observer = new MutationObserver(() => {
    if (!enabled) return;
    scheduleScan();
    schedulePageCheck();
  });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => observer.observe(document.documentElement, { childList: true, subtree: true }), { once: true });
  refreshEnabled();
})();
