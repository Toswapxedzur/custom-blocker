/* Custom Web Blocker — background service worker.
 *
 * Responsibilities:
 *   - Persist groups, usage timers, snoozes, custom timer state, custom
 *     persistence buckets.
 *   - Maintain declarativeNetRequest rules for site/timed groups (custom
 *     groups do NOT contribute to network-level blocking — they run
 *     per-page in the content script).
 *   - Build the page session payload that the content script consumes.
 *   - Sanitise and store the custom timer / persistence updates that the
 *     content script flushes back after running rules.
 *
 * Evaluation order: groups are iterated in REVERSE storage order
 * (bottom-to-top), so the group at the top of the editor list has the
 * "last word".
 */

// On Chromium the background context is a classic service worker, so we
// pull in helpers.js with importScripts(). On Firefox/Safari the background
// is a DOM-bearing page (it has to be — it hosts the sandbox iframe in the
// absence of chrome.offscreen), where importScripts() does not exist; there
// the packaging step lists helpers.js ahead of background.js in
// manifest.background.scripts, so it is already loaded by this point.
if (typeof importScripts === "function") {
  try {
    importScripts("helpers.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(helpers.js) failed", error);
  }
}

const helperBundle = self.__customBlockerHelpers;

// Debug mode flag. False by default; user toggles it via Settings.
// Drives whether [CustomBlocker] / [CustomBlocker:trace] verbose
// console.log lines are emitted. The user's own helpers.log() calls
// flow through ingestSandboxLogs regardless of this flag.
const CB_GLOBAL_SETTINGS_KEY = "globalSettings";
let cbDebugMode = false;
function cbDebugLog(...args) { if (cbDebugMode) { try { console.log(...args); } catch (_) {} } }
function cbDebugWarn(...args) { if (cbDebugMode) { try { console.warn(...args); } catch (_) {} } }
function cbDebugError(...args) { if (cbDebugMode) { try { console.error(...args); } catch (_) {} } }
(async () => {
  try {
    const r = await chrome.storage.local.get(CB_GLOBAL_SETTINGS_KEY);
    const s = r && r[CB_GLOBAL_SETTINGS_KEY];
    if (s && typeof s === "object") cbDebugMode = s.debugMode === true;
  } catch (_) {}
})();
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[CB_GLOBAL_SETTINGS_KEY]) return;
    const next = changes[CB_GLOBAL_SETTINGS_KEY].newValue;
    cbDebugMode = next && typeof next === "object" ? next.debugMode === true : false;
  });
}

const BLOCKED_GROUPS_KEY = "blockedGroups";
const USAGE_TIMERS_KEY = "usageTimersMs";
const USAGE_RESET_AT_KEY = "usageResetAtMs";
const GROUP_SNOOZES_KEY = "groupSnoozes";
const GROUP_SNOOZE_TOTALS_KEY = "groupSnoozeTotalsMs";

const DEFAULT_ALLOWED_MINUTES = 15;
const DEFAULT_RESET_INTERVAL_HOURS = 24;
const DEFAULT_STRICT_FREEZE_HOURS = 24;
const DEFAULT_SNOOZE_MINUTES = 30;
const DEFAULT_SNOOZE_CONFIRMATIONS = 0;
const DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES = 0;
const DEFAULT_SNOOZE_COOLDOWN_MINUTES = 0;
const DEFAULT_GROUP_TYPE = "site";
const MAX_SNOOZE_COOLDOWN_MINUTES = 5;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MAX_HEARTBEAT_MS = 5000;
const TRANSITION_ALARM_NAME = "custom-blocker-transition";

const DAY_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

let usageTimerUpdateQueue = Promise.resolve();

function queueUsageTimerUpdate(task) {
  const run = usageTimerUpdateQueue.then(() => task());
  usageTimerUpdateQueue = run.catch(() => {});
  return run;
}

function waitForUsageTimerUpdates() {
  return usageTimerUpdateQueue;
}

// ────────────────────────────────────────────────────────────────────────
// Group + value normalisation. These run when storage is read so the rest
// of the worker can assume well-formed data.
// ────────────────────────────────────────────────────────────────────────

function createGroupId() {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultDays() {
  return [...DAY_NAMES];
}

function createDefaultGroup(groupType = DEFAULT_GROUP_TYPE) {
  const normalizedGroupType = normalizeGroupType(groupType);
  return {
    id: createGroupId(),
    groupType: normalizedGroupType,
    name:
      normalizedGroupType === "youtube"
        ? "YouTube Block"
        : normalizedGroupType === "tiktok"
          ? "TikTok Block"
        : normalizedGroupType === "facebook"
          ? "Facebook Block"
        : normalizedGroupType === "instagram"
          ? "Instagram Block"
        : normalizedGroupType === "twitch"
          ? "Twitch Block"
        : normalizedGroupType === "reddit"
          ? "Reddit Block"
        : normalizedGroupType === "discord"
          ? "Discord Block"
        : normalizedGroupType === "custom"
          ? "Custom Block"
          : "Block Group",
    enabled: true,
    mode: "instant",
    allowedMinutes: DEFAULT_ALLOWED_MINUTES,
    resetIntervalHours: DEFAULT_RESET_INTERVAL_HOURS,
    allowSnooze: true,
    snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    snoozeActivationDelayMinutes: DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
    snoozeCooldownMinutes: DEFAULT_SNOOZE_COOLDOWN_MINUTES,
    snoozeConfirmations: DEFAULT_SNOOZE_CONFIRMATIONS,
    activeDays: createDefaultDays(),
    timeWindowsText: "",
    platformVideoMode: "all",
    platformAuthorMode: "none",
    platformAuthors: [],
    redditMode: "all",
    redditSubreddits: [],
    discordMode: "all",
    discordTargets: [],
    blockingRulesText:
      "(month, dayOfMonth, dayName, hour, minute, url, helpers) => false",
    freezeMode: "none",
    strictFreezeHours: DEFAULT_STRICT_FREEZE_HOURS,
    frozenAtMs: null,
    sites: [],
    blockHomePage: false,
    fallbackUrl: "",
    skipToNextOnBlock: false
  };
}

function normalizeSiteInput(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  const maybeUrl = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    const parsedUrl = new URL(maybeUrl);
    let hostname = parsedUrl.hostname.trim().toLowerCase();
    if (!hostname) return null;
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);
    return hostname;
  } catch {
    return null;
  }
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

function normalizePlatformAuthorMode(value) {
  return value === "include" || value === "exclude" ? value : "none";
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

// Discord targets are a flat list of numeric IDs that may be EITHER
// server IDs OR channel IDs in the same list. Snowflake IDs are unique
// across types, so we match a page if its server-id OR channel-id appears
// anywhere in the list. The legacy `discordTargetType` field on saved
// groups is intentionally ignored — older data continues to work because
// the same IDs are still in `discordTargets`.

function isPlatformVideoGroupType(groupType) {
  const normalized = normalizeGroupType(groupType);
  return (
    normalized === "youtube" ||
    normalized === "tiktok" ||
    normalized === "facebook" ||
    normalized === "instagram" ||
    normalized === "twitch"
  );
}

function normalizePlatformAuthorInput(value, groupType) {
  const normalizedGroupType = normalizeGroupType(groupType);

  if (normalizedGroupType === "youtube") {
    return normalizeYouTubeCreatorInput(value);
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

function normalizeVideoMode(value) {
  return value === "short" || value === "long" || value === "post" ? value : "all";
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

// Accept either a bare snowflake (server ID or channel ID — both are
// numeric and globally unique) or a discord URL of the form
// /channels/<server>/<channel>. For URLs that include a channel segment
// we keep the more specific channel ID; URLs with only a server segment
// keep the server ID. The output is a single numeric string and the
// caller does NOT need to know whether it is a server or a channel —
// matching simply checks the page's server-id and channel-id against the
// flat list of saved targets.
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
    // Prefer the channel ID when the URL has one; fall back to the
    // server ID. Both are valid targets — the caller's match logic
    // handles either kind.
    trimmed = channelsMatch[2] || channelsMatch[1] || "";
  }
  if (trimmed === "@me") return null;
  return /^[0-9]{6,24}$/.test(trimmed) ? trimmed : null;
}

function normalizeGroupType(value) {
  return value === "youtube" ||
    value === "tiktok" ||
    value === "facebook" ||
    value === "instagram" ||
    value === "twitch" ||
    value === "reddit" ||
    value === "discord" ||
    value === "custom"
    ? value
    : "site";
}

function normalizeBlockingMode(value) {
  if (value === "after-minutes" || value === "timer") return value;
  return "instant";
}

function isTimedBlockingMode(mode) {
  return mode === "after-minutes" || mode === "timer";
}

function isBlockingTimedMode(mode) {
  return mode === "after-minutes" || mode === "timer";
}

function formatDayName(dayName) {
  return String(dayName).slice(0, 1).toUpperCase() + String(dayName).slice(1);
}

function parseAllowedMinutes(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseResetIntervalHours(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseStrictFreezeHours(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 72 ? parsed : null;
}

function parseSnoozeMinutes(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSnoozeDelayMinutes(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseSnoozeCooldownMinutes(value) {
  const parsed = parseSnoozeDelayMinutes(value);
  return parsed !== null && parsed <= MAX_SNOOZE_COOLDOWN_MINUTES ? parsed : null;
}

function parseSnoozeConfirmations(value) {
  const trimmed = String(value ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeTimeWindowLine(line) {
  const match = String(line ?? "").trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const [, start, end] = match;
  const startHours = Number.parseInt(start.slice(0, 2), 10);
  const startMinutes = Number.parseInt(start.slice(2), 10);
  const endHours = Number.parseInt(end.slice(0, 2), 10);
  const endMinutes = Number.parseInt(end.slice(2), 10);
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;
  if (
    startHours > 23 ||
    endHours > 23 ||
    startMinutes > 59 ||
    endMinutes > 59 ||
    startTotal >= endTotal
  ) {
    return null;
  }
  return `${start}-${end}`;
}

function parseTimeWindowsText(value) {
  const lines = [];
  for (const raw of String(value ?? "").split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const normalized = normalizeTimeWindowLine(trimmed);
    if (normalized) lines.push(normalized);
  }
  return [...new Set(lines)];
}

function sanitizeGroups(groups) {
  if (!Array.isArray(groups)) return [];

  return groups
    .map((group, index) => {
      const baseGroup = createDefaultGroup(normalizeGroupType(group?.groupType));
      const hasStoredDays = Array.isArray(group?.activeDays);
      const rawDays = hasStoredDays ? group.activeDays : createDefaultDays();
      const activeDays = rawDays
        .map((day) => String(day).trim().toLowerCase())
        .filter((day, dayIndex, array) => DAY_NAMES.includes(day) && array.indexOf(day) === dayIndex);
      const rawTimeWindowsText =
        typeof group?.timeWindowsText === "string"
          ? group.timeWindowsText
          : Array.isArray(group?.timeWindows)
            ? group.timeWindows.join("\n")
            : "";
      const rawAuthors = Array.isArray(group?.platformAuthors) ? group.platformAuthors : [];
      const rawRedditSubreddits = Array.isArray(group?.redditSubreddits)
        ? group.redditSubreddits
        : [];
      const rawDiscordTargets = Array.isArray(group?.discordTargets) ? group.discordTargets : [];

      const normalizedGroupType = normalizeGroupType(group?.groupType);

      return {
        ...baseGroup,
        id: typeof group?.id === "string" && group.id ? group.id : baseGroup.id,
        name:
          typeof group?.name === "string" && group.name.trim()
            ? group.name.trim()
            : `${baseGroup.name} ${index + 1}`,
        enabled: Boolean(group?.enabled),
        groupType: normalizedGroupType,
        mode: normalizeBlockingMode(group?.mode),
        allowedMinutes: parseAllowedMinutes(group?.allowedMinutes) ?? DEFAULT_ALLOWED_MINUTES,
        resetIntervalHours:
          parseResetIntervalHours(group?.resetIntervalHours) ?? DEFAULT_RESET_INTERVAL_HOURS,
        allowSnooze: group?.allowSnooze !== false,
        snoozeMinutes: parseSnoozeMinutes(group?.snoozeMinutes) ?? DEFAULT_SNOOZE_MINUTES,
        snoozeActivationDelayMinutes:
          parseSnoozeDelayMinutes(group?.snoozeActivationDelayMinutes) ??
          DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
        snoozeCooldownMinutes:
          parseSnoozeCooldownMinutes(group?.snoozeCooldownMinutes) ??
          DEFAULT_SNOOZE_COOLDOWN_MINUTES,
        snoozeConfirmations:
          parseSnoozeConfirmations(group?.snoozeConfirmations) ?? DEFAULT_SNOOZE_CONFIRMATIONS,
        activeDays: hasStoredDays ? activeDays : createDefaultDays(),
        timeWindowsText: parseTimeWindowsText(rawTimeWindowsText).join("\n"),
        platformVideoMode: normalizeVideoMode(group?.platformVideoMode),
        platformAuthorMode: normalizePlatformAuthorMode(group?.platformAuthorMode),
        platformAuthors: [
          ...new Set(
            rawAuthors
              .map((author) => normalizePlatformAuthorInput(author, normalizedGroupType))
              .filter(Boolean)
          )
        ],
        redditSubreddits: [
          ...new Set(rawRedditSubreddits.map(normalizeRedditSubredditInput).filter(Boolean))
        ],
        redditMode: normalizeRedditMode(group?.redditMode, rawRedditSubreddits),
        discordTargets: [
          ...new Set(
            rawDiscordTargets
              .map((target) => normalizeDiscordTargetInput(target))
              .filter(Boolean)
          )
        ],
        discordMode: normalizeDiscordMode(group?.discordMode, rawDiscordTargets),
        blockingRulesText:
          typeof group?.blockingRulesText === "string" && group.blockingRulesText.trim()
            ? group.blockingRulesText.trim()
            : baseGroup.blockingRulesText,
        freezeMode:
          group?.freezeMode === "strict" || group?.freezeMode === "frozen"
            ? group.freezeMode
            : "none",
        strictFreezeHours:
          parseStrictFreezeHours(group?.strictFreezeHours) ?? DEFAULT_STRICT_FREEZE_HOURS,
        frozenAtMs:
          Number.isFinite(Number(group?.frozenAtMs)) && Number(group.frozenAtMs) > 0
            ? Number(group.frozenAtMs)
            : null,
        sites: Array.isArray(group?.sites)
          ? [...new Set(group.sites.map(normalizeSiteInput).filter(Boolean))]
          : [],
        blockHomePage: Boolean(group?.blockHomePage),
        fallbackUrl: typeof group?.fallbackUrl === "string" ? group.fallbackUrl.trim() : "",
        skipToNextOnBlock: Boolean(group?.skipToNextOnBlock),
        // Preserve custom-rule fields verbatim so that any path which
        // eventually persists the sanitised group (e.g. getState() →
        // applyRuntimeNormalizations() when changed=true) does not silently
        // strip the user's saved source code, abort reason, or update
        // timestamp. The defaults are deliberately empty / null so non-custom
        // groups stay shape-compatible with the previous serialised form.
        activeEventSource:
          typeof group?.activeEventSource === "string" ? group.activeEventSource : "",
        lastAbortReason:
          typeof group?.lastAbortReason === "string" ? group.lastAbortReason : "",
        lastSourceUpdatedAt:
          Number.isFinite(Number(group?.lastSourceUpdatedAt)) &&
          Number(group.lastSourceUpdatedAt) > 0
            ? Number(group.lastSourceUpdatedAt)
            : null
      };
    })
    .filter((group) => group.name);
}

function sanitizeUsageTimers(value, groups) {
  const sanitized = {};
  for (const group of groups) {
    sanitized[group.id] = Math.max(0, Number.parseInt(value?.[group.id], 10) || 0);
  }
  return sanitized;
}

function sanitizeResetTimes(value, groups, now) {
  const sanitized = {};
  for (const group of groups) {
    const parsed = Number.parseInt(value?.[group.id], 10);
    sanitized[group.id] = Number.isFinite(parsed) && parsed > 0 ? parsed : now;
  }
  return sanitized;
}

function sanitizeSnoozes(value, groups, now) {
  const groupIds = new Set(groups.map((group) => group.id));
  const sanitized = {};
  for (const [groupId, snooze] of Object.entries(value ?? {})) {
    if (!groupIds.has(groupId)) continue;
    const startsAtMs = Number.parseInt(snooze?.startsAtMs, 10);
    const untilMs = Number.parseInt(snooze?.untilMs, 10);
    const cooldownUntilMs = Number.parseInt(snooze?.cooldownUntilMs, 10);
    const confirmationCount = parseSnoozeConfirmations(snooze?.confirmationCount);
    const activeMsApplied = Boolean(snooze?.activeMsApplied);
    const refreezeMode =
      snooze?.refreezeMode === "strict" || snooze?.refreezeMode === "frozen"
        ? snooze.refreezeMode
        : "frozen";
    if (
      Number.isFinite(startsAtMs) &&
      Number.isFinite(untilMs) &&
      Number.isFinite(cooldownUntilMs) &&
      startsAtMs <= untilMs &&
      untilMs <= cooldownUntilMs
    ) {
      sanitized[groupId] = {
        startsAtMs,
        untilMs,
        cooldownUntilMs,
        confirmationCount: confirmationCount ?? DEFAULT_SNOOZE_CONFIRMATIONS,
        activeMsApplied,
        refreezeMode
      };
    }
  }
  return sanitized;
}

function sanitizeSnoozeTotals(value, groups) {
  const sanitized = {};
  for (const group of groups) {
    sanitized[group.id] = Math.max(0, Number.parseInt(value?.[group.id], 10) || 0);
  }
  return sanitized;
}

// ────────────────────────────────────────────────────────────────────────
// Hostname helpers used by site/platform group evaluation.
// ────────────────────────────────────────────────────────────────────────

function hostnameMatchesSite(hostname, site) {
  return hostname === site || hostname.endsWith(`.${site}`);
}

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
    // /videos/<id> is the archived-VOD URL — the "streams/VODs" form.
    if (safePathname.startsWith("/videos/")) return { site: "twitch", form: "long" };
    // The streamer's channel page (twitch.tv/<streamer> and its sub-tabs
    // like /about, /schedule, /clips, /videos) is what the UI calls
    // "channel pages". The platform-video group model represents that
    // bucket as `form: "post"` (see `platform.post.twitch` translation
    // string: "channel pages"). Without this branch, a Twitch group
    // configured with `platformVideoMode === "post"` would never match
    // any URL.
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
      const parsed = url ? new URL(url) : null;
      const id = parsed?.searchParams?.get("id");
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
      : normalizePlatformAuthorInput(match[1], groupType);
  }

  return null;
}

function normalizePlatformAuthorsMap(inputMap, pathname, url) {
  const map = {};
  const groupTypes = ["youtube", "tiktok", "facebook", "instagram", "twitch"];
  for (const groupType of groupTypes) {
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

function normalizePageContext(input) {
  if (typeof input === "string") {
    const hostname = normalizeSiteInput(input);
    const videoContext = detectVideoSiteContext(hostname, "/");
    return {
      hostname,
      pathname: "/",
      url: "",
      isYouTubePage: isYouTubeHost(hostname),
      isYouTubeShort: false,
      platformAuthors: normalizePlatformAuthorsMap({}, "/", ""),
      isRedditPage: isRedditHost(hostname),
      redditSubreddit: null,
      isDiscordPage: isDiscordHost(hostname),
      discordServerId: null,
      discordChannelId: null,
      videoSite: videoContext.site,
      videoForm: videoContext.form
    };
  }

  const url = typeof input?.url === "string" ? input.url : "";
  let hostname = normalizeSiteInput(input?.hostname);
  let pathname = typeof input?.pathname === "string" ? input.pathname : "/";

  if (url) {
    try {
      const parsed = new URL(url);
      hostname = hostname ?? normalizeSiteInput(parsed.hostname);
      pathname = pathname || parsed.pathname;
    } catch {}
  }

  const normalizedHostname = hostname ?? null;
  const platformAuthors = normalizePlatformAuthorsMap(input?.platformAuthors, pathname, url);
  const videoContext = detectVideoSiteContext(normalizedHostname, pathname || "/");
  const redditSubreddit =
    normalizeRedditSubredditInput(input?.redditSubreddit) ??
    parseRedditSubredditFromPath(pathname);
  const discordServerId =
    normalizeDiscordTargetInput(input?.discordServerId) ??
    parseDiscordServerIdFromPath(pathname);
  const discordChannelId =
    normalizeDiscordTargetInput(input?.discordChannelId) ??
    parseDiscordChannelIdFromPath(pathname);

  return {
    hostname: normalizedHostname,
    pathname: pathname || "/",
    url,
    isYouTubePage: Boolean(input?.isYouTubePage) || isYouTubeHost(normalizedHostname),
    isYouTubeShort:
      Boolean(input?.isYouTubeShort) || Boolean(pathname && pathname.startsWith("/shorts/")),
    platformAuthors,
    isRedditPage: Boolean(input?.isRedditPage) || isRedditHost(normalizedHostname),
    redditSubreddit,
    isDiscordPage: Boolean(input?.isDiscordPage) || isDiscordHost(normalizedHostname),
    discordServerId,
    discordChannelId,
    videoSite: typeof input?.videoSite === "string" ? input.videoSite : videoContext.site,
    videoForm:
      input?.videoForm === "short" ||
      input?.videoForm === "long" ||
      input?.videoForm === "post"
        ? input.videoForm
        : videoContext.form
  };
}

function buildRules(hostnames) {
  return [...new Set(hostnames)].map((hostname, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `||${hostname}^`,
      resourceTypes: ["main_frame", "sub_frame"]
    }
  }));
}

function getAllowedMs(group) {
  return group.mode === "timer"
    ? getResetIntervalMs(group)
    : group.allowedMinutes * MS_PER_MINUTE;
}

function getResetIntervalMs(group) {
  return group.resetIntervalHours * MS_PER_HOUR;
}

function getSnoozePhase(snooze, now) {
  if (!snooze) return "none";
  if (Number.isFinite(snooze.startsAtMs) && now < snooze.startsAtMs) return "pending";
  if (Number.isFinite(snooze.untilMs) && now < snooze.untilMs) return "active";
  if (Number.isFinite(snooze.cooldownUntilMs) && now < snooze.cooldownUntilMs) return "cooldown";
  return "none";
}

function getActiveSnooze(groupId, groupSnoozes, now) {
  const snooze = groupSnoozes[groupId];
  return getSnoozePhase(snooze, now) === "active" ? snooze : null;
}

function getDayNameForDate(date) {
  const day = date.getDay();
  return DAY_NAMES[(day + 6) % 7];
}

function parseTimeWindowToMinutes(windowText) {
  const [start, end] = windowText.split("-");
  return {
    startMinutes:
      Number.parseInt(start.slice(0, 2), 10) * 60 + Number.parseInt(start.slice(2), 10),
    endMinutes:
      Number.parseInt(end.slice(0, 2), 10) * 60 + Number.parseInt(end.slice(2), 10)
  };
}

function isGroupActiveNow(group, now) {
  // Custom groups have no schedule UI — they're always "active" and rely on
  // their JavaScript function to decide what to do. Schedule-based logic
  // applies to every other group type.
  if (group.groupType === "custom") return true;

  const currentDate = new Date(now);
  const currentDayName = getDayNameForDate(currentDate);

  if (!group.activeDays.includes(currentDayName)) return false;

  const timeWindows = parseTimeWindowsText(group.timeWindowsText);
  if (timeWindows.length === 0) return true;

  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  return timeWindows.some((windowText) => {
    const { startMinutes, endMinutes } = parseTimeWindowToMinutes(windowText);
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });
}

function sanitizeBlockingDomains(domains) {
  return [...new Set((Array.isArray(domains) ? domains : []).map(normalizeSiteInput).filter(Boolean))];
}

// All "iterate over groups" helpers reverse the storage order so that the
// last group in the list is consulted first.
function reversed(list) {
  return [...list].reverse();
}

function matchesVideoMode(group, pageContext) {
  const videoMode = normalizeVideoMode(group.platformVideoMode);
  if (videoMode === "all") return true;
  return pageContext.videoForm === videoMode;
}

function isHomeFeedPage(groupType, hostname, pathname) {
  const p = String(pathname ?? "/");
  switch (groupType) {
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
    default:
      return false;
  }
}

function isPlatformHost(groupType, hostname) {
  if (!hostname) return false;
  switch (groupType) {
    case "youtube": return isYouTubeHost(hostname);
    case "tiktok": return hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");
    case "facebook": return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
    case "instagram": return hostname === "instagram.com" || hostname.endsWith(".instagram.com");
    case "twitch":
      return hostname === "twitch.tv" || hostname.endsWith(".twitch.tv") || hostname === "clips.twitch.tv";
    case "reddit": return isRedditHost(hostname);
    case "discord": return isDiscordHost(hostname);
    default: return false;
  }
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

  // A page is "listed" if its server-id OR its channel-id appears in the
  // flat targets list. This lets the user mix entries (e.g. blacklist a
  // whole server plus a single channel from a different server in the
  // same list, or whitelist a server plus an extra channel elsewhere).
  const serverId = pageContext.discordServerId;
  const channelId = pageContext.discordChannelId;
  if (!serverId && !channelId) return false;

  const isListed =
    (serverId && targets.includes(serverId)) ||
    (channelId && targets.includes(channelId));
  return mode === "include" ? Boolean(isListed) : !isListed;
}

function matchesSiteGroup(group, hostname) {
  return hostname && group.sites.some((site) => hostnameMatchesSite(hostname, site));
}

function getRelevantGroupsForPage(pageContext, groups, groupSnoozes, now) {
  return reversed(groups).filter((group) => {
    if (group.groupType === "custom") return false; // custom groups run in content
    if (!group.enabled || !isGroupActiveNow(group, now) || getActiveSnooze(group.id, groupSnoozes, now)) {
      return false;
    }
    if (isPlatformVideoGroupType(group.groupType)) return matchesPlatformVideoGroup(group, pageContext);
    if (group.groupType === "reddit") return matchesRedditGroup(group, pageContext);
    if (group.groupType === "discord") return matchesDiscordGroup(group, pageContext);
    return matchesSiteGroup(group, pageContext.hostname);
  });
}

function getRelevantSiteGroupsForHostname(hostname, groups, groupSnoozes, now) {
  return reversed(groups).filter(
    (group) =>
      group.groupType === "site" &&
      group.enabled &&
      isGroupActiveNow(group, now) &&
      !getActiveSnooze(group.id, groupSnoozes, now) &&
      matchesSiteGroup(group, hostname)
  );
}

// Merges custom timer snapshots from a sandbox dispatch result into
// the page session payload that content.js consumes. Adds items to
// session.items and forces showTimer=true if any custom timer is
// visible. Custom timers NEVER escalate shouldExitPage — the helper
// itself doesn't block. Blocking is the rule's responsibility, done
// via isExpired() + preventDefault() inside an event handler.
function mergeCustomTimerItems(payload, dispatchResult) {
  const extraItems = buildCustomTimerItems(dispatchResult);
  if (extraItems.length === 0) return payload;
  const existing = Array.isArray(payload?.items) ? payload.items : [];
  return {
    ...payload,
    items: existing.concat(extraItems),
    showTimer: true
  };
}

// Convert sandbox dispatch result's timerSnapshotsByGroup into the
// shape that content.js's updateOverlay expects. A backward (countdown)
// timer renders its remainingMs (clamped at 0 — it stops, doesn't
// block); a forward (count-up) timer renders the elapsed currentMs.
// blocksNow is always false: blocking lives in user-defined event
// handlers, not in the timer helper.
function buildCustomTimerItems(dispatchResult) {
  const out = [];
  if (!dispatchResult || !dispatchResult.timerSnapshotsByGroup) return out;
  for (const [groupId, snapshots] of Object.entries(dispatchResult.timerSnapshotsByGroup)) {
    if (!Array.isArray(snapshots)) continue;
    for (const snap of snapshots) {
      if (!snap || typeof snap !== "object") continue;
      const direction = snap.direction === "forward" ? "forward" : "backward";
      const currentMs = Math.max(0, Number(snap.currentMs) || 0);
      out.push({
        id: groupId + ":" + (snap.id || ""),
        name: snap.displayName || snap.id || "Timer",
        groupType: "custom",
        mode: "custom-timer",
        direction,
        currentMs,
        displayMs: currentMs,
        remainingMs: direction === "backward" ? currentMs : Number.POSITIVE_INFINITY,
        usedMs: direction === "forward" ? currentMs : 0,
        blocksNow: false
      });
    }
  }
  return out;
}

function collectPanelSnapshots(dispatchResult) {
  const panels = [];
  const groups = new Set();
  function addFrom(result) {
    if (!result || typeof result !== "object") return;
    if (Array.isArray(result.panelGroupsChanged)) {
      for (const groupId of result.panelGroupsChanged) {
        if (typeof groupId === "string" && groupId) groups.add(groupId);
      }
    }
    if (Array.isArray(result.panelGroupsWithPanels)) {
      for (const groupId of result.panelGroupsWithPanels) {
        if (typeof groupId === "string" && groupId) groups.add(groupId);
      }
    }
    const byGroup = result.panelSnapshotsByGroup;
    if (!byGroup || typeof byGroup !== "object") return;
    for (const [groupId, snapshots] of Object.entries(byGroup)) {
      if (typeof groupId === "string" && groupId) groups.add(groupId);
      if (!Array.isArray(snapshots)) continue;
      for (const snap of snapshots) {
        if (!snap || typeof snap !== "object") continue;
        panels.push({ ...snap, groupId });
      }
    }
  }
  addFrom(dispatchResult);
  if (Array.isArray(dispatchResult?.synthResults)) {
    for (const synth of dispatchResult.synthResults) addFrom(synth?.result);
  }
  return { panels, groups: Array.from(groups) };
}

function buildTimedItems(relevantGroups, usageTimersMs, usageResetAtMs, now) {
  return relevantGroups
    .filter((group) => isTimedBlockingMode(group.mode))
    .map((group) => {
      const usedMs = usageTimersMs[group.id] ?? 0;
      const isBlockingMode = isBlockingTimedMode(group.mode);
      const remainingMs = isBlockingMode ? Math.max(getAllowedMs(group) - usedMs, 0) : Number.POSITIVE_INFINITY;
      const displayMs = remainingMs;
      return {
        id: group.id,
        name: group.name,
        groupType: group.groupType,
        mode: group.mode,
        usedMs,
        allowedMinutes: group.allowedMinutes,
        resetIntervalHours: group.resetIntervalHours,
        nextResetAtMs: (usageResetAtMs[group.id] ?? now) + getResetIntervalMs(group),
        remainingMs,
        displayMs,
        blocksNow: isBlockingMode && usedMs >= getAllowedMs(group)
      };
    })
    .sort((left, right) => left.displayMs - right.displayMs || left.name.localeCompare(right.name));
}

async function loadStoredState() {
  const now = Date.now();
  const result = await chrome.storage.local.get({
    [BLOCKED_GROUPS_KEY]: [],
    [USAGE_TIMERS_KEY]: {},
    [USAGE_RESET_AT_KEY]: {},
    [GROUP_SNOOZES_KEY]: {},
    [GROUP_SNOOZE_TOTALS_KEY]: {}
  });

  const groups = sanitizeGroups(result[BLOCKED_GROUPS_KEY]);

  return {
    groups,
    usageTimersMs: sanitizeUsageTimers(result[USAGE_TIMERS_KEY], groups),
    usageResetAtMs: sanitizeResetTimes(result[USAGE_RESET_AT_KEY], groups, now),
    groupSnoozes: sanitizeSnoozes(result[GROUP_SNOOZES_KEY], groups, now),
    groupSnoozeTotalsMs: sanitizeSnoozeTotals(result[GROUP_SNOOZE_TOTALS_KEY], groups)
  };
}

function applyRuntimeNormalizations(
  groups,
  usageTimersMs,
  usageResetAtMs,
  groupSnoozes,
  groupSnoozeTotalsMs,
  now
) {
  const nextGroups = [...groups];
  const nextTimers = { ...usageTimersMs };
  const nextResetAt = { ...usageResetAtMs };
  const nextSnoozes = { ...groupSnoozes };
  const nextSnoozeTotals = { ...groupSnoozeTotalsMs };
  let changed = false;

  for (const group of groups) {
    if (!nextResetAt[group.id]) {
      nextResetAt[group.id] = now;
      changed = true;
    }
    if (!isTimedBlockingMode(group.mode)) continue;
    const intervalMs = getResetIntervalMs(group);
    if (!intervalMs) continue;
    const elapsedSinceReset = now - nextResetAt[group.id];
    if (elapsedSinceReset < intervalMs) continue;
    const elapsedIntervals = Math.floor(elapsedSinceReset / intervalMs);
    nextTimers[group.id] = 0;
    nextResetAt[group.id] += elapsedIntervals * intervalMs;
    changed = true;
  }

  for (const [groupId, snooze] of Object.entries(nextSnoozes)) {
    if (!snooze) {
      delete nextSnoozes[groupId];
      changed = true;
      continue;
    }

    if (!snooze.activeMsApplied && now >= snooze.untilMs) {
      nextSnoozeTotals[groupId] =
        Math.max(0, Number(nextSnoozeTotals[groupId]) || 0) +
        Math.max(0, snooze.untilMs - snooze.startsAtMs);
      nextSnoozes[groupId] = { ...snooze, activeMsApplied: true };
      const groupIndex = nextGroups.findIndex((group) => group.id === groupId);
      if (groupIndex >= 0 && nextGroups[groupIndex].freezeMode === "none") {
        nextGroups[groupIndex] = {
          ...nextGroups[groupIndex],
          freezeMode: snooze.refreezeMode === "strict" ? "strict" : "frozen",
          frozenAtMs: now
        };
      }
      changed = true;
      if (snooze.cooldownUntilMs <= now) {
        delete nextSnoozes[groupId];
      }
      continue;
    }

    if (snooze.cooldownUntilMs <= now) {
      delete nextSnoozes[groupId];
      changed = true;
    }
  }

  return {
    groups: nextGroups,
    usageTimersMs: nextTimers,
    usageResetAtMs: nextResetAt,
    groupSnoozes: nextSnoozes,
    groupSnoozeTotalsMs: nextSnoozeTotals,
    changed
  };
}

async function getState() {
  const baseState = await loadStoredState();
  const normalized = applyRuntimeNormalizations(
    baseState.groups,
    baseState.usageTimersMs,
    baseState.usageResetAtMs,
    baseState.groupSnoozes,
    baseState.groupSnoozeTotalsMs,
    Date.now()
  );

  if (normalized.changed) {
    await chrome.storage.local.set({
      [BLOCKED_GROUPS_KEY]: normalized.groups,
      [USAGE_TIMERS_KEY]: normalized.usageTimersMs,
      [USAGE_RESET_AT_KEY]: normalized.usageResetAtMs,
      [GROUP_SNOOZES_KEY]: normalized.groupSnoozes,
      [GROUP_SNOOZE_TOTALS_KEY]: normalized.groupSnoozeTotalsMs
    });
  }

  return {
    groups: normalized.groups,
    usageTimersMs: normalized.usageTimersMs,
    usageResetAtMs: normalized.usageResetAtMs,
    groupSnoozes: normalized.groupSnoozes,
    groupSnoozeTotalsMs: normalized.groupSnoozeTotalsMs,
    didApplyResets: normalized.changed
  };
}

function getBlockingHostnames(groups, usageTimersMs, groupSnoozes, now) {
  // Custom groups no longer contribute to network-level blocking. Only site
  // groups (instant or timed) get registered as declarativeNetRequest
  // rules.
  const hostnames = new Set(
    groups.filter((group) => group.groupType === "site").flatMap((group) => group.sites)
  );
  const blockedHostnames = [];

  for (const hostname of hostnames) {
    const relevantGroups = getRelevantSiteGroupsForHostname(hostname, groups, groupSnoozes, now);
    if (relevantGroups.some((group) => group.mode === "instant")) {
      blockedHostnames.push(hostname);
      continue;
    }
    if (
      relevantGroups.some(
        (group) =>
          isBlockingTimedMode(group.mode) && (usageTimersMs[group.id] ?? 0) >= getAllowedMs(group)
      )
    ) {
      blockedHostnames.push(hostname);
    }
  }

  return sanitizeBlockingDomains(blockedHostnames);
}

function buildPlatformFeedFilters(pageContext, groups, usageTimersMs, groupSnoozes, now) {
  const filters = [];
  const currentSite = pageContext.videoSite;
  const orderedGroups = reversed(groups);

  if (currentSite) {
    for (const group of orderedGroups) {
      if (
        !isPlatformVideoGroupType(group.groupType) ||
        group.groupType !== currentSite ||
        !group.enabled ||
        !isGroupActiveNow(group, now) ||
        getActiveSnooze(group.id, groupSnoozes, now)
      ) {
        continue;
      }
      if (
        group.mode !== "instant" &&
        (!isBlockingTimedMode(group.mode) || (usageTimersMs[group.id] ?? 0) < getAllowedMs(group))
      ) {
        continue;
      }
      filters.push({
        id: group.id,
        site: group.groupType,
        videoMode: normalizeVideoMode(group.platformVideoMode),
        authorMode: normalizePlatformAuthorMode(group.platformAuthorMode),
        authors: [...group.platformAuthors]
      });
    }
  }

  if (pageContext.isRedditPage) {
    for (const group of orderedGroups) {
      if (
        group.groupType !== "reddit" ||
        !group.enabled ||
        !isGroupActiveNow(group, now) ||
        getActiveSnooze(group.id, groupSnoozes, now)
      ) {
        continue;
      }
      if (
        group.mode !== "instant" &&
        (!isBlockingTimedMode(group.mode) || (usageTimersMs[group.id] ?? 0) < getAllowedMs(group))
      ) {
        continue;
      }
      const subreddits = Array.isArray(group.redditSubreddits) ? group.redditSubreddits : [];
      const redditMode = normalizeRedditMode(group.redditMode, subreddits);
      if (redditMode === "all") continue;
      if (redditMode === "include" && subreddits.length === 0) continue;
      filters.push({
        id: group.id,
        site: "reddit",
        redditMode,
        subreddits: [...subreddits]
      });
    }
  }

  return filters;
}

function buildPageSession(
  pageContext,
  groups,
  usageTimersMs,
  usageResetAtMs,
  groupSnoozes,
  now
) {
  const relevantGroups = getRelevantGroupsForPage(pageContext, groups, groupSnoozes, now);
  const timedItems = buildTimedItems(relevantGroups, usageTimersMs, usageResetAtMs, now);
  const feedFilters = buildPlatformFeedFilters(
    pageContext,
    groups,
    usageTimersMs,
    groupSnoozes,
    now
  );
  const currentBlockedHostnames = getBlockingHostnames(groups, usageTimersMs, groupSnoozes, now);
  const blockedByHostname = currentBlockedHostnames.some((hostname) =>
    pageContext.hostname && hostnameMatchesSite(pageContext.hostname, hostname)
  );
  const blockedNow =
    blockedByHostname ||
    relevantGroups.some((group) => group.mode === "instant") ||
    timedItems.some((item) => item.blocksNow);

  let fallbackUrl = "";
  let skipToNextOnBlock = false;
  if (blockedNow) {
    const blockingGroups = relevantGroups.filter((group) => {
      if (group.mode === "instant") return true;
      if (isBlockingTimedMode(group.mode)) {
        const usedMs = usageTimersMs[group.id] ?? 0;
        return usedMs >= getAllowedMs(group);
      }
      return false;
    });
    fallbackUrl = blockingGroups.find((g) => g.fallbackUrl?.trim())?.fallbackUrl?.trim() ?? "";
    skipToNextOnBlock = blockingGroups.some((g) => g.skipToNextOnBlock);
  }

  return {
    showTimer: !blockedNow && timedItems.length > 0,
    shouldExitPage: blockedNow,
    items: timedItems,
    feedFilters,
    fallbackUrl,
    skipToNextOnBlock,
    now
  };
}

async function scheduleNextTransitionAlarm(groups, usageResetAtMs, groupSnoozes, now) {
  const candidateTimes = [];

  for (const group of groups) {
    if (isTimedBlockingMode(group.mode)) {
      const nextResetAtMs = (usageResetAtMs[group.id] ?? now) + getResetIntervalMs(group);
      if (nextResetAtMs > now) candidateTimes.push(nextResetAtMs);
    }
  }

  for (const snooze of Object.values(groupSnoozes)) {
    if (snooze?.startsAtMs > now) candidateTimes.push(snooze.startsAtMs);
    if (snooze?.untilMs > now) candidateTimes.push(snooze.untilMs);
    if (snooze?.cooldownUntilMs > now) candidateTimes.push(snooze.cooldownUntilMs);
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    midnight.setDate(midnight.getDate() + offset);
    candidateTimes.push(midnight.getTime());
  }

  for (const group of groups) {
    const timeWindows = parseTimeWindowsText(group.timeWindowsText);
    if (group.activeDays.length === 0 || timeWindows.length === 0) continue;

    for (let offset = 0; offset <= 7; offset += 1) {
      const candidateDate = new Date(now);
      candidateDate.setHours(0, 0, 0, 0);
      candidateDate.setDate(candidateDate.getDate() + offset);
      if (!group.activeDays.includes(getDayNameForDate(candidateDate))) continue;

      for (const windowText of timeWindows) {
        const { startMinutes, endMinutes } = parseTimeWindowToMinutes(windowText);
        const startTime = new Date(candidateDate);
        startTime.setMinutes(startMinutes);
        const endTime = new Date(candidateDate);
        endTime.setMinutes(endMinutes);
        if (startTime.getTime() > now) candidateTimes.push(startTime.getTime());
        if (endTime.getTime() > now) candidateTimes.push(endTime.getTime());
      }
    }
  }

  await chrome.alarms.clear(TRANSITION_ALARM_NAME);
  if (candidateTimes.length === 0) return;
  await chrome.alarms.create(TRANSITION_ALARM_NAME, { when: Math.min(...candidateTimes) });
}

async function syncBlockingRules() {
  const now = Date.now();
  const [
    { groups, usageTimersMs, usageResetAtMs, groupSnoozes },
    existingRules
  ] = await Promise.all([getState(), chrome.declarativeNetRequest.getDynamicRules()]);

  const hostnames = getBlockingHostnames(groups, usageTimersMs, groupSnoozes, now);
  const newRules = buildRules(hostnames);
  const removeRuleIds = existingRules.map((rule) => rule.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: newRules
  });

  await scheduleNextTransitionAlarm(groups, usageResetAtMs, groupSnoozes, now);
}

async function applyElapsedTime(pageContextInput, elapsedMs) {
  const pageContext = normalizePageContext(pageContextInput);
  if (!pageContext.hostname) {
    return {
      showTimer: false,
      shouldExitPage: false,
      items: [],
      feedFilters: [],
      fallbackUrl: "",
      skipToNextOnBlock: false,
      now: Date.now()
    };
  }

  const boundedElapsedMs = Math.max(
    0,
    Math.min(MAX_HEARTBEAT_MS, Math.round(Number(elapsedMs) || 0))
  );
  const now = Date.now();
  const {
    groups,
    usageTimersMs,
    usageResetAtMs,
    groupSnoozes,
    didApplyResets
  } = await getState();

  if (didApplyResets) await syncBlockingRules();

  const relevantGroups = getRelevantGroupsForPage(pageContext, groups, groupSnoozes, now);
  const relevantTimedGroups = relevantGroups.filter((group) => isTimedBlockingMode(group.mode));

  if (
    relevantTimedGroups.length === 0 ||
    relevantGroups.some((group) => group.mode === "instant")
  ) {
    return buildPageSession(
      pageContext,
      groups,
      usageTimersMs,
      usageResetAtMs,
      groupSnoozes,
      now
    );
  }

  const nextTimers = { ...usageTimersMs };
  let changed = false;
  let reachedLimit = false;

  for (const group of relevantTimedGroups) {
    const currentValue = nextTimers[group.id] ?? 0;
    const thresholdMs = getAllowedMs(group);
    const nextValue =
      isBlockingTimedMode(group.mode)
        ? Math.min(currentValue + boundedElapsedMs, thresholdMs)
        : Math.max(0, currentValue + boundedElapsedMs);
    if (nextValue !== currentValue) {
      nextTimers[group.id] = nextValue;
      changed = true;
    }
    if (isBlockingTimedMode(group.mode) && nextValue >= thresholdMs) reachedLimit = true;
  }

  if (changed) {
    await chrome.storage.local.set({ [USAGE_TIMERS_KEY]: nextTimers });
  }
  if (reachedLimit) {
    await syncBlockingRules();
  }

  return buildPageSession(
    pageContext,
    groups,
    nextTimers,
    usageResetAtMs,
    groupSnoozes,
    now
  );
}

async function getPageSession(pageContextInput) {
  await waitForUsageTimerUpdates();

  const pageContext = normalizePageContext(pageContextInput);
  if (!pageContext.hostname) {
    return {
      showTimer: false,
      shouldExitPage: false,
      items: [],
      feedFilters: [],
      fallbackUrl: "",
      skipToNextOnBlock: false,
      now: Date.now()
    };
  }

  const now = Date.now();
  const {
    groups,
    usageTimersMs,
    usageResetAtMs,
    groupSnoozes,
    didApplyResets
  } = await getState();

  if (didApplyResets) await syncBlockingRules();

  return buildPageSession(
    pageContext,
    groups,
    usageTimersMs,
    usageResetAtMs,
    groupSnoozes,
    now
  );
}

// Activate an existing popup.html tab when present instead of stacking
// duplicates on every action click. Falls back to creating a new tab if
// none is open or the tab query fails (e.g. tabs API temporarily unhappy
// right after a service worker wake-up).
async function openExtensionPage() {
  const popupUrl = chrome.runtime.getURL("popup.html");
  try {
    const tabs = await chrome.tabs.query({ url: popupUrl + "*" });
    const existing = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
    if (existing && typeof existing.id === "number") {
      try {
        await chrome.tabs.update(existing.id, { active: true });
        if (typeof existing.windowId === "number") {
          await chrome.windows.update(existing.windowId, { focused: true });
        }
        return existing;
      } catch (_) {
        // Fall through to creating a new tab if focusing fails.
      }
    }
  } catch (_) {}
  return chrome.tabs.create({ url: popupUrl });
}

// Schema version is bumped whenever a release changes the shape of
// persisted records or needs to clean up data written by an earlier
// version. Each migration step is idempotent so re-running it (after a
// failed install, or after an unpacked → packed transition) is safe.
const CB_SCHEMA_VERSION_KEY = "schemaVersion";
const CB_CURRENT_SCHEMA_VERSION = 2;

// In a dev build of this extension the ID is derived from the install
// path. When a user transitions from unpacked → Web Store install (or
// just reinstalls under a new ID), any chrome-extension://<old-id>/...
// URL the user pasted into their custom rule source or
// blockingRulesText / fallbackUrl will 404 on the new ID. We rewrite the
// prefix to the live extension URL so previously-working redirects keep
// working. The exact byte sequence "chrome-extension://" is matched
// case-insensitively because Chrome lowercases the scheme on load.
function rewriteExtensionUrlsInString(text, livePrefix) {
  if (typeof text !== "string" || !text) return text;
  if (typeof livePrefix !== "string" || !livePrefix) return text;
  // Capture group is the ID; we only rewrite when the ID differs from
  // the current one, so this is a no-op when the user is already on the
  // correct ID (e.g. published build → republished build).
  return text.replace(
    /chrome-extension:\/\/([a-z]{32})\//gi,
    (match, id) => {
      const liveId = livePrefix.replace(/^chrome-extension:\/\/([^/]+)\/.*$/i, "$1");
      if (!liveId || id.toLowerCase() === liveId.toLowerCase()) return match;
      return livePrefix;
    }
  );
}

async function runChromeExtensionUrlSanitization() {
  let livePrefix = "";
  try {
    livePrefix = chrome.runtime.getURL("");
  } catch (_) {
    return { changed: false, groupsTouched: 0 };
  }
  if (!livePrefix) return { changed: false, groupsTouched: 0 };

  const stored = await chrome.storage.local.get(BLOCKED_GROUPS_KEY);
  const groups = Array.isArray(stored[BLOCKED_GROUPS_KEY]) ? stored[BLOCKED_GROUPS_KEY] : [];
  if (groups.length === 0) return { changed: false, groupsTouched: 0 };

  let touched = 0;
  const next = groups.map((group) => {
    if (!group || typeof group !== "object") return group;
    const before = {
      activeEventSource: group.activeEventSource,
      blockingRulesText: group.blockingRulesText,
      fallbackUrl: group.fallbackUrl
    };
    const after = {
      activeEventSource: rewriteExtensionUrlsInString(before.activeEventSource, livePrefix),
      blockingRulesText: rewriteExtensionUrlsInString(before.blockingRulesText, livePrefix),
      fallbackUrl: rewriteExtensionUrlsInString(before.fallbackUrl, livePrefix)
    };
    const groupChanged =
      after.activeEventSource !== before.activeEventSource ||
      after.blockingRulesText !== before.blockingRulesText ||
      after.fallbackUrl !== before.fallbackUrl;
    if (!groupChanged) return group;
    touched += 1;
    return { ...group, ...after };
  });

  if (touched === 0) return { changed: false, groupsTouched: 0 };
  await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
  return { changed: true, groupsTouched: touched };
}

async function runInstallMigrations(details) {
  const reason = details && typeof details.reason === "string" ? details.reason : "";
  try {
    const stored = await chrome.storage.local.get(CB_SCHEMA_VERSION_KEY);
    const previousSchema = Number(stored[CB_SCHEMA_VERSION_KEY]) || 0;

    // 1) Sanitise stored chrome-extension://<old-id>/ URLs. Safe to run on
    //    every install/update reason because rewriteExtensionUrlsInString
    //    only touches URLs whose embedded ID differs from the live one.
    if (reason === "install" || reason === "update") {
      const r = await runChromeExtensionUrlSanitization();
      if (r.changed) {
        console.log(
          "[CustomBlocker] migration: rewrote chrome-extension:// URLs in",
          r.groupsTouched,
          "group(s)"
        );
      }
    }

    // 2) Future migrations key off previousSchema and bump the version
    //    only when their write step succeeds. Placeholder for now: just
    //    record the current schema so later migrations have a baseline.
    if (previousSchema !== CB_CURRENT_SCHEMA_VERSION) {
      await chrome.storage.local.set({
        [CB_SCHEMA_VERSION_KEY]: CB_CURRENT_SCHEMA_VERSION
      });
    }
  } catch (error) {
    console.warn("[CustomBlocker] install migration failed", error);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  // Migrations run before syncBlockingRules so the DNR rebuild sees the
  // post-migration state on the very first sync. Awaited via the Promise
  // chain — both calls are independent of each other beyond ordering.
  runInstallMigrations(details)
    .then(() => syncBlockingRules())
    .catch((error) => {
      console.error("Failed to sync blocking rules on install.", error);
    });
});

chrome.runtime.onStartup.addListener(() => {
  syncBlockingRules().catch((error) => {
    console.error("Failed to sync blocking rules on startup.", error);
  });
});

chrome.action.onClicked.addListener(() => {
  openExtensionPage().catch((error) => {
    console.error("Failed to open extension page.", error);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TRANSITION_ALARM_NAME) return;
  syncBlockingRules().catch((error) => {
    console.error("Failed to sync blocking rules after alarm.", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "refresh-blocking-rules") {
    syncBlockingRules()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("Failed to refresh blocking rules.", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message?.type === "get-page-session") {
    const tabId = sender?.tab?.id ?? null;
    const tabUrl = sender?.tab?.url || sender?.url || "";
    getPageSession(message.pageContext ?? message.hostname)
      .then(async (payload) => {
        // Dispatch a zero-elapsed heartbeat so the initial session
        // response includes any custom timer items whose domain
        // matches this URL. elapsedMs = 0 means no tick happens; it's
        // purely a refresh of the displayed-set so the overlay paints
        // immediately on page load instead of after the first 250ms
        // heartbeat.
        let merged = payload;
        try {
          if (typeof tabId === "number") {
            const result = await dispatchEventToTab(
              "pageHeartbeatEvent",
              { tabId, url: tabUrl },
              { data: { intervalMs: 0 }, elapsedMs: 0 }
            );
            merged = mergeCustomTimerItems(payload, result);
          }
        } catch (_) {}
        sendResponse(merged);
      })
      .catch((error) => {
        console.error("Failed to build page session.", error);
        sendResponse({
          showTimer: false,
          shouldExitPage: false,
          items: [],
          feedFilters: [],
          fallbackUrl: "",
          skipToNextOnBlock: false,
          now: Date.now()
        });
      });
    return true;
  }

  if (message?.type === "get-custom-panels") {
    (async () => {
      await ensureStartupGate();
      const tabId = sender?.tab?.id ?? null;
      const tabUrl = normalizeUrlForEvents(message.url || sender?.tab?.url || sender?.url || "");
      const descriptor = {
        type: "panelRefreshEvent",
        tabId,
        pageId: null,
        url: tabUrl,
        hostname: hostnameOf(tabUrl),
        time: todayContext(),
        data: null,
        targetGroupId: null,
        elapsedMs: 0
      };
      const result = await dispatchToSandbox(descriptor);
      ingestSandboxLogs(result, descriptor);
      maybeQuarantineFromResult(result, descriptor);
      const panelPayload = collectPanelSnapshots(result);
      sendResponse({
        ok: true,
        descriptor,
        panelSnapshots: panelPayload.panels,
        panelGroups: panelPayload.groups,
        logs: Array.isArray(result?.logs) ? result.logs : []
      });
    })().catch((error) => {
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    });
    return true;
  }

  if (message?.type === "track-page-time") {
    const tabId = sender?.tab?.id ?? null;
    const tabUrl = sender?.tab?.url || sender?.url || "";
    const heartbeatElapsedMs = Math.max(0, Number(message.elapsedMs) || 0);
    queueUsageTimerUpdate(() =>
      applyElapsedTime(message.pageContext ?? message.hostname, heartbeatElapsedMs)
    )
      .then(async (payload) => {
        // Drive custom-rule timers from the same visibility-aware
        // heartbeat that powers the default block group countdown.
        // pageHeartbeatEvent fires once per content-script tick (~250ms
        // when visible). The sandbox reply includes timer snapshots
        // for the current URL which we merge into session.items so
        // the on-page overlay renders both default and custom timers
        // identically.
        let merged = payload;
        try {
          if (typeof tabId === "number") {
            const result = await dispatchEventToTab(
              "pageHeartbeatEvent",
              { tabId, url: tabUrl },
              { data: { intervalMs: heartbeatElapsedMs }, elapsedMs: heartbeatElapsedMs }
            );
            merged = mergeCustomTimerItems(payload, result);
          }
        } catch (error) {
          // Swallow: payload from default block group is still valid
          // even if the sandbox dispatch fails. The error already
          // surfaced via the offscreen hard-timeout / quarantine path.
          try { console.warn("[CustomBlocker] heartbeat dispatch failed", error); } catch (_) {}
        }
        sendResponse(merged);
      })
      .catch((error) => {
        console.error("Failed to track page time.", error);
        sendResponse({
          showTimer: false,
          shouldExitPage: false,
          items: [],
          feedFilters: [],
          fallbackUrl: "",
          skipToNextOnBlock: false,
          now: Date.now()
        });
      });
    return true;
  }

  return undefined;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || (!changes[BLOCKED_GROUPS_KEY] && !changes[GROUP_SNOOZES_KEY])) {
    return;
  }
  syncBlockingRules().catch((error) => {
    console.error("Failed to sync blocking rules after storage update.", error);
  });
  if (changes[BLOCKED_GROUPS_KEY]) {
    reconcileCustomGroupHandlers(changes[BLOCKED_GROUPS_KEY]).catch((error) => {
      console.error("Failed to reconcile custom-group handlers.", error);
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// Event-driven custom-rule dispatcher.
// Background owns the offscreen lifecycle, watches tab + webNavigation
// events to dispatch open/close/switch/switchDomain, runs the tick alarm,
// forwards Run/Disable/Enable from the popup, and applies any DOM /
// navigation intents the sandbox returns by routing them to the content
// scripts of the originating tab.
// ────────────────────────────────────────────────────────────────────────

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

// ────────────────────────────────────────────────────────────────────────
// Sandbox transport. The custom-rule event engine has to run somewhere with
// a DOM + relaxed CSP (so `new Function` works). Where that "somewhere" is
// depends on the browser, and is the ONLY thing that differs between our
// per-browser packages:
//
//   "offscreen" — Chromium (Chrome/Edge/Brave/Opera/…): a chrome.offscreen
//                 document hosts event-sandbox.html. (default)
//   "inpage"    — Firefox: no chrome.offscreen, but the background is a real
//                 page, so we host offscreen.html as a hidden in-page iframe.
//   "native"    — Safari: the extension is a thin client; custom-rule logic
//                 is redirected to the macosBlocker app over native
//                 messaging (browser.runtime.sendNativeMessage). Default and
//                 platform groups still run entirely in the extension.
//
// package.py writes sandbox-transport.js for the firefox/safari targets to
// pin this; otherwise we auto-detect (offscreen when available, else inpage).
const SANDBOX_TRANSPORT_OVERRIDE =
  (typeof self !== "undefined" && typeof self.CB_SANDBOX_TRANSPORT === "string")
    ? self.CB_SANDBOX_TRANSPORT
    : "auto";
// Native-messaging application id for the Safari host. Safari ignores the
// value (it routes to the containing app's SafariWebExtensionHandler), but
// other engines require one, so we keep it explicit and overridable.
const NATIVE_HOST_APPLICATION_ID =
  (typeof self !== "undefined" && typeof self.CB_NATIVE_HOST_ID === "string")
    ? self.CB_NATIVE_HOST_ID
    : "com.customblocker.macosBlocker";

function sandboxTransportMode() {
  if (SANDBOX_TRANSPORT_OVERRIDE === "native") return "native";
  if (SANDBOX_TRANSPORT_OVERRIDE === "inpage") return "inpage";
  if (SANDBOX_TRANSPORT_OVERRIDE === "offscreen") return "offscreen";
  if (chrome.offscreen && typeof chrome.offscreen.createDocument === "function") {
    return "offscreen";
  }
  if (typeof document !== "undefined") return "inpage";
  return "offscreen";
}

const TICK_ALARM_NAME = "custom-blocker-event-tick";
// Chrome alarms floor at 1 minute. The 1 s tickEvent is driven from the
// offscreen document; this alarm is a SW keepalive / safety net.
const TICK_ALARM_PERIOD_MINUTES = 1;

const previousTabUrls = new Map(); // tabId -> { url, hostname }
const pendingApplyByTab = new Map(); // tabId -> Array<applyMessage>
const PENDING_APPLY_MAX_PER_TAB = 32;

// chrome.storage.session is a TRUSTED_CONTEXTS-only key/value store that
// survives MV3 service-worker idle restarts but is cleared when the
// browser process exits. Mirroring previousTabUrls + pendingApplyByTab
// there lets us recover from a SW restart without dropping the
// "previous URL" memory used by switchDomainEvent / switchWebEvent /
// isReload, and without losing apply messages that were queued for tabs
// whose content script hadn't checked in yet.
const SESSION_TAB_URLS_KEY = "__cb_previous_tab_urls__";
const SESSION_PENDING_APPLY_KEY = "__cb_pending_apply_by_tab__";
const SESSION_FLUSH_DEBOUNCE_MS = 50;

let sessionFlushHandle = null;
function scheduleSessionFlush() {
  if (!chrome?.storage?.session?.set) return;
  if (sessionFlushHandle !== null) return;
  sessionFlushHandle = setTimeout(() => {
    sessionFlushHandle = null;
    flushTabStateToSession();
  }, SESSION_FLUSH_DEBOUNCE_MS);
}

async function flushTabStateToSession() {
  if (!chrome?.storage?.session?.set) return;
  try {
    const tabsObj = {};
    for (const [tabId, value] of previousTabUrls.entries()) {
      tabsObj[String(tabId)] = value;
    }
    const pendingObj = {};
    for (const [tabId, list] of pendingApplyByTab.entries()) {
      if (Array.isArray(list) && list.length > 0) {
        pendingObj[String(tabId)] = list;
      }
    }
    await chrome.storage.session.set({
      [SESSION_TAB_URLS_KEY]: tabsObj,
      [SESSION_PENDING_APPLY_KEY]: pendingObj
    });
  } catch (_) {}
}

async function hydrateTabStateFromSession() {
  if (!chrome?.storage?.session?.get) return;
  try {
    const r = await chrome.storage.session.get({
      [SESSION_TAB_URLS_KEY]: {},
      [SESSION_PENDING_APPLY_KEY]: {}
    });
    const tabsObj = r[SESSION_TAB_URLS_KEY];
    if (tabsObj && typeof tabsObj === "object") {
      for (const [tabId, value] of Object.entries(tabsObj)) {
        const idNum = Number(tabId);
        if (!Number.isInteger(idNum) || idNum < 0) continue;
        if (!value || typeof value !== "object") continue;
        previousTabUrls.set(idNum, {
          url: typeof value.url === "string" ? value.url : "",
          hostname: typeof value.hostname === "string" ? value.hostname : ""
        });
      }
    }
    const pendingObj = r[SESSION_PENDING_APPLY_KEY];
    if (pendingObj && typeof pendingObj === "object") {
      for (const [tabId, list] of Object.entries(pendingObj)) {
        const idNum = Number(tabId);
        if (!Number.isInteger(idNum) || idNum < 0) continue;
        if (!Array.isArray(list) || list.length === 0) continue;
        pendingApplyByTab.set(idNum, list.slice(0, PENDING_APPLY_MAX_PER_TAB));
      }
    }
  } catch (_) {}
}

// Ring buffer of recent log entries surfaced from the sandbox. The popup's
// Activity log panel reads this on open, then subscribes to live entries
// via the "log-feed-entry" broadcast below.
const LOG_FEED_MAX_ENTRIES = 200;
const logFeedBuffer = []; // each: { ts, level, groupId, message, eventType }
let logFeedSeq = 0;

// Rate-limit defense in depth: even with sandbox-side caps, a misbehaving
// rule (or a swarm of legitimate ones) can still produce many log entries
// in a single dispatch. We cap per-second IPC fan-out so the popup
// renderer never gets pummeled.
const LOG_FEED_BURST_PER_SEC = 50;
const LOG_FEED_MAX_MESSAGE_BYTES = 4096;
let logFeedBurstWindowStart = 0;
let logFeedBurstCount = 0;
let logFeedSuppressed = 0;

function flushLogFeedSuppressionNote(now) {
  if (logFeedSuppressed <= 0) return;
  logFeedSuppressed = 0;
}

function pushLogFeedEntry(entry) {
  if (!entry || typeof entry !== "object") return;
  const now = Date.now();
  if (now - logFeedBurstWindowStart > 1000) {
    flushLogFeedSuppressionNote(now);
    logFeedBurstWindowStart = now;
    logFeedBurstCount = 0;
  }
  if (logFeedBurstCount >= LOG_FEED_BURST_PER_SEC) {
    logFeedSuppressed += 1;
    return;
  }
  let message = Array.isArray(entry.args)
    ? entry.args.map((a) => {
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch { return String(a); }
      }).join(" ")
    : String(entry.message ?? "");
  if (!message.trim()) return;
  // Cap a single log entry's payload so a `h.log("x".repeat(50_000_000))`
  // can't push a 50MB string through the IPC chain.
  if (message.length > LOG_FEED_MAX_MESSAGE_BYTES) {
    const dropped = message.length - LOG_FEED_MAX_MESSAGE_BYTES;
    message = message.slice(0, LOG_FEED_MAX_MESSAGE_BYTES) +
      "…[" + dropped + " more chars truncated]";
  }
  logFeedBurstCount += 1;
  const record = {
    id: ++logFeedSeq,
    ts: now,
    level: entry.level || "log",
    groupId: entry.groupId || "",
    eventType: entry.eventType || "",
    message
  };
  logFeedBuffer.push(record);
  if (logFeedBuffer.length > LOG_FEED_MAX_ENTRIES) {
    logFeedBuffer.splice(0, logFeedBuffer.length - LOG_FEED_MAX_ENTRIES);
  }
  // Best-effort broadcast. Popups that aren't open simply ignore it; the
  // catch silences "Receiving end does not exist" noise.
  try {
    chrome.runtime.sendMessage({ type: "log-feed-entry", entry: record }).catch(() => {});
  } catch (_) {}
}

function ingestSandboxLogs(result, descriptor) {
  if (!result) return;
  const eventType = descriptor && descriptor.type ? descriptor.type : "";
  const collect = (logs) => {
    if (!Array.isArray(logs)) return;
    for (const entry of logs) {
      if (!entry) continue;
      if (entry.popup === false) continue;
      pushLogFeedEntry({
        level: entry.level,
        groupId: entry.groupId,
        args: entry.args,
        eventType
      });
    }
  };
  collect(result.logs);
  if (Array.isArray(result.synthResults)) {
    for (const synth of result.synthResults) {
      if (synth && synth.result) collect(synth.result.logs);
    }
  }
}

// Quarantine: when the sandbox or offscreen flags a runaway group, we
// disable it in storage and push a one-line warning to the log feed.
// The user keeps their source code (it stays in `activeEventSource` and
// `blockingRulesText`); only `enabled` flips. Recovering is one click in
// the popup. The reconciler picks up the flag through normal storage
// onChanged flow and unloads the group.
async function quarantineGroup(groupId, reason) {
  if (!groupId) return false;
  try {
    const stored = await chrome.storage.local.get(BLOCKED_GROUPS_KEY);
    const groups = Array.isArray(stored[BLOCKED_GROUPS_KEY]) ? stored[BLOCKED_GROUPS_KEY] : [];
    const idx = groups.findIndex((g) => g && g.id === groupId);
    if (idx < 0) return false;
    if (groups[idx].enabled === false) return false; // already disabled
    groups[idx] = {
      ...groups[idx],
      enabled: false,
      lastAbortReason: String(reason || "unknown"),
      lastAbortAt: Date.now()
    };
    await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: groups });
    return true;
  } catch (error) {
    console.warn("[CustomBlocker] quarantineGroup failed", error);
    return false;
  }
}

function maybeQuarantineFromResult(result, descriptor) {
  if (!result || typeof result !== "object") return;
  const candidates = [];
  // Sandbox dispatch result may carry a quarantine hint in either the
  // top-level reply (deadline overrun for the active group) or in any
  // synthResult (deadline overrun in a posted re-dispatch). Offscreen's
  // synthetic timeout reply also surfaces { quarantine: { reason } }.
  if (result.quarantine) candidates.push({ q: result.quarantine, descriptor });
  if (Array.isArray(result.synthResults)) {
    for (const synth of result.synthResults) {
      if (synth && synth.result && synth.result.quarantine) {
        candidates.push({ q: synth.result.quarantine, descriptor: synth.descriptor || descriptor });
      }
    }
  }
  for (const { q, descriptor: d } of candidates) {
    const groupId = q.groupId || (d && d.targetGroupId) || "";
    if (!groupId) continue;
    quarantineGroup(groupId, q.reason || "deadline-overrun").catch(() => {});
  }
}

// Tracks the most recent reason ensureOffscreenDocument returned false
// so the console error does not repeat on every 1 s tick attempt.
let lastOffscreenFailureSignature = "";
let offscreenCreationPromise = null;
function reportOffscreenFailure(signature, message) {
  if (lastOffscreenFailureSignature === signature) return;
  lastOffscreenFailureSignature = signature;
  console.error("[CustomBlocker] offscreen unavailable:", message);
}
function clearOffscreenFailure() {
  if (lastOffscreenFailureSignature !== "") {
    lastOffscreenFailureSignature = "";
  }
}

// Firefox in-page host: id of the hidden iframe we inject into the
// background page to stand in for the (missing) offscreen document.
const INPAGE_SANDBOX_HOST_ID = "cb-inpage-sandbox-host";
let inPageHostReadyPromise = null;

// Hosts offscreen.html as a hidden iframe inside the background PAGE. This
// is the Firefox equivalent of chrome.offscreen.createDocument: offscreen.js
// runs unchanged inside that iframe (a separate extension context, so its
// chrome.runtime.sendMessage round-trips with this background page exactly
// as it does with a real offscreen document on Chromium).
function ensureInPageSandboxHost() {
  if (typeof document === "undefined") {
    reportOffscreenFailure("no-document", "in-page sandbox host needs a DOM");
    return Promise.resolve(false);
  }
  if (document.getElementById(INPAGE_SANDBOX_HOST_ID)) {
    clearOffscreenFailure();
    return Promise.resolve(true);
  }
  if (inPageHostReadyPromise) return inPageHostReadyPromise;
  inPageHostReadyPromise = new Promise((resolve) => {
    const mount = () => {
      try {
        if (document.getElementById(INPAGE_SANDBOX_HOST_ID)) {
          clearOffscreenFailure();
          resolve(true);
          return;
        }
        const frame = document.createElement("iframe");
        frame.id = INPAGE_SANDBOX_HOST_ID;
        frame.setAttribute("aria-hidden", "true");
        frame.style.cssText = "display:none;width:0;height:0;border:0;";
        frame.src = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
        (document.body || document.documentElement).appendChild(frame);
        clearOffscreenFailure();
        resolve(true);
      } catch (error) {
        reportOffscreenFailure(
          "inpage-mount-failed",
          String(error && error.message ? error.message : error)
        );
        resolve(false);
      }
    };
    if (document.body || document.readyState === "complete") {
      mount();
    } else {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
    }
  }).finally(() => {
    inPageHostReadyPromise = null;
  });
  return inPageHostReadyPromise;
}

async function ensureOffscreenDocument() {
  const mode = sandboxTransportMode();
  if (mode === "native") {
    // Safari client mode: the sandbox lives in the macosBlocker app; there
    // is no local host document to create.
    clearOffscreenFailure();
    return true;
  }
  if (mode === "inpage") {
    return await ensureInPageSandboxHost();
  }
  if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== "function") {
    reportOffscreenFailure(
      "api-missing",
      "chrome.offscreen API is not available in this build"
    );
    return false;
  }
  try {
    const has = chrome.offscreen.hasDocument
      ? await chrome.offscreen.hasDocument()
      : false;
    if (has) {
      clearOffscreenFailure();
      return true;
    }
  } catch {}
  if (offscreenCreationPromise) {
    return await offscreenCreationPromise;
  }
  offscreenCreationPromise = createOffscreenDocumentOnce();
  try {
    return await offscreenCreationPromise;
  } finally {
    offscreenCreationPromise = null;
  }
}

async function createOffscreenDocumentOnce() {
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["IFRAME_SCRIPTING"],
      justification: "Hosts the persistent custom-rule event sandbox."
    });
    clearOffscreenFailure();
    return true;
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("already") || lowerMessage.includes("single offscreen document")) {
      // Race with another caller; the document is up.
      clearOffscreenFailure();
      return true;
    }
    reportOffscreenFailure("create-failed:" + message.slice(0, 64), message);
    return false;
  }
}

// Safari client transport: forward an event-sandbox request to the
// macosBlocker app's SafariWebExtensionHandler, which runs the rule in
// JavaScriptCore and returns the same { ok, result } shape the in-browser
// sandbox produces. Any DOM/redirect intents in the reply are applied by
// the caller exactly as for the offscreen path.
async function sendToEventSandboxNative(payload) {
  try {
    const message = { type: "event-sandbox-request", payload };
    let response;
    if (chrome.runtime && typeof chrome.runtime.sendNativeMessage === "function") {
      // Safari accepts a single-arg form (routes to the container app); other
      // engines need an application id. Try the app-id form, fall back.
      try {
        response = await chrome.runtime.sendNativeMessage(NATIVE_HOST_APPLICATION_ID, message);
      } catch (_) {
        response = await chrome.runtime.sendNativeMessage(message);
      }
    }
    return response && response.ok ? response.result : null;
  } catch (error) {
    console.error("[CustomBlocker] native sandbox request failed", error);
    return null;
  }
}

async function sendToEventSandbox(payload) {
  if (sandboxTransportMode() === "native") {
    return await sendToEventSandboxNative(payload);
  }
  await ensureOffscreenDocument();
  try {
    const response = await chrome.runtime.sendMessage({
      type: "event-sandbox-request",
      payload
    });
    return response && response.ok ? response.result : null;
  } catch (error) {
    return null;
  }
}

async function loadCustomGroupSource(group) {
  if (!group || group.groupType !== "custom") return null;
  if (!group.enabled) {
    await sendToEventSandbox({
      kind: "unload-group",
      groupId: group.id,
      clearState: true
    });
    scheduleCustomTimerRefreshBroadcast();
    scheduleCustomPanelRefreshBroadcast(100, [group.id]);
    refreshHandlerCount();
    return { ok: true, handlers: 0, error: null };
  }
  const source = typeof group.activeEventSource === "string" ? group.activeEventSource : "";
  if (!source.trim()) {
    await sendToEventSandbox({
      kind: "unload-group",
      groupId: group.id,
      clearState: true
    });
    scheduleCustomTimerRefreshBroadcast();
    scheduleCustomPanelRefreshBroadcast(100, [group.id]);
    refreshHandlerCount();
    return { ok: true, handlers: 0, error: null };
  }
  const result = await sendToEventSandbox({
    kind: "load-source",
    groupId: group.id,
    source
  });
  // Forward only user-created registration-time helper logs. Engine
  // registration status is reported through the Run status UI.
  if (result && Array.isArray(result.logs)) {
    ingestSandboxLogs(result, { type: "load-source" });
  }
  if (result && result.ok === false && result.error) {
    try { console.error("[CustomBlocker:" + group.id + "]", result.error); } catch (_) {}
  }
  // If load-source itself was hard-killed by the offscreen timeout, the
  // synthetic reply carries quarantine={ reason } but no groupId — fill
  // in the group we were trying to load and disable it. The user's
  // source code is preserved; only `enabled` flips.
  if (result && result.quarantine) {
    const reason = result.quarantine.reason || "load-source-timeout";
    quarantineGroup(group.id, reason).catch(() => {});
  }
  scheduleCustomTimerRefreshBroadcast();
  scheduleCustomPanelRefreshBroadcast(100, [group.id]);
  refreshHandlerCount();
  return result;
}

async function unloadCustomGroupHandlers(groupId) {
  return await sendToEventSandbox({ kind: "unload-group", groupId });
}

let lastReconcileSnapshot = new Map();
const suppressReconcileLoadByGroup = new Set();

async function reconcileCustomGroupHandlers(change) {
  const newGroups = Array.isArray(change?.newValue) ? change.newValue : [];
  const previous = lastReconcileSnapshot;
  const next = new Map();
  for (const group of newGroups) {
    if (!group || group.groupType !== "custom") continue;
    next.set(group.id, {
      enabled: Boolean(group.enabled),
      activeEventSource: typeof group.activeEventSource === "string" ? group.activeEventSource : ""
    });
  }
  // Groups that disappeared
  for (const [groupId] of previous.entries()) {
    if (!next.has(groupId)) {
      await unloadCustomGroupHandlers(groupId);
    }
  }
  // Groups that toggled or changed source
  for (const [groupId, snapshot] of next.entries()) {
    const before = previous.get(groupId);
    if (suppressReconcileLoadByGroup.has(groupId)) {
      suppressReconcileLoadByGroup.delete(groupId);
      continue;
    }
    if (
      !before ||
      before.enabled !== snapshot.enabled ||
      before.activeEventSource !== snapshot.activeEventSource
    ) {
      const group = newGroups.find((g) => g.id === groupId);
      await loadCustomGroupSource(group);
    }
  }
  lastReconcileSnapshot = next;
}

async function loadAllCustomGroupsAtStartup() {
  // Recover per-tab URL history and queued apply messages from
  // chrome.storage.session BEFORE the first dispatch fans out. Every
  // dispatch already awaits ensureStartupGate(), so completing the
  // hydration inside this function is the cheapest way to guarantee
  // ordering without touching every event handler.
  try {
    await hydrateTabStateFromSession();
  } catch (_) {}
  try {
    const result = await chrome.storage.local.get(BLOCKED_GROUPS_KEY);
    const groups = Array.isArray(result[BLOCKED_GROUPS_KEY]) ? result[BLOCKED_GROUPS_KEY] : [];
    lastReconcileSnapshot = new Map();
    let attempted = 0;
    let withSource = 0;
    for (const group of groups) {
      if (!group || group.groupType !== "custom") continue;
      attempted += 1;
      const hasSource =
        typeof group.activeEventSource === "string" && group.activeEventSource.trim().length > 0;
      if (hasSource) withSource += 1;
      lastReconcileSnapshot.set(group.id, {
        enabled: Boolean(group.enabled),
        activeEventSource: typeof group.activeEventSource === "string" ? group.activeEventSource : ""
      });
      await loadCustomGroupSource(group);
    }
    cbDebugLog(
      "[CustomBlocker] startup load complete; custom groups:",
      attempted,
      "with source:",
      withSource,
      "handler count:",
      cachedHandlerCount
    );
  } catch (error) {
    console.warn("[CustomBlocker] startup load of custom groups failed", error);
  }
}

// Startup gate: every dispatch awaits this so a webNavigation event
// arriving immediately after a service-worker restart doesn't fan out
// against an empty handler registry.
let startupGate = null;
function ensureStartupGate() {
  if (!startupGate) {
    startupGate = loadAllCustomGroupsAtStartup();
  }
  return startupGate;
}

let cachedHandlerCount = 0;
async function refreshHandlerCount() {
  try {
    const r = await sendToEventSandbox({ kind: "list-handlers", groupId: null });
    if (r && Array.isArray(r.handlers)) {
      cachedHandlerCount = r.handlers.length;
    }
  } catch {}
  return cachedHandlerCount;
}

function todayContext(now = Date.now()) {
  const date = new Date(now);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return {
    now,
    month: date.getMonth() + 1,
    dayOfMonth: date.getDate(),
    dayName: dayNames[date.getDay()],
    hour: date.getHours(),
    minute: date.getMinutes()
  };
}

function normalizeUrlForEvents(url) {
  if (typeof url !== "string" || !url) return "";
  const lowered = url.toLowerCase();
  if (lowered === "about:blank" || lowered.startsWith("about:blank")) return "";
  if (lowered === "about:newtab") return "";
  if (lowered.startsWith("chrome://newtab")) return "";
  if (lowered.startsWith("chrome://new-tab-page")) return "";
  if (lowered.startsWith("chrome-search://")) return "";
  if (lowered.startsWith("chrome-native://newtab")) return "";
  if (lowered.startsWith("edge://newtab")) return "";
  if (lowered.startsWith("edge://new-tab-page")) return "";
  if (lowered.startsWith("brave://newtab")) return "";
  if (lowered.startsWith("brave://new-tab-page")) return "";
  if (lowered.startsWith("opera://startpage")) return "";
  if (lowered.startsWith("vivaldi://startpage")) return "";
  return url;
}

function hostnameOf(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function gatherTabsSnapshot() {
  try {
    const tabs = await chrome.tabs.query({});
    return tabs
      .filter((t) => t && typeof t.id === "number")
      .map((t) => ({
        id: t.id,
        url: normalizeUrlForEvents(t.url || ""),
        title: t.title || "",
        active: Boolean(t.active),
        windowId: t.windowId
      }));
  } catch {
    return [];
  }
}

async function dispatchToSandbox(descriptor) {
  return await sendToEventSandbox({
    kind: "dispatch-event",
    descriptor
  });
}

async function sendToLocalFileBroker(request) {
  if (sandboxTransportMode() === "native") {
    // The local-folder broker uses the File System Access API, which only
    // exists in the browser. In Safari client mode there is no offscreen
    // document to host it, so the feature is unavailable.
    return {
      ok: false,
      eventName: "error",
      action: request?.action || "",
      path: request?.path || "",
      directoryPath: request?.directoryPath || "",
      requestId: request?.requestId || "",
      error: "local-folder-not-available"
    };
  }
  await ensureOffscreenDocument();
  try {
    const response = await chrome.runtime.sendMessage({
      type: "local-file-request",
      request
    });
    if (response && response.ok) return response.result || null;
  } catch (error) {
    return {
      ok: false,
      eventName: "error",
      action: request?.action || "",
      path: request?.path || "",
      directoryPath: request?.directoryPath || "",
      requestId: request?.requestId || "",
      error: String(error?.message || error || "local-file-error")
    };
  }
  return {
    ok: false,
    eventName: "error",
    action: request?.action || "",
    path: request?.path || "",
    directoryPath: request?.directoryPath || "",
    requestId: request?.requestId || "",
    error: "local-file-broker-unavailable"
  };
}

function collectLocalFileIntentsFromResult(result) {
  const out = [];
  function add(resultPart) {
    const intents = Array.isArray(resultPart?.intents) ? resultPart.intents : [];
    for (const intent of intents) {
      if (!intent || intent.kind !== "localFile") continue;
      out.push(intent);
    }
  }
  add(result);
  if (Array.isArray(result?.synthResults)) {
    for (const synth of result.synthResults) add(synth?.result);
  }
  return out;
}

async function processLocalFileIntents(result, descriptor, depth = 0) {
  if (!result || depth > 3) return;
  const intents = collectLocalFileIntentsFromResult(result);
  for (const intent of intents) {
    const groupId = typeof intent.groupId === "string" ? intent.groupId : "";
    if (!groupId) continue;
    const brokerResult = await sendToLocalFileBroker(intent);
    const localFileDescriptor = {
      type: "localFileEvent",
      tabId: descriptor?.tabId ?? null,
      pageId: descriptor?.pageId ?? null,
      url: descriptor?.url || "",
      hostname: descriptor?.hostname || "",
      time: todayContext(),
      data: brokerResult || {
        ok: false,
        eventName: "error",
        action: intent.action || "",
        path: intent.path || "",
        requestId: intent.requestId || "",
        error: "local-file-error"
      },
      targetGroupId: groupId,
      elapsedMs: 0
    };
    const eventResult = await dispatchToSandbox(localFileDescriptor);
    ingestSandboxLogs(eventResult, localFileDescriptor);
    maybeQuarantineFromResult(eventResult, localFileDescriptor);
    await applySandboxResultToTab(localFileDescriptor.tabId, eventResult, localFileDescriptor);
    if (resultHasTimerRegistryChange(eventResult)) scheduleCustomTimerRefreshBroadcast();
    if (resultHasPanelRegistryChange(eventResult)) scheduleCustomPanelRefreshBroadcast();
    await processLocalFileIntents(eventResult, localFileDescriptor, depth + 1);
  }
}

function enqueueApply(tabId, message) {
  const list = pendingApplyByTab.get(tabId) || [];
  list.push(message);
  while (list.length > PENDING_APPLY_MAX_PER_TAB) list.shift();
  pendingApplyByTab.set(tabId, list);
  scheduleSessionFlush();
}

async function trySendApply(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

let customTimerRefreshTimeoutId = null;

function resultHasTimerRegistryChange(result) {
  if (!result) return false;
  if (result.timerRegistryChanged) return true;
  if (!Array.isArray(result.synthResults)) return false;
  return result.synthResults.some((synth) => Boolean(synth?.result?.timerRegistryChanged));
}

function resultHasPanelRegistryChange(result) {
  if (!result) return false;
  if (result.panelRegistryChanged) return true;
  if (!Array.isArray(result.synthResults)) return false;
  return result.synthResults.some((synth) => Boolean(synth?.result?.panelRegistryChanged));
}

function scheduleCustomTimerRefreshBroadcast(delayMs = 100) {
  if (customTimerRefreshTimeoutId !== null) {
    clearTimeout(customTimerRefreshTimeoutId);
  }
  customTimerRefreshTimeoutId = setTimeout(() => {
    customTimerRefreshTimeoutId = null;
    broadcastCustomTimerRefresh().catch((error) => {
      try { console.warn("[CustomBlocker] custom timer refresh broadcast failed", error); } catch (_) {}
    });
  }, delayMs);
}

let customPanelRefreshTimeoutId = null;
const pendingCustomPanelRefreshGroups = new Set();

function scheduleCustomPanelRefreshBroadcast(delayMs = 100, groupIds = []) {
  if (Array.isArray(groupIds)) {
    for (const groupId of groupIds) {
      if (typeof groupId === "string" && groupId) pendingCustomPanelRefreshGroups.add(groupId);
    }
  }
  if (customPanelRefreshTimeoutId !== null) {
    clearTimeout(customPanelRefreshTimeoutId);
  }
  customPanelRefreshTimeoutId = setTimeout(() => {
    customPanelRefreshTimeoutId = null;
    const panelGroups = Array.from(pendingCustomPanelRefreshGroups);
    pendingCustomPanelRefreshGroups.clear();
    broadcastCustomPanelRefresh(panelGroups).catch((error) => {
      try { console.warn("[CustomBlocker] custom panel refresh broadcast failed", error); } catch (_) {}
    });
  }, delayMs);
}

async function broadcastCustomTimerRefresh() {
  if (!chrome.tabs || !chrome.tabs.query) return;
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab || typeof tab.id !== "number") return;
      const url = tab.url || tab.pendingUrl || "";
      if (url && !/^https?:/i.test(url)) return;
      await trySendApply(tab.id, { type: "custom-timers-refresh" });
    })
  );
}

async function broadcastCustomPanelRefresh(panelGroups = []) {
  if (!chrome.tabs || !chrome.tabs.query) return;
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab || typeof tab.id !== "number") return;
      const url = tab.url || tab.pendingUrl || "";
      if (url && !/^https?:/i.test(url)) return;
      await trySendApply(tab.id, { type: "custom-panels-refresh", panelGroups });
    })
  );
}

async function applySandboxResultToTab(tabId, result, descriptor) {
  if (!result || typeof tabId !== "number") return;
  // Aggregate logs from the main dispatch + any synthResults (posted
  // events, timerEnded). Each entry: { level, groupId, args }.
  const logs = Array.isArray(result.logs) ? result.logs.slice() : [];
  const domOps = Array.isArray(result.domOps) ? result.domOps.slice() : [];
  const intents = Array.isArray(result.intents)
    ? result.intents.filter((intent) => !intent || intent.kind !== "localFile")
    : [];
  const panelPayload = collectPanelSnapshots(result);
  if (Array.isArray(result.synthResults)) {
    for (const synth of result.synthResults) {
      const sr = synth && synth.result;
      if (!sr) continue;
      if (Array.isArray(sr.logs)) logs.push(...sr.logs);
      if (Array.isArray(sr.domOps)) domOps.push(...sr.domOps);
      if (Array.isArray(sr.intents)) {
        intents.push(...sr.intents.filter((intent) => !intent || intent.kind !== "localFile"));
      }
    }
  }
  // Skip empty applies (they would only spam the per-tab queue with
  // ticks that have no observable side effect).
  if (logs.length === 0 && domOps.length === 0 && intents.length === 0 &&
      panelPayload.panels.length === 0 && panelPayload.groups.length === 0 &&
      !result.defaultPrevented && !result.redirectUrl &&
      typeof result.result !== "string") {
    return;
  }
  const message = {
    type: "event-sandbox-apply",
    descriptor,
    defaultPrevented: Boolean(result.defaultPrevented),
    result: result.result ?? null,
    redirectUrl: result.redirectUrl || "",
    domOps,
    intents,
    panelSnapshots: panelPayload.panels,
    panelGroups: panelPayload.groups,
    logs
  };
  const sent = await trySendApply(tabId, message);
  if (!sent) {
    // Content script not ready yet (very common right after
    // webNavigation.onCommitted: the openWebEvent dispatch is faster
    // than content_scripts run_at: document_idle). Queue it; we will
    // flush on the next "content-ready" handshake from this tab.
    enqueueApply(tabId, message);
  }
}

async function dispatchEventToTab(type, tabInfo, extras = {}) {
  // Wait for the startup loader so events arriving right after a SW
  // restart don't fan out into an empty registry.
  await ensureStartupGate();

  const url = normalizeUrlForEvents(tabInfo?.url || "");
  const descriptor = {
    type,
    tabId: tabInfo?.tabId ?? null,
    pageId: tabInfo?.pageId ?? null,
    url,
    hostname: hostnameOf(url),
    time: todayContext(),
    data: extras.data || null,
    targetGroupId: extras.targetGroupId || null,
    // Optional. Only the heartbeat dispatch path fills this in. The
    // sandbox advances all scope-matching timers by descriptor.elapsedMs
    // which mirrors the default block group's "real visible-page time"
    // exactly (content.js skips heartbeats on document.hidden tabs).
    elapsedMs: typeof extras.elapsedMs === "number" ? extras.elapsedMs : 0
  };
  const result = await dispatchToSandbox(descriptor);
  cbDebugLog("[CustomBlocker] dispatch", type, "→ tab", descriptor.tabId,
    "url:", url, "logs:", (result?.logs?.length ?? 0),
    "handlers:", cachedHandlerCount);
  ingestSandboxLogs(result, descriptor);
  maybeQuarantineFromResult(result, descriptor);
  await applySandboxResultToTab(descriptor.tabId, result, descriptor);
  await processLocalFileIntents(result, descriptor);
  if (type !== "pageHeartbeatEvent" && resultHasTimerRegistryChange(result)) {
    scheduleCustomTimerRefreshBroadcast();
  }
  if (type !== "pageHeartbeatEvent" && resultHasPanelRegistryChange(result)) {
    scheduleCustomPanelRefreshBroadcast();
  }
  return result;
}

// Tab + webNavigation watchers
if (chrome.tabs && chrome.tabs.onCreated) {
  chrome.tabs.onCreated.addListener(async (tab) => {
    if (!tab || typeof tab.id !== "number") return;
    previousTabUrls.delete(tab.id);
    scheduleSessionFlush();
    await dispatchEventToTab(
      "openWebEvent",
      { tabId: tab.id, url: tab.url || tab.pendingUrl || "" },
      { data: { previousUrl: null, isNewTab: true } }
    );
  });
}

if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener(async (tabId, _info) => {
    const previous = previousTabUrls.get(tabId);
    previousTabUrls.delete(tabId);
    // The tab is gone — any apply messages we queued for it will never
    // be drained, so clear that entry too to keep both in-memory and
    // session-persisted state from leaking forever.
    if (pendingApplyByTab.has(tabId)) {
      pendingApplyByTab.delete(tabId);
    }
    scheduleSessionFlush();
    await dispatchEventToTab(
      "closeWebEvent",
      { tabId, url: previous?.url || "" },
      { data: { reason: "tabClosed", nextUrl: null } }
    );
  });
}

async function handleCommittedWebNavigation(details) {
  if (!details || details.frameId !== 0) return;
  const tabId = details.tabId;
  if (typeof tabId !== "number" || tabId < 0) return;
  const previous = previousTabUrls.get(tabId);
  const previousUrl = previous?.url || null;
  const previousHost = previous?.hostname || "";
  const nextUrl = details.url || "";
  const nextHost = hostnameOf(nextUrl);
  previousTabUrls.set(tabId, { url: nextUrl, hostname: nextHost });
  scheduleSessionFlush();

  const isFirstLoad = !previous;
  const isReload = !!previous && previousUrl === nextUrl;
  const sameDomain = !!previousHost && previousHost === nextHost;

  if (!isFirstLoad && previousHost && previousHost !== nextHost) {
    await dispatchEventToTab(
      "switchDomainEvent",
      { tabId, url: nextUrl },
      { data: { previousUrl, previousHostname: previousHost } }
    );
    await dispatchEventToTab(
      "switchWebEvent",
      { tabId, url: nextUrl },
      { data: { previousUrl, previousHostname: previousHost, sameDomain: false } }
    );
  } else if (previousUrl !== nextUrl) {
    await dispatchEventToTab(
      "switchWebEvent",
      { tabId, url: nextUrl },
      { data: { previousUrl, previousHostname: previousHost, sameDomain: true } }
    );
  }

  // webChangedEvent is emitted exactly once for this accepted committed
  // navigation record. More specific navigation events above are derived from
  // the same record; openWebEvent is reserved for actual tab creation.
  await dispatchEventToTab(
    "webChangedEvent",
    { tabId, url: nextUrl },
    {
      data: {
        previousUrl,
        previousHostname: previousHost,
        sameDomain,
        isFirstLoad,
        isReload,
        transition: "commit"
      }
    }
  );
}

if (chrome.webNavigation && chrome.webNavigation.onCommitted) {
  chrome.webNavigation.onCommitted.addListener((details) => {
    handleCommittedWebNavigation(details).catch((error) => {
      try { console.warn("[CustomBlocker] committed navigation dispatch failed", error); } catch (_) {}
    });
  });
}

const lastTickSecondByTab = new Map();

// Shared tickEvent — fires once per second for each open tab.
async function emitTickToAllTabs() {
  const tabs = await chrome.tabs.query({});
  const tickSecond = Math.floor(Date.now() / 1000);
  const liveTabIds = new Set();
  for (const tab of tabs) {
    if (!tab || typeof tab.id !== "number") continue;
    liveTabIds.add(tab.id);
    if (lastTickSecondByTab.get(tab.id) === tickSecond) continue;
    lastTickSecondByTab.set(tab.id, tickSecond);
    await dispatchEventToTab(
      "tickEvent",
      { tabId: tab.id, url: tab.url || "" },
      { data: { intervalMs: 1000 } }
    );
  }
  for (const tabId of Array.from(lastTickSecondByTab.keys())) {
    if (!liveTabIds.has(tabId)) lastTickSecondByTab.delete(tabId);
  }
}

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm || alarm.name !== TICK_ALARM_NAME) return;
    await emitTickToAllTabs();
  });
  chrome.alarms.create(TICK_ALARM_NAME, { periodInMinutes: TICK_ALARM_PERIOD_MINUTES });
}

// Popup / external request handlers for Run, post, list.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.type === "run-custom-group") {
    (async () => {
      await ensureStartupGate();
      const groupId = String(message.groupId || "");
      if (!groupId) return sendResponse({ ok: false, error: "missing groupId" });
      const result = await chrome.storage.local.get(BLOCKED_GROUPS_KEY);
      const groups = Array.isArray(result[BLOCKED_GROUPS_KEY]) ? result[BLOCKED_GROUPS_KEY] : [];
      const idx = groups.findIndex((g) => g && g.id === groupId);
      if (idx < 0) return sendResponse({ ok: false, error: "group not found" });
      const group = groups[idx];
      // Popup is the source of truth; fall back to saved text so SW
      // restarts can re-run without a popup roundtrip.
      const sourceText = typeof message.source === "string"
        ? message.source
        : (typeof group.blockingRulesText === "string" ? group.blockingRulesText : "");
      // Clicking Run is the user's explicit "I edited the rule, try
      // again" gesture — so it always RE-ENABLES the group, even if a
      // previous overrun had quarantined it (enabled=false +
      // lastAbortReason). Without this, a quarantined rule would show
      // "0 handler(s) registered" forever because loadCustomGroupSource
      // sees enabled=false and immediately unloads. We also clear the
      // lastAbortReason so the popup doesn't keep showing a stale
      // "auto-disabled" badge after the user re-runs.
      const wasQuarantined = group.enabled === false &&
        typeof group.lastAbortReason === "string" && group.lastAbortReason.length > 0;
      const next = {
        ...group,
        enabled: true,
        activeEventSource: sourceText,
        lastAbortReason: null,
        lastAbortAt: null
      };
      groups[idx] = next;
      suppressReconcileLoadByGroup.add(groupId);
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: groups });
      const loadResult = await loadCustomGroupSource(next);
      sendResponse({ ok: true, loadResult });
    })();
    return true;
  }

  if (message.type === "unload-custom-group") {
    (async () => {
      await ensureStartupGate();
      const groupId = String(message.groupId || "");
      if (!groupId) return sendResponse({ ok: false });
      const r = await unloadCustomGroupHandlers(groupId);
      sendResponse({ ok: true, result: r });
    })();
    return true;
  }

  if (message.type === "list-handlers") {
    (async () => {
      // Block until the startup loader has had a chance to re-register
      // every group's `activeEventSource`. Without this gate, a popup
      // opening right after the SW wakes can race in and observe an
      // empty sandbox even though the real registry will be populated
      // milliseconds later.
      await ensureStartupGate();
      const r = await sendToEventSandbox({ kind: "list-handlers", groupId: message.groupId });
      sendResponse({ ok: true, result: r });
    })();
    return true;
  }

  if (message.type === "get-log-feed") {
    sendResponse({ ok: true, entries: logFeedBuffer.slice() });
    return false;
  }

  if (message.type === "clear-log-feed") {
    logFeedBuffer.length = 0;
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "offscreen-tick") {
    emitTickToAllTabs().catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  // Offscreen has hard-reset the sandbox iframe (after a request
  // exceeded the hard-timeout). All in-memory handler registrations are
  // gone; we eagerly re-load every enabled group so legitimate rules
  // keep working. If quarantineGroup already disabled the offending
  // rule, that reload will see enabled=false and unload it cleanly.
  if (message.type === "event-sandbox-reset") {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(BLOCKED_GROUPS_KEY);
        const groups = Array.isArray(stored[BLOCKED_GROUPS_KEY]) ? stored[BLOCKED_GROUPS_KEY] : [];
        // Wait a tick so the offscreen iframe finishes loading the new
        // event-sandbox.html before we start posting load-source.
        await new Promise((r) => setTimeout(r, 250));
        for (const group of groups) {
          if (!group || group.groupType !== "custom" || !group.enabled) continue;
          await loadCustomGroupSource(group);
        }
        refreshHandlerCount();
      } catch (error) {
        console.warn("[CustomBlocker] event-sandbox-reset reload failed", error);
      }
    })();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "content-ready") {
    const tabId = sender?.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false });
      return false;
    }
    const queued = pendingApplyByTab.get(tabId) || [];
    pendingApplyByTab.delete(tabId);
    scheduleSessionFlush();
    // Refresh the handler-count cache asynchronously; no blocking.
    refreshHandlerCount();
    sendResponse({
      ok: true,
      pending: queued,
      handlerCount: cachedHandlerCount
    });
    return false;
  }

  if (message.type === "check-custom-group-syntax") {
    // Compiles under a throwaway group id; no real group is touched.
    (async () => {
      try {
        const result = await sendToEventSandbox({
          kind: "check-source",
          source: typeof message.source === "string" ? message.source : ""
        });
        sendResponse({ ok: true, result });
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
    })();
    return true;
  }

  if (message.type === "fire-snooze-press") {
    // Pure notification event for custom groups. Handlers can log or
    // run arbitrary code in response to the Start Snooze button but
    // there's no programmatic snooze API. The dispatch is routed to
    // the currently active tab so logs surface there as toasts.
    (async () => {
      try {
        const groupId = String(message.groupId || "");
        cbDebugLog("[CustomBlocker:trace] bg fire-snooze-press groupId:", groupId);
        if (!groupId) {
          sendResponse({ ok: false, error: "missing groupId" });
          return;
        }
        let activeTab = null;
        try {
          const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          activeTab = tabs && tabs[0] ? tabs[0] : null;
        } catch (_) {}
        cbDebugLog("[CustomBlocker:trace] bg activeTab:", activeTab && { id: activeTab.id, url: activeTab.url });
        const descriptor = {
          type: "snoozePress",
          tabId: activeTab && typeof activeTab.id === "number" ? activeTab.id : null,
          pageId: null,
          url: normalizeUrlForEvents(activeTab?.url || ""),
          hostname: hostnameOf(activeTab?.url || ""),
          time: todayContext(),
          data: { triggeredAt: Date.now() },
          targetGroupId: groupId
        };
        cbDebugLog("[CustomBlocker:trace] bg → sandbox dispatch", descriptor);
        const result = await dispatchToSandbox(descriptor);
        cbDebugLog("[CustomBlocker:trace] bg ← sandbox result",
          result && {
            logs: result.logs?.length,
            intents: result.intents?.length,
            domOps: result.domOps?.length
          },
          "tabId:", descriptor.tabId);
        ingestSandboxLogs(result, descriptor);
        maybeQuarantineFromResult(result, descriptor);
        if (typeof descriptor.tabId === "number") {
          await applySandboxResultToTab(descriptor.tabId, result, descriptor);
          cbDebugLog("[CustomBlocker:trace] bg routed result to tab", descriptor.tabId);
        } else {
          cbDebugWarn("[CustomBlocker:trace] bg has no active tab id — toast cannot render");
        }
        await processLocalFileIntents(result, descriptor);
        sendResponse({ ok: true, result });
      } catch (error) {
        cbDebugError("[CustomBlocker:trace] bg fire-snooze-press error", error);
        sendResponse({
          ok: false,
          error: String(error && error.message ? error.message : error)
        });
      }
    })();
    return true;
  }

  if (message.type === "evaluate-platform-items") {
    (async () => {
      await ensureStartupGate();
      const r = await sendToEventSandbox({
        kind: "evaluate-platform-items",
        platform: message.platform,
        slot: message.slot,
        items: Array.isArray(message.items) ? message.items : []
      });
      sendResponse({ ok: Boolean(r && r.ok), results: r && Array.isArray(r.results) ? r.results : [] });
    })();
    return true;
  }

  if (message.type === "post-custom-event") {
    (async () => {
      await ensureStartupGate();
      const descriptor = {
        type: String(message.eventType || ""),
        url: normalizeUrlForEvents(message.url || ""),
        hostname: hostnameOf(message.url || ""),
        time: todayContext(),
        data: message.data || null,
        targetGroupId: message.scope === "global" ? null : (message.groupId || null),
        tabId: typeof message.tabId === "number" ? message.tabId : null
      };
      const r = await dispatchToSandbox(descriptor);
      await processLocalFileIntents(r, descriptor);
      sendResponse({ ok: true, result: r });
    })();
    return true;
  }

  if (message.type === "custom-panel-event") {
    (async () => {
      await ensureStartupGate();
      const tabId = sender?.tab?.id ?? (typeof message.tabId === "number" ? message.tabId : null);
      const url = normalizeUrlForEvents(message.url || sender?.tab?.url || sender?.url || "");
      const groupId = typeof message.groupId === "string" ? message.groupId : "";
      const data = {
        panelId: typeof message.panelId === "string" ? message.panelId : "",
        controlId: typeof message.controlId === "string" ? message.controlId : "",
        eventName: typeof message.eventName === "string" ? message.eventName : "",
        value: message.value,
        values: message.values && typeof message.values === "object" ? message.values : {},
        key: typeof message.key === "string" ? message.key : "",
        code: typeof message.code === "string" ? message.code : "",
        keyInfo: message.keyInfo && typeof message.keyInfo === "object" ? message.keyInfo : null
      };
      const result = await dispatchEventToTab(
        "panelEvent",
        { tabId, url },
        { data, targetGroupId: groupId }
      );
      sendResponse({ ok: true, result });
    })().catch((error) => {
      sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
    });
    return true;
  }

  return false;
});

// Run startup loader once the SW spins up. Future dispatches await
// `startupGate`, so events that fire before this resolves wait their
// turn instead of being dispatched against an empty registry.
ensureStartupGate().catch((error) => {
  console.error("[CustomBlocker] startup loader threw", error);
});

