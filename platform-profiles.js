/* Custom Web Blocker — platform site-profile registry.
 *
 * SINGLE SOURCE OF TRUTH for everything platform-specific (YouTube,
 * TikTok, Facebook, Instagram, Twitch, Reddit, Discord, Twitter/X, Bluesky,
 * Threads, Substack, Bilibili, Rumble, Pinterest, Kick, Tumblr, PeerTube,
 * Pixelfed, and Kuaishou).
 *
 * This file is loaded into all three script contexts:
 *   - background service worker (via importScripts / packaged scripts)
 *   - content script (listed in manifest content_scripts before content.js)
 *   - popup editor (via <script> tag before popup.js)
 *
 * Everything here is PURE (no DOM, no chrome.* access at module scope), so
 * the same file runs in the worker, the page, and under Node for tests.
 * DOM-walking lives in content.js but is *driven* by the selector data and
 * helper hooks declared here.
 *
 * Adding a new platform = add one PLATFORM_PROFILES entry (+ any genuinely
 * irreducible DOM extractor hook in content.js, keyed by the profile id).
 */

// ────────────────────────────────────────────────────────────────────────
// Group-type vocabulary
// ────────────────────────────────────────────────────────────────────────

const PLATFORM_GROUP_TYPES = [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
  "twitch",
  "reddit",
  "discord",
  "twitter",
  "bluesky",
  "threads",
  "substack",
  "bilibili",
  "rumble",
  "pinterest",
  "kick",
  "tumblr",
  "peertube",
  "pixelfed",
  "kuaishou"
];

// Types that share the "platform video" model (content-type + creator axes
// matched against detectVideoSiteContext()). Twitter is feed-based but does
// NOT use the video-form axis, so it is handled on its own track.
const PLATFORM_VIDEO_GROUP_TYPES = ["youtube", "tiktok", "facebook", "instagram", "twitch"];

// Feed-first platforms share the author/account and home-feed axes without a
// video-form selector. Twitter/X belongs here too.
const PLATFORM_FEED_GROUP_TYPES = [
  "twitter",
  "bluesky",
  "threads",
  "substack",
  "bilibili",
  "rumble",
  "pinterest",
  "kick",
  "tumblr",
  "peertube",
  "pixelfed",
  "kuaishou"
];

function normalizeGroupType(value) {
  if (value === "custom") return "custom";
  return PLATFORM_GROUP_TYPES.includes(value) ? value : "site";
}

function isPlatformVideoGroupType(groupType) {
  return PLATFORM_VIDEO_GROUP_TYPES.includes(normalizeGroupType(groupType));
}

function isPlatformFeedGroupType(groupType) {
  return PLATFORM_FEED_GROUP_TYPES.includes(normalizeGroupType(groupType));
}

function isPlatformAuthorGroupType(groupType) {
  const t = normalizeGroupType(groupType);
  return isPlatformVideoGroupType(t) || isPlatformFeedGroupType(t);
}

// Any non-custom, non-site group that owns a dedicated matcher in this
// registry (drives whether the editor shows the platform-rules card).
function isPlatformProfileGroupType(groupType) {
  return PLATFORM_GROUP_TYPES.includes(normalizeGroupType(groupType));
}

// ────────────────────────────────────────────────────────────────────────
// Mode / value normalisation
// ────────────────────────────────────────────────────────────────────────

// Author/account axis modes.
//   all          → applies to every author (default; legacy "none" maps here)
//   include      → applies only to the listed authors
//   exclude      → applies to every author except the listed ones
//   nobody       → applies to no author (author axis blocks nothing)
//   tagInclude   → YouTube creators carrying any selected tag
//   tagExclude   → classified YouTube creators carrying none of the selected tags
const PLATFORM_AUTHOR_MODES = ["all", "include", "exclude", "nobody", "tagInclude", "tagExclude"];
const PLATFORM_AUTHOR_TAG_MODES = ["tagInclude", "tagExclude"];

function normalizePlatformAuthorMode(value) {
  if (value === "none") return "all"; // legacy value meant "apply to all authors"
  return PLATFORM_AUTHOR_MODES.includes(value) ? value : "all";
}

// True when the author mode keys off an explicit author list (include/exclude).
function platformAuthorModeUsesList(mode) {
  const m = normalizePlatformAuthorMode(mode);
  return m === "include" || m === "exclude";
}

// True for the YouTube tag-based author modes.
function isPlatformAuthorTagMode(mode) {
  return PLATFORM_AUTHOR_TAG_MODES.includes(normalizePlatformAuthorMode(mode));
}

// Shared, state-aware tag predicate for page and feed enforcement. Only a
// definitive `tagged` verdict is safe to use: pending, unknown, below-floor,
// absent, and network-error states all fail open for BOTH modes.
function matchesYouTubeTagSelection(mode, wantedTags, tagState, channelTags) {
  const normalizedMode = normalizePlatformAuthorMode(mode);
  if (!isPlatformAuthorTagMode(normalizedMode)) return false;
  const wanted = Array.isArray(wantedTags) ? wantedTags.filter(Boolean) : [];
  if (wanted.length === 0 || tagState !== "tagged") return false;
  const actual = Array.isArray(channelTags) ? channelTags : [];
  const hasTag = wanted.some((slug) => actual.includes(slug));
  return normalizedMode === "tagInclude" ? hasTag : !hasTag;
}

function normalizeVideoMode(value) {
  return value === "short" || value === "long" || value === "post" ? value : "all";
}

function normalizeRedditMode(value, fallbackList) {
  if (value === "all" || value === "include" || value === "exclude") return value;
  const list = Array.isArray(fallbackList) ? fallbackList : [];
  return list.length > 0 ? "include" : "all";
}

function normalizeDiscordMode(value, fallbackList) {
  if (value === "all" || value === "include" || value === "exclude") return value;
  const list = Array.isArray(fallbackList) ? fallbackList : [];
  return list.length > 0 ? "include" : "all";
}

// ────────────────────────────────────────────────────────────────────────
// Entity (creator / subreddit / server / account) normalisation
// ────────────────────────────────────────────────────────────────────────

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

// Twitter/X @handle. Handles are 1-15 chars of [A-Za-z0-9_]. Reserved
// top-level paths are app routes, not accounts.
const TWITTER_RESERVED_PATHS = new Set([
  "home", "explore", "notifications", "messages", "search", "settings",
  "i", "compose", "hashtag", "intent", "login", "logout", "signup",
  "tos", "privacy", "about", "status", "bookmarks", "lists", "communities",
  "jobs", "premium", "verified_followers"
]);

function normalizeTwitterHandleInput(value) {
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
  const first = (trimmed.split("/")[0] || "").replace(/^@/, "");
  if (!first || TWITTER_RESERVED_PATHS.has(first)) return null;
  return /^[a-z0-9_]{1,15}$/.test(first) ? first : null;
}

function normalizeSimplePlatformHandle(value) {
  const handle = String(value ?? "").trim().toLowerCase().replace(/^@/, "");
  return /^[a-z0-9][a-z0-9._-]{0,127}$/.test(handle) ? handle : null;
}

const FEED_PLATFORM_RESERVED_PATHS = {
  pinterest: new Set([
    "pin", "ideas", "search", "explore", "today", "topics", "business",
    "about", "login", "settings", "create", "privacy", "terms"
  ]),
  kick: new Set([
    "categories", "search", "browse", "following", "login", "signup",
    "subscriptions", "terms", "about", "help", "privacy"
  ]),
  pixelfed: new Set([
    "web", "discover", "site", "i", "settings", "login", "register",
    "api", "oauth", "privacy", "terms"
  ])
};

// Normalised values deliberately retain an account/channel prefix where a
// platform has more than one identity namespace. That prevents a PeerTube
// channel from being confused with an account of the same text.
function normalizeFeedPlatformAuthorInput(value, groupType) {
  const t = normalizeGroupType(groupType);
  let raw = String(value ?? "").trim();
  if (!raw) return null;

  let hostname = "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      hostname = parsed.hostname.toLowerCase();
      raw = parsed.pathname;
    } catch {
      // JavaScriptCore test shells may not expose URL. Keep this normaliser
      // deterministic there as well as in Chrome's extension contexts.
      const match = raw.match(/^https?:\/\/([^/?#]+)(\/[^?#]*)?/i);
      if (!match) return null;
      hostname = match[1].toLowerCase();
      raw = match[2] || "/";
    }
  }

  if (
    t === "tumblr" &&
    hostname.endsWith(".tumblr.com") &&
    hostname !== "www.tumblr.com"
  ) {
    const blog = hostname.slice(0, -".tumblr.com".length).split(".").pop();
    const handle = normalizeSimplePlatformHandle(blog);
    return handle ? `blog:${handle}` : null;
  }

  if (
    t === "substack" &&
    hostname.endsWith(".substack.com") &&
    hostname !== "www.substack.com"
  ) {
    return normalizeSimplePlatformHandle(hostname.slice(0, -".substack.com".length).split(".").pop());
  }

  const path = raw.toLowerCase().replace(/^\/+|\/+$/g, "");
  const segments = path.split("/").filter(Boolean);
  const first = segments[0] || "";
  const simpleFirst = normalizeSimplePlatformHandle(first);

  if (t === "bluesky") {
    const handle = path.match(/^profile\/([^/?#]+)/)?.[1] || raw.replace(/^@/, "");
    return normalizeSimplePlatformHandle(handle);
  }
  if (t === "threads" || t === "substack") {
    const handle = path.match(/^@([^/?#]+)/)?.[1] || raw.replace(/^@/, "");
    return normalizeSimplePlatformHandle(handle);
  }
  if (t === "bilibili") {
    const id = path.match(/^space\/?([^/?#]+)/)?.[1] || path.match(/^space:([^/?#]+)/)?.[1];
    return id && /^[0-9]+$/.test(id) ? `space:${id}` : null;
  }
  if (t === "rumble") {
    const match = path.match(/^(user|c)[/:]([^/?#]+)/);
    const handle = match ? normalizeSimplePlatformHandle(match[2]) : null;
    return handle ? `${match[1] === "c" ? "channel" : "user"}:${handle}` : null;
  }
  if (t === "pinterest" || t === "kick" || t === "pixelfed") {
    const reserved = FEED_PLATFORM_RESERVED_PATHS[t];
    return simpleFirst && !reserved.has(simpleFirst) ? simpleFirst : null;
  }
  if (t === "tumblr") {
    const handle = path.match(/^blog\/?([^/?#]+)/)?.[1] || raw;
    const normalized = normalizeSimplePlatformHandle(handle);
    return normalized ? `blog:${normalized}` : null;
  }
  if (t === "peertube") {
    const match = path.match(/^(a|c)[/:]([^/?#]+)/);
    const handle = match ? normalizeSimplePlatformHandle(match[2]) : null;
    return handle ? `${match[1] === "c" ? "channel" : "account"}:${handle}` : null;
  }
  if (t === "kuaishou") {
    const id = path.match(/^profile\/?([^/?#]+)/)?.[1] || path.match(/^profile:([^/?#]+)/)?.[1];
    return id && /^[a-z0-9_-]+$/i.test(id) ? `profile:${id}` : null;
  }

  return null;
}

function normalizePlatformAuthorInput(value, groupType) {
  const normalizedGroupType = normalizeGroupType(groupType);

  if (normalizedGroupType === "youtube") {
    return normalizeYouTubeCreatorInput(value);
  }
  if (normalizedGroupType === "twitter") {
    return normalizeTwitterHandleInput(value);
  }
  if (isPlatformFeedGroupType(normalizedGroupType)) {
    return normalizeFeedPlatformAuthorInput(value, normalizedGroupType);
  }

  let trimmed = String(value ?? "").trim().toLowerCase();
  const extractFromPath = (pathLike) => {
    const path = String(pathLike || "").replace(/^\/+|\/+$/g, "");
    const first = path.split("/")[0] || "";

    if (normalizedGroupType === "tiktok") {
      return first.startsWith("@")
        ? first.slice(1) || null
        : /^[a-z0-9._-]+$/i.test(first)
          ? first
          : null;
    }

    if (normalizedGroupType === "instagram") {
      const reserved = new Set(["reel", "p", "tv", "explore", "accounts", "about"]);
      return !reserved.has(first) && /^[a-z0-9._]+$/i.test(first) ? first : null;
    }

    if (normalizedGroupType === "facebook") {
      if (path.startsWith("profile.php")) return null;
      const reserved = new Set(["watch", "reel", "share", "groups", "marketplace", "gaming", "video", "videos"]);
      return !reserved.has(first) && /^[a-z0-9.]+$/i.test(first) ? first : null;
    }

    if (normalizedGroupType === "twitch") {
      const reserved = new Set([
        "directory",
        "videos",
        "settings",
        "downloads",
        "subscriptions",
        "search",
        "jobs",
        "drops",
        "inventory"
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
      if (normalizedGroupType === "facebook" && path.startsWith("profile.php")) {
        const id = parsed.searchParams.get("id");
        return id ? `id:${id}` : null;
      }
      const extracted = extractFromPath(path);
      if (extracted) return extracted;
      trimmed = path;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) return extractFromPath(trimmed);

  trimmed = trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");

  if (normalizedGroupType === "facebook" && trimmed.startsWith("id:")) return trimmed;

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

function normalizeDiscordTargetInput(value) {
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
    trimmed = channelsMatch[2] || channelsMatch[1] || "";
  }
  if (trimmed === "@me") return null;
  return /^[0-9]{6,24}$/.test(trimmed) ? trimmed : null;
}

// Dispatch entity normalisation by group type — used by the editor when it
// parses the textarea, and by content/background when reading data.
function normalizePlatformEntityInput(value, groupType) {
  const t = normalizeGroupType(groupType);
  if (t === "reddit") return normalizeRedditSubredditInput(value);
  if (t === "discord") return normalizeDiscordTargetInput(value);
  return normalizePlatformAuthorInput(value, t);
}

// ────────────────────────────────────────────────────────────────────────
// Host predicates
// ────────────────────────────────────────────────────────────────────────

function isYouTubeHost(hostname) {
  return Boolean(
    hostname &&
      (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be")
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

function isTwitterHost(hostname) {
  return Boolean(
    hostname &&
      (hostname === "twitter.com" ||
        hostname.endsWith(".twitter.com") ||
        hostname === "x.com" ||
        hostname.endsWith(".x.com"))
  );
}

function isPlatformHost(groupType, hostname) {
  if (!hostname) return false;
  switch (normalizeGroupType(groupType)) {
    case "youtube": return isYouTubeHost(hostname);
    case "tiktok": return hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");
    case "facebook": return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    case "instagram": return hostname === "instagram.com" || hostname.endsWith(".instagram.com");
    case "twitch":
      return hostname === "twitch.tv" || hostname.endsWith(".twitch.tv") || hostname === "clips.twitch.tv";
    case "reddit": return isRedditHost(hostname);
    case "discord": return isDiscordHost(hostname);
    case "twitter": return isTwitterHost(hostname);
    case "bluesky": return hostname === "bsky.app" || hostname.endsWith(".bsky.app");
    case "threads": return hostname === "threads.com" || hostname.endsWith(".threads.com");
    case "substack": return hostname === "substack.com" || hostname.endsWith(".substack.com");
    case "bilibili": return hostname === "bilibili.com" || hostname.endsWith(".bilibili.com");
    case "rumble": return hostname === "rumble.com" || hostname.endsWith(".rumble.com");
    case "pinterest": return hostname === "pinterest.com" || hostname.endsWith(".pinterest.com");
    case "kick": return hostname === "kick.com" || hostname.endsWith(".kick.com");
    case "tumblr": return hostname === "tumblr.com" || hostname.endsWith(".tumblr.com");
    // Federation hosts are intentionally scoped to the verified public
    // instances. Adding a whole federated network requires per-instance DOM
    // verification, not an optimistic hostname wildcard.
    case "peertube": return hostname === "peertube.tv" || hostname.endsWith(".peertube.tv");
    case "pixelfed": return hostname === "pixelfed.social" || hostname.endsWith(".pixelfed.social");
    case "kuaishou": return hostname === "kuaishou.com" || hostname.endsWith(".kuaishou.com");
    default: return false;
  }
}

function getPlatformGroupTypeForHost(hostname) {
  return PLATFORM_GROUP_TYPES.find((groupType) => isPlatformHost(groupType, hostname)) || null;
}

// ────────────────────────────────────────────────────────────────────────
// Path parsers
// ────────────────────────────────────────────────────────────────────────

function parseRedditSubredditFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/r\/([^/?#]+)/);
  return match ? normalizeRedditSubredditInput(match[1]) : null;
}

function parseDiscordServerIdFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/channels\/([^/?#]+)/);
  if (!match || match[1] === "@me") return null;
  return normalizeDiscordTargetInput(match[1]);
}

function parseDiscordChannelIdFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/channels\/([^/?#]+)\/([^/?#]+)/);
  if (!match || match[1] === "@me") return null;
  return normalizeDiscordTargetInput(match[2]);
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
    if (
      safePathname.startsWith("/reel/") ||
      safePathname.startsWith("/watch/reel/") ||
      safePathname.startsWith("/share/r/")
    ) {
      return { site: "facebook", form: "short" };
    }
    if (
      safePathname.startsWith("/watch") ||
      safePathname.startsWith("/videos/") ||
      safePathname.startsWith("/share/v/")
    ) {
      return { site: "facebook", form: "long" };
    }
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

// Public custom-rule predicate slots are deliberately platform-specific:
// TikTok calls its short-form feed "videos", and Twitch calls a channel-path
// live stream "streams". Keep that translation next to URL classification so
// feed scans and page predicates cannot drift from the helper API.
function platformVideoFormToSlot(groupType, form) {
  const t = normalizeGroupType(groupType);
  if (t === "tiktok") return form === "short" ? "videos" : null;
  if (t === "instagram") {
    if (form === "short") return "shorts";
    return form === "post" ? "posts" : null;
  }
  if (t === "twitch") {
    if (form === "short") return "shorts";
    if (form === "long") return "videos";
    return form === "post" ? "streams" : null;
  }
  if (form === "short") return "shorts";
  if (form === "long") return "videos";
  return form === "post" ? "posts" : null;
}

function extractPrimaryAuthorFromPath(groupType, pathname, url) {
  const safePathname = String(pathname ?? "/");
  const t = normalizeGroupType(groupType);

  if (t === "youtube") return normalizeYouTubeCreatorInput(safePathname);

  if (t === "twitter") {
    const match = safePathname.match(/^\/([^/?#]+)/i);
    return match ? normalizeTwitterHandleInput(match[1]) : null;
  }

  if (isPlatformFeedGroupType(t)) {
    return normalizeFeedPlatformAuthorInput(url || safePathname, t);
  }

  if (t === "tiktok") {
    const match = safePathname.match(/^\/@([^/?#]+)/i);
    return match ? normalizePlatformAuthorInput(match[1], t) : null;
  }

  if (t === "instagram") {
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set(["reel", "p", "tv", "explore", "accounts", "about"]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], t);
  }

  if (t === "facebook") {
    try {
      const parsed = url ? new URL(url) : null;
      const id = parsed?.searchParams?.get("id");
      if (id) return normalizePlatformAuthorInput(`id:${id}`, t);
    } catch {}
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set(["watch", "reel", "share", "groups", "marketplace", "gaming", "video", "videos"]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], t);
  }

  if (t === "twitch") {
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set([
      "directory",
      "videos",
      "settings",
      "downloads",
      "subscriptions",
      "search",
      "jobs",
      "drops",
      "inventory"
    ]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], t);
  }

  return null;
}

// Builds the page's author map (per platform) from any client-provided hints
// plus whatever can be parsed from the path. Twitter participates here too so
// account include/exclude works on profile pages.
const PLATFORM_AUTHOR_MAP_TYPES = [
  ...new Set([...PLATFORM_VIDEO_GROUP_TYPES, ...PLATFORM_FEED_GROUP_TYPES])
];

function normalizePlatformAuthorsMap(inputMap, pathname, url) {
  const map = {};
  for (const groupType of PLATFORM_AUTHOR_MAP_TYPES) {
    const raw = Array.isArray(inputMap?.[groupType]) ? inputMap[groupType] : [];
    const normalized = [
      ...new Set(raw.map((author) => normalizePlatformAuthorInput(author, groupType)).filter(Boolean))
    ];
    const fromPath = extractPrimaryAuthorFromPath(groupType, pathname, url);
    if (fromPath && !normalized.includes(fromPath)) normalized.push(fromPath);
    map[groupType] = normalized;
  }
  return map;
}

function isHomeFeedPage(groupType, hostname, pathname) {
  const p = String(pathname ?? "/");
  switch (normalizeGroupType(groupType)) {
    case "youtube":
      return p === "/" || p.startsWith("/feed/");
    case "tiktok":
      return (
        p === "/" ||
        p === "/following" || p.startsWith("/following/") ||
        p === "/explore" || p.startsWith("/explore/") ||
        p === "/foryou" || p.startsWith("/foryou/")
      );
    case "facebook":
      return p === "/" || p === "/watch" || p.startsWith("/watch/");
    case "instagram":
      return (
        p === "/" ||
        p === "/explore" || p.startsWith("/explore/") ||
        p === "/reels" || p.startsWith("/reels/")
      );
    case "twitch":
      return p === "/" || p === "/directory" || p.startsWith("/directory/");
    case "reddit":
      return (
        p === "/" ||
        p === "/r/popular" || p.startsWith("/r/popular/") ||
        p === "/r/all" || p.startsWith("/r/all/")
      );
    case "discord":
      return p === "/channels/@me" || p.startsWith("/channels/@me/");
    case "twitter":
      return p === "/" || p === "/home" || p.startsWith("/home/");
    case "bluesky":
    case "threads":
    case "substack":
    case "bilibili":
    case "rumble":
    case "pinterest":
    case "kick":
      return p === "/";
    case "tumblr":
      return p === "/" || p === "/explore" || p.startsWith("/explore/");
    case "peertube":
      return p === "/" || p === "/videos/browse" || p.startsWith("/videos/browse/");
    case "pixelfed":
      return p === "/" || p === "/web/explore" || p.startsWith("/web/explore/");
    case "kuaishou":
      return p === "/" || p === "/new-reco" || p.startsWith("/new-reco/");
    default:
      return false;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Matchers — page-level "does this group block this page?"
// ────────────────────────────────────────────────────────────────────────

function matchesVideoMode(group, pageContext) {
  const videoMode = normalizeVideoMode(group.platformVideoMode);
  if (videoMode === "all") return true;
  return pageContext.videoForm === videoMode;
}

function matchesPlatformVideoGroup(group, pageContext) {
  const isYouTubeGroup = group.groupType === "youtube";

  const authorMode = normalizePlatformAuthorMode(group.platformAuthorMode);

  if (isYouTubeGroup) {
    if (!pageContext.isYouTubePage) {
      const videoMode = normalizeVideoMode(group.platformVideoMode);
      return (
        authorMode === "all" &&
        videoMode !== "all" &&
        Boolean(pageContext.videoSite) &&
        matchesVideoMode(group, pageContext)
      );
    }
    if (group.blockHomePage && isHomeFeedPage("youtube", pageContext.hostname, pageContext.pathname)) {
      return true;
    }
  } else {
    if (
      group.blockHomePage &&
      isPlatformHost(group.groupType, pageContext.hostname) &&
      isHomeFeedPage(group.groupType, pageContext.hostname, pageContext.pathname)
    ) {
      return true;
    }
    if (pageContext.videoSite !== group.groupType) return false;
  }

  if (!matchesVideoMode(group, pageContext)) return false;

  if (authorMode === "all") return true;

  // YouTube tag axis — shares this engine with the author axis so a tag block
  // has the SAME repercussion as an author block (full page block, not just a
  // feed hide). Fail-open: until we have a definitive tag verdict for the
  // page's channel (channelTagsKnown), we never block.
  if (authorMode === "tagInclude" || authorMode === "tagExclude") {
    if (!isYouTubeGroup) return false;
    const tagState =
      pageContext.channelTagState || (pageContext.channelTagsKnown ? "tagged" : "unknown");
    return matchesYouTubeTagSelection(
      authorMode,
      group.platformAuthorTags,
      tagState,
      pageContext.channelTags
    );
  }

  // "nobody" doesn't block via the author axis.
  if (authorMode !== "include" && authorMode !== "exclude") return false;

  if (!Array.isArray(group.platformAuthors) || group.platformAuthors.length === 0) return false;

  const platformKey = isYouTubeGroup ? "youtube" : group.groupType;
  const pageAuthors = Array.isArray(pageContext.platformAuthors?.[platformKey])
    ? pageContext.platformAuthors[platformKey]
    : [];

  if (pageAuthors.length === 0) return false;

  const hasAuthorMatch = group.platformAuthors.some((author) => pageAuthors.includes(author));
  return authorMode === "include" ? hasAuthorMatch : !hasAuthorMatch;
}

function matchesRedditGroup(group, pageContext) {
  if (!pageContext.isRedditPage) return false;
  if (group.blockHomePage && isHomeFeedPage("reddit", pageContext.hostname, pageContext.pathname)) {
    return true;
  }

  const subreddits = Array.isArray(group.redditSubreddits) ? group.redditSubreddits : [];
  const mode = normalizeRedditMode(group.redditMode, subreddits);

  if (mode === "all") return true;

  if (mode === "include") {
    if (subreddits.length === 0 || !pageContext.redditSubreddit) return false;
    return subreddits.includes(pageContext.redditSubreddit);
  }

  if (!pageContext.redditSubreddit) return false;
  return !subreddits.includes(pageContext.redditSubreddit);
}

function matchesDiscordGroup(group, pageContext) {
  if (!pageContext.isDiscordPage) return false;
  if (group.blockHomePage && isHomeFeedPage("discord", pageContext.hostname, pageContext.pathname)) {
    return true;
  }

  const targets = Array.isArray(group.discordTargets) ? group.discordTargets : [];
  const mode = normalizeDiscordMode(group.discordMode, targets);

  if (mode === "all") return true;

  const serverId = pageContext.discordServerId;
  const channelId = pageContext.discordChannelId;
  if (!serverId && !channelId) return false;

  const isListed =
    (serverId && targets.includes(serverId)) ||
    (channelId && targets.includes(channelId));
  return mode === "include" ? Boolean(isListed) : !isListed;
}

// Feed platforms use the author/account axis (platformAuthorMode/
// platformAuthors) but no video-form axis. authorMode "all" means a coarse
// whole-platform block; include/exclude stay fail-open until the page author
// can be determined.
function matchesPlatformFeedGroup(group, pageContext) {
  const type = normalizeGroupType(group.groupType);
  if (!isPlatformFeedGroupType(type) || !isPlatformHost(type, pageContext.hostname)) return false;
  if (group.blockHomePage && isHomeFeedPage(type, pageContext.hostname, pageContext.pathname)) {
    return true;
  }

  const mode = normalizePlatformAuthorMode(group.platformAuthorMode);
  if (mode === "all") return true;
  // Tag modes are YouTube-only; "nobody" blocks no account.
  if (mode !== "include" && mode !== "exclude") return false;

  const authors = Array.isArray(group.platformAuthors) ? group.platformAuthors : [];
  if (authors.length === 0) return false;

  const pageAuthors = Array.isArray(pageContext.platformAuthors?.[type])
    ? pageContext.platformAuthors[type]
    : [];
  if (pageAuthors.length === 0) return false;

  const hasMatch = authors.some((author) => pageAuthors.includes(author));
  return mode === "include" ? hasMatch : !hasMatch;
}

function matchesTwitterGroup(group, pageContext) {
  return matchesPlatformFeedGroup(group, pageContext);
}

// Single dispatch entry point — "does this platform group block this page?"
function matchesProfileGroup(group, pageContext) {
  const t = normalizeGroupType(group.groupType);
  if (isPlatformVideoGroupType(t)) return matchesPlatformVideoGroup(group, pageContext);
  if (t === "reddit") return matchesRedditGroup(group, pageContext);
  if (t === "discord") return matchesDiscordGroup(group, pageContext);
  if (isPlatformFeedGroupType(t)) return matchesPlatformFeedGroup(group, pageContext);
  return false;
}

// ────────────────────────────────────────────────────────────────────────
// Surface-hide ("hide elements") catalogue
//
// Each entry is a CSS-selector group applied by content.js whenever the owning
// platform group is active on the host. group.surfaceHides holds the enabled
// entry ids. An entry's `scope` decides how widely it applies:
//   "app"   (default) → site-wide chrome/content-type (Shorts button, Grok
//                        tab, promoted posts) — hidden whenever the group is
//                        active on the host, independent of the author list.
//   "entry" → tied to a single targeted entry (e.g. a video's author), so it
//             is only hidden on pages matching the group's author scope
//             (handled by background.js gating the selector emission).
// ────────────────────────────────────────────────────────────────────────

const SURFACE_FEED_CARDS_DIRECTIVE_PREFIX = "__cb_surface_feed_cards__:";

function getSurfaceFeedCardsDirective(groupType) {
  return `${SURFACE_FEED_CARDS_DIRECTIVE_PREFIX}${normalizeGroupType(groupType)}`;
}

function parseSurfaceFeedCardsDirective(value) {
  if (typeof value !== "string" || !value.startsWith(SURFACE_FEED_CARDS_DIRECTIVE_PREFIX)) {
    return null;
  }
  const groupType = normalizeGroupType(value.slice(SURFACE_FEED_CARDS_DIRECTIVE_PREFIX.length));
  return isPlatformProfileGroupType(groupType) ? groupType : null;
}

function surfaceHideEntryScope(entry) {
  return entry && entry.scope === "entry" ? "entry" : "app";
}

// The core controls are deliberately composable: a user can hide ads and
// recommendations while leaving ordinary cards visible, or enable all-cards
// as a deliberate blank-feed switch. Platform-specific selectors are declared
// below once the profiles have been built.
function getSurfaceHideEntries(groupType) {
  const type = normalizeGroupType(groupType);
  const profile = PLATFORM_PROFILES[type];
  if (!profile) return [];

  const entries = [...(Array.isArray(profile.surfaceHides) ? profile.surfaceHides : [])];
  const categories = PLATFORM_SURFACE_CATEGORY_SELECTORS[type] || {};
  for (const category of SURFACE_HIDE_CATEGORIES) {
    if (category.id === "all-content-cards") {
      entries.push({
        id: category.id,
        labelKey: category.labelKey,
        selectors: [getSurfaceFeedCardsDirective(type)]
      });
      continue;
    }
    const selectors = categories[category.id];
    if (!Array.isArray(selectors) || selectors.length === 0) continue;
    entries.push({
      id: category.id,
      labelKey: category.labelKey,
      selectors,
      warnOnEnableKey: category.warnOnEnableKey
    });
  }
  return entries;
}

function normalizeSurfaceHides(value, groupType) {
  const allowed = new Set(getSurfaceHideEntries(groupType).map((entry) => entry.id));
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.filter((id) => allowed.has(id)))];
}

// scope: "app" | "entry" | undefined (all). Returns the CSS selectors for the
// enabled entries whose scope matches.
function getSurfaceHideSelectors(groupType, enabledIds, scope) {
  const entries = getSurfaceHideEntries(groupType);
  if (entries.length === 0) return [];
  const enabled = new Set(Array.isArray(enabledIds) ? enabledIds : []);
  const selectors = [];
  for (const entry of entries) {
    if (!enabled.has(entry.id)) continue;
    if (scope && surfaceHideEntryScope(entry) !== scope) continue;
    for (const sel of entry.selectors) selectors.push(sel);
  }
  return selectors;
}

// Does a platform group's author/account axis apply to the current page?
// Used to gate entry-scoped surface hides (e.g. hide comments only on videos
// by the group's targeted authors). Ignores the content-type/home axes.
function platformGroupAuthorAxisMatchesPage(group, pageContext) {
  const t = normalizeGroupType(group.groupType);
  const mode = normalizePlatformAuthorMode(group.platformAuthorMode);
  if (mode === "all") return true;
  if (isPlatformAuthorTagMode(mode)) {
    if (t !== "youtube") return false;
    const tagState =
      pageContext.channelTagState || (pageContext.channelTagsKnown ? "tagged" : "unknown");
    return matchesYouTubeTagSelection(
      mode,
      group.platformAuthorTags,
      tagState,
      pageContext.channelTags
    );
  }
  if (mode !== "include" && mode !== "exclude") return false; // nobody

  const list = Array.isArray(group.platformAuthors) ? group.platformAuthors : [];
  if (list.length === 0) return false;

  const key = t;
  const pageAuthors = Array.isArray(pageContext.platformAuthors?.[key])
    ? pageContext.platformAuthors[key]
    : [];
  if (pageAuthors.length === 0) return false;

  const hasMatch = list.some((author) => pageAuthors.includes(author));
  return mode === "include" ? hasMatch : !hasMatch;
}

// ────────────────────────────────────────────────────────────────────────
// PLATFORM_PROFILES — the declarative registry
//
//   defaultName   : default group name when created
//   labelKey      : i18n key for the type label
//   kind          : "video" | "feed" | "reddit" | "discord" | "twitter"
//   entity        : axis describing creators/subreddits/servers/accounts
//                     .mode/.list  → group field names
//                     .labelKey/.placeholderKey → editor wording
//   contentType   : optional video-form axis (video kinds only)
//   feed          : content-script DOM selectors (data-driven scraping/hide)
//                     .replenish.sentinel → selector nudged to backfill feed
//   surfaceHides  : opt-in "hide elements" toggles (chrome + content types)
// ────────────────────────────────────────────────────────────────────────

const PLATFORM_PROFILES = {
  youtube: {
    id: "youtube",
    defaultName: "YouTube Block",
    kind: "video",
    homeFeedLabelKey: "platform.home.youtube",
    entity: {
      mode: "platformAuthorMode",
      list: "platformAuthors",
      labelKey: "platform.authors",
      placeholderKey: "platform.placeholder.youtube"
    },
    contentType: {
      field: "platformVideoMode",
      values: ["all", "short", "long", "post"]
    },
    feed: {
      cardSelectors: [
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
      ],
      replenish: { sentinel: "ytd-continuation-item-renderer" }
    },
    surfaceHides: [
      {
        id: "shorts-button",
        labelKey: "surfaceHide.youtube.shorts",
        // Covers every Shorts surface: the nav entries, the home/subscription/
        // search shelves, AND individual Shorts cards that appear inline in the
        // feed or search results across YouTube's various rollouts.
        selectors: [
          // Nav buttons (desktop sidebar, mini sidebar, mobile pivot bar)
          "ytd-guide-entry-renderer:has(a[title=\"Shorts\"])",
          "ytd-mini-guide-entry-renderer[aria-label=\"Shorts\"]",
          "ytd-pivot-bar-item-renderer:has(a[title=\"Shorts\"])",
          "ytd-guide-entry-renderer:has(a[href=\"/shorts\"])",
          "ytd-mini-guide-entry-renderer:has(a[href=\"/shorts\"])",
          // Shelves / sections (home, subscriptions, search, channel)
          "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
          "ytd-rich-shelf-renderer[is-shorts]",
          "ytd-reel-shelf-renderer",
          "grid-shelf-view-model",
          "ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model)",
          "ytd-rich-section-renderer:has(grid-shelf-view-model)",
          "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)",
          "ytd-item-section-renderer:has(ytd-reel-shelf-renderer)",
          // Catch-all: any shelf/section whose contents link to Shorts.
          "ytd-rich-section-renderer:has(a[href^=\"/shorts\"])",
          "ytd-shelf-renderer:has(a[href^=\"/shorts\"])",
          "ytd-item-section-renderer:has(ytd-reel-item-renderer)",
          // Individual Shorts cards inline in feeds / search / related
          "ytd-rich-item-renderer:has(a[href^=\"/shorts/\"])",
          "ytd-video-renderer:has(a[href^=\"/shorts/\"])",
          "ytd-grid-video-renderer:has(a[href^=\"/shorts/\"])",
          "ytd-compact-video-renderer:has(a[href^=\"/shorts/\"])",
          "ytd-reel-item-renderer",
          "ytm-shorts-lockup-view-model",
          "ytm-shorts-lockup-view-model-v2",
          "yt-shorts-lockup-view-model",
          "yt-lockup-view-model:has(a[href^=\"/shorts/\"])"
        ]
      },
      {
        id: "home-feed-ads",
        labelKey: "surfaceHide.youtube.homeAds",
        // Hiding ads can violate the platform's Terms of Service and risk the
        // account. Warn (and require confirmation) every time it's enabled.
        warnOnEnableKey: "surfaceHide.adWarning",
        // Site-wide: in-feed promoted cards + the home masthead/banner ad.
        // Not tied to the author axis, so app-scoped.
        selectors: [
          "ytd-ad-slot-renderer",
          "ytd-in-feed-ad-layout-renderer",
          "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
          "ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer)",
          "ytd-rich-section-renderer:has(ytd-statement-banner-renderer)",
          "ytd-rich-section-renderer:has(ytd-ad-slot-renderer)",
          "#masthead-ad"
        ]
      },
      {
        id: "comments",
        labelKey: "surfaceHide.youtube.comments",
        // Tied to the watched video's author, not the whole site: only hidden
        // on videos whose channel matches this group's author scope.
        scope: "entry",
        selectors: ["ytd-comments#comments", "#comments"]
      }
    ]
  },

  tiktok: {
    id: "tiktok",
    defaultName: "TikTok Block",
    kind: "video",
    homeFeedLabelKey: "platform.home.tiktok",
    entity: {
      mode: "platformAuthorMode",
      list: "platformAuthors",
      labelKey: "platform.authors",
      placeholderKey: "platform.placeholder.tiktok"
    },
    contentType: { field: "platformVideoMode", values: ["all", "short"] },
    feed: {
      anchorSelectors: ['a[href*="/video/"]'],
      hrefSelectors: ['a[href*="/video/"]'],
      // TikTok's current home/search cards are marked with data-e2e. Keep the
      // link itself as the final fallback: it is better to hide the tile's
      // clickable surface than to silently leave a matched card visible when
      // TikTok experiments with its wrapper markup.
      containerSelectors: [
        '[data-e2e="recommend-list-item-container"]',
        '[data-e2e="search-card"]',
        '[data-e2e="video-item"]',
        '[data-e2e*="feed-item"]',
        "article",
        '[role="article"]',
        "li",
        'a[href*="/video/"]'
      ],
      replenish: { scroll: true }
    },
    surfaceHides: [
      {
        id: "explore",
        labelKey: "surfaceHide.tiktok.explore",
        selectors: ['a[href="/explore"]', '[data-e2e="nav-explore"]']
      }
    ]
  },

  facebook: {
    id: "facebook",
    defaultName: "Facebook Block",
    kind: "video",
    homeFeedLabelKey: "platform.home.facebook",
    entity: {
      mode: "platformAuthorMode",
      list: "platformAuthors",
      labelKey: "platform.authors",
      placeholderKey: "platform.placeholder.facebook"
    },
    contentType: { field: "platformVideoMode", values: ["all", "short", "long", "post"] },
    feed: {
      anchorSelectors: [
        'a[href*="/reel/"]',
        'a[href*="/watch/"]',
        'a[href*="/videos/"]',
        'a[href*="/posts/"]',
        'a[href*="/permalink/"]',
        'a[href*="/share/r/"]',
        'a[href*="/share/v/"]'
      ],
      hrefSelectors: [
        'a[href*="/reel/"]',
        'a[href*="/watch/"]',
        'a[href*="/videos/"]',
        'a[href*="/posts/"]',
        'a[href*="/permalink/"]',
        'a[href*="/share/r/"]',
        'a[href*="/share/v/"]'
      ],
      containerSelectors: [
        '[role="article"]',
        '[data-pagelet*="FeedUnit"]',
        '[data-pagelet*="Video"]',
        "article",
        "li",
        'a[href]'
      ],
      replenish: { scroll: true }
    },
    surfaceHides: [
      {
        id: "reels",
        labelKey: "surfaceHide.facebook.reels",
        // Nav entries plus the in-feed Reels tray / individual reel cards.
        selectors: [
          'a[href^="/reel/"]',
          'a[aria-label="Reels"]',
          'div[aria-label="Reels"]',
          'div[role="article"]:has(a[href^="/reel/"])',
          'div[data-pagelet^="Reels"]'
        ]
      }
    ]
  },

  instagram: {
    id: "instagram",
    defaultName: "Instagram Block",
    kind: "video",
    homeFeedLabelKey: "platform.home.instagram",
    entity: {
      mode: "platformAuthorMode",
      list: "platformAuthors",
      labelKey: "platform.authors",
      placeholderKey: "platform.placeholder.instagram"
    },
    contentType: { field: "platformVideoMode", values: ["all", "short", "post", "long"] },
    feed: {
      anchorSelectors: ['a[href^="/reel/"]', 'a[href^="/p/"]', 'a[href^="/tv/"]'],
      hrefSelectors: ['a[href^="/reel/"]', 'a[href^="/p/"]', 'a[href^="/tv/"]'],
      // Explore/profile grids no longer consistently use <article>; retaining
      // the link as a fallback keeps those tiles filterable across rollouts.
      containerSelectors: [
        "article",
        '[role="article"]',
        '[role="button"]',
        "li",
        'a[href^="/reel/"]',
        'a[href^="/p/"]',
        'a[href^="/tv/"]'
      ],
      replenish: { scroll: true }
    },
    surfaceHides: [
      {
        id: "reels",
        labelKey: "surfaceHide.instagram.reels",
        // Nav entry plus the in-feed Reels tray and individual reel links.
        selectors: [
          'a[href="/reels/"]',
          'a[href^="/reels/"]',
          'svg[aria-label="Reels"]',
          'div:has(> a[href^="/reels/"])'
        ]
      },
      {
        id: "explore",
        labelKey: "surfaceHide.instagram.explore",
        selectors: ['a[href="/explore/"]', 'a[href^="/explore/"]']
      }
    ]
  },

  twitch: {
    id: "twitch",
    defaultName: "Twitch Block",
    kind: "video",
    homeFeedLabelKey: "platform.home.twitch",
    entity: {
      mode: "platformAuthorMode",
      list: "platformAuthors",
      labelKey: "platform.authors",
      placeholderKey: "platform.placeholder.twitch"
    },
    contentType: { field: "platformVideoMode", values: ["all", "short", "long", "post"] },
    feed: {
      // Live-stream cards route to /<channel>, not /videos or /clip. Twitch
      // still exposes stable preview-card targets for those links.
      anchorSelectors: [
        'a[data-a-target="preview-card-image-link"]',
        'a[data-a-target="preview-card-title-link"]',
        'a[href*="/clip/"]',
        'a[href^="/videos/"]'
      ],
      hrefSelectors: [
        'a[data-a-target="preview-card-image-link"]',
        'a[data-a-target="preview-card-title-link"]',
        'a[href*="/clip/"]',
        'a[href^="/videos/"]'
      ],
      containerSelectors: [
        '[data-a-target="preview-card"]',
        '[data-a-target="preview-card-image-link"]',
        "article",
        "li",
        'a[data-a-target="preview-card-image-link"]',
        'a[data-a-target="preview-card-title-link"]',
        'a[href*="/clip/"]',
        'a[href^="/videos/"]'
      ],
      replenish: { scroll: true }
    },
    surfaceHides: [
      {
        id: "browse",
        labelKey: "surfaceHide.twitch.browse",
        selectors: ['a[href="/directory"]', 'a[data-a-target="browse-link"]']
      }
    ]
  },

  reddit: {
    id: "reddit",
    defaultName: "Reddit Block",
    kind: "reddit",
    homeFeedLabelKey: "platform.home.reddit",
    entity: {
      mode: "redditMode",
      list: "redditSubreddits",
      labelKey: "reddit.subreddits",
      placeholderKey: "reddit.subredditsPlaceholder"
    },
    feed: {
      cardSelectors: [
        "shreddit-post",
        "shreddit-ad-post",
        "article:has(shreddit-post)",
        "faceplate-tracker[source=\"search\"] shreddit-post",
        "div.thing[data-subreddit]"
      ],
      replenish: { scroll: true }
    },
    surfaceHides: [
      {
        id: "popular",
        labelKey: "surfaceHide.reddit.popular",
        selectors: ['a[href="/r/popular/"]', 'a[href="/r/all/"]']
      }
    ]
  },

  discord: {
    id: "discord",
    defaultName: "Discord Block",
    kind: "discord",
    homeFeedLabelKey: "platform.home.discord",
    entity: {
      mode: "discordMode",
      list: "discordTargets",
      labelKey: "discord.targets",
      placeholderKey: "discord.targetsPlaceholder"
    },
    surfaceHides: []
  },

  twitter: {
    id: "twitter",
    defaultName: "Twitter / X Block",
    kind: "twitter",
    homeFeedLabelKey: "platform.home.twitter",
    entity: {
      mode: "platformAuthorMode",
      list: "platformAuthors",
      labelKey: "platform.accounts",
      placeholderKey: "platform.placeholder.twitter"
    },
    feed: {
      anchorSelectors: ['article[data-testid="tweet"]'],
      cardSelectors: ['[data-testid="cellInnerDiv"]:has(article[data-testid="tweet"])'],
      replenish: { scroll: true }
    },
    surfaceHides: [
      {
        id: "explore",
        labelKey: "surfaceHide.twitter.explore",
        selectors: ['a[href="/explore"]', 'a[aria-label="Search and explore"]']
      },
      {
        id: "messages",
        labelKey: "surfaceHide.twitter.messages",
        selectors: ['a[href="/messages"]', 'a[data-testid="AppTabBar_DirectMessage_Link"]']
      },
      {
        id: "grok",
        labelKey: "surfaceHide.twitter.grok",
        selectors: ['a[href="/i/grok"]', 'a[aria-label="Grok"]', 'button[aria-label="Grok"]']
      },
      {
        id: "trends",
        labelKey: "surfaceHide.twitter.trends",
        selectors: ['[data-testid="sidebarColumn"] [aria-label="Timeline: Trending now"]', 'div[data-testid="trend"]']
      },
      {
        id: "promoted",
        labelKey: "surfaceHide.twitter.promoted",
        selectors: ['article[data-testid="tweet"]:has(span:not(:empty))[data-cb-promoted="1"]']
      }
    ]
  },

  bluesky: {
    id: "bluesky",
    displayName: "Bluesky",
    defaultName: "Bluesky Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href^="/profile/"][href*="/post/"]'],
      hrefSelectors: ['a[href^="/profile/"][href*="/post/"]'],
      containerSelectors: ['[data-testid="feedItem"]', '[role="article"]', 'article'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  threads: {
    id: "threads",
    displayName: "Threads",
    defaultName: "Threads Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href^="/@"][href*="/post/"]'],
      hrefSelectors: ['a[href^="/@"][href*="/post/"]'],
      containerSelectors: ['[role="article"]', 'article', '[data-pressable-container]'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  substack: {
    id: "substack",
    displayName: "Substack",
    defaultName: "Substack Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href^="/@"][href*="/note/"]', 'a[href*="/p/"]'],
      hrefSelectors: ['a[href^="/@"][href*="/note/"]', 'a[href*="/p/"]'],
      containerSelectors: ['[role="article"]', 'article', 'li'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  bilibili: {
    id: "bilibili",
    displayName: "Bilibili",
    defaultName: "Bilibili Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href*="/video/BV"]'],
      hrefSelectors: ['a[href*="/video/BV"]'],
      containerSelectors: ['.bili-video-card', 'article', 'li'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  rumble: {
    id: "rumble",
    displayName: "Rumble",
    defaultName: "Rumble Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href^="/v"]'],
      hrefSelectors: ['a[href^="/v"]'],
      containerSelectors: ['article', 'li', '[role="article"]'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  pinterest: {
    id: "pinterest",
    displayName: "Pinterest",
    defaultName: "Pinterest Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href^="/pin/"]'],
      hrefSelectors: ['a[href^="/pin/"]'],
      containerSelectors: ['[data-test-id="pin"]', '[role="listitem"]', 'article'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  kick: {
    id: "kick",
    displayName: "Kick",
    defaultName: "Kick Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    // The public homepage did not expose stable content-card semantics. Keep
    // reliable whole-platform/profile enforcement without guessing a feed DOM.
    surfaceHides: []
  },

  tumblr: {
    id: "tumblr",
    displayName: "Tumblr",
    defaultName: "Tumblr Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href*=".tumblr.com/post/"]', 'a[href^="/post/"]'],
      hrefSelectors: ['a[href*=".tumblr.com/post/"]', 'a[href^="/post/"]'],
      containerSelectors: ['[role="article"]', 'article'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  peertube: {
    id: "peertube",
    displayName: "PeerTube",
    defaultName: "PeerTube Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href^="/w/"]'],
      hrefSelectors: ['a[href^="/w/"]'],
      containerSelectors: ['.video-miniature', 'article', 'li'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  pixelfed: {
    id: "pixelfed",
    displayName: "Pixelfed",
    defaultName: "Pixelfed Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    feed: {
      anchorSelectors: ['a[href^="/p/"]'],
      hrefSelectors: ['a[href^="/p/"]'],
      containerSelectors: ['[role="article"]', 'article'],
      replenish: { scroll: true }
    },
    surfaceHides: []
  },

  kuaishou: {
    id: "kuaishou",
    displayName: "Kuaishou",
    defaultName: "Kuaishou Block",
    kind: "feed",
    entity: { mode: "platformAuthorMode", list: "platformAuthors", labelKey: "platform.authors" },
    // The tested public recommendation shell exposed no stable content-card
    // hooks. Profile and whole-platform matching remain available.
    surfaceHides: []
  }
};

const SURFACE_HIDE_CATEGORIES = [
  {
    id: "ads-sponsored",
    labelKey: "surfaceHide.adsSponsored",
    warnOnEnableKey: "surfaceHide.genericAdWarning"
  },
  { id: "short-form", labelKey: "surfaceHide.shortForm" },
  { id: "live-streams", labelKey: "surfaceHide.liveStreams" },
  { id: "comments-replies", labelKey: "surfaceHide.commentsReplies" },
  { id: "recommendations", labelKey: "surfaceHide.recommendations" },
  { id: "all-content-cards", labelKey: "surfaceHide.allContentCards" }
];

// Selectors are intentionally conservative: they target a named/structural
// content surface, never generic navigation links. A missing category means
// the platform has no durable public selector for it yet; all platforms still
// provide the explicit all-content-cards control below.
const PLATFORM_SURFACE_CATEGORY_SELECTORS = {
  youtube: {
    "ads-sponsored": [
      "ytd-ad-slot-renderer",
      "ytd-in-feed-ad-layout-renderer",
      "ytd-display-ad-renderer",
      "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
      "ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer)"
    ],
    "live-streams": [
      'ytd-rich-item-renderer:has(a[href*="/live/"])',
      'ytd-video-renderer:has(a[href*="/live/"])',
      'ytd-compact-video-renderer:has(a[href*="/live/"])'
    ],
    recommendations: ["#related", "ytd-watch-next-secondary-results-renderer"]
  },
  tiktok: {
    "ads-sponsored": ['[data-e2e*="ad-card"]', '[data-e2e*="sponsored"]'],
    "short-form": [getSurfaceFeedCardsDirective("tiktok")],
    "live-streams": ['a[href*="/live"]', '[data-e2e*="live"]'],
    "comments-replies": ['[data-e2e*="comment-list"]', '[data-e2e*="comment-panel"]'],
    recommendations: ['[data-e2e*="recommend"]']
  },
  facebook: {
    "ads-sponsored": [
      '[role="article"]:has([aria-label="Sponsored"])',
      '[data-pagelet*="FeedUnit"]:has([aria-label="Sponsored"])'
    ],
    "short-form": [
      'a[href^="/reel/"]',
      'div[role="article"]:has(a[href^="/reel/"])',
      'div[data-pagelet^="Reels"]'
    ],
    "live-streams": ['a[href*="/live/"]', 'div[role="article"]:has(a[href*="/live/"])'],
    "comments-replies": ['[aria-label="Comments"]', '[data-pagelet*="Comments"]'],
    recommendations: ['[data-pagelet*="PeopleYouMayKnow"]', '[data-pagelet*="PYMK"]']
  },
  instagram: {
    "ads-sponsored": ['article:has(a[href*="/ads/"])'],
    "short-form": ['a[href="/reels/"]', 'a[href^="/reels/"]', 'a[href^="/reel/"]'],
    "live-streams": ['a[href^="/live/"]'],
    "comments-replies": ['[aria-label="Comments"]'],
    recommendations: ['a[href^="/suggested/"]', 'a[href^="/accounts/suggested/"]']
  },
  twitch: {
    "ads-sponsored": ['[data-a-target*="ad"]', '[class*="ad-container"]'],
    "short-form": ['a[href*="/clip/"]', 'a[href*="clips.twitch.tv/"]'],
    "live-streams": [getSurfaceFeedCardsDirective("twitch")],
    "comments-replies": ['[data-a-target="chat-room-component"]'],
    recommendations: ['[data-a-target="side-nav-card"]']
  },
  reddit: {
    "ads-sponsored": ["shreddit-ad-post", '[data-click-id="promoted"]', '[data-testid*="ad"]'],
    "comments-replies": ["shreddit-comment-tree", "#comment-tree", ".commentarea"],
    recommendations: ['faceplate-tracker[source*="recommend"]']
  },
  discord: {
    "comments-replies": [
      'li[id^="chat-messages-"]',
      '[data-list-item-id^="chat-messages_"]',
      '[class*="messageListItem"]'
    ]
  },
  twitter: {
    "ads-sponsored": ['article:has([data-testid="placementTracking"])'],
    "live-streams": ['a[href*="/i/broadcasts/"]'],
    "comments-replies": ['[aria-label^="Timeline: Conversation"] article'],
    recommendations: ['[data-testid="sidebarColumn"] [aria-label*="Who to follow"]']
  },
  bluesky: {
    "comments-replies": ['[data-testid="postThread"] [role="article"]'],
    recommendations: ['[data-testid*="suggest"]']
  },
  threads: {
    "comments-replies": ['[role="dialog"] [role="article"]'],
    recommendations: ['a[href*="/suggested/"]']
  },
  substack: {
    "comments-replies": ["#comments", '[data-testid*="comment"]']
  },
  bilibili: {
    "ads-sponsored": ['a[href*="cm.bilibili.com"]', '[class*="ad"]'],
    "live-streams": ['a[href*="live.bilibili.com"]'],
    "comments-replies": ["#comment", ".reply-list", '[class*="comment"]'],
    recommendations: [".recommended-container", '[class*="recommend"]']
  },
  rumble: {
    "ads-sponsored": ['[class*="ad-"]', '[id*="ad_"]'],
    "comments-replies": ["#comments", '[class*="comment"]'],
    recommendations: ['[class*="recommended"]']
  },
  pinterest: {
    "ads-sponsored": ['[data-test-id*="ad"]', '[data-test-id*="promoted"]'],
    "short-form": ['a[href^="/idea/"]'],
    "comments-replies": ['[data-test-id*="comment"]'],
    recommendations: ['[data-test-id*="recommend"]']
  },
  kick: {
    "ads-sponsored": ['[data-testid*="ad"]'],
    "live-streams": [getSurfaceFeedCardsDirective("kick")],
    "comments-replies": ['[data-testid*="chat"]', '[class*="chat-room"]'],
    recommendations: ['[data-testid*="recommended"]']
  },
  tumblr: {
    "ads-sponsored": ['[data-testid*="ad"]', '[class*="sponsored"]'],
    "comments-replies": ['[data-testid*="notes"]', '[class*="notes"]'],
    recommendations: ['[data-testid*="recommend"]']
  },
  peertube: {
    "comments-replies": ["my-comment-list", ".comment-list"],
    recommendations: [".related-videos", ".video-recommendations"]
  },
  pixelfed: {
    "comments-replies": ["#comments", '[class*="comment"]'],
    recommendations: ['[class*="recommend"]']
  },
  kuaishou: {
    "ads-sponsored": ['[data-testid*="ad"]', '[class*="ad"]'],
    "short-form": [getSurfaceFeedCardsDirective("kuaishou")],
    "live-streams": ['a[href*="/live"]'],
    "comments-replies": ['[class*="comment"]'],
    recommendations: ['[class*="recommend"]']
  }
};

// Some public platforms do not expose a stable entry URL for every discovery
// tile. These selectors are used only by the explicit all-cards (or a
// whole-feed short/live) control, never by author-aware feed filtering.
const PLATFORM_SURFACE_CARD_SELECTORS = {
  discord: [
    'li[id^="chat-messages-"]',
    '[data-list-item-id^="chat-messages_"]',
    '[class*="messageListItem"]'
  ],
  kick: [
    'main [data-testid*="card"]',
    'main [class*="channel-card"]',
    'main [class*="thumbnail"]'
  ],
  kuaishou: [
    'main [data-testid*="card"]',
    'main [class*="feed-card"]',
    'main [class*="video-card"]'
  ]
};

// ────────────────────────────────────────────────────────────────────────
// Export — bare globals for worker/content/popup, module.exports for Node.
// ────────────────────────────────────────────────────────────────────────

const __cbPlatformRegistry = {
  PLATFORM_GROUP_TYPES,
  PLATFORM_VIDEO_GROUP_TYPES,
  PLATFORM_FEED_GROUP_TYPES,
  SURFACE_HIDE_CATEGORIES,
  PLATFORM_SURFACE_CATEGORY_SELECTORS,
  PLATFORM_SURFACE_CARD_SELECTORS,
  PLATFORM_PROFILES,
  normalizeGroupType,
  isPlatformVideoGroupType,
  isPlatformFeedGroupType,
  isPlatformAuthorGroupType,
  isPlatformProfileGroupType,
  normalizePlatformAuthorMode,
  normalizeVideoMode,
  normalizeRedditMode,
  normalizeDiscordMode,
  normalizeYouTubeCreatorInput,
  normalizeTwitterHandleInput,
  normalizeFeedPlatformAuthorInput,
  normalizePlatformAuthorInput,
  normalizeRedditSubredditInput,
  normalizeDiscordTargetInput,
  normalizePlatformEntityInput,
  isYouTubeHost,
  isRedditHost,
  isDiscordHost,
  isTwitterHost,
  isPlatformHost,
  getPlatformGroupTypeForHost,
  parseRedditSubredditFromPath,
  parseDiscordServerIdFromPath,
  parseDiscordChannelIdFromPath,
  detectVideoSiteContext,
  platformVideoFormToSlot,
  extractPrimaryAuthorFromPath,
  normalizePlatformAuthorsMap,
  isHomeFeedPage,
  matchesVideoMode,
  matchesPlatformVideoGroup,
  matchesRedditGroup,
  matchesDiscordGroup,
  matchesTwitterGroup,
  matchesPlatformFeedGroup,
  matchesProfileGroup,
  getSurfaceHideEntries,
  normalizeSurfaceHides,
  getSurfaceHideSelectors,
  getSurfaceFeedCardsDirective,
  parseSurfaceFeedCardsDirective,
  surfaceHideEntryScope,
  platformGroupAuthorAxisMatchesPage,
  platformAuthorModeUsesList,
  isPlatformAuthorTagMode,
  matchesYouTubeTagSelection,
  PLATFORM_AUTHOR_MODES,
  PLATFORM_AUTHOR_TAG_MODES
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = __cbPlatformRegistry;
}
