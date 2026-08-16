// Display-only per-video tags projected by the local Vault Classifier. Tag values
// render inside closed shadow roots so the host page cannot scrape the user's
// private taxonomy from ordinary DOM attributes or text.
//
// Local-LLM rework: the pill is now PER-VIDEO. Identity is the video's `entryID`
// (not the creator); each card requests its own tags with its title as evidence.
// While the app is still classifying a video it replies `pending`, and we show a
// temporary "Tagging" placeholder pill that is replaced when the tags arrive.
(function (global) {
  "use strict";
  if (global.VaultClassifierTagUI) return;

  const C = global.VaultClassifierExtensionContract;
  const CACHE_TTL_MS = 15_000;
  // Provisional ("Tagging") results re-check soon so the pill upgrades quickly
  // once background classification finishes, rather than waiting a full TTL.
  const PENDING_TTL_MS = 2_500;
  // A quiet page produces no mutations to re-trigger observe, so provisional
  // pills re-check on their own timer — bounded, then mutation-driven again.
  const MAX_PENDING_RECHECKS = 20;
  const MAX_SOURCES = 512;
  // A single flush of the feed is answered in one hub round-trip. Chunk larger
  // flushes so each request stays comfortably inside the shared bridge frame.
  const MAX_BATCH_ITEMS = 32;
  const pendingBatch = [];
  let drainScheduled = false;
  const sourceCache = new Map();
  // Shown when a video resolves but carries no tags, so it reads as "seen,
  // nothing applies" rather than looking like the extension simply failed.
  const NONE_TAGS = Object.freeze([Object.freeze({
    id: "vault:none",
    name: "None",
    lightColorHex: "#E5E7EB",
    darkColorHex: "#3F3F46"
  })]);
  // The temporary placeholder shown while the app classifies this video.
  const TAGGING_TAGS = Object.freeze([Object.freeze({
    id: "vault:tagging",
    name: "Tagging",
    lightColorHex: "#E5E7EB",
    darkColorHex: "#3F3F46"
  })]);

  // Maps a resolved lookup to what should render. A definitive answer with no
  // tags becomes the "None" pill; a failed/unresolved lookup (null) renders
  // nothing and is retried once the cache entry expires.
  function displayTags(tags) {
    if (!Array.isArray(tags)) return null;
    return tags.length ? tags : NONE_TAGS;
  }
  const stateByRoot = new WeakMap();
  const mountedStates = new Set();
  const platformEpochs = new Map();
  const hostState = new WeakMap();
  let reattachObserver = null;

  // Dev-only unified logging: forward pill-pipeline events to the native log.
  // Auto-on when the connected app is in its development env (`vaultDevMode`,
  // mirrored by the bridge), or when the user explicitly enables debug mode.
  // Cached so it is a cheap no-op otherwise.
  let devDebugMode = false;
  let devEnvMode = false;
  try {
    global.chrome?.storage?.local?.get?.(["globalSettings", "vaultDevMode"], (stored) => {
      devDebugMode = stored?.globalSettings?.debugMode === true;
      devEnvMode = stored?.vaultDevMode === true;
    });
    global.chrome?.storage?.onChanged?.addListener?.((changes, area) => {
      if (area !== "local") return;
      if (changes.globalSettings) devDebugMode = changes.globalSettings.newValue?.debugMode === true;
      if (changes.vaultDevMode) devEnvMode = changes.vaultDevMode.newValue === true;
    });
  } catch (_) {}
  function devLog(event, fields) {
    if (!(devDebugMode || devEnvMode) || !global.chrome?.runtime?.sendMessage) return;
    // Callback form (+ consume lastError) so a send to an asleep/unreachable
    // service worker never surfaces as an uncaught "No SW" promise rejection.
    try {
      global.chrome.runtime.sendMessage(
        { type: "vault-classifier-dev-log", layer: "tag-ui", event, fields: fields || {} },
        () => { void global.chrome.runtime.lastError; }
      );
    } catch (_) {}
  }

  // The host page re-templates and recycles rows as it lazily renders, detaching
  // our injected pill. Rather than wait for the next scan, watch for our own host
  // being removed and re-mount it immediately from the cached tags.
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
          render(state, cached.tags, cached.predicted === true);
        }
      }
    });
    reattachObserver.observe(target, { childList: true, subtree: true });
  }

  // Both entryIDs and creatorIDs are platform-prefixed; this validates either.
  function boundedIdentity(platform, id) {
    return typeof platform === "string"
      && /^[a-z0-9-]{1,64}$/.test(platform)
      && typeof id === "string"
      && id.length > platform.length + 1
      && id.length <= 256
      && id.startsWith(`${platform}:`)
      ? `${platform}${id}`
      : null;
  }

  function removeState(state) {
    if (!state) return;
    if (state.recheckTimer) {
      clearTimeout(state.recheckTimer);
      state.recheckTimer = null;
    }
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

  // Resolves one video's tags by entryID, carrying its title as evidence.
  function request(platform, entryID, creatorID, title) {
    const key = boundedIdentity(platform, entryID);
    if (!key || !C?.normalizeVideoTagsResponse || !global.chrome?.runtime?.sendMessage) {
      return Promise.resolve(null);
    }
    prune();
    const cached = sourceCache.get(key);
    if (cached?.pending) return cached.pending;
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve({ tags: cached.tags, predicted: cached.predicted === true, provisional: cached.provisional === true });
    }

    const pending = new Promise((resolve) => {
      pendingBatch.push({ platform, entryID, creatorID, title, key, resolve });
      scheduleDrain();
    }).then((result) => {
      // The app is still classifying this video: show the "Tagging" placeholder
      // and re-check soon so the real tags replace it quickly.
      if (result && result.pending) {
        sourceCache.set(key, { tags: TAGGING_TAGS, predicted: false, provisional: true, expiresAt: Date.now() + PENDING_TTL_MS, pending: null });
        prune();
        return { tags: TAGGING_TAGS, predicted: false, provisional: true };
      }
      const display = displayTags(result && result.tags);
      const predicted = Boolean(result && result.predicted);
      sourceCache.set(key, { tags: display, predicted, provisional: false, expiresAt: Date.now() + CACHE_TTL_MS, pending: null });
      prune();
      return { tags: display, predicted, provisional: false };
    });
    sourceCache.set(key, { tags: cached?.tags || [], predicted: cached?.predicted === true, provisional: cached?.provisional === true, expiresAt: 0, pending });
    return pending;
  }

  function scheduleDrain() {
    if (drainScheduled) return;
    drainScheduled = true;
    // A microtask fires right after the collector's synchronous top-to-bottom
    // card loop has enqueued everything in view, so one scroll = one batch.
    Promise.resolve().then(drainBatch);
  }

  function drainBatch() {
    drainScheduled = false;
    const queued = pendingBatch.splice(0);
    if (!queued.length) return;
    const byPlatform = new Map();
    for (const job of queued) {
      const jobs = byPlatform.get(job.platform);
      if (jobs) jobs.push(job);
      else byPlatform.set(job.platform, [job]);
    }
    for (const [platform, jobs] of byPlatform) {
      for (let index = 0; index < jobs.length; index += MAX_BATCH_ITEMS) {
        dispatchBatch(platform, jobs.slice(index, index + MAX_BATCH_ITEMS));
      }
    }
  }

  function dispatchBatch(platform, jobs) {
    const items = jobs.map((job) => ({ entryID: job.entryID, creatorID: job.creatorID, title: job.title }));
    sendBatch(platform, items).then((resultMap) => {
      for (const job of jobs) {
        if (resultMap) {
          job.resolve(resultMap.has(job.entryID) ? resultMap.get(job.entryID) : null);
        } else {
          // The batch route is unavailable (e.g. a worker still on the old build).
          // Fall back to a single request so a rollout skew never blanks the feed.
          sendSingle(job.platform, job.entryID, job.creatorID, job.title).then(job.resolve);
        }
      }
    });
  }

  function sendBatch(platform, items) {
    if (!C?.normalizeVideoTagsBatchResponse) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "vault-classifier-video-tags-batch", platform, items },
          (response) => {
            if (chrome.runtime.lastError || response?.ok !== true) return resolve(null);
            const expected = new Set(items.map((item) => item.entryID));
            resolve(C.normalizeVideoTagsBatchResponse(response, platform, expected) || null);
          }
        );
      } catch (_) {
        resolve(null);
      }
    });
  }

  function sendSingle(platform, entryID, creatorID, title) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "vault-classifier-video-tags", platform, entryID, creatorID, title },
          (response) => {
            if (chrome.runtime.lastError || response?.ok !== true) return resolve(null);
            const normalized = C.normalizeVideoTagsResponse(response, platform, entryID);
            resolve(normalized ? { tags: normalized.tags, predicted: normalized.predicted === true, pending: normalized.pending === true } : null);
          }
        );
      } catch (_) {
        resolve(null);
      }
    });
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
      // A local-model prediction (no confirmed decision) reads as a hollow, dashed
      // chip in the tag's own color so it is visibly a guess.
      ".chip.predicted{background:transparent;color:var(--vault-tag-color-dark);border:1px dashed var(--vault-tag-color-dark);box-shadow:none}",
      // The temporary "Tagging" placeholder: muted, dashed, gently pulsing.
      ".chip.tagging{background:transparent;color:var(--vault-tag-color-dark);border:1px dashed var(--vault-tag-color-dark);box-shadow:none;animation:vault-tagging 1.2s ease-in-out infinite}",
      "@keyframes vault-tagging{0%,100%{opacity:.45}50%{opacity:.9}}",
      "@media (prefers-color-scheme:dark){.chip{background:var(--vault-tag-color-dark);color:#fff}}",
      "@media (prefers-color-scheme:dark){.chip.predicted{background:transparent;color:var(--vault-tag-color-light);border-color:var(--vault-tag-color-light)}}",
      "@media (prefers-color-scheme:dark){.chip.tagging{color:var(--vault-tag-color-light);border-color:var(--vault-tag-color-light)}}"
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

  function render(state, tags, predicted = false) {
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
    const signature = (predicted ? "P" : "C") + tags.map((tag) => (
      `${tag.id}${tag.name}${tag.lightColorHex}${tag.darkColorHex}`
    )).join("");
    if (state.signature === signature) return;
    state.signature = signature;
    state.rail.replaceChildren?.();
    const document = state.root.ownerDocument || global.document;
    for (const tag of tags) {
      const chip = document.createElement("span");
      chip.className = tag.id === "vault:tagging" ? "chip tagging" : (predicted ? "chip predicted" : "chip");
      chip.dir = "auto";
      chip.textContent = tag.name;
      chip.style.setProperty("--vault-tag-color-light", tag.lightColorHex);
      chip.style.setProperty("--vault-tag-color-dark", tag.darkColorHex);
      state.rail.appendChild(chip);
    }
  }

  // A provisional ("Tagging") pill upgrades by re-requesting once its short
  // cache entry expires. Mutations normally re-trigger observe, but a quiet
  // page never mutates — so drive a bounded re-check from a timer instead.
  function scheduleProvisionalRecheck(state) {
    if (state.recheckTimer || state.recheckAttempts >= MAX_PENDING_RECHECKS) return;
    state.recheckAttempts += 1;
    state.recheckTimer = setTimeout(() => {
      state.recheckTimer = null;
      if (stateByRoot.get(state.root) !== state
        || state.epoch !== (platformEpochs.get(state.platform) || 0)
        || state.root.isConnected === false) {
        return;
      }
      request(state.platform, state.entryID, state.creatorID, state.title).then((result) => {
        render(state, result && result.tags, Boolean(result && result.predicted));
        if (result && result.provisional) scheduleProvisionalRecheck(state);
      });
    }, PENDING_TTL_MS + 200);
  }

  function observe({ platform, entryID, creatorID, title, root, anchor = null } = {}) {
    const key = boundedIdentity(platform, entryID);
    if (!key || !boundedIdentity(platform, creatorID) || typeof title !== "string" || !title
      || !root || root.isConnected === false) return;
    startReattachObserver();
    let state = stateByRoot.get(root);
    if (!state || state.key !== key) {
      removeState(state);
      state = {
        key,
        platform,
        entryID,
        creatorID,
        title,
        root,
        anchor,
        epoch: platformEpochs.get(platform) || 0,
        host: null,
        rail: null,
        signature: "",
        recheckTimer: null,
        recheckAttempts: 0
      };
      stateByRoot.set(root, state);
    } else {
      if (anchor) state.anchor = anchor;
      // A card may hydrate its title/creator after first paint.
      if (title) state.title = title;
      if (creatorID) state.creatorID = creatorID;
    }
    state.epoch = platformEpochs.get(platform) || 0;
    devLog("observe", { platform, entry: entryID, creator: creatorID });
    request(platform, entryID, state.creatorID, state.title).then((result) => {
      devLog("result", {
        entry: entryID,
        state: result ? (result.provisional ? "tagging" : ((result.tags && result.tags.length) ? "tags" : "none")) : "null"
      });
      render(state, result && result.tags, Boolean(result && result.predicted));
      if (result && result.provisional) scheduleProvisionalRecheck(state);
    });
  }

  // Push path: the app broadcasts each resolved classification through the hub,
  // so a provisional pill swaps to real tags the moment the result exists. The
  // timer re-check above remains as the fallback for a missed push. Items were
  // already contract-validated by the bridge before fan-out.
  function applyPushedTags(platform, items) {
    for (const item of items) {
      if (!item || typeof item.entryID !== "string") continue;
      const key = boundedIdentity(platform, item.entryID);
      const display = displayTags(item && item.tags);
      if (!key || !display) continue;
      const predicted = item.predicted === true;
      sourceCache.set(key, { tags: display, predicted, provisional: false, expiresAt: Date.now() + CACHE_TTL_MS, pending: null });
      for (const state of [...mountedStates]) {
        if (state.key === key) render(state, display, predicted);
      }
    }
    prune();
  }

  try {
    global.chrome?.runtime?.onMessage?.addListener?.((message, sender) => {
      if (!message
        || message.type !== "vault-classifier-video-tags-updated"
        || (sender && sender.id && sender.id !== global.chrome.runtime.id)
        || typeof message.platform !== "string"
        || !Array.isArray(message.items)) {
        return false;
      }
      applyPushedTags(message.platform, message.items);
      return false;
    });
  } catch (_) {}

  function clearPlatform(platform) {
    platformEpochs.set(platform, (platformEpochs.get(platform) || 0) + 1);
    for (const state of [...mountedStates]) {
      if (state.platform === platform) {
        removeState(state);
        state.host = null;
        state.rail = null;
      }
    }
    const prefix = `${platform}`;
    for (const key of sourceCache.keys()) {
      if (key.startsWith(prefix)) sourceCache.delete(key);
    }
  }

  global.VaultClassifierTagUI = Object.freeze({ observe, clearPlatform });
})(typeof globalThis !== "undefined" ? globalThis : this);
