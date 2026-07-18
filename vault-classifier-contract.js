// Vault Classifier extension contract — browser-safe, dependency-free helpers.
//
// This is deliberately separate from ordinary platform feed matching. It accepts
// only bounded DOM evidence and turns a missing/invalid/shared-hub failure
// into a fail-open result. It never contacts a web service.
(function (global) {
  "use strict";

  const MAX = Object.freeze({
    id: 256,
    platform: 64,
    title: 500,
    text: 16000,
    summary: 16000,
    tags: 64,
    tag: 256,
    policy: 128,
    metadataKey: 64,
    metadataValue: 512,
    nativeBodyBytes: 46 * 1024,
    nativeKind: 64,
    nativeRequestID: 128,
    nativeNonce: 128,
    nativeMac: 44,
    resultTags: 512,
    resultDecisions: 128,
    resultExplanation: 512
  });

  const ACTION_ORDER = Object.freeze({ allow: 0, dim: 1, block: 2 });
  const OWN = Object.prototype.hasOwnProperty;
  const UNSAFE_METADATA_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  function cleanText(value, maximum) {
    if (typeof value !== "string") return null;
    const compact = value.replace(/\s+/g, " ").trim();
    return compact && compact.length <= maximum ? compact : null;
  }

  function cleanOptional(value, maximum) {
    if (value == null || value === "") return null;
    return cleanText(value, maximum);
  }

  function cleanTags(tags) {
    if (!Array.isArray(tags)) return [];
    const output = [];
    const seen = new Set();
    for (const candidate of tags) {
      const tag = cleanText(candidate, MAX.tag);
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        output.push(tag);
      }
      if (output.length >= MAX.tags) break;
    }
    return output;
  }

  function randomID(prefix) {
    const bytes = new Uint8Array(12);
    if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
    return `${prefix}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  }

  function normalizeEvidence(raw) {
    if (!raw || typeof raw !== "object") return null;
    const platform = cleanText(raw.platform, MAX.platform);
    const surface = raw.surface === "page" ? "page" : raw.surface === "feed" ? "feed" : null;
    const title = cleanOptional(raw.evidence && raw.evidence.title, MAX.title);
    const text = cleanOptional(raw.evidence && raw.evidence.text, MAX.text);
    const summary = cleanOptional(raw.evidence && raw.evidence.summary, MAX.summary);
    const suppliedTags = cleanTags(raw.evidence && raw.evidence.suppliedTags);
    if (!platform || !surface || (!title && !text && !summary && suppliedTags.length === 0)) return null;
    const entryID = cleanOptional(raw.entryID, MAX.id);
    const sourceID = cleanOptional(raw.sourceID, MAX.id);
    const policies = cleanTags(raw.policyIDs).filter((policy) => policy.length <= MAX.policy);
    return {
      requestID: cleanOptional(raw.requestID, MAX.id) || randomID("vault"),
      platform,
      entryID,
      sourceID,
      surface,
      evidence: {
        title,
        text,
        summary,
        suppliedTags,
        metadata: sanitizeMetadata(raw.evidence && raw.evidence.metadata)
      },
      policyIDs: policies
    };
  }

  function sanitizeMetadata(metadata) {
    if (!isPlainRecord(metadata)) return {};
    const result = Object.create(null);
    for (const key of Object.keys(metadata).slice(0, 64)) {
      const cleanKey = cleanText(key, MAX.metadataKey);
      const value = metadata[key];
      if (!cleanKey || UNSAFE_METADATA_KEYS.has(cleanKey)) continue;
      if (typeof value === "string") {
        const cleanValue = cleanText(value, MAX.metadataValue);
        if (cleanValue) result[cleanKey] = cleanValue;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        result[cleanKey] = value;
      } else if (typeof value === "boolean") {
        result[cleanKey] = value;
      }
    }
    return result;
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function utf8Length(value) {
    const text = typeof value === "string" ? value : String(value);
    let length = 0;
    for (let index = 0; index < text.length; index++) {
      const code = text.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
        const next = text.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          length += 4;
          index++;
          continue;
        }
      }
      if (code <= 0x7f) length += 1;
      else if (code <= 0x7ff) length += 2;
      else length += 3;
    }
    return length;
  }

  function truncateUTF8(value, maximumBytes) {
    if (typeof value !== "string" || maximumBytes <= 0) return null;
    let output = "";
    let used = 0;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      let width = 3;
      let end = index + 1;
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          width = 4;
          end = index + 2;
        }
      } else if (code <= 0x7f) width = 1;
      else if (code <= 0x7ff) width = 2;
      if (used + width > maximumBytes) break;
      output += value.slice(index, end);
      used += width;
      index = end - 1;
    }
    return output || null;
  }

  function nativeBodyByteLength(body) {
    try { return utf8Length(JSON.stringify(body)); }
    catch (_) { return Number.POSITIVE_INFINITY; }
  }

  // Native messaging has a 64 KiB frame limit and the local IPC frame is the
  // same size. Leave room for the envelope's base64 and authentication fields.
  // The app remains the authoritative validator; this keeps hostile DOM input
  // from turning a normal classification into a transport-size failure.
  function fitEntryForNativeTransport(entry) {
    if (!isPlainRecord(entry) || !isPlainRecord(entry.evidence)) return null;
    const result = {
      requestID: entry.requestID,
      platform: entry.platform,
      entryID: entry.entryID,
      sourceID: entry.sourceID,
      surface: entry.surface,
      evidence: {
        title: entry.evidence.title,
        text: entry.evidence.text,
        summary: entry.evidence.summary,
        suppliedTags: Array.isArray(entry.evidence.suppliedTags) ? entry.evidence.suppliedTags.slice() : [],
        metadata: { ...(isPlainRecord(entry.evidence.metadata) ? entry.evidence.metadata : {}) }
      },
      policyIDs: Array.isArray(entry.policyIDs) ? entry.policyIDs.slice() : []
    };
    const body = () => ({ entry: result });
    const fits = () => nativeBodyByteLength(body()) <= MAX.nativeBodyBytes;
    if (fits()) return result;

    // Metadata and excess tags are lower-value than readable page evidence.
    result.evidence.metadata = {};
    while (!fits() && result.evidence.suppliedTags.length) result.evidence.suppliedTags.pop();

    // A DOM string may be within the character contract yet exceed the byte
    // contract (for example, a long emoji-only description). Trim in a stable
    // order while retaining at least one evidence field where possible.
    for (const field of ["summary", "text", "title"]) {
      while (!fits() && typeof result.evidence[field] === "string") {
        const current = result.evidence[field];
        const excess = nativeBodyByteLength(body()) - MAX.nativeBodyBytes;
        const next = truncateUTF8(current, utf8Length(current) - excess - 64);
        if (!next || next === current) {
          result.evidence[field] = null;
          break;
        }
        result.evidence[field] = next;
      }
    }
    const hasEvidence = Boolean(result.evidence.title || result.evidence.text || result.evidence.summary || result.evidence.suppliedTags.length);
    return hasEvidence && fits() ? result : null;
  }

  function isBoundedText(value, maximum) {
    return typeof value === "string" && value.length > 0 && value.length <= maximum && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
  }

  function isBase64(value, minimumLength, maximumLength) {
    return typeof value === "string" && value.length >= minimumLength && value.length <= maximumLength && value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
  }

  function isNativeEnvelope(value, options) {
    const authenticated = Boolean(options && options.authenticated);
    if (!isPlainRecord(value) || value.protocolVersion !== 1 || !isBoundedText(value.kind, MAX.nativeKind) || !isBoundedText(value.requestID, MAX.nativeRequestID)) return false;
    if (!Number.isSafeInteger(value.timestampMilliseconds) || !isBase64(value.nonce, 16, MAX.nativeNonce)) return false;
    if (!isBase64(value.bodyBase64, 4, Math.ceil(MAX.nativeBodyBytes / 3) * 4) || typeof value.bodyHash !== "string" || !/^[0-9a-fA-F]{64}$/.test(value.bodyHash)) return false;
    if (authenticated) return isBase64(value.mac, MAX.nativeMac, MAX.nativeMac);
    return value.mac == null || isBase64(value.mac, MAX.nativeMac, MAX.nativeMac);
  }

  function isBoundedStringList(value, maximumEntries, maximumLength) {
    return Array.isArray(value) && value.length <= maximumEntries && value.every((item) => isBoundedText(item, maximumLength));
  }

  function isResult(value) {
    if (!isPlainRecord(value) || !isBoundedStringList(value.selectedLeafTagIDs, MAX.resultTags, MAX.tag) || !Array.isArray(value.decisions) || value.decisions.length > MAX.resultDecisions) return false;
    return value.decisions.every((decision) => {
      if (!isPlainRecord(decision) || !OWN.call(ACTION_ORDER, decision.action) || typeof decision.explanation !== "string" || decision.explanation.length > MAX.resultExplanation) return false;
      if (decision.policyID !== undefined && !isBoundedText(decision.policyID, MAX.policy)) return false;
      return decision.matchedTagIDs === undefined || isBoundedStringList(decision.matchedTagIDs, MAX.resultTags, MAX.tag);
    });
  }

  function parseYouTubeURL(value, base) {
    const input = cleanText(value, 2048);
    if (!input) return null;
    if (typeof global.URL === "function") {
      try {
        const url = new global.URL(input, base || "https://www.youtube.com/");
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        return { hostname: url.hostname.replace(/\.$/, "").toLowerCase(), pathname: url.pathname || "/", query: url.search || "" };
      } catch (_) { return null; }
    }
    let absolute = input;
    if (!/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(absolute)) {
      const baseMatch = typeof base === "string" && base.match(/^(https?):\/\/([^/?#]+)(?:\/[^?#]*)?/i);
      if (!baseMatch || /[@]/.test(baseMatch[2])) return null;
      absolute = `https://${baseMatch[2]}${absolute.startsWith("/") ? absolute : `/${absolute}`}`;
    }
    const match = absolute.match(/^(https?):\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(?:#.*)?$/i);
    if (!match || /[@]/.test(match[2])) return null;
    const hostname = match[2].replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
    return { hostname, pathname: match[3] || "/", query: match[4] || "" };
  }

  function isTrustedYouTubeURL(value, base) {
    const parsed = parseYouTubeURL(value, base);
    return Boolean(parsed && (parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com")));
  }

  // Collection is restricted to the small public-content platform inventory
  // that the extension already has reviewed profiles for. Keep this host
  // check here, beside the evidence normalizer, rather than trusting a page
  // supplied platform string in the background worker.
  function isTrustedCollectionURL(platform, value, base) {
    const parsed = parseYouTubeURL(value, base);
    if (!parsed) return false;
    const host = parsed.hostname;
    switch (platform) {
      case "youtube": return host === "youtube.com" || host.endsWith(".youtube.com");
      case "tiktok": return host === "tiktok.com" || host.endsWith(".tiktok.com");
      case "facebook": return host === "facebook.com" || host.endsWith(".facebook.com");
      case "instagram": return host === "instagram.com" || host.endsWith(".instagram.com");
      case "twitch": return host === "twitch.tv" || host.endsWith(".twitch.tv") || host === "clips.twitch.tv";
      case "reddit": return host === "reddit.com" || host.endsWith(".reddit.com");
      case "twitter": return host === "twitter.com" || host.endsWith(".twitter.com") || host === "x.com" || host.endsWith(".x.com");
      case "bluesky": return host === "bsky.app" || host.endsWith(".bsky.app");
      case "threads": return host === "threads.com" || host.endsWith(".threads.com");
      case "substack": return host === "substack.com" || host.endsWith(".substack.com");
      case "bilibili": return host === "bilibili.com" || host.endsWith(".bilibili.com");
      case "rumble": return host === "rumble.com" || host.endsWith(".rumble.com");
      case "pinterest": return host === "pinterest.com" || host.endsWith(".pinterest.com");
      case "tumblr": return host === "tumblr.com" || host.endsWith(".tumblr.com");
      case "peertube": return host === "peertube.tv" || host.endsWith(".peertube.tv");
      case "pixelfed": return host === "pixelfed.social" || host.endsWith(".pixelfed.social");
      default: return false;
    }
  }

  function youtubeVideoIDFromURL(value, base) {
    const parsed = parseYouTubeURL(value, base);
    if (!parsed || !(parsed.hostname === "youtube.com" || parsed.hostname.endsWith(".youtube.com"))) return null;
    let candidate = null;
    if (parsed.pathname === "/watch") {
      const query = parsed.query.slice(1);
      const match = query.match(/(?:^|&)v=([^&]*)/);
      candidate = match && match[1];
    } else {
      const match = parsed.pathname.match(/^\/(?:shorts|live)\/([A-Za-z0-9_-]{11})\/?$/);
      candidate = match && match[1];
    }
    return typeof candidate === "string" && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  function entryFingerprint(entry) {
    if (!isPlainRecord(entry) || !isPlainRecord(entry.evidence)) return null;
    const evidence = entry.evidence;
    const add = (parts, value) => {
      const text = typeof value === "string" ? value : value == null ? "" : String(value);
      parts.push(`${text.length}:${text}`);
    };
    const parts = [];
    add(parts, entry.platform);
    add(parts, entry.surface);
    add(parts, entry.entryID);
    add(parts, entry.sourceID);
    add(parts, evidence.title);
    add(parts, evidence.text);
    add(parts, evidence.summary);
    for (const tag of Array.isArray(evidence.suppliedTags) ? evidence.suppliedTags : []) add(parts, tag);
    const metadata = isPlainRecord(evidence.metadata) ? evidence.metadata : {};
    for (const key of Object.keys(metadata).sort()) {
      add(parts, key);
      add(parts, metadata[key]);
    }
    for (const policyID of Array.isArray(entry.policyIDs) ? entry.policyIDs : []) add(parts, policyID);
    let hash = 0x811c9dc5;
    const material = parts.join("\u001f");
    for (let index = 0; index < material.length; index++) {
      hash ^= material.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `vc1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function strongestAction(result) {
    const decisions = result && Array.isArray(result.decisions) ? result.decisions : [];
    return decisions.reduce((best, decision) => {
      const action = decision && typeof decision.action === "string" ? decision.action : "allow";
      return OWN.call(ACTION_ORDER, action) && ACTION_ORDER[action] > ACTION_ORDER[best] ? action : best;
    }, "allow");
  }

  function explanation(result) {
    const first = result && Array.isArray(result.decisions) ? result.decisions[0] : null;
    if (first && typeof first.explanation === "string" && first.explanation.length <= 512) return first.explanation;
    const tags = result && Array.isArray(result.selectedLeafTagIDs) ? result.selectedLeafTagIDs.slice(0, 3) : [];
    return tags.length ? `Matched local tags: ${tags.join(", ")}.` : "No local policy matched.";
  }

  global.VaultClassifierExtensionContract = Object.freeze({
    protocolVersion: 1,
    maximumNativeBodyBytes: MAX.nativeBodyBytes,
    normalizeEvidence,
    fitEntryForNativeTransport,
    nativeBodyByteLength,
    isNativeEnvelope,
    isTrustedYouTubeURL,
    isTrustedCollectionURL,
    youtubeVideoIDFromURL,
    entryFingerprint,
    strongestAction,
    explanation,
    isResult,
    randomID
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
