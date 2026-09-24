/* Timed-group budget + schedule rules: fixed reset (drifting or re-anchored at
   midnight), rolling limit (per-minute usage that ages out), and time windows
   that cross midnight. Popup and service worker must share the same helpers;
   Mac Vault mirrors them in UsageBudget.swift. */
"use strict";
process.env.TZ = "UTC";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
const popup = read("popup.js"); const background = read("background.js");

let pass = 0; let fail = 0;
function check(label, ok, detail) { if (ok) { pass += 1; console.log(`PASS ${label}`); } else { fail += 1; console.log(`FAIL ${label}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`); } }

const BUDGET = ["getResetIntervalMs", "cbStartOfDayMs", "cbNextMidnightMs", "cbPeriodStartMs", "cbNextResetMs",
  "cbUsageBucketStartMs", "cbPruneUsageBuckets", "cbBucketsUsedMs", "cbNextReturnMs", "sanitizeUsageBuckets"];
for (const name of BUDGET) {
  check(`popup and service worker share ${name}`, extractFunction(popup, name) === extractFunction(background, name));
}

const context = vm.createContext({});
vm.runInContext([
  "const MS_PER_MINUTE = 60000; const MS_PER_HOUR = 3600000; const USAGE_BUCKET_MS = MS_PER_MINUTE;",
  background.slice(background.indexOf("const DAY_NAMES = ["), background.indexOf("];", background.indexOf("const DAY_NAMES = [")) + 2),
  ...BUDGET.map((name) => extractFunction(background, name)),
  ...["normalizeTimeWindowLine", "parseTimeWindowsText", "parseTimeWindowToMinutes", "getDayNameForDate", "isGroupActiveNow"].map((name) => extractFunction(background, name))
].join("\n"), context);
const call = (expr, vars) => { Object.assign(context, vars); return vm.runInContext(expr, context); };
const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute).getTime(); // 2026-09-21 is a Monday
const group = (hours, extra = {}) => ({ resetIntervalHours: hours, resetAtMidnight: false, rollingLimit: false, ...extra });

// Fixed budget
{
  const g = group(2.5);
  const start = call("cbPeriodStartMs(a, g, n)", { a: at(21, 22, 30), g, n: at(22, 3) });
  check("fixed interval drifts across the day without the midnight option", start === at(22, 1), start);
  check("…next reset is one interval later", call("cbNextResetMs(s, g, n)", { s: start, g, n: at(22, 3) }) === at(22, 3, 30));
  check("inside a period the anchor stays", call("cbPeriodStartMs(a, g, n)", { a: at(21, 10), g, n: at(21, 11) }) === at(21, 10));
}
{
  const g = group(2.5, { resetAtMidnight: true });
  const late = call("cbPeriodStartMs(a, g, n)", { a: at(21, 20), g, n: at(21, 23) });
  check("midnight option: grid 00:00, 02:30 … 22:30", late === at(21, 22, 30), late);
  check("midnight option: last period of the day ends at midnight (1.5 h)",
    call("cbNextResetMs(s, g, n)", { s: late, g, n: at(21, 23) }) === at(22, 0));
  check("midnight option: the grid restarts at 00:00, not 01:00",
    call("cbPeriodStartMs(a, g, n)", { a: at(21, 22, 30), g, n: at(22, 3) }) === at(22, 2, 30));
}

// Rolling limit
{
  const g = group(24, { rollingLimit: true });
  const buckets = { [at(21, 9)]: 300000, [at(21, 20)]: 600000 };
  const early = call("cbPruneUsageBuckets(b, g, n)", { b: buckets, g, n: at(22, 8, 30) });
  check("rolling: everything inside the window still counts", call("cbBucketsUsedMs(b)", { b: early }) === 900000);
  check("rolling: time starts coming back when the oldest minute ages out",
    call("cbNextReturnMs(b, g, n)", { b: early, g, n: at(22, 8, 30) }) === at(22, 9, 1));
  const later = call("cbPruneUsageBuckets(b, g, n)", { b: buckets, g, n: at(22, 9, 30) });
  check("rolling: aged-out minutes come back gradually", call("cbBucketsUsedMs(b)", { b: later }) === 600000);
  check("rolling: nothing used, nothing to return", call("cbNextReturnMs(b, g, n)", { b: {}, g, n: at(22, 9) }) === null);
}
{
  const g = group(24, { rollingLimit: true, resetAtMidnight: true });
  const buckets = { [at(21, 20)]: 600000 };
  check("rolling + midnight: midnight comes before the minute ages out",
    call("cbNextReturnMs(b, g, n)", { b: buckets, g, n: at(21, 23) }) === at(22, 0));
  check("rolling + midnight: midnight clears the window",
    call("cbBucketsUsedMs(cbPruneUsageBuckets(b, g, n))", { b: buckets, g, n: at(22, 1) }) === 0);
}

// Time windows crossing midnight belong to the day they start.
{
  check("2300-0100 is a valid window", call("normalizeTimeWindowLine(l)", { l: "2300-0100" }) !== null);
  check("an empty window (1200-1200) is still rejected", call("normalizeTimeWindowLine(l)", { l: "1200-1200" }) === null);
  const popupContext = vm.createContext({});
  vm.runInContext(extractFunction(popup, "normalizeTimeWindowLine"), popupContext);
  check("the popup editor accepts 2300-0100 too", vm.runInContext('normalizeTimeWindowLine("2300-0100")', popupContext) === "2300-0100");
  check("the popup editor still rejects 1200-1200", vm.runInContext('normalizeTimeWindowLine("1200-1200")', popupContext) === null);
  const g = { groupType: "site", activeDays: ["monday"], timeWindowsText: "2300-0100" };
  const active = (day, hour, minute) => call("isGroupActiveNow(g, n)", { g, n: at(day, hour, minute) });
  check("Monday evening part is active", active(21, 23, 30) === true);
  check("Tuesday 00:30 belongs to Monday's window", active(22, 0, 30) === true);
  check("the window ends at 01:00", active(22, 1, 0) === false);
  check("Tuesday's own evening needs Tuesday active", active(22, 23, 30) === false);
  check("Monday 00:30 needs Sunday active", active(21, 0, 30) === false);
}

console.log(`USAGE BUDGET TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
if (fail) process.exitCode = 1;
