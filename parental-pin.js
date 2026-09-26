// Parental PIN — one implementation for every place a PIN is set or checked:
// the editor (browser popup and the Mac editor, which runs this same file) and
// the service worker's AI-tool operations (owner 2026-09-26: a tool gets
// exactly the user's gates). Pure: callers load and store the attempts map.
(function (global) {
  "use strict";

  const PARENTAL_PIN_LENGTH = 6;

  function isValidParentalPin(pin) {
    return typeof pin === "string" && new RegExp(`^\\d{${PARENTAL_PIN_LENGTH}}$`).test(pin);
  }

  function randomSaltHex(bytes = 16) {
    const arr = new Uint8Array(bytes);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ── Parental PIN hashing (owner 2026-09-26) ────────────────────────────────
  // A 6-digit PIN has a million values, so a fast hash of it is cracked offline
  // in under a second. The PIN is stored as PBKDF2-HMAC-SHA256 with many rounds,
  // in the format "pbkdf2-sha256$<rounds>$<hex>". The same code runs in the
  // browser and in the Mac app's editor, whose custom-scheme page has no
  // crypto.subtle — so PBKDF2 is implemented here in plain JS (identical
  // output); crypto.subtle is used when present, only for speed.
  const PARENTAL_PIN_HASH_PREFIX = "pbkdf2-sha256$";
  const PARENTAL_PIN_ROUNDS = 100000;

  const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  const SHA256_INIT = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  // One SHA-256 compression of a 64-byte block into state h (8 words), in place.
  function sha256Compress(h, block, w) {
    for (let i = 0; i < 16; i++) {
      w[i] = (block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (k + S1 + ((e & f) ^ (~e & g)) + SHA256_K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
  }

  // SHA-256 of `bytes`, continuing from state `init` that already absorbed
  // `prefixLength` bytes (a multiple of 64). Returns 32 bytes.
  function sha256Bytes(bytes, init = SHA256_INIT, prefixLength = 0) {
    const h = Int32Array.from(init);
    const w = new Int32Array(64);
    const totalBits = (prefixLength + bytes.length) * 8;
    const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(totalBits / 4294967296));
    view.setUint32(padded.length - 4, totalBits >>> 0);
    for (let i = 0; i < padded.length; i += 64) sha256Compress(h, padded.subarray(i, i + 64), w);
    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) outView.setInt32(i * 4, h[i]);
    return out;
  }

  // PBKDF2-HMAC-SHA256, one 32-byte block. The HMAC key pads are absorbed once
  // and reused for every round.
  function pbkdf2Sha256Js(passwordBytes, saltBytes, rounds) {
    const key = passwordBytes.length > 64 ? sha256Bytes(passwordBytes) : passwordBytes;
    const ipad = new Uint8Array(64).fill(0x36);
    const opad = new Uint8Array(64).fill(0x5c);
    for (let i = 0; i < key.length; i++) { ipad[i] ^= key[i]; opad[i] ^= key[i]; }
    const w = new Int32Array(64);
    const innerState = Int32Array.from(SHA256_INIT); sha256Compress(innerState, ipad, w);
    const outerState = Int32Array.from(SHA256_INIT); sha256Compress(outerState, opad, w);
    const hmac = (message) => sha256Bytes(sha256Bytes(message, innerState, 64), outerState, 64);
    const first = new Uint8Array(saltBytes.length + 4);
    first.set(saltBytes);
    first[first.length - 1] = 1;
    let u = hmac(first);
    const result = Uint8Array.from(u);
    for (let r = 1; r < rounds; r++) {
      u = hmac(u);
      for (let i = 0; i < 32; i++) result[i] ^= u[i];
    }
    return result;
  }

  async function pbkdf2Hex(pin, saltHex, rounds) {
    const encoder = new TextEncoder();
    const password = encoder.encode(String(pin));
    const salt = encoder.encode(String(saltHex));
    let bytes = null;
    if (global.crypto && global.crypto.subtle && global.crypto.subtle.deriveBits) {
      try {
        const key = await global.crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]);
        bytes = new Uint8Array(await global.crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, key, 256));
      } catch (_) {
        bytes = null;
      }
    }
    if (!bytes) bytes = pbkdf2Sha256Js(password, salt, rounds);
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function hashParentalPin(pin, saltHex) {
    return `${PARENTAL_PIN_HASH_PREFIX}${PARENTAL_PIN_ROUNDS}$${await pbkdf2Hex(pin, saltHex, PARENTAL_PIN_ROUNDS)}`;
  }

  // PINs stored before 2026-09-26 — one salted SHA-256, or the old non-crypto
  // fallback the Mac editor used — are checked once, then upgraded on the first
  // correct entry.
  function legacyParentalPinHash(pin, saltHex) {
    const data = String(saltHex) + ":" + String(pin);
    return [...sha256Bytes(new TextEncoder().encode(data))].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function legacyFallbackPinHash(pin, saltHex) {
    const str = String(saltHex) + ":" + String(pin);
    let h1 = 0xdeadbeef ^ 0;
    let h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const out = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return "fb" + out.toString(16).padStart(14, "0");
  }

  function constantTimeEqual(a, b) {
    const sa = String(a);
    const sb = String(b);
    if (sa.length !== sb.length) return false;
    let diff = 0;
    for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
    return diff === 0;
  }

  // A new PIN, salted: the fields a group stores.
  async function newPinFields(pin) {
    const salt = randomSaltHex();
    return { parentalPasswordSalt: salt, parentalPasswordHash: await hashParentalPin(pin, salt) };
  }

  // { ok, upgradedHash }: a PIN stored in an old format (one salted SHA-256,
  // or the old Mac fallback) opens once; the caller then stores upgradedHash.
  async function verify(group, pin) {
    if (!group || !group.parentalPasswordHash || !group.parentalPasswordSalt) return { ok: false };
    if (!isValidParentalPin(pin)) return { ok: false };
    const stored = String(group.parentalPasswordHash);
    const salt = group.parentalPasswordSalt;
    if (stored.startsWith(PARENTAL_PIN_HASH_PREFIX)) {
      const [, roundsText, hex] = stored.split("$");
      const rounds = Number.parseInt(roundsText, 10);
      if (!Number.isFinite(rounds) || rounds < 1 || !hex) return { ok: false };
      return { ok: constantTimeEqual(await pbkdf2Hex(pin, salt, rounds), hex) };
    }
    const legacy = stored.startsWith("fb") ? legacyFallbackPinHash(pin, salt) : legacyParentalPinHash(pin, salt);
    if (!constantTimeEqual(legacy, stored)) return { ok: false };
    return { ok: true, upgradedHash: await hashParentalPin(pin, salt) };
  }

  // Wrong guesses make the next try wait: 1 s, 2 s, 4 s … doubling up to 64 s
  // (owner 2026-09-26), per group, kept in storage under ATTEMPTS_KEY so
  // closing the editor does not reset it. Every PIN check goes through here.
  const ATTEMPTS_KEY = "parentalPinAttempts";
  const RETRY_CAP_MS = 64000;
  function retryDelayMs(failures) {
    return Math.min(1000 * 2 ** Math.max(0, failures - 1), RETRY_CAP_MS);
  }

  // → { ok, waiting, waitMs, upgradedHash, attempts }. `waiting`: still inside
  // the wait (the PIN was not checked). After a wrong PIN, waitMs is the new
  // wait. `attempts` is the map to store back.
  function stillWaiting(attemptsInput, group, now) {
    const attempts = attemptsInput && typeof attemptsInput === "object" ? { ...attemptsInput } : {};
    const entry = attempts[group.id];
    if (entry && Number(entry.retryAtMs) > now) return { ok: false, waiting: true, waitMs: entry.retryAtMs - now, attempts };
    return null;
  }
  function settle(attemptsInput, group, result, now) {
    const attempts = attemptsInput && typeof attemptsInput === "object" ? { ...attemptsInput } : {};
    if (result.ok) {
      delete attempts[group.id];
      return { ok: true, waiting: false, waitMs: 0, upgradedHash: result.upgradedHash, attempts };
    }
    const failures = (Number(attempts[group.id]?.failures) || 0) + 1;
    const waitMs = retryDelayMs(failures);
    attempts[group.id] = { failures, retryAtMs: now + waitMs };
    return { ok: false, waiting: false, waitMs, attempts };
  }
  async function check(attempts, group, pin, now) {
    return stillWaiting(attempts, group, now) || settle(attempts, group, await verify(group, pin), now);
  }

  // Synchronous twins for engines without promises driven by an event loop
  // (the Mac app's tools run this file in JavaScriptCore): plain-JS PBKDF2,
  // identical output.
  function pbkdf2HexSync(pin, saltHex, rounds) {
    // A host may supply the same standard PBKDF2 natively (the Mac app's
    // JavaScriptCore runs without a JIT, where 100k plain-JS rounds take
    // seconds); the output is identical.
    if (typeof global.__nativePbkdf2Hex === "function") return global.__nativePbkdf2Hex(String(pin), String(saltHex), rounds);
    const encoder = new TextEncoder();
    return [...pbkdf2Sha256Js(encoder.encode(String(pin)), encoder.encode(String(saltHex)), rounds)]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function hashParentalPinSync(pin, saltHex) {
    return `${PARENTAL_PIN_HASH_PREFIX}${PARENTAL_PIN_ROUNDS}$${pbkdf2HexSync(pin, saltHex, PARENTAL_PIN_ROUNDS)}`;
  }
  function newPinFieldsSync(pin) {
    const salt = randomSaltHex();
    return { parentalPasswordSalt: salt, parentalPasswordHash: hashParentalPinSync(pin, salt) };
  }
  function verifySync(group, pin) {
    if (!group || !group.parentalPasswordHash || !group.parentalPasswordSalt) return { ok: false };
    if (!isValidParentalPin(pin)) return { ok: false };
    const stored = String(group.parentalPasswordHash);
    const salt = group.parentalPasswordSalt;
    if (stored.startsWith(PARENTAL_PIN_HASH_PREFIX)) {
      const [, roundsText, hex] = stored.split("$");
      const rounds = Number.parseInt(roundsText, 10);
      if (!Number.isFinite(rounds) || rounds < 1 || !hex) return { ok: false };
      return { ok: constantTimeEqual(pbkdf2HexSync(pin, salt, rounds), hex) };
    }
    const legacy = stored.startsWith("fb") ? legacyFallbackPinHash(pin, salt) : legacyParentalPinHash(pin, salt);
    if (!constantTimeEqual(legacy, stored)) return { ok: false };
    return { ok: true, upgradedHash: hashParentalPinSync(pin, salt) };
  }
  function checkSync(attempts, group, pin, now) {
    return stillWaiting(attempts, group, now) || settle(attempts, group, verifySync(group, pin), now);
  }

  const api = Object.freeze({
    PARENTAL_PIN_LENGTH, ATTEMPTS_KEY, isValidParentalPin, hashParentalPin, newPinFields,
    verify, check, retryDelayMs, pbkdf2Hex, legacyFallbackPinHash,
    verifySync, checkSync, newPinFieldsSync
  });
  global.CBParentalPin = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
