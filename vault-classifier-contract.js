// Vault Classifier extension contract — browser-safe, dependency-free helpers.
//
// This is deliberately separate from the legacy creator-tag path. It accepts
// only bounded DOM evidence and turns a missing/invalid/native-host failure
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
    policy: 128
  });

  const ACTION_ORDER = Object.freeze({ allow: 0, dim: 1, block: 2 });

  function cleanText(value, maximum) {
    if (typeof value !== "string") return null;
    const compact = value.replace(/\s+/g, " ").trim();
    return compact && compact.length <= maximum ? compact : null;
  }

  function cleanOptional(value, maximum) {
    if (value == null || value === "") return null;
    return cleanText(String(value), maximum);
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
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
    const result = {};
    for (const key of Object.keys(metadata).slice(0, 64)) {
      const cleanKey = cleanText(key, 64);
      const value = metadata[key];
      if (!cleanKey) continue;
      if (typeof value === "string") {
        const cleanValue = cleanText(value, 512);
        if (cleanValue) result[cleanKey] = cleanValue;
      } else if (typeof value === "number" && Number.isFinite(value)) {
        result[cleanKey] = value;
      } else if (typeof value === "boolean") {
        result[cleanKey] = value;
      }
    }
    return result;
  }

  function strongestAction(result) {
    const decisions = result && Array.isArray(result.decisions) ? result.decisions : [];
    return decisions.reduce((best, decision) => {
      const action = decision && typeof decision.action === "string" ? decision.action : "allow";
      return (ACTION_ORDER[action] || 0) > (ACTION_ORDER[best] || 0) ? action : best;
    }, "allow");
  }

  function explanation(result) {
    const first = result && Array.isArray(result.decisions) ? result.decisions[0] : null;
    if (first && typeof first.explanation === "string" && first.explanation.length <= 512) return first.explanation;
    const tags = result && Array.isArray(result.selectedLeafTagIDs) ? result.selectedLeafTagIDs.slice(0, 3) : [];
    return tags.length ? `Matched local tags: ${tags.join(", ")}.` : "No local policy matched.";
  }

  function isResult(value) {
    return Boolean(value && typeof value === "object" && Array.isArray(value.selectedLeafTagIDs) && Array.isArray(value.decisions));
  }

  global.VaultClassifierExtensionContract = Object.freeze({
    protocolVersion: 1,
    normalizeEvidence,
    strongestAction,
    explanation,
    isResult,
    randomID
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
