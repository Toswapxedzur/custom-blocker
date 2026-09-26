// Group actions — the lock rules, one implementation for every caller: the
// editor (browser popup and the Mac editor, which runs this same file), the
// service worker's AI-tool operations, and the Mac app's AI tools (run in
// JavaScriptCore). Owner model 2026-09-26: a tool may do exactly what the user
// can, no more, no less — so the gates live here, not in each caller.
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

  const api = Object.freeze({
    CONFIRMATIONS, CONFIRM_INTERVAL_MS, MAX_WAIT_HOURS, LOCK_FIELDS,
    parseWaitHours, normalizeLock, isLocked, hasPin, waitUntilMs, status,
    lock, tighten, setGates, upgradePinHash, unlockPlan, unlock, deleteAllPlan, confirmStart, confirmStep,
    lockUnit, lockContribution, adoptLock,
    snoozePhase, snoozeChangedAtMs, sanitizeSnoozeEntry, snoozePlan, snoozeEntry, endSnoozeEntry, adoptSnooze
  });
  global.CBGroupActions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
