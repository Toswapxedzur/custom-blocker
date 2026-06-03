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
    if (safePathname.startsWith("/videos/")) return { site: "twitch", form: "long" };
    // Twitch channel pages (twitch.tv/<streamer> and its sub-tabs) are
    // represented as `form: "post"` — see platform.post.twitch =
    // "channel pages" in the translation strings. Without this, the
    // "Apply to channel pages" video mode never matches any URL.
    const firstSegment = safePathname.replace(/^\/+/, "").split("/")[0] || "";
    const reserved = new Set([
      "directory", "videos", "settings", "downloads", "subscriptions",
      "search", "jobs", "drops", "inventory",
      "popout", "moderator", "p", "prime", "turbo", "wallet",
      "friends", "messages", "store", "login", "signup", "signout"
    ]);
    if (
      firstSegment &&
      !reserved.has(firstSegment.toLowerCase()) &&
      /^[a-z0-9_]+$/i.test(firstSegment)
    ) {
      return { site: "twitch", form: "post" };
    }
    return { site: "twitch", form: "unknown" };
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
  return ["textInput", "textarea", "numberInput", "range", "select", "date", "time", "color"].includes(type);
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

function __cb_predicateHide(card) {
  if (!card || card.dataset.cbPredicateHidden === "1") return;
  card.dataset.cbPredicateHidden = "1";
  card.dataset.cbPredicatePrevDisplay = card.style.display || "";
  card.style.setProperty("display", "none", "important");
  card.setAttribute("aria-hidden", "true");
}

function __cb_predicateRestoreAll() {
  for (const card of document.querySelectorAll('[data-cb-predicate-hidden="1"]')) {
    if ("cbPredicatePrevDisplay" in card.dataset) {
      card.style.display = card.dataset.cbPredicatePrevDisplay;
      delete card.dataset.cbPredicatePrevDisplay;
    } else {
      card.style.removeProperty("display");
    }
    delete card.dataset.cbPredicateHidden;
    card.removeAttribute("aria-hidden");
  }
}

async function __cb_evaluateItems(platform, slot, items) {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return null;
  try {
    const r = await chrome.runtime.sendMessage({
      type: "evaluate-platform-items",
      platform,
      slot,
      items
    });
    if (r && r.ok && Array.isArray(r.results)) return r.results;
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

  const bySlot = { shorts: [], videos: [], posts: [] };
  for (const card of cards) {
    if (card.dataset.cbPredicateHidden === "1") continue;
    const item = __cb_extractCardItem(card, platform);
    const slot = __cb_videoFormToSlot(item.videoForm);
    if (!slot) continue;
    if (!__cb_activePredicateSlots.has(platform + ":" + slot)) continue;
    bySlot[slot].push({ card, item });
  }

  for (const slot of ["shorts", "videos", "posts"]) {
    const batch = bySlot[slot];
    if (batch.length === 0) continue;
    const results = await __cb_evaluateItems(platform, slot, batch.map((b) => b.item));
    if (!results) continue;
    for (let i = 0; i < batch.length; i++) {
      if (results[i] && results[i].hide) __cb_predicateHide(batch[i].card);
    }
  }
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
  const results = await __cb_evaluateItems(platform, slot, [item]);
  const r = results && results[0];
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
        __cb_ensurePredicateObserver();
        __cb_schedulePredicateScan();
        __cb_checkPagePredicate();
      } else if (platformIntent.kind === "clearPredicates" && typeof platformIntent.slot === "string" && platform) {
        __cb_activePredicateSlots.delete(platform + ":" + platformIntent.slot);
        __cb_predicateRestoreAll();
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

