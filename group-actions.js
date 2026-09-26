// Group actions — a group's POLICY rules (the "when": its fields and their
// defaults, the budget periods, the global settings) and the lock and snooze
// rules, one implementation for every caller: the editor (browser popup and
// the Mac editor, which runs this same file), the service worker and its
// AI-tool operations, and the Mac app's AI tools (run in JavaScriptCore).
// Owner model 2026-09-26: a tool may do exactly what the user can, no more, no
// less — so the rules live here, not in each caller.
//
// A LOCK has parallel gates that combine freely:
//   - wait: it cannot be unlocked until `lockWaitHours` after `lockedAtMs`;
//   - PIN:  unlocking needs the group's 6-digit PIN (when one is set);
//   - confirm: EVERY unlock (and "delete all") ends with the confirmation —
//     CONFIRMATIONS clicks, CONFIRM_INTERVAL_MS apart (owner: 10 × 5 s).
// While locked, the lock can only become stricter (a longer wait, a PIN where
// there was none). `lockVersion` counts lock changes: linked devices apply a
// change only on top of the version it was made from (see ConnectionHub).
//
// Pure and synchronous; callers load and store groups.
(function (global) {
  "use strict";

  const CONFIRMATIONS = 10;
  const CONFIRM_INTERVAL_MS = 5000;
  const MAX_WAIT_HOURS = 72;
  const HOUR_MS = 3600 * 1000;
  // The fields that make up a lock (shared as one unit between linked devices;
  // never exported or imported).
  const LOCK_FIELDS = ["lockedAtMs", "lockWaitHours", "parentalPasswordHash", "parentalPasswordSalt", "lockVersion"];

  function finite(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function parseWaitHours(value) {
    const n = Number.parseFloat(String(value ?? "").trim());
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n <= MAX_WAIT_HOURS ? n : null;
  }

  // The lock fields of a stored group, cleaned. Groups stored before
  // 2026-09-26 carry the old exclusive modes (freezeMode frozen / strict /
  // parental); they are reconciled once so nobody is unlocked by the upgrade.
  function normalizeLock(group) {
    const src = group && typeof group === "object" ? group : {};
    let lockedAtMs = finite(src.lockedAtMs);
    let lockWaitHours = parseWaitHours(src.lockWaitHours) ?? MAX_WAIT_HOURS;
    if (src.lockedAtMs === undefined && typeof src.freezeMode === "string" && src.freezeMode !== "none") {
      lockedAtMs = finite(src.frozenAtMs) ?? 0;
      lockWaitHours = src.freezeMode === "strict" ? (parseWaitHours(src.strictFreezeHours) ?? 24) : 0;
    }
    const hash = typeof src.parentalPasswordHash === "string" && src.parentalPasswordHash ? src.parentalPasswordHash : null;
    const salt = typeof src.parentalPasswordSalt === "string" && src.parentalPasswordSalt ? src.parentalPasswordSalt : null;
    return {
      lockedAtMs,
      lockWaitHours,
      parentalPasswordHash: hash && salt ? hash : null,
      parentalPasswordSalt: hash && salt ? salt : null,
      lockVersion: Math.max(0, Math.floor(finite(src.lockVersion) ?? 0)),
      // This device's own: the hub's lock version it last had (linked groups).
      lockSyncedVersion: Math.max(0, Math.floor(finite(src.lockSyncedVersion) ?? 0))
    };
  }

  function isLocked(group) {
    return Boolean(group) && finite(group.lockedAtMs) !== null;
  }

  function hasPin(group) {
    return Boolean(group && group.parentalPasswordHash && group.parentalPasswordSalt);
  }

  // 0 when the wait gate is not holding.
  function waitUntilMs(group) {
    if (!isLocked(group) || !(Number(group.lockWaitHours) > 0)) return 0;
    return Number(group.lockedAtMs) + Number(group.lockWaitHours) * HOUR_MS;
  }

  function status(group, now) {
    const locked = isLocked(group);
    const until = waitUntilMs(group);
    return {
      locked,
      hasPin: hasPin(group),
      waitHours: Number(group?.lockWaitHours) || 0,
      waitRemainingMs: locked && until > now ? until - now : 0,
      waitUntilMs: until
    };
  }

  function bump(group, fields) {
    return { ...group, ...fields, lockVersion: (Number(group.lockVersion) || 0) + 1 };
  }

  // → { group } or { error }. The gates (wait, PIN) are the group's own
  // settings at the moment it is locked.
  function lock(group, now) {
    if (isLocked(group)) return { error: "group-locked" };
    return { group: bump(group, { lockedAtMs: now }) };
  }

  // Stricter only: a longer wait (from the same lock time) and/or a PIN where
  // there was none. `pinFields` are {parentalPasswordHash, parentalPasswordSalt}.
  function tighten(group, { waitHours, pinFields } = {}) {
    if (!isLocked(group)) return { error: "not-locked" };
    const fields = {};
    if (waitHours !== undefined) {
      const hours = parseWaitHours(waitHours);
      if (hours === null) return { error: `invalid-wait-hours: 0 < hours <= ${MAX_WAIT_HOURS}` };
      if (hours < (Number(group.lockWaitHours) || 0)) return { error: "not-stricter" };
      if (hours !== (Number(group.lockWaitHours) || 0)) fields.lockWaitHours = hours;
    }
    if (pinFields) {
      if (hasPin(group)) return { error: "pin-already-set" };
      fields.parentalPasswordHash = pinFields.parentalPasswordHash;
      fields.parentalPasswordSalt = pinFields.parentalPasswordSalt;
    }
    if (Object.keys(fields).length === 0) return { group };
    return { group: bump(group, fields) };
  }

  // The gates of an UNLOCKED group (its lock settings): the wait and the PIN.
  // `pin: null` clears the PIN (the caller has checked the old one).
  function setGates(group, { waitHours, pinFields } = {}) {
    if (isLocked(group)) return { error: "group-locked" };
    const fields = {};
    if (waitHours !== undefined) {
      const hours = parseWaitHours(waitHours);
      if (hours === null) return { error: `invalid-wait-hours: 0 < hours <= ${MAX_WAIT_HOURS}` };
      fields.lockWaitHours = hours;
    }
    if (pinFields !== undefined) {
      fields.parentalPasswordHash = pinFields ? pinFields.parentalPasswordHash : null;
      fields.parentalPasswordSalt = pinFields ? pinFields.parentalPasswordSalt : null;
    }
    return { group: bump(group, fields) };
  }

  // A PIN stored in an old format, upgraded on a correct entry: a lock change
  // like any other (its version moves, so linked devices take it).
  function upgradePinHash(group, hash) {
    return bump(group, { parentalPasswordHash: hash });
  }

  // What unlocking needs right now → { error } | { needsPin, confirmations,
  // intervalMs }. A holding wait gate is an error naming its end.
  function unlockPlan(group, now) {
    if (!isLocked(group)) return { error: "not-locked" };
    const until = waitUntilMs(group);
    if (until > now) return { error: `wait:${until}`, waitUntilMs: until };
    return { needsPin: hasPin(group), confirmations: CONFIRMATIONS, intervalMs: CONFIRM_INTERVAL_MS };
  }

  // The unlocked group; the caller has passed every gate of unlockPlan.
  function unlock(group) {
    return bump(group, { lockedAtMs: null });
  }

  // "Delete all" needs the union of every lock's gates: no wait still holding
  // on any group, each distinct PIN once, then the confirmation.
  function deleteAllPlan(groups, now) {
    const locked = (Array.isArray(groups) ? groups : []).filter(isLocked);
    let blockedUntil = 0;
    const pinGroups = [];
    const seen = new Set();
    for (const group of locked) {
      const until = waitUntilMs(group);
      if (until > now) blockedUntil = Math.max(blockedUntil, until);
      if (hasPin(group) && !seen.has(group.parentalPasswordHash)) {
        seen.add(group.parentalPasswordHash);
        pinGroups.push(group);
      }
    }
    if (blockedUntil) return { error: `wait:${blockedUntil}`, waitUntilMs: blockedUntil };
    return {
      needsConfirmation: locked.length > 0,
      pinGroups,
      pinHashes: pinGroups.map((g) => g.parentalPasswordHash),
      confirmations: CONFIRMATIONS,
      intervalMs: CONFIRM_INTERVAL_MS
    };
  }

  // The confirmation ritual as data, so the editor's modal and the tools'
  // repeated calls count it the same way.
  function confirmStart(now, count = CONFIRMATIONS) {
    return { left: count, nextAtMs: now + CONFIRM_INTERVAL_MS };
  }
  // → { state, done, waitMs }: a click before nextAtMs changes nothing.
  function confirmStep(state, now) {
    if (!state || state.left <= 0) return { state, done: true, waitMs: 0 };
    if (now < state.nextAtMs) return { state, done: false, waitMs: state.nextAtMs - now };
    const next = { left: state.left - 1, nextAtMs: now + CONFIRM_INTERVAL_MS };
    return { state: next, done: next.left <= 0, waitMs: 0 };
  }

  // ── Snooze ────────────────────────────────────────────────────────────────
  // One snooze entry per group: {startsAtMs, untilMs, cooldownUntilMs,
  // confirmationCount, activeMsApplied, changedAtMs}. A group's LAST entry is
  // kept after it runs out (phase "none"), never deleted: its changedAtMs is
  // how a device knows an older shared entry is not news (an ended snooze
  // can't come back). A locked group can still be snoozed; its snooze
  // settings are frozen with it.
  const MINUTE_MS = 60 * 1000;

  function snoozePhase(entry, now) {
    if (!entry) return "none";
    if (Number.isFinite(entry.startsAtMs) && now < entry.startsAtMs) return "pending";
    if (Number.isFinite(entry.untilMs) && now < entry.untilMs) return "active";
    if (Number.isFinite(entry.cooldownUntilMs) && now < entry.cooldownUntilMs) return "cooldown";
    return "none";
  }

  function snoozeChangedAtMs(entry) {
    if (!entry) return 0;
    return Number(entry.changedAtMs) > 0 ? Number(entry.changedAtMs) : Number(entry.startsAtMs) || 0;
  }

  function sanitizeSnoozeEntry(raw) {
    const startsAtMs = Number.parseInt(raw?.startsAtMs, 10);
    const untilMs = Number.parseInt(raw?.untilMs, 10);
    const cooldownUntilMs = Number.parseInt(raw?.cooldownUntilMs, 10);
    if (!(Number.isFinite(startsAtMs) && Number.isFinite(untilMs) && Number.isFinite(cooldownUntilMs) &&
      startsAtMs <= untilMs && untilMs <= cooldownUntilMs)) return null;
    const confirmations = Number.parseInt(raw?.confirmationCount, 10);
    const changedAtMs = Number(raw?.changedAtMs) > 0 ? Number(raw.changedAtMs) : 0;
    return {
      startsAtMs, untilMs, cooldownUntilMs,
      confirmationCount: Number.isFinite(confirmations) && confirmations >= 0 ? confirmations : 0,
      activeMsApplied: Boolean(raw?.activeMsApplied),
      ...(changedAtMs ? { changedAtMs } : {})
    };
  }

  // What starting a snooze needs → { error } | { confirmations, intervalMs }.
  function snoozePlan(group, entry, now) {
    if (!group || group.groupType === "custom" || group.allowSnooze === false) return { error: "snooze-disabled" };
    if (snoozePhase(entry, now) !== "none") return { error: "snooze-in-progress" };
    return { confirmations: Math.max(0, Number(group.snoozeConfirmations) || 0), intervalMs: CONFIRM_INTERVAL_MS };
  }

  // The new entry, from the group's stored settings (never unsaved form input).
  function snoozeEntry(group, now) {
    const startsAtMs = now + (Number(group.snoozeActivationDelayMinutes) || 0) * MINUTE_MS;
    const untilMs = startsAtMs + (Number(group.snoozeMinutes) || 0) * MINUTE_MS;
    return {
      startsAtMs,
      untilMs,
      cooldownUntilMs: untilMs + (Number(group.snoozeCooldownMinutes) || 0) * MINUTE_MS,
      confirmationCount: Math.max(0, Number(group.snoozeConfirmations) || 0),
      activeMsApplied: false,
      changedAtMs: now
    };
  }

  // Ending early keeps an ENDED entry stamped now (it reaches linked devices
  // as the newest change) → { entry, activeMs } | { error }. `activeMs` is the
  // snoozed time to add to the group's total.
  function endSnoozeEntry(entry, now) {
    const phase = snoozePhase(entry, now);
    if (phase === "pending") {
      return { entry: { ...entry, startsAtMs: now, untilMs: now, cooldownUntilMs: now, activeMsApplied: true, changedAtMs: now }, activeMs: 0 };
    }
    if (phase === "active") {
      const cooldownMs = Math.max(0, entry.cooldownUntilMs - entry.untilMs);
      return {
        entry: { ...entry, untilMs: now, cooldownUntilMs: now + cooldownMs, activeMsApplied: true, changedAtMs: now },
        activeMs: Math.max(0, now - entry.startsAtMs)
      };
    }
    return { error: "no-snooze" };
  }

  // A linked device's entry replaces ours only when it changed later (a start
  // or an end) → the entry to store, or null for no change.
  function adoptSnooze(local, shared, sharedTs) {
    const entry = sanitizeSnoozeEntry(shared);
    if (!entry) return null;
    const ts = Number(sharedTs) > 0 ? Number(sharedTs) : snoozeChangedAtMs(entry);
    if (ts <= snoozeChangedAtMs(local)) return null;
    return { ...entry, changedAtMs: ts };
  }

  // ── Linked groups ────────────────────────────────────────────────────────
  // One lock for the whole link, owned by the Mac hub. A device sends its
  // lock with `lockBase`: the version it last had from the hub
  // (`lockSyncedVersion`). The hub takes a change only when it was made on top
  // of the hub's current version (compare-and-set), so a stale device, a
  // replayed edit or a group that just joined can never overwrite a newer lock
  // — while a change made on a device during the hub's absence wins when the
  // hub returns (nothing newer happened meanwhile).
  function lockUnit(group) {
    const unit = {};
    for (const field of LOCK_FIELDS) unit[field] = group[field] ?? null;
    unit.lockVersion = Number(group.lockVersion) || 0;
    return unit;
  }

  function lockContribution(group) {
    return { lock: lockUnit(group), lockBase: Number(group.lockSyncedVersion) || 0 };
  }

  // The group carrying the hub's lock (unchanged object when already equal).
  function adoptLock(group, shared) {
    if (!shared || typeof shared !== "object" || !Number.isFinite(Number(shared.lockVersion))) return group;
    const incoming = normalizeLock(shared);
    const same = LOCK_FIELDS.every((f) => (group[f] ?? null) === (incoming[f] ?? null)) &&
      Number(group.lockSyncedVersion) === incoming.lockVersion;
    if (same) return group;
    return { ...group, ...incoming, lockSyncedVersion: incoming.lockVersion };
  }

  // ── Policy fields: defaults and parsers ─────────────────────────────────
  // A parser returns the value, or null when the text is not a valid value.
  const DAY_NAMES = Object.freeze(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  const DEFAULT_GROUP_TYPE = "site";
  const DEFAULT_ALLOWED_MINUTES = 15;
  const DEFAULT_RESET_INTERVAL_HOURS = 24;
  const DEFAULT_SNOOZE_MINUTES = 30;
  const DEFAULT_SNOOZE_CONFIRMATIONS = 0;
  const DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES = 0;
  const DEFAULT_SNOOZE_COOLDOWN_MINUTES = 0;
  const MAX_SNOOZE_COOLDOWN_MINUTES = 5;
  // The pause action's countdown (seconds a page is held before Continue).
  const DEFAULT_PAUSE_SECONDS = 10;
  const MAX_PAUSE_SECONDS = 600;
  const MS_PER_MINUTE = 60 * 1000;
  const MS_PER_HOUR = 60 * MS_PER_MINUTE;

  function createGroupId() {
    return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createDefaultDays() {
    return [...DAY_NAMES];
  }

  function getDayNameForDate(date) {
    return DAY_NAMES[(date.getDay() + 6) % 7];
  }

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

  function parsePositive(value) {
    const parsed = Number.parseFloat(String(value ?? "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  const parseAllowedMinutes = parsePositive;
  const parseResetIntervalHours = parsePositive;
  const parseSnoozeMinutes = parsePositive;

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

  // "HHMM-HHMM"; an end before the start runs past midnight (2300-0100), only
  // an empty window is invalid.
  function normalizeTimeWindowLine(line) {
    const match = String(line ?? "").trim().match(/^(\d{4})-(\d{4})$/);
    if (!match) return null;
    const [, start, end] = match;
    const startHours = Number.parseInt(start.slice(0, 2), 10);
    const startMinutes = Number.parseInt(start.slice(2), 10);
    const endHours = Number.parseInt(end.slice(0, 2), 10);
    const endMinutes = Number.parseInt(end.slice(2), 10);
    if (startHours > 23 || endHours > 23 || startMinutes > 59 || endMinutes > 59) return null;
    if (startHours * 60 + startMinutes === endHours * 60 + endMinutes) return null;
    return `${start}-${end}`;
  }

  // One window per line: the valid ones (deduplicated) and the invalid lines
  // (the editor shows those).
  function parseTimeWindowsText(value) {
    const normalizedLines = [];
    const invalidLines = [];
    for (const raw of String(value ?? "").split(/\r?\n/)) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const normalized = normalizeTimeWindowLine(trimmed);
      if (normalized) normalizedLines.push(normalized);
      else invalidLines.push(trimmed);
    }
    return { normalizedLines: [...new Set(normalizedLines)], invalidLines };
  }

  function parseTimeWindowToMinutes(windowText) {
    const [start, end] = windowText.split("-");
    return {
      startMinutes: Number.parseInt(start.slice(0, 2), 10) * 60 + Number.parseInt(start.slice(2), 10),
      endMinutes: Number.parseInt(end.slice(0, 2), 10) * 60 + Number.parseInt(end.slice(2), 10)
    };
  }

  // In its schedule now (Mac Vault: Schedule.swift isActive).
  function isGroupActiveNow(group, now) {
    // Custom groups have no schedule UI — they're always "active" and rely on
    // their JavaScript function to decide what to do. Schedule-based logic
    // applies to every other group type.
    if (group.groupType === "custom") return true;

    const currentDate = new Date(now);
    const todayActive = group.activeDays.includes(getDayNameForDate(currentDate));

    const timeWindows = parseTimeWindowsText(group.timeWindowsText).normalizedLines;
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

  // ── Budget periods (same rules as Mac Vault's UsageBudget.swift) ─────────
  // Fixed budget: resets every resetIntervalHours from the stored anchor, or —
  // with resetAtMidnight — on a grid restarted at local 00:00 each day (00:00,
  // then every N h; the last period of the day ends early at midnight). Rolling
  // limit: usage is kept per minute and counts until it is N h old; with
  // resetAtMidnight the window never reaches before today's 00:00.
  const USAGE_BUCKET_MS = MS_PER_MINUTE;

  function getAllowedMs(group) {
    return group.allowedMinutes * MS_PER_MINUTE;
  }

  function getResetIntervalMs(group) {
    return group.resetIntervalHours * MS_PER_HOUR;
  }

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

  // ── Runtime state per group (usage, snoozes), as stored ──────────────────
  function perGroupCount(value, groups) {
    const out = {};
    for (const group of groups) out[group.id] = Math.max(0, Number.parseInt(value?.[group.id], 10) || 0);
    return out;
  }
  const sanitizeUsageTimers = perGroupCount;
  const sanitizeSnoozeTotals = perGroupCount;

  function sanitizeResetTimes(value, groups, now = Date.now()) {
    const out = {};
    for (const group of groups) {
      const parsed = Number.parseInt(value?.[group.id], 10);
      out[group.id] = Number.isFinite(parsed) && parsed > 0 ? parsed : now;
    }
    return out;
  }

  function sanitizeUsageBuckets(value, groups) {
    const out = {};
    for (const group of groups) {
      const raw = value?.[group.id];
      if (!raw || typeof raw !== "object") continue;
      const buckets = {};
      for (const [minute, used] of Object.entries(raw)) {
        const start = Number(minute);
        const ms = Number(used);
        if (Number.isFinite(start) && Number.isFinite(ms) && ms > 0) buckets[String(start)] = ms;
      }
      out[group.id] = buckets;
    }
    return out;
  }

  function sanitizeSnoozes(value, groups) {
    const groupIds = new Set(groups.map((group) => group.id));
    const out = {};
    for (const [groupId, raw] of Object.entries(value ?? {})) {
      if (!groupIds.has(groupId)) continue;
      const entry = sanitizeSnoozeEntry(raw);
      if (entry) out[groupId] = entry;
    }
    return out;
  }

  // ── Global settings ─────────────────────────────────────────────────────
  const DEFAULT_GLOBAL_SETTINGS = Object.freeze({
    tickRateMs: 1000,
    autosaveDebounceMs: 400,
    // Debug mode is off by default. When on it (a) shows the on-page debug log
    // overlay for custom rules and (b) emits the [CustomBlocker:trace] /
    // [CustomBlocker] dispatch console lines. helpers.log() output flows
    // regardless.
    debugMode: false,
    showOnPageLogToasts: true,
    // The tiny floating "+" on pages and in the desktop app (off by default).
    quickAddEnabled: false,
    defaultSnoozeMinutes: DEFAULT_SNOOZE_MINUTES,
    // Desktop: how often a blocked (or rule-closed) app that stayed open is
    // asked to quit again, in minutes; 0 = never (owner 2026-09-26).
    quitRetryMinutes: 0
  });
  const TICK_RATE_MIN_MS = 250;
  const TICK_RATE_MAX_MS = 60_000;
  const AUTOSAVE_DEBOUNCE_MAX_MS = 5_000;
  const QUIT_RETRY_MAX_MINUTES = 1440;

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function sanitizeGlobalSettings(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const defaults = DEFAULT_GLOBAL_SETTINGS;
    return {
      tickRateMs: Math.round(clampNumber(src.tickRateMs, TICK_RATE_MIN_MS, TICK_RATE_MAX_MS, defaults.tickRateMs)),
      autosaveDebounceMs: Math.round(clampNumber(src.autosaveDebounceMs, 0, AUTOSAVE_DEBOUNCE_MAX_MS, defaults.autosaveDebounceMs)),
      debugMode: src.debugMode === true,
      showOnPageLogToasts: src.showOnPageLogToasts !== false,
      defaultSnoozeMinutes: parseSnoozeMinutes(src.defaultSnoozeMinutes) ?? defaults.defaultSnoozeMinutes,
      quickAddEnabled: src.quickAddEnabled === true,
      quitRetryMinutes: Math.round(clampNumber(src.quitRetryMinutes, 0, QUIT_RETRY_MAX_MINUTES, defaults.quitRetryMinutes))
    };
  }


  const api = Object.freeze({
    CONFIRMATIONS, CONFIRM_INTERVAL_MS, MAX_WAIT_HOURS, LOCK_FIELDS,
    parseWaitHours, normalizeLock, isLocked, hasPin, waitUntilMs, status,
    lock, tighten, setGates, upgradePinHash, unlockPlan, unlock, deleteAllPlan, confirmStart, confirmStep,
    lockUnit, lockContribution, adoptLock,
    snoozePhase, snoozeChangedAtMs, sanitizeSnoozeEntry, snoozePlan, snoozeEntry, endSnoozeEntry, adoptSnooze,
    DAY_NAMES, DEFAULT_GROUP_TYPE, DEFAULT_ALLOWED_MINUTES, DEFAULT_RESET_INTERVAL_HOURS, DEFAULT_SNOOZE_MINUTES,
    DEFAULT_SNOOZE_CONFIRMATIONS, DEFAULT_SNOOZE_ACTIVATION_DELAY_MINUTES, DEFAULT_SNOOZE_COOLDOWN_MINUTES,
    MAX_SNOOZE_COOLDOWN_MINUTES, DEFAULT_PAUSE_SECONDS, MAX_PAUSE_SECONDS, MS_PER_MINUTE, MS_PER_HOUR, USAGE_BUCKET_MS,
    createGroupId, createDefaultDays, getDayNameForDate, normalizeBlockingMode, isTimedBlockingMode,
    parseAllowedMinutes, parseResetIntervalHours, parseSnoozeMinutes, parseSnoozeDelayMinutes, parseSnoozeCooldownMinutes,
    parsePauseSeconds, parseSnoozeConfirmations, normalizeTimeWindowLine, parseTimeWindowsText, parseTimeWindowToMinutes, isGroupActiveNow,
    getAllowedMs, getResetIntervalMs, cbStartOfDayMs, cbNextMidnightMs, cbPeriodStartMs, cbNextResetMs,
    cbUsageBucketStartMs, cbPruneUsageBuckets, cbBucketsUsedMs, cbNextReturnMs,
    sanitizeUsageTimers, sanitizeSnoozeTotals, sanitizeResetTimes, sanitizeUsageBuckets, sanitizeSnoozes,
    DEFAULT_GLOBAL_SETTINGS, TICK_RATE_MIN_MS, TICK_RATE_MAX_MS, AUTOSAVE_DEBOUNCE_MAX_MS, sanitizeGlobalSettings
  });
  global.CBGroupActions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
