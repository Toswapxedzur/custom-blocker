// Shared local-only delivery mechanics for the platform-specific Vault
// Classifier collectors. Each supported platform owns its DOM extraction in a
// dedicated script; this file deliberately contains no cross-platform card or
// author guessing.
(function (global) {
  "use strict";

  const C = global.VaultClassifierExtensionContract;
  const TagUI = global.VaultClassifierTagUI;
  const SETTINGS_KEY = "vaultClassifierSettings";
  const SOURCE_ICON_ATTRIBUTES = Object.freeze([
    "src", "srcset", "data-src", "data-lazy-src", "data-original", "data-srcset"
  ]);
  const TRACKING_QUERY_KEYS = new Set([
    "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "source",
    "feature", "si", "spm", "igshid"
  ]);
  const COLLECTION_DEDUPLICATION_MS = 5 * 60 * 1000;
  const MAX_SENT_ENTRY_IDS = 128;
  const DIAGNOSTIC_DETAILS = new Set([
    "missing-content-id", "missing-content-root", "missing-title", "missing-source",
    "runtime-last-error", "bridge-unavailable", "rejected", "timeout"
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

  function canonicalSourceIconURL(platform, value, base) {
    if (!C?.isTrustedSourceIconURL?.(platform, value, base)) return null;
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
    const text = compactText(raw.text, 16000);
    const summary = compactText(raw.summary, 16000);
    const suppliedTags = Array.isArray(raw.suppliedTags)
      ? raw.suppliedTags.map((value) => compactText(value, 256)).filter(Boolean).slice(0, 64)
      : [];
    if (!platform || !sourceKind || !/^[a-z]+$/.test(sourceKind) || (!title && !text && !summary && suppliedTags.length === 0)) return null;

    const canonicalURL = canonicalContentURL(platform, raw.entryURL, raw.baseURL);
    if (!canonicalURL) return null;
    const normalizedSourceID = compactText(raw.sourceID, 256);
    const identity = compactText(raw.sourceIdentity, 180)
      || sourceIdentity(platform, raw.sourceURL, canonicalURL);
    const sourceID = normalizedSourceID || (identity ? `${platform}:${sourceKind}:${identity}` : null);
    if (!sourceID || sourceID.length > 256) return null;

    const sourceName = compactText(raw.sourceName, 256) || identity || sourceID;
    const metadata = {
      ...(raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata) ? raw.metadata : {}),
      sourceName,
      sourceKind,
      entryType: compactText(raw.entryType, 64) || "content",
      canonicalURL
    };
    const sourceURL = raw.sourceURL ? canonicalContentURL(platform, raw.sourceURL, raw.baseURL) : null;
    if (sourceURL) metadata.sourceURL = sourceURL;
    const sourceIconURL = canonicalSourceIconURL(platform, raw.sourceIconURL, raw.baseURL);
    if (sourceIconURL) metadata.sourceIconURL = sourceIconURL;

    const requestedEntryID = compactText(raw.entryID, 256);
    const entryID = requestedEntryID && requestedEntryID.startsWith(`${platform}:`)
      ? requestedEntryID
      : entryIdentifier(platform, canonicalURL);
    return C.normalizeEvidence({
      platform,
      entryID,
      sourceID,
      surface: raw.surface === "page" ? "page" : "feed",
      evidence: { title, text, summary, suppliedTags, metadata }
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

  function firstElement(root, selectors) {
    for (const selector of selectors) {
      const element = selectorElements(root, selector)[0];
      if (element) return element;
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

  function sourceIconFromVerifiedSource(platform, sourceElement, baseURL) {
    if (!sourceElement) return null;
    const images = [
      ...(sourceElement.matches?.("img") ? [sourceElement] : []),
      ...(sourceElement.querySelectorAll?.("img") || [])
    ];
    for (const image of images) {
      const imageURL = canonicalSourceIconURL(platform, imageURLFrom(image), baseURL);
      if (imageURL) return imageURL;
    }
    const styledElements = [
      ...(sourceElement.getAttribute?.("style") ? [sourceElement] : []),
      ...(sourceElement.querySelectorAll?.('[style*="background-image"]') || [])
    ];
    for (const element of styledElements) {
      const backgroundImage = element.style?.backgroundImage || element.getAttribute?.("style") || "";
      const match = String(backgroundImage).match(/url\(\s*["']?([^"')]+)["']?\s*\)/i);
      const imageURL = canonicalSourceIconURL(platform, match?.[1], baseURL);
      if (imageURL) return imageURL;
    }
    return null;
  }

  function contentURLIdentity(platform, value, baseURL) {
    const canonical = canonicalContentURL(platform, value, baseURL);
    if (!canonical) return null;
    try {
      const url = new URL(canonical);
      const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
      return `${url.hostname.toLowerCase()}${pathname}`;
    } catch (_) {
      return null;
    }
  }

  // Detail overlays on several platforms leave feed cards mounted behind the
  // active item. Select a root only when its own permalink/id or a descendant
  // link resolves to the requested route; never accept the document's first
  // article merely because it is rendered.
  function matchingContentRoot(platform, root, selectors, referenceURL, baseURL) {
    const identity = contentURLIdentity(platform, referenceURL, baseURL);
    if (!identity) return null;
    const candidates = [];
    for (const selector of selectors) {
      for (const candidate of selectorElements(root, selector)) {
        if (!candidates.includes(candidate)) candidates.push(candidate);
        const values = [
          candidate?.href,
          candidate?.getAttribute?.("href"),
          candidate?.getAttribute?.("permalink"),
          candidate?.getAttribute?.("content-href")
        ].filter(Boolean);
        for (const anchor of candidate?.querySelectorAll?.("a[href]") || []) {
          values.push(anchor.href || anchor.getAttribute?.("href"));
        }
        if (values.some((value) => contentURLIdentity(platform, value, baseURL) === identity)) {
          return candidate;
        }
      }
    }
    // A single dedicated detail root is safe even when the platform omits a
    // self-link. Ambiguous multi-card documents must match the requested URL.
    return candidates.length === 1 ? candidates[0] : null;
  }

  function matchingSourceAnchor(platform, card, referenceURL) {
    const identity = contentURLIdentity(platform, referenceURL, global.location?.href);
    if (!identity) return null;
    for (const anchor of card?.querySelectorAll?.("a[href]") || []) {
      if (contentURLIdentity(platform, anchor.href, global.location?.href) === identity) return anchor;
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

  function firstVerifiedSourceAnchor(platform, root, selectors, excludedURL) {
    for (const selector of selectors) {
      for (const anchor of selectorElements(root, selector)) {
        const link = anchor?.tagName === "A" && anchor.href
          ? anchor
          : anchor?.closest?.("a[href]") || anchor?.querySelector?.("a[href]");
        if (!link?.href || link.href === excludedURL || !normalizedSourceIdentity(platform, link.href)) continue;
        return link;
      }
    }
    return null;
  }

  function start(config) {
    if (!C || !global.document || !global.chrome?.runtime || !global.chrome?.storage || !config || typeof config.scan !== "function") return null;
    const platform = compactText(config.platform, 64);
    if (!platform || (typeof config.matchesPage === "function" && !config.matchesPage(global.location))) return null;

    const sentEntryIDs = new Map();
    const reportedDiagnostics = new Set();
    const reportedSourceIconDebugStages = new Set();
    let collectionEnabled = false;
    let scanTimer = null;
    let pageTimer = null;
    let collectionEpoch = 0;
    let sourceIconDebugEnabled = false;
    let sourceIconDebugSettingsResolved = false;
    let resolveSourceIconDebugSettings;
    const sourceIconDebugSettingsReady = new Promise((resolve) => {
      resolveSourceIconDebugSettings = resolve;
    });

    function reportDiagnostic(event, detail) {
      if (detail != null && !DIAGNOSTIC_DETAILS.has(detail)) return;
      const key = `${event}:${detail || ""}`;
      if (reportedDiagnostics.has(key)) return;
      reportedDiagnostics.add(key);
      while (reportedDiagnostics.size > MAX_SENT_ENTRY_IDS) reportedDiagnostics.delete(reportedDiagnostics.values().next().value);
      try {
        chrome.runtime.sendMessage({
          type: "vault-classifier-diagnostic",
          platform,
          event,
          ...(detail ? { detail } : {})
        }, () => void chrome.runtime.lastError);
      } catch (_) {}
    }

    function reportSourceIconDebug(stage) {
      if (!sourceIconDebugEnabled || typeof stage !== "string") return;
      if (reportedSourceIconDebugStages.has(stage)) return;
      reportedSourceIconDebugStages.add(stage);
      while (reportedSourceIconDebugStages.size > MAX_SENT_ENTRY_IDS) reportedSourceIconDebugStages.delete(reportedSourceIconDebugStages.values().next().value);
      try { console.debug("[VaultClassifier:source-icon]", `${platform}:${stage}`); } catch (_) {}
    }

    function resolveSourceIconDebugSettingsOnce(settings) {
      if (sourceIconDebugSettingsResolved) return;
      sourceIconDebugSettingsResolved = true;
      sourceIconDebugEnabled = settings?.debugMode === true;
      if (sourceIconDebugEnabled) reportSourceIconDebug("debug-ready");
      resolveSourceIconDebugSettings();
    }

    function rememberEntryID(entryID, fingerprint) {
      const now = Date.now();
      for (const [candidate, prior] of sentEntryIDs) {
        if (now - prior.timestamp > COLLECTION_DEDUPLICATION_MS) sentEntryIDs.delete(candidate);
      }
      const prior = sentEntryIDs.get(entryID);
      // Rendered records often gain a caption, source icon, or detail text
      // after their first paint. Deliver each distinct bounded evidence state
      // once while suppressing unchanged mutation churn.
      if (prior?.fingerprint === fingerprint) return false;
      sentEntryIDs.set(entryID, { timestamp: now, fingerprint });
      while (sentEntryIDs.size > MAX_SENT_ENTRY_IDS) sentEntryIDs.delete(sentEntryIDs.keys().next().value);
      return true;
    }

    function deliver(raw) {
      if (!collectionEnabled) return;
      const evidence = makeCollectedEntry({ ...raw, platform, baseURL: global.location.href });
      if (!evidence) {
        reportSourceIconDebug("source-missing");
        return;
      }
      if (raw.presentationRoot) {
        TagUI?.observe?.({
          platform,
          sourceID: evidence.sourceID,
          root: raw.presentationRoot,
          anchor: raw.presentationAnchor || null
        });
      }
      const hasSourceIcon = Boolean(evidence.evidence?.metadata?.sourceIconURL);
      if (!hasSourceIcon) reportSourceIconDebug(raw.sourceIconURL ? "source-untrusted" : "image-missing");
      else reportSourceIconDebug("source-ready");
      const fingerprint = C.entryFingerprint?.(evidence) || evidence.requestID;
      if (!rememberEntryID(evidence.entryID, fingerprint)) {
        if (hasSourceIcon) reportSourceIconDebug("delivery-suppressed");
        return;
      }
      if (hasSourceIcon) reportSourceIconDebug("enrichment-requested");
      reportDiagnostic("collection-requested");
      try {
        chrome.runtime.sendMessage({ type: "vault-classifier-collect", entry: evidence }, (response) => {
          if (chrome.runtime.lastError || !response?.accepted) {
            sentEntryIDs.delete(evidence.entryID);
            if (hasSourceIcon) reportSourceIconDebug("delivery-rejected");
            reportDiagnostic("collection-rejected", "rejected");
            return;
          }
          if (hasSourceIcon) reportSourceIconDebug("delivery-accepted");
          if (!response.queued) reportDiagnostic("collection-accepted");
        });
      } catch (_) {
        sentEntryIDs.delete(evidence.entryID);
        if (hasSourceIcon) reportSourceIconDebug("delivery-rejected");
        reportDiagnostic("collection-rejected", "bridge-unavailable");
      }
    }

    function scheduleScan(delay = 250) {
      if (!collectionEnabled) return;
      if (scanTimer) {
        if (delay !== 0) return;
        clearTimeout(scanTimer);
      }
      scanTimer = setTimeout(() => {
        scanTimer = null;
        try { config.scan({ document: global.document, collect: deliver, core: api }); } catch (_) {}
      }, delay);
    }

    function schedulePageCheck() {
      if (!collectionEnabled || typeof config.scanPage !== "function" || pageTimer) return;
      pageTimer = setTimeout(() => {
        pageTimer = null;
        try {
          const result = config.scanPage({ document: global.document, collect: deliver, core: api }) || {};
          if (result.ready) reportDiagnostic("page-evidence-ready");
          else reportDiagnostic("page-evidence-missing", result.reason || "missing-content-root");
        } catch (_) {
          reportDiagnostic("page-evidence-missing", "missing-content-root");
        }
      }, 450);
    }

    function refreshCollectionEnabled() {
      const epoch = ++collectionEpoch;
      reportDiagnostic("collection-info-requested");
      try {
        chrome.runtime.sendMessage({ type: "vault-classifier-collection-info", platform }, (response) => {
          if (epoch !== collectionEpoch) return;
          if (chrome.runtime.lastError || !response?.ok) {
            reportDiagnostic("collection-info-failed", "runtime-last-error");
            return;
          }
          collectionEnabled = Boolean(response?.ok === true && response.enabled === true);
          if (collectionEnabled) {
            reportDiagnostic("collection-info-enabled");
            scheduleScan();
            schedulePageCheck();
          } else {
            TagUI?.clearPlatform?.(platform);
            reportSourceIconDebug("collection-disabled");
            reportDiagnostic("collection-info-disabled");
          }
        });
      } catch (_) {
        reportDiagnostic("collection-info-failed", "bridge-unavailable");
      }
    }

    const observer = new MutationObserver((records) => {
      // Every collector gets the late-source handling previously required by
      // YouTube, but only approved image attributes trigger an attribute scan.
      const sourceIconChanged = records.some((record) => record.type === "attributes" && record.target?.matches?.("img, source"));
      if (records.some((record) => record.type === "childList") || sourceIconChanged) scheduleScan(sourceIconChanged ? 0 : 250);
      schedulePageCheck();
    });
    const observerOptions = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: SOURCE_ICON_ATTRIBUTES
    };
    if (document.documentElement) observer.observe(document.documentElement, observerOptions);
    else document.addEventListener("DOMContentLoaded", () => observer.observe(document.documentElement, observerOptions), { once: true });
    global.addEventListener?.("popstate", () => {
      sentEntryIDs.clear();
      reportedDiagnostics.clear();
      reportedSourceIconDebugStages.clear();
      scheduleScan();
      schedulePageCheck();
    });
    global.addEventListener?.("hashchange", () => {
      sentEntryIDs.clear();
      scheduleScan();
      schedulePageCheck();
    });
    chrome.storage.onChanged?.addListener?.((changes, area) => {
      if (area !== "local") return;
      if (changes.globalSettings) {
        sourceIconDebugEnabled = changes.globalSettings.newValue?.debugMode === true;
        if (sourceIconDebugEnabled) reportSourceIconDebug("debug-ready");
      }
      if (changes[SETTINGS_KEY]) refreshCollectionEnabled();
    });
    try {
      if (typeof chrome.storage?.local?.get !== "function") {
        resolveSourceIconDebugSettingsOnce();
      } else {
        const deadline = setTimeout(() => resolveSourceIconDebugSettingsOnce(), 250);
        chrome.storage.local.get("globalSettings", (stored) => {
          clearTimeout(deadline);
          resolveSourceIconDebugSettingsOnce(stored?.globalSettings);
        });
      }
    } catch (_) {
      resolveSourceIconDebugSettingsOnce();
    }
    reportDiagnostic("collector-started");
    sourceIconDebugSettingsReady.then(() => {
      refreshCollectionEnabled();
      setInterval(refreshCollectionEnabled, 15_000);
    });
    return { platform, refreshCollectionEnabled, scheduleScan };
  }

  const api = Object.freeze({
    SOURCE_ICON_ATTRIBUTES,
    compactText,
    safeURL,
    canonicalContentURL,
    normalizedSourceIdentity,
    makeCollectedEntry,
    selectorElements,
    uniqueElements,
    firstAnchor,
    firstText,
    firstElement,
    imageURLFrom,
    sourceIconFromVerifiedSource,
    matchingContentRoot,
    matchingSourceAnchor,
    firstNormalizedSourceAnchor,
    firstVerifiedSourceAnchor,
    start
  });
  global.VaultClassifierCollectorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
