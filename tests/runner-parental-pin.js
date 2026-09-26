/* Parental PIN (owner 2026-09-26): stored as a slow PBKDF2-SHA256 hash (the
   plain-JS fallback must equal the platform one, since the Mac editor has no
   crypto.subtle); PINs stored in an old format still open once and are then
   upgraded; a wrong PIN makes the next try wait 1 s, 2 s, 4 s … up to 64 s. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const nodeCrypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "popup.js"), "utf8");
const start = source.indexOf("// --- Parental password");
const end = source.indexOf("// --- Overlay panel channel");
if (start < 0 || end < 0) throw new Error("Could not locate the parental PIN block in popup.js.");

function makeContext({ subtle }) {
  const storage = new Map();
  const statuses = [];
  const persisted = [];
  let now = 1_000_000;
  const ctx = vm.createContext({
    TextEncoder,
    crypto: subtle ? globalThis.crypto : { getRandomValues: (a) => nodeCrypto.getRandomValues(a) },
    Uint8Array, Int32Array, Uint32Array, DataView, Math, Number, String, RegExp, Object, Promise,
    Date: { now: () => now },
    chrome: {
      storage: {
        local: {
          get: (defaults) => {
            const out = {};
            for (const [k, d] of Object.entries(defaults)) out[k] = storage.has(k) ? JSON.parse(JSON.stringify(storage.get(k))) : d;
            return Promise.resolve(out);
          },
          set: (obj) => { for (const [k, v] of Object.entries(obj)) storage.set(k, JSON.parse(JSON.stringify(v))); return Promise.resolve(); }
        }
      }
    },
    t: (key, vars) => `${key}${vars ? JSON.stringify(vars) : ""}`,
    setStatus: (text) => statuses.push(text),
    persistGroupFields: (id, fields) => { persisted.push({ id, fields }); return Promise.resolve(); }
  });
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, "parental-pin.js"), "utf8"), ctx, { filename: "parental-pin.js" });
  vm.runInContext(source.slice(start, end), ctx, { filename: "popup.js#parental-pin" });
  // The module's pieces the checks below reach for by name.
  vm.runInContext("var hashParentalPin = CBParentalPin.hashParentalPin, pbkdf2Hex = CBParentalPin.pbkdf2Hex, legacyFallbackPinHash = CBParentalPin.legacyFallbackPinHash, pinRetryDelayMs = CBParentalPin.retryDelayMs; async function verifyGroupParentalPin(group, pin) { const r = await CBParentalPin.verify(group, pin); if (r.upgradedHash) { group.parentalPasswordHash = r.upgradedHash; await persistGroupFields(group.id, { parentalPasswordHash: r.upgradedHash }); } return r.ok; }", ctx);
  return { ctx, statuses, persisted, advance: (ms) => { now += ms; } };
}

let pass = 0;
let fail = 0;
const check = (label, ok, detail) => {
  if (ok) { pass += 1; console.log(`PASS ${label}`); }
  else { fail += 1; console.log(`FAIL ${label} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
};

(async () => {
  const js = makeContext({ subtle: false });
  const native = makeContext({ subtle: true });
  const salt = "0123456789abcdef0123456789abcdef";
  const expected = nodeCrypto.pbkdf2Sync("135790", salt, 100000, 32, "sha256").toString("hex");

  const jsHash = await js.ctx.hashParentalPin("135790", salt);
  check("a PIN is stored as PBKDF2-SHA256, 100 000 rounds", jsHash === `pbkdf2-sha256$100000$${expected}`, jsHash);
  check("the plain-JS PBKDF2 (Mac editor) equals the platform one", jsHash === await native.ctx.hashParentalPin("135790", salt));
  check("…and matches RFC 7914's PBKDF2-SHA256 vector", (await js.ctx.pbkdf2Hex("passwd", "salt", 1)).startsWith("55ac046e56e3089fec1691c22544b605"));

  const group = { id: "g", parentalPasswordHash: jsHash, parentalPasswordSalt: salt };
  check("the right PIN opens", await js.ctx.verifyGroupParentalPin(group, "135790") === true);
  check("a wrong PIN does not", await js.ctx.verifyGroupParentalPin(group, "135791") === false);

  // Old formats open once, then are upgraded to the slow hash.
  const legacy = { id: "old", parentalPasswordSalt: salt, parentalPasswordHash: nodeCrypto.createHash("sha256").update(`${salt}:246810`).digest("hex") };
  check("a PIN stored as salted SHA-256 (before 2026-09-26) still opens", await js.ctx.verifyGroupParentalPin(legacy, "246810") === true);
  check("…and is upgraded to the slow hash on that entry", legacy.parentalPasswordHash.startsWith("pbkdf2-sha256$100000$") && js.persisted.some((p) => p.id === "old" && p.fields.parentalPasswordHash === legacy.parentalPasswordHash), js.persisted);
  const fallback = { id: "fb", parentalPasswordSalt: salt, parentalPasswordHash: js.ctx.legacyFallbackPinHash("112233", salt) };
  check("a PIN stored in the old Mac fallback format opens once and is upgraded", await js.ctx.verifyGroupParentalPin(fallback, "112233") === true && fallback.parentalPasswordHash.startsWith("pbkdf2-sha256$"));
  check("an old-format hash still refuses a wrong PIN", await js.ctx.verifyGroupParentalPin({ ...legacy, parentalPasswordHash: nodeCrypto.createHash("sha256").update(`${salt}:246810`).digest("hex") }, "000000") === false);

  // Retry gate: 1 s, 2 s, 4 s … capped at 64 s.
  check("wait after the nth wrong PIN: 1, 2, 4 … 64, 64 s",
    [1, 2, 3, 4, 7, 8, 20].map((n) => js.ctx.pinRetryDelayMs(n)).join() === "1000,2000,4000,8000,64000,64000,64000");
  const gated = { id: "gate", parentalPasswordHash: jsHash, parentalPasswordSalt: salt };
  check("a wrong PIN is refused", await js.ctx.checkParentalPin(gated, "000000") === false);
  check("…and says to wait 1 s", js.statuses.at(-1) === 'freeze.pin.wrongWait{"seconds":1}', js.statuses.at(-1));
  check("inside the wait, even the right PIN is not checked", await js.ctx.checkParentalPin(gated, "135790") === false && js.statuses.at(-1).startsWith("freeze.pin.wait"), js.statuses.at(-1));
  js.advance(1000);
  check("a second wrong PIN after the wait is refused", await js.ctx.checkParentalPin(gated, "000001") === false);
  check("…and doubles the wait to 2 s", js.statuses.at(-1) === 'freeze.pin.wrongWait{"seconds":2}', js.statuses.at(-1));
  js.advance(2000);
  check("after the wait the right PIN opens", await js.ctx.checkParentalPin(gated, "135790") === true);
  check("…and the count starts over", await js.ctx.checkParentalPin(gated, "000000") === false && js.statuses.at(-1) === 'freeze.pin.wrongWait{"seconds":1}', js.statuses.at(-1));
  check("another group's PIN has its own count", await js.ctx.checkParentalPin({ ...gated, id: "other" }, "135790") === true);

  console.log(`PARENTAL PIN TOTAL ${pass + fail} PASS ${pass} FAIL ${fail}`);
  console.log(fail === 0 ? "__CB_TEST_RESULT__: OK" : "__CB_TEST_RESULT__: FAIL");
  if (fail) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
