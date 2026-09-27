// Debug-mode-gated console helpers, mirrored from background.js. Off
// by default so an idle page is silent in DevTools. Toggle via
// Settings → Debug mode.
let cbDebugMode = false;
function cbDebugLog(...args) { if (cbDebugMode) { try { console.log(...args); } catch (_) {} } }
function cbDebugWarn(...args) { if (cbDebugMode) { try { console.warn(...args); } catch (_) {} } }
function cbApplyGlobalSettings(settings) {
  const s = settings && typeof settings === "object" ? settings : {};
  cbDebugMode = s.debugMode === true;
}
try {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("globalSettings", (r) => {
      const s = r && r.globalSettings;
      cbApplyGlobalSettings(s);
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.globalSettings) return;
        const next = changes.globalSettings.newValue;
        cbApplyGlobalSettings(next);
      });
    }
  }
} catch (_) {}

/* Custom Web Blocker — content script.
 *
 * Responsibilities (per page):
 *   - Heartbeat the background service worker so it can attribute usage
 *     time to site/timed groups.
 *   - Render the in-page timer overlay.
 *   - Apply feed-card filtering (driven by `feedFilters` in the session
 *     payload).
 *   - Tell the custom rules what the page shows (feed items) and do what
 *     they ask (item verdicts, style sheets, element operations, the cover,
 *     panels). The rules themselves run in the worker's sandbox.
 *   - Cover the page when the background says so OR when a custom rule
 *     does.
 */

function normalizeHostname(hostname) {
  const trimmed = String(hostname ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
}

// Entity/mode normalisation, host predicates, path parsers and
// detectVideoSiteContext now live in platform-profiles.js (loaded as the
// first content script) and are available here as globals:
//   normalizeYouTubeCreatorInput, normalizeSourceInput,
//   normalizeRedditSubredditInput, normalizeDiscordTargetInput,
//   isYouTubeHost, isRedditHost, isDiscordHost, isTwitterHost,
//   getPlatformGroupTypeForHost,
//   parseRedditSubredditFromPath, parseDiscordServerIdFromPath,
//   parseDiscordChannelIdFromPath, detectVideoSiteContext.

function formatOverlayDurationMs(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function mountOverlay() {
  const container = document.createElement("div");
  container.id = "custom-web-blocker-timer";
  container.style.position = "fixed";
  container.style.top = "12px";
  container.style.left = "12px";
  container.style.zIndex = "2147483647";
  container.style.padding = "8px 10px";
  container.style.borderRadius = "10px";
  container.style.background = "rgba(15, 23, 42, 0.86)";
  container.style.color = "#f8fafc";
  container.style.fontFamily = "SFMono-Regular, Consolas, monospace";
  container.style.fontSize = "13px";
  container.style.lineHeight = "1.35";
  container.style.whiteSpace = "pre";
  container.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.28)";
  container.style.pointerEvents = "none";
  container.textContent = "00:00";
  document.documentElement.appendChild(container);
  return { container };
}

// ────────────────────────────────────────────────────────────────────────
// Module state.
// ────────────────────────────────────────────────────────────────────────

let overlay = null;
let exitAttempted = false;
let heartbeatIntervalId = null;
let lastHeartbeatAt = Date.now();
let lastKnownUrl = location.href;
let refreshDebounceTimeoutId = null;
let feedObserver = null;
let feedApplyRafId = null;
let latestFeedFilters = [];
let latestSurfaceHides = [];
// Group ids whose platform filter currently matches content on this page.
// Reported with the heartbeat so the usage timer only accrues on exposure.
let latestExposedGroupIds = [];
let extensionContextInvalid = false;

function isExtensionContextValid() {
  if (extensionContextInvalid) return false;
  try { return Boolean(chrome?.runtime?.id); } catch { return false; }
}

function isContextInvalidatedError(error) {
  const message = error?.message || (typeof error === "string" ? error : "");
  return /Extension context invalidated|context invalidated|Receiving end does not exist/i.test(message);
}

function shutdownContentScript() {
  if (extensionContextInvalid) return;
  extensionContextInvalid = true;
  stopHeartbeat();
  stopFeedObserver();
  restoreHiddenFeedCards();

  if (refreshDebounceTimeoutId !== null) {
    window.clearTimeout(refreshDebounceTimeoutId);
    refreshDebounceTimeoutId = null;
  }
  if (overlay?.container?.parentNode) {
    overlay.container.parentNode.removeChild(overlay.container);
  }
  overlay = null;
  // The extension was updated or reloaded under this page: a blocked page
  // stays covered until the new extension reloads it and decides again.
  try { cbStopCoverTimers(); } catch {}
  try { cbUnmountQuickAdd(); } catch {}
  // Nothing reaches the rules any more.
  cbStopRuleItems();
  clearSessionResolveRetries();
}

function safeSendMessage(message, callback) {
  if (!isExtensionContextValid()) {
    shutdownContentScript();
    return;
  }
  try {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        if (isContextInvalidatedError(lastError)) shutdownContentScript();
        return;
      }
      if (typeof callback === "function") {
        try {
          callback(response);
        } catch (callbackError) {
          if (isContextInvalidatedError(callbackError)) {
            shutdownContentScript();
            return;
          }
          throw callbackError;
        }
      }
    });
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      shutdownContentScript();
      return;
    }
    throw error;
  }
}

function ensureOverlay() {
  if (!overlay) overlay = mountOverlay();
  return overlay;
}

function removeOverlay() {
  if (overlay?.container?.isConnected) overlay.container.remove();
  overlay = null;
}

// ────────────────────────────────────────────────────────────────────────
// DOM extraction helpers shared by feed-filter logic and platform intents.
// ────────────────────────────────────────────────────────────────────────

function extractCreatorFromHref(href) {
  if (!href) return null;
  try {
    return normalizeYouTubeCreatorInput(new URL(href, location.origin).href);
  } catch {
    return normalizeYouTubeCreatorInput(href);
  }
}

const POST_CARD_SELECTOR =
  "ytd-post-renderer, ytd-backstage-post-thread-renderer, ytd-backstage-post-renderer";

// A platform's feed cards, from its profile (platform-profiles.js): either
// the card wrappers themselves (`cardSelectors`, optionally lifted to their
// `cardClosest` container), or the containers around its anchors.
function getFeedCardElements(site) {
  const feedProfile = PLATFORM_PROFILES?.[site]?.feed;
  if (Array.isArray(feedProfile?.cardSelectors)) {
    const cards = new Set();
    for (const selector of feedProfile.cardSelectors) {
      let nodes = [];
      try { nodes = document.querySelectorAll(selector); } catch { continue; }
      for (const node of nodes) {
        cards.add((feedProfile.cardClosest && node.closest?.(feedProfile.cardClosest)) || node);
      }
    }
    // One card per item: a wrapper inside another card (YouTube's lockup in
    // its rich item) is the same item — only the outermost counts, as the
    // tagger counts it.
    return [...cards].filter((card) => {
      for (let parent = card.parentElement; parent; parent = parent.parentElement) {
        if (cards.has(parent)) return false;
      }
      return true;
    });
  }

  const anchorSelectors = Array.isArray(feedProfile?.anchorSelectors)
    ? feedProfile.anchorSelectors
    : [];

  if (anchorSelectors.length === 0) return [];

  const containers = new Set();
  const containerSelector = (
    Array.isArray(feedProfile?.containerSelectors) && feedProfile.containerSelectors.length > 0
      ? feedProfile.containerSelectors
      : [
          "article",
          '[role="article"]',
          '[data-e2e*="item"]',
          '[data-testid*="cell"]',
          '[data-pagelet]',
          "li"
        ]
  ).join(", ");

  for (const anchor of document.querySelectorAll(anchorSelectors.join(", "))) {
    const container = anchor.closest(containerSelector);
    if (container) containers.add(container);
  }
  return [...containers];
}

function isPostCard(card) {
  return Boolean(card.matches(POST_CARD_SELECTOR) || card.querySelector(POST_CARD_SELECTOR));
}

function getFeedCardHref(card, site) {
  if (site !== "youtube") {
    const profileSelectors = PLATFORM_PROFILES?.[site]?.feed?.hrefSelectors;
    const preferredSelector = Array.isArray(profileSelectors) && profileSelectors.length > 0
      ? profileSelectors.join(", ")
      : "a[href]";
    const href = card.querySelector(preferredSelector)?.getAttribute("href") ??
      card.querySelector("a[href]")?.getAttribute("href");
    return href || null;
  }

  const link = card.querySelector(
    [
      'a#thumbnail[href^="/watch"]',
      'a#thumbnail[href^="/shorts/"]',
      'a.ytd-thumbnail[href^="/watch"]',
      'a.ytd-thumbnail[href^="/shorts/"]',
      'a[href^="/watch"]:not([href*="list="])',
      'a[href^="/shorts/"]',
      'a[href^="/post/"]'
    ].join(", ")
  );
  return link?.getAttribute("href") ?? null;
}

function getPostCardElement(card) {
  if (card.matches(POST_CARD_SELECTOR)) return card;
  return card.querySelector(POST_CARD_SELECTOR);
}

function getFeedCardCreators(card) {
  const identifiers = new Set();
  const collectFromScope = (scope) => {
    if (!scope) return;
    const creatorSelectors = [
      "ytd-channel-name a[href]",
      "#channel-name a[href]",
      'a[href^="/@"]',
      'a[href*="/@"]',
      'a[href^="/channel/"]',
      'a[href*="/channel/"]',
      'a[href^="/c/"]',
      'a[href*="/c/"]',
      'a[href^="/user/"]',
      'a[href*="/user/"]'
    ];
    for (const selector of creatorSelectors) {
      for (const element of scope.querySelectorAll(selector)) {
        const identifier = extractCreatorFromHref(element.getAttribute("href"));
        if (identifier) identifiers.add(identifier);
      }
    }
  };
  const postElement = getPostCardElement(card);

  if (postElement) {
    const authorSelectors = [
      "#author-text a[href]",
      "ytd-channel-name#channel-name a[href]",
      "ytd-channel-name a[href]"
    ];
    for (const selector of authorSelectors) {
      const element = postElement.querySelector(selector);
      if (!element) continue;
      const identifier = extractCreatorFromHref(element.getAttribute("href"));
      if (identifier) {
        identifiers.add(identifier);
        break;
      }
    }
    return [...identifiers];
  }

  collectFromScope(card);

  // A Short in a reel shelf names its channel on the shelf, not the card
  // (wider sections would lend every result's creator to this card).
  if (identifiers.size === 0) collectFromScope(card.closest("ytd-reel-shelf-renderer"));

  return [...identifiers];
}

function extractRedditSubredditFromCard(card) {
  if (!card) return null;
  const attrCandidates = [
    card.getAttribute?.("subreddit-name"),
    card.getAttribute?.("subreddit-prefixed-name"),
    card.getAttribute?.("data-subreddit"),
    card.getAttribute?.("data-subreddit-prefixed")
  ];
  for (const value of attrCandidates) {
    if (value) {
      const normalized = normalizeRedditSubredditInput(value);
      if (normalized) return normalized;
    }
  }
  const nestedSelectors = [
    "[subreddit-name]",
    "[subreddit-prefixed-name]",
    "[data-subreddit]",
    "[data-subreddit-prefixed]"
  ];
  for (const selector of nestedSelectors) {
    let element;
    try { element = card.querySelector(selector); } catch { continue; }
    if (!element) continue;
    const value =
      element.getAttribute("subreddit-name") ||
      element.getAttribute("subreddit-prefixed-name") ||
      element.getAttribute("data-subreddit") ||
      element.getAttribute("data-subreddit-prefixed");
    if (value) {
      const normalized = normalizeRedditSubredditInput(value);
      if (normalized) return normalized;
    }
  }
  let links = [];
  try { links = card.querySelectorAll('a[href*="/r/"]'); } catch { links = []; }
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const match = href.toLowerCase().match(/\/r\/([^/?#]+)/);
    if (match) {
      const normalized = normalizeRedditSubredditInput(match[1]);
      if (normalized) return normalized;
    }
  }
  return null;
}

function getCurrentFeedSite() {
  const hostname = normalizeHostname(location.hostname);
  const videoCtx = detectVideoSiteContext(hostname, location.pathname);
  if (videoCtx.site) return videoCtx.site;
  if (isRedditHost(hostname)) return "reddit";
  return getPlatformGroupTypeForHost(hostname);
}

// Classifier tags for a feed card (id/name/confidence), from the Vault tag
// pipeline in this same isolated world. Empty until the pill resolves. Shared by
// the platform feed-filter path (content-tag filter) and custom rules.
//
// The returned array carries `.settled`: true only once the classifier has
// ANSWERED for this card (tags, or an explicit "None"). It is false while the
// card is still "Tagging…", when the lookup failed, and in a browser that ships
// no tag pipeline at all (Safari) — there every card would otherwise look
// "untagged" and a block-untagged filter would black out the whole feed.
function getFeedCardTags(card) {
  let tags = [];
  let settled = false;
  try {
    if (typeof window !== "undefined" && typeof window.vaultTagsForCard === "function") {
      const resolved = window.vaultTagsForCard(card);
      if (Array.isArray(resolved)) {
        tags = resolved
          .filter((t) => t && typeof t.name === "string")
          .map((t) => ({ id: t.id, name: t.name, confidence: Number.isInteger(t.confidence) ? t.confidence : 0 }));
      }
      settled = typeof window.vaultTagsSettledForCard === "function"
        ? window.vaultTagsSettledForCard(card) === true
        : tags.length > 0;
    }
  } catch (_) {}
  tags.settled = settled;
  return tags;
}

function getFeedCardData(card) {
  const currentSite = getCurrentFeedSite();
  if (currentSite === "reddit") {
    // Reddit's source axis is the subreddit, carried like any creator list.
    const subreddit = extractRedditSubredditFromCard(card);
    return { videoForm: "post", creators: subreddit ? [subreddit] : [], tags: getFeedCardTags(card) };
  }
  if (currentSite === "twitter") {
    // The tweet's author is in its status link (/<handle>/status/<id>); the
    // accounts it mentions or quotes are not its author.
    const status = card.querySelector('a[href*="/status/"]')?.getAttribute("href") || "";
    const author = normalizeTwitterHandleInput(status.split("/status/")[0]);
    return { videoForm: "post", creators: author ? [author] : [], tags: getFeedCardTags(card) };
  }
  if (currentSite !== "youtube") {
    const href = getFeedCardHref(card, currentSite);
    if (!href) return null;
    let url;
    try { url = new URL(href, location.origin); } catch { return null; }
    const videoContext = detectVideoSiteContext(normalizeHostname(url.hostname), url.pathname);
    const creators = [
      ...new Set(
        // The resolved link: Bilibili writes protocol-relative ones (//space.bilibili.com/…).
        [...card.querySelectorAll("a[href]")]
          .map((anchor) => normalizeSourceInput(anchor.href, currentSite))
          .filter(Boolean)
      )
    ];
    return { videoForm: videoContext.form, creators, tags: getFeedCardTags(card) };
  }
  if (isPostCard(card)) {
    return {
      videoForm: "post",
      creators: getFeedCardCreators(card),
      tags: getFeedCardTags(card)
    };
  }
  const href = getFeedCardHref(card, "youtube");
  if (!href) return null;
  let url;
  try { url = new URL(href, location.origin); } catch { return null; }
  const videoContext = detectVideoSiteContext(normalizeHostname(url.hostname), url.pathname);
  return {
    videoForm: videoContext.form,
    creators: getFeedCardCreators(card),
    tags: getFeedCardTags(card)
  };
}

// The ONE content-tag decision (feed cards and the page's own entry both use
// it). An entry matches when its tag — and every `also` tag (AND) — is present
// at/above the entry's confidence. The LIST matches when some normal entry
// matches and no carve-out (`except`) entry does.
//   include (block-list): block when the list matches.
//   exclude (allow-list): block unless the list matches.
// Content with no confident tag that the list did not decide is blocked only
// when the user opted in (blockUntagged) — in either mode.
function matchesTagFilter(tf, rawTags) {
  if (!tf) return false;
  const cardTags = Array.isArray(rawTags) ? rawTags : [];
  const def = Number.isFinite(tf.defaultConfidence) ? tf.defaultConfidence : 4;
  const list = Array.isArray(tf.tags) ? tf.tags : [];
  const has = (name, need) => cardTags.some(
    (t) => t && t.name === name && (Number(t.confidence) || 0) >= need
  );
  const entryMatches = (entry) => {
    if (!entry || typeof entry.name !== "string") return false;
    const need = Number.isFinite(entry.confidence) ? entry.confidence : def;
    if (!has(entry.name, need)) return false;
    return (Array.isArray(entry.also) ? entry.also : []).every((name) => has(name, need));
  };
  const listMatch = list.some((entry) => entry && !entry.except && entryMatches(entry))
    && !list.some((entry) => entry && entry.except && entryMatches(entry));
  if (tf.mode !== "include" && tf.mode !== "exclude") return false;
  if (listMatch) return tf.mode === "include";
  const hasConfidentTag = cardTags.some((t) => (Number(t && t.confidence) || 0) >= def);
  if (!hasConfidentTag) return Boolean(tf.blockUntagged);
  return tf.mode === "exclude";
}

function matchesFeedFilter(cardData, filter) {
  if (!cardData || !filter) return false;
  // Content-tag filter (from platform rules). Matches on the card's classifier
  // tags. "include" blocks a card that carries a listed tag at/above its
  // confidence; "exclude" blocks a card that does NOT (an allowlist), with a
  // toggle for whether untagged/low-confidence cards are blocked too.
  if (filter.tagFilter) {
    // No answer from the classifier yet (or no tag pipeline here) is NOT
    // "untagged": a tag filter only ever decides on a settled result.
    if (cardData.tags && cardData.tags.settled === false) return false;
    return matchesTagFilter(filter.tagFilter, cardData.tags);
  }
  if (filter.videoMode === "short" || filter.videoMode === "long" || filter.videoMode === "post") {
    if (cardData.videoForm !== filter.videoMode) return false;
  }
  if (filter.authorMode === "all") return true;
  // "nobody" never trims by author (and isn't emitted as a filter).
  if (filter.authorMode !== "include" && filter.authorMode !== "exclude") return false;
  const authors = Array.isArray(filter.authors) ? filter.authors : [];
  if (authors.length === 0) return false;
  const hasAuthorMatch = authors.some((author) => cardData.creators.includes(author));
  return filter.authorMode === "include" ? hasAuthorMatch : !hasAuthorMatch;
}

function restoreHiddenFeedCards() {
  for (const card of document.querySelectorAll('[data-custom-blocker-feed-hidden="true"]')) {
    if (card.dataset.customBlockerFeedPrevDisplay !== undefined) {
      card.style.display = card.dataset.customBlockerFeedPrevDisplay;
      delete card.dataset.customBlockerFeedPrevDisplay;
    } else {
      card.style.removeProperty("display");
    }
    card.removeAttribute("data-custom-blocker-feed-hidden");
    card.removeAttribute("aria-hidden");
  }
}

function hideElement(element) {
  if (!element || element.dataset.customBlockerFeedHidden === "true") return;
  element.dataset.customBlockerFeedHidden = "true";
  element.dataset.customBlockerFeedPrevDisplay = element.style.display || "";
  element.style.display = "none";
  element.setAttribute("aria-hidden", "true");
}

// Idempotent inverse of hideElement for a single card (used by the cascade
// applier, which decides each card independently rather than restoring the
// whole feed every pass).
function showElement(element) {
  if (!element || element.dataset.customBlockerFeedHidden !== "true") return;
  if (element.dataset.customBlockerFeedPrevDisplay !== undefined) {
    element.style.display = element.dataset.customBlockerFeedPrevDisplay;
    delete element.dataset.customBlockerFeedPrevDisplay;
  } else {
    element.style.removeProperty("display");
  }
  element.removeAttribute("data-custom-blocker-feed-hidden");
  element.removeAttribute("aria-hidden");
}

// Content-tag block = a "content blocked" state that is a LIVE function of the
// card's tags. The thumbnail is blacked out and its click-to-watch disabled,
// while title, author, tags and the Vault pill stay visible and interactive.
// There is no manual toggle — correcting the tag (via the pill) recomputes the
// block, so the blacked state clears instantly the moment the tag no longer
// qualifies (the tag pipeline re-applies the verdict on every tag change).

// The page's content-block profile (platform-profiles.js CONTENT_BLOCK_PROFILES).
function cbContentBlockProfile() {
  const id = typeof location !== "undefined" ? getPlatformGroupTypeForHost(normalizeHostname(location.hostname)) : null;
  return (id && CONTENT_BLOCK_PROFILES[id]) || null;
}

// Every media element the profile names inside `card`, top-most matches only
// (a player wraps its component; one panel covers both). A tweet may carry a
// photo AND a video side by side, and a grid several photos — each must be
// covered, or the block leaks through the ones after the first.
function cbFindMediaAll(card) {
  const profile = cbContentBlockProfile();
  if (!profile) return [];
  let nodes;
  try { nodes = [...card.querySelectorAll(profile.media)]; } catch { return []; }
  return nodes.filter((media) => !nodes.some((other) => other !== media && other.contains(media)));
}

// Vault pill hosts, registered by the tag pipeline. Kept in a private WeakSet
// (not a DOM marker — the host must stay unfingerprintable) so the interceptor
// can let the correction pill's clicks through.
const cbPillHosts = new WeakSet();
if (typeof window !== "undefined") window.cbRegisterPillHost = (el) => { if (el) cbPillHosts.add(el); };
function cbIsInPillHost(el) {
  for (let p = el; p; p = p.parentElement) if (cbPillHosts.has(p)) return true;
  return false;
}

// One capture-phase interceptor stops a blocked card's video link (/watch,
// /shorts/) and any black-panel click from navigating, across pointerdown/
// mousedown/click/auxclick (YouTube's lockup can navigate before `click`).
// Author/channel links, tags and the pill stay live.
let cbClickInterceptorInstalled = false;
function cbBlockNavEvent(e) {
  const t = e.target;
  if (!t || typeof t.closest !== "function") return;
  const card = t.closest('[data-cb-content-blocked="true"]');
  if (!card || cbIsInPillHost(t)) return;
  const inPanel = !!t.closest(".cb-block-panel");
  const link = t.closest("a[href]");
  const href = link ? (link.getAttribute("href") || "") : "";
  const profile = cbContentBlockProfile();
  if (inPanel || (profile && profile.links.test(href))) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
  }
}
function cbInstallClickInterceptor() {
  if (cbClickInterceptorInstalled || typeof document === "undefined") return;
  cbClickInterceptorInstalled = true;
  for (const type of ["pointerdown", "mousedown", "click", "auxclick"]) {
    document.addEventListener(type, cbBlockNavEvent, true);
  }
}

function cbEnsureRelative(el) {
  if (!el) return;
  if (el.dataset.cbPrevPos === undefined) el.dataset.cbPrevPos = el.style.position || "";
  try { if (getComputedStyle(el).position === "static") el.style.position = "relative"; } catch {}
}

// One opaque panel over a media element (idempotent).
function cbCoverMedia(media, zIndex) {
  cbEnsureRelative(media);
  if (media.querySelector(":scope > .cb-block-panel")) return;
  const panel = document.createElement("div");
  panel.className = "cb-block-panel";
  panel.setAttribute("style", `position:absolute;inset:0;z-index:${zIndex};background:#000;`);
  media.appendChild(panel);
}

function cbUncoverMedia(media) {
  media.querySelector(":scope > .cb-block-panel")?.remove();
  if (media.dataset && media.dataset.cbPrevPos !== undefined) {
    if (media.dataset.cbPrevPos) media.style.position = media.dataset.cbPrevPos;
    else media.style.removeProperty("position");
    delete media.dataset.cbPrevPos;
  }
}

// Black out a card's thumbnails (idempotent; re-renders if the host recycled a
// panel away). No controls — the block is driven purely by the tags.
function dimElement(card) {
  if (!card) return;
  const medias = cbFindMediaAll(card);
  if (medias.length === 0) return; // no thumbnail to black → skip, never black the whole card
  if (card.dataset.cbContentBlocked === "true"
      && medias.every((media) => media.querySelector(":scope > .cb-block-panel"))) return;
  card.dataset.cbContentBlocked = "true";
  cbInstallClickInterceptor();
  for (const media of medias) cbCoverMedia(media, 60);
}

// allow verdict (or the tag no longer qualifies) → restore the card instantly.
function undimElement(card) {
  if (!card || card.dataset.cbContentBlocked !== "true") return;
  const medias = cbFindMediaAll(card);
  for (const media of medias.length > 0 ? medias : [card]) cbUncoverMedia(media);
  delete card.dataset.cbContentBlocked;
}

// ────────────────────────────────────────────────────────────────────────
// Shared feed-hide engine (default / platform rules AND custom rules)
//
// Both rule kinds are just per-group verdicts over the same card, recorded
// into one per-card ledger tagged by source ("platform" | "custom"). The
// resolver picks the winner by group list order — the TOP-most group that has
// an opinion decides — so the outcome is independent of the sync-platform vs
// async-custom timing race.
//
//   • Order comes from the background ("feedOrder"): list position (index 0 =
//     top = highest priority). Normal groups only block; a custom rule's
//     allow() verdict is the one rescue that overrides a lower-priority block.
//   • Application is idempotent per card (hide/show only on change), so
//     repeated passes never churn the DOM.
// ────────────────────────────────────────────────────────────────────────

// card -> Map<groupId, { v: "hide"|"allow", src: "platform"|"custom" }>
const cbVerdictLedger = new WeakMap();
// Strong set of cards that currently carry any verdict, so we can do bulk
// "clear this source" sweeps (a WeakMap isn't iterable). Detached nodes are
// pruned on each sweep to avoid leaks.
const cbTrackedCards = new Set();
let cbGroupIndex = new Map(); // groupId -> order index (0 = highest priority)
let cbGroupOrderKey = "";

function cbSetGroupOrder(order) {
  const key = Array.isArray(order) ? order.map((g) => `${g && g.id}`).join("|") : "";
  const changed = key !== cbGroupOrderKey;
  cbGroupOrderKey = key;
  cbGroupIndex = new Map();
  if (Array.isArray(order)) {
    order.forEach((group, index) => {
      if (!group || typeof group.id !== "string") return;
      cbGroupIndex.set(group.id, index);
    });
  }
  // Verdicts resolve against the order when applied: re-apply the cards.
  if (changed) {
    for (const card of cbTrackedCards) if (card.isConnected) cbApplyCard(card);
  }
}

// Record (verdict) or clear (null) one group's opinion of a card.
function cbSetCardVerdict(card, groupId, verdict, source) {
  if (!card || !groupId) return;
  let entry = cbVerdictLedger.get(card);
  if (verdict) {
    if (!entry) { entry = new Map(); cbVerdictLedger.set(card, entry); }
    entry.set(groupId, { v: verdict, src: source || "platform" });
    cbTrackedCards.add(card);
  } else if (entry) {
    entry.delete(groupId);
  }
}

// Drop every verdict contributed by one source for a card.
function cbClearSource(card, source) {
  const entry = cbVerdictLedger.get(card);
  if (!entry) return;
  for (const [groupId, value] of entry) {
    if (value.src === source) entry.delete(groupId);
  }
}

// Bulk-clear a source across all tracked cards (e.g. when a custom rule stops
// applying) and re-resolve them. Also prunes detached cards.
function cbClearSourceEverywhere(source) {
  for (const card of [...cbTrackedCards]) {
    if (!card.isConnected) { cbTrackedCards.delete(card); continue; }
    cbClearSource(card, source);
    cbApplyCard(card);
  }
}

// Resolve from the ordered ledger, walking from the top of the list (owner
// 2026-09-26): blocks add up — a card one group hides and another dims is
// hidden (hiding a dimmed card is no conflict) — until a custom rule's
// allow(), which rescues the card from every group below it.
// Returns "hide" | "dim" | "show".
function cbResolveCardVerdict(card) {
  const entry = cbVerdictLedger.get(card);
  if (!entry || entry.size === 0) return "show";
  // Platform verdicts are keyed by feed-filter id (`<group id>␟<line id>`);
  // priority is the group's, so resolve the group part.
  const opinions = [...entry].map(([filterId, value]) => {
    const groupId = filterId.split("␟")[0];
    return { index: cbGroupIndex.has(groupId) ? cbGroupIndex.get(groupId) : Number.MAX_SAFE_INTEGER, v: value.v };
  }).sort((left, right) => left.index - right.index);
  let dim = false;
  for (const { v } of opinions) {
    if (v === "allow") break;
    if (v === "hide") return "hide";
    if (v === "dim") dim = true;
  }
  return dim ? "dim" : "show";
}

function cbApplyCard(card) {
  const verdict = cbResolveCardVerdict(card);
  if (verdict === "hide") {
    undimElement(card);
    hideElement(card);
  } else if (verdict === "dim") {
    showElement(card);
    dimElement(card);
  } else {
    undimElement(card);
    showElement(card);
  }
}

// ── Content-tag PAGE verdict ───────────────────────────────────────────────
// Content-block policy lives HERE, in the extension: the classifier only tags.
// A platform group's content-tag filter may also cover a matching video's OWN
// page (`pageEffect: "block"`, see background.js pushTagFilterEntry); the page
// entry's tags are matched by the very same matchesFeedFilter as feed cards. "block"
// blacks out the PLAYER in place (opaque panel, video kept paused) and leaves
// title, author and the Vault pill live, so correcting the tag lifts it
// instantly — the same live-function-of-tags rule as feed cards. It never
// exits or redirects. Only the entry that IS this page may block it: its video
// id must match the location, so a stale watch-root observation from a previous
// SPA navigation can never black out the page the user moved on to.
const CB_PAGE_BLOCK_RETRY_MS = 300;
const CB_PAGE_BLOCK_RETRIES = 10;
let cbTagPageBlockedEntry = "";
let cbTagPageRetryTimer = null;

function cbTagPageEntryMatchesLocation(entryID, loc) {
  if (typeof entryID !== "string" || !loc) return false;
  const id = entryID.slice(entryID.lastIndexOf(":") + 1);
  if (!id) return false;
  try {
    const params = new URLSearchParams(String(loc.search || ""));
    if (params.get("v") === id) return true;
  } catch {}
  const pathname = String(loc.pathname || "");
  return pathname.endsWith("/" + id) || pathname.includes("/" + id + "/");
}

// The page's main content per platform: a document-level player (YouTube,
// Bilibili) or the observed post's own media/body (Reddit).
// Every player/media element the profile names for the page, top-most matches
// only — a post page can show a photo beside a video; all of them are covered.
function cbFindPagePlayers(root) {
  const profile = cbContentBlockProfile();
  if (!profile) return [];
  const scope = profile.pageScope === "root" ? root : document;
  if (!scope || typeof scope.querySelectorAll !== "function") return [];
  let nodes;
  try { nodes = [...scope.querySelectorAll(profile.page)]; } catch { return []; }
  return nodes.filter((player) => !nodes.some((other) => other !== player && other.contains(player)));
}

// While the page is blocked, any attempt to play (autoplay, the keyboard
// shortcut, a stray click) is paused right back.
function cbKeepPausedWhileBlocked(event) {
  const video = event && event.target;
  if (!cbTagPageBlockedEntry || !video || typeof video.pause !== "function") return;
  try { video.pause(); } catch {}
}

function cbBlackOutPagePlayer(root) {
  const players = cbFindPagePlayers(root);
  if (players.length === 0) return false;
  for (const player of players) {
    cbCoverMedia(player, 2147483000);
    for (const video of player.querySelectorAll("video")) {
      try { video.pause(); } catch {}
      video.addEventListener("play", cbKeepPausedWhileBlocked, true);
      video.addEventListener("playing", cbKeepPausedWhileBlocked, true);
    }
  }
  if (root && root.dataset) root.dataset.cbContentBlocked = "true";
  return true;
}

function cbClearPagePlayer(root) {
  for (const player of cbFindPagePlayers(root)) {
    cbUncoverMedia(player);
    for (const video of player.querySelectorAll("video")) {
      video.removeEventListener("play", cbKeepPausedWhileBlocked, true);
      video.removeEventListener("playing", cbKeepPausedWhileBlocked, true);
    }
  }
  if (root && root.dataset) delete root.dataset.cbContentBlocked;
}

// root = the page's observed root (the watch metadata element the pill hangs
// off); it carries data-cb-content-blocked so the tag UI can see the state.
function cbApplyTagPagePolicy(root, pageAction, meta) {
  if (typeof location === "undefined") return false;
  const entryID = meta && typeof meta.entryID === "string" ? meta.entryID : "";
  if (cbTagPageRetryTimer) { clearTimeout(cbTagPageRetryTimer); cbTagPageRetryTimer = null; }
  if (pageAction !== "block") {
    // allow / dim / provisional: lift a blackout for this entry, or one left
    // behind by a page the user has since navigated away from.
    if (cbTagPageBlockedEntry
      && (cbTagPageBlockedEntry === entryID || !cbTagPageEntryMatchesLocation(cbTagPageBlockedEntry, location))) {
      cbTagPageBlockedEntry = "";
      cbClearPagePlayer(root);
    }
    return false;
  }
  if (!cbTagPageEntryMatchesLocation(entryID, location)) return false;
  cbTagPageBlockedEntry = entryID;
  if (cbBlackOutPagePlayer(root)) return true;
  // The SPA may not have rendered the player yet — retry briefly.
  let attempts = 0;
  const retry = () => {
    cbTagPageRetryTimer = null;
    if (cbTagPageBlockedEntry !== entryID || !cbTagPageEntryMatchesLocation(entryID, location)) return;
    if (cbBlackOutPagePlayer(root) || ++attempts >= CB_PAGE_BLOCK_RETRIES) return;
    cbTagPageRetryTimer = setTimeout(retry, CB_PAGE_BLOCK_RETRY_MS);
  };
  cbTagPageRetryTimer = setTimeout(retry, CB_PAGE_BLOCK_RETRY_MS);
  return true;
}

// The page's own entry, as last reported by the tag pipeline. Kept so a change
// to the filters (group edited, count-down elapsed, snooze) re-decides the page
// without waiting for another tag event.
let cbTagPageContext = null;

function cbTagPageVerdict(tags) {
  for (const filter of latestFeedFilters) {
    if (!filter || !filter.tagFilter || filter.pageEffect !== "block") continue;
    if (filter.enforce === false) continue; // count-down group still within its allowance
    if (matchesFeedFilter({ tags }, filter)) return "block";
  }
  return "allow";
}

// Decide + apply the page verdict for the page's own entry. Called by the tag
// pipeline whenever that entry's tags settle or change (meta.settled === false
// while it is still "Tagging…": never block on a provisional state), and again
// by applySessionFilters. `meta === null` forgets the page (its root went away).
function cbEvaluateTagPage(root, meta) {
  if (!root || !meta) {
    if (cbTagPageContext && (!root || cbTagPageContext.root === root)) {
      cbApplyTagPagePolicy(cbTagPageContext.root, "allow", cbTagPageContext);
      cbTagPageContext = null;
    }
    return "allow";
  }
  cbTagPageContext = { root, entryID: meta.entryID, platform: meta.platform, settled: meta.settled !== false };
  // While still "Tagging…", cover the page only when the user opted in
  // (cover-until-tagged); otherwise let it play until the tags arrive.
  const pending = cbPageCoversUntilTagged(meta.platform) ? "block" : "allow";
  const action = cbTagPageContext.settled ? cbTagPageVerdict(getFeedCardTags(root)) : pending;
  cbApplyTagPagePolicy(root, action, cbTagPageContext);
  return action;
}

// True when an active page-blocking tag filter for this platform opted into
// covering the watch page while it is still being tagged.
function cbPageCoversUntilTagged(platform) {
  return latestFeedFilters.some((filter) =>
    filter && filter.tagFilter && filter.pageEffect === "block" && filter.enforce !== false
    && filter.tagCoverUntilTagged && (!platform || !filter.site || filter.site === platform));
}

// Tags changed for something on this page (resolved, pushed, or corrected):
// re-run the tag filters now rather than waiting for a DOM mutation — the pill
// may render inside a shadow root the feed observer cannot see.
function cbReapplyTagFilters() {
  cbScheduleRuleItems();
  if (latestFeedFilters.length > 0) scheduleApplyFeedFilters();
  if (cbTagPageContext) cbEvaluateTagPage(cbTagPageContext.root, cbTagPageContext);
}
if (typeof window !== "undefined") {
  window.cbEvaluateTagPage = cbEvaluateTagPage;
  window.cbReapplyTagFilters = cbReapplyTagFilters;
}

function collectNavElementsToHide(filter) {
  if (!filter || filter.authorMode !== "all") return [];
  const containers = new Set();
  let anchorSelectors = [];
  const containerSelectors = [
    "ytd-guide-entry-renderer",
    "ytd-mini-guide-entry-renderer",
    "ytd-pivot-bar-item-renderer",
    "tp-yt-paper-tab",
    "yt-tab-shape"
  ].join(", ");

  if (filter.videoMode === "post") {
    anchorSelectors = [
      'a[href$="/community"]',
      'a[href$="/posts"]',
      'a[href*="/community?"]',
      'a[href*="/posts?"]'
    ];
  } else {
    return [];
  }

  for (const anchor of document.querySelectorAll(anchorSelectors.join(", "))) {
    const container = anchor.closest(containerSelectors);
    if (container) containers.add(container);
  }
  return [...containers];
}

function collectFormShelvesToHide(filter) {
  if (!filter || filter.authorMode !== "all") return [];
  let shelfSelectors = [];
  // Shorts: the one list, the profile's Shorts surface (nav, shelves, cards).
  if (filter.videoMode === "short") {
    shelfSelectors = getSurfaceHideEntries("youtube").find((entry) => entry.id === "shorts-button")?.selectors || [];
  } else if (filter.videoMode === "post") {
    shelfSelectors = [
      "ytd-rich-section-renderer:has(ytd-post-renderer)",
      "ytd-rich-section-renderer:has(ytd-backstage-post-thread-renderer)",
      "ytd-rich-section-renderer:has(ytd-backstage-post-renderer)",
      "ytd-shelf-renderer:has(ytd-post-renderer)",
      "ytd-shelf-renderer:has(ytd-backstage-post-thread-renderer)",
      "ytd-shelf-renderer:has(ytd-backstage-post-renderer)",
      "ytd-item-section-renderer:has(ytd-post-renderer)",
      "ytd-item-section-renderer:has(ytd-backstage-post-thread-renderer)",
      "ytd-item-section-renderer:has(ytd-backstage-post-renderer)",
      "ytd-horizontal-card-list-renderer:has(ytd-post-renderer)",
      "ytd-horizontal-card-list-renderer:has(ytd-backstage-post-thread-renderer)"
    ];
  } else {
    return [];
  }
  // Each selector alone: one an engine rejects doesn't drop the others.
  const shelves = [];
  for (const selector of shelfSelectors) {
    try { shelves.push(...document.querySelectorAll(selector)); } catch {}
  }
  return shelves;
}

// The platform/default half of the shared cascade. It records each active
// filter's verdict (block→"hide", allow→"allow") into the ledger as the
// "platform" source, then re-resolves each card. It never restores the whole
// feed — that would clobber the "custom" verdicts an in-flight async scan is
// about to apply (the sync/async race). Nav/shelf chrome is hidden through the
// surface-hide marker so it stays out of the per-card cascade.
function applyFeedFilters() {
  feedApplyRafId = null;
  // Cards the page removed (a virtualised feed drops them) are forgotten.
  for (const card of cbTrackedCards) if (!card.isConnected) cbTrackedCards.delete(card);
  applySurfaceHides();
  applyNavShelfHides();

  const currentSite = getCurrentFeedSite();
  const activeFilters = currentSite
    ? latestFeedFilters.filter((filter) => filter?.site === currentSite)
    : [];

  // Candidates = live feed cards plus anything we previously hid, so cards stop
  // being hidden when their filter is removed even if they aren't re-listed.
  const candidates = new Set();
  if (currentSite) for (const card of getFeedCardElements(currentSite)) candidates.add(card);
  for (const card of document.querySelectorAll('[data-custom-blocker-feed-hidden="true"]')) {
    candidates.add(card);
  }

  const exposed = new Set();
  for (const card of candidates) {
    // Re-derive this card's platform verdicts from scratch; custom verdicts on
    // the same card are left untouched.
    cbClearSource(card, "platform");
    if (activeFilters.length > 0) {
      const cardData = getFeedCardData(card);
      if (cardData) {
        for (const filter of activeFilters) {
          // Cover-until-tagged (opt-in): a taggable card whose tags have not
          // settled yet is blacked out (dim) rather than left visible, so nothing
          // flashes before it can be judged. When the tags settle a later pass
          // re-decides — a match stays covered, a non-match is revealed. A card
          // still being tagged is no exposure yet (it may not match).
          if (filter.tagFilter && filter.tagCoverUntilTagged
              && cardData.tags && cardData.tags.settled === false) {
            if (filter.enforce !== false) cbSetCardVerdict(card, filter.id, "dim", "platform");
            continue;
          }
          if (!matchesFeedFilter(cardData, filter)) continue;
          // Exposure: a match means the group's usage timer should accrue,
          // regardless of whether we hide the card right now. A tag filter is a
          // synthetic sibling of its group, so credit the real group id.
          exposed.add(filter.baseGroupId || filter.id);
          // Tag filters carry their own effect (dim = blackout, hide = remove);
          // author/video filters hide. Filters only act while enforcing
          // (instant, or a count-down past its allowance).
          const verdict = filter.effectVerdict || "hide";
          if (filter.enforce !== false) {
            cbSetCardVerdict(card, filter.id, verdict, "platform");
          }
        }
      }
    }
    cbApplyCard(card);
  }

  latestExposedGroupIds = [...exposed];

  if (cbDebugMode) {
    // Debug mode only: one line per pass so a blackout that "does nothing" can
    // be traced to its stage (no filter, no cards, tags not settled, no match).
    let settled = 0; let dim = 0; let hide = 0;
    for (const card of candidates) {
      const tags = getFeedCardTags(card);
      if (tags.settled) settled += 1;
      const verdict = cbResolveCardVerdict(card);
      if (verdict === "dim") dim += 1; else if (verdict === "hide") hide += 1;
    }
    cbDebugLog("[CustomBlocker:feed] pass", { site: currentSite, filters: activeFilters.length, cards: candidates.size, settled, dim, hide });
  }

  // Refill what enforcement removed (only when the feed is too short to scroll).
  __cb_maybeReplenishFeed(currentSite);
}

// Nav buttons / shelves (e.g. the Shorts shelf) are page chrome, not feed
// cards, so they're hidden via the surface-hide marker (restored each pass by
// applySurfaceHides) rather than entering the per-card cascade.
function applyNavShelfHides() {
  const currentSite = getCurrentFeedSite();
  if (currentSite !== "youtube") return;
  for (const filter of latestFeedFilters) {
    if (filter?.site !== "youtube") continue;
    if (filter.tagFilter) continue; // content-tag filters act on cards, not chrome
    if (filter.enforce === false) continue;
    for (const navElement of collectNavElementsToHide(filter)) hideSurfaceElement(navElement);
    for (const shelfElement of collectFormShelvesToHide(filter)) hideSurfaceElement(shelfElement);
  }
}

function scheduleApplyFeedFilters() {
  if (feedApplyRafId !== null) return;
  feedApplyRafId = window.requestAnimationFrame(() => applyFeedFilters());
}

// The last feed order / filters / surface hides applied (see handleSession).
// Surface hides ("hide elements" toggles) are plain CSS-selector hides; they
// share the page MutationObserver with the feed filters but use a separate
// hidden marker so each can restore independently.
let cbSessionFilterKey = "";
function applySessionFilters(order, filters, surfaceHides) {
  const key = JSON.stringify([order, filters, surfaceHides]);
  if (key === cbSessionFilterKey) return;
  cbSessionFilterKey = key;
  cbSetGroupOrder(order);
  latestFeedFilters = Array.isArray(filters) ? filters : [];
  latestSurfaceHides = Array.isArray(surfaceHides) ? surfaceHides.filter(Boolean) : [];
  reconcilePageMutations();
  if (cbTagPageContext) cbEvaluateTagPage(cbTagPageContext.root, cbTagPageContext);
}

function reconcilePageMutations() {
  if (latestFeedFilters.length === 0 && latestSurfaceHides.length === 0) {
    stopFeedObserver();
    // Only drop platform verdicts; a custom rule may still be hiding cards
    // through the shared cascade and runs on its own observer.
    cbClearSourceEverywhere("platform");
    restoreSurfaceHidden();
    return;
  }
  ensureFeedObserver();
  scheduleApplyFeedFilters();
}

function applySurfaceHides() {
  restoreSurfaceHidden();
  if (latestSurfaceHides.length === 0) return;
  // Query each selector independently so one unsupported/invalid selector (e.g.
  // a `:has()` variant an older engine rejects) can't throw away every other
  // hide — previously a single bad selector left ALL widgets visible.
  for (const selector of latestSurfaceHides) {
    const surfaceCardSite = parseSurfaceFeedCardsDirective(selector);
    if (surfaceCardSite) {
      for (const card of getFeedCardElements(surfaceCardSite)) hideSurfaceElement(card);
      continue;
    }
    let nodes = [];
    try { nodes = document.querySelectorAll(selector); } catch { continue; }
    for (const el of nodes) hideSurfaceElement(el);
  }
}

function hideSurfaceElement(el) {
  if (!el || el.dataset.cbSurfaceHidden === "1") return;
  el.dataset.cbSurfaceHidden = "1";
  el.dataset.cbSurfacePrevDisplay = el.style.display || "";
  el.style.display = "none";
}

function restoreSurfaceHidden() {
  for (const el of document.querySelectorAll('[data-cb-surface-hidden="1"]')) {
    if (el.dataset.cbSurfacePrevDisplay !== undefined) {
      el.style.display = el.dataset.cbSurfacePrevDisplay;
      delete el.dataset.cbSurfacePrevDisplay;
    } else {
      el.style.removeProperty("display");
    }
    el.removeAttribute("data-cb-surface-hidden");
  }
}

function ensureFeedObserver() {
  if (latestFeedFilters.length === 0 && latestSurfaceHides.length === 0) {
    stopFeedObserver();
    cbClearSourceEverywhere("platform");
    restoreSurfaceHidden();
    return;
  }
  if (feedObserver) return;
  feedObserver = new MutationObserver(() => scheduleApplyFeedFilters());
  const root = document.body || document.documentElement;
  if (!root) return;
  feedObserver.observe(root, { childList: true, subtree: true });
}

function stopFeedObserver() {
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }
  if (feedApplyRafId !== null) {
    window.cancelAnimationFrame(feedApplyRafId);
    feedApplyRafId = null;
  }
}

function collectYouTubeCreatorIdentifiers() {
  const identifiers = new Set();
  const isShortPage = String(location.pathname || "").startsWith("/shorts/");
  const pathIdentifier = normalizeYouTubeCreatorInput(location.pathname);
  if (pathIdentifier) identifiers.add(pathIdentifier);

  const selectors = isShortPage
    ? [
        'ytd-reel-video-renderer[is-active] ytd-channel-name a[href]',
        'ytd-reel-video-renderer[is-active] a[href^="/@"]',
        'ytd-reel-video-renderer[is-active] a[href^="/channel/"]',
        'ytd-reel-player-header-renderer ytd-channel-name a[href]',
        'ytd-reel-player-overlay-renderer ytd-channel-name a[href]',
        'ytd-reel-player-header-renderer a[href^="/@"]',
        'ytd-reel-player-overlay-renderer a[href^="/@"]'
      ]
    : [
        // Primary uploader.
        'ytd-watch-metadata ytd-channel-name a[href]',
        '#upload-info a[href]',
        'ytd-watch-metadata a[href^="/@"]',
        'ytd-watch-flexy ytd-channel-name a[href]',
        // Collaborators / additional creators credited in the owner byline.
        // Scoped to the owner area (not #description or the #related sidebar)
        // so every credited channel on a multi-creator video is captured.
        'ytd-watch-metadata #owner a[href^="/@"]',
        'ytd-watch-metadata #owner a[href^="/channel/"]',
        'ytd-watch-metadata a[href^="/channel/"]',
        '#owner ytd-channel-name a[href]',
        'ytd-video-owner-renderer a[href^="/@"]',
        'ytd-video-owner-renderer a[href^="/channel/"]',
        'yt-video-attribute-view-model a[href^="/@"]',
        'yt-video-attribute-view-model a[href^="/channel/"]',
        'link[rel="canonical"]'
      ];

  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const href = element.getAttribute("href") || element.getAttribute("content");
      const identifier = extractCreatorFromHref(href);
      if (identifier) identifiers.add(identifier);
    }
  }
  return [...identifiers];
}

// extractPrimaryAuthorFromPath now lives in platform-profiles.js (it takes a
// 3rd `url` arg for Facebook profile.php id extraction).

function collectPlatformAuthors(pathname, isYouTubePage) {
  const map = { youtube: [], tiktok: [], facebook: [], instagram: [], twitch: [], twitter: [], reddit: [] };
  if (isYouTubePage) map.youtube = collectYouTubeCreatorIdentifiers();
  for (const groupType of ["youtube", "tiktok", "facebook", "instagram", "twitch", "twitter", "reddit"]) {
    const fromPath = extractPrimaryAuthorFromPath(groupType, pathname, location.href);
    if (fromPath && !map[groupType].includes(fromPath)) map[groupType].push(fromPath);
  }
  return map;
}

// What the worker can't read from the address: the page's own authors (a
// YouTube watch page's owner byline).
function buildPageContext() {
  const hostname = normalizeHostname(location.hostname);
  return {
    hostname,
    url: location.href,
    pathname: location.pathname,
    platformAuthors: collectPlatformAuthors(location.pathname, isYouTubeHost(hostname))
  };
}

function updateOverlay(items, showTimer) {
  const visibleItems = (items || []).filter((item) =>
    Number.isFinite(item.displayMs ?? item.remainingMs ?? item.currentMs)
  );
  if (!showTimer || visibleItems.length === 0) {
    removeOverlay();
    return;
  }
  const nextOverlay = ensureOverlay();
  const anyStyled = visibleItems.some((item) => item.overlayStyle && typeof item.overlayStyle === "object");
  if (!anyStyled) {
    // Fast path: no per-timer styling — keep the single-textContent box.
    nextOverlay.container.textContent = visibleItems
      .map((item) => {
        const value = item.displayMs ?? item.remainingMs ?? item.currentMs ?? 0;
        return `${item.name}: ${formatOverlayDurationMs(value)}`;
      })
      .join("\n");
    return;
  }
  // At least one timer opted into overlayStyle: render each as its own
  // line element so styles apply independently.
  nextOverlay.container.textContent = "";
  for (const item of visibleItems) {
    const value = item.displayMs ?? item.remainingMs ?? item.currentMs ?? 0;
    const line = document.createElement("div");
    line.textContent = `${item.name}: ${formatOverlayDurationMs(value)}`;
    applyOverlayLineStyle(line, item.overlayStyle);
    nextOverlay.container.appendChild(line);
  }
}

function applyOverlayLineStyle(el, style) {
  if (!style || typeof style !== "object") return;
  const map = {
    color: "color",
    background: "background",
    fontSize: "fontSize",
    fontWeight: "fontWeight",
    border: "border",
    borderRadius: "borderRadius",
    padding: "padding",
    opacity: "opacity"
  };
  for (const key of Object.keys(map)) {
    const v = style[key];
    if (typeof v === "string" && v) {
      try { el.style[map[key]] = v; } catch {}
    }
  }
  if (typeof style.icon === "string" && style.icon) {
    el.textContent = `${style.icon} ${el.textContent}`;
  }
}

// ── The cover ───────────────────────────────────────────────────────────────
// A blocked page is covered IN PLACE (owner 2026-09-25): a modal <dialog> in
// the browser's top layer, the page underneath left untouched (scroll, forms,
// app state), its media paused and the tab muted by the worker. When the block
// lifts the cover comes off and everything is as it was. Nothing is
// remembered or restored because nothing is lost. The same cover carries the
// pause countdown (intention gate) and the snooze button.
const CB_COVER_ID = "cb-vault-cover";
const CB_SNOOZE_CONFIRM_INTERVAL_MS = 5000;

const cbCover = {
  dialog: null,
  exit: null,
  countdownId: null,
  confirmId: null,
  inerted: [],
  prevOverflow: null,
  watcher: null,
  mediaListener: null,
  countdownLeft: 0,
  confirmationsLeft: 0,
  nextConfirmAt: 0,
  statusText: "",
  // Two owners: the worker's block of this page (its exit) and a custom rule's
  // v.cover ({ groupId, message } or null). The cover stays while either holds
  // and shows the worker's (Snooze, Continue) when both do.
  workerExit: null,
  ruleCover: null
};

const CB_RULE_EXIT = Object.freeze({ action: "cover", target: "", message: "", groupId: "", groupName: "", allowSnooze: false, source: "custom" });

function cbSyncCover() {
  const rule = cbCover.ruleCover;
  const exit = cbCover.workerExit || (rule ? { ...CB_RULE_EXIT, groupId: rule.groupId, message: rule.message } : null);
  if (exit) cbShowCover(exit);
  else cbHideCover();
}

// Every <video>/<audio> in the document, shadow roots included.
function cbAllMedia(root = document, out = []) {
  let nodes = [];
  try { nodes = root.querySelectorAll("video, audio, *"); } catch { return out; }
  for (const node of nodes) {
    if (node.tagName === "VIDEO" || node.tagName === "AUDIO") out.push(node);
    if (node.shadowRoot) cbAllMedia(node.shadowRoot, out);
  }
  return out;
}

function cbPauseAllMedia() {
  for (const media of cbAllMedia()) {
    try { if (!media.paused) media.pause(); } catch {}
  }
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
  try { if (document.pictureInPictureElement) document.exitPictureInPicture(); } catch {}
}

function cbCoverIsUp() {
  return Boolean(cbCover.dialog && cbCover.dialog.isConnected && cbCover.exit);
}

function cbCoverStyle() {
  return `
    #${CB_COVER_ID} { position: fixed; inset: 0; width: 100vw; height: 100vh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0;
      background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); color: #f8fafc; font-family: Arial, Helvetica, sans-serif; z-index: 2147483647; }
    #${CB_COVER_ID}::backdrop { background: #0f172a; }
    #${CB_COVER_ID} .cb-shell { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 32px; box-sizing: border-box; text-align: center; }
    #${CB_COVER_ID} .cb-logo { width: 96px; height: 96px; border-radius: 24px; box-shadow: 0 18px 40px rgba(15, 23, 42, 0.42); background: rgba(255, 255, 255, 0.05); }
    #${CB_COVER_ID} .cb-title { font-size: clamp(28px, 5vw, 56px); font-weight: 700; line-height: 1.2; max-width: min(900px, 90vw); white-space: pre-wrap; word-break: break-word; margin: 0; }
    #${CB_COVER_ID} .cb-sub { margin: 0; font-size: 16px; color: rgba(248, 250, 252, 0.72); }
    #${CB_COVER_ID} .cb-countdown { font-size: clamp(40px, 8vw, 88px); font-weight: 700; font-variant-numeric: tabular-nums; margin: 0; }
    #${CB_COVER_ID} button { font: inherit; font-size: 15px; font-weight: 600; padding: 10px 22px; border-radius: 10px; border: 0; cursor: pointer; }
    #${CB_COVER_ID} button:disabled { opacity: 0.45; cursor: default; }
    #${CB_COVER_ID} .cb-continue { background: #f8fafc; color: #0f172a; }
    #${CB_COVER_ID} .cb-snooze-panel { background: #fdf2f8; color: #334155; border-radius: 16px; padding: 16px 20px; display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: min(360px, 90vw); box-shadow: inset 4px 0 0 #be185d; }
    #${CB_COVER_ID} .cb-snooze-panel h3 { margin: 0; font-size: 15px; color: #6b3350; }
    #${CB_COVER_ID} .cb-snooze-button { background: #be185d; color: #ffffff; }
    #${CB_COVER_ID} .cb-snooze-button:hover:not(:disabled) { background: #9d174d; }
    #${CB_COVER_ID} .cb-status { margin: 0; font-size: 13px; color: #6b3350; min-height: 1.2em; }
    #${CB_COVER_ID} .cb-foot { margin: 0; color: rgba(248, 250, 252, 0.6); font-size: 13px; letter-spacing: 1px; text-transform: uppercase; }
  `;
}

function cbCoverElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function cbShowCover(exit) {
  if (!exit || !document.documentElement) return;
  const first = !cbCoverIsUp();
  const previous = cbCover.exit;
  cbCover.exit = exit;
  if (first) {
    const dialog = document.createElement("dialog");
    dialog.id = CB_COVER_ID;
    const style = document.createElement("style");
    style.textContent = cbCoverStyle();
    dialog.appendChild(style);
    dialog.appendChild(cbCoverElement("div", "cb-shell"));
    dialog.addEventListener("cancel", (event) => event.preventDefault());
    dialog.addEventListener("close", () => { if (cbCover.exit) cbReopenCover(); });
    cbCover.dialog = dialog;
    document.documentElement.appendChild(dialog);
    try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); }
    // The page underneath: no clicks, no keys, no scrolling — but untouched.
    cbCover.inerted = [];
    for (const el of Array.from(document.body ? document.body.children : [])) {
      if (el === dialog || el.inert) continue;
      el.inert = true;
      cbCover.inerted.push(el);
    }
    cbCover.prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // Media stays paused while covered; nothing resumes on its own at lift.
    cbPauseAllMedia();
    cbCover.mediaListener = (event) => {
      const media = event.target;
      if (cbCover.exit && media && typeof media.pause === "function") { try { media.pause(); } catch {} }
    };
    document.addEventListener("play", cbCover.mediaListener, true);
    // The site cannot remove the cover: put it back if it goes.
    cbCover.watcher = new MutationObserver(() => { if (cbCover.exit && !cbCover.dialog.isConnected) cbReopenCover(); });
    cbCover.watcher.observe(document.documentElement, { childList: true });
    safeSendMessage({ type: "cover-state", covered: true });
    // Pause countdown and snooze confirmations start fresh.
    cbCover.countdownLeft = exit.action === "pause" ? Math.max(1, Number(exit.pauseSeconds) || 10) : 0;
    cbCover.confirmationsLeft = 0;
    cbCover.nextConfirmAt = 0;
    cbCover.statusText = "";
    if (cbCover.countdownLeft > 0) {
      cbCover.countdownId = window.setInterval(() => {
        cbCover.countdownLeft = Math.max(0, cbCover.countdownLeft - 1);
        cbRenderCover();
        if (cbCover.countdownLeft === 0 && cbCover.countdownId !== null) { window.clearInterval(cbCover.countdownId); cbCover.countdownId = null; }
      }, 1000);
    }
  } else if (previous && (previous.action !== exit.action || previous.groupId !== exit.groupId)) {
    // A different group or action took over: the countdown restarts, the
    // confirmation flow does not survive.
    cbCover.countdownLeft = exit.action === "pause" ? Math.max(1, Number(exit.pauseSeconds) || 10) : 0;
    cbCover.confirmationsLeft = 0;
  }
  cbRenderCover();
}

function cbReopenCover() {
  const dialog = cbCover.dialog;
  if (!dialog || !cbCover.exit) return;
  if (!dialog.isConnected) document.documentElement.appendChild(dialog);
  if (!dialog.open) { try { dialog.showModal(); } catch { dialog.setAttribute("open", ""); } }
}

function cbStopCoverTimers() {
  for (const id of ["countdownId", "confirmId"]) {
    if (cbCover[id] !== null) { window.clearInterval(cbCover[id]); cbCover[id] = null; }
  }
}

function cbHideCover() {
  if (!cbCover.dialog) return;
  cbCover.exit = null;
  cbStopCoverTimers();
  if (cbCover.watcher) { cbCover.watcher.disconnect(); cbCover.watcher = null; }
  if (cbCover.mediaListener) { document.removeEventListener("play", cbCover.mediaListener, true); cbCover.mediaListener = null; }
  for (const el of cbCover.inerted) { try { el.inert = false; } catch {} }
  cbCover.inerted = [];
  if (cbCover.prevOverflow !== null) { document.documentElement.style.overflow = cbCover.prevOverflow; cbCover.prevOverflow = null; }
  try { cbCover.dialog.close(); } catch {}
  cbCover.dialog.remove();
  cbCover.dialog = null;
  safeSendMessage({ type: "cover-state", covered: false });
}

function cbRenderCover() {
  const exit = cbCover.exit;
  const dialog = cbCover.dialog;
  if (!exit || !dialog) return;
  const shell = dialog.querySelector(".cb-shell");
  if (!shell) return;
  shell.textContent = "";
  const logo = cbCoverElement("img", "cb-logo");
  logo.alt = "";
  try { logo.src = chrome.runtime.getURL("icons/adamancia-vault-lock-v3-128.png"); } catch {}
  shell.appendChild(logo);
  const isPause = exit.action === "pause";
  const title = exit.message
    ? exit.message
    : isPause ? "Take a moment" : exit.groupName ? "Blocked by " + exit.groupName : "Blocked";
  shell.appendChild(cbCoverElement("h1", "cb-title", title));
  if (exit.message && exit.groupName) shell.appendChild(cbCoverElement("p", "cb-sub", (isPause ? "Paused by " : "Blocked by ") + exit.groupName));

  if (isPause) {
    if (cbCover.countdownLeft > 0) {
      shell.appendChild(cbCoverElement("p", "cb-countdown", String(cbCover.countdownLeft)));
    }
    const go = cbCoverElement("button", "cb-continue", cbCover.countdownLeft > 0 ? "Continue in " + cbCover.countdownLeft + "s" : "Continue");
    go.disabled = cbCover.countdownLeft > 0;
    go.addEventListener("click", () => {
      go.disabled = true;
      // Continue passes THIS group's pause; the page is then re-decided.
      safeSendMessage({ type: "pause-pass", groupId: exit.groupId }, () => refreshSession());
    });
    shell.appendChild(go);
  }

  if (exit.allowSnooze) {
    const panel = cbCoverElement("div", "cb-snooze-panel");
    panel.appendChild(cbCoverElement("h3", "", "Snooze"));
    const phase = exit.snoozePhase || "none";
    const button = cbCoverElement("button", "cb-snooze-button", "Start Snooze");
    let status = cbCover.statusText;
    if (phase === "pending") { button.disabled = true; status = status || "A snooze is scheduled and will start shortly."; }
    else if (phase === "cooldown") { button.disabled = true; status = status || "Snooze cooldown — try again in a moment."; }
    else if (cbCover.confirmationsLeft > 0) {
      const waitMs = cbCover.nextConfirmAt - Date.now();
      button.textContent = waitMs > 0
        ? "Confirm (" + cbCover.confirmationsLeft + " left, " + Math.ceil(waitMs / 1000) + "s)"
        : "Confirm (" + cbCover.confirmationsLeft + " left)";
      button.disabled = waitMs > 0;
    }
    button.addEventListener("click", () => cbCoverSnoozePress());
    panel.appendChild(button);
    panel.appendChild(cbCoverElement("p", "cb-status", status));
    shell.appendChild(panel);
  }
  shell.appendChild(cbCoverElement("p", "cb-foot", "Adamancia Vault"));
}

// The popup's snooze flow without its settings: the group's confirmation
// steps (spaced like the popup's), then the worker starts the same snooze
// entry and shares it with linked members.
function cbCoverSnoozePress() {
  const exit = cbCover.exit;
  if (!exit || !exit.allowSnooze) return;
  const needed = Math.max(0, Number(exit.snoozeConfirmations) || 0);
  if (cbCover.confirmationsLeft === 0 && needed > 0 && cbCover.nextConfirmAt === 0) {
    cbCover.confirmationsLeft = needed;
    cbCover.nextConfirmAt = Date.now() + CB_SNOOZE_CONFIRM_INTERVAL_MS;
    cbCover.statusText = "This snooze needs " + needed + " confirmation step(s), " + (CB_SNOOZE_CONFIRM_INTERVAL_MS / 1000) + " seconds apart.";
    if (cbCover.confirmId === null) cbCover.confirmId = window.setInterval(() => cbRenderCover(), 250);
    cbRenderCover();
    return;
  }
  if (cbCover.confirmationsLeft > 0) {
    if (Date.now() < cbCover.nextConfirmAt) return;
    cbCover.confirmationsLeft -= 1;
    cbCover.nextConfirmAt = Date.now() + CB_SNOOZE_CONFIRM_INTERVAL_MS;
    if (cbCover.confirmationsLeft > 0) { cbRenderCover(); return; }
  }
  if (cbCover.confirmId !== null) { window.clearInterval(cbCover.confirmId); cbCover.confirmId = null; }
  cbCover.nextConfirmAt = 0;
  cbCover.statusText = "Starting…";
  cbRenderCover();
  safeSendMessage({ type: "start-snooze", groupId: exit.groupId }, (response) => {
    if (!response || !response.ok) {
      cbCover.statusText = response && response.error ? "Snooze not started: " + response.error : "Snooze not started.";
      cbRenderCover();
      return;
    }
    const startsIn = Number(response.snooze && response.snooze.startsAtMs) - Date.now();
    cbCover.statusText = startsIn > 1000 ? "Snooze starts in " + Math.ceil(startsIn / 60000) + " min." : "";
    refreshSession();
  });
}

// ── The quick-add "+" ───────────────────────────────────────────────────────
// A tiny floating "+" at the bottom right (off by default; the user turns it
// on in Settings and chooses a target group by its badge). One click appends
// this page's site entry to that group; the worker does the append.
const CB_QUICK_ADD_ID = "cb-vault-quick-add";
let cbQuickAddButton = null;

function cbMountQuickAdd(target) {
  if (!target || !target.enabled) { cbUnmountQuickAdd(); return; }
  if (!document.documentElement || window.top !== window) return;
  if (!cbQuickAddButton) {
    const button = document.createElement("button");
    button.id = CB_QUICK_ADD_ID;
    button.type = "button";
    button.textContent = "+";
    button.setAttribute("style", "position:fixed;right:8px;bottom:8px;width:18px;height:18px;margin:0;padding:0;border:0;border-radius:50%;background:#0f172a;color:#f8fafc;font:700 14px/18px Arial,Helvetica,sans-serif;text-align:center;z-index:2147483646;opacity:0.55;cursor:pointer;box-shadow:0 2px 6px rgba(15,23,42,0.35);");
    button.addEventListener("mouseenter", () => { button.style.opacity = "1"; });
    button.addEventListener("mouseleave", () => { button.style.opacity = "0.55"; });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      safeSendMessage({ type: "quick-add" }, (response) => {
        button.disabled = false;
        button.textContent = response && response.ok ? "✓" : "!";
        window.setTimeout(() => { button.textContent = "+"; }, 1200);
        if (response && response.ok) refreshSession();
      });
    });
    cbQuickAddButton = button;
  }
  cbQuickAddButton.title = "Add this site to " + target.groupName;
  if (!cbQuickAddButton.isConnected) document.documentElement.appendChild(cbQuickAddButton);
}

function cbUnmountQuickAdd() {
  if (cbQuickAddButton) { cbQuickAddButton.remove(); cbQuickAddButton = null; }
}

function cbRefreshQuickAdd() {
  safeSendMessage({ type: "quick-add-state" }, (target) => cbMountQuickAdd(target));
}

// Apply the worker's exit decision for this page: leave for an address, or
// cover in place (block or pause). Custom rules' own redirect helper still
// navigates on its own.
function cbApplyExit(exit) {
  if (!exit) { cbCover.workerExit = null; cbSyncCover(); return; }
  if (exit.action === "navigate" && exit.target) {
    if (exitAttempted) return;
    exitAttempted = true;
    cbHideCover();
    if (overlay) overlay.container.textContent = "0:00";
    try { location.replace(exit.target); } catch { location.href = exit.target; }
    return;
  }
  cbCover.workerExit = exit;
  cbSyncCover();
}

// A custom rule's cover (v.cover): the plain cover, no snooze. It holds until
// the rule lifts it or the page's address changes, whatever the worker's
// decision does meanwhile.
function cbSetRuleCover(cover) {
  cbCover.ruleCover = cover && cover.on ? { groupId: String(cover.groupId || ""), message: String(cover.message || "") } : null;
  cbSyncCover();
}

function stopHeartbeat() {
  if (heartbeatIntervalId !== null) {
    window.clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
}

function ensureHeartbeat() {
  if (heartbeatIntervalId !== null || exitAttempted || extensionContextInvalid) return;

  heartbeatIntervalId = window.setInterval(() => {
    if (extensionContextInvalid) {
      stopHeartbeat();
      return;
    }
    if (!isExtensionContextValid()) {
      shutdownContentScript();
      return;
    }
    const now = Date.now();
    if (document.hidden) {
      lastHeartbeatAt = now;
      return;
    }
    // A covered page is not time on the page: while the cover is up (whatever
    // group or rule put it there) no group's budget runs, exactly as if the
    // tab were on about:blank. The tick still goes out to keep the session live.
    const covered = Boolean(cbCover.dialog && cbCover.dialog.open);
    const elapsedMs = covered ? 0 : now - lastHeartbeatAt;
    lastHeartbeatAt = now;
    safeSendMessage(
      {
        type: "page-session",
        pageContext: buildPageContext(),
        elapsedMs,
        exposedGroupIds: latestExposedGroupIds
      },
      (session) => handleSession(session)
    );
  }, 250);
}

// Top-level session handler. Called every heartbeat with the background's
// response: the page decision, timers and filters, and what the custom rules
// want from this page.
function handleSession(session) {
  if (!session) return;
  if (extensionContextInvalid || exitAttempted) return;

  const items = Array.isArray(session.items) ? session.items : [];
  const exit = session.exit && typeof session.exit === "object" ? session.exit : null;
  const shouldExitPage = Boolean(session.shouldExitPage) && Boolean(exit);

  updateOverlay(items, !shouldExitPage && (session.showTimer || items.length > 0));
  cbSetRuleItemsEpoch(session.ruleItems);
  cbSetRuleSheets(session.ruleSheets);
  // Re-apply only when what the worker sent changed (or the address did): the
  // feed observer handles new cards, so the 250 ms heartbeat must not redo the
  // whole feed each tick. Order/effect first, so verdicts resolve against the
  // right priorities.
  applySessionFilters(session.feedOrder, session.feedFilters, session.surfaceHides);

  // A covered page is not being used: no visible-page time accrues under the
  // cover. The worker pushes "session-refresh" when the block lifts.
  if (shouldExitPage) {
    stopHeartbeat();
    cbApplyExit(exit);
    return;
  }
  if (cbCover.workerExit) cbApplyExit(null);

  // Keep the heartbeat alive while a feed filter still counts exposure (a
  // timed group inside its allowance) even with no visible timer, and while a
  // rule counts visible time; an enforcing filter acts through the page
  // observer and needs no heartbeat.
  const countsExposure =
    Array.isArray(session.feedFilters) && session.feedFilters.some((filter) => filter && filter.enforce === false);
  if (!session.showTimer && items.length === 0 && !countsExposure && !session.ruleVisible) {
    stopHeartbeat();
  } else {
    ensureHeartbeat();
  }
}

function scheduleRefreshSession(delayMs = 100) {
  if (exitAttempted || extensionContextInvalid) return;
  if (refreshDebounceTimeoutId !== null) window.clearTimeout(refreshDebounceTimeoutId);
  refreshDebounceTimeoutId = window.setTimeout(() => {
    refreshDebounceTimeoutId = null;
    if (extensionContextInvalid) return;
    refreshSession();
  }, delayMs);
}

// A watch/channel page's owner identity can land a beat after navigation. These
// bounded retries re-run the evaluation as the author byline resolves.
let sessionResolveRetryTimers = [];
function clearSessionResolveRetries() {
  for (const id of sessionResolveRetryTimers) {
    try { window.clearTimeout(id); } catch (_) {}
  }
  sessionResolveRetryTimers = [];
}
function scheduleSessionResolveRetries() {
  clearSessionResolveRetries();
  // Only a platform page names an owner that can land late.
  if (!getCurrentFeedSite()) return;
  for (const delay of [400, 1200, 2500]) {
    const id = window.setTimeout(() => {
      if (exitAttempted || extensionContextInvalid) return;
      refreshSession();
    }, delay);
    sessionResolveRetryTimers.push(id);
  }
}

// The page moved to a new address without a load: the page decision is asked
// again, and a custom rule's cover (it belonged to the old address) lifts
// while the rules re-run for the new one.
function cbOnNavigated() {
  if (exitAttempted || extensionContextInvalid) return;
  lastKnownUrl = location.href;
  cbSessionFilterKey = "";
  // A rule's cover belonged to the old address; the page item is new.
  if (cbCover.ruleCover) cbSetRuleCover(null);
  cbScheduleRuleItems();
  refreshSession();
  scheduleSessionResolveRetries();
}

function refreshSession() {
  if (exitAttempted || extensionContextInvalid) return;
  if (!isExtensionContextValid()) {
    shutdownContentScript();
    return;
  }
  safeSendMessage(
    {
      type: "page-session",
      pageContext: buildPageContext(),
      elapsedMs: 0,
      exposedGroupIds: latestExposedGroupIds
    },
    handleSession
  );
}

// The rules' panels for this page; `panelGroups` are the groups whose
// panels changed (their panels missing from the answer are removed).
function refreshPanels(panelGroups = []) {
  if (exitAttempted || extensionContextInvalid) return;
  if (!isExtensionContextValid()) {
    shutdownContentScript();
    return;
  }
  chrome.runtime.sendMessage({ type: "get-custom-panels" }).then((message) => {
    if (!message || !message.ok) return;
    __cb_applyPanelSnapshots(message.panelSnapshots, [...panelGroups, ...(message.panelGroups || [])]);
  }).catch((error) => {
    if (isContextInvalidatedError(error)) shutdownContentScript();
    else cbDebugWarn("[CustomBlocker] panel refresh failed", error);
  });
}

if (/^https?:$/i.test(location.protocol)) {
  refreshSession();
  cbRefreshQuickAdd();
  refreshPanels();
  // Author bylines may resolve after initial load, so refresh the page matcher.
  scheduleSessionResolveRetries();

  document.addEventListener("visibilitychange", () => {
    lastHeartbeatAt = Date.now();
    if (!document.hidden) scheduleRefreshSession(0);
  });

  window.addEventListener("focus", () => scheduleRefreshSession(0));
  window.addEventListener("pageshow", () => scheduleRefreshSession(0));
  // YouTube's router says the new page is hydrated: its title and byline can
  // be read now. A new address is a navigation (sooner than the next check);
  // an address already seen only needs the fresh page read again.
  document.addEventListener("yt-navigate-finish", () => {
    if (location.href !== lastKnownUrl) return cbOnNavigated();
    refreshSession();
    cbScheduleRuleItems();
  });

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (extensionContextInvalid) return;
      if (!isExtensionContextValid()) {
        shutdownContentScript();
        return;
      }
      if (areaName !== "local") return;
      // Block state is pushed by the worker when it changes ("session-refresh");
      // only the quick-add button follows storage directly.
      if (changes.globalSettings || changes.quickAddGroupId || changes.blockedGroups) cbRefreshQuickAdd();
    });
  } catch (error) {
    if (isContextInvalidatedError(error)) shutdownContentScript();
  }

  window.addEventListener(
    "pagehide",
    () => {
      stopHeartbeat();
      stopFeedObserver();
      restoreHiddenFeedCards();
      // The filters are undone: a page restored from the back/forward cache
      // applies them again (pageshow → session → applySessionFilters).
      cbSessionFilterKey = "";
      if (refreshDebounceTimeoutId !== null) window.clearTimeout(refreshDebounceTimeoutId);
    }
  );
}

// ────────────────────────────────────────────────────────────────────────
// Custom-rule panels (v.panel): rendered here, their interactions go back
// to the rule as "panel" events.
// ────────────────────────────────────────────────────────────────────────

const __cb_PANEL_ROOT_ID = "__custom_blocker_panel_root__";
const __cb_PANEL_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right", "center"];
const __cb_activePanelElements = new Map(); // groupId:panelId -> element
const __cb_panelStacks = new Map(); // position -> element
const __cb_PANEL_STYLE_ID = "__custom_blocker_panel_style__";

function __cb_safePanelText(value, max = 1000) {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max) : text;
}

function __cb_safeCssColor(value, fallback) {
  const text = String(value ?? "").trim();
  if (!text || text.length > 64) return fallback;
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return text;
  if (/^rgba?\([\d\s.,%+-]+\)$/i.test(text)) return text;
  if (/^hsla?\([\d\s.,%+-]+\)$/i.test(text)) return text;
  if (/^[a-z]{3,32}$/i.test(text)) return text;
  return fallback;
}

function __cb_safeCssSize(value, fallback) {
  const text = String(value ?? "").trim();
  if (/^\d+(?:\.\d+)?(px|rem|em)$/i.test(text)) return text;
  return fallback;
}

function __cb_safeCssControlWidth(value) {
  const text = String(value ?? "").trim();
  if (text === "full") return "100%";
  if (text === "auto") return "auto";
  if (/^\d+(?:\.\d+)?px$/i.test(text)) return text;
  if (/^\d+(?:\.\d+)?%$/i.test(text)) return text;
  return "";
}

function __cb_safeCssControlHeight(value) {
  const text = String(value ?? "").trim();
  if (text === "auto") return "auto";
  if (/^\d+(?:\.\d+)?px$/i.test(text)) return text;
  return "";
}

function __cb_safePanelRole(value, fallback) {
  return ["region", "dialog", "alert", "status", "form", "group"].includes(value) ? value : fallback;
}

function __cb_sortedPanelControls(controls) {
  return (Array.isArray(controls) ? controls.slice() : []).sort((a, b) => {
    const pa = Number(a?.priority) || 0;
    const pb = Number(b?.priority) || 0;
    if (pb !== pa) return pb - pa;
    return 0;
  });
}

function __cb_panelLayoutStyle(layout, align) {
  const normalized = String(layout || "vertical");
  const alignItems = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  const map = {
    compact: ["display:flex", "flex-direction:column", "gap:5px", "align-items:" + alignItems],
    comfortable: ["display:flex", "flex-direction:column", "gap:10px", "align-items:" + alignItems],
    spacious: ["display:flex", "flex-direction:column", "gap:14px", "align-items:" + alignItems],
    inline: ["display:flex", "flex-direction:row", "gap:8px", "align-items:center", "flex-wrap:nowrap"],
    row: ["display:flex", "flex-direction:row", "gap:8px", "align-items:center", "flex-wrap:nowrap"],
    wrap: ["display:flex", "flex-direction:row", "gap:8px", "align-items:center", "flex-wrap:wrap"],
    twoColumn: ["display:grid", "grid-template-columns:repeat(2, minmax(0, max-content))", "gap:8px 10px", "align-items:start"],
    grid: ["display:grid", "grid-template-columns:repeat(auto-fit, minmax(120px, max-content))", "gap:8px", "align-items:start"],
    split: ["display:grid", "grid-template-columns:1fr auto", "gap:8px 10px", "align-items:center"],
    form: ["display:grid", "grid-template-columns:max-content max-content", "gap:8px 10px", "align-items:center"],
    toolbar: ["display:flex", "flex-direction:row", "gap:6px", "align-items:center", "flex-wrap:wrap"],
    stack: ["display:flex", "flex-direction:column", "gap:2px", "align-items:" + alignItems]
  };
  return (map[normalized] || ["display:flex", "flex-direction:column", "gap:8px", "align-items:" + alignItems])
    .concat(["text-align:" + align, "width:fit-content", "max-width:100%"])
    .join(";");
}

const __cb_PANEL_CONTROL_PATCH_KEYS = new Set([
  "disabled",
  "label",
  "text",
  "placeholder",
  "ariaLabel",
  "autoFocus",
  "options",
  "min",
  "max",
  "step",
  "rows"
]);

function __cb_panelSnapshotKeySnapshot(value, key = "") {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => __cb_panelSnapshotKeySnapshot(item));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "values" || key === "title" || key === "description") continue;
    if (value.type && __cb_PANEL_CONTROL_PATCH_KEYS.has(key)) continue;
    if (value.type && value.type !== "button" && key === "value") continue;
    out[key] = __cb_panelSnapshotKeySnapshot(item, key);
  }
  return out;
}

function __cb_panelSnapshotKey(snapshot) {
  try {
    return JSON.stringify(__cb_panelSnapshotKeySnapshot(snapshot || {}));
  } catch (_) {
    return "";
  }
}

function __cb_panelControlOptionsKey(control) {
  try {
    return JSON.stringify(Array.isArray(control?.options) ? control.options : []);
  } catch (_) {
    return "[]";
  }
}

function __cb_markPanelControlRoot(node, control) {
  if (!node || !control || typeof control !== "object") return node;
  node.setAttribute("data-cb-panel-control-root-id", control.id || "");
  node.setAttribute("data-cb-panel-control-root-type", control.type || "text");
  if (control.type === "select" || control.type === "radio") {
    node.setAttribute("data-cb-panel-control-options-key", __cb_panelControlOptionsKey(control));
  }
  return node;
}

function __cb_findPanelControlRoot(panelEl, control) {
  if (!panelEl || !control || !control.id) return null;
  return panelEl.querySelector("[data-cb-panel-control-root-id='" + control.id + "']");
}

function __cb_renderSinglePanelControl(panelEl, control, theme) {
  const holder = document.createElement("div");
  __cb_appendPanelControl(panelEl, holder, control, theme || {});
  return holder.firstElementChild;
}

// True when focus currently sits on a control inside this panel (active drag /
// typing). Resolves activeElement within the panel's own root, since the panel
// lives in a shadow root where document.activeElement is only the host.
function __cb_panelHasActiveControl(panelEl) {
  if (!panelEl) return false;
  const root = typeof panelEl.getRootNode === "function" ? panelEl.getRootNode() : document;
  const active = (root && root.activeElement) || document.activeElement;
  return Boolean(active) && active !== panelEl && panelEl.contains(active);
}

const __cb_VALUE_INPUT_TYPES = new Set(
  ["textInput", "textarea", "numberInput", "range", "select", "date", "time", "color", "pin"]
);

function __cb_shouldDeferInputValuePatch(input) {
  // The panel lives in a shadow root, so document.activeElement is the panel
  // HOST, never the inner <input>. Check the input's own root (shadow root or
  // document) instead — otherwise this guard never fires and an async panel
  // refresh overwrites the value mid-interaction (e.g. a range slider snaps
  // back every drag tick, so it can never reach either end).
  const root = typeof input?.getRootNode === "function" ? input.getRootNode() : document;
  const active = (root && root.activeElement) || document.activeElement;
  if (!input || active !== input) return false;
  const type = input.getAttribute("data-cb-panel-control-type") || "";
  return __cb_VALUE_INPUT_TYPES.has(type);
}

function __cb_setInputValueIfSafe(input, value) {
  if (!input || __cb_shouldDeferInputValuePatch(input)) return;
  const next = String(value ?? "");
  // Uncontrolled-input semantics: only overwrite the user's current value when
  // the RULE's value actually changed since we last applied it. A panel is
  // re-collected and re-sent on EVERY refresh (a panel event round-trip,
  // …), so without this a control snaps back to the rule's stored value the
  // instant the user lets go — e.g. a slider released at either end jumps back to
  // its initial value, which reads as "can't reach / capped". The rule's last
  // applied value is recorded in data-cb-panel-rule-value.
  if (input.getAttribute("data-cb-panel-rule-value") === next) return;
  input.setAttribute("data-cb-panel-rule-value", next);
  if (input.value !== next) input.value = next;
}

function __cb_patchInputCommon(input, control) {
  if (!input || !control) return;
  input.disabled = control.disabled === true;
  if (control.ariaLabel) input.setAttribute("aria-label", __cb_safePanelText(control.ariaLabel, 240));
  else input.removeAttribute("aria-label");
  if (control.autoFocus === true) input.setAttribute("data-cb-panel-autofocus", "1");
  else input.removeAttribute("data-cb-panel-autofocus");
}

function __cb_patchControlLabel(root, control) {
  const label = root?.querySelector("[data-cb-panel-control-label='1']");
  if (label) label.textContent = __cb_safePanelText(control?.label || "", 240);
}

function __cb_patchSelectOptions(input, control) {
  if (!input || !control) return;
  const current = input.getAttribute("data-cb-panel-control-options-key") || "";
  const next = __cb_panelControlOptionsKey(control);
  if (current !== next) {
    input.textContent = "";
    for (const option of Array.isArray(control.options) ? control.options : []) {
      const opt = document.createElement("option");
      opt.value = __cb_safePanelText(option.value, 256);
      opt.textContent = __cb_safePanelText(option.label ?? option.value, 256);
      input.appendChild(opt);
    }
    input.setAttribute("data-cb-panel-control-options-key", next);
  }
}

function __cb_replacePanelControlRoot(panelEl, root, control, theme) {
  if (!root || !root.parentNode) return false;
  const nextRoot = __cb_renderSinglePanelControl(panelEl, control, theme);
  if (!nextRoot) return false;
  root.parentNode.replaceChild(nextRoot, root);
  return true;
}

function __cb_patchSectionControl(root, control) {
  const label = __cb_safePanelText(control.label || "", 240);
  let heading = root.querySelector("[data-cb-panel-section-heading='1']");
  const inner = root.querySelector("[data-cb-panel-section-body='1']");
  if (label) {
    if (!heading) {
      heading = document.createElement("div");
      heading.setAttribute("data-cb-panel-section-heading", "1");
      heading.style.cssText = "font-weight:700;font-size:0.95em;";
      root.insertBefore(heading, root.firstChild);
    }
    heading.textContent = label;
  } else if (heading) {
    heading.remove();
  }

  const text = __cb_safePanelText(control.text || "", 1000);
  let desc = root.querySelector("[data-cb-panel-section-description='1']");
  if (text) {
    if (!desc) {
      desc = document.createElement("div");
      desc.setAttribute("data-cb-panel-section-description", "1");
      desc.style.cssText = "opacity:0.82;white-space:pre-wrap;word-break:break-word;";
      root.insertBefore(desc, inner || null);
    }
    desc.textContent = text;
  } else if (desc) {
    desc.remove();
  }

  if (control.ariaLabel) root.setAttribute("aria-label", __cb_safePanelText(control.ariaLabel, 240));
  else root.removeAttribute("aria-label");
}

function __cb_patchPanelControl(panelEl, control, theme) {
  const root = __cb_findPanelControlRoot(panelEl, control);
  if (!root) return false;
  const type = control.type || "text";

  if (type === "radio" && root.getAttribute("data-cb-panel-control-options-key") !== __cb_panelControlOptionsKey(control)) {
    return __cb_replacePanelControlRoot(panelEl, root, control, theme);
  }

  if (type === "text") {
    const text = __cb_safePanelText(control.text || control.label || "", 1000);
    if (root.textContent !== text) root.textContent = text;
    return true;
  }

  if (type === "html") {
    const html = String(control.html || "");
    if (root.innerHTML !== html) root.innerHTML = html;
    return true;
  }

  if (type === "section") {
    __cb_patchSectionControl(root, control);
    return true;
  }

  __cb_patchControlLabel(root, control);
  if (type === "radio") {
    root.setAttribute("data-cb-panel-control-options-key", __cb_panelControlOptionsKey(control));
    root.querySelectorAll("[data-cb-panel-control-type='radio']").forEach((radio) => {
      radio.disabled = control.disabled === true;
      radio.checked = String(radio.value ?? "") === __cb_safePanelText(control.value, 256);
    });
    return true;
  }

  const input = root.querySelector("[data-cb-panel-control-id='" + control.id + "']");
  if (!input) return false;
  __cb_patchInputCommon(input, control);

  if (type === "checkbox" || type === "toggle") {
    input.checked = control.value === true;
    return true;
  }
  if (type === "select") {
    __cb_patchSelectOptions(input, control);
    __cb_setInputValueIfSafe(input, __cb_safePanelText(control.value, 256));
    root.setAttribute("data-cb-panel-control-options-key", __cb_panelControlOptionsKey(control));
    return true;
  }
  if (type === "numberInput" || type === "range") {
    if (Number.isFinite(Number(control.min))) input.min = String(control.min);
    else input.removeAttribute("min");
    if (Number.isFinite(Number(control.max))) input.max = String(control.max);
    else input.removeAttribute("max");
    if (Number.isFinite(Number(control.step)) && Number(control.step) > 0) input.step = String(control.step);
    else input.removeAttribute("step");
    __cb_setInputValueIfSafe(input, String(Number.isFinite(Number(control.value)) ? Number(control.value) : 0));
    return true;
  }
  if (type === "date" || type === "time" || type === "color") {
    __cb_setInputValueIfSafe(input, __cb_safePanelText(control.value, type === "color" ? 16 : 64));
    return true;
  }
  if (type === "textarea") {
    input.placeholder = __cb_safePanelText(control.placeholder || "", 500);
    input.rows = Number.isFinite(Number(control.rows)) ? Math.max(1, Math.min(12, Math.floor(Number(control.rows)))) : 3;
    __cb_setInputValueIfSafe(input, __cb_safePanelText(control.value, 2000));
    return true;
  }
  if (type === "button") {
    input.textContent = __cb_safePanelText(control.label || "Button", 120);
    return true;
  }

  input.placeholder = __cb_safePanelText(control.placeholder || "", 500);
  __cb_setInputValueIfSafe(input, __cb_safePanelText(control.value, 2000));
  return true;
}

function __cb_patchPanelControls(panelEl, controls, theme) {
  for (const control of Array.isArray(controls) ? controls : []) {
    if (!control || typeof control !== "object") continue;
    if (!__cb_patchPanelControl(panelEl, control, theme)) return false;
    if (control.type === "section" && !__cb_patchPanelControls(panelEl, control.controls, theme)) return false;
  }
  return true;
}

function __cb_patchPanelChrome(panelEl, snapshot) {
  const theme = snapshot.theme && typeof snapshot.theme === "object" ? snapshot.theme : {};
  const titleSize = __cb_safeCssSize(theme.titleSize, "14px");
  const title = __cb_safePanelText(snapshot.title || "", 240);
  let titleEl = panelEl.querySelector("[data-cb-panel-title='1']");
  if (title) {
    if (!titleEl) {
      titleEl = document.createElement("div");
      titleEl.setAttribute("data-cb-panel-title", "1");
      panelEl.insertBefore(titleEl, panelEl.firstChild);
    }
    titleEl.textContent = title;
    titleEl.style.cssText = "font-weight:700;font-size:" + titleSize + ";";
  } else if (titleEl) {
    titleEl.remove();
  }

  const description = __cb_safePanelText(snapshot.description || "", 1000);
  let descEl = panelEl.querySelector("[data-cb-panel-description='1']");
  const body = panelEl.querySelector("[data-cb-panel-body='1']");
  if (description) {
    if (!descEl) {
      descEl = document.createElement("div");
      descEl.setAttribute("data-cb-panel-description", "1");
      descEl.style.cssText = "opacity:0.82;white-space:pre-wrap;word-break:break-word;";
      panelEl.insertBefore(descEl, body || null);
    }
    descEl.textContent = description;
  } else if (descEl) {
    descEl.remove();
  }
}

function __cb_patchPanelInPlace(panelEl, snapshot) {
  if (!panelEl || !snapshot) return false;
  const theme = snapshot.theme && typeof snapshot.theme === "object" ? snapshot.theme : {};
  __cb_patchPanelChrome(panelEl, snapshot);
  return __cb_patchPanelControls(panelEl, __cb_sortedPanelControls(snapshot.controls), theme);
}

function __cb_ensurePanelRoot() {
  let host = document.getElementById(__cb_PANEL_ROOT_ID);
  if (host && host.isConnected) {
    if (!host.shadowRoot) {
      try { host.attachShadow({ mode: "open" }); } catch (_) {}
    }
    const root = host.shadowRoot || host;
    __cb_ensurePanelStyle(root);
    return root;
  }
  if (!document.body && !document.documentElement) return null;
  host = document.createElement("div");
  host.id = __cb_PANEL_ROOT_ID;
  host.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483646",
    "pointer-events:none",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  ].join(";");
  (document.body || document.documentElement).appendChild(host);
  let root = host;
  try {
    root = host.attachShadow({ mode: "open" });
  } catch (_) {}
  __cb_ensurePanelStyle(root);
  __cb_panelStacks.clear();
  return root;
}

function __cb_ensurePanelStyle(root) {
  if (!root || root.getElementById?.(__cb_PANEL_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = __cb_PANEL_STYLE_ID;
  style.textContent = `
    button[data-cb-panel-control-type="button"] {
      transition: transform 80ms ease, filter 120ms ease, box-shadow 120ms ease;
    }
    button[data-cb-panel-control-type="button"]:hover:not(:disabled) {
      filter: brightness(1.08);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
    }
    button[data-cb-panel-control-type="button"]:active:not(:disabled) {
      transform: translateY(1px) scale(0.98);
      filter: brightness(0.92);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    button[data-cb-panel-control-type="button"]:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    input[data-cb-panel-control-type="checkbox"]:focus-visible,
    input[data-cb-panel-control-type="toggle"]:focus-visible,
    input[data-cb-panel-control-type="radio"]:focus-visible,
    input[data-cb-panel-control-type="numberInput"]:focus-visible,
    input[data-cb-panel-control-type="range"]:focus-visible,
    input[data-cb-panel-control-type="date"]:focus-visible,
    input[data-cb-panel-control-type="time"]:focus-visible,
    input[data-cb-panel-control-type="color"]:focus-visible,
    select[data-cb-panel-control-type="select"]:focus-visible,
    textarea[data-cb-panel-control-type="textarea"]:focus-visible,
    input[data-cb-panel-control-type="textInput"]:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
  `;
  try {
    root.appendChild(style);
  } catch (_) {}
}

function __cb_ensurePanelStack(position) {
  const normalized = __cb_PANEL_POSITIONS.includes(position) ? position : "bottom-right";
  const root = __cb_ensurePanelRoot();
  if (!root) return null;
  let stack = __cb_panelStacks.get(normalized);
  if (stack && stack.isConnected) return stack;
  stack = document.createElement("div");
  stack.setAttribute("data-cb-panel-stack", normalized);
  const common = [
    "position:fixed",
    "display:flex",
    "gap:10px",
    "pointer-events:none",
    "max-width:min(92vw,560px)"
  ];
  const byPosition = {
    "top-left": ["top:6.4px", "left:6.4px", "flex-direction:column", "align-items:flex-start"],
    "top-right": ["top:6.4px", "right:6.4px", "flex-direction:column", "align-items:flex-end"],
    "bottom-left": ["bottom:6.4px", "left:6.4px", "flex-direction:column-reverse", "align-items:flex-start"],
    "bottom-right": ["bottom:6.4px", "right:6.4px", "flex-direction:column-reverse", "align-items:flex-end"],
    center: ["top:50%", "left:50%", "transform:translate(-50%,-50%)", "flex-direction:column", "align-items:center"]
  };
  stack.style.cssText = common.concat(byPosition[normalized]).join(";");
  root.appendChild(stack);
  __cb_panelStacks.set(normalized, stack);
  return stack;
}

function __cb_panelKey(groupId, panelId) {
  return String(groupId || "") + ":" + String(panelId || "");
}

function __cb_removePanel(key) {
  const node = __cb_activePanelElements.get(key);
  if (node && node.parentNode) {
    __cb_sendPanelEvent(node, { id: "", type: "panel" }, "unmount", true);
    node.parentNode.removeChild(node);
  }
  __cb_activePanelElements.delete(key);
}

function __cb_collectPanelValues(panelEl) {
  const values = {};
  panelEl.querySelectorAll("[data-cb-panel-control-id]").forEach((el) => {
    const id = el.getAttribute("data-cb-panel-control-id");
    const type = el.getAttribute("data-cb-panel-control-type");
    if (!id || type === "button" || type === "text" || type === "section") return;
    if (type === "checkbox" || type === "toggle") {
      values[id] = Boolean(el.checked);
    } else if (type === "radio") {
      if (el.checked) values[id] = String(el.value ?? "");
    } else if (type === "numberInput" || type === "range") {
      const n = Number(el.value);
      values[id] = Number.isFinite(n) ? n : 0;
    } else {
      values[id] = String(el.value ?? "");
    }
  });
  return values;
}

function __cb_sendPanelEvent(panelEl, control, eventName, value, extra) {
  if (!panelEl || !control || extensionContextInvalid || !isExtensionContextValid()) return;
  const values = __cb_collectPanelValues(panelEl);
  const details = extra && typeof extra === "object" ? extra : {};
  try {
    chrome.runtime.sendMessage({
      type: "custom-panel-event",
      groupId: panelEl.getAttribute("data-cb-panel-group-id") || "",
      panelId: panelEl.getAttribute("data-cb-panel-id") || "",
      controlId: control.id || "",
      eventName,
      value,
      values,
      key: details.key,
      code: details.code,
      keyInfo: details.keyInfo,
      url: location.href
    }).catch((error) => {
      if (isContextInvalidatedError(error)) {
        shutdownContentScript();
      } else {
        cbDebugWarn("[CustomBlocker] panel event failed", error);
      }
    });
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      shutdownContentScript();
    } else {
      cbDebugWarn("[CustomBlocker] panel event failed", error);
    }
  }
}

function __cb_keyEventInfo(ev) {
  return {
    key: String(ev.key || ""),
    code: String(ev.code || ""),
    altKey: Boolean(ev.altKey),
    ctrlKey: Boolean(ev.ctrlKey),
    metaKey: Boolean(ev.metaKey),
    shiftKey: Boolean(ev.shiftKey),
    repeat: Boolean(ev.repeat)
  };
}

function __cb_attachPanelControlEvents(panelEl, control, input, valueOf) {
  const readValue = typeof valueOf === "function" ? valueOf : () => input.value;
  input.addEventListener("focus", () => __cb_sendPanelEvent(panelEl, control, "focus", readValue()));
  input.addEventListener("blur", () => __cb_sendPanelEvent(panelEl, control, "blur", readValue()));
  input.addEventListener("keydown", (ev) => {
    const keyInfo = __cb_keyEventInfo(ev);
    __cb_sendPanelEvent(panelEl, control, "key", readValue(), {
      key: keyInfo.key,
      code: keyInfo.code,
      keyInfo
    });
  });
}

function __cb_appendPanelControl(panelEl, body, control, theme) {
  if (!control || typeof control !== "object") return;
  const type = control.type || "text";
  const label = __cb_safePanelText(control.label || "", 240);
  const controlWidth = __cb_safeCssControlWidth(control.width);
  const controlHeight = __cb_safeCssControlHeight(control.height);
  const wrap = document.createElement("div");
  wrap.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:4px",
    "font:inherit",
    "color:inherit"
  ].join(";");

  if (type === "text") {
    const text = document.createElement("div");
    __cb_markPanelControlRoot(text, control);
    text.textContent = __cb_safePanelText(control.text || control.label || "", 1000);
    text.style.cssText = "white-space:pre-wrap;word-break:break-word;color:inherit;";
    body.appendChild(text);
    return;
  }

  if (type === "html") {
    const htmlBox = document.createElement("div");
    __cb_markPanelControlRoot(htmlBox, control);
    htmlBox.setAttribute("data-cb-panel-control-id", control.id || "");
    htmlBox.setAttribute("data-cb-panel-control-type", "html");
    htmlBox.style.cssText = "word-break:break-word;color:inherit;";
    if (controlWidth && controlWidth !== "auto") {
      htmlBox.style.width = controlWidth;
      htmlBox.style.maxWidth = "100%";
    }
    if (controlHeight) htmlBox.style.height = controlHeight;
    // control.html is pre-sanitized in helpers.sanitizePanelHtml (script
    // blocks + on* handlers stripped). innerHTML is intentional here.
    htmlBox.innerHTML = String(control.html || "");
    body.appendChild(htmlBox);
    return;
  }

  if (type === "section") {
    const section = document.createElement("section");
    __cb_markPanelControlRoot(section, control);
    section.setAttribute("data-cb-panel-control-id", control.id || "");
    section.setAttribute("data-cb-panel-control-type", "section");
    section.setAttribute("role", __cb_safePanelRole(control.role, "group"));
    const sectionAlign = ["left", "center", "right"].includes(control.align) ? control.align : "left";
    if (control.ariaLabel) section.setAttribute("aria-label", __cb_safePanelText(control.ariaLabel, 240));
    section.style.cssText = [
      "box-sizing:border-box",
      "display:flex",
      "flex-direction:column",
      "gap:6px",
      "padding:8px",
      "border:1px solid " + __cb_safeCssColor(theme.border, "rgba(148,163,184,0.35)"),
      "border-radius:10px",
      "width:" + (controlWidth && controlWidth !== "auto" ? controlWidth : "fit-content"),
      "max-width:100%",
      "text-align:" + sectionAlign
    ].join(";");
    if (controlHeight) section.style.height = controlHeight;
    if (label) {
      const heading = document.createElement("div");
      heading.setAttribute("data-cb-panel-section-heading", "1");
      heading.textContent = label;
      heading.style.cssText = "font-weight:700;font-size:0.95em;";
      section.appendChild(heading);
    }
    const text = __cb_safePanelText(control.text || "", 1000);
    if (text) {
      const desc = document.createElement("div");
      desc.setAttribute("data-cb-panel-section-description", "1");
      desc.textContent = text;
      desc.style.cssText = "opacity:0.82;white-space:pre-wrap;word-break:break-word;";
      section.appendChild(desc);
    }
    const inner = document.createElement("div");
    inner.setAttribute("data-cb-panel-section-body", "1");
    inner.style.cssText = __cb_panelLayoutStyle(control.layout || "vertical", sectionAlign);
    for (const child of __cb_sortedPanelControls(control.controls)) {
      __cb_appendPanelControl(panelEl, inner, child, theme);
    }
    section.appendChild(inner);
    body.appendChild(section);
    return;
  }

  if (controlWidth) {
    wrap.style.width = controlWidth;
    wrap.style.maxWidth = "100%";
    if (controlWidth === "auto") wrap.style.alignSelf = "flex-start";
  }
  if (label && type !== "checkbox" && type !== "toggle" && type !== "button") {
    const labelEl = document.createElement("span");
    labelEl.setAttribute("data-cb-panel-control-label", "1");
    labelEl.textContent = label;
    labelEl.style.cssText = "font-size:0.9em;opacity:0.82;";
    wrap.appendChild(labelEl);
  }

  let input = null;
  __cb_markPanelControlRoot(wrap, control);
  if (type === "checkbox" || type === "toggle") {
    wrap.style.flexDirection = "row";
    wrap.style.alignItems = "center";
    wrap.style.cursor = control.disabled === true ? "default" : "pointer";
    input = document.createElement("input");
    input.type = "checkbox";
    input.id = "cb-panel-control-" + Math.random().toString(36).slice(2, 10);
    input.checked = control.value === true;
    input.addEventListener("change", () => __cb_sendPanelEvent(panelEl, control, "change", input.checked));
    input.addEventListener("input", () => __cb_sendPanelEvent(panelEl, control, "input", input.checked));
    const labelEl = document.createElement("label");
    labelEl.setAttribute("data-cb-panel-control-label", "1");
    labelEl.htmlFor = input.id;
    labelEl.textContent = label;
    labelEl.style.cssText = "user-select:none;line-height:1.3;cursor:" + (control.disabled === true ? "default" : "pointer") + ";";
    wrap.appendChild(input);
    wrap.appendChild(labelEl);
  } else if (type === "radio") {
    const options = Array.isArray(control.options) ? control.options : [];
    const groupName = "cb-panel-" + (panelEl.getAttribute("data-cb-panel-group-id") || "") + "-" + (panelEl.getAttribute("data-cb-panel-id") || "") + "-" + (control.id || "");
    const radioGroup = document.createElement("div");
    radioGroup.setAttribute("role", "radiogroup");
    if (label) radioGroup.setAttribute("aria-label", label);
    radioGroup.style.cssText = "display:flex;flex-direction:column;gap:5px;";
    for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
      const option = options[optionIndex];
      const optionLabel = document.createElement("label");
      optionLabel.style.cssText = "display:flex;align-items:center;gap:6px;cursor:" + (control.disabled === true ? "default" : "pointer") + ";";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.id = "cb-panel-control-" + Math.random().toString(36).slice(2, 10) + "-" + optionIndex;
      radio.name = groupName;
      radio.value = __cb_safePanelText(option.value, 256);
      radio.checked = radio.value === __cb_safePanelText(control.value, 256);
      radio.disabled = control.disabled === true;
      radio.setAttribute("data-cb-panel-control-id", control.id || "");
      radio.setAttribute("data-cb-panel-control-type", "radio");
      radio.addEventListener("change", () => {
        if (radio.checked) __cb_sendPanelEvent(panelEl, control, "change", radio.value);
      });
      radio.addEventListener("input", () => {
        if (radio.checked) __cb_sendPanelEvent(panelEl, control, "input", radio.value);
      });
      __cb_attachPanelControlEvents(panelEl, control, radio, () => radio.value);
      radio.style.cssText = [
        "box-sizing:border-box",
        "width:15px",
        "height:15px",
        "margin:0",
        "accent-color:" + __cb_safeCssColor(theme.accent, "#2563eb"),
        "cursor:" + (control.disabled === true ? "default" : "pointer")
      ].join(";");
      const span = document.createElement("span");
      span.textContent = __cb_safePanelText(option.label ?? option.value, 256);
      span.style.cssText = "user-select:none;line-height:1.3;";
      optionLabel.appendChild(radio);
      optionLabel.appendChild(span);
      radioGroup.appendChild(optionLabel);
    }
    wrap.appendChild(radioGroup);
    body.appendChild(wrap);
    return;
  } else if (type === "pin") {
    const pinLen = Math.max(3, Math.min(12, Math.floor(Number(control.length)) || 6));
    const masked = control.masked !== false;
    const pinWrap = document.createElement("div");
    pinWrap.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;";
    const hidden = document.createElement("input");
    hidden.type = "text";
    hidden.inputMode = "numeric";
    hidden.autocomplete = "one-time-code";
    hidden.setAttribute("maxlength", String(pinLen));
    hidden.setAttribute("data-cb-panel-control-id", control.id || "");
    hidden.setAttribute("data-cb-panel-control-type", "pin");
    hidden.style.cssText = "position:absolute;opacity:0;width:1px;height:1px;border:0;padding:0;pointer-events:none;";
    hidden.value = __cb_safePanelText(control.value, pinLen).replace(/\D/g, "").slice(0, pinLen);
    hidden.disabled = control.disabled === true;
    const boxes = [];
    for (let i = 0; i < pinLen; i++) {
      const boxEl = document.createElement("div");
      boxEl.style.cssText = [
        "width:30px", "height:38px", "border-radius:6px",
        "background:rgba(148,163,184,0.25)",
        "border:1px solid " + __cb_safeCssColor(theme.border, "rgba(148,163,184,0.55)"),
        "display:flex", "align-items:center", "justify-content:center",
        "font:600 18px ui-monospace,SFMono-Regular,Menlo,monospace",
        "color:" + __cb_safeCssColor(theme.foreground, "#0f172a"),
        "cursor:" + (control.disabled === true ? "default" : "text")
      ].join(";");
      boxes.push(boxEl);
      pinWrap.appendChild(boxEl);
    }
    const renderBoxes = () => {
      const v = hidden.value;
      for (let i = 0; i < pinLen; i++) {
        boxes[i].textContent = i < v.length ? (masked ? "\u2022" : v[i]) : "";
      }
    };
    renderBoxes();
    hidden.addEventListener("input", () => {
      const digits = hidden.value.replace(/\D/g, "").slice(0, pinLen);
      if (digits !== hidden.value) hidden.value = digits;
      renderBoxes();
      __cb_sendPanelEvent(panelEl, control, "change", digits);
      if (control.autoSubmit === true && digits.length === pinLen) {
        __cb_sendPanelEvent(panelEl, control, "submit", digits);
      }
    });
    pinWrap.addEventListener("click", () => {
      if (control.disabled !== true) hidden.focus();
    });
    wrap.appendChild(hidden);
    wrap.appendChild(pinWrap);
    body.appendChild(wrap);
    return;
  } else if (type === "select") {
    input = document.createElement("select");
    input.setAttribute("data-cb-panel-control-options-key", __cb_panelControlOptionsKey(control));
    for (const option of Array.isArray(control.options) ? control.options : []) {
      const opt = document.createElement("option");
      opt.value = __cb_safePanelText(option.value, 256);
      opt.textContent = __cb_safePanelText(option.label ?? option.value, 256);
      input.appendChild(opt);
    }
    input.value = __cb_safePanelText(control.value, 256);
    input.addEventListener("change", () => __cb_sendPanelEvent(panelEl, control, "change", input.value));
    input.addEventListener("input", () => __cb_sendPanelEvent(panelEl, control, "input", input.value));
    wrap.appendChild(input);
  } else if (type === "numberInput" || type === "range" || type === "date" || type === "time" || type === "color") {
    input = document.createElement("input");
    input.type = type === "numberInput" ? "number" : type;
    if (type === "numberInput" || type === "range") {
      if (Number.isFinite(Number(control.min))) input.min = String(control.min);
      if (Number.isFinite(Number(control.max))) input.max = String(control.max);
      if (Number.isFinite(Number(control.step)) && Number(control.step) > 0) input.step = String(control.step);
      input.value = String(Number.isFinite(Number(control.value)) ? Number(control.value) : 0);
    } else {
      input.value = __cb_safePanelText(control.value, type === "color" ? 16 : 64);
    }
    input.addEventListener("change", () => {
      const value = type === "numberInput" || type === "range" ? Number(input.value) || 0 : input.value;
      __cb_sendPanelEvent(panelEl, control, "change", value);
    });
    input.addEventListener("input", () => {
      const value = type === "numberInput" || type === "range" ? Number(input.value) || 0 : input.value;
      __cb_sendPanelEvent(panelEl, control, "input", value);
    });
    wrap.appendChild(input);
  } else if (type === "textarea") {
    input = document.createElement("textarea");
    input.value = __cb_safePanelText(control.value, 2000);
    input.placeholder = __cb_safePanelText(control.placeholder || "", 500);
    input.rows = Number.isFinite(Number(control.rows)) ? Math.max(1, Math.min(12, Math.floor(Number(control.rows)))) : 3;
    input.addEventListener("input", () => __cb_sendPanelEvent(panelEl, control, "input", input.value));
    input.addEventListener("blur", () => __cb_sendPanelEvent(panelEl, control, "change", input.value));
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
        __cb_sendPanelEvent(panelEl, control, "change", input.value);
      }
    });
    wrap.appendChild(input);
  } else if (type === "button") {
    input = document.createElement("button");
    input.type = "button";
    input.textContent = label || "Button";
    input.addEventListener("click", () => {
      const value = control.value ?? true;
      // Every button press fires "click" so onClick always works. Action
      // buttons ALSO fire their action ("submit"/"cancel"/"close") so onSubmit /
      // onClose handlers keep working — both, not one or the other.
      __cb_sendPanelEvent(panelEl, control, "click", value);
      const action = control.action === "submit" || control.action === "cancel" || control.action === "close"
        ? control.action
        : null;
      if (action) __cb_sendPanelEvent(panelEl, control, action, value);
    });
    input.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
    });
    wrap.appendChild(input);
  } else {
    input = document.createElement("input");
    input.type = "text";
    input.value = __cb_safePanelText(control.value, 2000);
    input.placeholder = __cb_safePanelText(control.placeholder || "", 500);
    input.addEventListener("input", () => __cb_sendPanelEvent(panelEl, control, "input", input.value));
    input.addEventListener("blur", () => __cb_sendPanelEvent(panelEl, control, "change", input.value));
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") __cb_sendPanelEvent(panelEl, control, "change", input.value);
    });
    wrap.appendChild(input);
  }

  if (input) {
    input.disabled = control.disabled === true;
    input.setAttribute("data-cb-panel-control-id", control.id || "");
    input.setAttribute("data-cb-panel-control-type", type);
    // Seed the "last rule value" so the first passive re-render after creation
    // doesn't clobber a value the user already started editing (uncontrolled
    // semantics — see __cb_setInputValueIfSafe).
    if (__cb_VALUE_INPUT_TYPES.has(type)) {
      input.setAttribute("data-cb-panel-rule-value", String(input.value ?? ""));
    }
    if (control.ariaLabel) input.setAttribute("aria-label", __cb_safePanelText(control.ariaLabel, 240));
    if (control.autoFocus === true) input.setAttribute("data-cb-panel-autofocus", "1");
    __cb_attachPanelControlEvents(
      panelEl,
      control,
      input,
      type === "checkbox" || type === "toggle"
        ? () => input.checked
        : type === "numberInput" || type === "range"
          ? () => Number(input.value) || 0
          : () => input.value
    );
    if (type === "checkbox" || type === "toggle") {
      input.style.cssText = [
        "box-sizing:border-box",
        "display:inline-block",
        "width:16px",
        "height:16px",
        "min-width:16px",
        "margin:0",
        "padding:0",
        "vertical-align:middle",
        "accent-color:" + __cb_safeCssColor(theme.accent, "#2563eb"),
        "cursor:" + (control.disabled === true ? "default" : "pointer"),
        "appearance:auto",
        "-webkit-appearance:checkbox"
      ].join(";");
    } else {
      input.style.cssText = [
        "box-sizing:border-box",
        "width:" + (controlWidth && controlWidth !== "auto" ? "100%" : "auto"),
        "border:1px solid " + __cb_safeCssColor(theme.border, "rgba(148,163,184,0.55)"),
        "border-radius:8px",
        "padding:7px 9px",
        "background:rgba(255,255,255,0.08)",
        "color:inherit",
        "font:inherit",
        "outline:none",
        "appearance:auto",
        type === "textarea" ? "resize:none" : ""
      ].join(";");
      if (controlHeight) input.style.height = controlHeight;
      if (type === "button") {
        input.style.background = __cb_safeCssColor(theme.accent, "#2563eb");
        input.style.color = __cb_safeCssColor(theme.buttonForeground, "#ffffff");
        input.style.cursor = "pointer";
        input.style.userSelect = "none";
      }
    }
  }

  body.appendChild(wrap);
}

function __cb_renderPanel(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const groupId = String(snapshot.groupId || "");
  const panelId = String(snapshot.id || "");
  if (!groupId || !panelId) return null;
  const key = __cb_panelKey(groupId, panelId);
  const position = __cb_PANEL_POSITIONS.includes(snapshot.position) ? snapshot.position : "bottom-right";
  const stack = __cb_ensurePanelStack(position);
  if (!stack) return null;
  let panelEl = __cb_activePanelElements.get(key);
  let isNewPanel = false;
  if (!panelEl || !panelEl.isConnected) {
    panelEl = document.createElement("section");
    __cb_activePanelElements.set(key, panelEl);
    isNewPanel = true;
  }
  const snapshotKey = __cb_panelSnapshotKey(snapshot);
  const alreadyMounted = panelEl.parentNode === stack;
  if (
    alreadyMounted &&
    panelEl.getAttribute("data-cb-panel-snapshot") === snapshotKey
  ) {
    if (__cb_patchPanelInPlace(panelEl, snapshot)) {
      return key;
    }
  }
  // If the user is actively interacting with a control in this panel (dragging a
  // slider, typing, picking a date), a destructive full rebuild would reset the
  // value and drop focus — e.g. making a range slider impossible to drag to the
  // end when the rule re-renders the panel on each input. Prefer an in-place
  // patch (which defers focused values); if the change is too structural for a
  // patch, skip this render and let the next one rebuild once interaction ends.
  if (alreadyMounted && __cb_panelHasActiveControl(panelEl)) {
    if (__cb_patchPanelInPlace(panelEl, snapshot)) {
      panelEl.setAttribute("data-cb-panel-snapshot", snapshotKey);
    }
    return key;
  }
  panelEl.setAttribute("data-cb-panel-group-id", groupId);
  panelEl.setAttribute("data-cb-panel-id", panelId);
  panelEl.setAttribute("data-cb-panel-position", position);
  panelEl.setAttribute("data-cb-panel-snapshot", snapshotKey);
  panelEl.setAttribute("role", __cb_safePanelRole(snapshot.role, "region"));
  if (snapshot.ariaLabel) {
    panelEl.setAttribute("aria-label", __cb_safePanelText(snapshot.ariaLabel, 240));
  } else {
    panelEl.removeAttribute("aria-label");
  }
  panelEl.textContent = "";

  const theme = snapshot.theme && typeof snapshot.theme === "object" ? snapshot.theme : {};
  const background = __cb_safeCssColor(theme.background, "rgba(15,23,42,0.96)");
  const foreground = __cb_safeCssColor(theme.foreground, "#f8fafc");
  const border = __cb_safeCssColor(theme.border, "rgba(148,163,184,0.45)");
  const fontSize = __cb_safeCssSize(snapshot.textSize || theme.fontSize, "13px");
  const titleSize = __cb_safeCssSize(theme.titleSize, "14px");
  const align = ["left", "center", "right"].includes(snapshot.align) ? snapshot.align : "left";
  const layout = String(snapshot.layout || "vertical");
  const width = snapshot.width === "small"
    ? "220px"
    : snapshot.width === "medium"
      ? "280px"
      : snapshot.width === "large"
        ? "360px"
        : snapshot.width
          ? __cb_safeCssSize(snapshot.width, "fit-content")
          : "fit-content";

  panelEl.style.cssText = [
    "box-sizing:border-box",
    "pointer-events:auto",
    "width:" + width,
    "min-width:0",
    "max-width:calc(100vw - 16px)",
    // Tall panels (long forms, html mounts, center dialogs) must stay within the
    // viewport and scroll their own content — otherwise the bottom is clipped by
    // the fixed stack and the wheel can't reach it.
    "max-height:calc(100vh - 16px)",
    "overflow-y:auto",
    "overscroll-behavior:contain",
    "background:" + background,
    "color:" + foreground,
    "border:1px solid " + border,
    "border-radius:14px",
    "box-shadow:0 14px 40px rgba(0,0,0,0.32)",
    "padding:12px",
    "font:" + fontSize + "/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "text-align:" + align,
    "display:flex",
    "flex-direction:column",
    "gap:9px"
  ].join(";");
  panelEl.onkeydown = (ev) => {
    if (ev.target === panelEl) {
      const keyInfo = __cb_keyEventInfo(ev);
      __cb_sendPanelEvent(panelEl, { id: "", type: "panel" }, "key", keyInfo.key, {
        key: keyInfo.key,
        code: keyInfo.code,
        keyInfo
      });
    }
  };

  const title = __cb_safePanelText(snapshot.title || "", 240);
  if (title) {
    const titleEl = document.createElement("div");
    titleEl.setAttribute("data-cb-panel-title", "1");
    titleEl.textContent = title;
    titleEl.style.cssText = "font-weight:700;font-size:" + titleSize + ";";
    panelEl.appendChild(titleEl);
  }
  const description = __cb_safePanelText(snapshot.description || "", 1000);
  if (description) {
    const descEl = document.createElement("div");
    descEl.setAttribute("data-cb-panel-description", "1");
    descEl.textContent = description;
    descEl.style.cssText = "opacity:0.82;white-space:pre-wrap;word-break:break-word;";
    panelEl.appendChild(descEl);
  }
  const body = document.createElement("div");
  body.setAttribute("data-cb-panel-body", "1");
  body.style.cssText = __cb_panelLayoutStyle(layout, align);
  for (const control of __cb_sortedPanelControls(snapshot.controls)) {
    __cb_appendPanelControl(panelEl, body, control, theme);
  }
  panelEl.appendChild(body);

  stack.appendChild(panelEl);
  if (isNewPanel) {
    __cb_sendPanelEvent(panelEl, { id: "", type: "panel" }, "mount", true);
  }
  const autoFocus = panelEl.querySelector("[data-cb-panel-autofocus='1']");
  if (autoFocus && typeof autoFocus.focus === "function") {
    try { autoFocus.focus({ preventScroll: true }); } catch (_) { try { autoFocus.focus(); } catch (_) {} }
  } else if (snapshot.autoFocus === true) {
    panelEl.tabIndex = -1;
    try { panelEl.focus({ preventScroll: true }); } catch (_) { try { panelEl.focus(); } catch (_) {} }
  }
  return key;
}

function __cb_applyPanelSnapshots(panelSnapshots, panelGroups) {
  const snapshots = Array.isArray(panelSnapshots) ? panelSnapshots : [];
  const groups = new Set(Array.isArray(panelGroups) ? panelGroups.filter((id) => typeof id === "string") : []);
  const incoming = new Set();
  const sortedSnapshots = snapshots.slice().sort((a, b) => {
    const pa = Number(a?.priority) || 0;
    const pb = Number(b?.priority) || 0;
    if (pb !== pa) return pb - pa;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
  for (const snapshot of sortedSnapshots) {
    const key = __cb_renderPanel(snapshot);
    if (key) incoming.add(key);
  }
  if (groups.size > 0) {
    for (const key of Array.from(__cb_activePanelElements.keys())) {
      const groupId = key.split(":")[0];
      if (groups.has(groupId) && !incoming.has(key)) __cb_removePanel(key);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Custom rules on this page. The rules run in the worker's sandbox
// (rule-core.js). The page tells them what it shows — the "items" event, only
// while a rule handles it — and does what they ask ("rule-apply": item
// verdicts, element operations, queries and the cover; "rule-sheets": the
// style sheets the worker holds for this page; "rule-lift": a disabled rule).
// ────────────────────────────────────────────────────────────────────────

let cbRuleItemsEpoch = 0; // the worker's; 0 = no rule wants items
let cbRuleRefs = new Map(); // ref -> card
let cbRuleCardRefs = new WeakMap(); // card -> ref
let cbRuleRefSeq = 0;
let cbRuleSent = new WeakMap(); // card -> the item last sent
let cbRulePageSent = "";
let cbRuleScanTimer = null;
let cbRuleObserver = null;
const cbRuleStyles = new Map(); // "<group id>␟<id>" -> <style>

function cbRuleCardTitle(card) {
  for (const selector of ["#video-title", "h3", "h2", "[title]"]) {
    const el = card.querySelector(selector);
    const text = String((el && (el.getAttribute("title") || el.textContent)) || "").trim();
    if (text) return text.slice(0, 500);
  }
  return String(card.querySelector("[aria-label]")?.getAttribute("aria-label") || "").trim().slice(0, 500);
}

function cbRuleItem(ref, url, title, data, isPage) {
  return {
    ref,
    url,
    title,
    authors: data.creators || [],
    videoForm: data.videoForm || "unknown",
    tags: [...data.tags].map((tag) => ({ name: tag.name, confidence: tag.confidence })),
    tagsSettled: data.tags.settled === true,
    isPage
  };
}

function cbRuleCardRef(card) {
  let ref = cbRuleCardRefs.get(card);
  if (!ref) {
    ref = "i" + (++cbRuleRefSeq);
    cbRuleCardRefs.set(card, ref);
  }
  cbRuleRefs.set(ref, card);
  return ref;
}

// Sends the platform page's items that are new or changed since they were
// last sent, and the page itself (ref "page").
function cbScanRuleItems() {
  cbRuleScanTimer = null;
  if (!cbRuleItemsEpoch || exitAttempted || extensionContextInvalid) return;
  const platform = getCurrentFeedSite();
  if (!platform) return;
  for (const [ref, card] of cbRuleRefs) if (!card.isConnected) cbRuleRefs.delete(ref);
  const items = [];
  for (const card of getFeedCardElements(platform)) {
    const data = getFeedCardData(card);
    if (!data) continue;
    let url = "";
    try { url = new URL(getFeedCardHref(card, platform) || "", location.origin).href; } catch {}
    const item = cbRuleItem(cbRuleCardRef(card), url, cbRuleCardTitle(card), data, false);
    const sent = JSON.stringify(item);
    if (cbRuleSent.get(card) === sent) continue;
    cbRuleSent.set(card, sent);
    items.push(item);
  }
  const page = cbRuleItem("page", location.href, document.title, {
    creators: collectPlatformAuthors(location.pathname, platform === "youtube")[platform] || [],
    videoForm: detectVideoSiteContext(normalizeHostname(location.hostname), location.pathname).form,
    tags: cbTagPageContext ? getFeedCardTags(cbTagPageContext.root) : Object.assign([], { settled: false })
  }, true);
  const pageSent = JSON.stringify(page);
  if (pageSent !== cbRulePageSent) {
    cbRulePageSent = pageSent;
    items.push(page);
  }
  if (items.length > 0) safeSendMessage({ type: "rule-items", platform, items });
}

function cbScheduleRuleItems() {
  if (cbRuleItemsEpoch && cbRuleScanTimer === null) cbRuleScanTimer = setTimeout(cbScanRuleItems, 250);
}

// The session says whether a rule wants items (a new epoch: send them all again).
function cbSetRuleItemsEpoch(epoch) {
  const next = Number(epoch) || 0;
  if (next === cbRuleItemsEpoch) return;
  cbRuleItemsEpoch = next;
  cbRuleSent = new WeakMap();
  cbRulePageSent = "";
  if (next && !cbRuleObserver && document.documentElement) {
    cbRuleObserver = new MutationObserver(cbScheduleRuleItems);
    cbRuleObserver.observe(document.documentElement, { childList: true, subtree: true });
  } else if (!next) {
    cbStopRuleItems();
  }
  cbScheduleRuleItems();
}

function cbStopRuleItems() {
  if (cbRuleObserver) cbRuleObserver.disconnect();
  cbRuleObserver = null;
  if (cbRuleScanTimer !== null) clearTimeout(cbRuleScanTimer);
  cbRuleScanTimer = null;
}

function cbRuleDomOp({ selector, op, arg }) {
  let nodes = [];
  try { nodes = [...document.querySelectorAll(selector)]; } catch { return; }
  for (const el of nodes) {
    if (op === "hide") el.style.setProperty("display", "none", "important");
    else if (op === "show") el.style.removeProperty("display");
    else if (op === "click") el.click?.();
    else if (op === "setText") el.textContent = arg ?? "";
    else if (op === "addClass" && arg) el.classList.add(arg);
    else if (op === "removeClass" && arg) el.classList.remove(arg);
    else if (op === "scrollTo") { el.scrollIntoView?.({ behavior: "smooth" }); break; }
  }
}

// A rule's v.query: the matching elements, read-only and bounded.
function cbRuleQuery(selector) {
  let nodes;
  try { nodes = [...document.querySelectorAll(selector)].slice(0, 50); } catch (error) { return { matches: [], error: "invalid-selector" }; }
  const attr = (el, name) => (el.getAttribute(name) || "").slice(0, 2000);
  return {
    matches: nodes.map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: String(el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1000),
      href: el.href ? String(el.href).slice(0, 2000) : attr(el, "href"),
      src: el.src ? String(el.src).slice(0, 2000) : attr(el, "src"),
      title: attr(el, "title"),
      label: attr(el, "aria-label"),
      value: typeof el.value === "string" ? el.value.slice(0, 1000) : ""
    })),
    error: ""
  };
}

// The rules' style sheets for this page, as the worker holds them: the page
// carries exactly these (a disabled group's are gone).
function cbSetRuleSheets(sheets) {
  const wanted = new Map((Array.isArray(sheets) ? sheets : []).map((sheet) => [sheet.key, sheet.css]));
  for (const [key, style] of cbRuleStyles) {
    if (!wanted.has(key)) { style.remove(); cbRuleStyles.delete(key); }
  }
  for (const [key, css] of wanted) {
    let style = cbRuleStyles.get(key);
    if (!style) {
      style = document.createElement("style");
      cbRuleStyles.set(key, style);
    }
    if (style.textContent !== css) style.textContent = css;
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
  }
}

// A disabled or removed group: what its rule did on this page is lifted
// (its cover and its card verdicts; its sheets and panels come separately).
function cbLiftRule(groupId) {
  if (cbCover.ruleCover && cbCover.ruleCover.groupId === groupId) cbSetRuleCover(null);
  for (const card of [...cbTrackedCards]) {
    if (!card.isConnected) { cbTrackedCards.delete(card); continue; }
    const entry = cbVerdictLedger.get(card);
    if (entry && entry.has(groupId)) {
      cbSetCardVerdict(card, groupId, null);
      cbApplyCard(card);
    }
  }
}

// What the rules asked of this page.
function cbApplyRuleMessage(message) {
  for (const { groupId, ref, verdict } of message.items || []) {
    const card = cbRuleRefs.get(ref);
    if (!card) continue;
    cbSetCardVerdict(card, groupId, verdict, "custom");
    cbApplyCard(card);
  }
  for (const op of message.dom || []) cbRuleDomOp(op);
  if (message.cover) cbSetRuleCover(message.cover);
  for (const { groupId, requestId, selector } of message.queries || []) {
    safeSendMessage({ type: "rule-query", groupId, requestId, selector, ...cbRuleQuery(selector) });
  }
}

// ────────────────────────────────────────────────────────────────────────
// Feed replenishment (generalised across every platform with a feed)
//
// When the filter hides cards, the collapsed grid can stall the platform's own
// infinite-scroll loader, leaving a short feed. The earlier "scroll then
// restore" approach caused visible up/down flicker and over-stretched the feed.
//
// This version:
//   • Only refills when the user is already near the bottom of the loaded feed,
//     so we never nudge (or move the page) while they're reading mid-feed. The
//     resulting scroll move is small and downward, with NO restore — so there is
//     no up/down bounce/flicker.
//   • Bounds refills per "bottom episode" to roughly the number of cards that
//     are currently hidden, so the replacement feed is ~equal to what was
//     blocked instead of growing without limit (which is what stretched a
//     heavily-filtered feed very long).
// ────────────────────────────────────────────────────────────────────────

let __cb_replenishInFlight = false;
let __cb_replenishBurstCount = 0;
let __cb_replenishBurstResetTimer = null;
const __CB_REPLENISH_BURST_MAX = 4;

// Per "stall episode" state. An episode begins when the filtered feed becomes
// too short to scroll (the platform's own infinite-scroll loader is stalled).
let __cb_feedSite = null;
let __cb_feedStalled = false;
let __cb_episodeBaselineTotal = 0;
let __cb_episodeCap = 0;

// Count feed cards currently hidden. Both platform and custom rules now hide
// through the shared cascade marker, so one check covers both.
function __cb_countHiddenFeedCards(cards) {
  let hidden = 0;
  for (const card of cards) {
    if (card?.dataset?.customBlockerFeedHidden === "true") hidden += 1;
  }
  return hidden;
}

// Decide whether to refill.
//
// We ONLY assist when the page is too short to scroll — i.e. filtering collapsed
// the feed below ~half a screen of scroll room, which is exactly when the
// platform's native infinite-scroll loader stalls. On a normal (long) feed we
// do nothing at all: no nudge, no scroll, so browsing never bounces. Within a
// stall episode we cap refills to ~the number of hidden cards so the
// replacement feed stays roughly equal to what was blocked.
function __cb_maybeReplenishFeed(site) {
  const resolvedSite = site || getCurrentFeedSite();
  if (!resolvedSite) return;
  if (resolvedSite !== __cb_feedSite) {
    __cb_feedSite = resolvedSite;
    __cb_feedStalled = false;
  }

  const scroller = document.scrollingElement || document.documentElement;
  if (!scroller) return;
  const vh = window.innerHeight || scroller.clientHeight || 0;
  const scrollable = scroller.scrollHeight - scroller.clientHeight;
  const stalled = scrollable <= vh * 0.5;
  if (!stalled) {
    __cb_feedStalled = false;
    return;
  }

  const cards = getFeedCardElements(resolvedSite) || [];
  const total = cards.length;
  const hiddenNow = __cb_countHiddenFeedCards(cards);

  // Entering a fresh stall episode: snapshot how much we may refill — roughly
  // the number of cards hidden, so the replacement count ≈ the blocked count
  // rather than growing unbounded.
  if (!__cb_feedStalled) {
    __cb_feedStalled = true;
    __cb_episodeBaselineTotal = total;
    __cb_episodeCap = hiddenNow;
  }

  if (hiddenNow === 0 || __cb_episodeCap === 0) return;
  const loadedThisEpisode = Math.max(0, total - __cb_episodeBaselineTotal);
  if (loadedThisEpisode >= __cb_episodeCap) return;

  __cb_nudgeFeedLoad(resolvedSite);
}

function __cb_nudgeFeedLoad(site) {
  if (__cb_replenishInFlight) return;
  if (__cb_replenishBurstCount >= __CB_REPLENISH_BURST_MAX) return;

  const resolvedSite = site || getCurrentFeedSite();
  const profile =
    typeof PLATFORM_PROFILES !== "undefined" ? PLATFORM_PROFILES[resolvedSite] : null;
  const recipe = profile?.feed?.replenish;
  if (!recipe) return;

  // We only get here when the feed is too short to scroll, so these moves are
  // tiny (and `block: "nearest"` moves the minimum needed to reveal the target).
  // We deliberately do NOT restore the scroll position afterwards — restoring is
  // what produced the up/down flicker.
  let nudged = false;
  if (recipe.sentinel) {
    const sentinel = document.querySelector(recipe.sentinel);
    if (sentinel && typeof sentinel.scrollIntoView === "function") {
      try { sentinel.scrollIntoView({ block: "nearest" }); nudged = true; } catch {}
    }
  }
  if (!nudged) {
    try {
      const cards = getFeedCardElements(resolvedSite);
      const last = cards[cards.length - 1];
      if (last && typeof last.scrollIntoView === "function") {
        last.scrollIntoView({ block: "nearest" });
        nudged = true;
      } else {
        const scroller = document.scrollingElement || document.documentElement;
        if (scroller) { scroller.scrollTop = scroller.scrollHeight; nudged = true; }
      }
    } catch {}
  }
  if (!nudged) return;

  __cb_replenishInFlight = true;
  __cb_replenishBurstCount += 1;
  window.setTimeout(() => { __cb_replenishInFlight = false; }, 700);
  // After the feed settles, clear the burst counter so a later episode can
  // refill again.
  if (__cb_replenishBurstResetTimer !== null) window.clearTimeout(__cb_replenishBurstResetTimer);
  __cb_replenishBurstResetTimer = window.setTimeout(() => { __cb_replenishBurstCount = 0; }, 4000);
}

function __cb_announceContentReady() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
  try {
    chrome.runtime.sendMessage({ type: "content-ready" }).then((response) => {
      if (!response || !response.ok) return;
      const pending = Array.isArray(response.pending) ? response.pending : [];
      for (const message of pending) {
        try { cbApplyRuleMessage(message); } catch (error) {
          cbDebugWarn("[CustomBlocker] failed to apply queued message", error);
        }
      }
    }).catch(() => {});
  } catch {}
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", __cb_announceContentReady, { once: true });
} else {
  // Wait one tick to give the toast container a stable body to attach to.
  setTimeout(__cb_announceContentReady, 0);
}

if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;
    // The worker saw this page's address change without a load (history API,
    // a new #hash): the one navigation signal (Chromium first, owner
    // 2026-09-27).
    if (message.type === "page-navigated") {
      if (location.href !== lastKnownUrl) cbOnNavigated();
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "session-refresh") {
      scheduleRefreshSession(0);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "cover-media") {
      if (message.paused) cbPauseAllMedia();
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "rule-sheets") {
      cbSetRuleSheets(message.sheets);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "rule-lift") {
      cbLiftRule(String(message.groupId || ""));
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "custom-panels-refresh") {
      refreshPanels(Array.isArray(message.panelGroups) ? message.panelGroups : []);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type !== "rule-apply") return false;
    try {
      cbApplyRuleMessage(message);
      sendResponse({ ok: true });
      return true;
    } catch (error) {
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      return true;
    }
  });
}
