/* Custom Web Blocker — platform site-profile registry.
 *
 * SINGLE SOURCE OF TRUTH for everything platform-specific (YouTube,
 * TikTok, Facebook, Instagram, Twitch, Reddit, Discord, Twitter/X).
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
  "twitter"
];

// Types that share the "platform video" model (content-type + creator axes
// matched against detectVideoSiteContext()). Twitter is feed-based but does
// NOT use the video-form axis, so it is handled on its own track.
const PLATFORM_VIDEO_GROUP_TYPES = ["youtube", "tiktok", "facebook", "instagram", "twitch"];

function normalizeGroupType(value) {
  if (value === "custom") return "custom";
  return PLATFORM_GROUP_TYPES.includes(value) ? value : "site";
}

function isPlatformVideoGroupType(groupType) {
  return PLATFORM_VIDEO_GROUP_TYPES.includes(normalizeGroupType(groupType));
}

// Any non-custom, non-site group that owns a dedicated matcher in this
// registry (drives whether the editor shows the platform-rules card).
function isPlatformProfileGroupType(groupType) {
  return PLATFORM_GROUP_TYPES.includes(normalizeGroupType(groupType));
}

// ────────────────────────────────────────────────────────────────────────
// Mode / value normalisation
// ────────────────────────────────────────────────────────────────────────

function normalizePlatformAuthorMode(value) {
  return value === "include" || value === "exclude" ? value : "none";
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

function normalizePlatformAuthorInput(value, groupType) {
  const normalizedGroupType = normalizeGroupType(groupType);

  if (normalizedGroupType === "youtube") {
    return normalizeYouTubeCreatorInput(value);
  }
  if (normalizedGroupType === "twitter") {
    return normalizeTwitterHandleInput(value);
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
      const reserved = new Set(["watch", "reel", "groups", "marketplace", "gaming", "video", "videos"]);
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
    default: return false;
  }
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

function extractPrimaryAuthorFromPath(groupType, pathname, url) {
  const safePathname = String(pathname ?? "/");
  const t = normalizeGroupType(groupType);

  if (t === "youtube") return normalizeYouTubeCreatorInput(safePathname);

  if (t === "twitter") {
    const match = safePathname.match(/^\/([^/?#]+)/i);
    return match ? normalizeTwitterHandleInput(match[1]) : null;
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
    const reserved = new Set(["watch", "reel", "groups", "marketplace", "gaming", "video", "videos"]);
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
const PLATFORM_AUTHOR_MAP_TYPES = ["youtube", "tiktok", "facebook", "instagram", "twitch", "twitter"];

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

  if (isYouTubeGroup) {
    if (!pageContext.isYouTubePage) {
      const authorMode = normalizePlatformAuthorMode(group.platformAuthorMode);
      const videoMode = normalizeVideoMode(group.platformVideoMode);
      return (
        authorMode === "none" &&
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

  const authorMode = normalizePlatformAuthorMode(group.platformAuthorMode);
  if (authorMode === "none") return true;

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

// Twitter/X uses the account axis (platformAuthorMode/platformAuthors) but no
// video-form axis. authorMode "none" means "block all of X" (coarse).
function matchesTwitterGroup(group, pageContext) {
  if (!pageContext.isTwitterPage) return false;
  if (group.blockHomePage && isHomeFeedPage("twitter", pageContext.hostname, pageContext.pathname)) {
    return true;
  }

  const mode = normalizePlatformAuthorMode(group.platformAuthorMode);
  if (mode === "none") return true;

  const accounts = Array.isArray(group.platformAuthors) ? group.platformAuthors : [];
  if (accounts.length === 0) return false;

  const pageAccounts = Array.isArray(pageContext.platformAuthors?.twitter)
    ? pageContext.platformAuthors.twitter
    : [];
  if (pageAccounts.length === 0) return false;

  const hasMatch = accounts.some((account) => pageAccounts.includes(account));
  return mode === "include" ? hasMatch : !hasMatch;
}

// Single dispatch entry point — "does this platform group block this page?"
function matchesProfileGroup(group, pageContext) {
  const t = normalizeGroupType(group.groupType);
  if (isPlatformVideoGroupType(t)) return matchesPlatformVideoGroup(group, pageContext);
  if (t === "reddit") return matchesRedditGroup(group, pageContext);
  if (t === "discord") return matchesDiscordGroup(group, pageContext);
  if (t === "twitter") return matchesTwitterGroup(group, pageContext);
  return false;
}

// ────────────────────────────────────────────────────────────────────────
// Surface-hide ("hide elements") catalogue
//
// These hide UI chrome / content-type surfaces that are NOT tied to the
// coarse blocking predicate (e.g. the Shorts button, X's Grok tab, promoted
// posts). Each entry is a CSS-selector group applied by content.js whenever
// the owning platform group is active on the host. group.surfaceHides holds
// the enabled entry ids.
// ────────────────────────────────────────────────────────────────────────

function normalizeSurfaceHides(value, groupType) {
  const profile = PLATFORM_PROFILES[normalizeGroupType(groupType)];
  const allowed = new Set((profile?.surfaceHides ?? []).map((entry) => entry.id));
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.filter((id) => allowed.has(id)))];
}

function getSurfaceHideSelectors(groupType, enabledIds) {
  const profile = PLATFORM_PROFILES[normalizeGroupType(groupType)];
  if (!profile || !Array.isArray(profile.surfaceHides)) return [];
  const enabled = new Set(Array.isArray(enabledIds) ? enabledIds : []);
  const selectors = [];
  for (const entry of profile.surfaceHides) {
    if (!enabled.has(entry.id)) continue;
    for (const sel of entry.selectors) selectors.push(sel);
  }
  return selectors;
}

// ────────────────────────────────────────────────────────────────────────
// PLATFORM_PROFILES — the declarative registry
//
//   defaultName   : default group name when created
//   labelKey      : i18n key for the type label
//   kind          : "video" | "reddit" | "discord" | "twitter"
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
      labelKey: "platform.authors.youtube",
      placeholderKey: "platform.authors.youtube.placeholder"
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
        selectors: [
          "ytd-guide-entry-renderer:has(a[title=\"Shorts\"])",
          "ytd-mini-guide-entry-renderer[aria-label=\"Shorts\"]",
          "ytd-pivot-bar-item-renderer:has(a[title=\"Shorts\"])"
        ]
      },
      {
        id: "comments",
        labelKey: "surfaceHide.youtube.comments",
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
      labelKey: "platform.authors.tiktok",
      placeholderKey: "platform.authors.tiktok.placeholder"
    },
    contentType: { field: "platformVideoMode", values: ["all", "short"] },
    feed: {
      anchorSelectors: ['a[href*="/video/"]'],
      hrefSelectors: ['a[href*="/video/"]'],
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
      labelKey: "platform.authors.facebook",
      placeholderKey: "platform.authors.facebook.placeholder"
    },
    contentType: { field: "platformVideoMode", values: ["all", "short", "long", "post"] },
    feed: {
      anchorSelectors: ['a[href*="/reel/"]', 'a[href*="/watch/"]', 'a[href*="/posts/"]', 'a[href*="/permalink/"]'],
      hrefSelectors: ['a[href*="/reel/"]', 'a[href*="/watch/"]', 'a[href*="/posts/"]', 'a[href*="/permalink/"]'],
      replenish: { scroll: true }
    },
    surfaceHides: [
      {
        id: "reels",
        labelKey: "surfaceHide.facebook.reels",
        selectors: ['a[href^="/reel/"]', 'a[aria-label="Reels"]']
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
      labelKey: "platform.authors.instagram",
      placeholderKey: "platform.authors.instagram.placeholder"
    },
    contentType: { field: "platformVideoMode", values: ["all", "short", "post", "long"] },
    feed: {
      anchorSelectors: ['a[href^="/reel/"]', 'a[href^="/p/"]', 'a[href^="/tv/"]'],
      hrefSelectors: ['a[href^="/reel/"]', 'a[href^="/p/"]', 'a[href^="/tv/"]'],
      replenish: { scroll: true }
    },
    surfaceHides: [
      {
        id: "reels",
        labelKey: "surfaceHide.instagram.reels",
        selectors: ['a[href="/reels/"]', 'a[href^="/reels/"]']
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
      labelKey: "platform.authors.twitch",
      placeholderKey: "platform.authors.twitch.placeholder"
    },
    contentType: { field: "platformVideoMode", values: ["all", "short", "long", "post"] },
    feed: {
      anchorSelectors: ['a[href*="/clip/"]', 'a[href^="/videos/"]'],
      hrefSelectors: ['a[href*="/clip/"]', 'a[href^="/videos/"]'],
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
      labelKey: "platform.subreddits",
      placeholderKey: "platform.subreddits.placeholder"
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
      labelKey: "platform.discordTargets",
      placeholderKey: "platform.discordTargets.placeholder"
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
      labelKey: "platform.accounts.twitter",
      placeholderKey: "platform.accounts.twitter.placeholder"
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
  }
};

// ────────────────────────────────────────────────────────────────────────
// Export — bare globals for worker/content/popup, module.exports for Node.
// ────────────────────────────────────────────────────────────────────────

const __cbPlatformRegistry = {
  PLATFORM_GROUP_TYPES,
  PLATFORM_VIDEO_GROUP_TYPES,
  PLATFORM_PROFILES,
  normalizeGroupType,
  isPlatformVideoGroupType,
  isPlatformProfileGroupType,
  normalizePlatformAuthorMode,
  normalizeVideoMode,
  normalizeRedditMode,
  normalizeDiscordMode,
  normalizeYouTubeCreatorInput,
  normalizeTwitterHandleInput,
  normalizePlatformAuthorInput,
  normalizeRedditSubredditInput,
  normalizeDiscordTargetInput,
  normalizePlatformEntityInput,
  isYouTubeHost,
  isRedditHost,
  isDiscordHost,
  isTwitterHost,
  isPlatformHost,
  parseRedditSubredditFromPath,
  parseDiscordServerIdFromPath,
  parseDiscordChannelIdFromPath,
  detectVideoSiteContext,
  extractPrimaryAuthorFromPath,
  normalizePlatformAuthorsMap,
  isHomeFeedPage,
  matchesVideoMode,
  matchesPlatformVideoGroup,
  matchesRedditGroup,
  matchesDiscordGroup,
  matchesTwitterGroup,
  matchesProfileGroup,
  normalizeSurfaceHides,
  getSurfaceHideSelectors
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = __cbPlatformRegistry;
}
