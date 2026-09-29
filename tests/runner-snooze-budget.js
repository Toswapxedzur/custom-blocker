/* Snooze kind (owner 2026-09-29): a time-limit group's snooze either exempts
   the group for its minutes of clock time ("time", the default) or adds its
   minutes to the allowance ("budget"): spent only while in use, lapsing at the
   next budget reset (rolling limit: one window, or midnight with that option),
   ended once used up. One copy of the rules in group-actions.js (editor, worker,
   Mac Vault via JavaScriptCore); the worker's tidy (applyRuntimeNormalizations)
   ends a used-up budget snooze and counts it from the period it ran in. */
"use strict";
process.env.TZ = "UTC";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let pass = 0; let fail = 0;
function check(label, ok, detail) { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`); } }

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  let depth = 0; let i = source.indexOf(") {", start) + 2;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      for (i += 1; i < source.length && source[i] !== ch; i += 1) if (source[i] === "\\") i += 1;
    } else if (ch === "/" && source[i + 1] === "/") {
      i = source.indexOf("\n", i);
    } else if (ch === "/" && source[i + 1] === "*") {
      i = source.indexOf("*/", i) + 1;
    } else if (ch === "{") depth += 1;
    else if (ch === "}") { depth -= 1; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const context = vm.createContext({});
vm.runInContext(read("parental-pin.js"), context);
vm.runInContext(read("group-actions.js"), context);
vm.runInContext("Object.assign(globalThis, CBGroupActions)", context);
// The worker's tidy, run as written (link state stubbed: no link).
vm.runInContext([
  "var cbConnection = { routeIsReady: () => false }; function cbGroupInLink() { return false; }",
  extractFunction(read("background.js"), "applyRuntimeNormalizations")
].join("\n"), context);
const call = (expr, vars) => { Object.assign(context, vars); return vm.runInContext(expr, context); };
const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute).getTime(); // 2026-09-21 is a Monday
const MIN = 60000;
const group = (extra = {}) => ({
  id: "g", mode: "after-minutes", allowedMinutes: 15, resetIntervalHours: 2, resetAtMidnight: false,
  rollingLimit: false, snoozeKind: "budget", snoozeMinutes: 10, snoozeActivationDelayMinutes: 0,
  snoozeCooldownMinutes: 2, snoozeConfirmations: 0, ...extra
});

// Which entry a snooze makes
{
  const time = call("snoozeEntry(g, n, a)", { g: group({ snoozeKind: "time" }), n: at(21, 11), a: at(21, 10) });
  check("time kind: today's entry (no kind, runs 10 clock minutes)", !time.kind && time.untilMs - time.startsAtMs === 10 * MIN, time);
  const instant = call("snoozeEntry(g, n, a)", { g: group({ mode: "instant" }), n: at(21, 11), a: at(21, 10) });
  check("budget kind is ignored outside the time-limit mode", !instant.kind, instant);
  const b = call("snoozeEntry(g, n, a)", { g: group(), n: at(21, 11), a: at(21, 10) });
  check("budget kind: extra = the snooze minutes", b.kind === "budget" && b.extraMs === 10 * MIN, b);
  check("budget kind: lapses at the next reset (anchor 10:00, every 2 h → 12:00)", b.untilMs === at(21, 12), b.untilMs);
  check("budget kind: cooldown follows its end", b.cooldownUntilMs === at(21, 12) + 2 * MIN);
  const mid = call("snoozeEntry(g, n, a)", { g: group({ resetIntervalHours: 2.5, resetAtMidnight: true }), n: at(21, 23), a: at(21, 1) });
  check("budget kind + midnight grid: lapses at midnight (the day's last period)", mid.untilMs === at(22, 0), mid.untilMs);
  const roll = call("snoozeEntry(g, n, a)", { g: group({ rollingLimit: true, resetIntervalHours: 3 }), n: at(21, 11), a: 0 });
  check("budget kind + rolling limit: the room lasts one window", roll.untilMs === at(21, 14), roll.untilMs);
  const rollMid = call("snoozeEntry(g, n, a)", { g: group({ rollingLimit: true, resetIntervalHours: 3, resetAtMidnight: true }), n: at(21, 23), a: 0 });
  check("budget kind + rolling + midnight: the room lapses at midnight", rollMid.untilMs === at(22, 0), rollMid.untilMs);
  const delayed = call("snoozeEntry(g, n, a)", { g: group({ snoozeActivationDelayMinutes: 5 }), n: at(21, 11), a: at(21, 10) });
  check("activation delay: the extra room starts later", delayed.startsAtMs === at(21, 11, 5) && delayed.untilMs === at(21, 12));
}

// What a running snooze does
{
  const b = call("snoozeEntry(g, n, a)", { g: group(), n: at(21, 11), a: at(21, 10) });
  const t = call("snoozeEntry(g, n, a)", { g: group({ snoozeKind: "time" }), n: at(21, 11), a: at(21, 10) });
  check("a time snooze exempts the group", call("snoozeExempts(e, n)", { e: t, n: at(21, 11, 5) }) === true);
  check("a budget snooze does not exempt it", call("snoozeExempts(e, n)", { e: b, n: at(21, 11, 5) }) === false);
  check("while it runs the allowance is 15 + 10 minutes", call("effectiveAllowedMs(g, e, n)", { g: group(), e: b, n: at(21, 11, 5) }) === 25 * MIN);
  check("after the reset the extra room is gone", call("effectiveAllowedMs(g, e, n)", { g: group(), e: b, n: at(21, 12, 1) }) === 15 * MIN);
  const delayed = call("snoozeEntry(g, n, a)", { g: group({ snoozeActivationDelayMinutes: 5 }), n: at(21, 11), a: at(21, 10) });
  check("not before its activation delay", call("effectiveAllowedMs(g, e, n)", { g: group(), e: delayed, n: at(21, 11, 2) }) === 15 * MIN);
  check("a time snooze adds no allowance", call("effectiveAllowedMs(g, e, n)", { g: group(), e: t, n: at(21, 11, 5) }) === 15 * MIN);
}

// Ending when used up, and what counts as snoozed
{
  const b = call("snoozeEntry(g, n, a)", { g: group(), n: at(21, 11), a: at(21, 10) });
  check("not used up (24 of 25 min): nothing ends", call("settleBudgetSnooze(e, g, u, n)", { e: b, g: group(), u: 24 * MIN, n: at(21, 11, 30) }) === null);
  const ended = call("settleBudgetSnooze(e, g, u, n)", { e: b, g: group(), u: 25 * MIN, n: at(21, 11, 30) });
  check("used up: the snooze ends now (the block returns)", ended && ended.untilMs === at(21, 11, 30) && ended.kind === "budget", ended);
  check("…and its cooldown runs from now", ended.cooldownUntilMs === at(21, 11, 30) + 2 * MIN);
  check("…so a new snooze can follow the cooldown", call("snoozePlan(g, e, n).error", { g: group(), e: ended, n: at(21, 11, 33) }) === undefined);
  check("counted: the extra minutes used (all 10)", call("snoozeCountedMs(e, g, u)", { e: ended, g: group(), u: 25 * MIN }) === 10 * MIN);
  check("counted: only the part used beyond the allowance (18 min used → 3)", call("snoozeCountedMs(e, g, u)", { e: b, g: group(), u: 18 * MIN }) === 3 * MIN);
  check("counted: nothing when the extra wasn't needed", call("snoozeCountedMs(e, g, u)", { e: b, g: group(), u: 9 * MIN }) === 0);
  const t = call("snoozeEntry(g, n, a)", { g: group({ snoozeKind: "time" }), n: at(21, 11), a: at(21, 10) });
  check("a time snooze still counts its clock time", call("snoozeCountedMs(e, g, u)", { e: t, g: group(), u: 0 }) === 10 * MIN);
}

// Stored and shared entries keep their kind; tools check the setting
{
  const b = call("snoozeEntry(g, n, a)", { g: group(), n: at(21, 11), a: at(21, 10) });
  const kept = call("sanitizeSnoozeEntry(e)", { e: JSON.parse(JSON.stringify(b)) });
  check("a stored budget entry keeps its kind and extra", kept.kind === "budget" && kept.extraMs === 10 * MIN, kept);
  const adopted = call("adoptSnooze(l, s, ts)", { l: null, s: b, ts: at(21, 11) });
  check("a linked device's budget entry is adopted with its kind", adopted && adopted.kind === "budget", adopted);
  check("snoozeKind 'budget' is a valid edit", call("validateGroupPatch(p, t)", { p: { snoozeKind: "budget" }, t: "site" }) === null);
  check("an unknown snoozeKind is refused", call("validateGroupPatch(p, t)", { p: { snoozeKind: "forever" }, t: "site" }) === "invalid-snoozeKind");
}

// The worker's tidy on stored state
{
  const g = group();
  const b = call("snoozeEntry(g, n, a)", { g, n: at(21, 11), a: at(21, 10) });
  let out = call("applyRuntimeNormalizations([g], t, r, s, tot, n, {})",
    { g, t: { g: 25 * MIN }, r: { g: at(21, 10) }, s: { g: b }, tot: { g: 0 }, n: at(21, 11, 40) });
  check("tidy: a used-up budget snooze is ended", out.groupSnoozes.g.untilMs === at(21, 11, 40), out.groupSnoozes.g);
  check("tidy: …and counted once (10 min)", out.groupSnoozeTotalsMs.g === 10 * MIN && out.groupSnoozes.g.activeMsApplied === true);
  // A budget snooze that lapses at the reset: counted from the period it ran in, then the budget resets.
  const b2 = call("snoozeEntry(g, n, a)", { g, n: at(21, 11), a: at(21, 10) });
  out = call("applyRuntimeNormalizations([g], t, r, s, tot, n, {})",
    { g, t: { g: 19 * MIN }, r: { g: at(21, 10) }, s: { g: b2 }, tot: { g: 0 }, n: at(21, 12, 1) });
  check("tidy: a snooze lapsing at the reset counts the extra used before it (4 min)", out.groupSnoozeTotalsMs.g === 4 * MIN, out.groupSnoozeTotalsMs);
  check("tidy: …and the budget still resets", out.usageTimersMs.g === 0 && out.usageResetAtMs.g === at(21, 12));
}

console.log(`SNOOZE BUDGET TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
