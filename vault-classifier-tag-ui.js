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
  const hostState = new WeakMap();
  let reattachObserver = null;

  // The host page (YouTube) re-templates and recycles rows as it lazily renders,
  // detaching our injected pill. Rather than wait for the next scan, watch for
  // our own host being removed and re-mount it immediately from the cached tags,
  // so the pill never visibly disappears.
  function startReattachObserver() {
    if (reattachObserver || typeof global.MutationObserver !== "function") return;
    const target = global.document && global.document.documentElement;
    if (!target) return;
    reattachObserver = new global.MutationObserver((records) => {
      for (const record of records) {
        const removed = record.removedNodes;
        if (!removed || !removed.length) continue;
        for (const node of removed) {
          const state = hostState.get(node);
          if (!state
            || state.host !== node
            || !state.root || state.root.isConnected === false
            || state.epoch !== (platformEpochs.get(state.platform) || 0)) {
            continue;
          }
          const cached = sourceCache.get(state.key);
          if (!cached || !Array.isArray(cached.tags) || cached.tags.length === 0) continue;
          state.host = null;
          state.rail = null;
          render(state, cached.tags);
        }
      }
    });
    reattachObserver.observe(target, { childList: true, subtree: true });
  }

  function boundedIdentity(platform, sourceID) {
    return typeof platform === "string"
      && /^[a-z0-9-]{1,64}$/.test(platform)
      && typeof sourceID === "string"
      && sourceID.length > platform.length + 1
      && sourceID.length <= 256
      && sourceID.startsWith(`${platform}:`)
      ? `${platform}${sourceID}`
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

  function request(platform, sourceID, creatorNames = null) {
    const key = boundedIdentity(platform, sourceID);
    if (!key || !C?.normalizeSourceTagsResponse || !global.chrome?.runtime?.sendMessage) {
      return Promise.resolve(null);
    }
    prune();
    const cached = sourceCache.get(key);
    if (cached?.pending) return cached.pending;
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.tags);

    const message = { type: "vault-classifier-source-tags", platform, sourceID };
    // Collaboration cards expose no creator link; forward the byline names so the
    // native side can match them to an approved classification by name.
    if (Array.isArray(creatorNames) && creatorNames.length) message.creatorNames = creatorNames;
    const pending = new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
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
      ".chip{box-sizing:border-box;display:inline-flex;align-items:center;max-width:220px;min-height:18px;padding:1px 7px;border:0;border-radius:999px;background:var(--vault-tag-color-light);color:#000;font:600 11px/16px -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 2px rgba(0,0,0,.18)}",
      "@media (prefers-color-scheme:dark){.chip{background:var(--vault-tag-color-dark);color:#fff}}"
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
      // A freshly mounted host has an empty rail. Clear the cached signature so
      // the chips are (re)populated below; otherwise, when the host is remounted
      // after the page detached it, the unchanged signature would skip the fill
      // and leave an empty host.
      state.signature = "";
      hostState.set(state.host, state);
      mountedStates.add(state);
    }
    const signature = tags.map((tag) => (
      `${tag.id}${tag.name}${tag.lightColorHex}${tag.darkColorHex}`
    )).join("");
    if (state.signature === signature) return;
    state.signature = signature;
    state.rail.replaceChildren?.();
    const document = state.root.ownerDocument || global.document;
    for (const tag of tags) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.dir = "auto";
      chip.textContent = tag.name;
      chip.style.setProperty("--vault-tag-color-light", tag.lightColorHex);
      chip.style.setProperty("--vault-tag-color-dark", tag.darkColorHex);
      state.rail.appendChild(chip);
    }
  }

  function observe({ platform, sourceID, root, anchor = null, creatorNames = null } = {}) {
    const key = boundedIdentity(platform, sourceID);
    if (!key || !root || root.isConnected === false) return;
    startReattachObserver();
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
    request(platform, sourceID, creatorNames).then((tags) => render(state, tags));
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
    const prefix = `${platform}`;
    for (const key of sourceCache.keys()) {
      if (key.startsWith(prefix)) sourceCache.delete(key);
    }
  }

  global.VaultClassifierTagUI = Object.freeze({ observe, clearPlatform });
})(typeof globalThis !== "undefined" ? globalThis : this);
