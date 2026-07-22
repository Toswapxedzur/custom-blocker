// Shared local-only delivery mechanics for the platform-specific Vault
// Classifier collectors. Each supported platform owns its DOM extraction in a
// dedicated script; this file deliberately contains no cross-platform card or
// author guessing.
(function (global) {
  "use strict";

  const C = global.VaultClassifierExtensionContract;
  const AVATAR_SOURCE_ATTRIBUTES = Object.freeze([
    "src", "srcset", "data-src", "data-lazy-src", "data-original", "data-srcset"
  ]);
  const TRACKING_QUERY_KEYS = new Set([
    "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "source",
    "feature", "si", "spm", "igshid"
  ]);
  const COLLECTION_DEDUPLICATION_MS = 5 * 60 * 1000;
  const MAX_SENT_ENTRY_IDS = 128;

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
    if (!url || !C || !C.isTrustedCollectionURL(platform, url.href, base)) return null;
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
    return compactText(normalize(sourceURL || entryURL, platform), 180);
  }

  function normalizedSourceIdentity(platform, value) {
    return sourceIdentity(platform, value, null);
  }

  function canonicalCreatorAvatarURL(platform, value, base) {
    if (!C?.isTrustedCreatorAvatarURL?.(platform, value, base)) return null;
    const url = safeURL(value, base);
    if (!url) return null;
    url.hash = "";
    return url.href.length <= 512 ? url.href : null;
  }

  function makeCollectedEntry(raw) {
    if (!raw || !C) return null;
    const platform = compactText(raw.platform, 64);
    const sourceKind = compactText(raw.sourceKind, 32);
    const title = compactText(raw.title, 500);
    if (!platform || !sourceKind || !/^[a-z]+$/.test(sourceKind) || !title) return null;

    const canonicalURL = canonicalContentURL(platform, raw.entryURL, raw.baseURL);
    if (!canonicalURL) return null;
    const normalizedSourceID = compactText(raw.sourceID, 256);
    const identity = compactText(raw.sourceIdentity, 180)
      || sourceIdentity(platform, raw.sourceURL, canonicalURL);
    const sourceID = normalizedSourceID || (identity ? `${platform}:${sourceKind}:${identity}` : null);
    if (!sourceID || sourceID.length > 256) return null;

    const sourceName = compactText(raw.sourceName, 256) || identity || sourceID;
    const metadata = {
      sourceName,
      sourceKind,
      entryType: compactText(raw.entryType, 64) || "content",
      canonicalURL
    };
    const profileSource = sourceKind === "creator" || sourceKind === "account";
    const sourceURL = raw.sourceURL ? canonicalContentURL(platform, raw.sourceURL, raw.baseURL) : null;
    if (sourceURL && profileSource) metadata.creatorURL = sourceURL;
    const creatorAvatarURL = canonicalCreatorAvatarURL(platform, raw.creatorAvatarURL, raw.baseURL);
    if (creatorAvatarURL && profileSource) metadata.creatorAvatarURL = creatorAvatarURL;

    return C.normalizeEvidence({
      platform,
      entryID: entryIdentifier(platform, canonicalURL),
      sourceID,
      surface: "feed",
      evidence: { title, metadata }
    });
  }

  function selectorElements(root, selector) {
    const elements = [];
    try {
      if (root?.matches?.(selector)) elements.push(root);
      elements.push(...(root?.querySelectorAll?.(selector) || []));
    } catch (_) {}
    return elements;
  }

  function uniqueElements(elements) {
    return [...new Set(elements.filter(Boolean))];
  }

  function firstAnchor(root, selectors, predicate) {
    for (const selector of selectors) {
      for (const element of selectorElements(root, selector)) {
        const anchor = element?.tagName === "A" && element.href
          ? element
          : element?.closest?.("a[href]") || element?.querySelector?.("a[href]");
        if (anchor?.href && (!predicate || predicate(anchor))) return anchor;
      }
    }
    return null;
  }

  function firstText(root, selectors, maximum = 500) {
    for (const selector of selectors) {
      for (const element of selectorElements(root, selector)) {
        const text = compactText(element.getAttribute?.("aria-label") || element.textContent, maximum);
        if (text) return text;
      }
    }
    return null;
  }

  function imageURLFrom(element) {
    if (!element?.getAttribute) return null;
    for (const attribute of ["src", "data-src", "data-lazy-src", "data-original"]) {
      const value = element.getAttribute(attribute);
      if (value) return value;
    }
    const srcset = element.getAttribute("srcset") || element.getAttribute("data-srcset");
    return srcset?.split(",")[0]?.trim().split(/\s+/)[0] || null;
  }

  function avatarFromVerifiedSource(platform, sourceAnchor, baseURL) {
    if (!sourceAnchor) return null;
    for (const image of sourceAnchor.querySelectorAll?.("img") || []) {
      const imageURL = canonicalCreatorAvatarURL(platform, imageURLFrom(image), baseURL);
      if (imageURL) return imageURL;
    }
    return null;
  }

  function matchingSourceAnchor(platform, card, referenceURL) {
    const identity = normalizedSourceIdentity(platform, referenceURL);
    if (!identity) return null;
    for (const anchor of card?.querySelectorAll?.("a[href]") || []) {
      if (normalizedSourceIdentity(platform, anchor.href) === identity) return anchor;
    }
    return null;
  }

  function firstNormalizedSourceAnchor(platform, card, excludedURL) {
    for (const anchor of card?.querySelectorAll?.("a[href]") || []) {
      if (anchor.href === excludedURL || !normalizedSourceIdentity(platform, anchor.href)) continue;
      return anchor;
    }
    return null;
  }

  function start(config) {
    if (!C || !global.document || !global.chrome?.runtime || !global.chrome?.storage || !config || typeof config.scan !== "function") return null;
    const platform = compactText(config.platform, 64);
    if (!platform || (typeof config.matchesPage === "function" && !config.matchesPage(global.location))) return null;

    const sentEntryIDs = new Map();
    let collectionEnabled = false;
    let scanTimer = null;

    function rememberEntryID(entryID, hasCreatorAvatar) {
      const now = Date.now();
      for (const [candidate, prior] of sentEntryIDs) {
        if (now - prior.timestamp > COLLECTION_DEDUPLICATION_MS) sentEntryIDs.delete(candidate);
      }
      const prior = sentEntryIDs.get(entryID);
      // A card may render text before its verified profile image URL. One
      // later enriched delivery is allowed; all other mutation churn is local.
      if (prior && (prior.hasCreatorAvatar || !hasCreatorAvatar)) return false;
      sentEntryIDs.set(entryID, { timestamp: now, hasCreatorAvatar });
      while (sentEntryIDs.size > MAX_SENT_ENTRY_IDS) sentEntryIDs.delete(sentEntryIDs.keys().next().value);
      return true;
    }

    function deliver(raw) {
      if (!collectionEnabled) return;
      const evidence = makeCollectedEntry({ ...raw, platform, baseURL: global.location.href });
      if (!evidence || !rememberEntryID(evidence.entryID, Boolean(evidence.evidence?.metadata?.creatorAvatarURL))) return;
      try {
        chrome.runtime.sendMessage({ type: "vault-classifier-collect", entry: evidence }, (response) => {
          if (chrome.runtime.lastError || !response?.accepted) sentEntryIDs.delete(evidence.entryID);
        });
      } catch (_) {
        sentEntryIDs.delete(evidence.entryID);
      }
    }

    function scheduleScan() {
      if (!collectionEnabled || scanTimer) return;
      scanTimer = setTimeout(() => {
        scanTimer = null;
        try { config.scan({ document: global.document, collect: deliver, core: api }); } catch (_) {}
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

    const observer = new MutationObserver((records) => {
      // Every collector gets the late-source handling previously required by
      // YouTube, but only approved image attributes trigger an attribute scan.
      if (records.some((record) => record.type === "childList" || (record.type === "attributes" && record.target?.matches?.("img, source")))) scheduleScan();
    });
    const observerOptions = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: AVATAR_SOURCE_ATTRIBUTES
    };
    if (document.documentElement) observer.observe(document.documentElement, observerOptions);
    else document.addEventListener("DOMContentLoaded", () => observer.observe(document.documentElement, observerOptions), { once: true });
    refreshCollectionEnabled();
    setInterval(refreshCollectionEnabled, 15_000);
    return { platform, refreshCollectionEnabled, scheduleScan };
  }

  const api = Object.freeze({
    AVATAR_SOURCE_ATTRIBUTES,
    compactText,
    safeURL,
    canonicalContentURL,
    normalizedSourceIdentity,
    makeCollectedEntry,
    selectorElements,
    uniqueElements,
    firstAnchor,
    firstText,
    imageURLFrom,
    avatarFromVerifiedSource,
    matchingSourceAnchor,
    firstNormalizedSourceAnchor,
    start
  });
  global.VaultClassifierCollectorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
