// Vault Classifier YouTube collection adapter.
//
// This adapter is independent from ordinary platform feed matching. It reads
// only rendered DOM values, asks the paired local app through the authenticated
// shared Vault bridge, and fails closed on any missing evidence, selector drift,
// or transport error.
(function () {
  "use strict";
  if (window.__vaultClassifierYouTube) return;
  window.__vaultClassifierYouTube = true;
  const C = globalThis.VaultClassifierExtensionContract;
  if (!C || typeof C.youtubeVideoIDFromURL !== "function") return;

  const SETTINGS_KEY = "vaultClassifierSettings";
  const CARD_SELECTOR = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-playlist-video-renderer",
    "ytd-reel-item-renderer",
    "ytm-shorts-lockup-view-model",
    "ytd-rich-grid-media",
    "ytd-backstage-post-thread-renderer"
  ].join(",");
  const PLATFORM = "youtube";
  let collectionEnabled = false;
  let scanTimer = null;
  let pageTimer = null;
  let collectionEpoch = 0;
  let lastWatchEvidenceFailure = "missing-watch-root";
  // Short-lived in-page de-duplication only. The opted-in Vault Classifier
  // dataset is the sole retained collection store; these identifiers expire so
  // an open tab does not turn into a durable browser-side cache.
  const collectedEntryIDs = new Map();
  const COLLECTION_DEDUPLICATION_MS = 5 * 60 * 1000;
  const MAX_COLLECTED_ENTRY_IDS = 128;
  const reportedDiagnostics = new Set();

  // Diagnostics are deliberately fixed pipeline tokens. They never carry
  // titles, URLs, creator names, IDs, or any other rendered page content.
  function reportDiagnostic(event, detail) {
    const key = `${event}:${detail || ""}`;
    if (reportedDiagnostics.has(key)) return;
    reportedDiagnostics.add(key);
    try {
      chrome.runtime.sendMessage({
        type: "vault-classifier-diagnostic",
        platform: PLATFORM,
        event,
        ...(detail ? { detail } : {})
      }, () => void chrome.runtime.lastError);
    } catch (_) {}
  }

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

  function findPostID(root) {
    const link = root.querySelector('a[href*="/post/"]');
    const href = link ? (link.getAttribute("href") || "") : "";
    const match = href.match(/\/post\/([A-Za-z0-9_-]{3,128})/);
    return match ? match[1] : null;
  }

  function isAdvertisement(root) {
    if (!root || typeof root.matches !== "function") return false;
    const selectors = [
      "ytd-ad-slot-renderer",
      "ytd-promoted-video-renderer",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-in-feed-ad-layout-renderer",
      "[is-ad]",
      "[is-promoted]"
    ].join(",");
    return root.matches(selectors) || Boolean(root.closest(selectors)) || Boolean(root.querySelector(selectors));
  }

  function cardEntryType(card, metadataLine) {
    if (card.matches("ytd-backstage-post-thread-renderer")) return "post";
    if (card.matches("ytd-reel-item-renderer, ytm-shorts-lockup-view-model")) return "short";
    if ((metadataLine || []).some((value) => /\blive\b/i.test(value))) return "live";
    return "video";
  }

  function findSource(root) {
    const fallbackName = () => selectorText(root, [
      "#channel-name #text",
      "ytd-channel-name #text",
      "#owner #text",
      "ytd-video-owner-renderer #text",
      "#byline #text"
    ], 256);
    const matchLink = (selectors, pattern, idForMatch) => {
      let firstMatch = null;
      for (const selector of selectors) {
        for (const link of root.querySelectorAll(selector)) {
          const href = link.getAttribute("href") || "";
          const match = href.match(pattern);
          if (!match) continue;
          const candidate = {
            id: idForMatch(match),
            // A generic /channel/.../videos link is often the channel-nav
            // item "Videos", not the creator label. Prefer the nearby owner
            // text whenever the card exposes it.
            name: fallbackName() || compactText(link.textContent, 256),
            url: creatorURL(href),
            link
          };
          if (candidate.name) return candidate;
          if (!firstMatch) firstMatch = candidate;
        }
      }
      return firstMatch;
    };
    const channel = matchLink([
      "#channel-name a[href*='/channel/UC']",
      "ytd-channel-name a[href*='/channel/UC']",
      "#owner a[href*='/channel/UC']",
      "ytd-video-owner-renderer a[href*='/channel/UC']",
      "a[href*='/channel/UC']"
    ], /\/channel\/(UC[0-9A-Za-z_-]{22})(?:[/?#]|$)/, (match) => `youtube:channel:${match[1]}`);
    if (channel) return channel;
    const handle = matchLink([
      "#channel-name a[href]",
      "ytd-channel-name a[href]",
      "#owner a[href]",
      "ytd-video-owner-renderer a[href]",
      "a[href^='/@']",
      "a[href*='youtube.com/@']"
    ], /\/(\@[^/?#]+)/, (match) => `youtube:handle:${match[1].toLowerCase()}`);
    if (handle) return handle;
    return { id: null, name: fallbackName(), url: null };
  }

  function creatorURL(value) {
    if (typeof value !== "string" || !value) return null;
    try {
      const url = new URL(value, location.href);
      return url.protocol === "https:" && /(^|\.)youtube\.com$/i.test(url.hostname) && url.href.length <= 512
        ? url.href
        : null;
    } catch (_) {
      return null;
    }
  }

  function imageURLFrom(element) {
    if (!element?.getAttribute) return null;
    for (const attribute of ["src", "data-src", "data-lazy-src", "data-original"]) {
      const value = element.getAttribute(attribute);
      if (value) return value;
    }
    const srcset = element.getAttribute("srcset") || element.getAttribute("data-srcset");
    if (!srcset) return null;
    const firstSource = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    return firstSource || null;
  }

  function creatorAvatarURL(root, source) {
    if (!root || !source?.id || typeof C.isTrustedCreatorAvatarURL !== "function") return null;
    const authorAnchors = [];
    if (source.link) authorAnchors.push(source.link);
    // YouTube deliberately labels the rendered channel image with
    // #avatar-link. Restricting this search to the verified item/watch root
    // excludes video thumbnails and comments while allowing a handle avatar
    // link to differ from an adjacent /channel/UC creator link.
    for (const link of root.querySelectorAll?.("a#avatar-link[href]") || []) {
      if (!authorAnchors.includes(link)) authorAnchors.push(link);
    }
    for (const authorAnchor of authorAnchors) {
      for (const image of authorAnchor.querySelectorAll?.("img") || []) {
        const rawURL = imageURLFrom(image);
        if (!C.isTrustedCreatorAvatarURL(PLATFORM, rawURL, location.href)) continue;
        try {
          const url = new URL(rawURL, location.href);
          url.hash = "";
          if (url.href.length <= 512) return url.href;
        } catch (_) {}
      }
    }
    return null;
  }

  function feedEvidence(card) {
    if (isAdvertisement(card)) return null;
    const title = selectorText(card, ["#video-title", "a#video-title-link", "a#video-title", "h3 a", "#content-text", "#content #content-text"], 500);
    if (!title) return null;
    const source = findSource(card);
    const videoID = findVideoID(card);
    const postID = videoID ? null : findPostID(card);
    const entryID = videoID ? `youtube:video:${videoID}` : (postID ? `youtube:post:${postID}` : null);
    const duration = selectorText(card, ["ytd-thumbnail-overlay-time-status-renderer span", ".ytd-thumbnail-overlay-time-status-renderer"], 64);
    const metadataLine = Array.from(card.querySelectorAll("#metadata-line span")).map((item) => compactText(item.textContent, 128)).filter(Boolean).slice(0, 3);
    const entryType = cardEntryType(card, metadataLine);
    const metadata = {
      sourceName: source.name || "",
      entryType,
      duration: duration || "",
      metadata: metadataLine.join(" · "),
      canonicalURL: videoID ? `https://www.youtube.com/watch?v=${videoID}` : (postID ? `https://www.youtube.com/post/${postID}` : "")
    };
    if (source.url) metadata.creatorURL = source.url;
    const avatarURL = creatorAvatarURL(card, source);
    if (avatarURL) metadata.creatorAvatarURL = avatarURL;
    return {
      platform: "youtube",
      entryID,
      sourceID: source.id,
      surface: "feed",
      evidence: {
        title,
        suppliedTags: [],
        metadata
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
    if (!videoID) {
      lastWatchEvidenceFailure = "missing-video-id";
      return null;
    }
    // Never fall back to a document-wide heading: on a channel/search page it
    // could turn unrelated rendered text into a full-page video decision.
    const watchRoot = root.querySelector("ytd-watch-metadata")
      || root.querySelector("ytd-reel-player-overlay-renderer")
      || root.querySelector("#above-the-fold")
      || root.querySelector("ytd-shorts");
    if (!watchRoot) {
      lastWatchEvidenceFailure = "missing-watch-root";
      return null;
    }
    const title = selectorText(watchRoot, ["h1.ytd-watch-metadata", "h1", "h2", ".title"], 500);
    if (!title) {
      lastWatchEvidenceFailure = "missing-title";
      return null;
    }
    const source = findSource(watchRoot);
    if (!source.id) {
      lastWatchEvidenceFailure = "missing-creator";
      return null;
    }
    const descriptionRoot = selectorElement(watchRoot, ["#description", "#description-inline-expander", "ytd-text-inline-expander#description"]);
    const description = compactText(descriptionRoot && descriptionRoot.textContent, 16000);
    // Hashtags from comments/related videos are not evidence for this video.
    const suppliedTags = Array.from(descriptionRoot ? descriptionRoot.querySelectorAll('a[href*="/hashtag/"]') : [])
      .map((item) => compactText(item.textContent, 256))
      .filter(Boolean)
      .slice(0, 64);
    const details = selectorText(watchRoot, ["#info", "#above-the-fold #info"], 512);
    const subscriberCount = selectorText(watchRoot, ["#owner-sub-count", "ytd-video-owner-renderer #owner-sub-count", "#subscribe-button #subscriber-count"], 64);
    const published = selectorText(watchRoot, ["#info-strings yt-formatted-string", "#date yt-formatted-string", "#info-strings span"], 128);
    const viewCount = selectorText(watchRoot, ["#info #count yt-formatted-string", "#info #count", "ytd-watch-info-text #count"], 128);
    const entryType = location.pathname.startsWith("/shorts/") ? "short" : (/\blive\b/i.test(details || "") ? "live" : "video");
    const metadata = {
      sourceName: source.name || "",
      entryType,
      details: details || "",
      subscriberCount: subscriberCount || "",
      published: published || "",
      viewCount: viewCount || "",
      canonicalURL: `https://www.youtube.com/watch?v=${videoID}`
    };
    if (source.url) metadata.creatorURL = source.url;
    const avatarURL = creatorAvatarURL(watchRoot, source);
    if (avatarURL) metadata.creatorAvatarURL = avatarURL;
    lastWatchEvidenceFailure = "";
    return {
      platform: PLATFORM,
      entryID: `youtube:video:${videoID}`,
      sourceID: source.id,
      surface: "page",
      evidence: {
        title,
        text: description,
        summary: visibleSummary(root),
        suppliedTags,
        metadata
      }
    };
  }

  function requestCollectionInfo() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "vault-classifier-collection-info" }, (response) => {
          if (chrome.runtime.lastError) return resolve({ enabled: false, failed: true });
          resolve({
            enabled: Boolean(response && response.ok === true && response.enabled === true),
            failed: !(response && response.ok === true)
          });
        });
      } catch (_) {
        resolve({ enabled: false, failed: true });
      }
    });
  }

  function requestCollection(entry) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "vault-classifier-collect", entry }, (response) => {
          if (chrome.runtime.lastError) return resolve(false);
          resolve(Boolean(response && response.ok === true && response.accepted === true));
        });
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function collectEntry(entry) {
    if (!collectionEnabled || !entry || !entry.entryID || !entry.sourceID) return;
    const stableID = `${entry.platform}:${entry.entryID}`;
    const hasCreatorAvatar = Boolean(entry.evidence?.metadata?.creatorAvatarURL);
    const now = Date.now();
    for (const [candidate, prior] of collectedEntryIDs) {
      if (now - prior.timestamp > COLLECTION_DEDUPLICATION_MS) collectedEntryIDs.delete(candidate);
    }
    const prior = collectedEntryIDs.get(stableID);
    // Channel text and titles commonly render before the author avatar. Allow
    // exactly one enrichment delivery when that verified image arrives later,
    // while still suppressing the mutation storms caused by YouTube updates.
    if (prior && (prior.hasCreatorAvatar || !hasCreatorAvatar)) return;
    // Mark before the asynchronous bridge call so repeated YouTube DOM
    // mutations cannot enqueue the same visible entry. A later avatar-only
    // enrichment remains eligible for one deliberate metadata refresh.
    collectedEntryIDs.set(stableID, { timestamp: now, hasCreatorAvatar });
    while (collectedEntryIDs.size > MAX_COLLECTED_ENTRY_IDS) collectedEntryIDs.delete(collectedEntryIDs.keys().next().value);
    reportDiagnostic("collection-requested");
    const accepted = await requestCollection(entry);
    if (!accepted) {
      collectedEntryIDs.delete(stableID);
      reportDiagnostic("collection-rejected", "rejected");
      return;
    }
    reportDiagnostic("collection-accepted");
  }

  function collectCard(card) {
    if (!collectionEnabled || isAdvertisement(card)) return;
    void collectEntry(feedEvidence(card));
  }

  function collectPage() {
    if (!collectionEnabled) return;
    const entry = watchEvidence();
    if (!entry) {
      reportDiagnostic("page-evidence-missing", lastWatchEvidenceFailure || "missing-watch-root");
      return;
    }
    reportDiagnostic("page-evidence-ready");
    void collectEntry(entry);
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
        collectCard(card);
      });
    }, 250);
  }

  function schedulePageCheck() {
    if (pageTimer) return;
    pageTimer = setTimeout(() => {
      pageTimer = null;
      collectPage();
    }, 450);
  }

  function refreshCollectionEnabled() {
    const epoch = ++collectionEpoch;
    reportDiagnostic("collection-info-requested");
    requestCollectionInfo().then((nextEnabled) => {
      if (epoch !== collectionEpoch) return;
      collectionEnabled = nextEnabled.enabled;
      if (nextEnabled.failed) {
        reportDiagnostic("collection-info-failed", "runtime-last-error");
      } else if (collectionEnabled) {
        reportDiagnostic("collection-info-enabled");
      } else {
        reportDiagnostic("collection-info-disabled");
      }
      if (collectionEnabled) {
        scheduleScan();
        schedulePageCheck();
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[SETTINGS_KEY]) return;
    refreshCollectionEnabled();
  });
  window.addEventListener("yt-navigate-finish", () => {
    collectedEntryIDs.clear();
    reportedDiagnostics.clear();
    scheduleScan();
    schedulePageCheck();
  });
  const observer = new MutationObserver(() => {
    if (!collectionEnabled) return;
    scheduleScan();
    schedulePageCheck();
  });
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => observer.observe(document.documentElement, { childList: true, subtree: true }), { once: true });
  reportDiagnostic("collector-started");
  refreshCollectionEnabled();
  // A collection toggle lives in the local Vault app rather than extension
  // storage. This bounded status poll carries no page metadata; the app still
  // rejects every collection request after a toggle is turned off.
  setInterval(refreshCollectionEnabled, 15_000);
})();
