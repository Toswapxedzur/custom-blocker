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

function normalizeYouTubeCreatorInput(value) {
  let trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      trimmed = new URL(trimmed).pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("/@")) return trimmed.slice(2).split("/")[0] || null;
  if (trimmed.startsWith("@")) return trimmed.slice(1) || null;
  const pathLike = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const channelMatch = pathLike.match(/^channel\/([^/?#]+)/);
  const customMatch = pathLike.match(/^c\/([^/?#]+)/);
  const userMatch = pathLike.match(/^user\/([^/?#]+)/);
  if (channelMatch) return `channel:${channelMatch[1]}`;
  if (customMatch) return `c:${customMatch[1]}`;
  if (userMatch) return `user:${userMatch[1]}`;
  if (/^(channel|c|user):[a-z0-9._-]+$/i.test(pathLike)) return pathLike;
  return /^[a-z0-9._-]+$/i.test(pathLike) ? pathLike : null;
}

function normalizePlatformAuthorInput(value, groupType) {
  if (groupType === "youtube") return normalizeYouTubeCreatorInput(value);

  let trimmed = String(value ?? "").trim().toLowerCase();
  const extractFromPath = (pathLike) => {
    const path = String(pathLike || "").replace(/^\/+|\/+$/g, "");
    const first = path.split("/")[0] || "";

    if (groupType === "tiktok") {
      return first.startsWith("@")
        ? first.slice(1) || null
        : /^[a-z0-9._-]+$/i.test(first)
          ? first
          : null;
    }
    if (groupType === "instagram") {
      const reserved = new Set(["reel", "p", "tv", "explore", "accounts", "about"]);
      return !reserved.has(first) && /^[a-z0-9._]+$/i.test(first) ? first : null;
    }
    if (groupType === "facebook") {
      if (path.startsWith("profile.php")) return null;
      const reserved = new Set(["watch", "reel", "groups", "marketplace", "gaming", "video", "videos"]);
      return !reserved.has(first) && /^[a-z0-9.]+$/i.test(first) ? first : null;
    }
    if (groupType === "twitch") {
      const reserved = new Set([
        "directory", "videos", "settings", "downloads", "subscriptions",
        "search", "jobs", "drops", "inventory"
      ]);
      return !reserved.has(first) && /^[a-z0-9_]+$/i.test(first) ? first : null;
    }
    return null;
  };

  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
      if (groupType === "facebook" && path.startsWith("profile.php")) {
        const id = parsed.searchParams.get("id");
        return id ? `id:${id}` : null;
      }
      return extractFromPath(path);
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("/")) return extractFromPath(trimmed);
  trimmed = trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  if (groupType === "facebook" && trimmed.startsWith("id:")) return trimmed;
  return /^[a-z0-9._-]+$/i.test(trimmed) ? trimmed : null;
}

function normalizeRedditSubredditInput(value) {
  let trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      trimmed = new URL(trimmed).pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }
  trimmed = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  if (trimmed.startsWith("r/")) trimmed = trimmed.slice(2);
  return /^[a-z0-9_]+$/i.test(trimmed) ? trimmed : null;
}

function normalizeDiscordTargetInput(value, targetType = "server") {
  const normalizedTargetType = targetType === "channel" ? "channel" : "server";
  let trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      trimmed = new URL(trimmed).pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }
  trimmed = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  const channelsMatch = trimmed.match(/^channels\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (channelsMatch) {
    trimmed = normalizedTargetType === "channel" ? channelsMatch[2] ?? "" : channelsMatch[1];
  }
  if (trimmed === "@me") return null;
  return /^[0-9]{6,24}$/.test(trimmed) ? trimmed : null;
}

function isYouTubeHost(hostname) {
  return Boolean(
    hostname && (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be")
  );
}

function isRedditHost(hostname) {
  return Boolean(hostname && (hostname === "reddit.com" || hostname.endsWith(".reddit.com")));
}

function isDiscordHost(hostname) {
  return Boolean(
    hostname &&
      (hostname === "discord.com" ||
        hostname.endsWith(".discord.com") ||
        hostname === "discordapp.com" ||
        hostname.endsWith(".discordapp.com"))
  );
}

function parseRedditSubredditFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/r\/([^/?#]+)/);
  return match ? normalizeRedditSubredditInput(match[1]) : null;
}

function parseDiscordServerIdFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/channels\/([^/?#]+)/);
  if (!match || match[1] === "@me") return null;
  return normalizeDiscordTargetInput(match[1], "server");
}

function parseDiscordChannelIdFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/channels\/([^/?#]+)\/([^/?#]+)/);
  if (!match || match[1] === "@me") return null;
  return normalizeDiscordTargetInput(match[2], "channel");
}

function detectVideoSiteContext(hostname, pathname) {
  const safePathname = String(pathname ?? "/");

  if (isYouTubeHost(hostname)) {
    if (safePathname.startsWith("/shorts/")) return { site: "youtube", form: "short" };
    if (
      safePathname.startsWith("/post/") ||
      /^\/(channel|c|user)\/[^/]+\/(community|posts)/.test(safePathname) ||
      /^\/@[^/]+\/(community|posts)/.test(safePathname)
    ) {
      return { site: "youtube", form: "post" };
    }
    if (
      hostname === "youtu.be" ||
      safePathname.startsWith("/watch") ||
      safePathname.startsWith("/live/") ||
      safePathname.startsWith("/embed/")
    ) {
      return { site: "youtube", form: "long" };
    }
    return { site: "youtube", form: "unknown" };
  }
  if (hostname === "tiktok.com" || hostname?.endsWith(".tiktok.com")) {
    if (safePathname.includes("/video/")) return { site: "tiktok", form: "short" };
    return { site: "tiktok", form: "unknown" };
  }
  if (hostname === "instagram.com" || hostname?.endsWith(".instagram.com")) {
    if (safePathname.startsWith("/reel/")) return { site: "instagram", form: "short" };
    if (safePathname.startsWith("/p/")) return { site: "instagram", form: "post" };
    if (safePathname.startsWith("/tv/")) return { site: "instagram", form: "long" };
    return { site: "instagram", form: "unknown" };
  }
  if (hostname === "facebook.com" || hostname?.endsWith(".facebook.com")) {
    if (safePathname.startsWith("/reel/") || safePathname.startsWith("/watch/reel/")) {
      return { site: "facebook", form: "short" };
    }
    if (safePathname.startsWith("/watch")) return { site: "facebook", form: "long" };
    if (safePathname.includes("/posts/") || safePathname.includes("/permalink/")) {
      return { site: "facebook", form: "post" };
    }
    return { site: "facebook", form: "unknown" };
  }
  if (hostname === "vimeo.com" || hostname?.endsWith(".vimeo.com")) {
    return /^\/\d+/.test(safePathname)
      ? { site: "vimeo", form: "long" }
      : { site: "vimeo", form: "unknown" };
  }
  if (hostname === "dailymotion.com" || hostname?.endsWith(".dailymotion.com") || hostname === "dai.ly") {
    return safePathname.includes("/video/") || hostname === "dai.ly"
      ? { site: "dailymotion", form: "long" }
      : { site: "dailymotion", form: "unknown" };
  }
  if (hostname === "clips.twitch.tv" || safePathname.includes("/clip/")) {
    return { site: "twitch", form: "short" };
  }
  if (hostname === "twitch.tv" || hostname?.endsWith(".twitch.tv")) {
    return safePathname.startsWith("/videos/")
      ? { site: "twitch", form: "long" }
      : { site: "twitch", form: "unknown" };
  }
  return { site: null, form: "unknown" };
}

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

  if (site === "youtube") {
    // Modern YouTube uses several different wrappers for shorts cards
    // depending on surface and rollout: ytd-rich-item-renderer wraps the
    // home-feed shorts shelf entries, ytd-reel-item-renderer is the older
    // search/subs shelf entry, and yt-shorts-lockup-view-model /
    // ytm-shorts-lockup-view-model-v2 are the newer view-model wrappers
    // that sometimes appear standalone (and often hold the only useful
    // metadata for predicate evaluation). Including all of them ensures a
    // predicate-based hide can reach every short the user might see.
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
  return null;
}

function getFeedCardData(card) {
  const currentSite = getCurrentFeedSite();
  if (currentSite === "reddit") {
    return { redditSubreddit: extractRedditSubredditFromCard(card) };
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
  if (filter.authorMode === "none") return true;
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

function collectNavElementsToHide(filter) {
  if (!filter || filter.authorMode !== "none") return [];
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
  if (!filter || filter.authorMode !== "none") return [];
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

function applyFeedFilters() {
  feedApplyRafId = null;
  restoreHiddenFeedCards();

  const currentSite = getCurrentFeedSite();
  const activeFilters = latestFeedFilters.filter((filter) => filter?.site === currentSite);

  if (currentSite && activeFilters.length > 0) {
    for (const card of getFeedCardElements(currentSite)) {
      const cardData = getFeedCardData(card);
      if (!cardData) continue;
      if (!activeFilters.some((filter) => matchesFeedFilter(cardData, filter))) continue;
      hideElement(card);
    }

    if (currentSite === "youtube") {
      for (const filter of activeFilters) {
        for (const navElement of collectNavElementsToHide(filter)) hideElement(navElement);
        for (const shelfElement of collectFormShelvesToHide(filter)) hideElement(shelfElement);
      }
    }
  }

}

function scheduleApplyFeedFilters() {
  if (feedApplyRafId !== null) return;
  feedApplyRafId = window.requestAnimationFrame(() => applyFeedFilters());
}

function updateFeedFilters(filters) {
  latestFeedFilters = Array.isArray(filters) ? filters : [];
  if (latestFeedFilters.length === 0) {
    stopFeedObserver();
    restoreHiddenFeedCards();
    return;
  }
  ensureFeedObserver();
  scheduleApplyFeedFilters();
}

function ensureFeedObserver() {
  if (latestFeedFilters.length === 0) {
    stopFeedObserver();
    restoreHiddenFeedCards();
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
        'ytd-reel-player-header-renderer ytd-channel-name a[href]',
        'ytd-reel-player-overlay-renderer ytd-channel-name a[href]',
        'ytd-reel-player-header-renderer a[href^="/@"]',
        'ytd-reel-player-overlay-renderer a[href^="/@"]'
      ]
    : [
        'ytd-watch-metadata ytd-channel-name a[href]',
        '#upload-info a[href]',
        'ytd-watch-metadata a[href^="/@"]',
        'ytd-watch-flexy ytd-channel-name a[href]',
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

function extractPrimaryAuthorFromPath(groupType, pathname) {
  const safePathname = String(pathname ?? "/");
  if (groupType === "youtube") return normalizeYouTubeCreatorInput(safePathname);
  if (groupType === "tiktok") {
    const match = safePathname.match(/^\/@([^/?#]+)/i);
    return match ? normalizePlatformAuthorInput(match[1], groupType) : null;
  }
  if (groupType === "instagram") {
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set(["reel", "p", "tv", "explore", "accounts", "about"]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], groupType);
  }
  if (groupType === "facebook") {
    try {
      const parsed = new URL(location.href);
      const id = parsed.searchParams.get("id");
      if (id) return normalizePlatformAuthorInput(`id:${id}`, groupType);
    } catch {}
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set(["watch", "reel", "groups", "marketplace", "gaming", "video", "videos"]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], groupType);
  }
  if (groupType === "twitch") {
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set([
      "directory", "videos", "settings", "downloads", "subscriptions",
      "search", "jobs", "drops", "inventory"
    ]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], groupType);
  }
  return null;
}

function collectPlatformAuthors(pathname, isYouTubePage) {
  const map = { youtube: [], tiktok: [], facebook: [], instagram: [], twitch: [] };
  if (isYouTubePage) map.youtube = collectYouTubeCreatorIdentifiers();
  for (const groupType of ["youtube", "tiktok", "facebook", "instagram", "twitch"]) {
    const fromPath = extractPrimaryAuthorFromPath(groupType, pathname);
    if (fromPath && !map[groupType].includes(fromPath)) map[groupType].push(fromPath);
  }
  return map;
}

function buildPageContext() {
  const hostname = normalizeHostname(location.hostname);
  const isYouTubePage = isYouTubeHost(hostname);
  const videoContext = detectVideoSiteContext(hostname, location.pathname);
  const isRedditPage = isRedditHost(hostname);
  const isDiscordPage = isDiscordHost(hostname);
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
    videoSite: videoContext.site,
    videoForm: videoContext.form
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
        elapsedMs
      },
      (session) => handleSession(session)
    );
  }, 250);
}

// ────────────────────────────────────────────────────────────────────────
// Top-level session handler. Called every heartbeat with the background's
// response. The legacy custom-rule pipeline has been replaced by the
// event-driven sandbox hosted by background.js / offscreen.js, so this
// handler now only deals with site / platform-video group output.
// ────────────────────────────────────────────────────────────────────────

function handleSession(session) {
  if (!session) return;
  if (extensionContextInvalid || exitAttempted) return;

  const now = Number.isFinite(session.now) ? session.now : Date.now();
  lastSessionRefreshAt = now;

  const items = Array.isArray(session.items) ? session.items : [];
  const shouldExitPage = Boolean(session.shouldExitPage);

  updateOverlay(items, !shouldExitPage && (session.showTimer || items.length > 0));
  updateFeedFilters(session.feedFilters);

  sessionFallbackUrl =
    typeof session.fallbackUrl === "string" ? session.fallbackUrl.trim() : "";
  sessionSkipToNext = Boolean(session.skipToNextOnBlock);

  if (!shouldExitPage) consecutiveSkipCount = 0;

  if (!session.showTimer && items.length === 0) {
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

if (/^https?:$/i.test(location.protocol)) {
  refreshSession();

  document.addEventListener("visibilitychange", () => {
    lastHeartbeatAt = Date.now();
    if (!document.hidden) scheduleRefreshSession(0);
  });

  window.addEventListener("focus", () => scheduleRefreshSession(0));
  window.addEventListener("pageshow", () => scheduleRefreshSession(0));
  window.addEventListener("popstate", refreshSession);
  window.addEventListener("hashchange", refreshSession);
  document.addEventListener("yt-navigate-finish", refreshSession);

  hookHistoryNavigation();
  window.addEventListener("custom-blocker:locationchange", () => {
    lastKnownUrl = location.href;
    scheduleRefreshSession(0);
  });

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
      // The sandbox owns the compiled-rule cache (keyed by source); a
      // freshly edited rule has different source, so its first heartbeat
      // re-compiles automatically.
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

// ────────────────────────────────────────────────────────────────────────
// On-page toast renderer for getLogHelper() output. Every log/warn/error
// the sandbox produces is shipped here in the event-sandbox-apply
// message; we render each entry as a colored toast at the bottom-right
// that fades out after ~5 s. This is the user-facing replacement for
// the old debug overlay.
// ────────────────────────────────────────────────────────────────────────

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

function __cb_showToast(level, groupId, args) {
  const host = __cb_ensureToastContainer();
  if (!host) return;
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
  const tag = document.createElement("strong");
  tag.style.cssText = "display:block;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;opacity:0.85;margin-bottom:2px;";
  tag.textContent = "[" + (groupId || "?") + "] " + level;
  const body = document.createElement("div");
  body.textContent = (Array.isArray(args) ? args : [args]).map(__cb_formatToastArg).join(" ");
  toast.appendChild(tag);
  toast.appendChild(body);
  // dismiss on click
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
    __cb_showToast(entry.level || "log", entry.groupId || "", entry.args || []);
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
    console.warn("[CustomBlocker] DOM op failed", op, error);
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
      const platformIntent = intent.intent;
      if (platformIntent.kind === "homePage" && platformIntent.value === "hide") {
        if (typeof attemptExitPage === "function") {
          try { attemptExitPage(""); } catch {}
        } else {
          location.replace("about:blank");
        }
      }
    }
  } catch (error) {
    console.warn("[CustomBlocker] event intent failed", intent, error);
  }
}

function __cb_processApplyMessage(message) {
  if (!message || typeof message !== "object") return;
  __cb_renderLogs(message.logs);
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
          console.warn("[CustomBlocker] failed to apply queued message", error);
        }
      }
      if (Number.isFinite(response.handlerCount)) {
        const count = response.handlerCount;
        if (count === 0) {
          __cb_showToast(
            "warn",
            "system",
            ["custom-blocker: 0 handlers active. Open the popup → your Custom group → click Run."]
          );
        } else {
          __cb_showToast(
            "log",
            "system",
            ["custom-blocker ready · " + count + " handler(s) active. Reload this page to fire openWebEvent."]
          );
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

