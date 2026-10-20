"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "safari-native-lifecycle.js"), "utf8");
let checks = 0;
function check(value, label) { if (!value) throw new Error(label); checks++; console.log("PASS " + label); }
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function fixture(options = {}) {
  const ports = [], activations = [], timers = new Map();
  let now = 0, nextTimer = 0, pulses = 0, attempts = 0;
  const runtime = {
    connectNative(host) {
      attempts++; if (options.throwConnect) throw new Error("native unavailable");
      const messages = [], listeners = {};
      const port = { host, messages, disconnects: 0,
        onMessage: { addListener(fn) { listeners.message = fn; } },
        onDisconnect: { addListener(fn) { listeners.disconnect = fn; } },
        postMessage(message) { messages.push({ message, started: now }); if (options.throwPost) throw new Error("port closed"); },
        disconnect() { port.disconnects++; listeners.disconnect?.(); },
        emit(message) { listeners.message?.(message); },
        drop() { listeners.disconnect?.(); }
      };
      ports.push(port); return port;
    },
    sendNativeMessage(host, message) {
      if (message.type !== "safari-lifecycle-activate") throw new Error("heartbeat must use its active port");
      activations.push({ host, message });
      if (options.throwActivate) throw new Error("activation unavailable");
      return options.rejectActivate ? Promise.reject(new Error("activation refused")) : Promise.resolve({ ok: true });
    }
  };
  if (options.noConnect) delete runtime.connectNative;
  const context = vm.createContext({
    CBLocalHubEnvironment: options.noEnvironment ? undefined : { current: { nativeHost: "com.adamancia.vault.safari.development.extension" } },
    CB_SAFARI_RUNTIME_CONFIG: options.noConfig ? undefined : { environment: "development" },
    CBSafariLifetimeTick() { pulses++; }, chrome: { runtime }, Date: { now: () => now },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  context.self = context; vm.runInContext(source, context);
  return { context, ports, activations, timers, get pulses() { return pulses; }, get attempts() { return attempts; },
    advance(ms) { now += ms; },
    timer() { check(timers.size === 1, "exactly one request or reconnect timer is scheduled"); const [id, timer] = timers.entries().next().value; timers.delete(id); now += timer.delay; timer.fn(); return timer.delay; }
  };
}
const tick = { ok: true, type: "safari-lifecycle-tick" };
(async () => {
  for (const option of ["noConfig", "noEnvironment"]) {
    const f = fixture({ [option]: true }); await flush();
    check(f.ports.length === 0 && f.activations.length === 0 && !f.context.CBSafariNativeLifecycle, option + " isolates the Safari lifecycle adapter");
  }
  const unavailable = fixture({ noConnect: true }); await flush();
  check(unavailable.activations.length === 0 && unavailable.timers.size === 0, "missing port API does not silently fall back to one-shot heartbeat messages");
  const f = fixture(); await flush(); let port = f.ports[0];
  check(f.ports.length === 1 && port.host === "com.adamancia.vault.safari.development.extension" && port.messages[0]?.message.type === "safari-lifecycle-wait", "configured native port starts one browser-initiated held wait");
  check(f.activations.length === 1 && f.activations[0].host === port.host, "companion bootstrap is independent and occurs once");
  for (let i = 0; i < 10; i++) f.context.CBSafariNativeLifecycle.connect();
  check(f.ports.length === 1 && port.messages.length === 1 && f.timers.size === 0, "pending or stalled wait cannot create another port or request");
  f.advance(1000); port.emit(tick); await flush();
  check(f.pulses === 1, "strict native reply invokes the void-returning lifetime tick");
  port.emit(tick); f.context.CBSafariNativeLifecycle.connect(); await flush();
  check(f.pulses === 1 && port.messages.length === 1, "unsolicited duplicate reply cannot tick or bypass the scheduled request");
  check(f.timer() === 0 && port.messages.length === 2, "one-second native hold is followed by exactly one fresh port wait");
  f.context.CBSafariLifetimeTick = async () => { throw new Error("async rule failure"); };
  port.emit(tick); await flush(); check(f.timer() === 1000, "fast reply with rejected asynchronous work retains a one-second request floor");
  f.context.CBSafariLifetimeTick = () => { throw new Error("sync rule failure"); };
  port.emit(tick); await flush(); check(f.timer() === 1000, "throwing lifetime work cannot stop the port loop");
  f.context.CBSafariLifetimeTick = () => Promise.resolve();
  port.emit(tick); await flush(); check(f.timer() === 1000, "fulfilled asynchronous lifetime work preserves a single request timer");
  for (const malformed of [undefined, { ok: false, type: "safari-lifecycle-tick" }, { ok: 1, type: "safari-lifecycle-tick" }, { ok: true, type: "other" }, { name: "safari-lifecycle-tick", userInfo: { type: "safari-lifecycle-tick" } }]) {
    const priorPulses = f.pulses, old = port, attempts = f.attempts;
    port.emit(malformed); await flush();
    check(f.pulses === priorPulses && old.disconnects === 1, "malformed or obsolete push envelope retires its port without lifetime work");
    old.emit(tick); old.drop(); f.context.CBSafariNativeLifecycle.connect();
    check(f.attempts === attempts && f.pulses === priorPulses, "retired port events and manual connect cannot bypass reconnect backoff");
    check(f.timer() === 1000, "invalid reply reconnects with a one-second floor"); port = f.ports.at(-1);
    old.emit(tick); check(port.messages.length === 1 && f.pulses === priorPulses, "stale generation reply cannot settle the new port's pending wait");
  }
  const old = port; old.drop(); old.drop();
  check(old.disconnects === 1 && f.timers.size === 1, "repeated disconnect events retire once and schedule one reconnect");
  check(f.timer() === 1000, "native port disconnect gets bounded reconnect"); port = f.ports.at(-1);
  f.advance(-5000); port.emit(tick); await flush();
  check(f.timer() === 1000, "clock rollback cannot expand or remove the next-request bound");
  port.emit(tick); await flush(); check(f.timers.size === 1, "valid reply schedules a single next wait before a disconnect");
  port.drop(); check(f.timers.size === 1 && port.disconnects === 1, "disconnect clears the old scheduled request before reconnect");
  check(f.timer() === 1000, "disconnect during next-request delay restarts only after backoff");
  check(f.activations.length === 1, "port replacement and repeated connect never repeat companion activation");
  for (const option of ["throwConnect", "throwPost"]) {
    const failed = fixture({ [option]: true }); await flush();
    check(failed.attempts === 1 && failed.timers.size === 1, option + " is contained by one reconnect timer");
    for (let i = 0; i < 10; i++) failed.context.CBSafariNativeLifecycle.connect();
    check(failed.attempts === 1, option + " manual reconnect cannot bypass backoff");
    check(failed.timer() === 1000 && failed.attempts === 2, option + " retries without a tight loop");
    check(failed.activations.length === 1 && failed.timers.size === 1, option + " retains one bootstrap and one retry");
  }
  for (const option of ["throwActivate", "rejectActivate"]) {
    const failed = fixture({ [option]: true }); await flush();
    check(failed.activations.length === 1 && failed.ports[0]?.messages.length === 1, option + " cannot prevent the independent port wait");
    failed.ports[0].emit(tick); await flush(); check(failed.pulses === 1, option + " cannot prevent a validated lifetime tick");
  }
  const reentrant = fixture();
  reentrant.context.CBSafariLifetimeTick = () => reentrant.ports[0].drop();
  reentrant.ports[0].emit(tick); await flush();
  check(reentrant.timers.size === 1 && reentrant.ports[0].disconnects === 1, "lifetime work closing its port cannot leave an old request timer beside reconnect");
  check(reentrant.timer() === 1000 && reentrant.ports.length === 2 && reentrant.ports[1].messages.length === 1, "reentrant disconnect resumes on one replacement port only");
  await new Promise(resolve => setImmediate(resolve));
  console.log(`__CB_TEST_RESULT__: OK (${checks} checks, 0 failures)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
