/* Custom Web Blocker — background service worker.
 *
 * Responsibilities:
 *   - Persist groups, usage timers, snoozes, custom timer state, custom
 *     persistence buckets.
 *   - Decide each page (cbPageLead): blocking is the union of every group;
 *     the groups are walked from the top of the editor list and the first
 *     that blocks a page decides how it looks. The content script covers the
 *     page in place; an address sends the tab away, early when the decision
 *     can be made from the URL (onBeforeNavigate). Custom groups run per-page
 *     in the content script.
 *   - Build the page session payload that the content script consumes, and
 *     push "session-refresh" to open pages when the enforcement state changes.
 *   - Sanitise and store the custom timer / persistence updates that the
 *     content script flushes back after running rules.
 */

// On Chromium the background context is a classic service worker, so we
// pull in helpers.js with importScripts(). On Firefox/Safari the background
// is a DOM-bearing page (it has to be — it hosts the sandbox iframe in the
// absence of chrome.offscreen), where importScripts() does not exist; there
// the packaging step lists helpers.js ahead of background.js in
// manifest.background.scripts, so it is already loaded by this point.
if (typeof importScripts === "function") {
  try {
    if (typeof CBBridgeProtocol === "undefined") importScripts("bridge-protocol.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(bridge-protocol.js) failed", error);
  }
  try {
    if (typeof CBLocalHubEnvironment === "undefined") importScripts("local-hub-environment.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(local-hub-environment.js) failed", error);
  }
  try {
    if (typeof PLATFORM_PROFILES === "undefined") importScripts("platform-profiles.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(platform-profiles.js) failed", error);
  }
  try {
    if (typeof CBGroupScopes === "undefined") importScripts("group-scopes.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(group-scopes.js) failed", error);
  }
  try {
    if (typeof CBParentalPin === "undefined") importScripts("parental-pin.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(parental-pin.js) failed", error);
  }
  try {
    if (typeof VaultClassifierExtensionContract === "undefined") importScripts("vault-classifier-contract.js");
    importScripts("vault-classifier-bridge.js", "local-hub-auth.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(vault classifier bridge) failed", error);
  }
  try {
    importScripts("helpers.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(helpers.js) failed", error);
  }
  try {
    if (typeof cbActivity === "undefined") importScripts("vault-activity.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(vault-activity.js) failed", error);
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
// Rolling-limit usage per group: {groupId: {"<minuteStartMs>": ms}}.
const USAGE_BUCKETS_KEY = "usageBucketsMs";
const GROUP_SNOOZES_KEY = "groupSnoozes";
const GROUP_SNOOZE_TOTALS_KEY = "groupSnoozeTotalsMs";

const DEFAULT_ALLOWED_MINUTES = 15;
const DEFAULT_RESET_INTERVAL_HOURS = 24;
const DEFAULT_STRICT_FREEZE_HOURS = 24;
const DEFAULT_SNOOZE_MINUTES = 30;
const DEFAULT_SNOOZE_CONFIRMATIONS = 0;
// The pause action's countdown (seconds a page is held before Continue).
const DEFAULT_PAUSE_SECONDS = 10;
const MAX_PAUSE_SECONDS = 600;
// A page let through after a pause countdown stays through for this long on
// that tab and host (the pass ends earlier when the tab leaves the host).
const PAUSE_PASS_MS = 15 * 60 * 1000;
const DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES = 0;
const DEFAULT_SNOOZE_COOLDOWN_MINUTES = 0;
const DEFAULT_GROUP_TYPE = "site";
const MAX_SNOOZE_COOLDOWN_MINUTES = 5;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MAX_HEARTBEAT_MS = 5000;
// Group id -> the wall-clock moment its budget has been counted up to (see
// the accrual loop): time is counted once per group across visible tabs.
const cbGroupAccruedUntilMs = new Map();
const TRANSITION_ALARM_NAME = "custom-blocker-transition";
const ACTION_ICON_NORMAL_PATHS = Object.freeze({
  16: "icons/adamancia-vault-lock-v3-16.png",
  32: "icons/adamancia-vault-lock-v3-32.png",
  48: "icons/adamancia-vault-lock-v3-48.png"
});
const ACTION_ICON_INVERSE_DARK_PATHS = Object.freeze({
  16: "icons/adamancia-vault-lock-inverse-dark-16.png",
  32: "icons/adamancia-vault-lock-inverse-dark-32.png",
  48: "icons/adamancia-vault-lock-inverse-dark-48.png"
});
let actionIconColorScheme = null;

// Firefox has declarative action.theme_icons in its manifest. Chromium does
// not, so its service worker applies the appropriate generated PNGs when the
// long-lived offscreen document reports the system colour scheme. Firefox and
// Safari have a DOM-bearing background page, while Chromium MV3 uses a worker.
function supportsDynamicActionIcon() {
  return typeof document === "undefined" && Boolean(chrome?.action?.setIcon);
}

async function syncActionIconColorScheme(prefersDark) {
  if (!supportsDynamicActionIcon()) return false;
  const next = prefersDark === true ? "dark" : "light";
  if (next === actionIconColorScheme) return true;
  try {
    await chrome.action.setIcon({
      path: next === "dark" ? ACTION_ICON_INVERSE_DARK_PATHS : ACTION_ICON_NORMAL_PATHS
    });
    actionIconColorScheme = next;
    return true;
  } catch (error) {
    console.warn("[CustomBlocker] failed to update the toolbar icon colour scheme", error);
    return false;
  }
}

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
      PLATFORM_PROFILES[normalizedGroupType]?.defaultName ??
      (normalizedGroupType === "custom" ? "Custom Block" : "Block Group"),
    enabled: true,
    mode: "instant",
    allowedMinutes: DEFAULT_ALLOWED_MINUTES,
    resetIntervalHours: DEFAULT_RESET_INTERVAL_HOURS,
    resetAtMidnight: false,
    rollingLimit: false,
    allowSnooze: true,
    snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    snoozeActivationDelayMinutes: DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
    snoozeCooldownMinutes: DEFAULT_SNOOZE_COOLDOWN_MINUTES,
    snoozeConfirmations: DEFAULT_SNOOZE_CONFIRMATIONS,
    activeDays: createDefaultDays(),
    timeWindowsText: "",
    platformVideoMode: "all",
    // Source axis: creators / accounts / subreddits (Discord keeps its own pair).
    sourceMode: "all",
    sources: [],
    discordMode: "all",
    discordTargets: [],
    surfaceHides: [],
    blockingRulesText:
      "(month, dayOfMonth, dayName, hour, minute, url, helpers) => false",
    freezeMode: "none",
    strictFreezeHours: DEFAULT_STRICT_FREEZE_HOURS,
    frozenAtMs: null,
    parentalPasswordHash: null,
    parentalPasswordSalt: null,
    sites: [],
    // allowlist=false → the `sites` list is a blocklist (block those domains,
    // pass everything else). allowlist=true → the `sites` list is an allowlist
    // (block the whole web EXCEPT those domains). Honored for "site" and
    // "custom" groups; the feed-level `effect` flag below is unrelated.
    allowlist: false,
    blockHomePage: false,
    fallbackUrl: "",
    pauseSeconds: DEFAULT_PAUSE_SECONDS
  };
}

// A site entry is a host ("youtube.com": that host and its subdomains) or a
// host plus a path prefix ("youtube.com/shorts": only that path and everything
// under it; owner 2026-09-24). Scheme, www., query and hash are dropped.
function normalizeSiteInput(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  const maybeUrl = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    const parsedUrl = new URL(maybeUrl);
    let hostname = parsedUrl.hostname.trim().toLowerCase();
    if (!hostname) return null;
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);
    const path = parsedUrl.pathname.replace(/\/+$/, "");
    return path && path !== "/" ? hostname + path : hostname;
  } catch {
    return null;
  }
}

function siteEntryParts(entry) {
  const text = String(entry ?? "");
  const slash = text.indexOf("/");
  return slash < 0 ? { host: text, path: "" } : { host: text.slice(0, slash), path: text.slice(slash) };
}

// Does `entry` cover this hostname + pathname? Host entries ignore the path;
// path entries need the path itself or a child of it (segment boundary, so
// "youtube.com/short" never matches "/shorts").
function siteEntryMatches(hostname, pathname, entry) {
  const { host, path } = siteEntryParts(entry);
  if (!hostnameMatchesSite(hostname, host)) return false;
  if (!path) return true;
  const current = String(pathname || "/").toLowerCase().replace(/\/+$/, "") || "/";
  return current === path || current.startsWith(path + "/");
}

// Platform group-type vocabulary + entity/mode normalisation now lives in
// platform-profiles.js (the single site-profile registry), loaded above via
// importScripts. normalizeGroupType, isPlatformVideoGroupType,
// normalizeYouTubeCreatorInput, normalizeSourceInput,
// normalizeSourceMode, normalizeVideoMode,
// normalizeRedditSubredditInput, normalizeDiscordMode and
// normalizeDiscordTargetInput are provided as globals from there.

function normalizeBlockingMode(value) {
  if (value === "after-minutes") return value;
  // Crash guard for stores written before 2026-09-25: the count-up "timer"
  // mode is gone (Activity tracks usage on its own); such a group keeps its
  // allowance and reset settings as a normal timed group.
  if (value === "timer") return "after-minutes";
  return "instant";
}

// The timed mode owns a usage timer that accrues while the filter matches and
// blocks once the allowance is spent.
function isTimedBlockingMode(mode) {
  return mode === "after-minutes";
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

function parsePauseSeconds(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_PAUSE_SECONDS) return null;
  return parsed;
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
    // An end before the start runs past midnight (2300-0100); only an empty
    // window is invalid.
    startTotal === endTotal
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

// ── Content-tag filter (platform rules) normalizers ──────────────────────
// A platform group can block by content tag (from the Vault classifier), like
// the author filter but keyed on WHAT the content is. Modes: "all" (off),
// "include" (block listed tags), "exclude" (block all except listed tags).
function normalizeTagFilterMode(value) {
  return value === "include" || value === "exclude" ? value : "all";
}
function clampTagConfidence(value, fallback) {
  const c = Number(value);
  return Number.isFinite(c) ? Math.min(5, Math.max(1, Math.round(c))) : fallback;
}
// Each entry is { name, confidence?, also?, except? }:
//   confidence — overrides the filter default for this entry;
//   also       — further tags that must ALL be present too (AND: "A + B");
//   except     — a carve-out ("!A"): the list matches only if no carve-out does.
function normalizeTagList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  const cleanName = (value) => (typeof value === "string" ? value.trim().slice(0, 100) : "");
  for (const entry of raw) {
    let name = null;
    let confidence;
    let also = [];
    let except = false;
    if (typeof entry === "string") {
      name = entry;
    } else if (entry && typeof entry === "object") {
      name = entry.name;
      confidence = entry.confidence;
      if (Array.isArray(entry.also)) also = entry.also;
      except = entry.except === true;
    }
    name = cleanName(name);
    if (!name) continue;
    const alsoSeen = new Set([name.toLowerCase()]);
    const cleanAlso = [];
    for (const extra of also) {
      const extraName = cleanName(extra);
      if (!extraName || alsoSeen.has(extraName.toLowerCase())) continue;
      alsoSeen.add(extraName.toLowerCase());
      cleanAlso.push(extraName);
      if (cleanAlso.length >= 5) break;
    }
    const key = (except ? "!" : "") + [...alsoSeen].sort().join("+");
    if (seen.has(key)) continue;
    seen.add(key);
    const c = Number(confidence);
    const normalized = { name };
    if (Number.isFinite(c) && c >= 1 && c <= 5) normalized.confidence = Math.round(c);
    if (cleanAlso.length) normalized.also = cleanAlso;
    if (except) normalized.except = true;
    out.push(normalized);
    if (out.length >= 100) break;
  }
  return out;
}

// The context's own normalizers for the line fields whose normalization
// differs between the worker and the popup (see group-scopes.js).
const cbScopeNormalizers = {
  normalizeSiteInput: (value) => normalizeSiteInput(value),
  normalizeTagFilterMode: (value) => normalizeTagFilterMode(value),
  normalizeTagList: (value) => normalizeTagList(value),
  clampTagConfidence: (value, fallback) => clampTagConfidence(value, fallback)
};

// Sanitizes stored / patched groups into the canonical shape: policy fields +
// `scopes` (group-scopes.js). Input may be canonical (a stored group), flat
// (the popup's form model, a legacy store, an MCP patch of flat fields) or
// canonical with flat fields patched on top — flat fields always describe the
// intended lines, so they win over lines merged underneath.
function sanitizeGroups(groups) {
  if (!Array.isArray(groups)) return [];

  return groups
    .map((input, index) => {
      const hasLines = CBGroupScopes.hasScopeLines(input);
      const flatPatched = CBGroupScopes.hasFlatScopeFields(input);
      const group = hasLines ? { ...CBGroupScopes.flatFromScopes(input), ...input } : input;
      const useStoredLines = hasLines && !flatPatched;
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
      // One source list per group. Legacy stores carried platformAuthors /
      // platformAuthorMode (creators, accounts) or redditSubreddits /
      // redditMode (Reddit); both are read once here and written back as
      // sources / sourceMode.
      const legacySources = group?.groupType === "reddit" ? group?.redditSubreddits : group?.platformAuthors;
      const legacyMode = group?.groupType === "reddit" ? group?.redditMode : group?.platformAuthorMode;
      // The legacy pair only exists in old stores and old-style patches, so when
      // it is present it wins over a default-valued modern pair merged underneath.
      const hasLegacy = Array.isArray(legacySources) || typeof legacyMode === "string";
      const rawSources = hasLegacy
        ? (Array.isArray(legacySources) ? legacySources : [])
        : Array.isArray(group?.sources) ? group.sources : [];
      const rawSourceMode = hasLegacy ? legacyMode : group?.sourceMode;
      const rawDiscordTargets = Array.isArray(group?.discordTargets) ? group.discordTargets : [];

      const normalizedGroupType = normalizeGroupType(group?.groupType);

      const normalized = {
        ...baseGroup,
        id: typeof group?.id === "string" && group.id ? group.id : baseGroup.id,
        name:
          typeof group?.name === "string" && group.name.trim()
            ? group.name.trim()
            : `${baseGroup.name} ${index + 1}`,
        // The group-level "allow" exception effect was removed (owner 2026-09-24:
        // exceptions live in custom rules). A stored exception group must not
        // silently turn into a blocking group, so it is kept but disabled.
        enabled: Boolean(group?.enabled) && group?.effect !== "allow",
        groupType: normalizedGroupType,
        mode: normalizeBlockingMode(group?.mode),
        allowedMinutes: parseAllowedMinutes(group?.allowedMinutes) ?? DEFAULT_ALLOWED_MINUTES,
        resetIntervalHours:
          parseResetIntervalHours(group?.resetIntervalHours) ?? DEFAULT_RESET_INTERVAL_HOURS,
        resetAtMidnight: group?.resetAtMidnight === true,
        rollingLimit: group?.rollingLimit === true,
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
        sourceMode: normalizeSourceMode(rawSourceMode, rawSources),
        sources: [
          ...new Set(
            rawSources
              .map((source) => normalizeSourceInput(source, normalizedGroupType))
              .filter(Boolean)
          )
        ],
        // Content-tag filter (platform rules): block by classifier tag.
        platformTagMode: normalizeTagFilterMode(group?.platformTagMode),
        platformTags: normalizeTagList(group?.platformTags),
        platformTagDefaultConfidence: clampTagConfidence(group?.platformTagDefaultConfidence, 4),
        platformTagBlockUntagged: Boolean(group?.platformTagBlockUntagged),
        platformTagEffect: group?.platformTagEffect === "block" ? "block" : "dim",
        // A matching video's OWN page (watch/detail) blacks out its player in
        // place. On unless explicitly turned off: feed-dim + page-block is the
        // product default for content-tag blocking.
        platformTagBlockPage: group?.platformTagBlockPage !== false,
        // Optional (default off): cover taggable cards / the watch page while the
        // classifier is still tagging, instead of leaving them visible until the
        // tags arrive. Revealed when the tags settle and do not match.
        platformTagCoverUntilTagged: group?.platformTagCoverUntilTagged === true,
        discordTargets: [
          ...new Set(
            rawDiscordTargets
              .map((target) => normalizeDiscordTargetInput(target))
              .filter(Boolean)
          )
        ],
        discordMode: normalizeDiscordMode(group?.discordMode, rawDiscordTargets),
        surfaceHides: normalizeSurfaceHides(group?.surfaceHides, normalizedGroupType),
        blockingRulesText:
          typeof group?.blockingRulesText === "string" && group.blockingRulesText.trim()
            ? group.blockingRulesText.trim()
            : baseGroup.blockingRulesText,
        freezeMode:
          group?.freezeMode === "strict" ||
          group?.freezeMode === "frozen" ||
          group?.freezeMode === "parental"
            ? group.freezeMode
            : "none",
        // The lock mode picked for the next freeze (kept by the editor; the
        // worker must not drop it when it rewrites groups).
        freezeModeChoice: ["frozen", "strict", "parental"].includes(group?.freezeModeChoice)
          ? group.freezeModeChoice
          : ["frozen", "strict", "parental"].includes(group?.freezeMode)
            ? group.freezeMode
            : typeof group?.parentalPasswordHash === "string" && group.parentalPasswordHash ? "parental" : "frozen",
        // When the lock last changed on any device: the newest change wins
        // across linked devices (ConnectionHub.mergeFreezeLocked).
        freezeChangedAtMs:
          Number.isFinite(Number(group?.freezeChangedAtMs)) && Number(group.freezeChangedAtMs) > 0
            ? Number(group.freezeChangedAtMs)
            : 0,
        strictFreezeHours:
          parseStrictFreezeHours(group?.strictFreezeHours) ?? DEFAULT_STRICT_FREEZE_HOURS,
        frozenAtMs:
          Number.isFinite(Number(group?.frozenAtMs)) && Number(group.frozenAtMs) > 0
            ? Number(group.frozenAtMs)
            : null,
        parentalPasswordHash:
          typeof group?.parentalPasswordHash === "string" && group.parentalPasswordHash
            ? group.parentalPasswordHash
            : null,
        parentalPasswordSalt:
          typeof group?.parentalPasswordSalt === "string" && group.parentalPasswordSalt
            ? group.parentalPasswordSalt
            : null,
        sites: Array.isArray(group?.sites)
          ? [...new Set(group.sites.map(normalizeSiteInput).filter(Boolean))]
          : [],
        // See defaultGroup(): blocklist (false) vs "block all except" (true).
        allowlist: Boolean(group?.allowlist),
        blockHomePage: Boolean(group?.blockHomePage),
        // The entry's page action (block | pause), read into its lines below.
        pageAction: group?.pageAction === "pause" ? "pause" : "block",
        // One field: a web address redirects the blocked tab there, any other
        // text is shown on the cover, blank = the plain cover (cbBlockExit).
        fallbackUrl: typeof group?.fallbackUrl === "string" ? group.fallbackUrl.trim() : "",
        pauseSeconds: parsePauseSeconds(group?.pauseSeconds) ?? DEFAULT_PAUSE_SECONDS,
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
      // Stored lines are validated as they are. A flat (form / legacy / MCP)
      // patch describes ONE platform — the group's type — and replaces only
      // that platform's lines; lines of the group's other platforms stay.
      const storedLines = hasLines
        ? CBGroupScopes.sanitizeScopeLines(input.scopes, normalizedGroupType, cbScopeNormalizers)
        : [];
      let scopes = useStoredLines
        ? storedLines
        : CBGroupScopes.mergeFlatIntoScopes(storedLines, normalized, normalizedGroupType);
      // A website list patched onto a platform group edits its Websites entry
      // (owner 2026-09-24): the flat `sites`/`allowlist` describe that entry.
      if (!useStoredLines && CBGroupScopes.platformKind(normalizedGroupType) !== "site" && normalizedGroupType !== "custom"
          && (Object.prototype.hasOwnProperty.call(input, "sites") || Object.prototype.hasOwnProperty.call(input, "allowlist"))) {
        scopes = CBGroupScopes.mergeFlatIntoScopes(scopes, normalized, "site");
      }
      return {
        ...CBGroupScopes.withoutFlatScopeFields(normalized),
        groupType: CBGroupScopes.deriveGroupType(scopes, normalizedGroupType),
        scopes
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

function sanitizeUsageBuckets(value, groups) {
  const sanitized = {};
  for (const group of groups) {
    const raw = value?.[group.id];
    if (!raw || typeof raw !== "object") continue;
    const buckets = {};
    for (const [minute, used] of Object.entries(raw)) {
      const start = Number(minute);
      const ms = Number(used);
      if (Number.isFinite(start) && Number.isFinite(ms) && ms > 0) buckets[String(start)] = ms;
    }
    sanitized[group.id] = buckets;
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
    // When the entry last changed (started or ended): the newest change wins
    // across linked devices. Snooze and Lock mode are independent (a stored
    // `refreezeMode` from before 2026-09-26 is dropped here).
    const changedAtMs = Number.isFinite(Number(snooze?.changedAtMs)) && Number(snooze.changedAtMs) > 0
      ? Number(snooze.changedAtMs)
      : 0;
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
        ...(changedAtMs ? { changedAtMs } : {})
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

// Host predicates (isYouTubeHost / isRedditHost / isDiscordHost /
// isTwitterHost / isPlatformHost), path parsers
// (parseRedditSubredditFromPath / parseDiscordServerIdFromPath /
// parseDiscordChannelIdFromPath), detectVideoSiteContext,
// extractPrimaryAuthorFromPath and normalizePlatformAuthorsMap now live in
// platform-profiles.js and are provided as globals.

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
      isTwitterPage: isTwitterHost(hostname),
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
    isTwitterPage: Boolean(input?.isTwitterPage) || isTwitterHost(normalizedHostname),
    videoSite: typeof input?.videoSite === "string" ? input.videoSite : videoContext.site,
    videoForm:
      input?.videoForm === "short" ||
      input?.videoForm === "long" ||
      input?.videoForm === "post"
        ? input.videoForm
        : videoContext.form,
    // The local Vault Classifier receives rendered evidence through its own
    // dedicated adapter; page matching contains no remote classification state.
  };
}

// The group's "when blocked" field, read the same way by the worker (early
// redirect) and by content.js (page-level blocks): a web address or a
// scheme-less host is an ADDRESS the tab is sent to; any other text is a
// MESSAGE shown on the in-place cover; blank is the plain cover. Only an
// address ever leaves the page (owner 2026-09-25: the cover is the default).
function cbBlockExit(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { navigate: "", message: "" };
  if (/^(https?|about|chrome-extension|moz-extension|safari-web-extension):/i.test(text)) return { navigate: text, message: "" };
  if (!/\s/.test(text) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(text)) return { navigate: "https://" + text, message: "" };
  return { navigate: "", message: text };
}

function getAllowedMs(group) {
  return group.allowedMinutes * MS_PER_MINUTE;
}

function getResetIntervalMs(group) {
  return group.resetIntervalHours * MS_PER_HOUR;
}

// ── Timed-group budget periods (same rules as Mac Vault's UsageBudget.swift) ─
// Fixed budget: resets every resetIntervalHours from the stored anchor, or — with
// resetAtMidnight — on a grid restarted at local 00:00 each day (00:00, then every
// N h; the last period of the day ends early at midnight). Rolling limit: usage is
// kept per minute and counts until it is N h old; with resetAtMidnight the window
// never reaches before today's 00:00.
const USAGE_BUCKET_MS = MS_PER_MINUTE;

function cbStartOfDayMs(nowMs) {
  const day = new Date(nowMs);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function cbNextMidnightMs(nowMs) {
  const day = new Date(cbStartOfDayMs(nowMs));
  day.setDate(day.getDate() + 1);
  return day.getTime();
}

function cbPeriodStartMs(anchorMs, group, nowMs) {
  const interval = Math.max(0, getResetIntervalMs(group));
  if (group.resetAtMidnight) {
    const dayStart = cbStartOfDayMs(nowMs);
    if (interval <= 0) return dayStart;
    return dayStart + Math.floor((nowMs - dayStart) / interval) * interval;
  }
  if (interval <= 0 || nowMs - anchorMs < interval) return anchorMs;
  return anchorMs + Math.floor((nowMs - anchorMs) / interval) * interval;
}

function cbNextResetMs(periodStartMs, group, nowMs) {
  const interval = Math.max(0, getResetIntervalMs(group));
  if (group.resetAtMidnight) {
    const midnight = cbNextMidnightMs(nowMs);
    return interval > 0 ? Math.min(periodStartMs + interval, midnight) : midnight;
  }
  return interval > 0 ? periodStartMs + interval : null;
}

function cbUsageBucketStartMs(nowMs) {
  return Math.floor(nowMs / USAGE_BUCKET_MS) * USAGE_BUCKET_MS;
}

function cbPruneUsageBuckets(buckets, group, nowMs) {
  let windowStart = nowMs - Math.max(0, getResetIntervalMs(group));
  if (group.resetAtMidnight) windowStart = Math.max(windowStart, cbStartOfDayMs(nowMs));
  const kept = {};
  for (const [minute, used] of Object.entries(buckets ?? {})) {
    const start = Number(minute);
    const ms = Number(used);
    // A minute counts until the whole minute has aged out of the window.
    if (Number.isFinite(start) && Number.isFinite(ms) && ms > 0 && start + USAGE_BUCKET_MS > windowStart) {
      kept[String(start)] = ms;
    }
  }
  return kept;
}

function cbBucketsUsedMs(buckets) {
  return Object.values(buckets ?? {}).reduce((sum, used) => sum + (Number(used) || 0), 0);
}

// When rolling time starts coming back: the oldest counted minute leaving the
// window (or midnight clearing it). Null when nothing is counted.
function cbNextReturnMs(buckets, group, nowMs) {
  const minutes = Object.keys(buckets ?? {}).map(Number).filter(Number.isFinite);
  if (minutes.length === 0) return null;
  let next = Math.min(...minutes) + USAGE_BUCKET_MS + Math.max(0, getResetIntervalMs(group));
  if (group.resetAtMidnight) next = Math.min(next, cbNextMidnightMs(nowMs));
  return next;
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
  const todayActive = group.activeDays.includes(getDayNameForDate(currentDate));

  const timeWindows = parseTimeWindowsText(group.timeWindowsText);
  if (timeWindows.length === 0) return todayActive;

  // The part of a window after midnight belongs to the day the window starts:
  // Monday's 2300-0100 still runs at 00:30 on Tuesday even when Tuesday is not
  // an active day, and needs Monday to be active.
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayActive = group.activeDays.includes(getDayNameForDate(yesterday));
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
  return timeWindows.some((windowText) => {
    const { startMinutes, endMinutes } = parseTimeWindowToMinutes(windowText);
    if (endMinutes < startMinutes) {
      return (todayActive && currentMinutes >= startMinutes) || (yesterdayActive && currentMinutes < endMinutes);
    }
    return todayActive && currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });
}

// matchesVideoMode, isHomeFeedPage, isPlatformHost and the per-platform
// matchers (matchesPlatformVideoGroup / matchesRedditGroup /
// matchesDiscordGroup / matchesTwitterGroup) plus the matchesProfileGroup
// dispatcher all live in platform-profiles.js and are provided as globals.

// Does a group's site line block `hostname` + `pathname` right now? (Mode /
// active / snooze are handled by callers; this is the pure list verdict.)
//   blocklist (sitesExcept=false): block iff the URL is in the list.
//   allowlist (sitesExcept=true):  block iff the URL is NOT in the list
//                                  ("block everything except these").
// Used for "site" and "custom" groups. An allowlist line with an empty list
// blocks the entire web — a valid (if drastic) lockdown config.
function cbSiteLine(group) {
  return (Array.isArray(group?.scopes) ? group.scopes : []).find((line) => line.surface === "site") || null;
}

function siteLineBlocks(line, hostname, pathname) {
  if (!line || !hostname) return false;
  const sites = Array.isArray(line.sites) ? line.sites : [];
  const inList = sites.some((entry) => siteEntryMatches(hostname, pathname, entry));
  return line.sitesExcept ? !inList : inList;
}

// True when a group carries a meaningful site line (so an unconfigured custom
// group — no list — never accidentally participates in page blocking, while an
// allowlist line always does, even with an empty list).
function groupUsesSiteList(group) {
  const line = cbSiteLine(group);
  return Boolean(line) && (Boolean(line.sitesExcept) || (Array.isArray(line.sites) && line.sites.length > 0));
}

function matchesSiteGroup(group, hostname, pathname) {
  return siteLineBlocks(cbSiteLine(group), hostname, pathname);
}

// ── Scope lines → the platform matchers ────────────────────────────────────
// The registry matchers read a flat platform shape; a line is presented to
// them as that shape. Only page surfaces can match a page: an untagged
// "pages" line through the platform matcher (home check off), a "home" line
// through the home check alone (its source axis names nothing), a site line
// through the site list. Items, shelves and tagged pages lines never match a
// page here — tagged pages are decided by the content script from the tag
// entry's pageEffect, exactly as before.
function cbLineView(group, line, overrides) {
  const platform = line?.platform || group.groupType;
  return {
    id: group.id,
    groupType: platform,
    platformVideoMode: line?.form || "all",
    sourceMode: line?.sourceMode || "all",
    sources: Array.isArray(line?.sources) ? line.sources : [],
    discordMode: line?.discordMode || "all",
    discordTargets: Array.isArray(line?.discordTargets) ? line.discordTargets : [],
    blockHomePage: false,
    ...overrides
  };
}

// The group's source axis (its untagged items/pages line), for the helpers
// that gate on "does this group's author scope cover the current page".
function cbGroupSourceLine(group, platform) {
  return (Array.isArray(group?.scopes) ? group.scopes : []).find(
    (line) => (line.surface === "items" || line.surface === "pages") && !line.tagFilter
      && (!platform || line.platform === platform)
  ) || null;
}

function cbGroupSourceAxisView(group, platform) {
  const line = cbGroupSourceLine(group, platform);
  return line
    ? cbLineView(group, line)
    : cbLineView(group, null, { groupType: platform || group.groupType, sourceMode: "nobody", discordMode: "include", discordTargets: [] });
}

function cbLineMatchesPage(group, line, pageContext) {
  if (!line) return false;
  if (line.surface === "site") return siteLineBlocks(line, pageContext.hostname, pageContext.pathname);
  if (line.surface === "pages") {
    if (line.tagFilter) return false;
    return matchesProfileGroup(cbLineView(group, line), pageContext);
  }
  if (line.surface === "home") {
    return matchesProfileGroup(
      cbLineView(group, line, { blockHomePage: true, sourceMode: "nobody", discordMode: "include", discordTargets: [] }),
      pageContext
    );
  }
  return false;
}

function cbGroupMatchesPage(group, pageContext) {
  const lines = Array.isArray(group?.scopes) ? group.scopes : [];
  return lines.some((line) => cbLineMatchesPage(group, line, pageContext));
}

// Does this group's page lines name this page? (Its policy is the caller's.)
// Custom groups still run their JS in content.js, but they may ALSO carry a
// declarative site line (block / "block all except"); only a configured one
// takes part in the page decision.
function cbGroupBlocksPage(group, pageContext) {
  if (group.groupType === "custom") {
    return groupUsesSiteList(group) && matchesSiteGroup(group, pageContext.hostname, pageContext.pathname);
  }
  return cbGroupMatchesPage(group, pageContext);
}

// Groups in effect right now that name this page, in list order (top first).
function getRelevantGroupsForPage(pageContext, groups, groupSnoozes, now) {
  return groups.filter((group) => cbGroupActive(group, groupSnoozes, now) && cbGroupBlocksPage(group, pageContext));
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
      const item = {
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
      };
      if (snap.overlayStyle && typeof snap.overlayStyle === "object") {
        item.overlayStyle = snap.overlayStyle;
      }
      out.push(item);
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

function buildTimedItems(relevantGroups, usageTimersMs, usageResetAtMs, now, usageBucketsMs = {}) {
  return relevantGroups
    .filter((group) => isTimedBlockingMode(group.mode))
    .map((group) => {
      const usedMs = usageTimersMs[group.id] ?? 0;
      const remainingMs = Math.max(getAllowedMs(group) - usedMs, 0);
      return {
        id: group.id,
        name: group.name,
        groupType: group.groupType,
        mode: group.mode,
        usedMs,
        allowedMinutes: group.allowedMinutes,
        resetIntervalHours: group.resetIntervalHours,
        resetAtMidnight: group.resetAtMidnight === true,
        rollingLimit: group.rollingLimit === true,
        // Fixed budget: when it next resets. Rolling limit: when counted time
        // starts coming back (null with nothing counted).
        nextResetAtMs: group.rollingLimit
          ? cbNextReturnMs(usageBucketsMs[group.id], group, now)
          : cbNextResetMs(cbPeriodStartMs(usageResetAtMs[group.id] ?? now, group, now), group, now),
        remainingMs,
        displayMs: remainingMs,
        blocksNow: usedMs >= getAllowedMs(group)
      };
    })
    // Least time left first.
    .sort((left, right) => left.remainingMs - right.remainingMs || left.name.localeCompare(right.name));
}

// One-time migration (2026-09-24): the global "default fallback URL" setting
// is gone — the redirect is one per-group field now. A stored default is copied
// into every non-custom group that had no address of its own, so nobody's
// redirect silently disappears, then the key is dropped.
async function cbMigrateGlobalFallbackUrl(groups, globalSettings) {
  if (!globalSettings || typeof globalSettings !== "object") return;
  if (!Object.prototype.hasOwnProperty.call(globalSettings, "defaultFallbackUrl")) return;
  const inherited = typeof globalSettings.defaultFallbackUrl === "string" ? globalSettings.defaultFallbackUrl.trim() : "";
  let touched = false;
  if (inherited && inherited !== "about:blank") {
    for (const group of groups) {
      if (group.groupType === "custom" || group.fallbackUrl) continue;
      group.fallbackUrl = inherited;
      touched = true;
    }
  }
  const { defaultFallbackUrl, ...rest } = globalSettings;
  const writes = { [CB_GLOBAL_SETTINGS_KEY]: rest };
  if (touched) writes[BLOCKED_GROUPS_KEY] = groups;
  try { await chrome.storage.local.set(writes); } catch (_) {}
}

async function loadStoredState() {
  const now = Date.now();
  const result = await chrome.storage.local.get({
    [BLOCKED_GROUPS_KEY]: [],
    [USAGE_TIMERS_KEY]: {},
    [USAGE_RESET_AT_KEY]: {},
    [USAGE_BUCKETS_KEY]: {},
    [GROUP_SNOOZES_KEY]: {},
    [GROUP_SNOOZE_TOTALS_KEY]: {},
    [CB_GLOBAL_SETTINGS_KEY]: null
  });

  const groups = sanitizeGroups(result[BLOCKED_GROUPS_KEY]);
  await cbMigrateGlobalFallbackUrl(groups, result[CB_GLOBAL_SETTINGS_KEY]);

  return {
    groups,
    usageTimersMs: sanitizeUsageTimers(result[USAGE_TIMERS_KEY], groups),
    usageResetAtMs: sanitizeResetTimes(result[USAGE_RESET_AT_KEY], groups, now),
    usageBucketsMs: sanitizeUsageBuckets(result[USAGE_BUCKETS_KEY], groups),
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
  now,
  usageBucketsMs = {}
) {
  const nextGroups = [...groups];
  const nextTimers = { ...usageTimersMs };
  const nextResetAt = { ...usageResetAtMs };
  const nextBuckets = { ...usageBucketsMs };
  const nextSnoozes = { ...groupSnoozes };
  const nextSnoozeTotals = { ...groupSnoozeTotalsMs };
  let changed = false;

  for (const group of groups) {
    if (!nextResetAt[group.id]) {
      nextResetAt[group.id] = now;
      changed = true;
    }
    if (!isTimedBlockingMode(group.mode)) continue;
    if (group.rollingLimit) {
      // Rolling limit: the timer is the total still inside the window.
      const pruned = cbPruneUsageBuckets(nextBuckets[group.id], group, now);
      const used = cbBucketsUsedMs(pruned);
      if (JSON.stringify(pruned) !== JSON.stringify(nextBuckets[group.id] ?? {})) {
        nextBuckets[group.id] = pruned;
        changed = true;
      }
      if ((Number(nextTimers[group.id]) || 0) !== used) {
        nextTimers[group.id] = used;
        changed = true;
      }
      continue;
    }
    // A linked group's period belongs to the hub (the Mac side): it resets
    // there and this endpoint adopts the reset total (applySharedToStorage).
    // With no hub reachable the group is on its own and resets here.
    if (cbGroupLinkedToHub(group)) continue;
    const periodStart = cbPeriodStartMs(nextResetAt[group.id], group, now);
    if (periodStart === nextResetAt[group.id]) continue;
    nextTimers[group.id] = 0;
    nextResetAt[group.id] = periodStart;
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
    usageBucketsMs: nextBuckets,
    groupSnoozes: nextSnoozes,
    groupSnoozeTotalsMs: nextSnoozeTotals,
    changed
  };
}

// Tagging schedule (owner idea, 2026-09-23): the classifier is only asked to tag
// a platform while a tag filter for it is active — i.e. some enabled, un-snoozed
// group of that site whose schedule window is open has a tag filter. Reuses
// the feed-filter builder so "active" means exactly what blocking means.
globalThis.cbHasActiveTagFilter = async function cbHasActiveTagFilter(platform, now = Date.now()) {
  if (typeof platform !== "string" || !platform) return false;
  const { groups, usageTimersMs, groupSnoozes } = await getState();
  const pageContext = { hostname: "", videoSite: platform, isRedditPage: platform === "reddit" };
  return buildPlatformFeedFilters(pageContext, groups, usageTimersMs, groupSnoozes, now)
    .some((filter) => filter && filter.tagFilter);
};

async function getState() {
  const baseState = await loadStoredState();
  const normalized = applyRuntimeNormalizations(
    baseState.groups,
    baseState.usageTimersMs,
    baseState.usageResetAtMs,
    baseState.groupSnoozes,
    baseState.groupSnoozeTotalsMs,
    Date.now(),
    baseState.usageBucketsMs
  );

  if (normalized.changed) {
    await chrome.storage.local.set({
      [BLOCKED_GROUPS_KEY]: normalized.groups,
      [USAGE_TIMERS_KEY]: normalized.usageTimersMs,
      [USAGE_RESET_AT_KEY]: normalized.usageResetAtMs,
      [USAGE_BUCKETS_KEY]: normalized.usageBucketsMs,
      [GROUP_SNOOZES_KEY]: normalized.groupSnoozes,
      [GROUP_SNOOZE_TOTALS_KEY]: normalized.groupSnoozeTotalsMs
    });
  }

  return {
    groups: normalized.groups,
    usageTimersMs: normalized.usageTimersMs,
    usageResetAtMs: normalized.usageResetAtMs,
    usageBucketsMs: normalized.usageBucketsMs,
    groupSnoozes: normalized.groupSnoozes,
    groupSnoozeTotalsMs: normalized.groupSnoozeTotalsMs,
    didApplyResets: normalized.changed
  };
}

// Whether a platform group should actually hide matched content right now
// (vs. merely measuring exposure for its usage timer): instant always blocks,
// "after-minutes" only after its allowance is spent.
function isPlatformBlockEnforcing(group, usageTimersMs) {
  if (group.mode === "instant") return true;
  return (usageTimersMs[group.id] ?? 0) >= getAllowedMs(group);
}

// Emit a tagged "items" line as a SEPARATE feed-filter entry (own id + effect
// from the line's action), independent of the source axis. Works for any
// platform whose feed cards carry classifier tags. A tagged "pages" line with
// the same filter turns into the entry's pageEffect, which content.js applies
// to the page's own entry. content.js matchesFeedFilter does the tag matching.
function cbSameTagFilter(a, b) {
  if (!a || !b) return false;
  return a.mode === b.mode
    && a.defaultConfidence === b.defaultConfidence
    && Boolean(a.blockUntagged) === Boolean(b.blockUntagged)
    && JSON.stringify(a.tags) === JSON.stringify(b.tags);
}

// One feed-filter entry per items line. content.js keys card verdicts by this
// id and resolves priority from the group part (before the separator).
function cbFeedFilterId(group, line) {
  return `${group.id}␟${line.id}`;
}

function pushTagFilterEntry(filters, group, line, enforce) {
  const tagFilter = line?.tagFilter;
  if (!tagFilter) return;
  // Only where tagging exists (see TAGGING_PLATFORMS): elsewhere a tag line is
  // inert — kept for linked devices that can tag, never enforced here.
  if (!isTaggingPlatform(line.platform) || !taggingAvailableFor(cbDetectProgramId())) return;
  const tagMode = normalizeTagFilterMode(tagFilter.mode);
  if (tagMode !== "include" && tagMode !== "exclude") return;
  const tagList = normalizeTagList(tagFilter.tags);
  // A block-list with nothing to block is inert — unless it blocks untagged content.
  const hasBlockingEntry = tagList.some((entry) => !entry.except);
  if (tagMode === "include" && !hasBlockingEntry && !tagFilter.blockUntagged) return;
  const pagesLine = (Array.isArray(group.scopes) ? group.scopes : []).find(
    (candidate) => candidate.surface === "pages" && candidate.platform === line.platform
      && candidate.tagFilter && cbSameTagFilter(candidate.tagFilter, tagFilter)
  );
  filters.push({
    id: cbFeedFilterId(group, line),
    baseGroupId: group.id,
    site: line.platform,
    tagFilter: {
      mode: tagMode,
      tags: tagList,
      defaultConfidence: clampTagConfidence(tagFilter.defaultConfidence, 4),
      blockUntagged: Boolean(tagFilter.blockUntagged)
    },
    effectVerdict: line.action === "hide" ? "hide" : "dim",
    // content.js evaluates the page's own entry against this same filter.
    pageEffect: pagesLine ? "block" : "allow",
    tagCoverUntilTagged: tagFilter.coverUntilTagged === true,
    enforce
  });
}

function buildPlatformFeedFilters(pageContext, groups, usageTimersMs, groupSnoozes, now) {
  const filters = [];
  const currentSite = pageContext.videoSite || getPlatformGroupTypeForHost(pageContext.hostname);
  const kind = currentSite ? CBGroupScopes.platformKind(currentSite) : null;
  const onReddit = Boolean(pageContext.isRedditPage);
  if (!currentSite && !onReddit) return filters;

  for (const group of groups) {
    if (!cbGroupActive(group, groupSnoozes, now)) continue;
    const lines = Array.isArray(group.scopes) ? group.scopes : [];
    // A group may name several platforms; only its lines for THIS page's
    // platform apply. Reddit pages carry no videoSite; every other platform
    // is keyed by host.
    const itemLines = lines.filter(
      (line) => line.surface === "items" && (onReddit ? line.platform === "reddit" : line.platform === currentSite)
    );
    if (itemLines.length === 0) continue;
    // `enforce` decides whether matched cards are actually hidden (the one
    // gate every line uses); a timed group not yet spent still reports
    // exposure so its allowance runs.
    const enforce = cbGroupEnforcing(group, usageTimersMs, groupSnoozes, now);
    for (const line of itemLines) {
      const platform = line.platform;
      if (line.tagFilter) {
        // Content-tag line: independent of the source axis. Applies regardless.
        pushTagFilterEntry(filters, group, line, enforce);
        continue;
      }
      const authorMode = normalizeSourceMode(line.sourceMode, line.sources);
      const lineKind = CBGroupScopes.platformKind(platform);
      if (lineKind === "video") {
        // Video platforms: "all" hides every card too; include/exclude trim by author.
        if (authorMode === "all" || authorMode === "include" || authorMode === "exclude") {
          filters.push({
            id: cbFeedFilterId(group, line),
            baseGroupId: group.id,
            site: platform,
            videoMode: normalizeVideoMode(line.form),
            authorMode,
            authors: [...line.sources],
            enforce
          });
        }
      } else if (authorMode === "include" || authorMode === "exclude") {
        // Reddit and feed platforms: "all" blocks the page (matcher) and
        // "nobody" blocks nothing; only include/exclude trim individual cards.
        filters.push({
          id: cbFeedFilterId(group, line),
          baseGroupId: group.id,
          site: platform,
          authorMode,
          authors: [...line.sources],
          enforce
        });
      }
    }
  }

  return filters;
}

// Collects the "hide elements" (shelf) CSS selectors contributed by every
// active platform group's shelf lines on the current host. These are
// independent of the coarse blocking predicate — a group can hide the Shorts
// button or promoted posts without blocking the page.
function buildSurfaceHideSelectors(pageContext, groups, usageTimersMs, groupSnoozes, now) {
  const selectors = new Set();
  for (const group of groups) {
    const shelves = (Array.isArray(group.scopes) ? group.scopes : []).filter(
      (line) => line.surface === "shelf" && line.shelf && isPlatformHost(line.platform, pageContext.hostname)
    );
    if (shelves.length === 0) continue;
    // The one gate: a timed group hides shelves only once its allowance is spent.
    if (!cbGroupEnforcing(group, usageTimersMs, groupSnoozes, now)) continue;
    // A group may carry shelf lines for several platforms; only this host's apply.
    const byPlatform = new Map();
    for (const line of shelves) {
      if (!byPlatform.has(line.platform)) byPlatform.set(line.platform, []);
      byPlatform.get(line.platform).push(line.shelf);
    }
    for (const [platform, ids] of byPlatform) {
      // App-scoped hides (site chrome / content types) apply whenever the group
      // is active on the host.
      for (const sel of getSurfaceHideSelectors(platform, ids, "app")) {
        selectors.add(sel);
      }

      // Entry-scoped hides (e.g. YouTube comments) are tied to a targeted entry,
      // so only emit them when the current page matches the group's source
      // scope on this platform.
      const entrySelectors = getSurfaceHideSelectors(platform, ids, "entry");
      if (entrySelectors.length > 0 && platformGroupAuthorAxisMatchesPage(cbGroupSourceAxisView(group, platform), pageContext)) {
        for (const sel of entrySelectors) selectors.add(sel);
      }
    }
  }
  return [...selectors];
}

// Timed groups the user is currently "exposed" to via feed content (reported
// by content.js) but that aren't matched at the page level. Used so the home
// feed accrues time and shows its countdown overlay without covering the
// whole page.
function getExposedTimedGroups(exposedGroupIds, groups, relevantGroups, groupSnoozes, now) {
  if (!Array.isArray(exposedGroupIds) || exposedGroupIds.length === 0) return [];
  const exposed = new Set(exposedGroupIds);
  const alreadyRelevant = new Set(relevantGroups.map((group) => group.id));
  return groups.filter(
    (group) =>
      exposed.has(group.id) &&
      !alreadyRelevant.has(group.id) &&
      isTimedBlockingMode(group.mode) &&
      group.enabled &&
      isGroupActiveNow(group, now) &&
      !getActiveSnooze(group.id, groupSnoozes, now)
  );
}

function buildPageSession(
  pageContext,
  groups,
  usageTimersMs,
  usageResetAtMs,
  groupSnoozes,
  now,
  exposedGroupIds = [],
  passedGroupIds = new Set()
) {
  const relevantGroups = getRelevantGroupsForPage(pageContext, groups, groupSnoozes, now);
  const relevantTimedItems = buildTimedItems(relevantGroups, usageTimersMs, usageResetAtMs, now);
  const exposedGroups = getExposedTimedGroups(
    exposedGroupIds,
    groups,
    relevantGroups,
    groupSnoozes,
    now
  );
  const exposedTimedItems = buildTimedItems(exposedGroups, usageTimersMs, usageResetAtMs, now);
  const timedItems = relevantTimedItems.concat(exposedTimedItems);
  const feedFilters = buildPlatformFeedFilters(
    pageContext,
    groups,
    usageTimersMs,
    groupSnoozes,
    now
  );
  const surfaceHides = buildSurfaceHideSelectors(pageContext, groups, usageTimersMs, groupSnoozes, now);
  const lead = cbPageLead(pageContext, groups, usageTimersMs, groupSnoozes, now, passedGroupIds);
  const exit = lead ? cbLeadExit(lead, pageContext, groupSnoozes, now) : null;

  return {
    showTimer: !exit && timedItems.length > 0,
    shouldExitPage: Boolean(exit),
    items: timedItems,
    feedFilters,
    surfaceHides,
    feedOrder: buildFeedOrder(groups),
    exit,
    now
  };
}

// The page decision (owner 2026-09-26). Blocking is the union of every group,
// and the groups are walked from the top of the list: the first one that
// blocks this page decides everything about how it looks (cover, message,
// pause, Snooze, redirect). A pause that this tab has passed for THAT group
// lets the walk go on, so the next group down decides, or nothing does.
function cbPageLead(pageContext, groups, usageTimersMs, groupSnoozes, now, passedGroupIds = new Set()) {
  if (!pageContext.hostname) return null;
  for (const group of groups) {
    if (!cbGroupEnforcing(group, usageTimersMs, groupSnoozes, now)) continue;
    if (!cbGroupBlocksPage(group, pageContext)) continue;
    if (passedGroupIds.has(group.id) && cbGroupPageAction(group, pageContext) === "pause") continue;
    return group;
  }
  return null;
}

// How the lead group's block looks: its pause countdown, or its field — an
// address sends the tab there, any other text shows on the cover. A pause
// never redirects (it lets the page through after the countdown).
function cbLeadExit(lead, pageContext, groupSnoozes, now) {
  const pause = cbGroupPageAction(lead, pageContext) === "pause";
  const field = cbBlockExit(typeof lead.fallbackUrl === "string" ? lead.fallbackUrl : "");
  return {
    action: pause ? "pause" : field.navigate ? "navigate" : "cover",
    target: pause ? "" : field.navigate,
    message: field.message,
    groupId: lead.id,
    groupName: lead.name,
    pauseSeconds: lead.pauseSeconds ?? DEFAULT_PAUSE_SECONDS,
    allowSnooze: lead.groupType !== "custom" && lead.allowSnooze !== false,
    snoozeConfirmations: lead.snoozeConfirmations ?? DEFAULT_SNOOZE_CONFIRMATIONS,
    snoozePhase: getSnoozePhase(groupSnoozes[lead.id], now)
  };
}

// The page action of a group on this page: "block" when any of its matching
// site / pages / home lines blocks, "pause" when they all pause.
function cbGroupPageAction(group, pageContext) {
  const lines = Array.isArray(group?.scopes) ? group.scopes : [];
  let sawPause = false;
  for (const line of lines) {
    if (line.surface !== "site" && line.surface !== "pages" && line.surface !== "home") continue;
    if (!cbLineMatchesPage(group, line, pageContext)) continue;
    if (line.action !== "pause") return "block";
    sawPause = true;
  }
  return sawPause ? "pause" : "block";
}

// Group priority + effect for the content-side cascade. Order is the group's
// list position (index 0 = top of the list = highest priority, "first wins").
// Normal groups only block; exceptions are written as custom rules (allow()).
function buildFeedOrder(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.map((group) => ({ id: group.id }));
}

async function scheduleNextTransitionAlarm(groups, usageResetAtMs, groupSnoozes, now, usageBucketsMs = {}) {
  const candidateTimes = [];

  for (const group of groups) {
    if (!isTimedBlockingMode(group.mode)) continue;
    const next = group.rollingLimit
      ? cbNextReturnMs(usageBucketsMs[group.id], group, now)
      : cbNextResetMs(cbPeriodStartMs(usageResetAtMs[group.id] ?? now, group, now), group, now);
    if (Number.isFinite(next) && next > now) candidateTimes.push(next);
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

    // Start one day back: a window that crosses midnight and began yesterday
    // still ends today.
    for (let offset = -1; offset <= 7; offset += 1) {
      const candidateDate = new Date(now);
      candidateDate.setHours(0, 0, 0, 0);
      candidateDate.setDate(candidateDate.getDate() + offset);
      if (!group.activeDays.includes(getDayNameForDate(candidateDate))) continue;

      for (const windowText of timeWindows) {
        const { startMinutes, endMinutes } = parseTimeWindowToMinutes(windowText);
        const startTime = new Date(candidateDate);
        startTime.setMinutes(startMinutes);
        const endTime = new Date(candidateDate);
        if (endMinutes < startMinutes) endTime.setDate(endTime.getDate() + 1);
        endTime.setMinutes(endMinutes);
        if (startTime.getTime() > now) candidateTimes.push(startTime.getTime());
        if (endTime.getTime() > now) candidateTimes.push(endTime.getTime());
      }
    }
  }

  // A pause pass ending re-covers the page it let through.
  for (const pass of cbPausePasses.values()) {
    if (pass?.until > now) candidateTimes.push(pass.until);
  }

  await chrome.alarms.clear(TRANSITION_ALARM_NAME);
  if (candidateTimes.length === 0) return;
  await chrome.alarms.create(TRANSITION_ALARM_NAME, { when: Math.min(...candidateTimes) });
}

async function syncBlockingRules() {
  const now = Date.now();
  const { groups, usageResetAtMs, usageBucketsMs, groupSnoozes } = await getState();
  await scheduleNextTransitionAlarm(groups, usageResetAtMs, groupSnoozes, now, usageBucketsMs);
}

async function applyElapsedTime(pageContextInput, elapsedMs, exposedGroupIdsInput, passedGroupIds = new Set()) {
  const pageContext = normalizePageContext(pageContextInput);
  const exposedGroupIds = Array.isArray(exposedGroupIdsInput)
    ? exposedGroupIdsInput.filter((id) => typeof id === "string")
    : [];
  if (!pageContext.hostname) {
    return {
      showTimer: false,
      shouldExitPage: false,
      items: [],
      feedFilters: [],
      exit: null,
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
    usageBucketsMs,
    groupSnoozes,
    didApplyResets
  } = await getState();

  if (didApplyResets) await syncBlockingRules();

  const relevantGroups = getRelevantGroupsForPage(pageContext, groups, groupSnoozes, now);
  const relevantTimedGroups = relevantGroups.filter((group) => isTimedBlockingMode(group.mode));
  // Platform groups also accrue while the user is "exposed" to targeted feed
  // content (reported by content.js), not only on fully page-matched pages.
  const exposedTimedGroups = getExposedTimedGroups(
    exposedGroupIds,
    groups,
    relevantGroups,
    groupSnoozes,
    now
  );
  const accrualGroups = relevantTimedGroups.concat(exposedTimedGroups);

  // A covered page is not time on the page: whatever covers it (an instant
  // group, a spent allowance, a pause not yet let through) no group's budget
  // runs, as if the tab were on about:blank. A pause already let through
  // covers nothing, so the other groups' budgets run there. (The content
  // script also sends no elapsed time while its cover is up, which catches
  // covers only the page knows about, like a custom rule's.)
  const current = buildPageSession(
    pageContext,
    groups,
    usageTimersMs,
    usageResetAtMs,
    groupSnoozes,
    now,
    exposedGroupIds,
    passedGroupIds
  );
  if (accrualGroups.length === 0 || current.exit) return current;

  const nextTimers = { ...usageTimersMs };
  const nextBuckets = { ...(usageBucketsMs ?? {}) };
  const bucketDeltas = {};
  let changed = false;
  let bucketsChanged = false;
  let reachedLimit = false;

  for (const group of accrualGroups) {
    const currentValue = nextTimers[group.id] ?? 0;
    const thresholdMs = getAllowedMs(group);
    // Several visible tabs of one group report the same seconds: a group's
    // budget counts each moment once, however many of its pages are showing.
    const accruedUntil = cbGroupAccruedUntilMs.get(group.id) || 0;
    const groupElapsedMs = Math.max(0, now - Math.max(now - boundedElapsedMs, accruedUntil));
    cbGroupAccruedUntilMs.set(group.id, Math.max(now, accruedUntil));
    let nextValue;
    if (group.rollingLimit) {
      // Rolling limit: book the time into this minute (capped at the allowance,
      // like the fixed budget); the timer is the total still inside the window.
      const room = Math.max(0, thresholdMs - currentValue);
      const added = Math.min(groupElapsedMs, room);
      const buckets = { ...(nextBuckets[group.id] ?? {}) };
      if (added > 0) {
        const minute = String(cbUsageBucketStartMs(now));
        buckets[minute] = (Number(buckets[minute]) || 0) + added;
        bucketDeltas[group.id] = { [minute]: added };
      }
      nextBuckets[group.id] = cbPruneUsageBuckets(buckets, group, now);
      bucketsChanged = true;
      nextValue = cbBucketsUsedMs(nextBuckets[group.id]);
    } else {
      nextValue = Math.min(currentValue + groupElapsedMs, thresholdMs);
    }
    if (nextValue !== currentValue) {
      nextTimers[group.id] = nextValue;
      changed = true;
    }
    if (nextValue >= thresholdMs) reachedLimit = true;
  }

  if (changed || bucketsChanged) {
    const writes = { [USAGE_TIMERS_KEY]: nextTimers };
    if (bucketsChanged) writes[USAGE_BUCKETS_KEY] = nextBuckets;
    await chrome.storage.local.set(writes);
    // Report accrual to the hub so clustered Default groups keep one shared
    // live budget even while this browser's popup is closed.
    cbReportClusterUsage(accrualGroups, nextTimers, usageResetAtMs, bucketDeltas, nextBuckets);
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
    now,
    exposedGroupIds,
    passedGroupIds
  );
}

async function getPageSession(pageContextInput, passedGroupIds = new Set()) {
  await waitForUsageTimerUpdates();

  const pageContext = normalizePageContext(pageContextInput);
  if (!pageContext.hostname) {
    return {
      showTimer: false,
      shouldExitPage: false,
      items: [],
      feedFilters: [],
      exit: null,
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
    now,
    [],
    passedGroupIds
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
  // Warm the custom-rule sandbox up front so the first block decision
  // doesn't pay the offscreen-creation + handshake cost inline.
  prewarmEventSandbox();
});

chrome.runtime.onStartup.addListener(() => {
  syncBlockingRules().catch((error) => {
    console.error("Failed to sync blocking rules on startup.", error);
  });
  prewarmEventSandbox();
});

chrome.action.onClicked.addListener(() => {
  openExtensionPage().catch((error) => {
    console.error("Failed to open extension page.", error);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TRANSITION_ALARM_NAME) return;
  // A schedule window, snooze, budget period or pause pass just changed:
  // re-check every open page too, not only the next navigation (a tab open
  // when a block window starts must get covered now).
  cbCoverStateReady
    .then(() => syncBlockingRules())
    .then(() => cbRecheckEnforcement())
    .catch((error) => {
      console.error("Failed to sync blocking rules after alarm.", error);
    });
});

// Activity log (browser feeders): drive the flush/settings-refresh alarm and
// receive watched-content records + config queries from the page script.
if (typeof cbActivity !== "undefined") {
  chrome.alarms.onAlarm.addListener((alarm) => { cbActivity.onAlarm(alarm); });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;
    if (message.kind === "vault-activity-watched") {
      cbActivity.recordWatched(message.record);
      return false;
    }
    if (message.kind === "vault-activity-config") {
      sendResponse({ "content-watched": !!cbActivity.enabled["content-watched"] });
      return false;
    }
    return false;
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "action-icon-color-scheme") {
    syncActionIconColorScheme(message.prefersDark === true)
      .then((ok) => sendResponse({ ok }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === "refresh-blocking-rules") {
    syncBlockingRules()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error("Failed to refresh blocking rules.", error);
        sendResponse({ ok: false });
      });
    return true;
  }

  // The cover (content.js) told us it covered or uncovered its page: mute the
  // whole tab under a cover (every sound source, frames included) and tell
  // every frame to pause its media; undo both on lift.
  if (message?.type === "cover-state") {
    const tabId = sender?.tab?.id ?? null;
    if (typeof tabId === "number") {
      cbSetTabCovered(tabId, message.covered === true)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
    sendResponse({ ok: false });
    return false;
  }

  // The pause countdown ended and the user chose Continue: let this tab
  // through on this host for a while.
  if (message?.type === "pause-pass") {
    const tabId = sender?.tab?.id ?? null;
    const host = hostnameOf(sender?.tab?.url || sender?.url || "");
    const groupId = typeof message.groupId === "string" ? message.groupId : "";
    if (typeof tabId === "number" && host && groupId) {
      cbCoverStateReady.then(() => {
        // Continue belongs to the group whose pause it was; the page is then
        // re-decided, so a group further down may still block it.
        cbPausePasses.set(cbPauseKey(tabId, groupId), { host, until: Date.now() + PAUSE_PASS_MS });
        cbSaveCoverState();
        sendResponse({ ok: true });
        // The pass's end is a transition: the alarm re-checks the open page
        // then; the recheck records the pass so its end reads as a change.
        syncBlockingRules().catch(() => {});
        cbScheduleRecheck();
      });
      return true;
    }
    sendResponse({ ok: false });
    return false;
  }

  // The floating "+" (content.js): is it on, and which group does it append to?
  if (message?.type === "quick-add-state") {
    cbQuickAddState()
      .then((state) => sendResponse(state))
      .catch(() => sendResponse({ enabled: false, groupId: "", groupName: "" }));
    return true;
  }

  // The floating "+" was clicked: append the sender's page to the chosen group.
  if (message?.type === "quick-add") {
    const url = sender?.tab?.url || sender?.url || "";
    cbQuickAdd(url)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: String(error && error.message ? error.message : error) }));
    return true;
  }

  // Snooze started from the cover's panel (the popup's flow without its
  // settings): same entry, same enforcement, shared with linked members.
  if (message?.type === "start-snooze") {
    cbStartSnooze(String(message.groupId || ""))
      .then((snooze) => sendResponse({ ok: true, snooze }))
      .catch((error) => sendResponse({ ok: false, error: String(error && error.message ? error.message : error) }));
    return true;
  }

  if (message?.type === "get-page-session") {
    const tabId = sender?.tab?.id ?? null;
    const tabUrl = sender?.tab?.url || sender?.url || "";
    cbCoverStateReady
      .then(() => getPageSession(message.pageContext ?? message.hostname, cbPausePassedGroups(tabId, hostnameOf(tabUrl))))
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
          exit: null,
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
    const heartbeatExposedIds = Array.isArray(message.exposedGroupIds)
      ? message.exposedGroupIds
      : [];
    queueUsageTimerUpdate(() =>
      cbCoverStateReady.then(() =>
        applyElapsedTime(message.pageContext ?? message.hostname, heartbeatElapsedMs, heartbeatExposedIds, cbPausePassedGroups(tabId, hostnameOf(tabUrl)))
      )
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
          exit: null,
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

// ── Quick add (the floating "+") ────────────────────────────────────────────
// Off by default. The user chooses the target group by its badge in the
// editor; the "+" on a page appends the page's most detailed site entry
// (host + path, never query or fragment) to that group's Websites entry.
const CB_QUICK_ADD_GROUP_KEY = "quickAddGroupId";

function cbQuickAddEntry(url) {
  try {
    const parsed = new URL(String(url || ""));
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    return normalizeSiteInput(parsed.hostname + parsed.pathname);
  } catch (_) {
    return null;
  }
}

async function cbQuickAddState() {
  const stored = await chrome.storage.local.get({ [CB_GLOBAL_SETTINGS_KEY]: {}, [CB_QUICK_ADD_GROUP_KEY]: "" });
  const enabled = stored[CB_GLOBAL_SETTINGS_KEY]?.quickAddEnabled === true;
  const groupId = typeof stored[CB_QUICK_ADD_GROUP_KEY] === "string" ? stored[CB_QUICK_ADD_GROUP_KEY] : "";
  if (!enabled || !groupId) return { enabled: false, groupId: "", groupName: "" };
  const { groups } = await getState();
  const group = groups.find((item) => item.id === groupId && item.groupType !== "custom");
  // "+" is an edit, and a locked group takes no edits (as in the editor), so
  // the button is hidden while its target is locked.
  if (!group || cbGroupIsLocked(group)) return { enabled: false, groupId: "", groupName: "" };
  return { enabled: true, groupId: group.id, groupName: group.name };
}

async function cbQuickAdd(url) {
  const target = await cbQuickAddState();
  if (!target.enabled) throw new Error("quick-add-off");
  const entry = cbQuickAddEntry(url);
  if (!entry) throw new Error("not-a-web-page");
  const { groups } = await getState();
  const index = groups.findIndex((item) => item.id === target.groupId);
  if (index < 0) throw new Error("group-not-found");
  const group = groups[index];
  const scopes = Array.isArray(group.scopes) ? group.scopes.map((line) => ({ ...line })) : [];
  let line = scopes.find((candidate) => candidate.surface === "site");
  if (!line) {
    line = { surface: "site", platform: null, action: "block", sites: [], sitesExcept: false };
    scopes.push(line);
  }
  // "+" just adds an entry to the list, whatever kind of list it is.
  const sites = Array.isArray(line.sites) ? [...line.sites] : [];
  const added = !sites.includes(entry);
  if (!added) return { entry, added, groupName: group.name };
  sites.push(entry);
  line.sites = sites;
  const [next] = sanitizeGroups([{ ...group, scopes }]);
  const nextGroups = groups.map((item, at) => (at === index ? next : item));
  await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: nextGroups });
  await syncBlockingRules();
  // Linked members get the change now, as the whole definition (sending only
  // the lines left the hub with no settings for this member, which let an
  // older lock win the freeze merge).
  cbShareGroupChange(nextGroups, next);
  return { entry, added, groupName: next.name };
}

// ── In-place cover support ──────────────────────────────────────────────────
// "<tabId>␟<groupId>" -> { host, until }: a group's pause this tab passed
// (Continue), on that host, for a while. Other groups still decide.
const cbPausePasses = new Map();
// Tabs this extension muted for a cover (never unmute a tab the user muted).
const cbMutedTabs = new Set();
// Chrome stops an idle worker while a covered or passed tab sits in the
// background; both maps are mirrored to session storage so a new worker still
// honours the pass and still unmutes the tab when its cover lifts. Handlers
// that read them wait for this.
const CB_COVER_STATE_KEY = "cbCoverState";
const cbCoverStateReady = (async () => {
  try {
    if (!chrome.storage?.session) return;
    const stored = (await chrome.storage.session.get(CB_COVER_STATE_KEY))?.[CB_COVER_STATE_KEY];
    const now = Date.now();
    for (const [key, pass] of Array.isArray(stored?.passes) ? stored.passes : []) {
      if (typeof key === "string" && pass && pass.until > now && !cbPausePasses.has(key)) cbPausePasses.set(key, pass);
    }
    for (const tabId of Array.isArray(stored?.muted) ? stored.muted : []) cbMutedTabs.add(Number(tabId));
  } catch (_) {}
})();

function cbSaveCoverState() {
  try {
    if (!chrome.storage?.session) return;
    chrome.storage.session
      .set({ [CB_COVER_STATE_KEY]: { passes: [...cbPausePasses.entries()], muted: [...cbMutedTabs] } })
      .catch(() => {});
  } catch (_) {}
}

function cbPauseKey(tabId, groupId) {
  return `${tabId}␟${groupId}`;
}

// The groups whose pause this tab has passed on this host, right now.
function cbPausePassedGroups(tabId, hostname) {
  const passed = new Set();
  if (typeof tabId !== "number" || !hostname) return passed;
  const prefix = `${tabId}␟`;
  const now = Date.now();
  let expired = false;
  for (const [key, pass] of cbPausePasses) {
    if (!key.startsWith(prefix)) continue;
    if (!pass || pass.until <= now) { cbPausePasses.delete(key); expired = true; continue; }
    if (pass.host === hostname) passed.add(key.slice(prefix.length));
  }
  if (expired) cbSaveCoverState();
  return passed;
}

// Tabs whose page is covered right now (a covered page is not a visit).
const cbCoveredTabs = new Set();

async function cbSetTabCovered(tabId, covered) {
  await cbCoverStateReady;
  if (covered !== cbCoveredTabs.has(tabId)) {
    if (covered) cbCoveredTabs.add(tabId);
    else cbCoveredTabs.delete(tabId);
    try { if (typeof cbActivity !== "undefined") cbActivity.resolveActive("cover"); } catch (_) {}
  }
  try {
    if (covered) {
      const tab = await chrome.tabs.get(tabId);
      if (!tab?.mutedInfo?.muted) {
        await chrome.tabs.update(tabId, { muted: true });
        cbMutedTabs.add(tabId);
        cbSaveCoverState();
      }
    } else if (cbMutedTabs.has(tabId)) {
      cbMutedTabs.delete(tabId);
      cbSaveCoverState();
      await chrome.tabs.update(tabId, { muted: false });
    }
  } catch (_) {}
  // Every frame pauses (or may resume) its own media; cross-origin players
  // live in frames the top document cannot reach.
  try {
    await chrome.tabs.sendMessage(tabId, { type: "cover-media", paused: covered });
  } catch (_) {}
}

// The popup's snooze entry, built here for the cover's Snooze button. The
// cover runs the group's confirmation steps itself; the worker stores the
// entry, re-syncs blocking and shares it with linked members (newest start
// wins there, exactly like a snooze started in the popup).
async function cbStartSnooze(groupId, now = Date.now()) {
  const { groups, groupSnoozes } = await getState();
  const group = groups.find((item) => item.id === groupId);
  if (!group) throw new Error("group-not-found");
  if (group.groupType === "custom" || group.allowSnooze === false) throw new Error("snooze-disabled");
  if (getSnoozePhase(groupSnoozes[group.id], now) !== "none") throw new Error("snooze-in-progress");
  const startsAtMs = now + (group.snoozeActivationDelayMinutes ?? 0) * MS_PER_MINUTE;
  const untilMs = startsAtMs + group.snoozeMinutes * MS_PER_MINUTE;
  const entry = {
    startsAtMs,
    untilMs,
    cooldownUntilMs: untilMs + (group.snoozeCooldownMinutes ?? 0) * MS_PER_MINUTE,
    confirmationCount: group.snoozeConfirmations ?? DEFAULT_SNOOZE_CONFIRMATIONS,
    activeMsApplied: false,
    changedAtMs: now
  };
  const next = { ...groupSnoozes, [group.id]: entry };
  await chrome.storage.local.set({ [GROUP_SNOOZES_KEY]: next });
  await syncBlockingRules();
  try {
    cbConnection.sendWS({
      kind: "group-sync",
      program: cbDetectProgramId(),
      groupName: group.name,
      ts: now,
      snooze: entry,
      snoozeTs: entry.changedAtMs
    });
  } catch (_) {}
  return entry;
}
const pendingApplyByTab = new Map(); // tabId -> Array<applyMessage>
const PENDING_APPLY_MAX_PER_TAB = 32;

// chrome.storage.session is a TRUSTED_CONTEXTS-only key/value store that
// survives MV3 service-worker idle restarts but is cleared when the
// browser process exits. Mirroring previousTabUrls + pendingApplyByTab
// there lets us recover from a SW restart without dropping the
// "previous URL" memory used by webChangedEvent (sameDomain / isReload /
// previousHostname), and without losing apply messages that were queued for tabs
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

// Collection diagnostics never include page text, titles, creator identities,
// URLs, or entry IDs. They make the local collection hops inspectable in the
// existing extension Activity Log without creating browser-side browsing data.
function recordVaultClassifierDiagnostic(entry) {
  if (!entry || typeof entry !== "object") return;
  const event = typeof entry.event === "string" && /^[a-z0-9-]{1,64}$/.test(entry.event) ? entry.event : "invalid-event";
  const platform = typeof entry.platform === "string" && /^[a-z0-9-]{1,64}$/.test(entry.platform) ? entry.platform : "unknown";
  const detail = typeof entry.detail === "string" && /^[a-z0-9-]{1,64}$/.test(entry.detail) ? entry.detail : "";
  const outcome = typeof entry.outcome === "string" && /^[a-z0-9-]{1,32}$/.test(entry.outcome) ? entry.outcome : "unknown";
  const isFailure = event.endsWith("failed") || event.endsWith("rejected") || outcome === "unavailable" || outcome === "rejected";
  pushLogFeedEntry({
    level: isFailure ? "warn" : "log",
    eventType: "vault-collection",
    message: [platform, event, detail, outcome].filter(Boolean).join(" · ")
  });
}
self.CBRecordVaultClassifierDiagnostic = recordVaultClassifierDiagnostic;

// Transport diagnostics are deliberately local-only stage tokens. They help
// distinguish an unavailable native peer from a service-worker startup race or
// a missing shared connection without retaining page evidence or raw exception text.
function recordVaultClassifierTransportDiagnostic(stage, outcome = "extension") {
  if (typeof stage !== "string" || !/^[a-z0-9-]{1,48}$/.test(stage)) return;
  if (typeof outcome !== "string" || !/^[a-z0-9-]{1,32}$/.test(outcome)) return;
  recordVaultClassifierDiagnostic({
    platform: "bridge",
    event: `transport-${stage}`,
    outcome
  });
}
self.CBRecordVaultClassifierTransportDiagnostic = recordVaultClassifierTransportDiagnostic;

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

async function loadCustomGroupSource(group, { resetHostBlocks = false } = {}) {
  if (!group || group.groupType !== "custom") return null;
  if (resetHostBlocks) {
    await clearWindowBlockGroup(group.id);
  }
  if (!group.enabled) {
    await clearWindowBlockGroup(group.id);
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
    await clearWindowBlockGroup(group.id);
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
  const result = await sendToEventSandbox({ kind: "unload-group", groupId });
  await clearWindowBlockGroup(groupId);
  return result;
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
      await loadCustomGroupSource(group, { resetHostBlocks: true });
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
    await hydrateWindowBlockGroups();
  } catch (_) {}
  try {
    const result = await chrome.storage.local.get(BLOCKED_GROUPS_KEY);
    const groups = Array.isArray(result[BLOCKED_GROUPS_KEY]) ? result[BLOCKED_GROUPS_KEY] : [];
    await pruneWindowBlockGroups(new Set(
      groups.filter((group) => group && group.groupType === "custom").map((group) => String(group.id || ""))
    ));
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

// Cold-start mitigation. The first custom-rule block decision after a
// service-worker spawn otherwise pays the full warm-up cost inline:
// state hydration + offscreen-document creation + sandbox iframe handshake +
// rule recompile. Kicking ensureStartupGate() off proactively (browser
// launch, tab activation, navigation start) overlaps that cost with page
// load so the first evaluate-platform-items request finds the sandbox warm.
// It's memoized per SW lifetime and is a no-op when there are no custom
// groups (no offscreen document is created), so calling it liberally is cheap.
function prewarmEventSandbox() {
  try {
    ensureStartupGate().catch(() => {});
  } catch (_) {}
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
  // No URL normalization: rules receive the raw URL exactly as the browser
  // reports it (including chrome://newtab, about:blank, etc.). Any special
  // casing of new-tab / start pages has been intentionally removed.
  return typeof url === "string" ? url : "";
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
    broadcastSessionRefresh().catch((error) => {
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

// ── Push on change (owner 2026-09-25) ──────────────────────────────────────
// The worker keeps one small state — which groups enforce right now, their
// snooze phase, and the live pause passes — and asks open pages to re-check
// only when that state or a group's definition changes. Pages no longer
// re-ask on every storage write (usage is saved several times a second) nor
// poll while covered; the time tick only counts time. Elements stay the
// page's business: on a push it re-applies the rules to its own content.
let cbEnforcementSignature = null;
let cbRecheckTimer = null;
let cbRecheckDefinition = false;

// In effect right now: on, inside its schedule, not snoozed.
function cbGroupActive(group, groupSnoozes, now) {
  return Boolean(group) && group.enabled && isGroupActiveNow(group, now) && !getActiveSnooze(group.id, groupSnoozes, now);
}

// The one gate every line goes through (pages, feed cards, home, shelves):
// the group is in effect and blocks now — immediately, or once its allowance
// is spent. Custom groups decide in their own rule.
function cbGroupEnforcing(group, usageTimersMs, groupSnoozes, now) {
  if (!cbGroupActive(group, groupSnoozes, now)) return false;
  if (group.groupType === "custom") return true;
  return isPlatformBlockEnforcing(group, usageTimersMs);
}

function cbEnforcementState(groups, usageTimersMs, groupSnoozes, now) {
  return JSON.stringify({
    groups: groups.map((group) => [
      group.id,
      cbGroupEnforcing(group, usageTimersMs, groupSnoozes, now),
      getSnoozePhase(groupSnoozes[group.id], now)
    ]),
    passes: [...cbPausePasses.entries()].filter(([, pass]) => pass && pass.until > now).map(([key, pass]) => [key, pass.host])
  });
}

// Recomputes the state; pushes when it (or, with `definitionChanged`, a
// group's definition) changed. Returns whether it pushed.
async function cbRecheckEnforcement({ definitionChanged = false } = {}) {
  await cbCoverStateReady;
  const now = Date.now();
  const { groups, usageTimersMs, groupSnoozes } = await getState();
  const next = cbEnforcementState(groups, usageTimersMs, groupSnoozes, now);
  const changed = definitionChanged || next !== cbEnforcementSignature;
  cbEnforcementSignature = next;
  if (changed) await broadcastSessionRefresh();
  return changed;
}

// Coalesces a burst of inputs (several storage keys written together) into
// one recheck.
function cbScheduleRecheck({ definitionChanged = false } = {}) {
  if (definitionChanged) cbRecheckDefinition = true;
  if (cbRecheckTimer !== null) return;
  cbRecheckTimer = setTimeout(() => {
    const definition = cbRecheckDefinition;
    cbRecheckDefinition = false;
    cbRecheckTimer = null;
    cbRecheckEnforcement({ definitionChanged: definition }).catch(() => {});
  }, 50);
}

if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[BLOCKED_GROUPS_KEY] || changes[CB_GLOBAL_SETTINGS_KEY]) {
      cbScheduleRecheck({ definitionChanged: true });
    } else if (changes[USAGE_TIMERS_KEY] || changes[USAGE_RESET_AT_KEY] || changes[USAGE_BUCKETS_KEY] || changes[GROUP_SNOOZES_KEY]) {
      cbScheduleRecheck();
    }
  });
}

// Asks every open page to re-fetch its session (cover, timers, feed filters).
async function broadcastSessionRefresh() {
  if (!chrome.tabs || !chrome.tabs.query) return;
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab || typeof tab.id !== "number") return;
      const url = tab.url || tab.pendingUrl || "";
      if (url && !/^https?:/i.test(url)) return;
      await trySendApply(tab.id, { type: "session-refresh" });
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
  // Process window-level intents in the background (they require chrome.tabs).
  const windowIntents = intents.filter((i) => i && i.kind === "window");
  const contentIntents = intents.filter((i) => !i || i.kind !== "window");
  if (windowIntents.length > 0) {
    processWindowIntents(windowIntents, tabId).catch(() => {});
  }

  const message = {
    type: "event-sandbox-apply",
    descriptor,
    defaultPrevented: Boolean(result.defaultPrevented),
    result: result.result ?? null,
    redirectUrl: result.redirectUrl || "",
    domOps,
    intents: contentIntents,
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

// ────────────────────────────────────────────────────────────────────────
// Window helper: dynamic site blocklist + tab management
// ────────────────────────────────────────────────────────────────────────

const SESSION_WINDOW_BLOCKS_KEY = "__cb_window_blocks_by_group__";
const __windowBlockedSitesByGroup = new Map();
let windowBlockPersistChain = Promise.resolve();

function windowBlockSetForGroup(groupId, create = false) {
  const id = String(groupId || "");
  if (!id) return null;
  let set = __windowBlockedSitesByGroup.get(id) || null;
  if (!set && create) {
    set = new Set();
    __windowBlockedSitesByGroup.set(id, set);
  }
  return set;
}

async function persistWindowBlockGroups() {
  if (!chrome?.storage?.session?.set) return;
  const serialized = {};
  for (const [groupId, patterns] of __windowBlockedSitesByGroup.entries()) {
    if (patterns.size > 0) serialized[groupId] = Array.from(patterns);
  }
  windowBlockPersistChain = windowBlockPersistChain
    .catch(() => {})
    .then(() => chrome.storage.session.set({ [SESSION_WINDOW_BLOCKS_KEY]: serialized }));
  try { await windowBlockPersistChain; } catch (_) {}
}

async function hydrateWindowBlockGroups() {
  if (!chrome?.storage?.session?.get) return;
  try {
    const stored = await chrome.storage.session.get({ [SESSION_WINDOW_BLOCKS_KEY]: {} });
    const groups = stored[SESSION_WINDOW_BLOCKS_KEY];
    if (!groups || typeof groups !== "object") return;
    __windowBlockedSitesByGroup.clear();
    for (const [groupId, patterns] of Object.entries(groups)) {
      if (!Array.isArray(patterns)) continue;
      const set = new Set(
        patterns.map(windowBlocklistNormalize).filter(Boolean)
      );
      if (set.size > 0) __windowBlockedSitesByGroup.set(groupId, set);
    }
  } catch (_) {}
}

async function clearWindowBlockGroup(groupId) {
  if (!__windowBlockedSitesByGroup.delete(String(groupId || ""))) return;
  await persistWindowBlockGroups();
}

async function pruneWindowBlockGroups(validGroupIds) {
  let changed = false;
  for (const groupId of Array.from(__windowBlockedSitesByGroup.keys())) {
    if (!validGroupIds.has(groupId)) {
      __windowBlockedSitesByGroup.delete(groupId);
      changed = true;
    }
  }
  if (changed) await persistWindowBlockGroups();
}

function windowBlocklistNormalize(pattern) {
  let p = String(pattern || "").trim().toLowerCase();
  if (p.startsWith("http://")) p = p.slice(7);
  if (p.startsWith("https://")) p = p.slice(8);
  if (p.startsWith("www.")) p = p.slice(4);
  const slashIdx = p.indexOf("/");
  if (slashIdx > 0) p = p.slice(0, slashIdx);
  return p;
}

function windowBlocklistMatches(url) {
  if (__windowBlockedSitesByGroup.size === 0) return false;
  try {
    let hostname = new URL(url).hostname.toLowerCase();
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);
    for (const patterns of __windowBlockedSitesByGroup.values()) {
      for (const pattern of patterns) {
        if (hostname === pattern || hostname.endsWith("." + pattern)) return true;
      }
    }
  } catch {}
  return false;
}

async function processWindowIntents(intents, originTabId) {
  for (const intent of intents) {
    if (!intent) continue;
    switch (intent.action) {
      case "closeActiveTab":
        if (typeof originTabId === "number") {
          try { await chrome.tabs.remove(originTabId); } catch {}
        }
        break;
      case "closeTab":
        if (typeof intent.tabId === "number") {
          try { await chrome.tabs.remove(intent.tabId); } catch {}
        }
        break;
      case "closeTabByUrl": {
        const url = String(intent.url || "");
        if (!url) break;
        try {
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.url && tab.url.includes(url)) {
              await chrome.tabs.remove(tab.id);
            }
          }
        } catch {}
        break;
      }
      case "blockSite": {
        const groupId = String(intent.groupId || "");
        if (!groupId) break;
        const p = windowBlocklistNormalize(intent.pattern);
        if (p) {
          windowBlockSetForGroup(groupId, true).add(p);
          await persistWindowBlockGroups();
          await closeTabsMatchingBlocklist();
        }
        break;
      }
      case "unblockSite": {
        const groupId = String(intent.groupId || "");
        if (!groupId) break;
        const p = windowBlocklistNormalize(intent.pattern);
        const patterns = windowBlockSetForGroup(groupId);
        if (patterns) {
          patterns.delete(p);
          if (patterns.size === 0) __windowBlockedSitesByGroup.delete(groupId);
          await persistWindowBlockGroups();
        }
        break;
      }
    }
  }
}

async function closeTabsMatchingBlocklist() {
  if (__windowBlockedSitesByGroup.size === 0) return;
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && windowBlocklistMatches(tab.url)) {
        try { await chrome.tabs.remove(tab.id); } catch {}
      }
    }
  } catch {}
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
    cbCoveredTabs.delete(tabId);
    let dropped = cbMutedTabs.delete(tabId);
    for (const key of [...cbPausePasses.keys()]) {
      if (key.startsWith(`${tabId}␟`)) { cbPausePasses.delete(key); dropped = true; }
    }
    if (dropped) cbSaveCoverState();
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

// Pre-warm the sandbox the moment the user engages a tab. onActivated is the
// key case: returning to an already-open platform tab after the SW was evicted
// fires no navigation event, so without this the first scroll would cold-start
// the sandbox inline. onUpdated (loading) overlaps warm-up with page load for
// fresh navigations. Both are cheap — ensureStartupGate() is memoized.
if (chrome.tabs && chrome.tabs.onActivated) {
  chrome.tabs.onActivated.addListener(() => {
    prewarmEventSandbox();
  });
}

if (chrome.tabs && chrome.tabs.onUpdated) {
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo && changeInfo.status === "loading") {
      prewarmEventSandbox();
    }
  });
}

async function handleCommittedWebNavigation(details, transition = "commit") {
  if (!details || details.frameId !== 0) return;
  const tabId = details.tabId;
  if (typeof tabId !== "number" || tabId < 0) return;

  // Chokepoint: close tab immediately if navigating to a dynamically blocked site.
  if (details.url && windowBlocklistMatches(details.url)) {
    try { await chrome.tabs.remove(tabId); } catch {}
    return;
  }
  const previous = previousTabUrls.get(tabId);
  const previousUrl = previous?.url || null;
  const previousHost = previous?.hostname || "";
  const nextUrl = details.url || "";
  const nextHost = hostnameOf(nextUrl);

  // In-page (SPA / history API) navigations fire onHistoryStateUpdated rather
  // than onCommitted — this is how single-page apps like YouTube move between
  // e.g. the home feed and a /shorts/ player without a full document load.
  // Skip no-op history replaces (identical URL) so frequent replaceState calls
  // don't spam webChangedEvent; genuine reloads still arrive via onCommitted.
  if (transition === "history" && previous && previousUrl === nextUrl) return;

  previousTabUrls.set(tabId, { url: nextUrl, hostname: nextHost });
  scheduleSessionFlush();

  const isFirstLoad = !previous;
  const isReload = !!previous && previousUrl === nextUrl;
  const sameDomain = !!previousHost && previousHost === nextHost;

  // webChangedEvent is emitted once per accepted navigation record — full
  // document loads (transition "commit") AND in-page history updates
  // (transition "history"). It carries everything a rule needs to classify
  // the navigation: previousUrl/previousHostname plus isFirstLoad, isReload,
  // and sameDomain, so same-tab URL changes and cross-domain hops are derived
  // in-rule rather than dispatched as separate switch events.
  // openWebEvent is reserved for actual tab creation; closeWebEvent for close.
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
        transition
      }
    }
  );
}

if (chrome.webNavigation && chrome.webNavigation.onCommitted) {
  chrome.webNavigation.onCommitted.addListener((details) => {
    handleCommittedWebNavigation(details, "commit").catch((error) => {
      try { console.warn("[CustomBlocker] committed navigation dispatch failed", error); } catch (_) {}
    });
  });
}

// In-page navigations (history.pushState/replaceState) — required so SPA route
// changes (e.g. YouTube home → /shorts/...) emit webChangedEvent too.
if (chrome.webNavigation && chrome.webNavigation.onHistoryStateUpdated) {
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    handleCommittedWebNavigation(details, "history").catch((error) => {
      try { console.warn("[CustomBlocker] history navigation dispatch failed", error); } catch (_) {}
    });
  });
}

// Early redirect: before a top-level navigation is sent, ask the SAME page
// decision the page itself gets (cbPageLead). Only when it says "send the tab
// to this address" does the tab leave before anything paints; a cover or a
// pause lets the page load and the content script shows it on arrival. A
// decision that needs the page (a creator, a tag) is simply made on arrival.
if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (!details || details.frameId !== 0) return;
    const url = String(details.url || "");
    if (!/^https?:/i.test(url)) return;
    cbEarlyRedirect(details.tabId, url).catch(() => {});
  });
}

async function cbEarlyRedirect(tabId, url) {
  await cbCoverStateReady;
  const hostname = hostnameOf(url);
  let pathname = "/";
  try { pathname = new URL(url).pathname; } catch {}
  const pageContext = normalizePageContext({ url, hostname, pathname });
  const now = Date.now();
  const { groups, usageTimersMs, groupSnoozes } = await getState();
  const lead = cbPageLead(pageContext, groups, usageTimersMs, groupSnoozes, now, cbPausePassedGroups(tabId, hostname));
  const target = lead ? cbLeadExit(lead, pageContext, groupSnoozes, now).target : "";
  if (target) await chrome.tabs.update(tabId, { url: target });
  return target;
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
      const loadResult = await loadCustomGroupSource(next, { resetHostBlocks: true });
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
      const items = Array.isArray(message.items) ? message.items : [];
      const r = await sendToEventSandbox({
        kind: "evaluate-platform-items",
        platform: message.platform,
        slot: message.slot,
        items
      });
      sendResponse({
        ok: Boolean(r && r.ok),
        results: r && Array.isArray(r.results) ? r.results : [],
        evaluatedGroups: r && Array.isArray(r.evaluatedGroups) ? r.evaluatedGroups : []
      });
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

/* ------------------------------------------------------------------ *
 * Web-app bridge — extension WebSocket client.
 *
 * The extension keeps one automatic outbound socket to the fixed local Vault
 * hub. Group-sync is routed whenever Mac Vault is present, while classifier
 * requests are routed whenever Vault Classifier is present; both products
 * share this one socket. It keeps a live status that the popup reads
 * via the "connection-status" message (and live "connection-status-push"
 * broadcasts while the popup is open).
 *
 * WebSocket activity keeps the MV3 service worker alive (Chrome 116+), so
 * the connection survives popup open/close. We also send a periodic ping.
 * ------------------------------------------------------------------ */
const CB_CONNECTION_PROTOCOL_VERSION = self.CBBridgeProtocol.PROTOCOL_VERSION;
// Environment-specific local address for the authenticated Vault hub. Unknown
// extension identities fail closed rather than joining production.
const CB_FIXED_ADDRESS = self.CBLocalHubEnvironment?.current?.address || "";
const CB_CONNECTION_PING_MS = 20_000;
// Four-state connection model (matches the UI):
//   connecting   – actively probing; rapid burst every 100ms for a 5s window.
//   disconnected – burst window elapsed without success; keep probing slowly
//                  (every 5s) because the user still WANTS to connect.
//   connected    – live socket.
//   off          – transport has not started or is shutting down with the worker.
const CB_CONNECTION_BURST_INTERVAL_MS = 100;
const CB_CONNECTION_BURST_WINDOW_MS = 5_000;
const CB_CONNECTION_SLOW_INTERVAL_MS = 5_000;

// ── Changes made outside the editor (owner 2026-09-26) ─────────────────────
// The AI tools get exactly what a user gets — the same actions and the same
// view, no more and no less. So a tool never sees the parental PIN's stored
// hash, names stay unique as in the editor, and a tool's (or quick add's)
// change reaches linked devices exactly like an editor save: the roster, then
// the group's whole definition.
function cbPublicGroup(group) {
  if (!group || typeof group !== "object") return group;
  const { parentalPasswordHash, parentalPasswordSalt, ...rest } = group;
  return { ...rest, hasParentalPin: Boolean(parentalPasswordHash) };
}

function cbNameTaken(groups, name, exceptId) {
  const key = String(name || "").trim().toLowerCase();
  return Boolean(key) && groups.some((group) => group.id !== exceptId && String(group.name || "").trim().toLowerCase() === key);
}

// An edit that changes how a budget runs restarts it, as the editor's save
// does (popup modeChanged / resetIntervalChanged): same edit, same result.
async function cbRestartBudgetOnPolicyChange(before, after) {
  if (!isTimedBlockingMode(after.mode)) return;
  const periodChanged = after.groupType !== "custom" && (
    before.resetIntervalHours !== after.resetIntervalHours ||
    (before.resetAtMidnight === true) !== (after.resetAtMidnight === true) ||
    (before.rollingLimit === true) !== (after.rollingLimit === true));
  if (before.mode === after.mode && !periodChanged) return;
  const stored = await chrome.storage.local.get([USAGE_TIMERS_KEY, USAGE_RESET_AT_KEY, USAGE_BUCKETS_KEY]);
  const timers = { ...(stored[USAGE_TIMERS_KEY] || {}) };
  const resets = { ...(stored[USAGE_RESET_AT_KEY] || {}) };
  const buckets = { ...(stored[USAGE_BUCKETS_KEY] || {}) };
  timers[after.id] = 0;
  resets[after.id] = Date.now();
  delete buckets[after.id];
  await chrome.storage.local.set({ [USAGE_TIMERS_KEY]: timers, [USAGE_RESET_AT_KEY]: resets, [USAGE_BUCKETS_KEY]: buckets });
}

async function cbAnnounceStoredGroups(groups) {
  const list = Array.isArray(groups) ? groups : (await getState()).groups;
  cbConnection.lastAnnounce = {
    kind: "groups-announce",
    program: cbDetectProgramId(),
    groups: list.map((group) => ({ id: group.id, name: group.name, frozen: cbGroupIsLocked(group) }))
  };
  if (cbConnection.routeIsReady("macapp")) cbConnection.sendWS(cbConnection.lastAnnounce);
}

function cbShareGroupChange(groups, group) {
  try {
    cbAnnounceStoredGroups(groups).catch(() => {});
    if (!group || !cbConnection.routeIsReady("macapp")) return;
    const scalars = {};
    for (const field of CB_SYNC_SCALAR_FIELDS) scalars[field] = group[field];
    cbConnection.sendWS({
      kind: "group-sync",
      program: cbDetectProgramId(),
      groupName: group.name,
      ts: Date.now(),
      scalars,
      scopes: group.scopes
    });
  } catch (_) {}
}

// Scalar settings linked groups share (one list, in group-scopes.js).
const CB_SYNC_SCALAR_FIELDS = CBGroupScopes.SYNC_SCALAR_FIELDS;

function cbDetectProgramId() {
  let ua = "";
  try {
    ua = (self.navigator && self.navigator.userAgent) || "";
  } catch (_) {}
  if (/\bEdg\//.test(ua)) return "edge";
  if (/\bFirefox\//.test(ua)) return "firefox";
  if (/\bOPR\//.test(ua) || /\bOpera\//.test(ua)) return "opera";
  if (/\bChrome\//.test(ua)) return "chrome";
  if (/\bSafari\//.test(ua)) return "safari";
  return "browser";
}

// Per-group baseline (the last absolute local usage we reported or folded) so we
// can report ONLY this endpoint's own accrual as a positive delta. It must be
// rebased to the hub's shared total whenever we fold that total into local
// storage (see applySharedToStorage), otherwise another member's contribution
// would be re-reported as ours and double-count.
const cbClusterUsageBaseline = {};

// True while `group` is in a cluster and the hub (hosted by the Mac app) is
// reachable: the hub then owns the shared budget and its period.
function cbGroupLinkedToHub(group) {
  try {
    const clusters = Array.isArray(cbConnection.clusters) ? cbConnection.clusters : [];
    if (clusters.length === 0 || !cbConnection.routeIsReady("macapp")) return false;
    const program = cbDetectProgramId();
    return clusters.some((cluster) => self.CBBridgeProtocol.clusterForGroup([cluster], group, program) === cluster);
  } catch (_) {
    return false;
  }
}

// Reports this endpoint's usage *increment* to the hub for any clustered Default
// group so the one shared live budget keeps accumulating even while the popup is
// closed. Sends a lightweight usage-only group-sync (no scalars/sites) carrying
// the delta since our last report plus an absolute seed (used by the hub only
// until the first real delta arrives). The popup never reports usage, so this is
// the sole browser-side reporter and the delta can't be counted twice.
function cbReportClusterUsage(groups, timers, resets, bucketDeltas = {}, buckets = {}) {
  try {
    const clusters = Array.isArray(cbConnection.clusters) ? cbConnection.clusters : [];
    if (clusters.length === 0) return;
    if (!cbConnection.routeIsReady("macapp")) return;
    const program = cbDetectProgramId();
    for (const g of groups) {
      if (!g) continue;
      const inCluster = clusters.some(
        (cluster) => self.CBBridgeProtocol.clusterForGroup([cluster], g, program) === cluster
      );
      if (!inCluster) continue;
      if (g.rollingLimit) {
        // Rolling limit: share WHEN time was used (per-minute increments), not a
        // total. The first report seeds our history; the hub keeps it only until
        // real increments arrive.
        const seeded = Object.prototype.hasOwnProperty.call(cbClusterUsageBaseline, g.id);
        const deltas = bucketDeltas[g.id];
        if (seeded && !deltas) continue;
        cbClusterUsageBaseline[g.id] = 0;
        cbConnection.sendWS({
          kind: "group-sync",
          program,
          groupName: g.name,
          usageResetAtMs: 0,
          ...(seeded ? { usageBuckets: deltas } : { usageBucketsSeed: buckets[g.id] ?? {} }),
          ts: Date.now()
        });
        continue;
      }
      const current = Number(timers && timers[g.id]) || 0;
      const resetAt = Number(resets && resets[g.id]) || 0;
      const hasBaseline = Object.prototype.hasOwnProperty.call(cbClusterUsageBaseline, g.id);
      const baseline = hasBaseline ? cbClusterUsageBaseline[g.id] : current;
      const delta = Math.max(0, current - baseline);
      cbClusterUsageBaseline[g.id] = current;
      // Nothing new to tell the hub: no local accrual and not our first report.
      // (Our anchor only seeds the hub's period; the hub resets it, not us.)
      if (delta <= 0 && hasBaseline) continue;
      cbConnection.sendWS({
        kind: "group-sync",
        program,
        groupName: g.name,
        usageDeltaMs: delta,
        usageMs: current,
        usageResetAtMs: resetAt,
        ts: Date.now()
      });
    }
  } catch (_) {}
}

// Rebase the usage delta baseline to the hub's shared total for a group. Called
// after folding the shared budget into local storage so the next reported delta
// reflects only fresh local accrual on top of the shared total.
function cbRebaseClusterUsage(groupId, sharedMs) {
  if (!groupId) return;
  cbClusterUsageBaseline[groupId] = Math.max(0, Number(sharedMs) || 0);
}

const cbConnection = {
  ws: null,
  pingTimer: null,
  connectTimer: null,
  reconnectTimer: null,
  desired: false,
  address: CB_FIXED_ADDRESS,
  status: { running: false, state: "off", address: "", peers: [], error: "", hubProgram: "" },
  // Latest web-app bridge clusters that involve this endpoint (hub is the source
  // of truth) and the last groups-announce we sent, so we can re-announce after
  // a reconnect even if the popup is closed.
  clusters: [],
  lastAnnounce: null,
  // Rapid-retry burst bookkeeping. burstStartMs marks the start of the current
  // retry window. A raw WebSocket open is not a usable connection: the hub
  // must also accept our protocol hello with a welcome message.
  burstStartMs: 0,
  handshakeComplete: false,
  startupReady: null,

  setStatus(patch) {
    const macRouteWasReady = this.routeIsReady("macapp");
    this.status = { ...this.status, ...patch };
    const macRouteIsReady = this.routeIsReady("macapp");
    if (!macRouteIsReady && this.clusters.length > 0) {
      this.clusters = [];
      this.broadcastClusters();
    } else if (!macRouteWasReady && macRouteIsReady) {
      // Re-link after a reconnect even if the editor was never opened since
      // this worker started: announce from storage when nothing is cached.
      if (this.lastAnnounce) this.sendWS(this.lastAnnounce);
      else cbAnnounceStoredGroups().catch(() => {});
    }
    if (this.routeIsReady("classifier")
      && typeof self.CBFlushVaultClassifierCollectionQueue === "function") {
      void self.CBFlushVaultClassifierCollectionQueue();
    }
    this.broadcast();
  },

  // A target is present when its native app owns the authenticated hub or is a
  // currently connected peer on that hub.
  targetIsPresent(target, status = this.status) {
    if (!target || !status || typeof status !== "object") return false;
    if (status.hubProgram === target) return true;
    return Array.isArray(status.peers) && status.peers.some(
      (peer) => peer && peer.program === target && peer.connected !== false
    );
  },

  routeIsReady(target) {
    return Boolean(
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      (this.status.state === "connected" || this.status.state === "running") &&
      this.targetIsPresent(target)
    );
  },

  statusForTarget(target) {
    const current = { ...this.status };
    if (current.state === "connected" || current.state === "running") {
      return {
        ...current,
        state: this.targetIsPresent(target, current) ? "connected" : "connected-not-listening",
        error: ""
      };
    }
    if (current.state === "error") return { ...current, state: "disconnected" };
    return current;
  },

  broadcast() {
    try {
      chrome.runtime
        .sendMessage({ type: "connection-status-push", status: this.statusForTarget("macapp") })
        .catch(() => {});
    } catch (_) {}
  },

  broadcastClusters() {
    try {
      chrome.runtime
        .sendMessage({ type: "clusters-push", clusters: this.clusters })
        .catch(() => {});
    } catch (_) {}
  },

  // Applies the hub-authoritative shared definition (policy settings and every
  // entry's lines), usage and snooze to local groups, so a linked group
  // enforces changes made elsewhere even when the popup is closed.
  async applySharedToStorage() {
    const program = cbDetectProgramId();
    const relevant = (Array.isArray(this.clusters) ? this.clusters : []).filter(
      (cluster) =>
        cluster &&
        cluster.shared &&
        Array.isArray(cluster.members) &&
        cluster.members.some((m) => m && m.program === program)
    );
    if (relevant.length === 0) return;
    let stored;
    try {
      stored = await chrome.storage.local.get({ [BLOCKED_GROUPS_KEY]: [] });
    } catch (_) {
      return;
    }
    const groups = Array.isArray(stored[BLOCKED_GROUPS_KEY]) ? stored[BLOCKED_GROUPS_KEY] : [];
    let changed = false;
    for (const cluster of relevant) {
      const localGroup = self.CBBridgeProtocol.groupForCluster(groups, cluster, program);
      const idx = localGroup ? groups.findIndex((g) => g && g.id === localGroup.id) : -1;
      if (idx < 0) continue;
      // The whole shared definition — policy settings AND every entry's lines —
      // is adopted here, so a linked group enforces an edit made on another
      // device even while this browser's editor is closed.
      const scalars = cluster.shared.scalars && typeof cluster.shared.scalars === "object" ? cluster.shared.scalars : {};
      for (const field of CB_SYNC_SCALAR_FIELDS) {
        if (
          Object.prototype.hasOwnProperty.call(scalars, field) &&
          JSON.stringify(groups[idx][field]) !== JSON.stringify(scalars[field])
        ) {
          groups[idx][field] = scalars[field];
          changed = true;
        }
      }
      // An empty list means "nothing shared yet", never "delete everything".
      const scopes = cluster.shared.scopes;
      if (Array.isArray(scopes) && scopes.length > 0 && JSON.stringify(groups[idx].scopes) !== JSON.stringify(scopes)) {
        groups[idx] = { ...groups[idx], scopes };
        changed = true;
      }
    }
    if (changed) {
      try {
        await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: groups });
      } catch (_) {}
    }

    // Apply the hub's shared live usage counter to the local timer store so the
    // joint budget enforces even while the popup is closed (Default groups).
    try {
      const usageStore = await chrome.storage.local.get({
        [USAGE_TIMERS_KEY]: {},
        [USAGE_RESET_AT_KEY]: {},
        [USAGE_BUCKETS_KEY]: {}
      });
      const bucketStore =
        usageStore[USAGE_BUCKETS_KEY] && typeof usageStore[USAGE_BUCKETS_KEY] === "object"
          ? usageStore[USAGE_BUCKETS_KEY]
          : {};
      const timers =
        usageStore[USAGE_TIMERS_KEY] && typeof usageStore[USAGE_TIMERS_KEY] === "object"
          ? usageStore[USAGE_TIMERS_KEY]
          : {};
      const resets =
        usageStore[USAGE_RESET_AT_KEY] && typeof usageStore[USAGE_RESET_AT_KEY] === "object"
          ? usageStore[USAGE_RESET_AT_KEY]
          : {};
      let usageChanged = false;
      for (const cluster of relevant) {
        const shared = cluster.shared;
        if (!shared) continue;
        const grp = self.CBBridgeProtocol.groupForCluster(groups, cluster, program);
        if (!grp || !grp.id) continue;
        if (grp.rollingLimit) {
          // Rolling limit: adopt the hub's shared per-minute usage; the timer is
          // what is still inside this group's window.
          const pruned = cbPruneUsageBuckets(shared.usageBuckets, grp, Date.now());
          if (JSON.stringify(pruned) !== JSON.stringify(bucketStore[grp.id] ?? {})) {
            bucketStore[grp.id] = pruned;
            timers[grp.id] = cbBucketsUsedMs(pruned);
            usageChanged = true;
          }
          continue;
        }
        if (!Number.isFinite(shared.usageMs)) continue;
        const incoming = Math.max(0, Number(shared.usageMs) || 0);
        if ((Number(timers[grp.id]) || 0) !== incoming) {
          timers[grp.id] = incoming;
          usageChanged = true;
        }
        if (
          Number.isFinite(shared.usageResetAtMs) &&
          shared.usageResetAtMs > 0 &&
          (Number(resets[grp.id]) || 0) !== Number(shared.usageResetAtMs)
        ) {
          resets[grp.id] = Number(shared.usageResetAtMs);
          usageChanged = true;
        }
        // Rebase the delta baseline to the shared total so our next reported
        // increment counts only fresh local accrual (never re-reports peers').
        cbRebaseClusterUsage(grp.id, incoming);
      }
      if (usageChanged) {
        await chrome.storage.local.set({
          [USAGE_TIMERS_KEY]: timers,
          [USAGE_RESET_AT_KEY]: resets,
          [USAGE_BUCKETS_KEY]: bucketStore
        });
        await syncBlockingRules();
      }
    } catch (_) {}

    // Adopt a newer shared active snooze so a snooze started on a linked member
    // enforces here even while the popup is closed (newest start wins; fully
    // expired entries are ignored so we never fight local expiry).
    try {
      const now = Date.now();
      const snoozeStore = await chrome.storage.local.get({ [GROUP_SNOOZES_KEY]: {} });
      const snoozes =
        snoozeStore[GROUP_SNOOZES_KEY] && typeof snoozeStore[GROUP_SNOOZES_KEY] === "object"
          ? snoozeStore[GROUP_SNOOZES_KEY]
          : {};
      let snoozeChanged = false;
      for (const cluster of relevant) {
        const shared = cluster.shared;
        if (!shared) continue;
        const sharedSnoozeTs = Number(shared.snoozeTs) || 0;
        if (sharedSnoozeTs <= 0 || !shared.snooze || typeof shared.snooze !== "object") continue;
        const grp = self.CBBridgeProtocol.groupForCluster(groups, cluster, program);
        if (!grp || !grp.id) continue;
        const localEntry = snoozes[grp.id];
        const localTs = localEntry ? Number(localEntry.changedAtMs || localEntry.startsAtMs) || 0 : 0;
        if (sharedSnoozeTs <= localTs) continue;
        const sanitized = sanitizeSnoozes({ [grp.id]: shared.snooze }, [grp], now);
        const entry = sanitized[grp.id];
        if (entry && Number(entry.cooldownUntilMs) > now) {
          snoozes[grp.id] = entry;
          snoozeChanged = true;
        } else if (localEntry) {
          // The newer change on another device ended the snooze: end ours too.
          delete snoozes[grp.id];
          snoozeChanged = true;
        }
      }
      if (snoozeChanged) {
        await chrome.storage.local.set({ [GROUP_SNOOZES_KEY]: snoozes });
        await syncBlockingRules();
      }
    } catch (_) {}
  },

  sendWS(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(obj));
        return true;
      } catch (_) {}
    }
    return false;
  },

  clearTimers() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  },

  closeSocket() {
    if (this.ws) {
      try {
        this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
  },

  connect() {
    this.desired = true;
    this.address = CB_FIXED_ADDRESS;
    this.clearTimers();
    this.closeSocket();
    if (!this.address) {
      this.desired = false;
      this.setStatus({ state: "error", address: "", error: "unrecognized-extension-environment", peers: [], hubProgram: "" });
      return;
    }
    if (this.burstStartMs === 0) this.burstStartMs = Date.now();
    this.setStatus({ state: "connecting", address: this.address, error: "", hubProgram: "" });
    this.handshakeComplete = false;
    let socket;
    try {
      socket = new WebSocket(this.address);
    } catch (error) {
      this.setStatus({ state: "error", error: "socket-error" });
      this.scheduleSlowRetry();
      return;
    }
    this.ws = socket;
    // A connection is usable only after the protocol welcome. Give the whole
    // socket-open + hello/welcome exchange five seconds, then visibly settle
    // on Disconnected while retaining the user's requested slow retry.
    this.connectTimer = setTimeout(() => {
      if (this.ws === socket && !this.handshakeComplete) {
        this.connectTimer = null;
        this.closeSocket();
        this.burstStartMs = 0;
        this.setStatus({ state: "disconnected", error: "connection-timeout", peers: [], hubProgram: "" });
        this.scheduleSlowRetry();
      }
    }, CB_CONNECTION_BURST_WINDOW_MS);
    socket.onopen = () => {};
    socket.onmessage = (event) => {
      this.handleMessage(event && event.data);
    };
    socket.onerror = () => {
      // A failure before the socket ever opened means the shared broker isn't
      // reachable yet; let onclose drive the backed-off reconnect instead of
      // flapping the status to "error" on every attempt.
      if (this.handshakeComplete) {
        this.setStatus({ state: "error", error: "socket-error" });
      }
    };
    socket.onclose = () => {
      this.clearTimers();
      this.ws = null;
      if (!this.desired) {
        this.setStatus({ state: "off", peers: [], hubProgram: "" });
        return;
      }
      if (this.handshakeComplete) {
        // A welcomed hub connection dropped — start a fresh retry burst.
        this.burstStartMs = 0;
        this.setStatus({ state: "connecting", peers: [], hubProgram: "" });
        this.scheduleBurstRetry();
        return;
      }
      // Still trying to establish the first connection of this burst.
      if (Date.now() - this.burstStartMs < CB_CONNECTION_BURST_WINDOW_MS) {
        this.setStatus({ state: "connecting", peers: [], hubProgram: "" });
        this.scheduleBurstRetry();
      } else {
        // Burst window elapsed without connecting. We still WANT to connect, so
        // fall back to the slow retry cadence (every 5s) until the desktop hub
        // comes up. The user only stops attempts by toggling the client off.
        this.burstStartMs = 0;
        this.setStatus({ state: "disconnected", peers: [], hubProgram: "" });
        this.scheduleSlowRetry();
      }
    };
  },

  scheduleBurstRetry() {
    if (!this.desired || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.desired) this.connect();
    }, CB_CONNECTION_BURST_INTERVAL_MS);
  },

  // Slow reconnect probe used while "disconnected": the user still wants to be
  // connected, so we keep retrying every 5s (a fresh burst each time) instead of
  // giving up. A no-op once the user toggles the client off (desired = false).
  scheduleSlowRetry() {
    if (!this.desired || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.desired) this.connect();
    }, CB_CONNECTION_SLOW_INTERVAL_MS);
  },

  stop() {
    this.desired = false;
    this.clearTimers();
    this.closeSocket();
    this.setStatus({ state: "off", peers: [], error: "", hubProgram: "" });
  },

  handleMessage(raw) {
    let msg = null;
    try {
      msg = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (_) {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    if (msg.kind !== "challenge" && msg.kind !== "welcome" && msg.kind !== "rejected" && this.status.state !== "connected") return;
    switch (msg.kind) {
      case "challenge":
        if (
          msg.v !== CB_CONNECTION_PROTOCOL_VERSION ||
          typeof msg.challenge !== "string" ||
          !/^[A-Za-z0-9_-]{43}$/.test(msg.challenge) ||
          !self.CBLocalHubAuthentication ||
          typeof self.CBLocalHubAuthentication.proofForChallenge !== "function"
        ) {
          this.authenticationFailed();
          break;
        }
        this.answerChallenge(msg.challenge);
        break;
      case "welcome":
        if (
          msg.v !== CB_CONNECTION_PROTOCOL_VERSION ||
          !self.CBBridgeProtocol.isHubProgram(msg.hubProgram)
        ) {
          this.desired = false;
          this.clearTimers();
          this.closeSocket();
          this.setStatus({ state: "error", error: "protocol-mismatch", peers: [], hubProgram: "" });
          break;
        }
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        this.handshakeComplete = true;
        this.burstStartMs = 0;
        this.setStatus({
          state: "connected",
          error: "",
          hubProgram: msg.hubProgram,
          peers: Array.isArray(msg.peers) ? msg.peers : this.status.peers
        });
        this.pingTimer = setInterval(() => {
          this.sendWS({ kind: "ping", t: Date.now() });
        }, CB_CONNECTION_PING_MS);
        break;
      case "rejected":
        // A refusal (e.g. this browser already holds a connection) is not
        // final: the other connection may close, so keep the slow retry.
        this.clearTimers();
        this.closeSocket();
        this.burstStartMs = 0;
        this.setStatus({ state: "error", error: msg.reason || "rejected", peers: [], hubProgram: "" });
        this.scheduleSlowRetry();
        break;
      case "peers":
        this.setStatus({ peers: Array.isArray(msg.peers) ? msg.peers : [] });
        break;
      case "clusters":
        if (!this.routeIsReady("macapp")) break;
        this.clusters = Array.isArray(msg.clusters) ? msg.clusters : [];
        this.broadcastClusters();
        this.applySharedToStorage();
        break;
      case "cluster-updated": {
        if (!this.routeIsReady("macapp")) break;
        const next = Array.isArray(this.clusters) ? this.clusters.slice() : [];
        const idx = next.findIndex((c) => c && c.id === msg.cluster?.id);
        const members = Array.isArray(msg.cluster?.members) ? msg.cluster.members : [];
        if (members.length === 0) {
          if (idx >= 0) next.splice(idx, 1);
        } else if (idx >= 0) {
          next[idx] = msg.cluster;
        } else if (msg.cluster) {
          next.push(msg.cluster);
        }
        this.clusters = next;
        this.broadcastClusters();
        this.applySharedToStorage();
        break;
      }
      case "pong":
        break;
      case "classifier-response":
        // The request map below ignores unmatched replies, so classifier
        // responses cannot cross-route ordinary group-sync traffic.
        if (self.CBClassifierHub) self.CBClassifierHub.receive(msg);
        break;
      case "classifier-broadcast":
        // Unsolicited classifier push (a completed classification). No pending
        // correlation: the vault bridge validates the body and fans it out to
        // the platform's tabs.
        if (self.CBClassifierBroadcastReceive) self.CBClassifierBroadcastReceive(msg);
        break;
      case "browser-request":
        // Mac Vault's MCP server driving the extension's settings (1:1 parity
        // with the popup). Only an authenticated hub host reaches this branch.
        if (!this.routeIsReady("macapp")) break;
        void cbHandleBrowserRequest(this, msg);
        break;
      default:
        break;
    }
  },

  answerChallenge(challenge) {
    const socket = this.ws;
    if (!socket || socket.readyState !== WebSocket.OPEN || this.handshakeComplete) return;
    const program = cbDetectProgramId();
    self.CBLocalHubAuthentication.proofForChallenge(program, challenge)
      .then((proof) => {
        if (this.ws !== socket || socket.readyState !== WebSocket.OPEN || this.handshakeComplete) return;
        socket.send(JSON.stringify({
          kind: "hello",
          v: CB_CONNECTION_PROTOCOL_VERSION,
          program,
          challenge,
          proof
        }));
      })
      .catch(() => this.authenticationFailed());
  },

  authenticationFailed() {
    this.clearTimers();
    this.closeSocket();
    this.burstStartMs = 0;
    this.setStatus({ state: "error", error: "authentication-unavailable", peers: [], hubProgram: "" });
    this.scheduleSlowRetry();
  },

  waitForStartup() {
    return this.startupReady || this.startAutomatically();
  },

  startAutomatically() {
    if (!this.startupReady) this.startupReady = Promise.resolve();
    if (!this.desired) {
      this.burstStartMs = 0;
      this.connect();
    }
    return this.startupReady;
  }
};

// Classifier requests share the automatic local WebSocket and are relayed only
// while a Vault Classifier host or peer is present.
// ── Extension settings over the hub (owner 2026-09-23: MCP 1:1 parity) ──────
// Mac Vault relays `browser-request` frames from its in-process MCP server; the
// extension is the authority on which operations it honours. Every write goes
// through the same sanitizers the popup's saves go through (sanitizeGroups /
// createDefaultGroup), so a process can do exactly what the popup can — and a
// frozen / strict / parental group is as untouchable here as it is in the popup.
const CB_BROWSER_REQUEST_OPERATIONS = Object.freeze([
  "settings-get",
  "settings-set-group",
  "settings-create-group",
  "settings-delete-group",
  "settings-set-classifier",
  "settings-set-global",
  "settings-lock-group",
  "settings-unlock-group",
  "settings-move-group"
]);
const CB_CLASSIFIER_SETTINGS_STORAGE_KEY = "vaultClassifierSettings";
const CB_TAGGING_MODES = Object.freeze(["whenFiltering", "always", "paused"]);

function cbGroupIsLocked(group) {
  return Boolean(group) && group.freezeMode !== "none" && group.freezeMode !== undefined;
}

// Locking and unlocking from a tool pass the editor's own gates (owner
// 2026-09-26: a tool may do what the user can, no more, no less):
// - a parental lock needs the group's PIN (or sets it, as the guardian
//   settings do when none exists yet), through the shared retry wait;
// - a strict lock opens only after its hours;
// - every other unlock is the editor's confirmation: ask, wait 5 s, confirm.
const CB_UNFREEZE_CONFIRMATION_INTERVAL_MS = 5000; // popup UNFREEZE_CONFIRMATION_INTERVAL_MS
const CB_UNLOCK_REQUEST_TTL_MS = 5 * 60 * 1000;
const CB_UNLOCK_REQUESTS_KEY = "cbUnlockRequests";

async function cbCheckPinForTool(group, pin) {
  const stored = (await chrome.storage.local.get({ [CBParentalPin.ATTEMPTS_KEY]: {} }))[CBParentalPin.ATTEMPTS_KEY];
  const result = await CBParentalPin.check(stored, group, String(pin || ""), Date.now());
  await chrome.storage.local.set({ [CBParentalPin.ATTEMPTS_KEY]: result.attempts });
  if (result.waiting) throw new Error(`pin-wait:${Math.ceil(result.waitMs / 1000)}`);
  if (!result.ok) throw new Error(`pin-wrong:${Math.ceil(result.waitMs / 1000)}`);
  return result.upgradedHash ? { parentalPasswordHash: result.upgradedHash } : {};
}

async function cbWriteGroupFields(groups, index, fields) {
  const next = groups.slice();
  next[index] = { ...groups[index], ...fields };
  await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
  cbShareGroupChange(next, next[index]);
  return next[index];
}

async function cbLockGroupForTool(input) {
  const { groups } = await getState();
  const index = groups.findIndex((group) => group.id === input.id);
  if (index < 0) throw new Error("group-not-found");
  const group = groups[index];
  if (cbGroupIsLocked(group)) throw new Error("group-locked");
  const mode = input.mode;
  const now = Date.now();
  const fields = { freezeMode: mode, freezeModeChoice: mode, frozenAtMs: now, freezeChangedAtMs: now };
  if (mode === "strict") {
    const hours = input.strictHours === undefined ? group.strictFreezeHours : parseStrictFreezeHours(input.strictHours);
    if (hours === null) throw new Error("invalid-strict-hours: 0 < hours <= 72");
    fields.strictFreezeHours = hours;
  } else if (mode === "parental") {
    if (group.parentalPasswordHash) {
      Object.assign(fields, await cbCheckPinForTool(group, input.pin));
    } else {
      if (!CBParentalPin.isValidParentalPin(String(input.pin || ""))) throw new Error("pin-required: a 6-digit PIN becomes the group's parental PIN");
      Object.assign(fields, await CBParentalPin.newPinFields(String(input.pin)));
    }
  } else if (mode !== "frozen") {
    throw new Error("invalid-mode: frozen | strict | parental");
  }
  return cbWriteGroupFields(groups, index, fields);
}

async function cbUnlockGroupForTool(input) {
  const { groups } = await getState();
  const index = groups.findIndex((group) => group.id === input.id);
  if (index < 0) throw new Error("group-not-found");
  const group = groups[index];
  if (!cbGroupIsLocked(group)) throw new Error("not-locked");
  const now = Date.now();
  const unlocked = { freezeMode: "none", frozenAtMs: null, freezeChangedAtMs: now };
  if (group.freezeMode === "parental" && group.parentalPasswordHash) {
    const upgrade = await cbCheckPinForTool(group, input.pin);
    return { unlocked: true, group: cbPublicGroup(await cbWriteGroupFields(groups, index, { ...upgrade, ...unlocked })) };
  }
  if (group.freezeMode === "strict") {
    const opensAtMs = (Number(group.frozenAtMs) || 0) + (Number(group.strictFreezeHours) || 0) * MS_PER_HOUR;
    if (opensAtMs > now) throw new Error(`strict-wait:${new Date(opensAtMs).toISOString()}`);
  }
  if (group.freezeMode === "parental") {
    // No PIN set: nothing to gate against, as in the editor.
    return { unlocked: true, group: cbPublicGroup(await cbWriteGroupFields(groups, index, unlocked)) };
  }
  // The confirmation: the first call asks, a call with confirm: true at least
  // 5 s later unlocks.
  const session = chrome.storage.session || chrome.storage.local;
  const requests = { ...((await session.get({ [CB_UNLOCK_REQUESTS_KEY]: {} }))[CB_UNLOCK_REQUESTS_KEY] || {}) };
  const request = requests[group.id];
  const live = request && now - request.askedAtMs < CB_UNLOCK_REQUEST_TTL_MS;
  if (input.confirm === true && live) {
    const readyAtMs = request.askedAtMs + CB_UNFREEZE_CONFIRMATION_INTERVAL_MS;
    if (now < readyAtMs) throw new Error(`confirm-wait:${Math.ceil((readyAtMs - now) / 1000)}`);
    delete requests[group.id];
    await session.set({ [CB_UNLOCK_REQUESTS_KEY]: requests });
    return { unlocked: true, group: cbPublicGroup(await cbWriteGroupFields(groups, index, unlocked)) };
  }
  requests[group.id] = { askedAtMs: now };
  await session.set({ [CB_UNLOCK_REQUESTS_KEY]: requests });
  return { unlocked: false, confirmAfterSeconds: CB_UNFREEZE_CONFIRMATION_INTERVAL_MS / 1000,
    next: "call again with confirm: true after the wait (within 5 minutes)" };
}

async function cbBrowserRequestBody(operation, body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  switch (operation) {
    case "settings-get": {
      const { groups, usageTimersMs, groupSnoozes } = await getState();
      const stored = await chrome.storage.local.get([CB_CLASSIFIER_SETTINGS_STORAGE_KEY, CB_GLOBAL_SETTINGS_KEY]);
      const raw = stored?.[CB_CLASSIFIER_SETTINGS_STORAGE_KEY];
      return {
        groups: groups.map(cbPublicGroup),
        usageTimersMs,
        groupSnoozes,
        classifierSettings: {
          collectionEnabled: !raw || raw.collectionEnabled !== false,
          taggingMode: raw && CB_TAGGING_MODES.includes(raw.taggingMode) ? raw.taggingMode : "whenFiltering"
        },
        globalSettings: stored?.[CB_GLOBAL_SETTINGS_KEY] && typeof stored[CB_GLOBAL_SETTINGS_KEY] === "object" ? stored[CB_GLOBAL_SETTINGS_KEY] : {},
        operations: CB_BROWSER_REQUEST_OPERATIONS
      };
    }
    case "settings-create-group": {
      const groupType = typeof input.groupType === "string" ? input.groupType : "";
      if (!PLATFORM_GROUP_TYPES.includes(groupType) && groupType !== "site" && groupType !== "custom") {
        throw new Error("unknown-group-type");
      }
      const patch = input.patch && typeof input.patch === "object" && !Array.isArray(input.patch) ? input.patch : {};
      // A lock is the user's to set, in the editor: a created group never
      // starts locked (same fields the edit path strips).
      const { freezeMode: _freeze, frozenAtMs: _frozenAt, freezeChangedAtMs: _changed, parentalPasswordHash: _hash, parentalPasswordSalt: _salt, ...safePatch } = patch;
      const { groups } = await getState();
      // As the editor's New group: the user's default snooze length, and a
      // free numbered name when none is given ("Block Group 2").
      const base = createDefaultGroup(groupType);
      const storedGlobal = (await chrome.storage.local.get(CB_GLOBAL_SETTINGS_KEY))?.[CB_GLOBAL_SETTINGS_KEY];
      const defaultSnooze = Number.parseFloat(storedGlobal?.defaultSnoozeMinutes);
      if (Number.isFinite(defaultSnooze) && defaultSnooze > 0) base.snoozeMinutes = defaultSnooze;
      if (typeof safePatch.name !== "string" || !safePatch.name.trim()) {
        for (let n = 2; cbNameTaken(groups, base.name); n += 1) base.name = `${base.name.replace(/ \d+$/, "")} ${n}`;
      }
      const draft = { ...base, ...safePatch, groupType };
      const [group] = sanitizeGroups([draft]);
      if (!group) throw new Error("invalid-group");
      if (groups.some((existing) => existing.id === group.id)) throw new Error("duplicate-group-id");
      if (cbNameTaken(groups, group.name)) throw new Error("duplicate-name");
      const next = [...groups, group];
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
      cbShareGroupChange(next, group);
      return { group: cbPublicGroup(group) };
    }
    case "settings-set-group": {
      const id = typeof input.id === "string" ? input.id : "";
      const patch = input.patch && typeof input.patch === "object" && !Array.isArray(input.patch) ? input.patch : null;
      if (!id || !patch) throw new Error("missing-id-or-patch");
      const { groups } = await getState();
      const index = groups.findIndex((group) => group.id === id);
      if (index < 0) throw new Error("group-not-found");
      if (cbGroupIsLocked(groups[index])) throw new Error("group-locked");
      // The id and the lock state are never patchable — same as the popup.
      const { id: _id, freezeMode: _freeze, frozenAtMs: _frozenAt, freezeChangedAtMs: _changed, parentalPasswordHash: _hash, parentalPasswordSalt: _salt, ...safePatch } = patch;
      const [group] = sanitizeGroups([{ ...groups[index], ...safePatch, id }]);
      if (!group) throw new Error("invalid-group");
      if (cbNameTaken(groups, group.name, id)) throw new Error("duplicate-name");
      const next = groups.slice();
      next[index] = group;
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
      await cbRestartBudgetOnPolicyChange(groups[index], group);
      cbShareGroupChange(next, group);
      return { group: cbPublicGroup(group) };
    }
    case "settings-delete-group": {
      const id = typeof input.id === "string" ? input.id : "";
      const { groups } = await getState();
      const group = groups.find((candidate) => candidate.id === id);
      if (!group) throw new Error("group-not-found");
      if (cbGroupIsLocked(group)) throw new Error("group-locked");
      const next = groups.filter((candidate) => candidate.id !== id);
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
      cbShareGroupChange(next, null);
      return { deleted: id };
    }
    case "settings-lock-group":
      return { group: cbPublicGroup(await cbLockGroupForTool({ ...input, id: typeof input.id === "string" ? input.id : "" })) };
    case "settings-unlock-group":
      return cbUnlockGroupForTool({ ...input, id: typeof input.id === "string" ? input.id : "" });
    case "settings-move-group": {
      // The group list's order (drag in the editor); a locked group stays put.
      // Order is this device's own: it is not shared with linked devices.
      const id = typeof input.id === "string" ? input.id : "";
      const { groups } = await getState();
      const from = groups.findIndex((group) => group.id === id);
      if (from < 0) throw new Error("group-not-found");
      if (cbGroupIsLocked(groups[from])) throw new Error("group-locked");
      const to = Number(input.index);
      if (!Number.isInteger(to) || to < 0 || to >= groups.length) throw new Error(`invalid-index: 0…${groups.length - 1}`);
      const next = groups.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
      return { order: next.map((group) => group.id) };
    }
    case "settings-set-classifier": {
      const stored = await chrome.storage.local.get(CB_CLASSIFIER_SETTINGS_STORAGE_KEY);
      const current = stored?.[CB_CLASSIFIER_SETTINGS_STORAGE_KEY] && typeof stored[CB_CLASSIFIER_SETTINGS_STORAGE_KEY] === "object"
        ? { ...stored[CB_CLASSIFIER_SETTINGS_STORAGE_KEY] } : {};
      if (input.taggingMode !== undefined) {
        if (!CB_TAGGING_MODES.includes(input.taggingMode)) throw new Error("invalid-tagging-mode");
        current.taggingMode = input.taggingMode;
      }
      if (input.collectionEnabled !== undefined) current.collectionEnabled = input.collectionEnabled === true;
      await chrome.storage.local.set({ [CB_CLASSIFIER_SETTINGS_STORAGE_KEY]: current });
      return {
        classifierSettings: {
          collectionEnabled: current.collectionEnabled !== false,
          taggingMode: CB_TAGGING_MODES.includes(current.taggingMode) ? current.taggingMode : "whenFiltering"
        }
      };
    }
    case "settings-set-global": {
      // The popup's global settings, sanitized the way its save does.
      const stored = await chrome.storage.local.get(CB_GLOBAL_SETTINGS_KEY);
      const current = stored?.[CB_GLOBAL_SETTINGS_KEY] && typeof stored[CB_GLOBAL_SETTINGS_KEY] === "object" ? stored[CB_GLOBAL_SETTINGS_KEY] : {};
      const patch = input.patch && typeof input.patch === "object" && !Array.isArray(input.patch) ? input.patch : null;
      if (!patch) throw new Error("missing-patch");
      const merged = { ...current, ...patch };
      const clamp = (value, min, max, fallback) => { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
      const next = {
        tickRateMs: Math.round(clamp(merged.tickRateMs, 100, 10_000, 250)),
        autosaveDebounceMs: Math.round(clamp(merged.autosaveDebounceMs, 0, 10_000, 400)),
        debugMode: merged.debugMode === true,
        showOnPageLogToasts: merged.showOnPageLogToasts !== false,
        defaultSnoozeMinutes: (() => { const n = Number.parseFloat(merged.defaultSnoozeMinutes); return Number.isFinite(n) && n > 0 ? n : DEFAULT_SNOOZE_MINUTES; })(),
        quickAddEnabled: merged.quickAddEnabled === true,
        closeRetrySeconds: Math.round(clamp(merged.closeRetrySeconds, 0, 86_400, 0))
      };
      await chrome.storage.local.set({ [CB_GLOBAL_SETTINGS_KEY]: next });
      return { globalSettings: next };
    }
    default:
      throw new Error("unsupported-operation");
  }
}

// Answers one relayed request on the hub socket; every path replies exactly
// once, with a bounded error string on failure.
async function cbHandleBrowserRequest(connection, msg) {
  const requestID = typeof msg?.requestID === "string" ? msg.requestID.slice(0, 128) : "";
  const operation = typeof msg?.operation === "string" ? msg.operation.slice(0, 64) : "";
  if (!requestID || !operation) return;
  const reply = (frame) => { try { connection.sendWS({ kind: "browser-response", requestID, operation, ...frame }); } catch (_) {} };
  if (!CB_BROWSER_REQUEST_OPERATIONS.includes(operation)) { reply({ error: "unsupported-operation" }); return; }
  try {
    reply({ body: await cbBrowserRequestBody(operation, msg.body) });
  } catch (error) {
    const text = String(error?.message || error || "error").replace(/[^\x20-\x7e]/g, "").slice(0, 200);
    reply({ error: text || "error" });
  }
}
self.cbHandleBrowserRequest = cbHandleBrowserRequest;

const CB_CLASSIFIER_HUB_MAX_PENDING = 16;
// The native relay expires first (30 seconds), leaving this browser deadline
// enough margin to receive its explicit timeout without racing a late reply.
const CB_CLASSIFIER_HUB_TIMEOUT_MS = 32_000;
const CB_CLASSIFIER_HUB_CONNECT_WAIT_MS = 5_000;
// The cap bounds CONCURRENCY (in-flight requests), not total work. Overflow waits
// in this bounded queue for a free slot instead of being dropped, so a dense feed
// never loses a request. The queue bound is a far higher backstop against a true
// runaway; normal feeds sit well under it.
const CB_CLASSIFIER_HUB_MAX_QUEUE = 512;
const cbClassifierHub = {
  pending: new Map(),
  waitQueue: [],

  recordTransport(stage, outcome = "extension") {
    try {
      if (typeof self.CBRecordVaultClassifierTransportDiagnostic === "function") {
        self.CBRecordVaultClassifierTransportDiagnostic(stage, outcome);
      }
    } catch (_) {}
  },

  isReady(connection) {
    return Boolean(
      connection &&
      connection.ws &&
      connection.ws.readyState === WebSocket.OPEN &&
      connection.status &&
      connection.status.state === "connected" &&
      typeof connection.targetIsPresent === "function" &&
      connection.targetIsPresent("classifier")
    );
  },

  waitForReady(connection) {
    if (this.isReady(connection)) return Promise.resolve();
    // There is no active shared socket to wait for, or a live hub has already
    // confirmed that it does not have a Classifier peer.
    if (!connection || connection.status?.state === "connected") {
      return Promise.reject(new Error("The Vault Classifier bridge is unavailable."));
    }
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + CB_CLASSIFIER_HUB_CONNECT_WAIT_MS;
      const poll = () => {
        if (this.isReady(connection)) {
          resolve();
        } else if (Date.now() >= deadline) {
          reject(new Error("The Vault Classifier bridge is unavailable."));
        } else {
          setTimeout(poll, 100);
        }
      };
      poll();
    });
  },

  responseBody(message, operation) {
    if (!message || message.operation !== operation) {
      throw new Error("Vault Classifier returned an invalid response.");
    }
    if (typeof message.error === "string" && message.error.length <= 256) {
      throw new Error(message.error);
    }
    if (!message.body || typeof message.body !== "object" || Array.isArray(message.body)) {
      throw new Error("Vault Classifier returned an invalid response.");
    }
    let bodyJSON;
    try {
      bodyJSON = JSON.stringify(message.body);
    } catch (_) {
      throw new Error("Vault Classifier returned an invalid response.");
    }
    if (typeof bodyJSON !== "string" || new TextEncoder().encode(bodyJSON).length > 88_000) {
      throw new Error("Vault Classifier response exceeds the shared bridge limit.");
    }
    return message.body;
  },

  requestOnSharedSocket(connection, operation, body) {
    return new Promise((resolve, reject) => {
      const job = { connection, operation, body, resolve, reject };
      if (this.pending.size < CB_CLASSIFIER_HUB_MAX_PENDING) {
        this.dispatchClassifierJob(job);
      } else if (this.waitQueue.length < CB_CLASSIFIER_HUB_MAX_QUEUE) {
        this.waitQueue.push(job);
      } else {
        reject(new Error("Vault Classifier is busy."));
      }
    });
  },

  dispatchClassifierJob(job) {
    const { connection, operation, body, resolve, reject } = job;
    const requestID = self.VaultClassifierExtensionContract.randomID("classifier");
    const timer = setTimeout(() => {
      if (!this.pending.has(requestID)) return;
      this.pending.delete(requestID);
      this.recordTransport("durable-timeout", "unavailable");
      reject(new Error("Vault Classifier request timed out."));
      this.drainWaitQueue();
    }, CB_CLASSIFIER_HUB_TIMEOUT_MS);
    this.pending.set(requestID, { operation, resolve, reject, timer });
    if (!connection || typeof connection.sendWS !== "function" || !connection.sendWS({ kind: "classifier-request", requestID, operation, body })) {
      clearTimeout(timer);
      this.pending.delete(requestID);
      this.recordTransport("durable-send-failed", "unavailable");
      reject(new Error("The Vault Classifier bridge is unavailable."));
      this.drainWaitQueue();
    }
  },

  // A slot just freed (a response arrived, or a send failed/timed out): dispatch
  // as many queued requests as the concurrency cap now allows.
  drainWaitQueue() {
    while (this.pending.size < CB_CLASSIFIER_HUB_MAX_PENDING && this.waitQueue.length > 0) {
      this.dispatchClassifierJob(this.waitQueue.shift());
    }
  },

  // Every operation the extension may send over the shared classifier route.
  // Keep in sync with LocalClassifierHub.swift and ConnectionHub.swift — the
  // parity suite (tests/runner-hub-op-parity.js) fails if the copies drift.
  operations: ["bridge-info", "collection-info", "diagnostic", "collect", "video-tags", "video-tags-batch", "classifier-taxonomy", "submit-correction", "dev-log", "activity-record", "activity-settings"],

  request(operation, body) {
    if (!this.operations.includes(operation)) {
      // Loud on purpose: a silent rejection here once blackholed the pill
      // pipeline AND its own dev-log diagnostics for days.
      console.error("[CustomBlocker] Vault Classifier operation rejected by the extension allowlist:", operation);
      return Promise.reject(new Error("Unsupported Vault Classifier operation."));
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Promise.reject(new Error("Invalid Vault Classifier request."));
    }
    let bodyJSON;
    try {
      bodyJSON = JSON.stringify(body);
    } catch (_) {
      return Promise.reject(new Error("Invalid Vault Classifier request."));
    }
    if (typeof bodyJSON !== "string" || new TextEncoder().encode(bodyJSON).length > 88_000) {
      return Promise.reject(new Error("Vault Classifier request exceeds the shared bridge limit."));
    }
    const connection = cbConnection;
    const startupReady = connection && typeof connection.waitForStartup === "function"
      ? connection.waitForStartup()
      : Promise.resolve();
    return Promise.resolve(startupReady)
      .then(() => this.waitForReady(connection))
      .then(
        () => this.requestOnSharedSocket(connection, operation, body),
        () => {
          // One connection per browser: the hub refuses a second socket from
          // the same program, so there is no side channel — the request waits
          // for the shared connection's own retry instead.
          this.recordTransport("shared-unavailable", "unavailable");
          throw new Error("The Vault Classifier bridge is unavailable.");
        }
      );
  },

  receive(message) {
    const requestID = message && typeof message.requestID === "string" ? message.requestID : "";
    const pending = requestID && this.pending.get(requestID);
    if (!pending || !message || message.operation !== pending.operation) return;
    this.pending.delete(requestID);
    clearTimeout(pending.timer);
    try {
      pending.resolve(this.responseBody(message, pending.operation));
    } catch (error) {
      pending.reject(error);
    }
    this.drainWaitQueue();
  },

  rejectAll(reason) {
    const error = new Error(reason || "The shared Vault bridge disconnected.");
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    const queued = this.waitQueue.splice(0);
    for (const job of queued) job.reject(error);
  }
};
self.CBClassifierHub = cbClassifierHub;

// ── DEBUG: measure classifier-bridge round-trip latency ──────────────────────
// Run from the extension's service-worker console
// (chrome://extensions → "Inspect views: service worker"):
//   await CBVaultMeasureBridge()                       // ~pure connection (bridge-info)
// `coldFirstMs` is the cold path (connect + hello/welcome handshake) only when
// `warmAtStart` is false.
async function cbMeasureBridge({ op = "bridge-info", count = 20, gapMs = 50, body } = {}) {
  const requestBody = body || {};
  const warmAtStart = cbClassifierHub.isReady(cbConnection);
  const round2 = (value) => Math.round(value * 100) / 100;
  const samples = [];
  for (let i = 0; i < count; i += 1) {
    const started = performance.now();
    let ok = true;
    let error = null;
    try {
      await cbClassifierHub.request(op, requestBody);
    } catch (thrown) {
      ok = false;
      error = String((thrown && thrown.message) || thrown);
    }
    samples.push({ i, ms: round2(performance.now() - started), ok, error });
    if (gapMs > 0 && i < count - 1) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
  // Exclude the first sample from the warm stats: it carries any connect cost.
  const warm = samples.slice(1).filter((sample) => sample.ok).map((sample) => sample.ms).sort((a, b) => a - b);
  const at = (p) => (warm.length ? warm[Math.min(warm.length - 1, Math.floor(p * warm.length))] : null);
  const summary = {
    op,
    count,
    warmAtStart,
    failed: samples.filter((sample) => !sample.ok).length,
    coldFirstMs: samples[0] ? samples[0].ms : null,
    warmMin: warm[0] ?? null,
    warmMedian: at(0.5),
    warmP95: at(0.95),
    warmMax: warm[warm.length - 1] ?? null,
    warmMean: warm.length ? round2(warm.reduce((a, b) => a + b, 0) / warm.length) : null
  };
  console.table(samples);
  console.log(`[CBVaultMeasureBridge] ${op}`, summary);
  return summary;
}
self.CBVaultMeasureBridge = cbMeasureBridge;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;
  switch (message.type) {
    case "connection-status":
      sendResponse({ ok: true, status: cbConnection.statusForTarget("macapp") });
      return false;
    case "groups-announce":
      cbConnection.lastAnnounce = {
        kind: "groups-announce",
        program: message.program,
        groups: Array.isArray(message.groups) ? message.groups : []
      };
      if (cbConnection.routeIsReady("macapp")) cbConnection.sendWS(cbConnection.lastAnnounce);
      sendResponse({ ok: true });
      return false;
    case "clusters-status":
      sendResponse({ ok: true, clusters: cbConnection.clusters });
      return false;
    case "group-sync":
      if (!cbConnection.routeIsReady("macapp")) { sendResponse({ ok: false, error: "macapp-unavailable" }); return false; }
      cbConnection.sendWS({
        kind: "group-sync",
        program: message.program,
        groupName: message.groupName,
        ts: message.ts,
        priority: message.priority === true,
        // The whole definition: policy scalars + every entry's lines.
        scalars: message.scalars,
        scopes: message.scopes,
        // Active-snooze runtime must be relayed too — without these the popup's
        // snooze never reaches the hub and a snooze started on one member never
        // propagates to its linked peers.
        snooze: message.snooze,
        snoozeTs: message.snoozeTs,
        // Cumulative snooze total so the hub can share the cluster-wide max.
        snoozeTotalMs: message.snoozeTotalMs
      });
      sendResponse({ ok: true });
      return false;
    default:
      return false;
  }
});

// Every service-worker lifetime participates in the authenticated local hub.
cbConnection.startAutomatically();

// Start the Activity log's browser feeders (web-visit dwell + watched content).
// Records only while the matching category is enabled in the native settings.
if (typeof cbActivity !== "undefined") {
  cbActivity.init().catch((error) => {
    console.error("[CustomBlocker] activity init failed", error);
  });
}

// ===========================================================================
