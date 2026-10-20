"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "safari-native-lifecycle.js"), "utf8");
let checks = 0;
function check(value, label) { if (!value) throw new Error(label); checks++; console.log("PASS " + label); }
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function fixture(options = {}) {
  const calls = [], activations = [], timers = new Map();
  let now = 0, nextTimer = 0, ports = 0, pulses = 0;
  const runtime = {
    connectNative() { ports++; throw new Error("lifecycle must not open a native port"); },
    sendNativeMessage(host, message) {
      if (message.type === "safari-lifecycle-activate") {
        activations.push({ host, message });
        if (options.throwActivate) throw new Error("activation unavailable");
        return options.rejectActivate ? Promise.reject(new Error("activation refused")) : Promise.resolve({ ok: true });
      }
      const call = { host, message, started: now }; calls.push(call);
      if (options.throwSend) throw new Error("native unavailable");
      return new Promise((resolve, reject) => { call.resolve = resolve; call.reject = reject; });
    }
  };
  if (options.noSend) delete runtime.sendNativeMessage;
  const context = vm.createContext({
    CBLocalHubEnvironment: options.noEnvironment ? undefined : { current: { nativeHost: "com.adamancia.vault.safari.development.extension" } },
    CB_SAFARI_RUNTIME_CONFIG: options.noConfig ? undefined : { environment: "development" },
    CBSafariLifetimeTick() { pulses++; },
    chrome: { runtime }, Date: { now: () => now },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; }
  });
  context.self = context; vm.runInContext(source, context);
  return { context, calls, activations, timers, get ports() { return ports; }, get pulses() { return pulses; },
    advance(ms) { now += ms; },
    timer() { check(timers.size === 1, "exactly one next-request timer is scheduled"); const [id, timer] = timers.entries().next().value; timers.delete(id); now += timer.delay; timer.fn(); return timer.delay; }
  };
}
(async () => {
  for (const option of ["noConfig", "noEnvironment"]) {
    const f = fixture({ [option]: true }); await flush();
    check(f.calls.length === 0 && f.activations.length === 0 && f.ports === 0 && !f.context.CBSafariNativeLifecycle, option + " isolates the Safari lifecycle adapter");
  }
  const unavailable = fixture({ noSend: true }); await flush();
  check(unavailable.ports === 0 && unavailable.timers.size === 0, "missing native request API does not fall back to launch-capable port or retry storm");
  const f = fixture(); await flush();
  check(f.calls.length === 1 && f.calls[0].host === "com.adamancia.vault.safari.development.extension" && f.calls[0].message.type === "safari-lifecycle-wait", "lifecycle uses the configured host and browser-initiated held request");
  check(f.ports === 0 && f.activations.length === 1 && f.activations[0].host === f.calls[0].host, "one independent companion bootstrap replaces the native lifecycle port");
  for (let i = 0; i < 10; i++) f.context.CBSafariNativeLifecycle.connect();
  await flush(); check(f.calls.length === 1 && f.timers.size === 0, "a pending or stalled request remains the sole in-flight native operation");
  f.advance(1000); f.calls[0].resolve({ ok: true, type: "safari-lifecycle-tick" }); await flush();
  check(f.pulses === 1, "validated native reply invokes the void-returning lifetime tick");
  f.context.CBSafariNativeLifecycle.connect(); await flush();
  check(f.calls.length === 1, "connect is idempotent while the next request is scheduled");
  check(f.timer() === 0, "a native one-second hold needs no extra heartbeat delay"); await flush();
  check(f.calls.length === 2, "settled request is replaced with one fresh native wait");
  f.context.CBSafariLifetimeTick = async () => { throw new Error("async rule failure"); };
  f.calls[1].resolve({ ok: true, type: "safari-lifecycle-tick" }); await flush();
  check(f.timer() === 1000, "fast valid reply and rejected async tick retain the one-second request floor"); await flush();
  f.context.CBSafariLifetimeTick = () => { throw new Error("sync rule failure"); };
  f.calls[2].resolve({ ok: true, type: "safari-lifecycle-tick" }); await flush();
  check(f.timer() === 1000, "throwing lifetime tick cannot stop bounded native request recovery"); await flush();
  f.context.CBSafariLifetimeTick = () => Promise.resolve();
  f.calls[3].resolve({ ok: true, type: "safari-lifecycle-tick" }); await flush();
  check(f.timer() === 1000, "fulfilled asynchronous lifetime tick keeps one scheduled wait"); await flush();
  for (const malformed of [undefined, { ok: false, type: "safari-lifecycle-tick" }, { ok: 1, type: "safari-lifecycle-tick" }, { ok: true, type: "other" }, { name: "safari-lifecycle-tick", userInfo: { type: "safari-lifecycle-tick" } }]) {
    const priorPulses = f.pulses; f.calls.at(-1).resolve(malformed); await flush();
    check(f.pulses === priorPulses, "malformed or obsolete push envelope never invokes lifetime work");
    check(f.timer() === 1000, "malformed native reply retries with a one-second floor"); await flush();
  }
  f.calls.at(-1).reject(new Error("native host terminated")); await flush();
  check(f.timer() === 1000, "native rejection schedules bounded recovery"); await flush();
  f.advance(-5000); f.calls.at(-1).reject(new Error("clock changed")); await flush();
  check(f.timer() === 1000, "wall-clock rollback cannot expand or remove the retry bound"); await flush();
  const synchronous = fixture({ throwSend: true }); await flush();
  check(synchronous.calls.length === 1 && synchronous.ports === 0, "synchronous native failure is contained");
  for (let i = 0; i < 10; i++) synchronous.context.CBSafariNativeLifecycle.connect();
  check(synchronous.calls.length === 1, "manual reconnect calls cannot bypass a failure backoff");
  check(synchronous.timer() === 1000, "synchronous native failure retries without a tight loop"); await flush();
  check(synchronous.calls.length === 2 && synchronous.timers.size === 1, "repeated native failure retains exactly one bounded retry");
  check(f.activations.length === 1 && synchronous.activations.length === 1, "repeated connect and retry never repeat companion activation");
  for (const option of ["throwActivate", "rejectActivate"]) {
    const failedBootstrap = fixture({ [option]: true }); await flush();
    check(failedBootstrap.activations.length === 1 && failedBootstrap.calls.length === 1, option + " does not prevent the independent native wait");
    failedBootstrap.calls[0].resolve({ ok: true, type: "safari-lifecycle-tick" }); await flush();
    check(failedBootstrap.pulses === 1, option + " does not prevent a validated lifetime tick");
  }
  await new Promise(resolve => setImmediate(resolve));
  console.log(`__CB_TEST_RESULT__: OK (${checks} checks, 0 failures)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
