/* Custom Web Blocker — background service worker.
 *
 * Responsibilities:
 *   - Persist groups, usage timers, snoozes, custom timer state, custom
 *     persistence buckets.
 *   - Decide each page (cbPageLead): blocking is the union of every group;
 *     the groups are walked from the top of the editor list and the first
 *     that blocks a page decides how it looks. The content script covers the
 *     page in place; an address sends the tab away when the page arrives.
 *     Custom groups run per-page in the content script.
 *   - Build the page session payload that the content script consumes, and
 *     push "session-refresh" to open pages when the enforcement state changes.
 *   - Sanitise and store the custom timer / persistence updates that the
 *     content script flushes back after running rules.
 */

// On Chromium the background context is a classic service worker, so we
// pull in the shared files with importScripts(). On Firefox/Safari the
// background is a DOM-bearing page (it hosts the sandbox iframe in the
// absence of chrome.offscreen), where importScripts() does not exist; there
// manifest.background.scripts lists them ahead of background.js.
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
    if (typeof CBGroupActions === "undefined") importScripts("group-actions.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(parental-pin.js / group-actions.js) failed", error);
  }
  try {
    if (typeof VaultClassifierExtensionContract === "undefined") importScripts("vault-classifier-contract.js");
    importScripts("vault-classifier-bridge.js", "local-hub-auth.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(vault classifier bridge) failed", error);
  }
  try {
    if (typeof cbActivity === "undefined") importScripts("vault-activity.js");
  } catch (error) {
    console.error("[CustomBlocker] importScripts(vault-activity.js) failed", error);
  }
}

// A group's policy rules (field defaults and parsers, time windows, budget
// periods, runtime-state sanitizers): one copy, in group-actions.js.
const {
  DAY_NAMES, DEFAULT_GROUP_TYPE, DEFAULT_ALLOWED_MINUTES, DEFAULT_RESET_INTERVAL_HOURS,
  DEFAULT_SNOOZE_MINUTES, DEFAULT_SNOOZE_CONFIRMATIONS, DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES,
  DEFAULT_SNOOZE_COOLDOWN_MINUTES, DEFAULT_PAUSE_SECONDS, createGroupId, createDefaultDays,
  getDayNameForDate, normalizeBlockingMode, isTimedBlockingMode, parseAllowedMinutes,
  parseResetIntervalHours, parseSnoozeMinutes, parseSnoozeDelayMinutes, parseSnoozeCooldownMinutes,
  parsePauseSeconds, parseSnoozeConfirmations, parseTimeWindowsText, parseTimeWindowToMinutes,
  cbPeriodStartMs, cbNextResetMs, cbUsageBucketStartMs, cbPruneUsageBuckets,
  cbBucketsUsedMs, cbNextReturnMs, sanitizeUsageTimers, sanitizeSnoozeTotals, sanitizeResetTimes,
  sanitizeUsageBuckets, sanitizeSnoozes, isGroupActiveNow
} = CBGroupActions;
// One group's defaults and sanitizer, and the site / tag normalizers: one copy,
// in group-scopes.js (the editor and Mac Vault use it too).
const { createDefaultGroup, sanitizeGroups, normalizeSiteInput, normalizeTagFilterMode, clampTagConfidence } = CBGroupScopes;
// Scalar settings linked groups share (one list, in group-scopes.js).
const CB_SYNC_SCALAR_FIELDS = CBGroupScopes.SYNC_SCALAR_FIELDS;

// This browser's copy of its links (owner 2026-09-26: kept while Mac Vault is
// away) and the time it counts for linked groups meanwhile.
const CB_CLUSTER_COPY_KEY = "cbClusterCopy";
const CB_OFFLINE_USAGE_KEY = "cbOfflineUsage";
let cbClusterCopy = [];
// Loaded once per worker; getState and the sharing wait for it, so right after
// a wake a linked group is never taken for an unlinked one.
const cbClusterCopyReady = (async () => {
  try {
    const stored = (await chrome.storage.local.get({ [CB_CLUSTER_COPY_KEY]: [] }))[CB_CLUSTER_COPY_KEY];
    if (Array.isArray(stored) && cbClusterCopy.length === 0) cbClusterCopy = stored;
  } catch (_) {}
})();


// Debug mode flag. False by default; user toggles it via Settings.
// Drives whether [CustomBlocker] / [CustomBlocker:trace] verbose
// console.log lines are emitted. A rule's v.log goes to the log feed
// regardless of this flag.
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

const BLOCKED_GROUPS_KEY = "blockedGroups";
const USAGE_TIMERS_KEY = "usageTimersMs";
const USAGE_RESET_AT_KEY = "usageResetAtMs";
// Rolling-limit usage per group: {groupId: {"<minuteStartMs>": ms}}.
const USAGE_BUCKETS_KEY = "usageBucketsMs";
const GROUP_SNOOZES_KEY = "groupSnoozes";
const GROUP_SNOOZE_TOTALS_KEY = "groupSnoozeTotalsMs";

// A page let through after a pause countdown stays through for this long on
// that tab and host (the pass ends earlier when the tab leaves the host).
const PAUSE_PASS_MS = 15 * 60 * 1000;
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


let usageTimerUpdateQueue = Promise.resolve();

function queueUsageTimerUpdate(task) {
  const run = usageTimerUpdateQueue.then(() => task());
  usageTimerUpdateQueue = run.catch(() => {});
  return run;
}

// ────────────────────────────────────────────────────────────────────────
// Group + value normalisation. These run when storage is read so the rest
// of the worker can assume well-formed data.
// ────────────────────────────────────────────────────────────────────────

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
  // A bare hostname (tests) is a page at "/" on it.
  if (typeof input === "string") input = { hostname: input };
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

  // Everything is derived from the address here; the page adds only the
  // authors it reads from the page itself (YouTube's owner byline).
  const normalizedHostname = hostname ?? null;
  const videoContext = detectVideoSiteContext(normalizedHostname, pathname || "/");
  return {
    hostname: normalizedHostname,
    pathname: pathname || "/",
    url,
    platformAuthors: normalizePlatformAuthorsMap(input?.platformAuthors, pathname, url),
    videoSite: videoContext.site,
    videoForm: videoContext.form,
    // The local Vault Classifier receives rendered evidence through its own
    // dedicated adapter; page matching contains no remote classification state.
  };
}

// The group's "when blocked" field, read by the page decision: a web address or a
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

function getSnoozePhase(snooze, now) {
  return CBGroupActions.snoozePhase(snooze, now);
}

// A snooze that exempts its group right now: a running time snooze. A budget
// snooze keeps the group in effect and raises its allowance instead
// (CBGroupActions.effectiveAllowedMs).
function getActiveSnooze(groupId, groupSnoozes, now) {
  const snooze = groupSnoozes[groupId];
  return CBGroupActions.snoozeExempts(snooze, now) ? snooze : null;
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
    return matchesSiteGroup(group, pageContext.hostname, pageContext.pathname);
  }
  return cbGroupMatchesPage(group, pageContext);
}

// Groups in effect right now that name this page, in list order (top first).
function getRelevantGroupsForPage(pageContext, groups, groupSnoozes, now) {
  return groups.filter((group) => cbGroupActive(group, groupSnoozes, now) && cbGroupBlocksPage(group, pageContext));
}

function buildTimedItems(relevantGroups, usageTimersMs, usageResetAtMs, now, usageBucketsMs = {}, groupSnoozes = {}) {
  return relevantGroups
    .filter((group) => isTimedBlockingMode(group.mode))
    .map((group) => {
      const usedMs = usageTimersMs[group.id] ?? 0;
      const allowedMs = CBGroupActions.effectiveAllowedMs(group, groupSnoozes[group.id], now);
      const remainingMs = Math.max(allowedMs - usedMs, 0);
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
        blocksNow: usedMs >= allowedMs
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
    newAnchors: groups.some((group) => !(Number.parseInt(result[USAGE_RESET_AT_KEY]?.[group.id], 10) > 0)),
    usageBucketsMs: sanitizeUsageBuckets(result[USAGE_BUCKETS_KEY], groups),
    groupSnoozes: sanitizeSnoozes(result[GROUP_SNOOZES_KEY], groups),
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
  const nextTimers = { ...usageTimersMs };
  const nextResetAt = { ...usageResetAtMs };
  const nextBuckets = { ...usageBucketsMs };
  const nextSnoozes = { ...groupSnoozes };
  const nextSnoozeTotals = { ...groupSnoozeTotalsMs };
  let changed = false;
  const groupById = new Map(groups.map((group) => [group.id, group]));

  // Snoozes first, on this period's usage (a budget snooze lapses at the reset
  // below): a budget snooze whose extra room is used up ends now; a time
  // snooze that ran out (or was ended) adds its clock time to the group's total
  // once (a budget snooze's time is counted as it is used, in applyElapsedTime).
  // The entry itself stays
  // (group-actions.js: a group's last entry is never deleted), so an older one
  // shared by another device is never taken back.
  for (const [groupId, snooze] of Object.entries(nextSnoozes)) {
    const group = groupById.get(groupId);
    const settled = CBGroupActions.settleBudgetSnooze(snooze, group, nextTimers[groupId], now);
    if (settled) {
      nextSnoozes[groupId] = settled;
      changed = true;
    }
    const entry = nextSnoozes[groupId];
    if (!entry.activeMsApplied && now >= entry.untilMs) {
      nextSnoozeTotals[groupId] =
        Math.max(0, Number(nextSnoozeTotals[groupId]) || 0) +
        CBGroupActions.snoozeCountedMs(entry);
      nextSnoozes[groupId] = { ...entry, activeMsApplied: true };
      changed = true;
    }
  }

  for (const group of groups) {
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
    if (cbConnection.desktopRouteIsReady() && cbGroupInLink(group)) continue;
    const periodStart = cbPeriodStartMs(nextResetAt[group.id], group, now);
    if (periodStart === nextResetAt[group.id]) continue;
    nextTimers[group.id] = 0;
    nextResetAt[group.id] = periodStart;
    changed = true;
  }

  return {
    usageTimersMs: nextTimers,
    usageResetAtMs: nextResetAt,
    usageBucketsMs: nextBuckets,
    groupSnoozes: nextSnoozes,
    groupSnoozeTotalsMs: nextSnoozeTotals,
    changed
  };
}

async function getState() {
  await cbClusterCopyReady;
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

  // Runtime maps only: the group list is the editor's (writing it back here
  // could undo a save that landed meanwhile). A group with no budget anchor
  // yet (just created) gets it stored now, so its period doesn't float.
  if (normalized.changed || baseState.newAnchors) {
    await chrome.storage.local.set({
      [USAGE_TIMERS_KEY]: normalized.usageTimersMs,
      [USAGE_RESET_AT_KEY]: normalized.usageResetAtMs,
      [USAGE_BUCKETS_KEY]: normalized.usageBucketsMs,
      [GROUP_SNOOZES_KEY]: normalized.groupSnoozes,
      [GROUP_SNOOZE_TOTALS_KEY]: normalized.groupSnoozeTotalsMs
    });
  }

  return {
    groups: baseState.groups,
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
function isPlatformBlockEnforcing(group, usageTimersMs, groupSnoozes = {}, now = Date.now()) {
  if (group.mode === "instant") return true;
  return (usageTimersMs[group.id] ?? 0) >= CBGroupActions.effectiveAllowedMs(group, groupSnoozes[group.id], now);
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
  const tagList = CBGroupScopes.normalizeTagList(tagFilter.tags);
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
  if (!currentSite) return filters;

  for (const group of groups) {
    if (!cbGroupActive(group, groupSnoozes, now)) continue;
    const lines = Array.isArray(group.scopes) ? group.scopes : [];
    // A group may name several platforms; only its lines for THIS page's
    // platform apply.
    const itemLines = lines.filter((line) => line.surface === "items" && line.platform === currentSite);
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
  const relevantTimedItems = buildTimedItems(relevantGroups, usageTimersMs, usageResetAtMs, now, {}, groupSnoozes);
  const exposedGroups = getExposedTimedGroups(
    exposedGroupIds,
    groups,
    relevantGroups,
    groupSnoozes,
    now
  );
  const exposedTimedItems = buildTimedItems(exposedGroups, usageTimersMs, usageResetAtMs, now, {}, groupSnoozes);
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
  // Never send the tab to a page that is blocked too (that page would send it
  // on, or back: a loop): the page is covered in place instead.
  if (exit?.action === "navigate") {
    let target = null;
    try { const url = new URL(exit.target); target = normalizePageContext({ url: url.href, hostname: url.hostname, pathname: url.pathname }); } catch (_) {}
    if (target && cbPageLead(target, groups, usageTimersMs, groupSnoozes, now)) {
      exit.action = "cover";
      exit.target = "";
    }
  }

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
    // No Snooze on the cover while the group is enforce-only (Mac Vault away).
    allowSnooze: lead.groupType !== "custom" && lead.allowSnooze !== false && !cbEnforceOnly(lead),
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
    const timeWindows = parseTimeWindowsText(group.timeWindowsText).normalizedLines;
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

// The next moment the enforcement state can change on its own (a schedule
// window, a budget period, a snooze phase, a pause pass): the transition alarm.
async function cbScheduleTransitions() {
  const now = Date.now();
  const { groups, usageResetAtMs, usageBucketsMs, groupSnoozes } = await getState();
  await scheduleNextTransitionAlarm(groups, usageResetAtMs, groupSnoozes, now, usageBucketsMs);
}

// A page session that blocks and shows nothing.
function cbEmptySession() {
  return { showTimer: false, shouldExitPage: false, items: [], feedFilters: [], surfaceHides: [], feedOrder: [], exit: null, now: Date.now() };
}

async function applyElapsedTime(pageContextInput, elapsedMs, exposedGroupIdsInput, passedGroupIds = new Set()) {
  const pageContext = normalizePageContext(pageContextInput);
  const exposedGroupIds = Array.isArray(exposedGroupIdsInput)
    ? exposedGroupIdsInput.filter((id) => typeof id === "string")
    : [];
  if (!pageContext.hostname) return cbEmptySession();

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
    groupSnoozeTotalsMs,
    didApplyResets
  } = await getState();

  if (didApplyResets) await cbScheduleTransitions();

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
  if (accrualGroups.length === 0 || current.exit || boundedElapsedMs === 0) return current;

  const nextTimers = { ...usageTimersMs };
  const nextBuckets = { ...(usageBucketsMs ?? {}) };
  const bucketDeltas = {};
  // What running budget snoozes gave in this step (counted as it is used).
  const snoozeGiven = {};
  let changed = false;
  let bucketsChanged = false;
  let reachedLimit = false;

  // Linked groups while the hub is away: this browser runs them and keeps the
  // time apart for the hand-over (cbHandOverOfflineUsage).
  const hubAway = !cbConnection.desktopRouteIsReady();
  const offlineDeltas = {};
  for (const group of accrualGroups) {
    const currentValue = nextTimers[group.id] ?? 0;
    const thresholdMs = CBGroupActions.effectiveAllowedMs(group, groupSnoozes[group.id], now);
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
        if (hubAway && cbGroupInLink(group)) offlineDeltas[group.id] = { ms: 0, buckets: { [minute]: added } };
      }
      nextBuckets[group.id] = cbPruneUsageBuckets(buckets, group, now);
      bucketsChanged = true;
      nextValue = cbBucketsUsedMs(nextBuckets[group.id]);
      snoozeGiven[group.id] = CBGroupActions.snoozeGivenMs(group, groupSnoozes[group.id], currentValue, added, now);
    } else {
      nextValue = Math.min(currentValue + groupElapsedMs, thresholdMs);
      if (hubAway && nextValue > currentValue && cbGroupInLink(group)) offlineDeltas[group.id] = { ms: nextValue - currentValue };
      snoozeGiven[group.id] = CBGroupActions.snoozeGivenMs(group, groupSnoozes[group.id], currentValue, nextValue - currentValue, now);
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
    const given = Object.entries(snoozeGiven).filter(([, ms]) => ms > 0);
    if (given.length) {
      const totals = { ...groupSnoozeTotalsMs };
      for (const [id, ms] of given) totals[id] = (Number(totals[id]) || 0) + ms;
      writes[GROUP_SNOOZE_TOTALS_KEY] = totals;
    }
    await chrome.storage.local.set(writes);
    // Report accrual to the hub so clustered Default groups keep one shared
    // live budget even while this browser's popup is closed.
    cbReportClusterUsage(accrualGroups, nextTimers, usageResetAtMs, bucketDeltas, nextBuckets);
    await cbRecordOfflineUsage(offlineDeltas, usageResetAtMs);
  }
  if (reachedLimit) {
    await cbScheduleTransitions();
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

// After an update the old pages' content scripts are gone (their covers can no
// longer snooze or lift): every blocked tab is reloaded, so the new extension
// decides it again (owner 2026-09-27). A tab the old worker muted (Chrome names
// the extension that muted it) was covered, so it is reloaded too, and adopted
// so the new load unmutes it.
async function cbReloadBlockedTabsAfterUpdate() {
  await cbCoverStateReady;
  const tabs = await chrome.tabs.query({});
  const { groups, usageTimersMs, groupSnoozes } = await getState();
  const now = Date.now();
  let adopted = false;
  for (const tab of tabs) {
    if (typeof tab?.id !== "number" || !/^https?:/i.test(tab.url || "")) continue;
    const info = tab.mutedInfo;
    const mutedByUs = Boolean(info?.muted && info.reason === "extension" && info.extensionId === chrome.runtime.id);
    if (mutedByUs && !cbMutedTabs.has(tab.id)) { cbMutedTabs.add(tab.id); adopted = true; }
    let blocked = false;
    try {
      const url = new URL(tab.url);
      blocked = Boolean(cbPageLead(normalizePageContext({ url: url.href, hostname: url.hostname, pathname: url.pathname }), groups, usageTimersMs, groupSnoozes, now));
    } catch (_) {}
    if (blocked || mutedByUs) chrome.tabs.reload(tab.id).catch(() => {});
  }
  if (adopted) cbSaveCoverState();
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details?.reason === "update") cbReloadBlockedTabsAfterUpdate().catch(() => {});
  // Migrations run first so the transition alarm sees the post-migration
  // groups.
  runInstallMigrations(details)
    .then(() => cbScheduleTransitions())
    .catch((error) => {
      console.error("Failed to schedule transitions on install.", error);
    });
});

chrome.runtime.onStartup.addListener(() => {
  cbScheduleTransitions().catch((error) => {
    console.error("Failed to schedule transitions on startup.", error);
  });
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
    .then(() => cbScheduleTransitions())
    .then(() => cbRecheckEnforcement())
    .catch((error) => {
      console.error("Failed to schedule transitions after alarm.", error);
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
        cbScheduleTransitions().catch(() => {});
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

  // The rules' panels for this page (every page's, and this tab's own).
  if (message?.type === "get-custom-panels") {
    ensureStartupGate().then(() => {
      const tabId = sender?.tab?.id ?? null;
      const panels = [];
      for (const [groupId, list] of cbRulePanels) {
        if (cbRuleSuppressed.has(groupId)) continue;
        for (const panel of list) if (panel.tabId === undefined || panel.tabId === tabId) panels.push(panel);
      }
      sendResponse({ ok: true, panelSnapshots: panels, panelGroups: [...cbRulePanels.keys()] });
    }).catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  // The page's one session message: its decision, timers and filters, plus
  // the visible time since the last one (0 when it only asks, e.g. on load or
  // after a navigation or a push).
  if (message?.type === "page-session") {
    const tabId = sender?.tab?.id ?? null;
    const tabUrl = sender?.tab?.url || sender?.url || "";
    const heartbeatElapsedMs = Math.max(0, Number(message.elapsedMs) || 0);
    const heartbeatExposedIds = Array.isArray(message.exposedGroupIds)
      ? message.exposedGroupIds
      : [];
    queueUsageTimerUpdate(() =>
      cbCoverStateReady.then(() =>
        applyElapsedTime(message.pageContext, heartbeatElapsedMs, heartbeatExposedIds, cbPausePassedGroups(tabId, hostnameOf(tabUrl)))
      )
    )
      .then((payload) => {
        // The rules' "visible" time, and what the page collects for them.
        if (typeof tabId === "number" && heartbeatElapsedMs > 0) {
          dispatchRule("visible", { tabId, url: tabUrl, elapsedMs: heartbeatElapsedMs }).catch(() => {});
        }
        sendResponse(payload && {
          ...payload,
          ruleItems: cbRulesHandle("items") ? cbRuleItemsEpoch : 0,
          ruleVisible: cbRulesHandle("visible"),
          ruleSheets: typeof tabId === "number" ? cbSheetsForTab(tabId) : []
        });
      })
      .catch((error) => {
        // Fail closed: no answer keeps the page's last decision (an empty
        // session would lift a cover).
        console.error("Failed to track page time.", error);
        sendResponse(null);
      });
    return true;
  }

  return undefined;
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
//                 runs in Safari Vault's native extension over native
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

// The rules' tick comes from the offscreen document; the old one-minute tick
// alarm (before 2026-09-27) would only wake the worker for nothing.
chrome.alarms?.clear?.("custom-blocker-event-tick");

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
  if (!group || CBGroupActions.isLocked(group) || cbEnforceOnly(group)) return { enabled: false, groupId: "", groupName: "" };
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

// A custom group's Snooze (the editor's button, or a tool): the rule's
// "snooze" event (the rule decides what it means).
async function cbFireSnoozePress(groupId) {
  return dispatchRule("snooze", {}, { targetGroupId: groupId });
}

// The popup's snooze entry, built here for the cover's Snooze button. The
// cover runs the group's confirmation steps itself; the worker stores the
// entry, re-syncs blocking and shares it with linked members (newest start
// wins there, exactly like a snooze started in the popup).
async function cbStartSnooze(groupId, now = Date.now()) {
  const { groups, groupSnoozes, usageResetAtMs } = await getState();
  const group = groups.find((item) => item.id === groupId);
  if (!group) throw new Error("group-not-found");
  if (cbEnforceOnly(group)) throw new Error("desktop-vault-away");
  const plan = CBGroupActions.snoozePlan(group, groupSnoozes[group.id], now);
  if (plan.error) throw new Error(plan.error);
  const entry = CBGroupActions.snoozeEntry(group, now, usageResetAtMs[group.id]);
  const next = { ...groupSnoozes, [group.id]: entry };
  await chrome.storage.local.set({ [GROUP_SNOOZES_KEY]: next });
  return entry;
}

// A snooze change reaches linked members at once (the newest change wins).
function cbShareSnooze(group, entry, now) {
  try {
    cbConnection.sendWS({
      kind: "group-sync",
      program: cbDetectProgramId(),
      groupId: group.id,
      ts: now,
      snooze: entry,
      snoozeTs: CBGroupActions.snoozeChangedAtMs(entry)
    });
  } catch (_) {}
}
const pendingApplyByTab = new Map(); // tabId -> Array<applyMessage>
const PENDING_APPLY_MAX_PER_TAB = 32;

// chrome.storage.session is a TRUSTED_CONTEXTS-only key/value store that
// survives MV3 service-worker idle restarts but is cleared when the
// browser process exits. Mirroring previousTabUrls + pendingApplyByTab
// there lets us recover from a SW restart without dropping the
// "previous URL" memory the rules' "tab" event carries (previousUrl /
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
const logFeeds = new Map(); // groupId -> that rule's v.log entries
let logFeedSeq = 0;

// Rate-limit defense in depth: even with sandbox-side caps, a misbehaving
// rule (or a swarm of legitimate ones) can still produce many log entries
// in a single dispatch. We cap per-second IPC fan-out so the popup
// renderer never gets pummeled.
const LOG_FEED_BURST_PER_SEC = 50;
const LOG_FEED_MAX_MESSAGE_BYTES = 4096;
const logFeedBursts = new Map();

function pushLogFeedEntry(entry) {
  if (!entry || entry.source !== "v.log" || typeof entry.groupId !== "string" || !entry.groupId) return;
  const now = Date.now();
  let burst = logFeedBursts.get(entry.groupId);
  if (!burst || now - burst.start > 1000) {
    burst = { start: now, count: 0 };
    logFeedBursts.set(entry.groupId, burst);
  }
  if (burst.count >= LOG_FEED_BURST_PER_SEC) {
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
  burst.count += 1;
  const record = {
    id: ++logFeedSeq,
    ts: now,
    source: "v.log",
    level: "log",
    groupId: entry.groupId || "",
    eventType: entry.eventType || "",
    message
  };
  const feed = logFeeds.get(entry.groupId) || [];
  feed.push(record);
  if (feed.length > LOG_FEED_MAX_ENTRIES) feed.splice(0, feed.length - LOG_FEED_MAX_ENTRIES);
  logFeeds.set(entry.groupId, feed);
  // Best-effort broadcast. Popups that aren't open simply ignore it; the
  // catch silences "Receiving end does not exist" noise.
  try {
    chrome.runtime.sendMessage({ type: "log-feed-entry", entry: record }).catch(() => {});
  } catch (_) {}
}

// Collection diagnostics never include page text, titles, creator identities,
// URLs, or entry IDs. They make the local collection hops inspectable in the
// developer console without creating browser-side browsing data.
function recordVaultClassifierDiagnostic(entry) {
  if (!entry || typeof entry !== "object") return;
  const event = typeof entry.event === "string" && /^[a-z0-9-]{1,64}$/.test(entry.event) ? entry.event : "invalid-event";
  const platform = typeof entry.platform === "string" && /^[a-z0-9-]{1,64}$/.test(entry.platform) ? entry.platform : "unknown";
  const detail = typeof entry.detail === "string" && /^[a-z0-9-]{1,64}$/.test(entry.detail) ? entry.detail : "";
  const outcome = typeof entry.outcome === "string" && /^[a-z0-9-]{1,32}$/.test(entry.outcome) ? entry.outcome : "unknown";
  const isFailure = event.endsWith("failed") || event.endsWith("rejected") || outcome === "unavailable" || outcome === "rejected";
  (isFailure ? cbDebugWarn : cbDebugLog)("[Vault collection]", platform, event, detail, outcome);
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
      lastAbortReason: String(reason || "unknown")
    };
    await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: groups });
    return true;
  } catch (error) {
    console.warn("[CustomBlocker] quarantineGroup failed", error);
    return false;
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
// separate Safari containing app's native handler, which runs the rule in
// JavaScriptCore and returns the same { ok, result } shape the in-browser
// sandbox produces. Any DOM/redirect intents in the reply are applied by
// the caller exactly as for the offscreen path.
async function sendToEventSandboxNative(payload) {
  try {
    // The native journal survives Safari background restarts. Prune deleted
    // groups before restoring it, using browser storage as the authority.
    const stored = await chrome.storage.local.get({ [BLOCKED_GROUPS_KEY]: [] });
    const groups = stored[BLOCKED_GROUPS_KEY];
    const groupIds = [...new Set((Array.isArray(groups) ? groups : [])
      .filter((group) => group?.groupType === "custom" && typeof group.id === "string" && group.id.length > 0)
      .map((group) => group.id))];
    const message = { type: "event-sandbox-request", payload: { ...payload, groupIds } };
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

// ── Custom rules (rule-core.js is the rule contract) ────────────────────────
// The worker loads each enabled custom group's rule into the sandbox, sends
// it the browser's events and carries out what it asks (v.* actions).
const CB_RULE_STATE_KEY = "cbRuleState";
const CB_RULE_PANELS_KEY = "cbRulePanels";
// The event types each loaded rule handles: an event nobody handles is not sent.
const cbRuleTypes = new Map(); // groupId -> Set<type>
// The rules' panels on screen: groupId -> [panel] (a panel with a tabId shows on that tab only).
const cbRulePanels = new Map();
// The rules' style sheets (v.css): groupId -> Map(id -> { tabId, css }); a
// tab's sheet lasts until that tab goes to another address, a "*" sheet is on
// every page, those opened later too. Pages get theirs from the worker.
const CB_RULE_SHEETS_KEY = "cbRuleSheets";
const cbRuleSheets = new Map();
// Disabled groups: their rule stays loaded but hears nothing, and what it did
// is lifted until the group is enabled again (owner 2026-09-27).
const cbRuleSuppressed = new Set();

// Bumped whenever a rule that handles "items" loads: pages then send every
// item again, so the new rule sees what is already on screen.
let cbRuleItemsEpoch = Date.now(); // a restarted worker differs from the last one

function cbRulesHandle(type) {
  for (const [groupId, types] of cbRuleTypes) if (!cbRuleSuppressed.has(groupId) && types.has(type)) return true;
  return false;
}

// The sheets a tab's page carries: every enabled rule's "*" sheets and those
// for this tab, as [{ key, css }].
function cbSheetsForTab(tabId) {
  const sheets = [];
  for (const [groupId, byId] of cbRuleSheets) {
    if (cbRuleSuppressed.has(groupId)) continue;
    for (const [id, sheet] of byId) {
      if (sheet.tabId === "*" || sheet.tabId === tabId) sheets.push({ key: groupId + "␟" + id, css: sheet.css });
    }
  }
  return sheets;
}

function cbSaveRuleSheets() {
  const out = {};
  for (const [groupId, byId] of cbRuleSheets) out[groupId] = Object.fromEntries(byId);
  chrome.storage.session?.set({ [CB_RULE_SHEETS_KEY]: out }).catch?.(() => {});
}

// Sends each open page its sheets (all pages, or one tab's).
async function cbPushRuleSheets(tabId = "*") {
  if (tabId !== "*") return trySendApply(tabId, { type: "rule-sheets", sheets: cbSheetsForTab(tabId) }).catch(() => false);
  const tabs = chrome.tabs?.query ? await chrome.tabs.query({}) : [];
  await Promise.all(tabs.filter((tab) => typeof tab?.id === "number" && /^https?:/i.test(tab.url || tab.pendingUrl || ""))
    .map((tab) => trySendApply(tab.id, { type: "rule-sheets", sheets: cbSheetsForTab(tab.id) }).catch(() => false)));
}

// A tab went to another address (or closed): its own sheets end there.
function cbDropTabSheets(tabId) {
  let dropped = false;
  for (const byId of cbRuleSheets.values()) {
    for (const [id, sheet] of byId) if (sheet.tabId === tabId) { byId.delete(id); dropped = true; }
  }
  if (dropped) cbSaveRuleSheets();
  return dropped;
}

// Disable / enable a group's rule. Disabled: it hears nothing and its panels,
// sheets, covers and card verdicts are lifted. Enabled: it resumes as it was;
// its standing panels and sheets come back and pages resend their items.
async function cbSuppressRule(groupId, on) {
  // The sandbox is always told (a reset sandbox starts with nothing suppressed).
  await sendToEventSandbox({ kind: "suppress-group", groupId, on });
  if (on === cbRuleSuppressed.has(groupId)) return;
  const pageNeeds = cbRulePageNeeds();
  if (on) cbRuleSuppressed.add(groupId);
  else cbRuleSuppressed.delete(groupId);
  if (on) await cbSendToWebPages({ type: "rule-lift", groupId });
  else if (cbRuleTypes.get(groupId)?.has("items")) cbRuleItemsEpoch += 1;
  if (cbRuleSheets.has(groupId)) await cbPushRuleSheets();
  await broadcastCustomPanelRefresh([groupId]);
  if (cbRulePageNeeds() !== pageNeeds) await broadcastSessionRefresh();
}

// What pages collect for the rules: items (0 = none, else the epoch) and
// whether the visible time is wanted.
function cbRulePageNeeds() {
  return (cbRulesHandle("items") ? cbRuleItemsEpoch : 0) + "," + cbRulesHandle("visible");
}

function cbSetRulePanels(groupId, panels) {
  if (panels && panels.length > 0) cbRulePanels.set(groupId, panels);
  else if (!cbRulePanels.delete(groupId)) return;
  chrome.storage.session?.set({ [CB_RULE_PANELS_KEY]: Object.fromEntries(cbRulePanels) }).catch?.(() => {});
  broadcastCustomPanelRefresh([groupId]).catch(() => {});
}

// Loads a group's rule with its stored memory; `run` (the Run button) also
// replaces the rule's panels.
async function loadCustomGroupSource(group, { run = false } = {}) {
  if (!group || group.groupType !== "custom") return null;
  const source = typeof group.activeEventSource === "string" ? group.activeEventSource : "";
  const pageNeeds = cbRulePageNeeds();
  let result;
  if (!source.trim()) {
    result = await unloadCustomGroupHandlers(group.id);
    result = result ? { ok: true, handlers: 0, error: null } : null;
  } else {
    const stored = ((await chrome.storage.local.get({ [CB_RULE_STATE_KEY]: {} }))[CB_RULE_STATE_KEY] || {})[group.id] || {};
    result = await sendToEventSandbox({ kind: "load-source", groupId: group.id, source, state: stored, run });
    if (result) {
      for (const entry of result.logs || []) pushLogFeedEntry({ ...entry, eventType: "run" });
      if (!result.ok && result.error) cbDebugError("[Vault rule]", group.id, "run", result.error);
      if (result.quarantine) quarantineGroup(group.id, result.quarantine.reason || "load-source-timeout").catch(() => {});
      // A rule that didn't load leaves the one before it running.
      if (result.ok) {
        cbRuleTypes.set(group.id, new Set(Array.isArray(result.types) ? result.types : []));
        // Run starts the panels over; a reload of the same rule (a restarted
        // worker) keeps the ones on screen until the rule changes them.
        if (run || !cbRulePanels.has(group.id)) cbSetRulePanels(group.id, Array.isArray(result.panels) ? result.panels : []);
        if (cbRuleTypes.get(group.id).has("items")) cbRuleItemsEpoch += 1;
      }
    }
  }
  // Pages collect feed items / count visible time only while a rule wants them.
  if (cbRulePageNeeds() !== pageNeeds) broadcastSessionRefresh().catch(() => {});
  // A disabled group's rule is loaded, but suppressed.
  if (result?.ok && cbRuleTypes.has(group.id)) await cbSuppressRule(group.id, !group.enabled);
  return result;
}

async function unloadCustomGroupHandlers(groupId) {
  cbRuleTypes.delete(groupId);
  cbRuleSuppressed.delete(groupId);
  cbSetRulePanels(groupId, null);
  const hadSheets = cbRuleSheets.delete(groupId);
  if (hadSheets) { cbSaveRuleSheets(); cbPushRuleSheets().catch(() => {}); }
  // What it did on pages is lifted too.
  cbSendToWebPages({ type: "rule-lift", groupId }).catch(() => {});
  return sendToEventSandbox({ kind: "unload-group", groupId });
}

// One event to the rules that handle it (or to one group's rule).
async function dispatchRule(type, data, { targetGroupId = null } = {}) {
  await ensureStartupGate();
  if (targetGroupId ? !cbRuleTypes.has(targetGroupId) : !cbRulesHandle(type)) return null;
  const result = await sendToEventSandbox({ kind: "dispatch-event", descriptor: { type, now: Date.now(), data, targetGroupId } });
  await applyRuleResult(result, type);
  return result;
}

// What a dispatch asked for: logs, a runaway group's quarantine, changed
// state and panels, and the actions (per tab to its page, or by the worker).
async function applyRuleResult(result, eventType) {
  if (!result) return;
  // A group can be deleted or disabled while an asynchronous dispatch runs.
  // Stale native/offscreen replies cannot recreate its state or act on tabs.
  const snapshot = await chrome.storage.local.get({ [BLOCKED_GROUPS_KEY]: [], [CB_RULE_STATE_KEY]: {} });
  const groups = Array.isArray(snapshot[BLOCKED_GROUPS_KEY]) ? snapshot[BLOCKED_GROUPS_KEY] : [];
  const current = new Map(groups.filter((group) => group?.groupType === "custom").map((group) => [group.id, group]));
  for (const entry of result.logs || []) if (current.has(entry.groupId)) pushLogFeedEntry({ ...entry, eventType });
  for (const entry of result.diagnostics || []) if (current.has(entry.groupId)) cbDebugError("[Vault rule]", entry.groupId, eventType, ...(entry.args || []));
  if (result.quarantine && current.has(result.quarantine.groupId)) {
    quarantineGroup(result.quarantine.groupId, result.quarantine.reason || "deadline-overrun").catch(() => {});
  }
  const states = Object.fromEntries(Object.entries(result.states && typeof result.states === "object" ? result.states : {})
    .filter(([groupId]) => current.has(groupId)));
  if (Object.keys(states).length > 0) {
    const stored = snapshot[CB_RULE_STATE_KEY] || {};
    await chrome.storage.local.set({ [CB_RULE_STATE_KEY]: { ...stored, ...states } });
  }
  for (const [groupId, panels] of Object.entries(result.panels || {})) if (current.has(groupId)) cbSetRulePanels(groupId, panels);
  const pages = new Map(); // tabId | "*" -> { items, dom, queries, cover }
  const sheetTabs = new Set(); // tabs (or "*") whose sheets changed
  const page = (tabId) => {
    if (!pages.has(tabId)) pages.set(tabId, { type: "rule-apply", items: [], dom: [], queries: [], cover: null });
    return pages.get(tabId);
  };
  for (const action of result.actions || []) {
    const { groupId, kind, tabId } = action || {};
    if (!current.get(groupId)?.enabled) continue;
    try {
      if (kind === "item") page(tabId).items.push({ groupId, ref: action.ref, verdict: action.verdict });
      else if (kind === "cover") page(tabId).cover = { groupId, on: action.on, message: action.message };
      else if (kind === "css") {
        const byId = cbRuleSheets.get(groupId) || new Map();
        if (action.css === null) byId.delete(action.id);
        else byId.set(action.id, { tabId, css: action.css });
        if (byId.size > 0) cbRuleSheets.set(groupId, byId);
        else cbRuleSheets.delete(groupId);
        sheetTabs.add(tabId);
      }
      else if (kind === "dom") page(tabId).dom.push({ selector: action.selector, op: action.op, arg: action.arg });
      else if (kind === "query") page(tabId).queries.push({ groupId, requestId: action.requestId, selector: action.selector });
      else if (kind === "close") await chrome.tabs.remove(tabId);
      else if (kind === "go") {
        if (action.target === "back") await chrome.tabs.goBack(tabId);
        else if (action.target === "forward") await chrome.tabs.goForward(tabId);
        else if (action.target === "reload") await chrome.tabs.reload(tabId);
        else if (/^https?:/i.test(action.target)) await chrome.tabs.update(tabId, { url: action.target });
      } else if (kind === "file") cbRunRuleFile(action).catch(() => {});
    } catch (_) {}
  }
  for (const [tabId, message] of pages) {
    if (tabId === "*") await cbSendToWebPages(message);
    else if (!(await trySendApply(tabId, message))) enqueueApply(tabId, message);
  }
  if (sheetTabs.size > 0) {
    cbSaveRuleSheets();
    if (sheetTabs.has("*")) await cbPushRuleSheets();
    else for (const tabId of sheetTabs) await cbPushRuleSheets(tabId);
  }
}

// A rule's file request, through the folder broker; its answer is the rule's
// "file" event.
async function cbRunRuleFile(action) {
  const op = String(action.op || "");
  const payload = action.payload;
  const answer = await sendToLocalFileBroker({
    action: op,
    path: action.path,
    directoryPath: op === "list" ? action.path : "",
    text: typeof payload === "string" ? payload : payload === null || payload === undefined ? "" : JSON.stringify(payload),
    requestId: action.requestId
  });
  const data = { requestId: action.requestId, op, path: action.path, ok: Boolean(answer?.ok), text: answer?.text ?? null,
    entries: answer?.entries ?? null, exists: answer?.exists ?? null, error: answer?.error || "" };
  await dispatchRule("file", data, { targetGroupId: action.groupId });
}

let lastReconcileSnapshot = new Map();

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
  // Groups whose rule changed are loaded; groups only turned on/off are
  // suppressed or resumed (the rule stays loaded).
  for (const [groupId, snapshot] of next.entries()) {
    const before = previous.get(groupId);
    const group = newGroups.find((g) => g.id === groupId);
    if (!before || before.activeEventSource !== snapshot.activeEventSource) {
      // A load the sandbox never answered isn't recorded: the next change retries it.
      if (!(await loadCustomGroupSource(group))) next.delete(groupId);
    } else if (before.enabled !== snapshot.enabled && cbRuleTypes.has(groupId)) {
      await cbSuppressRule(groupId, !snapshot.enabled);
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
    const stored = (await chrome.storage.session?.get({ [CB_RULE_PANELS_KEY]: {} }))?.[CB_RULE_PANELS_KEY] || {};
    for (const [groupId, panels] of Object.entries(stored)) if (Array.isArray(panels)) cbRulePanels.set(groupId, panels);
    const sheets = (await chrome.storage.session?.get({ [CB_RULE_SHEETS_KEY]: {} }))?.[CB_RULE_SHEETS_KEY] || {};
    for (const [groupId, byId] of Object.entries(sheets)) {
      if (byId && typeof byId === "object") cbRuleSheets.set(groupId, new Map(Object.entries(byId)));
    }
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
      withSource
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

function hostnameOf(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function sendToLocalFileBroker(request) {
  if (sandboxTransportMode() === "native") {
    try {
      const response = await chrome.runtime.sendNativeMessage(NATIVE_HOST_APPLICATION_ID, { type: "local-file-request", request });
      if (response && response.ok && response.result) return response.result;
      return { ok: false, requestId: request?.requestId || "", error: response?.error || "local-file-broker-unavailable" };
    } catch (error) {
      return { ok: false, requestId: request?.requestId || "", error: String(error?.message || error || "local-file-error") };
    }
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
  return isPlatformBlockEnforcing(group, usageTimersMs, groupSnoozes, now);
}

function cbEnforcementState(groups, usageTimersMs, groupSnoozes, now) {
  return JSON.stringify({
    // In effect (a schedule window opening starts a page's timer) and
    // enforcing (its lines block).
    groups: groups.map((group) => [
      group.id,
      cbGroupActive(group, groupSnoozes, now),
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

// Sends one message to every open web page.
async function cbSendToWebPages(message) {
  if (!chrome.tabs || !chrome.tabs.query) return;
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (!tab || typeof tab.id !== "number") return;
      const url = tab.url || tab.pendingUrl || "";
      if (url && !/^https?:/i.test(url)) return;
      await trySendApply(tab.id, message);
    })
  );
}

// Asks every open page to re-fetch its session (cover, timers, feed filters).
function broadcastSessionRefresh() {
  return cbSendToWebPages({ type: "session-refresh" });
}

function broadcastCustomPanelRefresh(panelGroups = []) {
  return cbSendToWebPages({ type: "custom-panels-refresh", panelGroups });
}

// Tab watchers: a rule's "tab" event.
if (chrome.tabs && chrome.tabs.onCreated) {
  chrome.tabs.onCreated.addListener((tab) => {
    if (!tab || typeof tab.id !== "number") return;
    previousTabUrls.delete(tab.id);
    scheduleSessionFlush();
    dispatchRule("tab", { kind: "open", tabId: tab.id, url: tab.url || tab.pendingUrl || "", previousUrl: null }).catch(() => {});
  });
}

if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    const previous = previousTabUrls.get(tabId);
    previousTabUrls.delete(tabId);
    cbCoveredTabs.delete(tabId);
    let dropped = cbMutedTabs.delete(tabId);
    for (const key of [...cbPausePasses.keys()]) {
      if (key.startsWith(`${tabId}␟`)) { cbPausePasses.delete(key); dropped = true; }
    }
    if (dropped) cbSaveCoverState();
    // Apply messages queued for it will never be drained.
    pendingApplyByTab.delete(tabId);
    cbDropTabSheets(tabId);
    scheduleSessionFlush();
    dispatchRule("tab", { kind: "close", tabId, url: previous?.url || "", previousUrl: null }).catch(() => {});
  });
}

async function handleCommittedWebNavigation(details, transition = "commit") {
  if (!details || details.frameId !== 0) return;
  const tabId = details.tabId;
  if (typeof tabId !== "number" || tabId < 0) return;

  // A new document has no cover: the old page's cover and the tab mute it
  // brought end here (the new page reports its own cover when it has one).
  if (transition === "commit") await cbCoverStateReady;
  if (transition === "commit" && (cbCoveredTabs.has(tabId) || cbMutedTabs.has(tabId))) {
    await cbSetTabCovered(tabId, false);
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
  // don't spam the rules' \"tab\" event; genuine reloads still arrive via onCommitted.
  if (transition === "history" && previous && previousUrl === nextUrl) return;
  // The page's one navigation signal: its address changed without a load.
  if (transition === "history") trySendApply(tabId, { type: "page-navigated" }).catch(() => {});

  previousTabUrls.set(tabId, { url: nextUrl, hostname: nextHost });
  scheduleSessionFlush();
  // A rule's sheet for this tab belonged to the old address.
  if (previousUrl !== nextUrl && cbDropTabSheets(tabId)) cbPushRuleSheets(tabId).catch(() => {});

  await dispatchRule("tab", { kind: "navigate", tabId, url: nextUrl, previousUrl });
}

if (chrome.webNavigation && chrome.webNavigation.onCommitted) {
  chrome.webNavigation.onCommitted.addListener((details) => {
    handleCommittedWebNavigation(details, "commit").catch((error) => {
      try { console.warn("[CustomBlocker] committed navigation dispatch failed", error); } catch (_) {}
    });
  });
}

// In-page navigations (history API, a new #hash) — so single-page app route
// changes (e.g. YouTube home → /shorts/...) reach the rules and the page.
for (const event of ["onHistoryStateUpdated", "onReferenceFragmentUpdated"]) {
  if (!chrome.webNavigation || !chrome.webNavigation[event]) continue;
  chrome.webNavigation[event].addListener((details) => {
    handleCommittedWebNavigation(details, "history").catch((error) => {
      try { console.warn("[CustomBlocker] history navigation dispatch failed", error); } catch (_) {}
    });
  });
}

// The rules' "tick", every second (offscreen.js drives it): the open tabs.
// Safari has no offscreen document to ping every second: its background
// page ticks the rules itself while it runs.
let cbSafariLastTickMs = 0;
let cbSafariTickRunning = false;
function cbSafariLifetimeTick() {
  if (sandboxTransportMode() !== "native") return;
  const now = Date.now();
  if (cbSafariTickRunning || now - cbSafariLastTickMs < 950) return;
  cbSafariLastTickMs = now;
  cbSafariTickRunning = true;
  // A Safari content heartbeat wakes its nonpersistent background page.
  // Re-establish the normal authenticated route; never start another socket.
  if (typeof cbConnection !== "undefined" && cbConnection.desired && !cbConnection.ws && !cbConnection.reconnectTimer) cbConnection.connect();
  emitRuleTick().catch(() => {}).finally(() => { cbSafariTickRunning = false; });
}
self.CBSafariLifetimeTick = cbSafariLifetimeTick;
if (sandboxTransportMode() === "native") setInterval(cbSafariLifetimeTick, 1000);

async function emitRuleTick() {
  if (!cbRulesHandle("tick")) return;
  const tabs = await chrome.tabs.query({});
  await dispatchRule("tick", {
    tabs: tabs.filter((tab) => typeof tab?.id === "number").map((tab) => ({ tabId: tab.id, url: tab.url || "", active: Boolean(tab.active) }))
  });
}

// Run (the editor's button and the AI tool): the text becomes the group's
// rule — keeping its memory (v.state, owner 2026-09-27) — and re-enables a
// group an overrun disabled. A rule that doesn't load changes nothing — the one running before
// keeps running — and its load result says why. A frozen group is refused.
async function cbRunCustomGroup(groupId, source) {
  await ensureStartupGate();
  await cbClusterCopyReady;
  const find = async () => {
    const groups = (await chrome.storage.local.get(BLOCKED_GROUPS_KEY))[BLOCKED_GROUPS_KEY];
    const list = Array.isArray(groups) ? groups : [];
    return { groups: list, index: list.findIndex((g) => g && g.id === groupId) };
  };
  const before = await find();
  const group = before.groups[before.index];
  if (!group || group.groupType !== "custom") throw new Error("group-not-found");
  if (CBGroupActions.isLocked(group) || cbEnforceOnly(group)) throw new Error("group-locked");
  const fields = { enabled: true, blockingRulesText: source, activeEventSource: source, lastAbortReason: null };
  const loadResult = await loadCustomGroupSource({ ...group, ...fields }, { run: true });
  if (!loadResult || !loadResult.ok) return loadResult || { ok: false, error: "sandbox-timeout" };
  // The load took a while: write onto what is stored now.
  const { groups, index } = await find();
  if (index < 0) throw new Error("group-not-found");
  groups[index] = { ...groups[index], ...fields };
  // Loaded here, so the write's own reconcile finds it already loaded.
  lastReconcileSnapshot.set(groupId, { enabled: true, activeEventSource: source });
  await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: groups });
  return loadResult;
}

// The editor's rule requests and the pages' rule messages.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.type === "run-custom-group") {
    cbRunCustomGroup(String(message.groupId || ""), typeof message.source === "string" ? message.source : "")
      .then((loadResult) => sendResponse({ ok: true, loadResult }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }


  if (message.type === "get-log-feed") {
    sendResponse({ ok: true, entries: (logFeeds.get(message.groupId) || []).slice() });
    return false;
  }

  if (message.type === "clear-log-feed") {
    logFeeds.delete(message.groupId);
    logFeedBursts.delete(message.groupId);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "safari-lifecycle-tick" && sandboxTransportMode() === "native") {
    cbSafariLifetimeTick();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "offscreen-tick") {
    emitRuleTick().catch(() => {});
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
    sendResponse({ ok: true, pending: queued });
    return false;
  }

  if (message.type === "reset-group-runtime") {
    cbResetGroupRuntime(String(message.groupId || ""))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (message.type === "fire-snooze-press") {
    // A custom group's Snooze: the rule's "snooze" event (the rule decides).
    (async () => {
      try {
        const groupId = String(message.groupId || "");
        if (!groupId) {
          sendResponse({ ok: false, error: "missing groupId" });
          return;
        }
        const result = await cbFireSnoozePress(groupId);
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


  // A rule's panel interaction: its "panel" event.
  if (message.type === "custom-panel-event") {
    const data = {
      panelId: typeof message.panelId === "string" ? message.panelId : "",
      controlId: typeof message.controlId === "string" ? message.controlId : "",
      eventName: typeof message.eventName === "string" ? message.eventName : "",
      value: message.value ?? null,
      values: message.values && typeof message.values === "object" ? message.values : {}
    };
    dispatchRule("panel", data, { targetGroupId: typeof message.groupId === "string" ? message.groupId : "" })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  // A page's answer to a rule's v.query: that rule's "query" event.
  if (message.type === "rule-query") {
    const tabId = sender?.tab?.id;
    if (typeof tabId !== "number") return false;
    dispatchRule("query", {
      requestId: String(message.requestId || ""),
      tabId,
      url: sender?.tab?.url || sender?.url || "",
      selector: String(message.selector || ""),
      matches: Array.isArray(message.matches) ? message.matches.slice(0, 50) : [],
      error: String(message.error || "")
    }, { targetGroupId: String(message.groupId || "") }).catch(() => {});
    sendResponse({ ok: true });
    return false;
  }

  // A page's feed items (and the page itself) for the rules that want them.
  if (message.type === "rule-items") {
    const tabId = sender?.tab?.id;
    if (typeof tabId !== "number") return false;
    dispatchRule("items", {
      tabId,
      platform: typeof message.platform === "string" ? message.platform : "",
      items: Array.isArray(message.items) ? message.items.slice(0, 500) : []
    }).catch(() => {});
    sendResponse({ ok: true });
    return false;
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
  const { parentalPasswordHash: _hash, parentalPasswordSalt: _salt, ...rest } = group;
  return { ...rest, hasParentalPin: CBGroupActions.hasPin(group) };
}


// The runtime state of stored groups belongs here (the editor writes only its
// groups): an edit that changes how a budget runs restarts it
// (CBGroupActions.budgetRestarts), and a deleted group leaves no per-group
// entry behind — whoever changed the list (the editor, a tool, a link).
async function cbApplyStoredGroupChange(oldValue, newValue) {
  const before = new Map((Array.isArray(oldValue) ? oldValue : []).filter((g) => g && g.id).map((g) => [g.id, g]));
  const after = (Array.isArray(newValue) ? newValue : []).filter((g) => g && g.id);
  const present = new Set(after.map((g) => g.id));
  const restart = after.filter((g) => before.has(g.id) && CBGroupActions.budgetRestarts(before.get(g.id), g)).map((g) => g.id);
  const gone = [...before.keys()].filter((id) => !present.has(id));
  if (restart.length === 0 && gone.length === 0) return cbRenameDuplicates(after);
  const keys = [USAGE_TIMERS_KEY, USAGE_RESET_AT_KEY, USAGE_BUCKETS_KEY, GROUP_SNOOZES_KEY, GROUP_SNOOZE_TOTALS_KEY, CBParentalPin.ATTEMPTS_KEY, CB_OFFLINE_USAGE_KEY, CB_RULE_STATE_KEY, CB_QUICK_ADD_GROUP_KEY];
  const stored = await chrome.storage.local.get(keys);
  const writes = {};
  const edit = (key) => (writes[key] ??= { ...(stored[key] && typeof stored[key] === "object" ? stored[key] : {}) });
  const now = Date.now();
  for (const id of restart) {
    edit(USAGE_TIMERS_KEY)[id] = 0;
    edit(USAGE_RESET_AT_KEY)[id] = now;
    delete edit(USAGE_BUCKETS_KEY)[id];
  }
  for (const id of gone) {
    for (const key of keys.slice(0, -1)) if (stored[key] && id in stored[key]) delete edit(key)[id];
    if (stored[CB_QUICK_ADD_GROUP_KEY] === id) writes[CB_QUICK_ADD_GROUP_KEY] = "";
  }
  if (Object.keys(writes).length) await chrome.storage.local.set(writes);
  await cbRenameDuplicates(after);
}

// Duplicate names are renamed silently; a linked group keeps its name. (After
// the restarts and cleanup above: the rename's own change event then carries
// no policy change.)
async function cbRenameDuplicates(groups) {
  const renamed = CBGroupActions.dedupeNames(groups, [...cbLinkedGroupIds(cbClusterCopy)]);
  if (renamed) await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: renamed });
}

async function cbAnnounceStoredGroups(groups) {
  const list = Array.isArray(groups) ? groups : (await getState()).groups;
  if (!cbConnection.desktopRouteIsReady()) return;
  cbConnection.sendWS({
    kind: "groups-announce",
    program: cbDetectProgramId(),
    groups: list.map((group) => ({ id: group.id, name: group.name, frozen: CBGroupActions.isLocked(group) }))
  });
}

// An imported group starts fresh (owner 2026-09-27): its usage, snooze,
// snooze total and offline time go; a new budget period starts now.
async function cbResetGroupRuntime(groupId) {
  if (!groupId) return;
  const keys = [USAGE_TIMERS_KEY, USAGE_RESET_AT_KEY, USAGE_BUCKETS_KEY, GROUP_SNOOZES_KEY, GROUP_SNOOZE_TOTALS_KEY, CB_OFFLINE_USAGE_KEY];
  const stored = await chrome.storage.local.get(keys);
  const writes = {};
  for (const key of keys) {
    const map = { ...(stored[key] && typeof stored[key] === "object" ? stored[key] : {}) };
    delete map[groupId];
    writes[key] = map;
  }
  writes[USAGE_RESET_AT_KEY][groupId] = Date.now();
  await chrome.storage.local.set(writes);
}

// ── Sharing linked groups (the worker owns it; owner 2026-09-26) ───────────
// A linked group's definition or snooze is shared when its STORED copy
// changes, whoever wrote it — the editor, a tool, the quick-add "+" — as Mac
// Vault does each tick. What the link sends is adopted into storage
// (applySharedToStorage), which records it here first, so it is not echoed.
const cbDefinitionSeen = new Map();
let cbRosterSeen = "";

function cbDefinitionKey(group) {
  const scalars = {};
  for (const field of CB_SYNC_SCALAR_FIELDS) scalars[field] = group[field] ?? null;
  return JSON.stringify({ scalars, scopes: Array.isArray(group.scopes) ? group.scopes : [], lock: CBGroupActions.lockUnit(group) });
}

function cbRosterKey(groups) {
  return JSON.stringify(groups.map((group) => [group.id, group.name, CBGroupActions.isLocked(group)]));
}

const cbSharingReady = (async () => {
  await cbClusterCopyReady;
  try {
    const stored = (await chrome.storage.local.get({ [BLOCKED_GROUPS_KEY]: [] }))[BLOCKED_GROUPS_KEY];
    const groups = Array.isArray(stored) ? stored.filter((group) => group && group.id) : [];
    for (const group of groups) if (!cbDefinitionSeen.has(group.id)) cbDefinitionSeen.set(group.id, cbDefinitionKey(group));
    cbRosterSeen = cbRosterKey(groups);
  } catch (_) {}
})();

function cbSendDefinition(group, ts) {
  const scalars = {};
  for (const field of CB_SYNC_SCALAR_FIELDS) scalars[field] = group[field];
  cbConnection.sendWS({
    kind: "group-sync",
    program: cbDetectProgramId(),
    groupId: group.id,
    ts,
    scalars,
    // Only this browser's own lines (the Apps lines are Mac Vault's), even none.
    scopes: (Array.isArray(group.scopes) ? group.scopes : []).filter((line) => CBGroupScopes.lineOwner(line) === "browser"),
    ...CBGroupActions.lockContribution(group)
  });
}

function cbShareStoredGroups(value) {
  const groups = Array.isArray(value) ? value.filter((group) => group && group.id) : [];
  const roster = cbRosterKey(groups);
  if (roster !== cbRosterSeen) {
    cbRosterSeen = roster;
    cbAnnounceStoredGroups(groups).catch(() => {});
  }
  const present = new Set();
  for (const group of groups) {
    present.add(group.id);
    const key = cbDefinitionKey(group);
    if (cbDefinitionSeen.get(group.id) === key) continue;
    if (cbGroupInLink(group)) {
      // Seen only once sent: a change made while Mac Vault is away is shared
      // when it is back (cbShareOnReconnect).
      if (!cbConnection.desktopRouteIsReady()) continue;
      cbSendDefinition(group, Date.now());
    }
    cbDefinitionSeen.set(group.id, key);
  }
  for (const id of [...cbDefinitionSeen.keys()]) if (!present.has(id)) cbDefinitionSeen.delete(id);
}

async function cbShareOnReconnect() {
  await cbSharingReady;
  const stored = (await chrome.storage.local.get({ [BLOCKED_GROUPS_KEY]: [] }))[BLOCKED_GROUPS_KEY];
  cbShareStoredGroups(stored);
}

// A snooze started or ended here reaches the link as the newest change.
function cbShareStoredSnoozes(value) {
  if (!cbConnection.desktopRouteIsReady()) return;
  const snoozes = value && typeof value === "object" ? value : {};
  const program = cbDetectProgramId();
  for (const cluster of Array.isArray(cbConnection.clusters) ? cbConnection.clusters : []) {
    const member = (cluster?.members || []).find((m) => m && m.program === program);
    const entry = member?.groupId ? snoozes[member.groupId] : null;
    if (!entry || CBGroupActions.snoozeChangedAtMs(entry) <= (Number(cluster.shared?.snoozeTs) || 0)) continue;
    cbShareSnooze({ id: member.groupId }, entry, Date.now());
  }
}

// A group that just joined a link sends its definition once, at ts 0: its
// lines are unioned into the link's and its settings never beat a newer edit.
const cbJoinsSent = new Set();
async function cbContributeJoins() {
  const program = cbDetectProgramId();
  const joining = (Array.isArray(cbConnection.clusters) ? cbConnection.clusters : []).filter((cluster) => {
    const member = (cluster?.members || []).find((m) => m && m.program === program);
    if (member?.contributed !== false) { cbJoinsSent.delete(cluster?.id); return false; }
    return !cbJoinsSent.has(cluster.id);
  });
  if (joining.length === 0) return;
  const stored = (await chrome.storage.local.get({ [BLOCKED_GROUPS_KEY]: [] }))[BLOCKED_GROUPS_KEY];
  const groups = Array.isArray(stored) ? stored : [];
  for (const cluster of joining) {
    const group = self.CBBridgeProtocol.groupForCluster(groups, cluster, program);
    if (!group) continue;
    cbJoinsSent.add(cluster.id);
    cbSendDefinition(group, 0);
  }
}

// Every stored change, whoever wrote it (the editor, a tool, the worker
// itself), is acted on here — the one storage listener.
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    const groupsChange = changes[BLOCKED_GROUPS_KEY];
    const snoozesChange = changes[GROUP_SNOOZES_KEY];
    const settingsChange = changes[CB_GLOBAL_SETTINGS_KEY];
    if (settingsChange) {
      const next = settingsChange.newValue;
      cbDebugMode = next && typeof next === "object" ? next.debugMode === true : false;
    }
    if (groupsChange || snoozesChange) {
      cbScheduleTransitions().catch((error) => {
        console.error("Failed to schedule transitions after storage update.", error);
      });
    }
    if (groupsChange) {
      const retained = new Set((groupsChange.newValue || []).map((group) => group.id));
      for (const id of logFeeds.keys()) if (!retained.has(id)) { logFeeds.delete(id); logFeedBursts.delete(id); }
      reconcileCustomGroupHandlers(groupsChange).catch((error) => {
        console.error("Failed to reconcile custom-group handlers.", error);
      });
      cbSharingReady.then(() => cbShareStoredGroups(groupsChange.newValue)).catch(() => {});
      cbApplyStoredGroupChange(groupsChange.oldValue, groupsChange.newValue).catch(() => {});
    }
    if (snoozesChange) cbShareStoredSnoozes(snoozesChange.newValue);
    if (groupsChange || settingsChange) {
      cbScheduleRecheck({ definitionChanged: true });
    } else if (snoozesChange || changes[USAGE_TIMERS_KEY] || changes[USAGE_RESET_AT_KEY] || changes[USAGE_BUCKETS_KEY]) {
      cbScheduleRecheck();
    }
  });
}

function cbDetectProgramId() {
  let ua = "";
  try { ua = (self.navigator && self.navigator.userAgent) || ""; } catch (_) {}
  return self.CBBridgeProtocol.browserProgramId(ua);
}

// Per-group baseline (the last absolute local usage we reported or folded) so we
// can report ONLY this endpoint's own accrual as a positive delta. It must be
// rebased to the hub's shared total whenever we fold that total into local
// storage (see applySharedToStorage), otherwise another member's contribution
// would be re-reported as ours and double-count.
const cbClusterUsageBaseline = {};

// Owner 2026-09-26: this browser keeps a copy of its links, so while Mac Vault
// is away it still knows which groups are linked. It then runs those groups
// itself and keeps the time it counts for them apart (per budget period);
// when the hub is back that time is handed over as an increment the hub adds
// — two browsers' offline time adds up — and nothing counted is lost.

function cbSaveClusterCopy(clusters) {
  const before = cbLinkedGroupIds(cbClusterCopy);
  cbClusterCopy = Array.isArray(clusters) ? clusters : [];
  const now = cbLinkedGroupIds(cbClusterCopy);
  const left = [...before].filter((id) => !now.has(id));
  if (left.length) cbKeepOwnLines(left).catch(() => {});
  try {
    chrome.storage.local.set({ [CB_CLUSTER_COPY_KEY]: cbClusterCopy.map((c) => ({ id: c.id, groupName: c.groupName, members: c.members })) }).catch(() => {});
  } catch (_) {}
}

// This browser's groups in the given links.
function cbLinkedGroupIds(clusters) {
  const program = cbDetectProgramId();
  const ids = new Set();
  for (const cluster of Array.isArray(clusters) ? clusters : []) {
    for (const member of cluster?.members || []) if (member && member.program === program && member.groupId) ids.add(member.groupId);
  }
  return ids;
}

// A group that left a link (Unlink, or its link dissolved) keeps the shared
// settings and only its own program's lines: a browser drops the Apps lines
// (owner 2026-09-27).
async function cbKeepOwnLines(ids) {
  const stored = (await chrome.storage.local.get({ [BLOCKED_GROUPS_KEY]: [] }))[BLOCKED_GROUPS_KEY];
  const groups = Array.isArray(stored) ? stored : [];
  let changed = false;
  const next = groups.map((group) => {
    if (!group || !ids.includes(group.id) || !Array.isArray(group.scopes)) return group;
    const own = group.scopes.filter((line) => CBGroupScopes.lineOwner(line) === "browser");
    if (own.length === group.scopes.length) return group;
    changed = true;
    return { ...group, scopes: own };
  });
  if (changed) await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
}

// Linked (per the copy), whether or not the hub is reachable right now.
function cbGroupInLink(group) {
  return Boolean(group) && cbLinkedGroupIds(cbClusterCopy).has(group.id);
}

// Time counted for linked groups while the hub was away, per group:
// { anchorMs, ms, buckets }. `anchorMs` is the budget period it belongs to.
async function cbRecordOfflineUsage(deltas, anchors) {
  if (Object.keys(deltas).length === 0) return;
  const stored = { ...((await chrome.storage.local.get({ [CB_OFFLINE_USAGE_KEY]: {} }))[CB_OFFLINE_USAGE_KEY] || {}) };
  for (const [groupId, delta] of Object.entries(deltas)) {
    const anchorMs = Number(anchors[groupId]) || 0;
    const entry = stored[groupId] && stored[groupId].anchorMs === anchorMs ? stored[groupId] : { anchorMs, ms: 0, buckets: {} };
    entry.ms += delta.ms || 0;
    for (const [minute, ms] of Object.entries(delta.buckets || {})) entry.buckets[minute] = (Number(entry.buckets[minute]) || 0) + ms;
    stored[groupId] = entry;
  }
  await chrome.storage.local.set({ [CB_OFFLINE_USAGE_KEY]: stored });
}

// Hands the offline time of linked groups to the hub (it adds it when the
// period still matches) and returns it by group, so the local counters can
// show shared + handed-over time at once.
async function cbHandOverOfflineUsage(groupsByCluster) {
  const stored = (await chrome.storage.local.get({ [CB_OFFLINE_USAGE_KEY]: {} }))[CB_OFFLINE_USAGE_KEY] || {};
  const program = cbDetectProgramId();
  const handed = {};
  const remaining = { ...stored };
  for (const { group } of groupsByCluster) {
    const entry = stored[group.id];
    if (!entry) continue;
    delete remaining[group.id];
    if (!(entry.ms > 0) && Object.keys(entry.buckets || {}).length === 0) continue;
    cbConnection.sendWS({
      kind: "group-sync",
      program,
      groupId: group.id,
      usageResetAtMs: 0,
      ...(group.rollingLimit
        ? { usageBuckets: entry.buckets }
        : { usageDeltaMs: entry.ms, usageDeltaAnchorMs: entry.anchorMs }),
      ts: Date.now()
    });
    handed[group.id] = entry;
  }
  await chrome.storage.local.set({ [CB_OFFLINE_USAGE_KEY]: remaining });
  return handed;
}

// Owner 2026-09-26: while Mac Vault is away, a linked group is only enforced
// here — nothing about it may change (the editor, the cover's Snooze and the
// quick-add "+" all refuse) until Mac Vault, which holds its state, is back.
function cbEnforceOnly(group) {
  return Boolean(group) && !cbConnection.desktopRouteIsReady() && cbGroupInLink(group);
}

// Reports this endpoint's usage *increment* to the hub for any clustered Default
// group so the one shared live budget keeps accumulating even while the popup is
// closed. Sends a lightweight usage-only group-sync (no scalars/sites) carrying
// the delta since our last report plus an absolute seed (used by the hub only
// until the first real delta arrives). The popup never reports usage, so this is
// the sole browser-side reporter and the delta can't be counted twice.
function cbReportClusterUsage(groups, timers, resets, bucketDeltas = {}, buckets = {}) {
  try {
    if (!cbConnection.desktopRouteIsReady()) return;
    const program = cbDetectProgramId();
    for (const g of groups) {
      if (!cbGroupInLink(g)) continue;
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
          groupId: g.id,
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
        groupId: g.id,
        usageDeltaMs: delta,
        usageMs: current,
        usageResetAtMs: resetAt,
        ts: Date.now()
      });
    }
  } catch (error) {
    console.error("[CustomBlocker] reporting linked usage failed", error);
  }
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
  // Every program's groups (id, name, frozen), for the editor's Link picker.
  rosters: {},
  // Rapid-retry burst bookkeeping. burstStartMs marks the start of the current
  // retry window. A raw WebSocket open is not a usable connection: the hub
  // must also accept our protocol hello with a welcome message.
  burstStartMs: 0,
  handshakeComplete: false,
  startupReady: null,

  setStatus(patch) {
    const desktopRouteWasReady = this.desktopRouteIsReady();
    this.status = { ...this.status, ...patch };
    const desktopRouteIsReady = this.desktopRouteIsReady();
    if (!desktopRouteIsReady && this.clusters.length > 0) {
      this.clusters = [];
      this.broadcastClusters();
    } else if (!desktopRouteWasReady && desktopRouteIsReady) {
      // Announce the stored groups after every (re)connect, and share what
      // changed while the desktop Vault was away.
      cbAnnounceStoredGroups().catch(() => {});
      cbShareOnReconnect().catch(() => {});
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

  // Choose the authenticated desktop host. Classifier-only presence is not
  // enough to edit linked groups or record Activity.
  desktopProgram(status = this.status) {
    if (status && (status.hubProgram === "macapp" || status.hubProgram === "windowsapp")) return status.hubProgram;
    for (const program of ["macapp", "windowsapp"]) {
      if (this.targetIsPresent(program, status)) return program;
    }
    return typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent || "") ? "windowsapp" : "macapp";
  },

  desktopRouteIsReady() {
    return this.routeIsReady(this.desktopProgram());
  },

  routeIsReady(target) {
    return Boolean(
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.status.state === "connected" &&
      this.targetIsPresent(target)
    );
  },

  statusForTarget(target) {
    const current = { ...this.status };
    if (current.state === "connected") {
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
        .sendMessage({ type: "connection-status-push", status: this.statusForTarget(this.desktopProgram()) })
        .catch(() => {});
    } catch (_) {}
  },

  broadcastClusters() {
    try {
      chrome.runtime
        .sendMessage({ type: "clusters-push", clusters: this.clusters, rosters: this.rosters })
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
      // The link's one lock (owned by the hub, versioned).
      const withLock = CBGroupActions.adoptLock(groups[idx], cluster.shared.lock);
      if (withLock !== groups[idx]) {
        groups[idx] = withLock;
        changed = true;
      }
      // The link's lines (sent once a member contributed; an empty list is an
      // emptied one).
      const scopes = cluster.shared.scopes;
      if (Array.isArray(scopes) && JSON.stringify(groups[idx].scopes) !== JSON.stringify(scopes)) {
        groups[idx] = { ...groups[idx], scopes };
        changed = true;
      }
    }
    if (changed) {
      // What the link has is in sync by definition: record it before writing.
      for (const group of groups) if (group && group.id) cbDefinitionSeen.set(group.id, cbDefinitionKey(group));
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
      const linkedGroups = relevant
        .map((cluster) => ({ cluster, group: self.CBBridgeProtocol.groupForCluster(groups, cluster, program) }))
        .filter((entry) => entry.group && entry.group.id);
      const handed = await cbHandOverOfflineUsage(linkedGroups);
      for (const cluster of relevant) {
        const shared = cluster.shared;
        if (!shared) continue;
        const grp = self.CBBridgeProtocol.groupForCluster(groups, cluster, program);
        if (!grp || !grp.id) continue;
        if (grp.rollingLimit) {
          // Rolling limit: adopt the hub's shared per-minute usage; the timer is
          // what is still inside this group's window.
          const merged = { ...(shared.usageBuckets || {}) };
          for (const [minute, ms] of Object.entries(handed[grp.id]?.buckets || {})) merged[minute] = (Number(merged[minute]) || 0) + ms;
          const pruned = cbPruneUsageBuckets(merged, grp, Date.now());
          if (JSON.stringify(pruned) !== JSON.stringify(bucketStore[grp.id] ?? {})) {
            bucketStore[grp.id] = pruned;
            timers[grp.id] = cbBucketsUsedMs(pruned);
            usageChanged = true;
          }
          continue;
        }
        if (!Number.isFinite(shared.usageMs)) continue;
        // Shared total plus what this browser just handed over for the same
        // period (the hub's broadcast of the sum follows).
        const offline = handed[grp.id];
        const incoming = Math.max(0, Number(shared.usageMs) || 0) +
          (offline && Math.floor(offline.anchorMs) === Math.floor(Number(shared.usageResetAtMs)) ? offline.ms : 0);
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
        await cbScheduleTransitions();
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
        const adopted = CBGroupActions.adoptSnooze(snoozes[grp.id], shared.snooze, sharedSnoozeTs);
        if (adopted) {
          snoozes[grp.id] = adopted;
          snoozeChanged = true;
        }
      }
      if (snoozeChanged) {
        await chrome.storage.local.set({ [GROUP_SNOOZES_KEY]: snoozes });
      }
      // The link's snooze total is the hub's count (each snooze once).
      const totals = { ...((await chrome.storage.local.get({ [GROUP_SNOOZE_TOTALS_KEY]: {} }))[GROUP_SNOOZE_TOTALS_KEY] || {}) };
      let totalsChanged = false;
      for (const cluster of relevant) {
        const grp = self.CBBridgeProtocol.groupForCluster(groups, cluster, program);
        const shared = Number(cluster.shared?.snoozeTotalMs);
        // As Mac Vault reads it: the link's total once it counted one (a new
        // link's 0 never wipes a total).
        if (!grp || !grp.id || !(shared > 0) || Number(totals[grp.id]) === shared) continue;
        totals[grp.id] = shared;
        totalsChanged = true;
      }
      if (totalsChanged) await chrome.storage.local.set({ [GROUP_SNOOZE_TOTALS_KEY]: totals });
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
    // Requests in flight fail now, not after their timeout.
    try { cbClassifierHub.rejectAll(); } catch (_) {}
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
      try { cbClassifierHub.rejectAll(); } catch (_) {}
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
      case "rosters":
        this.rosters = msg.rosters && typeof msg.rosters === "object" ? msg.rosters : {};
        this.broadcastClusters();
        break;
      case "link-refused":
        try { chrome.runtime.sendMessage({ type: "link-refused", reason: String(msg.reason || ""), groupId: String(msg.groupId || "") }).catch(() => {}); } catch (_) {}
        break;
      case "clusters":
        if (!this.desktopRouteIsReady()) break;
        this.clusters = Array.isArray(msg.clusters) ? msg.clusters : [];
        if (msg.rosters && typeof msg.rosters === "object") this.rosters = msg.rosters;
        cbSaveClusterCopy(this.clusters);
        this.broadcastClusters();
        this.applySharedToStorage().then(() => cbContributeJoins()).catch(() => {});
        break;
      case "cluster-updated": {
        if (!this.desktopRouteIsReady()) break;
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
        cbSaveClusterCopy(this.clusters);
        this.broadcastClusters();
        this.applySharedToStorage().then(() => cbContributeJoins()).catch(() => {});
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
        if (!this.desktopRouteIsReady()) break;
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
  "settings-set-global",
  "settings-lock-group",
  "settings-unlock-group",
  "settings-move-group",
  "settings-snooze-group",
  "settings-end-snooze",
  "settings-set-lock-gates",
  "settings-delete-all",
  "settings-run-custom-rule"
]);

// Locking and unlocking from a tool pass the editor's own gates (owner
// 2026-09-26: a tool may do what the user can, no more, no less). The rules
// are group-actions.js, shared with the editor and the Mac app's tools:
// - lock: the gates (waitHours, pin) are set, then the group is frozen; on a
//   frozen group the same call can only make the lock stricter;
// - unlock: the wait must be over, the PIN (when set) checked through the
//   shared retry wait, then the confirmation — the first call asks, each call
//   with confirm: true at least 5 s after the previous one counts one of the
//   CBGroupActions.CONFIRMATIONS steps.
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

async function cbWriteGroup(groups, index, group) {
  const next = groups.slice();
  next[index] = group;
  await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
  return group;
}

async function cbLockGroupForTool(input) {
  const { groups } = await getState();
  const index = groups.findIndex((group) => group.id === input.id);
  if (index < 0) throw new Error("group-not-found");
  let group = groups[index];
  const pin = input.pin === undefined ? undefined : String(input.pin);
  if (pin !== undefined && !CBParentalPin.isValidParentalPin(pin)) throw new Error("invalid-pin: 6 digits");
  let pinFields;
  if (pin !== undefined && !CBGroupActions.hasPin(group)) pinFields = await CBParentalPin.newPinFields(pin);
  if (pin !== undefined && CBGroupActions.hasPin(group)) throw new Error("pin-already-set");
  const now = Date.now();
  let result;
  if (CBGroupActions.isLocked(group)) {
    result = CBGroupActions.tighten(group, { waitHours: input.waitHours, pinFields });
  } else {
    result = CBGroupActions.lockWithGates(group, { waitHours: input.waitHours, pinFields }, now);
  }
  if (result.error) throw new Error(result.error);
  return cbWriteGroup(groups, index, result.group);
}

// The confirmation a tool walks through, as the editor's modal: the first
// call asks (running `onAsk` first — e.g. the PIN), then each call with
// confirm: true at least 5 s after the previous one counts a step. A pending
// confirmation belongs to one `tag` (e.g. the lock version) and expires.
// → { done: true } | { left }.
async function cbToolConfirmation(key, count, tag, confirm, now, onAsk) {
  const session = chrome.storage.session || chrome.storage.local;
  const requests = { ...((await session.get({ [CB_UNLOCK_REQUESTS_KEY]: {} }))[CB_UNLOCK_REQUESTS_KEY] || {}) };
  let request = requests[key];
  if (request && (request.tag !== tag || now - request.askedAtMs > CB_UNLOCK_REQUEST_TTL_MS)) request = null;
  if (confirm !== true || !request) {
    // `onAsk` may change what the confirmation is for (a PIN upgrade moves
    // the lock version): it returns the new tag.
    if (onAsk) tag = (await onAsk()) ?? tag;
    if (count <= 0) return { done: true };
    requests[key] = { askedAtMs: now, tag, confirm: CBGroupActions.confirmStart(now, count) };
    await session.set({ [CB_UNLOCK_REQUESTS_KEY]: requests });
    return { left: count };
  }
  const step = CBGroupActions.confirmStep(request.confirm, now);
  if (step.waitMs > 0) throw new Error(`confirm-wait:${Math.ceil(step.waitMs / 1000)}`);
  if (!step.done) {
    requests[key] = { ...request, confirm: step.state };
    await session.set({ [CB_UNLOCK_REQUESTS_KEY]: requests });
    return { left: step.state.left };
  }
  delete requests[key];
  await session.set({ [CB_UNLOCK_REQUESTS_KEY]: requests });
  return { done: true };
}

const CB_CONFIRM_NEXT = "call again with confirm: true every 5 s until confirmationsLeft is 0 (within 5 minutes)";

async function cbUnlockGroupForTool(input) {
  const { groups } = await getState();
  const index = groups.findIndex((group) => group.id === input.id);
  if (index < 0) throw new Error("group-not-found");
  const group = groups[index];
  const now = Date.now();
  const plan = CBGroupActions.unlockPlan(group, now);
  if (plan.error) throw new Error(plan.waitUntilMs ? `wait-until:${new Date(plan.waitUntilMs).toISOString()}` : plan.error);
  const step = await cbToolConfirmation(`unlock:${group.id}`, plan.confirmations, group.lockVersion, input.confirm, now, async () => {
    if (!plan.needsPin) return undefined;
    const upgrade = await cbCheckPinForTool(group, input.pin);
    if (!upgrade.parentalPasswordHash) return undefined;
    const upgraded = await cbWriteGroup(groups, index, CBGroupActions.upgradePinHash(group, upgrade.parentalPasswordHash));
    return upgraded.lockVersion;
  });
  if (!step.done) return { unlocked: false, confirmationsLeft: step.left, confirmAfterSeconds: plan.intervalMs / 1000, next: CB_CONFIRM_NEXT };
  const fresh = (await getState()).groups;
  const at = fresh.findIndex((g) => g.id === group.id);
  return { unlocked: true, group: cbPublicGroup(await cbWriteGroup(fresh, at, CBGroupActions.unlock(fresh[at]))) };
}

// Snooze from a tool: the editor's rules (group-actions.js) with the group's
// own confirmation count; ending early keeps the ended entry (shared).
async function cbSnoozeGroupForTool(input) {
  const { groups, groupSnoozes } = await getState();
  const group = groups.find((item) => item.id === input.id);
  if (!group) throw new Error("group-not-found");
  // A custom group's Snooze is its rule's (owner 2026-09-27), as in the editor.
  if (group.groupType === "custom") {
    if (group.allowSnooze === false) throw new Error("snooze-disabled");
    await cbFireSnoozePress(group.id);
    return { snoozePressed: true };
  }
  const now = Date.now();
  const plan = CBGroupActions.snoozePlan(group, groupSnoozes[group.id], now);
  if (plan.error) throw new Error(plan.error);
  const step = await cbToolConfirmation(`snooze:${group.id}`, plan.confirmations, "snooze", input.confirm, now);
  if (!step.done) return { snoozed: false, confirmationsLeft: step.left, confirmAfterSeconds: plan.intervalMs / 1000, next: CB_CONFIRM_NEXT };
  return { snoozed: true, snooze: await cbStartSnooze(group.id, Date.now()) };
}

async function cbEndSnoozeForTool(input) {
  const { groups, groupSnoozes } = await getState();
  const group = groups.find((item) => item.id === input.id);
  if (!group) throw new Error("group-not-found");
  const now = Date.now();
  const result = CBGroupActions.endSnoozeEntry(groupSnoozes[group.id], now);
  if (result.error) throw new Error(result.error);
  // The time it ran is counted once, like a snooze that ran out (getState).
  await chrome.storage.local.set({ [GROUP_SNOOZES_KEY]: { ...groupSnoozes, [group.id]: result.entry } });
  return { ended: true, snooze: result.entry };
}

// The global settings the editor's Settings shows — all a tool may read or set.
const CB_EDITOR_GLOBAL_FIELDS = Object.freeze(["quitRetryMinutes", "quickAddEnabled"]);
function cbEditorGlobalSettings(settings) {
  return Object.fromEntries(CB_EDITOR_GLOBAL_FIELDS.map((key) => [key, settings[key]]));
}

// The editor's lock gates on an unlocked group: the wait (hours) and the PIN.
// Clearing a PIN takes the current one, as in the editor.
async function cbSetLockGatesForTool(input) {
  const { groups } = await getState();
  const index = groups.findIndex((group) => group.id === input.id);
  if (index < 0) throw new Error("group-not-found");
  const group = groups[index];
  // A locked group's gates change only after unlocking (checked before any PIN
  // is tried, so a refusal never costs an attempt).
  if (CBGroupActions.isLocked(group)) throw new Error("group-locked");
  const gates = {};
  if (input.waitHours !== undefined) gates.waitHours = input.waitHours;
  if (input.clearPin === true) {
    if (CBGroupActions.hasPin(group)) await cbCheckPinForTool(group, input.pin);
    gates.pinFields = null;
  } else if (input.pin !== undefined) {
    if (CBGroupActions.hasPin(group)) throw new Error("pin-already-set");
    gates.pinFields = await CBParentalPin.newPinFields(String(input.pin));
  }
  const result = CBGroupActions.setGates(group, gates);
  if (result.error) throw new Error(result.error);
  return { group: cbPublicGroup(await cbWriteGroup(groups, index, result.group)) };
}

// "Delete all" through the editor's gates: no wait holding on any locked
// group, each distinct PIN once, then the confirmation.
async function cbDeleteAllForTool(input) {
  const { groups } = await getState();
  const now = Date.now();
  const plan = CBGroupActions.deleteAllPlan(groups, now);
  if (plan.error) throw new Error(plan.waitUntilMs ? `wait-until:${new Date(plan.waitUntilMs).toISOString()}` : plan.error);
  // The plan is taken on every call, so a lock or PIN that arrives meanwhile
  // stops the deletion (a new PIN set restarts it). Each distinct PIN is asked
  // once, when the confirmation starts: pins[i] for the i-th (wrong ones count).
  const tag = plan.pinHashes.join(",") || "no-pin";
  const step = await cbToolConfirmation("delete-all", plan.needsConfirmation ? plan.confirmations : 0, tag, input.confirm, now, async () => {
    const pins = Array.isArray(input.pins) ? input.pins.map(String) : [];
    if (pins.length < plan.pinGroups.length) throw new Error(`pins-required:${plan.pinGroups.map((g) => g.name).join(", ")}`);
    for (const [i, group] of plan.pinGroups.entries()) await cbCheckPinForTool(group, pins[i]);
    return undefined;
  });
  if (!step.done) return { deleted: false, confirmationsLeft: step.left, confirmAfterSeconds: plan.intervalMs / 1000, next: CB_CONFIRM_NEXT };
  await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: [] });
  return { deleted: groups.length };
}

async function cbBrowserRequestBody(operation, body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  switch (operation) {
    case "settings-get": {
      const { groups, usageTimersMs, groupSnoozes } = await getState();
      const stored = await chrome.storage.local.get(CB_GLOBAL_SETTINGS_KEY);
      return {
        groups: groups.map(cbPublicGroup),
        usageTimersMs,
        groupSnoozes,
        globalSettings: cbEditorGlobalSettings(CBGroupActions.sanitizeGlobalSettings(stored?.[CB_GLOBAL_SETTINGS_KEY])),
        quickAddGroupId: (await chrome.storage.local.get({ [CB_QUICK_ADD_GROUP_KEY]: "" }))[CB_QUICK_ADD_GROUP_KEY],
        operations: CB_BROWSER_REQUEST_OPERATIONS
      };
    }
    case "settings-create-group": {
      const groupType = typeof input.groupType === "string" ? input.groupType : "";
      const patch = input.patch && typeof input.patch === "object" && !Array.isArray(input.patch) ? input.patch : {};
      const { groups } = await getState();
      // As the editor's New group: 30-minute snooze duration, a free
      // numbered name, never locked, only a browser's lines.
      const result = CBGroupScopes.createToolGroup(groups, groupType, patch, "browser");
      if (result.error) throw new Error(result.error);
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: [...groups, result.group] });
      return { group: cbPublicGroup(result.group) };
    }
    case "settings-set-group": {
      const id = typeof input.id === "string" ? input.id : "";
      const patch = input.patch && typeof input.patch === "object" && !Array.isArray(input.patch) ? input.patch : null;
      if (!id || !patch) throw new Error("missing-id-or-patch");
      const { groups } = await getState();
      const index = groups.findIndex((group) => group.id === id);
      if (index < 0) throw new Error("group-not-found");
      if (CBGroupActions.isLocked(groups[index])) throw new Error("group-locked");
      const result = CBGroupScopes.applyToolEdit(groups[index], patch, "browser");
      if (result.error) throw new Error(result.error);
      if (CBGroupActions.nameTaken(groups, result.group.name, id)) throw new Error("duplicate-name");
      const next = groups.slice();
      next[index] = result.group;
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
      return { group: cbPublicGroup(result.group) };
    }
    case "settings-delete-group": {
      const id = typeof input.id === "string" ? input.id : "";
      const { groups } = await getState();
      const group = groups.find((candidate) => candidate.id === id);
      if (!group) throw new Error("group-not-found");
      if (CBGroupActions.isLocked(group)) throw new Error("group-locked");
      const next = groups.filter((candidate) => candidate.id !== id);
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
      return { deleted: id };
    }
    case "settings-lock-group":
      return { group: cbPublicGroup(await cbLockGroupForTool({ ...input, id: typeof input.id === "string" ? input.id : "" })) };
    case "settings-unlock-group":
      return cbUnlockGroupForTool({ ...input, id: typeof input.id === "string" ? input.id : "" });
    case "settings-snooze-group":
      return cbSnoozeGroupForTool({ ...input, id: typeof input.id === "string" ? input.id : "" });
    case "settings-end-snooze":
      return cbEndSnoozeForTool({ id: typeof input.id === "string" ? input.id : "" });
    case "settings-set-lock-gates":
      return cbSetLockGatesForTool({ ...input, id: typeof input.id === "string" ? input.id : "" });
    case "settings-delete-all":
      return cbDeleteAllForTool(input);
    case "settings-run-custom-rule": {
      // The editor's Run; no source = the group's current rule text.
      const id = typeof input.id === "string" ? input.id : "";
      const group = (await getState()).groups.find((g) => g.id === id);
      if (!group || group.groupType !== "custom") throw new Error("group-not-found");
      const source = typeof input.source === "string" ? input.source : String(group.blockingRulesText || "");
      const result = await cbRunCustomGroup(id, source);
      return { ran: Boolean(result.ok), handlers: result.handlers ?? 0, error: result.ok ? null : result.error || "not-loaded" };
    }
    case "settings-move-group": {
      // The group list's order (drag in the editor); a locked group stays put.
      // Order is this device's own: it is not shared with linked devices.
      const id = typeof input.id === "string" ? input.id : "";
      const { groups } = await getState();
      const from = groups.findIndex((group) => group.id === id);
      if (from < 0) throw new Error("group-not-found");
      if (CBGroupActions.isLocked(groups[from])) throw new Error("group-locked");
      const to = Number(input.index);
      if (!Number.isInteger(to) || to < 0 || to >= groups.length) throw new Error(`invalid-index: 0…${groups.length - 1}`);
      const next = groups.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      await chrome.storage.local.set({ [BLOCKED_GROUPS_KEY]: next });
      return { order: next.map((group) => group.id) };
    }
    case "settings-set-global": {
      // Exactly the editor's Settings (owner 2026-09-27), sanitized the way its
      // save does.
      const stored = await chrome.storage.local.get(CB_GLOBAL_SETTINGS_KEY);
      const current = stored?.[CB_GLOBAL_SETTINGS_KEY] && typeof stored[CB_GLOBAL_SETTINGS_KEY] === "object" ? stored[CB_GLOBAL_SETTINGS_KEY] : {};
      const patch = input.patch && typeof input.patch === "object" && !Array.isArray(input.patch) ? input.patch : null;
      if (!patch) throw new Error("missing-patch");
      const { quickAddGroupId, ...settings } = patch;
      const unknown = Object.keys(settings).find((key) => !CB_EDITOR_GLOBAL_FIELDS.includes(key));
      if (unknown) throw new Error(`not-an-editor-setting:${unknown}`);
      const invalid = CBGroupActions.validateSettingsPatch(settings);
      if (invalid) throw new Error(invalid);
      // The quick-add "+" target (the editor's remembered selection): a group id, or "".
      if (quickAddGroupId !== undefined) {
        const target = String(quickAddGroupId || "");
        if (target && !(await getState()).groups.some((group) => group.id === target)) throw new Error("group-not-found");
        await chrome.storage.local.set({ [CB_QUICK_ADD_GROUP_KEY]: target });
      }
      const next = CBGroupActions.sanitizeGlobalSettings({ ...current, ...settings });
      await chrome.storage.local.set({ [CB_GLOBAL_SETTINGS_KEY]: next });
      return { globalSettings: cbEditorGlobalSettings(next), quickAddGroupId: (await chrome.storage.local.get({ [CB_QUICK_ADD_GROUP_KEY]: "" }))[CB_QUICK_ADD_GROUP_KEY] };
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

  // Activity records go to the desktop Vault; every other operation to the
  // Classifier (both behind the one hub socket).
  targetFor(operation) {
    return String(operation).startsWith("activity-") ? cbConnection.desktopProgram() : "classifier";
  },

  isReady(connection, target = "classifier") {
    return Boolean(
      connection &&
      connection.ws &&
      connection.ws.readyState === WebSocket.OPEN &&
      connection.status &&
      connection.status.state === "connected" &&
      typeof connection.targetIsPresent === "function" &&
      connection.targetIsPresent(target)
    );
  },

  waitForReady(connection, target = "classifier") {
    if (this.isReady(connection, target)) return Promise.resolve();
    // There is no active shared socket to wait for, or a live hub has already
    // confirmed that it does not have a Classifier peer.
    if (!connection || connection.status?.state === "connected") {
      return Promise.reject(new Error("The Vault Classifier bridge is unavailable."));
    }
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + CB_CLASSIFIER_HUB_CONNECT_WAIT_MS;
      const poll = () => {
        if (this.isReady(connection, target)) {
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
      .then(() => this.waitForReady(connection, this.targetFor(operation)))
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
      sendResponse({ ok: true, status: cbConnection.statusForTarget(cbConnection.desktopProgram()) });
      return false;
    case "clusters-status":
      sendResponse({ ok: true, clusters: cbConnection.clusters, rosters: cbConnection.rosters || {} });
      return false;
    // The editor's Link / Unlink buttons (owner 2026-09-27: links are made by
    // the user, never by names).
    case "group-link":
    case "group-unlink":
      if (!cbConnection.desktopRouteIsReady()) { sendResponse({ ok: false, error: "desktop-unavailable" }); return false; }
      cbConnection.sendWS(message.type === "group-link"
        ? { kind: "group-link", groupId: String(message.groupId || ""), targetProgram: String(message.targetProgram || ""), targetGroupId: String(message.targetGroupId || "") }
        : { kind: "group-unlink", groupId: String(message.groupId || "") });
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
