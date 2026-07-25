// Display-only creator/source tags projected by the local Vault Classifier.
// Tag values are rendered inside closed shadow roots so the host page cannot
// scrape the user's private taxonomy from ordinary DOM attributes or text.
(function (global) {
  "use strict";
  if (global.VaultClassifierTagUI) return;

  const C = global.VaultClassifierExtensionContract;
  const CACHE_TTL_MS = 15_000;
  const MAX_SOURCES = 128;
  const sourceCache = new Map();
  const stateByRoot = new WeakMap();
  const mountedStates = new Set();
  const platformEpochs = new Map();

  function boundedIdentity(platform, sourceID) {
    return typeof platform === "string"
      && /^[a-z0-9-]{1,64}$/.test(platform)
      && typeof sourceID === "string"
      && sourceID.length > platform.length + 1
      && sourceID.length <= 256
      && sourceID.startsWith(`${platform}:`)
      ? `${platform}\u001f${sourceID}`
      : null;
  }

  function removeState(state) {
    if (!state) return;
    try { state.host?.remove?.(); } catch (_) {}
    mountedStates.delete(state);
  }

  function prune() {
    for (const state of [...mountedStates]) {
      if (!state.root?.isConnected) removeState(state);
    }
    const now = Date.now();
    for (const [key, cached] of sourceCache) {
      if (!cached.pending && cached.expiresAt <= now) sourceCache.delete(key);
    }
    while (sourceCache.size > MAX_SOURCES) {
      sourceCache.delete(sourceCache.keys().next().value);
    }
  }

  function request(platform, sourceID) {
    const key = boundedIdentity(platform, sourceID);
    if (!key || !C?.normalizeSourceTagsResponse || !global.chrome?.runtime?.sendMessage) {
      return Promise.resolve(null);
    }
    prune();
    const cached = sourceCache.get(key);
    if (cached?.pending) return cached.pending;
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.tags);

    const pending = new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({
          type: "vault-classifier-source-tags",
          platform,
          sourceID
        }, (response) => {
          if (chrome.runtime.lastError || response?.ok !== true) return resolve(null);
          const normalized = C.normalizeSourceTagsResponse(response, platform, sourceID);
          resolve(normalized?.tags || null);
        });
      } catch (_) {
        resolve(null);
      }
    }).then((tags) => {
      sourceCache.set(key, {
        tags: Array.isArray(tags) ? tags : [],
        expiresAt: Date.now() + CACHE_TTL_MS,
        pending: null
      });
      prune();
      return tags;
    });
    sourceCache.set(key, { tags: cached?.tags || [], expiresAt: 0, pending });
    return pending;
  }

  function makeHost(root, anchor) {
    const document = root?.ownerDocument || global.document;
    if (!document?.createElement) return null;
    const host = document.createElement("span");
    host.style.cssText = "all:initial;display:inline-block;vertical-align:middle;margin-inline-start:6px;max-width:100%;";
    const shadow = host.attachShadow?.({ mode: "closed" });
    if (!shadow) return null;

    const style = document.createElement("style");
    style.textContent = [
      ":host{all:initial;display:inline-block;max-width:100%;color-scheme:light dark;contain:content}",
      ".rail{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px;max-width:100%;vertical-align:middle}",
      ".chip{box-sizing:border-box;display:inline-flex;align-items:center;max-width:220px;min-height:18px;padding:1px 7px;border:1px solid rgba(125,92,255,.42);border-radius:999px;background:rgba(78,49,176,.90);color:#fff;font:600 11px/16px -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 2px rgba(0,0,0,.18)}"
    ].join("");
    const rail = document.createElement("span");
    rail.className = "rail";
    shadow.append(style, rail);

    try {
      if (anchor?.parentNode && root.contains?.(anchor) && typeof anchor.insertAdjacentElement === "function") {
        anchor.insertAdjacentElement("afterend", host);
      } else {
        root.appendChild?.(host);
      }
    } catch (_) {
      return null;
    }
    return { host, rail };
  }

  function render(state, tags) {
    if (!state
      || stateByRoot.get(state.root) !== state
      || state.epoch !== (platformEpochs.get(state.platform) || 0)) {
      return;
    }
    if (!Array.isArray(tags) || tags.length === 0) {
      removeState(state);
      state.host = null;
      state.rail = null;
      return;
    }
    if (!state.host?.isConnected) {
      const mount = makeHost(state.root, state.anchor);
      if (!mount) return;
      state.host = mount.host;
      state.rail = mount.rail;
      mountedStates.add(state);
    }
    const signature = tags.map((tag) => `${tag.id}\u001f${tag.name}`).join("\u001e");
    if (state.signature === signature) return;
    state.signature = signature;
    state.rail.replaceChildren?.();
    const document = state.root.ownerDocument || global.document;
    for (const tag of tags) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.dir = "auto";
      chip.textContent = tag.name;
      state.rail.appendChild(chip);
    }
  }

  function observe({ platform, sourceID, root, anchor = null } = {}) {
    const key = boundedIdentity(platform, sourceID);
    if (!key || !root || root.isConnected === false) return;
    let state = stateByRoot.get(root);
    if (!state || state.key !== key) {
      removeState(state);
      state = {
        key,
        platform,
        sourceID,
        root,
        anchor,
        epoch: platformEpochs.get(platform) || 0,
        host: null,
        rail: null,
        signature: ""
      };
      stateByRoot.set(root, state);
    } else if (anchor) {
      state.anchor = anchor;
    }
    state.epoch = platformEpochs.get(platform) || 0;
    request(platform, sourceID).then((tags) => render(state, tags));
  }

  function clearPlatform(platform) {
    platformEpochs.set(platform, (platformEpochs.get(platform) || 0) + 1);
    for (const state of [...mountedStates]) {
      if (state.platform === platform) {
        removeState(state);
        state.host = null;
        state.rail = null;
      }
    }
    const prefix = `${platform}\u001f`;
    for (const key of sourceCache.keys()) {
      if (key.startsWith(prefix)) sourceCache.delete(key);
    }
  }

  global.VaultClassifierTagUI = Object.freeze({ observe, clearPlatform });
})(typeof globalThis !== "undefined" ? globalThis : this);
