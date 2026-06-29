// Debug-mode-gated console helpers, mirrored from background.js. Off
// by default so an idle page is silent in DevTools. Toggle via
// Settings → Debug mode.
let cbDebugMode = false;
let cbShowOnPageLogToasts = true;
function cbDebugLog(...args) { if (cbDebugMode) { try { console.log(...args); } catch (_) {} } }
function cbDebugWarn(...args) { if (cbDebugMode) { try { console.warn(...args); } catch (_) {} } }
function cbDebugError(...args) { if (cbDebugMode) { try { console.error(...args); } catch (_) {} } }
function cbApplyGlobalSettings(settings) {
  const s = settings && typeof settings === "object" ? settings : {};
  cbDebugMode = s.debugMode === true;
  cbShowOnPageLogToasts = s.showOnPageLogToasts !== false;
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
 *   - Apply feed-card filtering for legacy platform/Reddit groups
 *     (driven by `feedFilters` in the session payload).
 *   - Compile and run all enabled custom rules (which now live in the
 *     content script, not the background worker), using the helpers from
 *     helpers.js. Side effects:
 *       * mutate per-group timer / persistence buckets in memory and
 *         flush them back to the background on the next heartbeat,
 *       * register platform "intents" that this script then applies to
 *         the DOM (hide buttons, hide feed cards by predicate, page-level
 *         exit when blockPageOnVisit is true),
 *       * a rule returning `true` exits the page.
 *   - Exit the page when the background says so OR when any custom rule
 *     says so.
 */

const helperBundle = self.__customBlockerHelpers;

const PLATFORM_LIST = helperBundle?.PLATFORM_LIST ?? [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
  "twitch"
];

function normalizeHostname(hostname) {
  const trimmed = String(hostname ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
}

// Entity/mode normalisation, host predicates, path parsers and
// detectVideoSiteContext now live in platform-profiles.js (loaded as the
// first content script) and are available here as globals:
//   normalizeYouTubeCreatorInput, normalizePlatformAuthorInput,
//   normalizeRedditSubredditInput, normalizeDiscordTargetInput,
//   isYouTubeHost, isRedditHost, isDiscordHost, isTwitterHost,
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

const DAY_NAMES = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
];

function getDayNameForDate(date) {
  const day = date.getDay();
  return DAY_NAMES[(day + 6) % 7];
}

function formatDayName(name) {
  return String(name).slice(0, 1).toUpperCase() + String(name).slice(1);
}

// ────────────────────────────────────────────────────────────────────────
// Module state.
// ────────────────────────────────────────────────────────────────────────

let overlay = null;
let exitAttempted = false;
let heartbeatIntervalId = null;
let navigationPollIntervalId = null;
let lastHeartbeatAt = Date.now();
let lastKnownUrl = location.href;
let lastSessionRefreshAt = 0;
let refreshDebounceTimeoutId = null;
let feedObserver = null;
let feedApplyRafId = null;
let latestFeedFilters = [];
let latestSurfaceHides = [];
// Group ids whose platform filter currently matches content on this page.
// Reported with the heartbeat so the usage timer only accrues on exposure.
let latestExposedGroupIds = [];
let extensionContextInvalid = false;
let sessionFallbackUrl = "";
let sessionSkipToNext = false;
let consecutiveSkipCount = 0;

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
  if (navigationPollIntervalId !== null) {
    window.clearInterval(navigationPollIntervalId);
    navigationPollIntervalId = null;
  }
  if (overlay?.container?.parentNode) {
    overlay.container.parentNode.removeChild(overlay.container);
  }
  overlay = null;
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

function getFeedCardElements(site) {
  if (site === "reddit") {
    const selectors = [
      "shreddit-post",
      "shreddit-ad-post",
      "article:has(shreddit-post)",
      "faceplate-tracker[source=\"search\"] shreddit-post",
      "div.thing[data-subreddit]"
    ];
    const containers = new Set();
    for (const selector of selectors) {
      let nodes = [];
      try { nodes = document.querySelectorAll(selector); } catch { continue; }
      for (const node of nodes) containers.add(node.closest?.("article") ?? node);
    }
    return [...containers];
  }

  if (site === "twitter") {
    const containers = new Set();
    for (const tweet of document.querySelectorAll('article[data-testid="tweet"]')) {
      containers.add(tweet.closest('[data-testid="cellInnerDiv"]') ?? tweet);
    }
    return [...containers];
  }

  if (site === "youtube") {
    // Each wrapper covers a different YouTube rollout/surface for shorts.
    return [
      ...document.querySelectorAll(
        [
          "ytd-rich-item-renderer",
          "ytd-video-renderer",
          "ytd-grid-video-renderer",
          "ytd-compact-video-renderer",
          "ytd-reel-item-renderer",
          "ytd-rich-grid-media",
          "yt-lockup-view-model",
          "yt-shorts-lockup-view-model",
          "ytm-shorts-lockup-view-model-v2",
          "ytd-post-renderer",
          "ytd-backstage-post-thread-renderer",
          "ytd-backstage-post-renderer"
        ].join(", ")
      )
    ];
  }

  const anchorSelectors =
    site === "tiktok"
      ? ['a[href*="/video/"]']
      : site === "instagram"
        ? ['a[href^="/reel/"]', 'a[href^="/p/"]', 'a[href^="/tv/"]']
      : site === "facebook"
        ? ['a[href*="/reel/"]', 'a[href*="/watch/"]', 'a[href*="/posts/"]', 'a[href*="/permalink/"]']
      : site === "twitch"
        ? ['a[href*="/clip/"]', 'a[href^="/videos/"]']
      : [];

  if (anchorSelectors.length === 0) return [];

  const containers = new Set();
  const containerSelector = [
    "article",
    '[role="article"]',
    '[data-e2e*="item"]',
    '[data-testid*="cell"]',
    '[data-pagelet]',
    "li"
  ].join(", ");

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
    const preferredSelector =
      site === "tiktok"
        ? 'a[href*="/video/"]'
        : site === "instagram"
          ? 'a[href^="/reel/"], a[href^="/p/"], a[href^="/tv/"]'
        : site === "facebook"
          ? 'a[href*="/reel/"], a[href*="/watch/"], a[href*="/posts/"], a[href*="/permalink/"]'
        : site === "twitch"
          ? 'a[href*="/clip/"], a[href^="/videos/"]'
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

  if (identifiers.size === 0) {
    const fallbackContainer = card.closest(
      "ytd-reel-shelf-renderer, ytd-rich-section-renderer, ytd-item-section-renderer"
    );
    collectFromScope(fallbackContainer);
  }

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
  if (isTwitterHost(hostname)) return "twitter";
  return null;
}

function getFeedCardData(card) {
  const currentSite = getCurrentFeedSite();
  if (currentSite === "reddit") {
    return { redditSubreddit: extractRedditSubredditFromCard(card) };
  }
  if (currentSite === "twitter") {
    const creators = [
      ...new Set(
        [...card.querySelectorAll('a[role="link"][href^="/"], a[href^="/"]')]
          .map((anchor) => normalizeTwitterHandleInput(anchor.getAttribute("href")))
          .filter(Boolean)
      )
    ];
    return { videoForm: "post", creators };
  }
  if (currentSite !== "youtube") {
    const href = getFeedCardHref(card, currentSite);
    if (!href) return null;
    let url;
    try { url = new URL(href, location.origin); } catch { return null; }
    const videoContext = detectVideoSiteContext(normalizeHostname(url.hostname), url.pathname);
    const creators = [
      ...new Set(
        [...card.querySelectorAll("a[href]")]
          .map((anchor) => normalizePlatformAuthorInput(anchor.getAttribute("href"), currentSite))
          .filter(Boolean)
      )
    ];
    return { videoForm: videoContext.form, creators };
  }
  if (isPostCard(card)) {
    return { videoForm: "post", creators: getFeedCardCreators(card) };
  }
  const href = getFeedCardHref(card, "youtube");
  if (!href) return null;
  let url;
  try { url = new URL(href, location.origin); } catch { return null; }
  const videoContext = detectVideoSiteContext(normalizeHostname(url.hostname), url.pathname);
  return { videoForm: videoContext.form, creators: getFeedCardCreators(card) };
}

function matchesFeedFilter(cardData, filter) {
  if (!cardData || !filter) return false;
  if (filter.site === "reddit") {
    if (!cardData.redditSubreddit) return false;
    const subreddits = Array.isArray(filter.subreddits) ? filter.subreddits : [];
    if (filter.redditMode === "include") return subreddits.includes(cardData.redditSubreddit);
    if (filter.redditMode === "exclude") return !subreddits.includes(cardData.redditSubreddit);
    return false;
  }
  if (filter.videoMode === "short" || filter.videoMode === "long" || filter.videoMode === "post") {
    if (cardData.videoForm !== filter.videoMode) return false;
  }
  if (filter.authorMode === "all") return true;
  // "nobody" / tag stubs never trim by author (and aren't emitted as filters).
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

// ────────────────────────────────────────────────────────────────────────
// Shared feed-hide engine (default / platform rules AND custom rules)
//
// Both rule kinds are just per-group verdicts over the same card, recorded
// into one per-card ledger tagged by source ("platform" | "custom"). The
// resolver picks the winner by group list order — the TOP-most group that has
// an opinion decides — so the outcome is independent of the sync-platform vs
// async-custom timing race.
//
//   • Order/effect come from the background ("feedOrder"): list position
//     (index 0 = top = highest priority) and a per-group effect.
//   • effect "allow" turns a match into a rescue verdict that overrides a
//     lower-priority block group; "block" hides. Only platform-profile groups
//     can be "allow" (enforced in the background); custom/default are always
//     "block".
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
let cbGroupEffect = new Map(); // groupId -> "block" | "allow"
let cbGroupOrderKey = "";

function cbSetGroupOrder(order) {
  const key = Array.isArray(order)
    ? order.map((g) => `${g && g.id}:${g && g.effect === "allow" ? "a" : "b"}`).join("|")
    : "";
  const changed = key !== cbGroupOrderKey;
  cbGroupOrderKey = key;
  cbGroupIndex = new Map();
  cbGroupEffect = new Map();
  if (Array.isArray(order)) {
    order.forEach((group, index) => {
      if (!group || typeof group.id !== "string") return;
      cbGroupIndex.set(group.id, index);
      cbGroupEffect.set(group.id, group.effect === "allow" ? "allow" : "block");
    });
  }
  // Custom verdicts bake in priority/effect at evaluation time and are skipped
  // by the signature cache; if order/effect changed, force re-evaluation so
  // they resolve against the new priorities. (Platform verdicts re-derive every
  // pass, so they need nothing here.)
  if (changed) {
    cbResetCustomSigCache();
    if (
      typeof __cb_activePredicateSlots !== "undefined" &&
      __cb_activePredicateSlots.size > 0 &&
      typeof __cb_schedulePredicateScan === "function"
    ) {
      __cb_schedulePredicateScan();
    }
  }
}

function cbEffectVerdict(groupId) {
  return cbGroupEffect.get(groupId) === "allow" ? "allow" : "hide";
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

// Resolve from the ordered ledger: the lowest-index (top-most) group with an
// opinion decides. Returns true if the card should be hidden.
function cbResolveCardHidden(card) {
  const entry = cbVerdictLedger.get(card);
  if (!entry || entry.size === 0) return false;
  let bestIndex = Infinity;
  let bestVerdict = null;
  for (const [groupId, value] of entry) {
    const index = cbGroupIndex.has(groupId)
      ? cbGroupIndex.get(groupId)
      : Number.MAX_SAFE_INTEGER;
    if (index < bestIndex) {
      bestIndex = index;
      bestVerdict = value.v;
    }
  }
  return bestVerdict === "hide";
}

function cbApplyCard(card) {
  if (cbResolveCardHidden(card)) hideElement(card);
  else showElement(card);
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

  if (filter.videoMode === "short") {
    anchorSelectors = ['a[href="/shorts"]', 'a[href^="/shorts?"]', 'a[title="Shorts"]'];
  } else if (filter.videoMode === "post") {
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
  if (filter.videoMode === "short") {
    shelfSelectors = [
      "ytd-reel-shelf-renderer",
      "ytd-rich-shelf-renderer[is-shorts]",
      "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
      "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)",
      "ytd-item-section-renderer:has(ytd-reel-shelf-renderer)",
      "ytd-shelf-renderer:has(a[href^='/shorts/'])"
    ];
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
  let shelves = [];
  try { shelves = [...document.querySelectorAll(shelfSelectors.join(", "))]; } catch { shelves = []; }
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
          if (!matchesFeedFilter(cardData, filter)) continue;
          // Exposure: a match means the group's usage timer should accrue,
          // regardless of whether we hide the card right now.
          exposed.add(filter.id);
          const verdict = cbEffectVerdict(filter.id);
          // Allow filters always rescue; block filters only hide while
          // enforcing (instant, or a count-down past its allowance).
          if (verdict === "allow" || filter.enforce !== false) {
            cbSetCardVerdict(card, filter.id, verdict, "platform");
          }
        }
      }
    }
    cbApplyCard(card);
  }

  latestExposedGroupIds = [...exposed];

  // Refill what enforcement removed (only when the feed is too short to scroll).
  __cb_maybeReplenishFeed(currentSite);
}

// Nav buttons / shelves (e.g. the Shorts shelf) are page chrome, not feed
// cards, so they're hidden via the surface-hide marker (restored each pass by
// applySurfaceHides) rather than entering the per-card cascade. Allow-effect
// filters are exceptions and never hide chrome.
function applyNavShelfHides() {
  const currentSite = getCurrentFeedSite();
  if (currentSite !== "youtube") return;
  for (const filter of latestFeedFilters) {
    if (filter?.site !== "youtube") continue;
    if (filter.enforce === false) continue;
    if (cbEffectVerdict(filter.id) === "allow") continue;
    for (const navElement of collectNavElementsToHide(filter)) hideSurfaceElement(navElement);
    for (const shelfElement of collectFormShelvesToHide(filter)) hideSurfaceElement(shelfElement);
  }
}

function scheduleApplyFeedFilters() {
  if (feedApplyRafId !== null) return;
  feedApplyRafId = window.requestAnimationFrame(() => applyFeedFilters());
}

function updateFeedFilters(filters) {
  latestFeedFilters = Array.isArray(filters) ? filters : [];
  reconcilePageMutations();
}

// Surface hides ("hide elements" toggles) are plain CSS-selector hides driven
// by the active platform groups. They share the page MutationObserver with
// the feed filters but use a separate hidden marker so each can restore
// independently.
function updateSurfaceHides(selectors) {
  latestSurfaceHides = Array.isArray(selectors) ? selectors.filter(Boolean) : [];
  reconcilePageMutations();
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
  const map = { youtube: [], tiktok: [], facebook: [], instagram: [], twitch: [], twitter: [] };
  if (isYouTubePage) map.youtube = collectYouTubeCreatorIdentifiers();
  for (const groupType of ["youtube", "tiktok", "facebook", "instagram", "twitch", "twitter"]) {
    const fromPath = extractPrimaryAuthorFromPath(groupType, pathname, location.href);
    if (fromPath && !map[groupType].includes(fromPath)) map[groupType].push(fromPath);
  }
  return map;
}

// Exact-case UC channel id of the page's primary channel (watch / channel
// pages). Case matters: tag-cache keys are case-sensitive UC ids, so unlike
// the author axis we must NOT lowercase. Best-effort, multiple DOM sources;
// returns null when the channel can't be resolved (callers fail open).
const CB_UC_RE = /(UC[0-9A-Za-z_-]{22})/;
function collectPageChannelId() {
  // Channel pages carry the exact id directly in the path.
  let m = location.pathname.match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
  if (m) return m[1];
  // Preferred source: yt-block.js shares our isolated world and resolves the
  // page's primary channel using ytInitialData / ytInitialPlayerResponse maps
  // (handle→UC, videoId→UC) that aren't available from the DOM alone. It is the
  // only reliable way to get a watch page's channel, since the owner byline is
  // a /@handle link, not /channel/UC.
  try {
    const shared = window.__cbPageChannelId;
    if (typeof shared === "string" && /^UC[0-9A-Za-z_-]{22}$/.test(shared)) return shared;
  } catch (_) {}
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    m = (canonical.getAttribute("href") || "").match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
    if (m) return m[1];
  }
  const meta = document.querySelector('meta[itemprop="channelId"]');
  if (meta) {
    m = (meta.getAttribute("content") || "").match(CB_UC_RE);
    if (m) return m[1];
  }
  // Scoped to the owner byline only — never the #related sidebar — so we can't
  // accidentally resolve to a recommended video's channel.
  const owner = document.querySelector(
    'ytd-watch-metadata #owner a[href*="/channel/UC"], ytd-video-owner-renderer a[href*="/channel/UC"]'
  );
  if (owner) {
    m = (owner.getAttribute("href") || "").match(/\/channel\/(UC[0-9A-Za-z_-]{22})/);
    if (m) return m[1];
  }
  return null;
}

function buildPageContext() {
  const hostname = normalizeHostname(location.hostname);
  const isYouTubePage = isYouTubeHost(hostname);
  const videoContext = detectVideoSiteContext(hostname, location.pathname);
  const isRedditPage = isRedditHost(hostname);
  const isDiscordPage = isDiscordHost(hostname);
  const isTwitterPage = isTwitterHost(hostname);
  const platformAuthors = collectPlatformAuthors(location.pathname, isYouTubePage);

  return {
    hostname,
    url: location.href,
    pathname: location.pathname,
    isYouTubePage,
    isYouTubeShort: location.pathname.startsWith("/shorts/"),
    platformAuthors,
    isRedditPage,
    redditSubreddit: isRedditPage ? parseRedditSubredditFromPath(location.pathname) : null,
    isDiscordPage,
    discordServerId: isDiscordPage ? parseDiscordServerIdFromPath(location.pathname) : null,
    discordChannelId: isDiscordPage ? parseDiscordChannelIdFromPath(location.pathname) : null,
    isTwitterPage,
    videoSite: videoContext.site,
    videoForm: videoContext.form,
    pageChannelId: isYouTubePage ? collectPageChannelId() : null
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
  nextOverlay.container.textContent = visibleItems
    .map((item) => {
      const value = item.displayMs ?? item.remainingMs ?? item.currentMs ?? 0;
      return `${item.name}: ${formatOverlayDurationMs(value)}`;
    })
    .join("\n");
}

function canScriptCloseWindow() {
  try { return Boolean(window.opener); } catch { return false; }
}

function getMainPageRedirectUrl() {
  const hostname = normalizeHostname(location.hostname);
  if (!hostname) return null;
  if (isYouTubeHost(hostname)) return "https://www.youtube.com/";
  if (isRedditHost(hostname)) return "https://www.reddit.com/";
  if (isDiscordHost(hostname)) return "https://discord.com/channels/@me";
  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) return "https://www.tiktok.com/";
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) return "https://www.instagram.com/";
  if (hostname === "facebook.com" || hostname.endsWith(".facebook.com")) return "https://www.facebook.com/";
  if (
    hostname === "twitch.tv" ||
    hostname.endsWith(".twitch.tv") ||
    hostname === "clips.twitch.tv"
  ) return "https://www.twitch.tv/";
  if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) return "https://vimeo.com/";
  if (hostname === "dailymotion.com" || hostname.endsWith(".dailymotion.com") || hostname === "dai.ly")
    return "https://www.dailymotion.com/";
  // Unknown hosts should fall back to about:blank. Redirecting to `${origin}/`
  // can trap us in a same-site reload loop when the entire host is blocked.
  return null;
}

function isMainPageView() {
  const hostname = normalizeHostname(location.hostname);
  const pathname = String(location.pathname || "/");
  const search = String(location.search || "");
  const hash = String(location.hash || "");
  if (isDiscordHost(hostname) && pathname === "/channels/@me" && search.length === 0 && hash.length === 0) return true;
  if (isYouTubeHost(hostname) && (pathname === "/" || pathname.startsWith("/feed/")) && search.length === 0 && hash.length === 0) return true;
  return pathname === "/" && search.length === 0 && hash.length === 0;
}

function tryRedirectToMainPage() {
  if (isMainPageView()) return false;
  const redirectUrl = getMainPageRedirectUrl();
  if (!redirectUrl) return false;
  try { location.replace(redirectUrl); } catch { location.href = redirectUrl; }
  return true;
}

function isScrollBasedVideoPage() {
  const hostname = normalizeHostname(location.hostname);
  const pathname = String(location.pathname || "/");
  if (isYouTubeHost(hostname) && pathname.startsWith("/shorts/")) return true;
  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) {
    return (
      (pathname.startsWith("/@") && pathname.includes("/video/")) ||
      pathname === "/" || pathname === "/following" || pathname === "/foryou"
    );
  }
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) {
    return pathname.startsWith("/reel/") || pathname === "/reels" || pathname.startsWith("/reels/");
  }
  return false;
}

function trySkipToNextVideo() {
  const hostname = normalizeHostname(location.hostname);
  const pathname = String(location.pathname || "/");

  if (isYouTubeHost(hostname) && pathname.startsWith("/shorts/")) {
    const nextBtn =
      document.querySelector("#navigation-button-down button") ||
      document.querySelector("ytd-shorts [aria-label*='Next']") ||
      document.querySelector("ytd-shorts [aria-label*='next']");
    if (nextBtn) { nextBtn.click(); return true; }
    const activeReel = document.querySelector("ytd-reel-video-renderer[is-active]");
    const nextAnchor = activeReel?.nextElementSibling?.querySelector("a#thumbnail, a.reel-item-endpoint");
    if (nextAnchor?.href) {
      try { location.replace(nextAnchor.href); } catch { location.href = nextAnchor.href; }
      return true;
    }
    return false;
  }
  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) {
    const nextBtn =
      document.querySelector('[data-e2e="arrow-right"]') ||
      document.querySelector('[data-e2e="feed-go-to-next-video"]') ||
      document.querySelector('button[aria-label*="Next"]') ||
      document.querySelector('button[aria-label*="next"]');
    if (nextBtn) {
      nextBtn.click();
    } else {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    }
    return true;
  }
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) {
    const nextBtn =
      document.querySelector('button[aria-label="Next"]') ||
      document.querySelector('[aria-label*="Next reel"]');
    if (nextBtn) { nextBtn.click(); return true; }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    return true;
  }
  return false;
}

function attemptExitPage() {
  if (exitAttempted) return;
  exitAttempted = true;

  if (overlay) overlay.container.textContent = "0:00";

  if (sessionSkipToNext && isScrollBasedVideoPage() && consecutiveSkipCount < 10) {
    if (trySkipToNextVideo()) {
      consecutiveSkipCount++;
      exitAttempted = false;
      return;
    }
  }
  consecutiveSkipCount = 0;

  if (sessionFallbackUrl) {
    try { location.replace(sessionFallbackUrl); } catch { location.href = sessionFallbackUrl; }
    return;
  }

  if (tryRedirectToMainPage()) return;
  if (canScriptCloseWindow()) window.close();
  try { location.replace("about:blank"); } catch { location.href = "about:blank"; }
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
    const elapsedMs = now - lastHeartbeatAt;
    lastHeartbeatAt = now;
    safeSendMessage(
      {
        type: "track-page-time",
        pageContext: buildPageContext(),
        elapsedMs,
        exposedGroupIds: latestExposedGroupIds
      },
      (session) => handleSession(session)
    );
  }, 250);
}

// Top-level session handler. Called every heartbeat with the background's
// response. Custom rules go through the sandbox, so this handler only
// processes site / platform-video group output.
function handleSession(session) {
  if (!session) return;
  if (extensionContextInvalid || exitAttempted) return;

  const now = Number.isFinite(session.now) ? session.now : Date.now();
  lastSessionRefreshAt = now;

  const items = Array.isArray(session.items) ? session.items : [];
  const shouldExitPage = Boolean(session.shouldExitPage);

  updateOverlay(items, !shouldExitPage && (session.showTimer || items.length > 0));
  // Order/effect must be set before applying filters so verdicts resolve
  // against the right priorities.
  cbSetGroupOrder(session.feedOrder);
  updateFeedFilters(session.feedFilters);
  updateSurfaceHides(session.surfaceHides);

  sessionFallbackUrl =
    typeof session.fallbackUrl === "string" ? session.fallbackUrl.trim() : "";
  sessionSkipToNext = Boolean(session.skipToNextOnBlock);

  if (!shouldExitPage) consecutiveSkipCount = 0;

  // Keep the heartbeat alive while platform feed filters are active even with no
  // visible timer, so exposure-based usage timers keep accruing on the feed.
  const hasActiveFeedFilters =
    Array.isArray(session.feedFilters) && session.feedFilters.length > 0;
  if (!session.showTimer && items.length === 0 && !hasActiveFeedFilters) {
    stopHeartbeat();
  } else {
    ensureHeartbeat();
  }

  if (shouldExitPage) attemptExitPage();
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

// A watch/channel page's owner identity (owner byline for the author axis,
// window.__cbPageChannelId + tag verdicts for the tag axis) lands a beat AFTER
// the navigation event that triggers refreshSession(). Without re-evaluating,
// author/tag groups hide the feed but never block the page, because the
// one-shot session ran before the channel was known. These bounded retries
// re-run the evaluation as the identity resolves. The cb-page-channel-resolved
// event covers the tag axis precisely; the retries also cover the author
// byline and the tag cache's stale-while-revalidate second pass. They use
// independent timers (not the single debounced refresh) so several spaced
// passes survive, and are cancelled/restarted on each navigation.
let sessionResolveRetryTimers = [];
function clearSessionResolveRetries() {
  for (const id of sessionResolveRetryTimers) {
    try { window.clearTimeout(id); } catch (_) {}
  }
  sessionResolveRetryTimers = [];
}
function scheduleSessionResolveRetries() {
  clearSessionResolveRetries();
  for (const delay of [400, 1200, 2500]) {
    const id = window.setTimeout(() => {
      if (exitAttempted || extensionContextInvalid) return;
      refreshSession();
    }, delay);
    sessionResolveRetryTimers.push(id);
  }
}

function hookHistoryNavigation() {
  const dispatch = () => {
    try { window.dispatchEvent(new Event("custom-blocker:locationchange")); } catch {}
  };
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    if (typeof original !== "function" || original.__customBlockerWrapped) continue;
    const wrapped = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      dispatch();
      return result;
    };
    wrapped.__customBlockerWrapped = true;
    history[method] = wrapped;
  }
}

function refreshSession() {
  if (exitAttempted || extensionContextInvalid) return;
  if (!isExtensionContextValid()) {
    shutdownContentScript();
    return;
  }
  lastSessionRefreshAt = Date.now();
  safeSendMessage(
    {
      type: "get-page-session",
      pageContext: buildPageContext()
    },
    handleSession
  );
}

function refreshPanels(extraPanelGroups = []) {
  if (exitAttempted || extensionContextInvalid) return;
  if (!isExtensionContextValid()) {
    shutdownContentScript();
    return;
  }
  try {
    chrome.runtime.sendMessage({
      type: "get-custom-panels",
      url: location.href
    }).then((message) => {
      if (!message || !message.ok) return;
      const panelGroups = new Set(Array.isArray(extraPanelGroups) ? extraPanelGroups : []);
      for (const groupId of Array.isArray(message.panelGroups) ? message.panelGroups : []) {
        if (typeof groupId === "string" && groupId) panelGroups.add(groupId);
      }
      __cb_processApplyMessage({
        type: "event-sandbox-apply",
        descriptor: message.descriptor || { type: "panelRefreshEvent" },
        panelSnapshots: Array.isArray(message.panelSnapshots) ? message.panelSnapshots : [],
        panelGroups: Array.from(panelGroups),
        logs: Array.isArray(message.logs) ? message.logs : [],
        domOps: [],
        intents: []
      });
    }).catch((error) => {
      if (isContextInvalidatedError(error)) shutdownContentScript();
      else cbDebugWarn("[CustomBlocker] panel refresh failed", error);
    });
  } catch (error) {
    if (isContextInvalidatedError(error)) shutdownContentScript();
    else cbDebugWarn("[CustomBlocker] panel refresh failed", error);
  }
}

if (/^https?:$/i.test(location.protocol)) {
  refreshSession();
  // The page's channel identity resolves after initial load — re-evaluate so
  // author/tag groups can block the page, not just hide the feed.
  scheduleSessionResolveRetries();

  document.addEventListener("visibilitychange", () => {
    lastHeartbeatAt = Date.now();
    if (!document.hidden) scheduleRefreshSession(0);
  });

  window.addEventListener("focus", () => scheduleRefreshSession(0));
  window.addEventListener("pageshow", () => scheduleRefreshSession(0));
  window.addEventListener("popstate", refreshSession);
  window.addEventListener("hashchange", refreshSession);
  // yt-block.js publishes the page's primary channel id a beat after the SPA
  // settles; re-run the session the moment that resolves so the tag/author
  // page block fires (the feed hider already reacts continuously).
  window.addEventListener("cb-page-channel-resolved", () => scheduleRefreshSession(0));
  document.addEventListener("yt-navigate-finish", () => {
    refreshSession();
    scheduleSessionResolveRetries();
  });

  hookHistoryNavigation();
  // Re-evaluate page predicates whenever the SPA URL changes. Without
  // this, scrolling between YouTube Shorts (which uses pushState to
  // swap the URL while keeping the content script alive) would only
  // re-evaluate when a fresh `webChangedEvent` apply roundtripped from
  // background — which is sometimes too slow because the SPA hasn't
  // hydrated the new short's <h2> yet, leaving the previous short's
  // title in the DOM. Triggering directly from pushState/replaceState
  // restarts the retry budget against the NEW URL with the NEW DOM.
  //
  // We also reset exitAttempted so attemptExitPage() can fire again
  // for the new short. exitAttempted is a one-shot guard meant to
  // protect against race-y double-exits during a single page lifetime;
  // a SPA URL transition is effectively a "new page lifetime" for
  // scroll-based feeds.
  function __cb_onSpaUrlChange() {
    try {
      // Cancel any pending retry from the previous URL — the URL it
      // was probing for is no longer current.
      if (__cb_pagePredicateRetryTimer !== null) {
        try { window.clearTimeout(__cb_pagePredicateRetryTimer); } catch {}
        __cb_pagePredicateRetryTimer = null;
      }
      __cb_pagePredicateRetryUrl = null;
      if (typeof isScrollBasedVideoPage === "function" && isScrollBasedVideoPage()) {
        exitAttempted = false;
      }
      if (__cb_activePredicateSlots.size > 0) {
        // Defer one tick so the SPA can swap the active <h2> /
        // <ytd-reel-video-renderer is-active> before we read it.
        setTimeout(() => __cb_checkPagePredicate(), 0);
      }
    } catch (error) {
      cbDebugWarn("[CustomBlocker] SPA url-change handler failed", error);
    }
  }
  window.addEventListener("custom-blocker:locationchange", () => {
    lastKnownUrl = location.href;
    scheduleRefreshSession(0);
    __cb_onSpaUrlChange();
  });
  // YouTube fires `yt-navigate-finish` when its router finishes a
  // transition; this happens AFTER the new <ytd-reel-video-renderer
  // is-active> is hydrated, so the title selectors should match
  // immediately and we can skip the retry budget entirely.
  document.addEventListener("yt-navigate-finish", __cb_onSpaUrlChange);

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (extensionContextInvalid) return;
      if (!isExtensionContextValid()) {
        shutdownContentScript();
        return;
      }
      if (
        areaName !== "local" ||
        (!changes.blockedGroups &&
          !changes.usageTimersMs &&
          !changes.usageResetAtMs &&
          !changes.groupSnoozes)
      ) {
        return;
      }
      scheduleRefreshSession();
    });
  } catch (error) {
    if (isContextInvalidatedError(error)) shutdownContentScript();
  }

  navigationPollIntervalId = window.setInterval(() => {
    if (extensionContextInvalid) {
      window.clearInterval(navigationPollIntervalId);
      navigationPollIntervalId = null;
      return;
    }
    if (!isExtensionContextValid()) {
      shutdownContentScript();
      return;
    }
    const currentUrl = location.href;
    const currentHost = normalizeHostname(location.hostname);
    const onYouTube = isYouTubeHost(currentHost);
    if (currentUrl !== lastKnownUrl) {
      lastKnownUrl = currentUrl;
      refreshSession();
      return;
    }
    if (onYouTube && heartbeatIntervalId === null && Date.now() - lastSessionRefreshAt > 2000) {
      lastKnownUrl = location.href;
      refreshSession();
    }
  }, 500);

  window.addEventListener(
    "pagehide",
    () => {
      stopHeartbeat();
      stopFeedObserver();
      restoreHiddenFeedCards();
      if (refreshDebounceTimeoutId !== null) window.clearTimeout(refreshDebounceTimeoutId);
      if (navigationPollIntervalId !== null) window.clearInterval(navigationPollIntervalId);
    },
    { once: true }
  );
}

// ────────────────────────────────────────────────────────────────────────
// Event-driven custom rule integration. Background dispatches events to
// the event sandbox; the sandbox returns DOM/navigation intents; we
// apply them here. The accumulated DOM ops are applied in document
// order with one MutationObserver-friendly write per element.
// ────────────────────────────────────────────────────────────────────────

const __cb_eventInjectedCss = new Map(); // id -> <style> element

// On-page toast renderer for getLogHelper() output. Each entry produced
// by the sandbox is rendered as a colored toast in the bottom-right that
// fades after ~5 s. Only the message text is shown — the level shows up
// as the toast colour.

const __cb_TOAST_CONTAINER_ID = "__custom_blocker_toast_container__";
const __cb_TOAST_MAX_VISIBLE = 8;
const __cb_TOAST_FADE_AFTER_MS = 5000;
const __cb_TOAST_REMOVE_AFTER_MS = 5500;

function __cb_ensureToastContainer() {
  let host = document.getElementById(__cb_TOAST_CONTAINER_ID);
  if (host && host.isConnected) return host;
  if (!document.body && !document.documentElement) return null;
  host = document.createElement("div");
  host.id = __cb_TOAST_CONTAINER_ID;
  host.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:2147483647",
    "display:flex",
    "flex-direction:column",
    "gap:6px",
    "max-width:380px",
    "pointer-events:none",
    "font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
  ].join(";");
  (document.body || document.documentElement).appendChild(host);
  return host;
}

function __cb_formatToastArg(arg) {
  if (typeof arg === "string") return arg;
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function __cb_showToast(level, _groupId, args) {
  const host = __cb_ensureToastContainer();
  if (!host) return;
  const text = (Array.isArray(args) ? args : [args]).map(__cb_formatToastArg).join(" ").trim();
  if (!text) return;
  while (host.children.length >= __cb_TOAST_MAX_VISIBLE) {
    host.removeChild(host.firstChild);
  }
  const toast = document.createElement("div");
  const palette = level === "error"
    ? { bg: "#7f1d1d", fg: "#fef2f2", border: "#ef4444" }
    : level === "warn"
      ? { bg: "#78350f", fg: "#fffbeb", border: "#f59e0b" }
      : { bg: "#0f172a", fg: "#f1f5f9", border: "#38bdf8" };
  toast.style.cssText = [
    "background:" + palette.bg,
    "color:" + palette.fg,
    "border-left:3px solid " + palette.border,
    "padding:8px 10px",
    "border-radius:6px",
    "box-shadow:0 6px 20px rgba(0,0,0,0.35)",
    "pointer-events:auto",
    "transition:opacity 400ms ease, transform 400ms ease",
    "opacity:0",
    "transform:translateY(8px)",
    "white-space:pre-wrap",
    "word-break:break-word",
    "font-variant-ligatures:none"
  ].join(";");
  toast.textContent = text;
  toast.addEventListener("click", () => toast.remove(), { once: true });
  host.appendChild(toast);
  // animate in
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
  }, __cb_TOAST_FADE_AFTER_MS);
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, __cb_TOAST_REMOVE_AFTER_MS);
}

function __cb_renderLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return;
  for (const entry of logs) {
    if (!entry) continue;
    if (entry.screen === false) continue;
    if (entry.screen !== true && !cbShowOnPageLogToasts) continue;
    __cb_showToast(entry.level || "log", entry.groupId || "", entry.args || []);
  }
}

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

function __cb_formatPanelTimerMs(ms, format) {
  const totalMs = Math.max(0, Math.floor(Number(ms) || 0));
  if (format === "ms") return String(totalMs) + " ms";
  const totalSeconds = Math.floor(totalMs / 1000);
  if (format === "ss") return String(totalSeconds) + "s";
  const seconds = totalSeconds % 60;
  const minutesTotal = Math.floor(totalSeconds / 60);
  const minutes = minutesTotal % 60;
  const hours = Math.floor(minutesTotal / 60);
  const pad = (value) => String(value).padStart(2, "0");
  if (format === "hh:mm:ss") return String(hours) + ":" + pad(minutes) + ":" + pad(seconds);
  return String(minutesTotal) + ":" + pad(seconds);
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
  "timer",
  "options",
  "min",
  "max",
  "step",
  "rows",
  "format",
  "showExpired"
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

function __cb_panelTimerDisplay(control) {
  const timer = control && control.timer && typeof control.timer === "object" ? control.timer : null;
  const currentMs = Number(timer?.currentMs);
  const hasTimer = timer && Number.isFinite(currentMs);
  const name = __cb_safePanelText(control?.label || timer?.displayName || control?.timerId || "Timer", 240);
  return {
    name,
    currentMs,
    hasTimer,
    text: name + ": " + (hasTimer ? __cb_formatPanelTimerMs(currentMs, control?.format) : "not available"),
    isExpired: Boolean(hasTimer && timer?.isExpired),
    showExpired: control?.showExpired !== false
  };
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

function __cb_collectPanelTimerControls(controls, out = []) {
  for (const control of Array.isArray(controls) ? controls : []) {
    if (!control || typeof control !== "object") continue;
    if (control.type === "timer") out.push(control);
    __cb_collectPanelTimerControls(control.controls, out);
  }
  return out;
}

function __cb_updatePanelTimerBox(timerBox, control, theme) {
  if (!timerBox || !control) return;
  const display = __cb_panelTimerDisplay(control);
  let line = timerBox.querySelector("[data-cb-panel-timer-line='1']");
  if (!line) {
    line = document.createElement("div");
    line.setAttribute("data-cb-panel-timer-line", "1");
    line.style.cssText = "font-variant-numeric:tabular-nums;font-weight:700;";
    timerBox.insertBefore(line, timerBox.firstChild);
  }
  line.textContent = display.text;

  let expired = timerBox.querySelector("[data-cb-panel-timer-expired='1']");
  if (display.isExpired && display.showExpired) {
    if (!expired) {
      expired = document.createElement("div");
      expired.setAttribute("data-cb-panel-timer-expired", "1");
      expired.style.cssText = "opacity:0.82;font-size:0.88em;";
      timerBox.appendChild(expired);
    }
    expired.textContent = "Expired";
  } else if (expired) {
    expired.remove();
  }
}

function __cb_updatePanelTimerControls(panelEl, snapshot) {
  if (!panelEl || !snapshot) return;
  const theme = snapshot.theme && typeof snapshot.theme === "object" ? snapshot.theme : {};
  const controls = __cb_collectPanelTimerControls(snapshot.controls);
  if (controls.length === 0) return;
  const boxes = Array.from(panelEl.querySelectorAll("[data-cb-panel-control-type='timer']"));
  const used = new Set();
  for (const control of controls) {
    const controlId = String(control.id || "");
    const timerId = String(control.timerId || "");
    const index = boxes.findIndex((box, i) => {
      if (used.has(i)) return false;
      return (
        (controlId && box.getAttribute("data-cb-panel-control-id") === controlId) ||
        (timerId && box.getAttribute("data-cb-panel-timer-id") === timerId)
      );
    });
    if (index < 0) continue;
    used.add(index);
    __cb_updatePanelTimerBox(boxes[index], control, theme);
  }
}

function __cb_shouldDeferInputValuePatch(input) {
  if (!input || document.activeElement !== input) return false;
  const type = input.getAttribute("data-cb-panel-control-type") || "";
  return ["textInput", "textarea", "numberInput", "range", "select", "date", "time", "color", "pin"].includes(type);
}

function __cb_setInputValueIfSafe(input, value) {
  if (!input || __cb_shouldDeferInputValuePatch(input)) return;
  const next = String(value ?? "");
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

  if (type === "section") {
    __cb_patchSectionControl(root, control);
    return true;
  }

  if (type === "timer") {
    __cb_updatePanelTimerBox(root, control, theme);
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
    if (!id || type === "button" || type === "text" || type === "section" || type === "timer") return;
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

  if (type === "timer") {
    const timerBox = document.createElement("div");
    __cb_markPanelControlRoot(timerBox, control);
    timerBox.setAttribute("data-cb-panel-control-id", control.id || "");
    timerBox.setAttribute("data-cb-panel-control-type", "timer");
    if (control.timerId) timerBox.setAttribute("data-cb-panel-timer-id", control.timerId);
    timerBox.style.cssText = [
      "box-sizing:border-box",
      "display:flex",
      "flex-direction:column",
      "gap:5px",
      "width:" + (controlWidth && controlWidth !== "auto" ? controlWidth : "fit-content"),
      "max-width:100%",
      "color:inherit"
    ].join(";");
    const display = __cb_panelTimerDisplay(control);
    const line = document.createElement("div");
    line.setAttribute("data-cb-panel-timer-line", "1");
    line.textContent = display.text;
    line.style.cssText = "font-variant-numeric:tabular-nums;font-weight:700;";
    timerBox.appendChild(line);
    if (display.isExpired && display.showExpired) {
      const expired = document.createElement("div");
      expired.setAttribute("data-cb-panel-timer-expired", "1");
      expired.textContent = "Expired";
      expired.style.cssText = "opacity:0.82;font-size:0.88em;";
      timerBox.appendChild(expired);
    }
    body.appendChild(timerBox);
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
      const action = control.action === "submit" || control.action === "cancel" || control.action === "close"
        ? control.action
        : "click";
      __cb_sendPanelEvent(panelEl, control, action, control.value ?? true);
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
  if (
    panelEl.parentNode === stack &&
    panelEl.getAttribute("data-cb-panel-snapshot") === snapshotKey
  ) {
    if (__cb_patchPanelInPlace(panelEl, snapshot)) {
      return key;
    }
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

function __cb_applyDomOp(op) {
  if (!op || typeof op.kind !== "string") return;
  try {
    if (op.kind === "hide") {
      document.querySelectorAll(op.selector).forEach((el) => {
        el.style.setProperty("display", "none", "important");
        el.setAttribute("data-cb-hidden", "1");
      });
    } else if (op.kind === "show") {
      document.querySelectorAll(op.selector).forEach((el) => {
        el.style.removeProperty("display");
        el.removeAttribute("data-cb-hidden");
      });
    } else if (op.kind === "addClass") {
      document.querySelectorAll(op.selector).forEach((el) => el.classList.add(op.className));
    } else if (op.kind === "removeClass") {
      document.querySelectorAll(op.selector).forEach((el) => el.classList.remove(op.className));
    } else if (op.kind === "setText") {
      document.querySelectorAll(op.selector).forEach((el) => {
        el.textContent = op.text;
      });
    } else if (op.kind === "click") {
      document.querySelectorAll(op.selector).forEach((el) => {
        if (typeof el.click === "function") el.click();
      });
    } else if (op.kind === "scrollTo") {
      const el = document.querySelector(op.selector);
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth" });
    } else if (op.kind === "injectCss") {
      const id = op.id || ("cb-injected-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
      let style = __cb_eventInjectedCss.get(id);
      if (!style) {
        style = document.createElement("style");
        style.setAttribute("data-cb-injected-id", id);
        document.documentElement.appendChild(style);
        __cb_eventInjectedCss.set(id, style);
      }
      style.textContent = op.css;
    } else if (op.kind === "removeInjectedCss") {
      const style = __cb_eventInjectedCss.get(op.id);
      if (style && style.parentNode) style.parentNode.removeChild(style);
      __cb_eventInjectedCss.delete(op.id);
    }
  } catch (error) {
    cbDebugWarn("[CustomBlocker] DOM op failed", op, error);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Predicate-based feed hiding (hideShorts / hideVideos / hidePosts /
// filterComments / filterLive). Predicates are real JS functions that
// live inside the offscreen sandbox; we ship card item metadata to the
// sandbox via the background relay and apply the returned hide decisions
// here.
// ────────────────────────────────────────────────────────────────────────

const __cb_activePredicateSlots = new Set(); // "platform:slot"
let __cb_predicateScanTimer = null;
let __cb_predicateObserver = null;

// Page-level predicate (blockPageOnVisit) state. The predicate runs against
// the current video's title, but openWebEvent / switchWebEvent typically
// dispatch before the SPA has rendered the real title, so we keep a small
// per-URL retry budget instead of evaluating with a bare platform name like
// "YouTube" (which would false-match almost any substring predicate).
const __CB_PAGE_PREDICATE_MAX_RETRIES = 12;       // ~6 s at 500 ms
const __CB_PAGE_PREDICATE_RETRY_DELAY_MS = 500;
let __cb_pagePredicateRetryUrl = "";
let __cb_pagePredicateRetriesRemaining = 0;
let __cb_pagePredicateRetryTimer = null;

// Per-platform DOM selectors for the actual video title element. Tried in
// order; first non-empty hit wins.
const __cb_PAGE_TITLE_SELECTORS = {
  youtube: [
    // Long-form watch page (/watch?v=...).
    "ytd-watch-metadata h1.title yt-formatted-string",
    "ytd-watch-metadata h1 yt-formatted-string",
    "ytd-watch-metadata h1",
    "h1.ytd-watch-metadata",
    "h1.title.ytd-video-primary-info-renderer",
    // Shorts (/shorts/<id>). YouTube has rotated through several DOM
    // shapes for shorts; keeping multiple selectors increases the
    // chance one matches before the retry budget exhausts. The
    // page-predicate evaluator will also fall back to an empty title
    // after retries exhaust (so URL-only predicates still block).
    "ytd-reel-video-renderer[is-active] yt-formatted-string.ytd-reel-player-header-renderer",
    "ytd-reel-video-renderer[is-active] h2.title",
    "ytd-reel-video-renderer[is-active] h2",
    "ytd-shorts ytd-reel-video-renderer[is-active] yt-formatted-string",
    "ytd-shorts [aria-current='true'] yt-formatted-string",
    "yt-shorts-lockup-view-model h3",
    "h2.ytd-reel-player-header-renderer",
    'meta[itemprop="name"]'
  ],
  tiktok: [
    'h1[data-e2e="browse-video-desc"]',
    '[data-e2e="browse-video-desc"]',
    '[data-e2e="video-desc"]'
  ],
  facebook: [
    'div[role="main"] h1',
    "h1"
  ],
  instagram: [
    "article h1"
  ],
  twitch: [
    'h1[data-a-target="stream-title"]',
    'h2[data-a-target="stream-title"]',
    "h1.tw-title"
  ]
};

// Trailing-suffix patterns we strip from document.title when falling back to
// it, so a predicate searching for a substring in the *video* title cannot
// accidentally match the platform name itself.
const __cb_PAGE_TITLE_SUFFIX_PATTERNS = {
  youtube: /\s*[-–—|]\s*YouTube\s*$/i,
  tiktok: /\s*[|·•\-–—]\s*TikTok\s*$/i,
  facebook: /\s*[-–—|]\s*Facebook\s*$/i,
  instagram: /\s*[-–—•|]\s*Instagram\s*$/i,
  twitch: /\s*[-–—|]\s*Twitch\s*$/i
};

function __cb_stripPlatformSuffix(platform, raw) {
  let value = String(raw || "").trim();
  const suffix = __cb_PAGE_TITLE_SUFFIX_PATTERNS[platform];
  if (suffix) value = value.replace(suffix, "").trim();
  return value;
}

function __cb_extractPageVideoTitle(platform) {
  const selectors = __cb_PAGE_TITLE_SELECTORS[platform] || [];

  // 1. Per-platform DOM selectors. These are the only source of truth on
  //    SPA platforms (YouTube, TikTok, etc.) because document.title and
  //    og:title remain stuck at the previous page's title for a few hundred
  //    milliseconds after an in-page navigation. Trusting either of those
  //    fallbacks during that window causes the predicate to be evaluated
  //    against the *previous* video, which is what produced the
  //    "every video gets blocked" symptom.
  for (const selector of selectors) {
    let element = null;
    try { element = document.querySelector(selector); } catch { element = null; }
    if (!element) continue;
    // Prefer aria-label / title / content attributes when present —
    // the visible text on shorts tiles is sometimes split across
    // sibling elements and textContent picks up navigation chrome.
    // <meta itemprop="name"> exposes the short title via `content`,
    // which is what the YouTube SPA writes before the visible h2
    // hydrates.
    const raw =
      (element.getAttribute && element.getAttribute("title")) ||
      (element.getAttribute && element.getAttribute("aria-label")) ||
      (element.getAttribute && element.getAttribute("content")) ||
      element.textContent ||
      "";
    const trimmed = String(raw).trim();
    if (trimmed) return trimmed;
  }

  // For platforms with explicit selectors, do NOT fall back to og:title or
  // document.title. Returning "" makes the caller defer evaluation via the
  // retry budget instead. Worst case, we never block (safe); best case, we
  // wait until the SPA renders the real <h1> and then evaluate cleanly.
  if (selectors.length > 0) return "";

  // 2. og:title / twitter:title / generic title meta tag. Only used for
  //    platforms we don't have explicit selectors for.
  try {
    const meta = document.querySelector(
      'meta[property="og:title"], meta[name="twitter:title"], meta[name="title"]'
    );
    if (meta) {
      const stripped = __cb_stripPlatformSuffix(platform, meta.getAttribute("content"));
      if (stripped && stripped.toLowerCase() !== String(platform).toLowerCase()) {
        return stripped;
      }
    }
  } catch {}

  // 3. document.title with the trailing platform suffix stripped, also only
  //    for unrecognised platforms.
  const stripped = __cb_stripPlatformSuffix(platform, document.title);
  if (!stripped || stripped.toLowerCase() === String(platform).toLowerCase()) return "";
  return stripped;
}

function __cb_schedulePagePredicateRetry() {
  if (__cb_pagePredicateRetryUrl !== location.href) {
    __cb_pagePredicateRetryUrl = location.href;
    __cb_pagePredicateRetriesRemaining = __CB_PAGE_PREDICATE_MAX_RETRIES;
  }
  if (__cb_pagePredicateRetryTimer !== null) return;
  if (__cb_pagePredicateRetriesRemaining <= 0) return;
  __cb_pagePredicateRetriesRemaining -= 1;
  __cb_pagePredicateRetryTimer = window.setTimeout(() => {
    __cb_pagePredicateRetryTimer = null;
    __cb_checkPagePredicate();
  }, __CB_PAGE_PREDICATE_RETRY_DELAY_MS);
}

// Persistent <style> tags injected for sticky platform intents (hide
// short button / hide comments / etc). Keyed by a stable id so toggling
// hide/show is idempotent.
function __cb_setPlatformStyle(key, css) {
  const id = "__cb_platform_style_" + key;
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent = css;
}

function __cb_clearPlatformStyle(key) {
  const style = document.getElementById("__cb_platform_style_" + key);
  if (style && style.parentNode) style.parentNode.removeChild(style);
}

const __cb_PLATFORM_CSS = {
  youtube: {
    shortButton: [
      'ytd-guide-entry-renderer:has(a[title="Shorts"])',
      'ytd-guide-entry-renderer:has(a[href="/shorts"])',
      'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
      'ytd-mini-guide-entry-renderer:has(a[href="/shorts"])',
      'ytd-pivot-bar-item-renderer:has(a[href="/shorts"])',
      'yt-tab-shape:has(a[href="/shorts"])',
      'a[href="/shorts"]',
      'a[title="Shorts"]'
    ].join(", ") + " { display: none !important; }",
    comments: "ytd-comments, #comments { display: none !important; }",
    live: "ytd-badge-supported-renderer[overlay-style='LIVE'], .badge-style-type-live-now-alternate { display: none !important; }"
  },
  tiktok: {
    comments: '[data-e2e="comment-list"], [class*="DivCommentListContainer"] { display: none !important; }'
  },
  instagram: {
    comments: 'ul.x78zum5.xdt5ytf, section:has(form[method="POST"]) ul { display: none !important; }'
  },
  facebook: {
    comments: '[role="article"] [aria-label*="Comment"i] { display: none !important; }'
  },
  twitch: {
    comments: 'section[data-test-selector="chat-room-component-layout"] { display: none !important; }'
  }
};

function __cb_isOnPlatformHome(platform) {
  const p = location.pathname || "/";
  switch (platform) {
    case "youtube":
      return p === "/" || p.startsWith("/feed/");
    case "tiktok":
      return p === "/" || p.startsWith("/foryou") || p.startsWith("/following") || p.startsWith("/explore");
    case "instagram":
      return (
        p === "/" ||
        p === "/explore" || p.startsWith("/explore/") ||
        p === "/reels" || p.startsWith("/reels/")
      );
    case "facebook":
      return p === "/" || p === "/watch" || p.startsWith("/watch/");
    case "twitch":
      return p === "/" || p === "/directory" || p.startsWith("/directory/");
    default:
      return false;
  }
}

function __cb_currentPlatform() {
  const host = normalizeHostname(location.hostname);
  if (isYouTubeHost(host)) return "youtube";
  if (host === "tiktok.com" || host?.endsWith(".tiktok.com")) return "tiktok";
  if (host === "instagram.com" || host?.endsWith(".instagram.com")) return "instagram";
  if (host === "facebook.com" || host?.endsWith(".facebook.com")) return "facebook";
  if (host === "twitch.tv" || host?.endsWith(".twitch.tv") || host === "clips.twitch.tv") return "twitch";
  return null;
}

function __cb_videoFormToSlot(form) {
  if (form === "short") return "shorts";
  if (form === "long") return "videos";
  if (form === "post") return "posts";
  return null;
}

// Best-effort UC channel id for a feed card (YouTube only). yt-block.js already
// resolves every on-screen card to its channel and stamps `data-cb-channel`, so
// we reuse that single resolver instead of duplicating its handle->UC maps; a
// direct /channel/UC link in the card is the fallback. Returns null when the
// channel can't be resolved yet (fail open: the card just carries no creator
// info this pass and re-resolves once yt-block.js stamps it).
const CB_CARD_UC_RE = /^UC[0-9A-Za-z_-]{22}$/;
function __cb_resolveCardChannelId(card, platform) {
  if (platform !== "youtube" || !card) return null;
  try {
    let stamped = null;
    if (card.matches && card.matches("[data-cb-channel]")) stamped = card;
    else if (card.closest) stamped = card.closest("[data-cb-channel]");
    if (!stamped && card.querySelector) stamped = card.querySelector("[data-cb-channel]");
    if (stamped) {
      const v = stamped.getAttribute("data-cb-channel");
      if (v && CB_CARD_UC_RE.test(v)) return v;
    }
    const a = card.querySelector && card.querySelector('a[href*="/channel/UC"]');
    if (a) {
      const m = (a.getAttribute("href") || "").match(/(UC[0-9A-Za-z_-]{22})/);
      if (m) return m[1];
    }
  } catch (_) {}
  return null;
}

function __cb_extractCardItem(card, platform) {
  let videoForm = null;
  let creators = [];
  if (platform === "youtube") {
    if (isPostCard(card)) {
      videoForm = "post";
      creators = getFeedCardCreators(card);
    } else {
      const href = getFeedCardHref(card, "youtube");
      if (href) {
        try {
          const u = new URL(href, location.origin);
          videoForm = detectVideoSiteContext(normalizeHostname(u.hostname), u.pathname).form;
        } catch {}
      }
      creators = getFeedCardCreators(card);
    }
  } else {
    const href = getFeedCardHref(card, platform);
    if (href) {
      try {
        const u = new URL(href, location.origin);
        videoForm = detectVideoSiteContext(normalizeHostname(u.hostname), u.pathname).form;
      } catch {}
    }
    creators = [
      ...new Set(
        [...card.querySelectorAll("a[href]")]
          .map((a) => normalizePlatformAuthorInput(a.getAttribute("href"), platform))
          .filter(Boolean)
      )
    ];
  }

  let name = "";
  const titleSelectors = [
    "#video-title",
    "yt-formatted-string#video-title",
    "h3 a",
    "h3",
    "h2 a",
    "h2",
    "[title]"
  ];
  for (const sel of titleSelectors) {
    let el = null;
    try { el = card.querySelector(sel); } catch { el = null; }
    if (!el) continue;
    const txt = (el.getAttribute && el.getAttribute("title")) || el.textContent || "";
    const trimmed = String(txt).trim();
    if (trimmed) { name = trimmed; break; }
  }
  if (!name) {
    let aria = null;
    try { aria = card.querySelector("[aria-label]"); } catch {}
    if (aria) name = (aria.getAttribute("aria-label") || "").trim();
  }

  let url = "";
  const href = getFeedCardHref(card, platform);
  if (href) { try { url = new URL(href, location.origin).href; } catch {} }

  return {
    url,
    name,
    title: name,
    author: creators[0] || null,
    channelId: __cb_resolveCardChannelId(card, platform),
    length: null,
    views: null,
    publishedAt: null,
    description: null,
    live: null,
    sponsored: null,
    algorithmic: null,
    videoForm
  };
}

// Custom rules now hide through the shared cascade (the "custom" verdict
// source) instead of their own marker, so a per-card signature cache avoids
// re-sending unchanged cards to the sandbox on every mutation.
let cbCustomSigCache = new WeakMap(); // card -> last evaluated signature

// Invalidate the cache whenever the active predicate set changes, so newly
// activated groups re-evaluate cards we'd otherwise skip as "unchanged".
function cbResetCustomSigCache() {
  cbCustomSigCache = new WeakMap();
}

function cbCardSignature(item) {
  // channelId is part of the signature so a card re-evaluates once yt-block.js
  // resolves its channel (null -> UC), letting creator-based predicates
  // (e.g. subscriber-count filters) run on the next pass.
  return [item.url || "", item.title || "", item.videoForm || "", item.channelId || ""].join("\n");
}

// Returns the full sandbox reply { results, evaluatedGroups } (or null). The
// results carry per-group matches so each custom group can take its own ordered
// slot in the cascade.
async function __cb_evaluateItems(platform, slot, items) {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return null;
  try {
    const r = await chrome.runtime.sendMessage({
      type: "evaluate-platform-items",
      platform,
      slot,
      items
    });
    if (r && r.ok && Array.isArray(r.results)) {
      return { results: r.results, evaluatedGroups: Array.isArray(r.evaluatedGroups) ? r.evaluatedGroups : [] };
    }
  } catch {}
  return null;
}

async function __cb_scanFeedPredicates() {
  __cb_predicateScanTimer = null;
  const platform = __cb_currentPlatform();
  if (!platform) return;
  if (__cb_activePredicateSlots.size === 0) return;

  const cards = getFeedCardElements(platform);
  if (cards.length === 0) return;

  // Only send cards whose content changed since we last evaluated them; cards
  // with an unchanged signature already have their custom verdict in the ledger.
  const bySlot = { shorts: [], videos: [], posts: [] };
  for (const card of cards) {
    const item = __cb_extractCardItem(card, platform);
    const slot = __cb_videoFormToSlot(item.videoForm);
    if (!slot) continue;
    if (!__cb_activePredicateSlots.has(platform + ":" + slot)) continue;
    const sig = cbCardSignature(item);
    if (cbCustomSigCache.get(card) === sig) continue;
    bySlot[slot].push({ card, item, sig });
  }

  for (const slot of ["shorts", "videos", "posts"]) {
    const batch = bySlot[slot];
    if (batch.length === 0) continue;
    const reply = await __cb_evaluateItems(platform, slot, batch.map((b) => b.item));
    if (!reply) continue;
    const { results, evaluatedGroups } = reply;
    for (let i = 0; i < batch.length; i++) {
      const card = batch[i].card;
      // Re-derive this card's custom verdicts: clear the groups that ran, then
      // set the matches. Platform verdicts on the card are left untouched.
      for (const groupId of evaluatedGroups) cbSetCardVerdict(card, groupId, null, "custom");
      const matched =
        results[i] && Array.isArray(results[i].matchedGroups) ? results[i].matchedGroups : [];
      for (const groupId of matched) {
        cbSetCardVerdict(card, groupId, cbEffectVerdict(groupId), "custom");
      }
      cbCustomSigCache.set(card, batch[i].sig);
      cbApplyCard(card);
    }
  }

  // Refill what the predicate removed (only when the feed is too short to scroll).
  __cb_maybeReplenishFeed(platform);
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

function __cb_schedulePredicateScan() {
  if (__cb_predicateScanTimer !== null) return;
  __cb_predicateScanTimer = window.setTimeout(() => {
    __cb_scanFeedPredicates().catch(() => {
      __cb_predicateScanTimer = null;
    });
  }, 150);
}

function __cb_ensurePredicateObserver() {
  if (__cb_predicateObserver) return;
  const root = document.body || document.documentElement;
  if (!root) return;
  __cb_predicateObserver = new MutationObserver(() => {
    if (__cb_activePredicateSlots.size > 0) __cb_schedulePredicateScan();
  });
  __cb_predicateObserver.observe(root, { childList: true, subtree: true });
}

async function __cb_checkPagePredicate() {
  const platform = __cb_currentPlatform();
  if (!platform) return;
  const ctx = detectVideoSiteContext(normalizeHostname(location.hostname), location.pathname);
  const slot = __cb_videoFormToSlot(ctx.form);
  if (!slot || !__cb_activePredicateSlots.has(platform + ":" + slot)) return;

  // Build the item from the actual video title rather than document.title.
  // document.title is "YouTube" / "Video Title - YouTube" / etc., which would
  // make a substring predicate (e.g. title.includes("e")) match every page
  // because of the trailing platform name. If the SPA hasn't rendered the
  // real title yet, defer the evaluation and retry shortly.
  //
  // Once the retry budget is exhausted (i.e. selectors never matched —
  // YouTube Shorts is the canonical case), we still evaluate the
  // predicate WITHOUT a title so URL-only predicates like
  //   `hideShorts((v) => true, { blockPageOnVisit: true })`
  // can still block the page. Predicates that DO read `item.title` will
  // throw, which the sandbox swallows; the result is `hide: false` and
  // the page renders. That's strictly better than the previous "page
  // never blocks" outcome.
  const title = __cb_extractPageVideoTitle(platform);
  if (!title) {
    if (__cb_pagePredicateRetriesRemaining > 0) {
      __cb_schedulePagePredicateRetry();
      return;
    }
    // Fall through to evaluation with title = null. The predicate is
    // free to ignore item.title (e.g. URL-based blocks).
  }

  const safeTitle = title || null;
  const item = {
    url: location.href,
    name: safeTitle,
    title: safeTitle,
    author: null,
    length: null,
    views: null,
    publishedAt: null,
    description: null,
    live: null,
    sponsored: null,
    algorithmic: null,
    videoForm: ctx.form
  };
  const reply = await __cb_evaluateItems(platform, slot, [item]);
  const r = reply && reply.results && reply.results[0];
  if (r && r.hide && r.blockPageOnVisit) {
    if (typeof attemptExitPage === "function") {
      try { attemptExitPage(""); return; } catch {}
    }
    location.replace("about:blank");
  }
}

function __cb_applyEventIntent(intent) {
  if (!intent || typeof intent.kind !== "string") return;
  try {
    if (intent.kind === "navigation" && intent.op) {
      const action = intent.op.action;
      if (action === "back") history.back();
      else if (action === "forward") history.forward();
      else if (action === "reload") location.reload();
      else if (action === "goTo" && typeof intent.op.url === "string") {
        location.replace(intent.op.url);
      }
      else if (action === "closeTab") window.close();
    }
    if (intent.kind === "platform" && intent.intent) {
      const platform = intent.platform;
      const platformIntent = intent.intent;
      const cssTable = __cb_PLATFORM_CSS[platform] || {};
      if (platformIntent.kind === "homePage" && platformIntent.value === "hide") {
        // Only exit if we are actually on the platform's home feed; the
        // intent is sticky so it would otherwise nuke every page on
        // every dispatch.
        if (__cb_isOnPlatformHome(platform)) {
          if (typeof attemptExitPage === "function") {
            try { attemptExitPage(""); } catch {}
          } else {
            location.replace("about:blank");
          }
        }
      } else if (platformIntent.kind === "shortButton" && cssTable.shortButton) {
        if (platformIntent.value === "hide") __cb_setPlatformStyle(platform + "-shortButton", cssTable.shortButton);
        else if (platformIntent.value === "show") __cb_clearPlatformStyle(platform + "-shortButton");
      } else if (platformIntent.kind === "comments" && cssTable.comments) {
        if (platformIntent.value === "hide") __cb_setPlatformStyle(platform + "-comments", cssTable.comments);
        else if (platformIntent.value === "show") __cb_clearPlatformStyle(platform + "-comments");
      } else if (platformIntent.kind === "live" && cssTable.live) {
        if (platformIntent.value === "hide") __cb_setPlatformStyle(platform + "-live", cssTable.live);
        else if (platformIntent.value === "show") __cb_clearPlatformStyle(platform + "-live");
      } else if (platformIntent.predicate === true && typeof platformIntent.slot === "string" && platform) {
        __cb_activePredicateSlots.add(platform + ":" + platformIntent.slot);
        // A new group's predicate is now active; re-evaluate cached cards.
        cbResetCustomSigCache();
        __cb_ensurePredicateObserver();
        __cb_schedulePredicateScan();
        __cb_checkPagePredicate();
      } else if (platformIntent.kind === "clearPredicates" && typeof platformIntent.slot === "string" && platform) {
        __cb_activePredicateSlots.delete(platform + ":" + platformIntent.slot);
        // Drop every custom verdict and re-resolve, so cards a predicate had
        // hidden come back (unless a platform rule still hides them).
        cbClearSourceEverywhere("custom");
        cbResetCustomSigCache();
        if (__cb_activePredicateSlots.size > 0) __cb_schedulePredicateScan();
      }
    }
  } catch (error) {
    cbDebugWarn("[CustomBlocker] event intent failed", intent, error);
  }
}

function __cb_processApplyMessage(message) {
  if (!message || typeof message !== "object") return;
  try {
    cbDebugLog("[CustomBlocker:trace] content event-sandbox-apply",
      message.descriptor && message.descriptor.type,
      "logs:", Array.isArray(message.logs) ? message.logs.length : 0,
      "domOps:", Array.isArray(message.domOps) ? message.domOps.length : 0,
      "panels:", Array.isArray(message.panelSnapshots) ? message.panelSnapshots.length : 0);
  } catch (_) {}
  __cb_renderLogs(message.logs);
  __cb_applyPanelSnapshots(message.panelSnapshots, message.panelGroups);
  const ops = Array.isArray(message.domOps) ? message.domOps : [];
  for (const op of ops) __cb_applyDomOp(op);
  const intents = Array.isArray(message.intents) ? message.intents : [];
  for (const intent of intents) __cb_applyEventIntent(intent);
  if (message.defaultPrevented === true) {
    const redirect = typeof message.redirectUrl === "string" && message.redirectUrl.trim()
      ? message.redirectUrl.trim()
      : (typeof message.result === "string" && message.result.trim() ? message.result.trim() : "");
    if (redirect) {
      location.replace(redirect);
    } else if (typeof attemptExitPage === "function") {
      try { attemptExitPage(""); } catch { location.replace("about:blank"); }
    } else {
      location.replace("about:blank");
    }
  } else if (typeof message.result === "string" && message.result.trim()) {
    location.replace(message.result.trim());
  }
}

function __cb_announceContentReady() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
  try {
    chrome.runtime.sendMessage({ type: "content-ready" }).then((response) => {
      if (!response || !response.ok) return;
      const pending = Array.isArray(response.pending) ? response.pending : [];
      for (const message of pending) {
        try { __cb_processApplyMessage(message); } catch (error) {
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
    if (message.type === "custom-timers-refresh") {
      scheduleRefreshSession(0);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "custom-panels-refresh") {
      refreshPanels(Array.isArray(message.panelGroups) ? message.panelGroups : []);
      sendResponse({ ok: true });
      return true;
    }
    if (message.type !== "event-sandbox-apply") return false;
    try {
      __cb_processApplyMessage(message);
      sendResponse({ ok: true });
      return true;
    } catch (error) {
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      return true;
    }
  });
}

