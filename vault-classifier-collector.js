// Vault Classifier public-content collection for reviewed non-YouTube feeds.
//
// The platform profile registry remains the single source of DOM selectors.
// This adapter deliberately retains an entry only when it can identify both a
// platform-owned content URL and a platform-normalized creator/account. A
// selector miss, ad marker, or unknown identity fails closed: it sends no page
// metadata rather than inventing a record from surrounding UI chrome.
(function (global) {
  "use strict";

  const C = global.VaultClassifierExtensionContract;
  const PLATFORM_IDS = Object.freeze([
    "tiktok", "facebook", "instagram", "twitch", "reddit", "twitter",
    "bluesky", "threads", "substack", "bilibili", "rumble", "pinterest",
    "tumblr", "peertube", "pixelfed"
  ]);
  const DIRECT_SOURCE_FROM_ENTRY = new Set(["tiktok", "twitter", "bluesky", "threads"]);
  const TRACKING_QUERY_KEYS = new Set([
    "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "source",
    "feature", "si", "spm", "igshid"
  ]);

  function compactText(value, maximum) {
    if (typeof value !== "string") return null;
    const compact = value.replace(/\s+/g, " ").trim();
    return compact && compact.length <= maximum ? compact : null;
  }

  function safeURL(value, base) {
    if (typeof value !== "string" || !value) return null;
    try {
      const url = new URL(value, base);
      return url.protocol === "http:" || url.protocol === "https:" ? url : null;
    } catch (_) {
      return null;
    }
  }

  function canonicalContentURL(platform, value, base) {
    const url = safeURL(value, base);
    if (!url || !C || !C.isTrustedCollectionURL(platform, url.href)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    return url.href;
  }

  function shortHash(value) {
    let first = 0x811c9dc5;
    let second = 0x01000193;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 0x01000193);
      second = Math.imul(second ^ code, 0x85ebca6b);
    }
    return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
  }

  function entryIdentifier(platform, canonicalURL) {
    const direct = `${platform}:content:${canonicalURL}`;
    return direct.length <= 256 ? direct : `${platform}:content:${shortHash(canonicalURL)}`;
  }

  function sourceIdentity(platform, sourceURL, entryURL) {
    const normalize = global.normalizePlatformEntityInput;
    if (typeof normalize !== "function") return null;
    const fromSource = sourceURL ? normalize(sourceURL, platform) : null;
    const fromEntry = !fromSource && DIRECT_SOURCE_FROM_ENTRY.has(platform) ? normalize(entryURL, platform) : null;
    return compactText(fromSource || fromEntry, 180);
  }

  function entryType(platform, canonicalURL) {
    const url = safeURL(canonicalURL);
    const path = url?.pathname.toLowerCase() || "";
    if (platform === "tiktok") return "short";
    if (platform === "facebook") return path.includes("/reel/") || path.includes("/share/r/") ? "short" : path.includes("/posts/") || path.includes("/permalink/") ? "post" : "video";
    if (platform === "instagram") return path.startsWith("/reel/") ? "short" : path.startsWith("/p/") ? "post" : "video";
    if (platform === "twitch") return path.includes("/clip/") ? "short" : path.startsWith("/videos/") ? "video" : "live";
    if (platform === "reddit") return "post";
    if (platform === "twitter" || platform === "bluesky" || platform === "threads" || platform === "tumblr" || platform === "pixelfed") return "post";
    if (platform === "bilibili" || platform === "rumble" || platform === "peertube") return "video";
    return "content";
  }

  function makeCollectedEntry(raw) {
    if (!raw || !PLATFORM_IDS.includes(raw.platform) || !C) return null;
    const canonicalURL = canonicalContentURL(raw.platform, raw.entryURL, raw.baseURL);
    const title = compactText(raw.title, 500);
    if (!canonicalURL || !title) return null;
    const sourceURL = raw.sourceURL && C.isTrustedCollectionURL(raw.platform, raw.sourceURL, raw.baseURL)
      ? raw.sourceURL
      : null;
    const creatorURL = sourceURL ? canonicalContentURL(raw.platform, sourceURL, raw.baseURL) : null;
    const creator = sourceIdentity(raw.platform, sourceURL, canonicalURL);
    if (!creator) return null;
    const sourceName = compactText(raw.sourceName, 256) || creator;
    const metadata = {
      sourceName,
      entryType: entryType(raw.platform, canonicalURL),
      canonicalURL
    };
    if (creatorURL) metadata.creatorURL = creatorURL;
    const creatorAvatarURL = canonicalCreatorAvatarURL(raw.platform, raw.creatorAvatarURL, raw.baseURL);
    if (creatorAvatarURL) metadata.creatorAvatarURL = creatorAvatarURL;
    return C.normalizeEvidence({
      platform: raw.platform,
      entryID: entryIdentifier(raw.platform, canonicalURL),
      sourceID: `${raw.platform}:creator:${creator}`,
      surface: "feed",
      evidence: {
        title,
        metadata
      }
    });
  }

  function canonicalCreatorAvatarURL(platform, value, base) {
    if (!C?.isTrustedCreatorAvatarURL?.(platform, value, base)) return null;
    const url = safeURL(value, base);
    if (!url) return null;
    url.hash = "";
    return url.href.length <= 512 ? url.href : null;
  }

  function isContentURL(platform, value) {
    const url = safeURL(value, global.location?.href);
    if (!url || !C?.isTrustedCollectionURL(platform, url.href)) return false;
    const path = url.pathname.toLowerCase();
    switch (platform) {
      case "tiktok": return /\/@[^/]+\/video\//.test(path);
      case "facebook": return /\/(reel|watch|videos|posts|permalink|share\/r|share\/v)\//.test(path);
      case "instagram": return /\/(reel|p|tv)\//.test(path);
      case "twitch": return Boolean(url.searchParams.get("video")) || /\/(clip|videos)\//.test(path);
      case "reddit": return /\/r\/[^/]+\/comments\//.test(path);
      case "twitter": return /^\/[^/]+\/status\/[0-9]+/.test(path);
      case "bluesky": return /^\/profile\/[^/]+\/post\//.test(path);
      case "threads": return /^\/@[^/]+\/post\//.test(path);
      case "substack": return /\/(?:@[^/]+\/note|p)\//.test(path);
      case "bilibili": return /\/video\/bv/i.test(path);
      case "rumble": return /^\/v[^/]+/.test(path);
      case "pinterest": return /^\/pin\//.test(path);
      case "tumblr": return /\/post\//.test(path);
      case "peertube": return /^\/w\//.test(path);
      case "pixelfed": return /^\/p\//.test(path);
      default: return false;
    }
  }

  const Collector = Object.freeze({
    platformIDs: PLATFORM_IDS,
    canCollect(platform) { return PLATFORM_IDS.includes(platform); },
    isContentURL,
    makeCollectedEntry
  });
  global.VaultClassifierCollector = Collector;

  if (!global.document || !global.chrome?.runtime || !global.chrome?.storage || !C) return;

  const platform = typeof global.getPlatformGroupTypeForHost === "function"
    ? global.getPlatformGroupTypeForHost(global.location.hostname)
    : null;
  const profile = platform && global.PLATFORM_PROFILES?.[platform];
  if (!Collector.canCollect(platform) || !profile?.feed) return;

  // This is a short-lived in-page delivery guard, not a collection cache.
  // The classifier app owns opted-in retention; the extension keeps at most a
  // small set of identifiers for five minutes to prevent mutation storms from
  // resending the same visible card.
  const sentEntryIDs = new Map();
  const COLLECTION_DEDUPLICATION_MS = 5 * 60 * 1000;
  const MAX_SENT_ENTRY_IDS = 128;
  let collectionEnabled = false;
  let scanTimer = null;

  function selectorElements(root, selector) {
    const elements = [];
    try {
      if (root.matches?.(selector)) elements.push(root);
      elements.push(...root.querySelectorAll(selector));
    } catch (_) {}
    return elements;
  }

  function anchorFor(element) {
    if (element?.tagName === "A" && element.href) return element;
    return element?.closest?.("a[href]") || element?.querySelector?.("a[href]") || null;
  }

  function feedCards() {
    const cards = new Set();
    for (const selector of profile.feed.cardSelectors || []) {
      for (const element of selectorElements(document, selector)) cards.add(element);
    }
    const anchors = [];
    for (const selector of [...(profile.feed.hrefSelectors || []), ...(profile.feed.anchorSelectors || [])]) {
      for (const element of selectorElements(document, selector)) {
        const anchor = anchorFor(element);
        if (anchor) anchors.push(anchor);
      }
    }
    for (const anchor of anchors) {
      let card = null;
      for (const selector of profile.feed.containerSelectors || []) {
        try {
          card = anchor.closest(selector);
        } catch (_) {
          card = null;
        }
        if (card) break;
      }
      cards.add(card || anchor);
    }
    return [...cards];
  }

  function contentAnchor(card) {
    const candidates = [];
    for (const selector of [...(profile.feed.hrefSelectors || []), ...(profile.feed.anchorSelectors || [])]) {
      for (const element of selectorElements(card, selector)) {
        const anchor = anchorFor(element);
        if (anchor) candidates.push(anchor);
      }
    }
    for (const anchor of card.querySelectorAll?.("a[href]") || []) candidates.push(anchor);
    const unique = new Set();
    for (const anchor of candidates) {
      if (!anchor?.href || unique.has(anchor)) continue;
      unique.add(anchor);
      if (isContentURL(platform, anchor.href)) return anchor;
      if (platform === "twitch" && anchor.matches?.('a[data-a-target="preview-card-image-link"], a[data-a-target="preview-card-title-link"]')) return anchor;
    }
    return null;
  }

  function sourceAnchor(card, entry) {
    const normalize = global.normalizePlatformEntityInput;
    if (typeof normalize !== "function") return null;
    const entryURL = canonicalContentURL(platform, entry.href, global.location.href);
    const entryIdentity = entryURL ? normalize(entryURL, platform) : null;
    let firstSource = null;
    for (const anchor of card.querySelectorAll?.("a[href]") || []) {
      const candidateURL = canonicalContentURL(platform, anchor.href, global.location.href);
      if (!candidateURL || candidateURL === entryURL || !normalize(candidateURL, platform)) continue;
      const candidateIdentity = normalize(candidateURL, platform);
      // Direct-source platforms encode the author in the content URL. Match
      // that identity exactly so a repost, quoted author, or nearby account
      // cannot become the collected creator (or donate its avatar).
      if (DIRECT_SOURCE_FROM_ENTRY.has(platform)) {
        if (entryIdentity && candidateIdentity === entryIdentity) return anchor;
        continue;
      }
      if (!firstSource) firstSource = anchor;
    }
    return firstSource;
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

  function creatorAvatarURL(card, source) {
    if (!source?.href) return null;
    const sourceURL = canonicalContentURL(platform, source.href, global.location.href);
    const normalize = global.normalizePlatformEntityInput;
    if (!sourceURL || typeof normalize !== "function") return null;
    const sourceIdentity = normalize(sourceURL, platform);
    if (!sourceIdentity) return null;

    // An avatar is author-scoped only when its own anchor resolves to exactly
    // the already-verified source identity. Never inspect a bare card image:
    // those are normally video/media thumbnails or other people.
    const authorAnchors = [];
    for (const anchor of card.querySelectorAll?.("a[href]") || []) {
      const candidateURL = canonicalContentURL(platform, anchor.href, global.location.href);
      if (candidateURL && normalize(candidateURL, platform) === sourceIdentity) authorAnchors.push(anchor);
    }
    if (!authorAnchors.includes(source)) authorAnchors.unshift(source);
    for (const authorAnchor of authorAnchors) {
      for (const image of authorAnchor.querySelectorAll?.("img") || []) {
        const candidate = canonicalCreatorAvatarURL(platform, imageURLFrom(image), global.location.href);
        if (candidate) return candidate;
      }
    }
    return null;
  }

  function visibleTitle(card, entry) {
    const preferred = [
      "[data-e2e*='title']", "[data-testid*='title']", "h1", "h2", "h3",
      "a[aria-label]"
    ];
    for (const selector of preferred) {
      for (const element of selectorElements(card, selector)) {
        const title = compactText(element.getAttribute?.("aria-label") || element.textContent, 500);
        if (title) return title;
      }
    }
    return compactText(entry.getAttribute?.("aria-label") || entry.textContent, 500)
      || compactText(card.textContent, 500);
  }

  function isAdvertisement(card) {
    const marker = [
      card.getAttribute?.("data-promoted"),
      card.getAttribute?.("data-ad"),
      card.getAttribute?.("aria-label")
    ].filter(Boolean).join(" ").toLowerCase();
    if (/\b(promoted|sponsored|advertisement|advertising)\b/.test(marker)) return true;
    try {
      return Boolean(card.querySelector("[data-promoted], [data-ad], [data-testid*='promoted'], [data-e2e*='ad-']"));
    } catch (_) {
      return false;
    }
  }

  function rememberEntryID(entryID) {
    const now = Date.now();
    for (const [candidate, timestamp] of sentEntryIDs) {
      if (now - timestamp > COLLECTION_DEDUPLICATION_MS) sentEntryIDs.delete(candidate);
    }
    if (sentEntryIDs.has(entryID)) return false;
    sentEntryIDs.set(entryID, now);
    while (sentEntryIDs.size > MAX_SENT_ENTRY_IDS) sentEntryIDs.delete(sentEntryIDs.keys().next().value);
    return true;
  }

  function collectCard(card) {
    if (!collectionEnabled || isAdvertisement(card)) return;
    const entry = contentAnchor(card);
    if (!entry) return;
    const source = sourceAnchor(card, entry);
    const evidence = makeCollectedEntry({
      platform,
      entryURL: entry.href,
      sourceURL: source?.href || null,
      title: visibleTitle(card, entry),
      sourceName: source?.getAttribute?.("aria-label") || source?.textContent || "",
      creatorAvatarURL: creatorAvatarURL(card, source),
      baseURL: global.location.href
    });
    if (!evidence || !rememberEntryID(evidence.entryID)) return;
    try {
      chrome.runtime.sendMessage({ type: "vault-classifier-collect", entry: evidence }, (response) => {
        if (chrome.runtime.lastError || !response?.accepted) sentEntryIDs.delete(evidence.entryID);
      });
    } catch (_) {
      sentEntryIDs.delete(evidence.entryID);
    }
  }

  function scheduleScan() {
    if (scanTimer || !collectionEnabled) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      for (const card of feedCards().slice(0, 80)) collectCard(card);
    }, 250);
  }

  function refreshCollectionEnabled() {
    try {
      chrome.runtime.sendMessage({ type: "vault-classifier-collection-info", platform }, (response) => {
        if (chrome.runtime.lastError) return;
        collectionEnabled = Boolean(response?.ok === true && response.enabled === true);
        if (collectionEnabled) scheduleScan();
      });
    } catch (_) {}
  }

  const observer = new MutationObserver(scheduleScan);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => observer.observe(document.documentElement, { childList: true, subtree: true }), { once: true });
  refreshCollectionEnabled();
  setInterval(refreshCollectionEnabled, 15_000);
})(typeof globalThis !== "undefined" ? globalThis : this);
