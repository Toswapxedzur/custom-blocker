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
  const TagUI = globalThis.VaultClassifierTagUI;
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
  // YouTube often inserts an author image element before assigning its source.
  // Observe every supported lazy-image attribute so an avatar URL reaches the
  // local cache as soon as the feed finishes rendering it.
  const AVATAR_SOURCE_ATTRIBUTES = Object.freeze([
    "src", "srcset", "data-src", "data-lazy-src", "data-original", "data-srcset"
  ]);
  let collectionEnabled = false;
  let scanTimer = null;
  let pageTimer = null;
  let collectionEpoch = 0;
  let lastWatchEvidenceFailure = "missing-watch-root";
  let avatarDebugEnabled = false;
  let resolveAvatarDebugSettings;
  let avatarDebugSettingsResolved = false;
  const avatarDebugSettingsReady = new Promise((resolve) => {
    resolveAvatarDebugSettings = resolve;
  });
  // Short-lived in-page de-duplication only. The opted-in Vault Classifier
  // dataset is the sole retained collection store; these identifiers expire so
  // an open tab does not turn into a durable browser-side cache.
  const collectedEntryIDs = new Map();
  const COLLECTION_DEDUPLICATION_MS = 5 * 60 * 1000;
  const MAX_COLLECTED_ENTRY_IDS = 128;
  const reportedDiagnostics = new Set();
  const reportedAvatarDebugStages = new Set();

  // Avatar diagnosis stays local to DevTools and is available only through
  // the extension's existing Debug mode. The fixed stage tokens deliberately
  // omit rendered text, creator IDs, URLs, and image data.
  function applyAvatarDebugSettings(settings) {
    avatarDebugEnabled = settings?.debugMode === true;
  }

  function resolveAvatarDebugSettingsOnce(settings) {
    if (avatarDebugSettingsResolved) return;
    avatarDebugSettingsResolved = true;
    applyAvatarDebugSettings(settings);
    // This fixed token confirms that Debug mode was available before the
    // first collection scan, without disclosing any rendered page data.
    if (avatarDebugEnabled) reportAvatarDebug("debug-ready");
    resolveAvatarDebugSettings();
  }

  function reportAvatarDebug(stage, dedupeID = "") {
    if (!avatarDebugEnabled || typeof stage !== "string") return;
    const key = `${stage}:${dedupeID}`;
    if (reportedAvatarDebugStages.has(key)) return;
    reportedAvatarDebugStages.add(key);
    while (reportedAvatarDebugStages.size > MAX_COLLECTED_ENTRY_IDS) {
      reportedAvatarDebugStages.delete(reportedAvatarDebugStages.values().next().value);
    }
    try {
      console.debug("[VaultClassifier:avatar]", stage);
    } catch (_) {}
  }

  try {
    if (typeof chrome.storage?.local?.get !== "function") {
      resolveAvatarDebugSettingsOnce();
    } else {
      const deadline = setTimeout(() => resolveAvatarDebugSettingsOnce(), 250);
      chrome.storage.local.get("globalSettings", (stored) => {
        clearTimeout(deadline);
        resolveAvatarDebugSettingsOnce(stored?.globalSettings);
      });
    }
  } catch (_) {
    resolveAvatarDebugSettingsOnce();
  }

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

  function creatorIDFromURL(value) {
    const url = creatorURL(value);
    if (!url) return null;
    try {
      const pathname = new URL(url).pathname;
      const channel = pathname.match(/^\/channel\/(UC[0-9A-Za-z_-]{22})(?:\/|$)/);
      if (channel) return `youtube:channel:${channel[1]}`;
      const handle = pathname.match(/^\/(\@[^/?#]+)/);
      return handle ? `youtube:handle:${handle[1].toLowerCase()}` : null;
    } catch (_) {
      return null;
    }
  }

  function creatorAvatarURL(root, source) {
    if (!root || !source?.id || typeof C.isTrustedCreatorAvatarURL !== "function") {
      reportAvatarDebug("source-missing");
      return null;
    }
    const authorAnchors = [];
    const authorImages = [];
    const addAuthorImages = (container) => {
      for (const image of container?.querySelectorAll?.("img") || []) {
        if (!authorImages.includes(image)) authorImages.push(image);
      }
    };
    const linkMatchesSource = (link) => creatorIDFromURL(link?.getAttribute?.("href")) === source.id;
    if (source.link) authorAnchors.push(source.link);
    // YouTube deliberately labels the rendered channel image with
    // #avatar-link. Restricting this search to the verified item/watch root
    // excludes video thumbnails and comments while allowing a handle avatar
    // link to differ from an adjacent /channel/UC creator link.
    for (const link of root.querySelectorAll?.("a#avatar-link[href]") || []) {
      if (!authorAnchors.includes(link)) authorAnchors.push(link);
    }
    // Current YouTube feed cards use a separate, unlabelled creator link for
    // the image. It is usable only when it resolves to the exact creator that
    // was already verified from the card's text/owner link.
    for (const link of root.querySelectorAll?.("a[href]") || []) {
      if (!authorAnchors.includes(link) && linkMatchesSource(link)) {
        authorAnchors.push(link);
      }
    }
    for (const authorAnchor of authorAnchors) addAuthorImages(authorAnchor);
    // Modern YouTube video cards render the verified creator avatar as an
    // unlinked yt-avatar-shape. It is still safe to collect only when the
    // immediately owning metadata component contains a link for the exact
    // creator we already resolved from that card.
    for (const image of root.querySelectorAll?.("yt-lockup-metadata-view-model yt-avatar-shape img") || []) {
      const metadata = image.closest?.("yt-lockup-metadata-view-model");
      if ([...metadata?.querySelectorAll?.("a[href]") || []].some(linkMatchesSource) && !authorImages.includes(image)) {
        authorImages.push(image);
      }
    }
    let sawImage = false;
    let sawUntrustedURL = false;
    for (const image of authorImages) {
      sawImage = true;
      const rawURL = imageURLFrom(image);
      if (!C.isTrustedCreatorAvatarURL(PLATFORM, rawURL, location.href)) {
        if (rawURL) sawUntrustedURL = true;
        continue;
      }
      try {
        const url = new URL(rawURL, location.href);
        url.hash = "";
        if (url.href.length <= 512) {
          reportAvatarDebug("source-ready");
          return url.href;
        }
      } catch (_) {}
    }
    reportAvatarDebug(sawUntrustedURL ? "source-untrusted" : (sawImage ? "source-pending" : "image-missing"));
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
    if (prior && (prior.hasCreatorAvatar || !hasCreatorAvatar)) {
      if (hasCreatorAvatar) reportAvatarDebug("delivery-suppressed", stableID);
      return;
    }
    // Mark before the asynchronous bridge call so repeated YouTube DOM
    // mutations cannot enqueue the same visible entry. A later avatar-only
    // enrichment remains eligible for one deliberate metadata refresh.
    collectedEntryIDs.set(stableID, { timestamp: now, hasCreatorAvatar });
    while (collectedEntryIDs.size > MAX_COLLECTED_ENTRY_IDS) collectedEntryIDs.delete(collectedEntryIDs.keys().next().value);
    if (hasCreatorAvatar) reportAvatarDebug(prior ? "enrichment-requested" : "initial-requested", stableID);
    reportDiagnostic("collection-requested");
    const accepted = await requestCollection(entry);
    if (!accepted) {
      collectedEntryIDs.delete(stableID);
      if (hasCreatorAvatar) reportAvatarDebug("delivery-rejected", stableID);
      reportDiagnostic("collection-rejected", "rejected");
      return;
    }
    if (hasCreatorAvatar) reportAvatarDebug("delivery-accepted", stableID);
    reportDiagnostic("collection-accepted");
  }

  function collectCard(card) {
    if (!collectionEnabled || isAdvertisement(card)) return;
    const entry = feedEvidence(card);
    if (!entry) return;
    const source = findSource(card);
    TagUI?.observe?.({
      platform: PLATFORM,
      sourceID: entry.sourceID,
      root: card,
      anchor: source.link || null
    });
    void collectEntry(entry);
  }

  function collectPage() {
    if (!collectionEnabled) return;
    const entry = watchEvidence();
    if (!entry) {
      reportDiagnostic("page-evidence-missing", lastWatchEvidenceFailure || "missing-watch-root");
      return;
    }
    reportDiagnostic("page-evidence-ready");
    const watchRoot = document.querySelector("ytd-watch-metadata")
      || document.querySelector("ytd-reel-player-overlay-renderer")
      || document.querySelector("#above-the-fold")
      || document.querySelector("ytd-shorts");
    const source = watchRoot ? findSource(watchRoot) : null;
    TagUI?.observe?.({
      platform: PLATFORM,
      sourceID: entry.sourceID,
      root: watchRoot || document.documentElement,
      anchor: source?.link || null
    });
    void collectEntry(entry);
  }

  function scheduleScan(delay = 250) {
    if (scanTimer) {
      if (delay !== 0) return;
      clearTimeout(scanTimer);
    }
    scanTimer = setTimeout(() => {
      scanTimer = null;
      document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
        collectCard(card);
      });
    }, delay);
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
        TagUI?.clearPlatform?.(PLATFORM);
        reportAvatarDebug("collection-disabled");
        reportDiagnostic("collection-info-disabled");
      }
      if (collectionEnabled) {
        scheduleScan();
        schedulePageCheck();
      }
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.globalSettings) {
      applyAvatarDebugSettings(changes.globalSettings.newValue);
      if (avatarDebugEnabled) reportAvatarDebug("debug-ready");
    }
    if (area !== "local" || !changes[SETTINGS_KEY]) return;
    refreshCollectionEnabled();
  });
  window.addEventListener("yt-navigate-finish", () => {
    collectedEntryIDs.clear();
    reportedDiagnostics.clear();
    reportedAvatarDebugStages.clear();
    scheduleScan();
    schedulePageCheck();
  });
  const observer = new MutationObserver((mutations) => {
    if (!collectionEnabled) return;
    // A lazy-image source is an explicit signal that the author avatar is now
    // usable. Re-collect without the normal debounce so the local app starts
    // its bounded icon download at feed-load time.
    const avatarSourceChanged = mutations.some((mutation) =>
      mutation?.type === "attributes" && AVATAR_SOURCE_ATTRIBUTES.includes(mutation.attributeName)
    );
    scheduleScan(avatarSourceChanged ? 0 : 250);
    schedulePageCheck();
  });
  const observeRenderedEvidence = (root) => observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: AVATAR_SOURCE_ATTRIBUTES
  });
  if (document.documentElement) observeRenderedEvidence(document.documentElement);
  else document.addEventListener("DOMContentLoaded", () => observeRenderedEvidence(document.documentElement), { once: true });
  reportDiagnostic("collector-started");
  avatarDebugSettingsReady.then(() => {
    refreshCollectionEnabled();
    // A collection toggle lives in the local Vault app rather than extension
    // storage. This bounded status poll carries no page metadata; the app still
    // rejects every collection request after a toggle is turned off.
    setInterval(refreshCollectionEnabled, 15_000);
  });
})();
