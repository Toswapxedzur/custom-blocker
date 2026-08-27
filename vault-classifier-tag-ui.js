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
    clearContentBlock(state.root);
    try { state.host?.remove?.(); } catch (_) {}
    mountedStates.delete(state);
  }

  // Content-tag block enforcement: hand the card + its resolved feedAction to
  // content.js's verdict ledger (a global). DIM keeps the card visible and
  // correctable — the Vault pill stays clickable, so one correction re-classifies
  // and lifts the verdict. A provisional/"allow"/absent result clears any prior
  // verdict (un-dim). Safe no-op if content.js isn't present in this world.
  function applyContentBlock(state, result) {
    if (!state || !state.root) return;
    const apply = global.cbApplyTagPolicy;
    if (typeof apply !== "function") return;
    const action = (result && !result.provisional) ? (result.feedAction || "allow") : "allow";
    try { apply(state.root, action); } catch (_) {}
  }

  function clearContentBlock(root) {
    if (!root) return;
    const apply = global.cbApplyTagPolicy;
    if (typeof apply === "function") { try { apply(root, "allow"); } catch (_) {} }
  }

  // Expose a card's resolved tags (with confidence) to custom content-block
  // rules, which run in content.js and only hold the card element. Returns the
  // display tag list for the card's current entryID, or [] if unknown.
  function tagsForCard(root) {
    const state = root && stateByRoot.get(root);
    if (!state) return [];
    const cached = sourceCache.get(state.key);
    if (!cached || cached.provisional || !Array.isArray(cached.tags)) return [];
    // Drop the "None"/"Tagging" placeholder pills — custom rules only see real tags.
    return cached.tags.filter((t) => t && t.id !== "vault:none" && t.id !== "vault:tagging");
  }
  if (global) global.vaultTagsForCard = tagsForCard;

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
      return Promise.resolve({ tags: cached.tags, predicted: cached.predicted === true, provisional: cached.provisional === true, feedAction: cached.feedAction || "allow", pageAction: cached.pageAction || "allow" });
    }

    const pending = new Promise((resolve) => {
      pendingBatch.push({ platform, entryID, creatorID, title, key, resolve });
      scheduleDrain();
    }).then((result) => {
      // The app is still classifying this video: show the "Tagging" placeholder
      // and re-check soon so the real tags replace it quickly. Never dim/hide
      // while provisional — a card is only ever acted on by a resolved verdict.
      if (result && result.pending) {
        sourceCache.set(key, { tags: TAGGING_TAGS, predicted: false, provisional: true, expiresAt: Date.now() + PENDING_TTL_MS, pending: null, feedAction: "allow", pageAction: "allow" });
        prune();
        return { tags: TAGGING_TAGS, predicted: false, provisional: true, feedAction: "allow", pageAction: "allow" };
      }
      const display = displayTags(result && result.tags);
      const predicted = Boolean(result && result.predicted);
      const feedAction = (result && result.feedAction) || "allow";
      const pageAction = (result && result.pageAction) || "allow";
      sourceCache.set(key, { tags: display, predicted, provisional: false, expiresAt: Date.now() + CACHE_TTL_MS, pending: null, feedAction, pageAction });
      prune();
      return { tags: display, predicted, provisional: false, feedAction, pageAction };
    });
    sourceCache.set(key, { tags: cached?.tags || [], predicted: cached?.predicted === true, provisional: cached?.provisional === true, expiresAt: 0, pending, feedAction: cached?.feedAction || "allow", pageAction: cached?.pageAction || "allow" });
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
            resolve(normalized ? { tags: normalized.tags, predicted: normalized.predicted === true, pending: normalized.pending === true, feedAction: normalized.feedAction, pageAction: normalized.pageAction } : null);
          }
        );
      } catch (_) {
        resolve(null);
      }
    });
  }

  // --- Live correction: taxonomy (add choices) + submit-correction ----------
  const SYNTHETIC_IDS = new Set(["vault:none", "vault:tagging"]);
  const taxonomyCache = new Map(); // platform -> { value, expiresAt, pending }

  // The predictable tag choices per classifier type, cached briefly. `tagToType`
  // maps a tag id to its owning classifier type so a corrected chip can be
  // attributed to the right type.
  function fetchTaxonomy(platform) {
    if (!global.chrome?.runtime?.sendMessage) return Promise.resolve(null);
    const cached = taxonomyCache.get(platform);
    if (cached?.pending) return cached.pending;
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    const pending = new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "vault-classifier-classifier-taxonomy", platform }, (response) => {
          if (chrome.runtime.lastError || !response || response.ok !== true || !Array.isArray(response.types)) return resolve(null);
          const tagToType = new Map();
          const tagByID = new Map();
          for (const type of response.types) {
            for (const tag of type.tags) {
              tagToType.set(tag.id, type.typeID);
              tagByID.set(tag.id, tag);
            }
          }
          resolve({ types: response.types, tagToType, tagByID });
        });
      } catch (_) { resolve(null); }
    }).then((value) => {
      taxonomyCache.set(platform, { value, expiresAt: Date.now() + 60_000, pending: null });
      return value;
    });
    taxonomyCache.set(platform, { value: cached?.value || null, expiresAt: 0, pending });
    return pending;
  }

  function sendCorrection(platform, entryID, creatorID, typeID, correctTagIDs) {
    if (!global.chrome?.runtime?.sendMessage) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "vault-classifier-submit-correction", platform, entryID, creatorID, typeID, correctTagIDs },
          (response) => resolve(chrome.runtime.lastError || response?.ok !== true ? null : response)
        );
      } catch (_) { resolve(null); }
    });
  }

  // Real (correctable) tag ids currently on this video, i.e. excluding the
  // synthetic None/Tagging placeholders.
  function realTagIDs(state) {
    return (state.currentTags || []).filter((tag) => !SYNTHETIC_IDS.has(tag.id)).map((tag) => tag.id);
  }

  // The corrected set for one type after adding/removing a tag id. When the
  // taxonomy can't attribute a tag to a type but there is exactly one type, that
  // single type owns everything.
  function typeForTag(taxonomy, tagID) {
    if (!taxonomy) return null;
    return taxonomy.tagToType.get(tagID)
      || (taxonomy.types.length === 1 ? taxonomy.types[0].typeID : null);
  }

  // Repaints this pill's chips immediately and pins the cache so a stray
  // re-request can't momentarily revert the optimistic view. The authoritative
  // broadcast lands right after with the same signature — no flicker.
  function applyLocalTags(state, realTags) {
    const display = realTags.length ? realTags : NONE_TAGS;
    state.signature = "";
    render(state, display, false);
    const key = boundedIdentity(state.platform, state.entryID);
    if (key) {
      sourceCache.set(key, { tags: display, predicted: false, provisional: false, expiresAt: Date.now() + CACHE_TTL_MS, pending: null });
    }
  }

  // Optimistic tag edit: update the pill NOW, then send the correction in the
  // background and revert only if it fails. `addTag` is a full display tag
  // {id,name,lightColorHex,darkColorHex}; `removeID` is a tag id.
  function editTags(state, { addTag, removeID }) {
    const before = (state.currentTags || []).filter((tag) => !SYNTHETIC_IDS.has(tag.id));
    let next;
    if (removeID) {
      next = before.filter((tag) => tag.id !== removeID);
    } else if (addTag) {
      if (before.some((tag) => tag.id === addTag.id)) return;
      next = [...before, addTag];
    } else {
      return;
    }
    const wasBlocked = !!(state.root && state.root.dataset && state.root.dataset.cbContentBlocked === "true");
    applyLocalTags(state, next);   // instant

    // Instant reactive block: correcting a tag away on a blocked card lifts the
    // blacked-out state NOW, without waiting for the re-classification round-trip.
    // The server confirms via the broadcast (or re-blocks if it still qualifies).
    if (removeID && wasBlocked) setContentBlock(state.root, "allow");

    (async () => {
      const taxonomy = await fetchTaxonomy(state.platform);
      const typeID = typeForTag(taxonomy, removeID || addTag.id);
      if (!typeID) { applyLocalTags(state, before); if (wasBlocked) setContentBlock(state.root, "dim"); return; }
      const correctTagIDs = next.filter((tag) => typeForTag(taxonomy, tag.id) === typeID).map((tag) => tag.id);
      const result = await sendCorrection(state.platform, state.entryID, state.creatorID, typeID, correctTagIDs);
      if (!result || result.ok !== true) {
        applyLocalTags(state, before);   // revert on failure
        if (wasBlocked) setContentBlock(state.root, "dim");   // re-block: the correction did not persist
      }
      // success → the video-tags-updated broadcast confirms (same signature).
    })();
  }

  // Apply a content-block verdict to a card via content.js's ledger (a global).
  function setContentBlock(root, action) {
    if (!root) return;
    const apply = global.cbApplyTagPolicy;
    if (typeof apply === "function") { try { apply(root, action); } catch (_) {} }
  }

  // Builds the small add-a-tag panel: a search box + the addable tags (all
  // predictable tags not already applied), each of which corrects on click.
  async function openAddPanel(state, panel) {
    const document = panel.ownerDocument || global.document;
    panel.classList.add("open");
    panel.replaceChildren();
    const head = document.createElement("div");
    head.className = "panel-head";
    const title = document.createElement("span");
    title.textContent = "Add tag";
    const close = document.createElement("button");
    close.className = "panel-close";
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");
    head.append(title, close);
    const search = document.createElement("input");
    search.className = "panel-search";
    search.type = "text";
    search.placeholder = "Search tags";
    const list = document.createElement("div");
    list.className = "panel-list";
    panel.append(head, search, list);

    const taxonomy = await fetchTaxonomy(state.platform);
    if (!panel.classList.contains("open")) return;
    const applied = new Set(realTagIDs(state));
    const items = taxonomy ? [...taxonomy.tagByID.values()].filter((tag) => !applied.has(tag.id)) : [];
    items.sort((a, b) => a.name.localeCompare(b.name));
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = taxonomy ? "No more tags" : "No tags available";
      list.append(empty);
    } else {
      for (const tag of items) {
        const item = document.createElement("button");
        item.className = "panel-item";
        item.type = "button";
        item.dataset.tagId = tag.id;
        item.dataset.name = tag.name.toLowerCase();
        // Full display data so an add can paint the chip instantly on click.
        item.dataset.label = tag.name;
        item.dataset.light = tag.lightColorHex;
        item.dataset.dark = tag.darkColorHex;
        const dot = document.createElement("span");
        dot.className = "panel-dot";
        dot.style.background = tag.lightColorHex;
        const label = document.createElement("span");
        label.textContent = tag.name;
        item.append(dot, label);
        list.append(item);
      }
    }
    try { search.focus(); } catch (_) {}
  }

  function makeHost(root, anchor) {
    const document = root?.ownerDocument || global.document;
    if (!document?.createElement) return null;
    const host = document.createElement("span");
    host.style.cssText = "all:initial;display:inline-block;vertical-align:middle;margin-inline-start:6px;max-width:100%;";
    // Register the host in the content-block interceptor's private WeakSet (not a
    // DOM class — the host must stay unfingerprintable) so a click retargeted to
    // it from the closed shadow is never treated as a blocked video click.
    try { global.cbRegisterPillHost?.(host); } catch (_) {}
    const shadow = host.attachShadow?.({ mode: "closed" });
    if (!shadow) return null;

    const style = document.createElement("style");
    style.textContent = [
      // layout+style containment (not paint) so the hover delete affordance and
      // the add panel can overflow the host without being clipped.
      ":host{all:initial;display:inline-block;max-width:100%;color-scheme:light dark;contain:layout style}",
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
      "@media (prefers-color-scheme:dark){.chip.tagging{color:var(--vault-tag-color-light);border-color:var(--vault-tag-color-light)}}",
      // Live correction: a delete affordance on hover, an add button, and a small panel.
      ".chip-wrap{position:relative;display:inline-flex;align-items:center}",
      ".chip-del{position:absolute;top:-6px;right:-6px;width:14px;height:14px;padding:0;display:none;align-items:center;justify-content:center;border:0;border-radius:999px;background:#111;color:#fff;font:700 10px/1 -apple-system,sans-serif;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.35)}",
      ".chip-wrap:hover .chip-del{display:inline-flex}",
      ".add-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:18px;padding:1px 8px;border:1px dashed rgba(120,120,120,.75);border-radius:999px;background:transparent;color:inherit;font:600 11px/16px -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;cursor:pointer;opacity:.7}",
      ".add-btn:hover{opacity:1}",
      ".panel{position:absolute;top:calc(100% + 4px);left:0;z-index:2147483647;width:190px;max-height:230px;display:none;flex-direction:column;background:#fff;color:#111;border:1px solid rgba(0,0,0,.15);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.22);overflow:hidden;font:500 12px/1.3 -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}",
      ".panel.open{display:flex}",
      ".panel-head{display:flex;align-items:center;justify-content:space-between;padding:7px 9px 4px;font-weight:700}",
      ".panel-close{border:0;background:transparent;cursor:pointer;font-size:14px;line-height:1;color:#666;padding:0 2px}",
      ".panel-search{margin:0 9px 6px;padding:5px 8px;border:1px solid rgba(0,0,0,.15);border-radius:7px;font:inherit;outline:none}",
      ".panel-list{overflow-y:auto;max-height:158px;padding:0 5px 6px}",
      ".panel-item{display:flex;align-items:center;gap:7px;width:100%;padding:5px 7px;border:0;border-radius:6px;background:transparent;cursor:pointer;font:inherit;text-align:left;color:#111}",
      ".panel-item:hover{background:rgba(0,0,0,.06)}",
      ".panel-dot{flex:0 0 auto;width:9px;height:9px;border-radius:999px}",
      ".panel-empty{padding:8px 10px;color:#888}",
      "@media (prefers-color-scheme:dark){.panel{background:#1c1c1e;color:#eee;border-color:rgba(255,255,255,.15)}.panel-item{color:#eee}.panel-item:hover{background:rgba(255,255,255,.08)}.panel-search{background:#2c2c2e;color:#eee;border-color:rgba(255,255,255,.15)}.panel-close{color:#aaa}}"
    ].join("");
    // The host anchors the absolutely-positioned panel.
    host.style.position = "relative";
    const rail = document.createElement("span");
    rail.className = "rail";
    const panel = document.createElement("div");
    panel.className = "panel";
    shadow.append(style, rail, panel);

    // One delegated listener drives every correction affordance; the rail is
    // re-populated on each render but the shadow root (and this listener) persist.
    if (typeof shadow.addEventListener === "function") {
    shadow.addEventListener("click", (event) => {
      const state = hostState.get(host);
      if (!state) return;
      const target = event.target;
      if (typeof target?.closest !== "function") return;
      const del = target.closest(".chip-del");
      if (del) { event.preventDefault(); event.stopPropagation(); editTags(state, { removeID: del.dataset.tagId }); return; }
      if (target.closest(".add-btn")) { event.preventDefault(); event.stopPropagation(); openAddPanel(state, panel); return; }
      // The pill host is injected inside the card's own link; any click within
      // the panel (search box, list, backdrop) must be swallowed so it never
      // navigates the underlying video. Focus/typing still work (they fire on
      // mousedown/keydown, which this does not touch).
      if (target.closest(".panel")) {
        event.preventDefault();
        event.stopPropagation();
        if (target.closest(".panel-close")) { panel.classList.remove("open"); return; }
        const item = target.closest(".panel-item");
        if (item) {
          item.remove();
          editTags(state, { addTag: {
            id: item.dataset.tagId,
            name: item.dataset.label,
            lightColorHex: item.dataset.light,
            darkColorHex: item.dataset.dark
          } });
        }
      }
    });
    shadow.addEventListener("input", (event) => {
      const search = event.target?.closest?.(".panel-search");
      if (!search) return;
      const query = search.value.trim().toLowerCase();
      panel.querySelectorAll(".panel-item").forEach((el) => {
        el.style.display = !query || (el.dataset.name || "").includes(query) ? "flex" : "none";
      });
    });
    }

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
    state.currentTags = tags;
    const document = state.root.ownerDocument || global.document;
    const isTagging = tags.length === 1 && tags[0].id === "vault:tagging";
    for (const tag of tags) {
      const wrap = document.createElement("span");
      wrap.className = "chip-wrap";
      const chip = document.createElement("span");
      chip.className = tag.id === "vault:tagging" ? "chip tagging" : (predicted ? "chip predicted" : "chip");
      chip.dir = "auto";
      chip.textContent = tag.name;
      chip.style.setProperty("--vault-tag-color-light", tag.lightColorHex);
      chip.style.setProperty("--vault-tag-color-dark", tag.darkColorHex);
      wrap.appendChild(chip);
      // Real tags carry a hover delete affordance; the None/Tagging placeholders do not.
      if (!SYNTHETIC_IDS.has(tag.id)) {
        const del = document.createElement("button");
        del.className = "chip-del";
        del.type = "button";
        del.textContent = "×";
        del.dataset.tagId = tag.id;
        del.setAttribute("aria-label", "Remove tag");
        wrap.appendChild(del);
      }
      state.rail.appendChild(wrap);
    }
    // An add-a-tag button always sits at the end of the queue (except while the
    // video is still being classified).
    if (!isTagging) {
      const add = document.createElement("button");
      add.className = "add-btn";
      add.type = "button";
      add.textContent = "+ tag";
      add.setAttribute("aria-label", "Add tag");
      state.rail.appendChild(add);
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
        applyContentBlock(state, result);
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
      applyContentBlock(state, result);
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
      const feedAction = item.feedAction || "allow";
      const pageAction = item.pageAction || "allow";
      sourceCache.set(key, { tags: display, predicted, provisional: false, expiresAt: Date.now() + CACHE_TTL_MS, pending: null, feedAction, pageAction });
      for (const state of [...mountedStates]) {
        if (state.key === key) {
          render(state, display, predicted);
          applyContentBlock(state, { provisional: false, feedAction, pageAction });
        }
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
