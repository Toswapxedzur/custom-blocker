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
  const ui = (key, fallback, values) => global.VaultContentI18n?.t(key, fallback, values) ?? fallback;
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
    name: "Untagged",
    lightColorHex: "#E5E7EB",
    darkColorHex: "#3F3F46"
  })]);
  // The temporary placeholder shown while the app classifies this video.
  const TAGGING_TAGS = Object.freeze([Object.freeze({
    id: "vault:tagging",
    name: "Tagging",
    lightColorHex: "#DBEAFE",
    darkColorHex: "#1E3A8A"
  })]);

  // Maps a resolved lookup to what should render. A definitive answer with no
  // tags or a failed lookup becomes Untagged. Failures keep a short retry TTL
  // internally, and a later successful response or push replaces the pill.
  function displayTags(tags) {
    if (!Array.isArray(tags)) return NONE_TAGS;
    return tags.length ? tags : NONE_TAGS;
  }
  const stateByRoot = new WeakMap();
  const mountedStates = new Set();
  const platformEpochs = new Map();
  const hostState = new WeakMap();
  let reattachObserver = null;
  let hoveredControl = null;

  function setHoveredControl(control) {
    if (control === hoveredControl) return;
    hoveredControl?.classList.toggle("pointer-hover", false);
    hoveredControl = control;
    hoveredControl?.classList.toggle("pointer-hover", true);
  }

  function pointerInside(control, event) {
    if (!control?.isConnected || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;
    const inside = (element) => {
      const rect = element?.getBoundingClientRect?.();
      return rect && event.clientX >= rect.left && event.clientX <= rect.right
        && event.clientY >= rect.top && event.clientY <= rect.bottom;
    };
    // The delete button protrudes beyond the pill. It belongs to the same hit
    // area, so moving onto it must not hide it before the click arrives.
    return inside(control) || inside(control.querySelector?.(".chip-del"));
  }

  function updatePointerHover(event) {
    const control = event.target?.closest?.(".chip-wrap,.add-btn,.panel-item");
    if (control && pointerInside(control, event)) setHoveredControl(control);
    else if (!pointerInside(hoveredControl, event)) setHoveredControl(null);
  }

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
    if (state.host && hoveredControl?.getRootNode?.().host === state.host) setHoveredControl(null);
    if (state.recheckTimer) {
      clearTimeout(state.recheckTimer);
      state.recheckTimer = null;
    }
    forgetContentBlock(state);
    try { state.host?.remove?.(); } catch (_) {}
    mountedStates.delete(state);
  }

  // Content-block POLICY lives in content.js (the extension's own tag filters);
  // this pipeline only reports that an entry's tags settled or changed, and
  // content.js re-decides: feed cards through the shared feed-filter pass, the
  // page's OWN entry (kind "page") through cbEvaluateTagPage, which blacks out
  // the player in place. A provisional ("Tagging…") state never blocks. Safe
  // no-op if content.js isn't present in this world.
  function notifyTagsChanged(state, result) {
    if (!state || !state.root || stateByRoot.get(state.root) !== state
      || state.epoch !== (platformEpochs.get(state.platform) || 0)) return;
    if (state.kind === "page") {
      const evaluate = global.cbEvaluateTagPage;
      if (typeof evaluate !== "function") return;
      const settled = Boolean(result) && !result.provisional;
      let action = "allow";
      try { action = evaluate(state.root, { entryID: state.entryID, platform: state.platform, settled }); } catch (_) {}
      devLog("page-verdict", { entry: state.entryID, action });
      return;
    }
    const reapply = global.cbReapplyTagFilters;
    if (typeof reapply === "function") { try { reapply(state.root); } catch (_) {} }
  }

  // The root is going away: lift a page blackout it owned. Feed cards need
  // nothing — the feed-filter pass re-derives platform verdicts from scratch.
  function forgetContentBlock(state) {
    if (!state || state.kind !== "page") return;
    const evaluate = global.cbEvaluateTagPage;
    if (typeof evaluate === "function") { try { evaluate(state.root, null); } catch (_) {} }
  }

  // Expose a card's resolved tags (with confidence) to custom content-block
  // rules, which run in content.js and only hold the card element. Returns the
  // display tag list for the card's current entryID, or [] if unknown.
  // The element content.js holds for a feed card is not always the element the
  // collector pilled: Reddit's filter card is the <article> wrapping the pilled
  // <shreddit-post>, and a Bilibili grid may wrap a card in an <li>. Resolve the
  // exact root first, else the one pilled card inside the given element.
  function stateForCard(root) {
    if (!root) return null;
    const exact = stateByRoot.get(root);
    if (exact) return exact;
    if (typeof root.contains !== "function") return null;
    let found = null;
    for (const state of mountedStates) {
      // A page entry counts too: X's focal tweet is the page's entry, and its
      // timeline cell is the card the filters see.
      if (state.root === root || !root.contains(state.root)) continue;
      if (found) return null; // ambiguous wrapper (several cards inside) → unknown
      found = state;
    }
    return found;
  }

  // What the card's pill shows is what the filters and rules see: the request
  // cache expires after CACHE_TTL_MS (it only saves re-asking), the pill's
  // answer holds while the pill does — otherwise a tag-blocked card came back
  // 15 s after it was tagged.
  function shownTags(state) {
    const tags = state && Array.isArray(state.currentTags) ? state.currentTags : null;
    if (!tags || tags.some((t) => t && t.id === "vault:tagging")) return null;
    return tags;
  }

  function tagsForCard(root) {
    const tags = shownTags(stateForCard(root));
    // Drop the "None" placeholder pill — custom rules only see real tags.
    return tags ? tags.filter((t) => t && t.id !== "vault:none") : [];
  }
  if (global) global.vaultTagsForCard = tagsForCard;

  // Has the classifier ANSWERED for this card? True only for a settled result
  // (real tags or an explicit "None"). False while it is still "Tagging…", when
  // the lookup failed, or when the root is unknown. content.js needs this to
  // tell "untagged" (a decision) apart from "don't know yet" (not one): a
  // block-untagged filter must never black out a feed the classifier simply
  // hasn't answered for.
  function tagsSettledForCard(root) {
    return shownTags(stateForCard(root)) !== null;
  }
  if (global) global.vaultTagsSettledForCard = tagsSettledForCard;

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
      return Promise.resolve({ tags: cached.tags, predicted: cached.predicted === true, provisional: cached.provisional === true, failed: cached.failed === true });
    }

    const epoch = platformEpochs.get(platform) || 0;
    const record = { tags: cached?.tags || [], predicted: cached?.predicted === true, provisional: cached?.provisional === true, expiresAt: 0, pending: null };
    const pending = new Promise((resolve) => {
      pendingBatch.push({ platform, entryID, creatorID, title, key, resolve });
      scheduleDrain();
    }).then((result) => {
      if (epoch !== (platformEpochs.get(platform) || 0)) return null;
      // A push/correction or newer request owns this entry now. An older
      // request must never overwrite its cache or flash a provisional pill.
      const latest = sourceCache.get(key);
      if (latest && latest !== record) return latest.pending || {
        tags: latest.tags, predicted: latest.predicted === true,
        provisional: latest.provisional === true, failed: latest.failed === true
      };
      // The app is still classifying this video: show the "Tagging" placeholder
      // and re-check soon so the real tags replace it quickly. Never dim/hide
      // while provisional — a card is only ever acted on by a resolved verdict.
      if (result && result.pending) {
        sourceCache.set(key, { tags: TAGGING_TAGS, predicted: false, provisional: true, expiresAt: Date.now() + PENDING_TTL_MS, pending: null });
        prune();
        return { tags: TAGGING_TAGS, predicted: false, provisional: true };
      }
      const display = displayTags(result && result.tags);
      const predicted = Boolean(result && result.predicted);
      sourceCache.set(key, { tags: display, predicted, provisional: false, failed: !result, expiresAt: Date.now() + (result ? CACHE_TTL_MS : PENDING_TTL_MS), pending: null });
      prune();
      return { tags: display, predicted, provisional: false, failed: !result };
    });
    record.pending = pending;
    sourceCache.set(key, record);
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
    const items = jobs.map((job) => ({
      entryID: job.entryID, creatorID: job.creatorID, title: job.title
    }));
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
    // The block is a live function of the tags: a correction flips it NOW.
    notifyTagsChanged(state, { provisional: false });
  }

  // Optimistic tag edit: update the pill NOW, then send the correction in the
  // background and revert only if it fails. `addTag` is a full display tag
  // {id,name,lightColorHex,darkColorHex}; `removeID` is a tag id.
  function editTags(state, { addTag, removeID }) {
    if (state.correctionPending) return;
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
    // A correction makes the whole set human-authoritative; the app stamps it at
    // max confidence (5). Mirror that locally so the optimistic block decision
    // equals the one the confirming broadcast will produce.
    next = next.map((tag) => ({ ...tag, confidence: 5 }));
    state.correctionPending = true;
    state.failedCorrection = null;
    applyLocalTags(state, next);   // instant — and the block re-decides from the new tags

    updateCorrectionStatus(state);
    (async () => {
      const taxonomy = await fetchTaxonomy(state.platform);
      const typeID = typeForTag(taxonomy, removeID || addTag.id);
      if (!typeID) { fail(); return; }
      const correctTagIDs = next.filter((tag) => typeForTag(taxonomy, tag.id) === typeID).map((tag) => tag.id);
      const result = await sendCorrection(state.platform, state.entryID, state.creatorID, typeID, correctTagIDs);
      if (!result || result.ok !== true) {
        fail();
        return;
      }
      state.correctionPending = false;
      updateCorrectionStatus(state);
      // success → the video-tags-updated broadcast confirms (same signature).
    })().catch(fail);
    function fail() {
      if (stateByRoot.get(state.root) !== state) return;
      state.correctionPending = false;
      state.failedCorrection = { addTag, removeID };
      applyLocalTags(state, before);
      updateCorrectionStatus(state);
    }
  }

  function updateCorrectionStatus(state) {
    if (!state.status) return;
    state.status.replaceChildren();
    state.status.dataset.failed = String(Boolean(state.failedCorrection));
    const document = state.status.ownerDocument || global.document;
    if (state.correctionPending) state.status.textContent = ui("contentTag.saving", "Saving…");
    else if (state.failedCorrection) {
      const message = document.createElement("span");
      message.textContent = ui("contentTag.saveFailed", "Could not save tag correction.") + " ";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "retry";
      retry.textContent = ui("contentTag.retry", "Retry");
      retry.addEventListener("click", (event) => {
        event.preventDefault(); event.stopPropagation();
        editTags(state, state.failedCorrection);
      });
      state.status.append(message, retry);
    }
    state.rail?.querySelectorAll("button").forEach((button) => { button.disabled = state.correctionPending === true; });
    state.panel?.querySelectorAll(".panel-item").forEach((button) => { button.disabled = state.correctionPending === true; });
  }

  function closeTagPanel(state, restoreFocus = true) {
    if (!state.panel?.classList.contains("open")) return;
    state.panel.classList.remove("open");
    if (restoreFocus) state.rail?.querySelector(".add-btn")?.focus();
  }

  function placeTagPanel(state) {
    const panel = state.panel;
    if (!panel?.classList.contains("open")) return;
    const host = state.host.getBoundingClientRect();
    const anchor = state.rail.querySelector(".add-btn").getBoundingClientRect();
    panel.style.maxWidth = Math.max(0, global.innerWidth - 16) + "px";
    panel.style.maxHeight = Math.max(0, global.innerHeight - 16) + "px";
    const box = panel.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.left, global.innerWidth - box.width - 8));
    const below = global.innerHeight - anchor.bottom - 12;
    const top = below >= box.height ? anchor.bottom + 4 : Math.max(8, anchor.top - box.height - 4);
    panel.style.left = (left - host.left) + "px";
    panel.style.top = (Math.min(top, global.innerHeight - box.height - 8) - host.top) + "px";
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
    title.textContent = ui("contentTag.add", "Add tag");
    const close = document.createElement("button");
    close.className = "panel-close";
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", ui("contentTag.close", "Close"));
    head.append(title, close);
    const search = document.createElement("input");
    search.className = "panel-search";
    search.type = "text";
    search.placeholder = ui("contentTag.search", "Search tags");
    const list = document.createElement("div");
    list.className = "panel-list";
    panel.append(head, search, list);
    placeTagPanel(state);
    try { search.focus(); } catch (_) {}

    const taxonomy = await fetchTaxonomy(state.platform);
    if (!panel.classList.contains("open")) return;
    const applied = new Set(realTagIDs(state));
    const items = taxonomy ? [...taxonomy.tagByID.values()].filter((tag) => !applied.has(tag.id)) : [];
    items.sort((a, b) => a.name.localeCompare(b.name));
    let page = 0;
    const pager = document.createElement("div"); pager.className = "panel-head";
    const previous = document.createElement("button"), next = document.createElement("button"), count = document.createElement("span");
    previous.type = next.type = "button"; previous.className = next.className = "panel-close";
    previous.textContent = "‹"; next.textContent = "›";
    previous.setAttribute("aria-label", ui("contentTag.previous", "Previous tags")); next.setAttribute("aria-label", ui("contentTag.next", "Next tags")); count.setAttribute("role", "status");
    pager.append(previous, count, next); panel.append(pager);
    function paintChoices(reset = false) {
      if (reset) page = 0;
      const query = search.value.trim().toLowerCase(), matches = items.filter(tag => tag.name.toLowerCase().includes(query));
      page = Math.max(0, Math.min(page, Math.ceil(matches.length / 40) - 1));
      list.replaceChildren();
      previous.disabled = !page; next.disabled = (page + 1) * 40 >= matches.length;
      count.textContent = matches.length ? `${page * 40 + 1}–${Math.min((page + 1) * 40, matches.length)} / ${matches.length}` : ui("contentTag.noMatches", "No matches");
      pager.hidden = matches.length <= 40;
    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "panel-empty";
      empty.textContent = taxonomy ? ui("contentTag.noMore", "No more tags") : ui("contentTag.unavailable", "No tags available");
      list.append(empty);
    } else {
      for (const tag of matches.slice(page * 40, (page + 1) * 40)) {
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
    }
    panel.__paintChoices = paintChoices;
    previous.onclick = () => { page--; paintChoices(); }; next.onclick = () => { page++; paintChoices(); };
    paintChoices();
    placeTagPanel(state);
    updateCorrectionStatus(state);
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
      ":host{all:initial;display:inline-block;max-width:100%;color-scheme:light;contain:layout style}",
      ".rail{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px;max-width:100%;vertical-align:middle}",
      ".chip{box-sizing:border-box;display:inline-flex;align-items:center;max-width:220px;min-height:18px;padding:1px 7px;border:0;border-radius:999px;background:var(--vault-tag-color-dark);color:#fff;font:600 11px/16px Arial,Helvetica,sans-serif;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 2px rgba(0,0,0,.18)}",
      // Pills contrast with the browser preference, keeping tag hues and prediction outlines.
      ".chip.predicted{background:var(--vault-tag-color-dark);color:var(--vault-tag-color-light);border:1px dashed var(--vault-tag-color-light);box-shadow:none}",
      // The temporary "Tagging" placeholder: muted, dashed, gently pulsing.
      ".chip.tagging{background:var(--vault-tag-color-dark);color:var(--vault-tag-color-light);border:1px dashed var(--vault-tag-color-light);box-shadow:none;animation:vault-tagging 1.2s ease-in-out infinite}",
      "@keyframes vault-tagging{0%,100%{filter:brightness(.94)}50%{filter:brightness(1)}}",
      // Live correction: a delete affordance on hover, an add button, and a small panel.
      ".chip-wrap{position:relative;display:inline-flex;align-items:center}",
      ".chip-del{position:absolute;top:-6px;right:-6px;width:14px;height:14px;padding:0;display:none;align-items:center;justify-content:center;border:0;border-radius:999px;background:#991b1b;color:#fee2e2;font:700 10px/1 Arial,Helvetica,sans-serif;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.35)}",
      ".chip-wrap.pointer-hover .chip-del,.chip-wrap:focus-within .chip-del{display:inline-flex}",
      ".add-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:18px;padding:1px 8px;border:0;border-radius:999px;background:#1e3a8a;color:#eef2ff;font:600 11px/16px Arial,Helvetica,sans-serif;cursor:pointer;opacity:.7}",
      ".add-btn.pointer-hover{opacity:1}",
      // CSS updates already-mounted pills when the browser preference changes.
      "@media (prefers-color-scheme:dark){.chip,.chip.predicted,.chip.tagging{background:var(--vault-tag-color-light);color:#000}.chip.predicted,.chip.tagging{color:var(--vault-tag-color-dark);border-color:var(--vault-tag-color-dark)}.add-btn{background:#eef2ff;color:#1e3a8a}.chip-del{background:#fee2e2;color:#991b1b}}",
      ".panel{position:absolute;top:calc(100% + 4px);left:0;z-index:2147483647;width:190px;max-height:230px;display:none;flex-direction:column;background:#fff;color:#1f2937;border:0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.22);overflow:hidden;font:500 12px/1.3 Arial,Helvetica,sans-serif}",
      ".panel.open{display:flex}",
      ".panel-head{display:flex;align-items:center;justify-content:space-between;padding:7px 9px 4px;font-weight:700}",
      ".panel-close{border:0;background:transparent;cursor:pointer;font-size:14px;line-height:1;color:#666;padding:0 2px}",
      ".panel-search{margin:0 9px 6px;padding:5px 8px;border:0;border-radius:7px;background:#f1f5f9;color:#1f2937;font:inherit;outline:none}",
      ".panel-list{overflow-y:auto;max-height:158px;padding:0 5px 6px}",
      ".panel-item{display:flex;align-items:center;gap:7px;width:100%;padding:5px 7px;border:0;border-radius:6px;background:transparent;cursor:pointer;font:inherit;text-align:left;color:#111}",
      ".panel-item.pointer-hover{background:rgba(0,0,0,.06)}",
      ".panel-dot{flex:0 0 auto;width:9px;height:9px;border-radius:999px}",
      ".panel-empty{padding:8px 10px;color:#888}",
      ".correction-status:empty{display:none}",
      ".correction-status{display:inline-block;margin-left:5px;padding:3px 7px;border-radius:8px;background:#fff;color:#1e3a8a;font:500 11px/1.4 Arial,Helvetica,sans-serif}",
      '.correction-status[data-failed="true"]{color:#991b1b}',
      ".retry{border:0;border-radius:999px;padding:2px 6px;background:#eef2ff;color:#1e3a8a;font:inherit;cursor:pointer}",
    ].join("");
    // The host anchors the absolutely-positioned panel.
    host.style.position = "relative";
    const rail = document.createElement("span");
    rail.className = "rail";
    const panel = document.createElement("div");
    panel.className = "panel";
    const status = document.createElement("span");
    status.className = "correction-status";
    status.setAttribute("role", "status");
    shadow.append(style, rail, panel, status);

    // One delegated listener drives every correction affordance; the rail is
    // re-populated on each render but the shadow root (and this listener) persist.
    if (typeof shadow.addEventListener === "function") {
    // Pointer geometry owns the visual state. Spurious boundary events during
    // continuous in-pill motion cannot toggle CSS :hover on every frame.
    shadow.addEventListener("pointerover", updatePointerHover);
    shadow.addEventListener("pointermove", updatePointerHover);
    shadow.addEventListener("pointerout", (event) => {
      if (!pointerInside(hoveredControl, event)) setHoveredControl(null);
    });
    shadow.addEventListener("click", (event) => {
      const state = hostState.get(host);
      if (!state) return;
      const target = event.target;
      if (typeof target?.closest !== "function") return;
      const del = target.closest(".chip-del");
      if (del) { event.preventDefault(); event.stopPropagation(); removeTag(state, del); return; }
      if (target.closest(".add-btn")) { event.preventDefault(); event.stopPropagation(); openAddPanel(state, panel); return; }
      // The pill host is injected inside the card's own link; any click within
      // the panel (search box, list, backdrop) must be swallowed so it never
      // navigates the underlying video. Focus/typing still work (they fire on
      // mousedown/keydown, which this does not touch).
      if (target.closest(".panel")) {
        event.preventDefault();
        event.stopPropagation();
        if (target.closest(".panel-close")) { closeTagPanel(state); return; }
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
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        const state = hostState.get(host);
        if (state?.panel?.classList.contains("open")) { event.preventDefault(); event.stopPropagation(); closeTagPanel(state); }
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const chip = event.target?.closest?.(".chip-wrap");
      const del = chip?.querySelector(".chip-del");
      const state = hostState.get(host);
      if (!del || !state || event.repeat) return;
      event.preventDefault(); event.stopPropagation();
      removeTag(state, del);
    });
    shadow.addEventListener("input", (event) => {
      const search = event.target?.closest?.(".panel-search");
      if (!search) return;
      panel.__paintChoices?.(true);
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
    return { host, rail, panel, status };
  }

  function removeTag(state, button) {
    const id = button.dataset.tagId;
    if (state.correctionPending || !(state.currentTags || []).some((tag) => tag.id === id)) return;
    editTags(state, { removeID: id });
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
      state.panel = mount.panel;
      state.status = mount.status;
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
    const focusedTag = state.rail.getRootNode?.().activeElement?.closest?.(".chip-wrap")?.querySelector(".chip-del")?.dataset.tagId;
    state.rail.replaceChildren?.();
    state.currentTags = tags;
    state.currentPredicted = predicted;
    state.host.dir = global.VaultContentI18n?.language === "ar" ? "rtl" : "ltr";
    const document = state.root.ownerDocument || global.document;
    const isTagging = tags.length === 1 && tags[0].id === "vault:tagging";
    for (const tag of tags) {
      const wrap = document.createElement("span");
      wrap.className = "chip-wrap";
      const chip = document.createElement("span");
      chip.className = tag.id === "vault:tagging" ? "chip tagging" : (predicted ? "chip predicted" : "chip");
      chip.dir = "auto";
      chip.textContent = tag.id === "vault:none" ? ui("contentTag.untagged", "Untagged") : tag.id === "vault:tagging" ? ui("contentTag.tagging", "Tagging") : tag.name;
      chip.style.setProperty("--vault-tag-color-light", tag.lightColorHex);
      chip.style.setProperty("--vault-tag-color-dark", tag.darkColorHex);
      wrap.appendChild(chip);
      // Real tags carry a hover delete affordance; the None/Tagging placeholders do not.
      if (!SYNTHETIC_IDS.has(tag.id)) {
        wrap.tabIndex = 0;
        wrap.setAttribute("aria-label", ui("contentTag.removeInstruction", tag.name + ". Press Delete to remove", { tag: tag.name }));
        wrap.setAttribute("aria-keyshortcuts", "Delete Backspace");
        const del = document.createElement("button");
        del.className = "chip-del";
        del.type = "button";
        del.textContent = "×";
        del.dataset.tagId = tag.id;
        del.setAttribute("aria-label", ui("contentTag.remove", "Remove tag"));
        wrap.appendChild(del);
        if (tag.id === focusedTag) global.setTimeout(() => { if (wrap.isConnected) wrap.focus(); }, 0);
      }
      state.rail.appendChild(wrap);
    }
    // An add-a-tag button always sits at the end of the queue (except while the
    // video is still being classified).
    if (!isTagging) {
      const add = document.createElement("button");
      add.className = "add-btn";
      add.type = "button";
      add.textContent = ui("contentTag.addButton", "+ tag");
      add.setAttribute("aria-label", ui("contentTag.add", "Add tag"));
      state.rail.appendChild(add);
    }
    updateCorrectionStatus(state);
  }

  // A provisional ("Tagging") pill upgrades by re-requesting once its short
  // cache entry expires. Mutations normally re-trigger observe, but a quiet
  // page never mutates — so drive a bounded re-check from a timer instead.
  function settleState(state, result) {
    if (stateByRoot.get(state.root) !== state || state.root.isConnected === false
      || state.epoch !== (platformEpochs.get(state.platform) || 0)) return;
    // Rechecks can return pending after a known answer. Hold the answer until
    // another settled answer exists; Reddit hydration must not flash Tagging.
    const holding = shownTags(state) && (result?.provisional || result?.failed);
    if (!holding) render(state, result?.tags || NONE_TAGS, Boolean(result?.predicted));
    notifyTagsChanged(state, holding ? { provisional: false } : result || { failed: true });
    if (result?.provisional || result?.failed) scheduleProvisionalRecheck(state);
  }
  function scheduleProvisionalRecheck(state) {
    if (state.recheckTimer) return;
    if (state.recheckAttempts >= MAX_PENDING_RECHECKS) {
      if (!shownTags(state)) {
        sourceCache.set(state.key, { tags: NONE_TAGS, predicted: false, provisional: false,
          failed: true, expiresAt: Date.now() + PENDING_TTL_MS, pending: null });
        render(state, NONE_TAGS);
        notifyTagsChanged(state, { failed: true, provisional: false });
      }
      return;
    }
    state.recheckAttempts += 1;
    state.recheckTimer = setTimeout(() => {
      state.recheckTimer = null;
      if (stateByRoot.get(state.root) !== state
        || state.epoch !== (platformEpochs.get(state.platform) || 0)
        || state.root.isConnected === false) return;
      if (!state.title) return scheduleProvisionalRecheck(state);
      request(state.platform, state.entryID, state.creatorID, state.title).then(result => settleState(state, result));
    }, PENDING_TTL_MS + 200);
  }

  function observe({ platform, entryID, creatorID, title, root, anchor = null, kind = "card" } = {}) {
    const key = boundedIdentity(platform, entryID);
    if (!key || !root || root.isConnected === false) return;
    creatorID = boundedIdentity(platform, creatorID) ? creatorID : `${platform}:collab:${entryID.slice(platform.length + 1)}`;
    title = typeof title === "string" ? title.trim() : "";
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
        kind: kind === "page" ? "page" : "card",
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
      if (kind === "page") state.kind = "page";
      // A card may hydrate its title/creator after first paint.
      if (title && title !== state.title) { state.title = title; state.recheckAttempts = 0; }
      if (creatorID) state.creatorID = creatorID;
    }
    state.epoch = platformEpochs.get(platform) || 0;
    devLog("observe", { platform, entry: entryID, creator: creatorID });
    const cached = sourceCache.get(key);
    render(state, state.currentTags || (cached?.tags?.length ? cached.tags : TAGGING_TAGS), cached?.predicted === true);
    notifyTagsChanged(state, { provisional: !shownTags(state) });
    if (!state.title) return scheduleProvisionalRecheck(state);
    request(platform, entryID, state.creatorID, state.title).then((result) => {
      devLog("result", {
        entry: entryID,
        state: result ? (result.provisional ? "tagging" : ((result.tags && result.tags.length) ? "tags" : "none")) : "null"
      });
      settleState(state, result);
    });
  }

  // Push path: the app broadcasts each resolved classification through the hub,
  // so a provisional pill swaps to real tags the moment the result exists. The
  // timer re-check above remains as the fallback for a missed push. Items were
  // already contract-validated by the bridge before fan-out.
  function applyPushedTags(platform, items) {
    for (const item of items) {
      if (!item || typeof item.entryID !== "string" || !Array.isArray(item.tags)) continue;
      const key = boundedIdentity(platform, item.entryID);
      const display = displayTags(item && item.tags);
      if (!key || !display) continue;
      const predicted = item.predicted === true;
      sourceCache.set(key, { tags: display, predicted, provisional: false, expiresAt: Date.now() + CACHE_TTL_MS, pending: null });
      for (const state of [...mountedStates]) {
        if (state.key === key) {
          render(state, display, predicted);
          notifyTagsChanged(state, { provisional: false });
        }
      }
    }
    prune();
  }

  try {
    global.chrome?.runtime?.onMessage?.addListener?.((message, sender) => {
      if (message?.type === "vault-classifier-state-updated"
        && (!sender?.id || sender.id === global.chrome.runtime.id)
        && ["youtube", "reddit", "twitter", "bilibili"].includes(message.platform)) {
        clearPlatform(message.platform);
        taxonomyCache.delete(message.platform);
        return false;
      }
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

  // One set of page listeners, shared by every private tag host.
  global.document?.addEventListener?.("pointermove", (event) => {
    if (hoveredControl && !pointerInside(hoveredControl, event)) setHoveredControl(null);
  }, true);
  global.addEventListener?.("blur", () => setHoveredControl(null));
  global.document?.addEventListener?.("pointerdown", (event) => {
    const path = event.composedPath?.() || [];
    for (const state of mountedStates) {
      if (!path.includes(state.host)) closeTagPanel(state, false);
    }
  }, true);
  global.addEventListener?.("resize", () => {
    for (const state of mountedStates) closeTagPanel(state, false);
  });
  global.document?.addEventListener?.("scroll", (event) => {
    const path = event.composedPath?.() || [];
    for (const state of mountedStates) if (!path.includes(state.host)) closeTagPanel(state, false);
  }, true);

  global.VaultContentI18n?.onChange(() => {
    for (const state of mountedStates) {
      state.signature = "";
      render(state, state.currentTags, state.currentPredicted);
      if (state.panel?.classList.contains("open")) openAddPanel(state, state.panel);
    }
  });

  global.VaultClassifierTagUI = Object.freeze({ observe, clearPlatform });
})(typeof globalThis !== "undefined" ? globalThis : this);
