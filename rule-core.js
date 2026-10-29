// Custom rules — the one core both engines run (owner 2026-09-27).
//
// Rules use raw events, managed time objects and a small set of actions.
// The browser engine (the
// extension's sandbox, event-sandbox.js) controls only the browser; Mac Vault's
// engine (custom-rule-runtime.js) controls only apps — the scope line.
//
//   (on, v) => {
//     on("tab", (ev) => { if (/reddit\.com/.test(ev.data.url)) v.cover(ev.data.tabId, true); });
//   }
//
// `on(type, handler)` adds a handler; `handler(ev)` gets { type, now, data }.
// `v` holds the actions: shared ones here, engine ones from the host.

(function (global) {
  "use strict";

  const LIMITS = Object.freeze({
    actionsPerDispatch: 256,
    logsPerDispatch: 200,
    emitsPerDispatch: 64,
    handlersPerGroup: 1000,
    panelsPerGroup: 24,
    controlsPerPanel: 32,
    optionsPerControl: 64,
    stateBytes: 64 * 1024,
    timeObjectsPerGroup: 32,
    handlerMs: 1000
  });

  // Managed time uses the existing per-rule JSON persistence/commit path.
  // A versioned reserved namespace keeps user fields and ordinary group budgets
  // independent. Unsupported/colliding state is refused, never silently reset.
  const TIME_KEY = "$vaultTime";
  const MINUTE_MS = 60000;
  const MAX_TIME_MS = 365 * 24 * 60 * MINUTE_MS;
  const windowsTimeIdentities = global.CBNativeRulePlatform === "windows";
  const normalizeTimeApp = value => windowsTimeIdentities || /^(?:[A-Za-z]:[\\/]|\\\\)|!/.test(String(value || "")) ? String(value || "").toLowerCase() : value;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function duration(value, name, zero = false) {
    if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1) || value > MAX_TIME_MS) throw new Error("Invalid " + name + " (integer milliseconds, at most 365 days).");
    return value;
  }
  function timeID(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value) || ["__proto__", "prototype", "constructor"].includes(value)) throw new Error("Time object IDs use 1–80 letters, digits, _ or - and cannot be prototype names.");
    return value;
  }
  function timeTools(getState, clock, check, initialContext = null) {
    const timers = new Set(), trackers = new Set();
    let changed = false;
    let usageFloor = clock();
    let shared = null;
    const read = () => {
      const state = getState();
      if (!own(state, TIME_KEY)) return { version: 1, objects: {} };
      const saved = state[TIME_KEY];
      if (!isPlainObject(saved) || saved.version !== 1 || !isPlainObject(saved.objects)) throw new Error("Unsupported or invalid " + TIME_KEY + " state; saved data was preserved.");
      if (saved.pending !== undefined && (!Array.isArray(saved.pending) || saved.pending.length > 64) || saved.serial !== undefined && (!Number.isSafeInteger(saved.serial) || saved.serial < 0) || saved.ownTargets !== undefined && !isPlainObject(saved.ownTargets)) throw new Error("Invalid saved time metadata.");
      return saved;
    };
    const update = (fn) => {
      check();
      const saved = cloneJSON(read());
      const result = fn(saved.objects, saved);
      const state = getState();
      const json = safeJSON({ ...state, [TIME_KEY]: saved });
      if (!json || utf8Bytes(json) > LIMITS.stateBytes) throw new Error("Managed time exceeds the rule's 65536-byte state limit; update refused.");
      if (safeJSON(state[TIME_KEY]) !== safeJSON(saved)) { state[TIME_KEY] = saved; changed = true; }
      return result;
    };
    const object = (id, kind) => {
      const objects = read().objects;
      const value = own(objects, id) ? objects[id] : null;
      if (!value || value.kind !== kind) throw new Error("Missing or incompatible time object: " + id);
      return value;
    };
    const pendingFor = id => (read().pending || []).some(command => command.id === id);
    const removed = id => shared?.linked && (read().pending || []).filter(command => command.id === id).at(-1)?.op === "remove";
    const ready = id => !shared?.linked || shared.ready === true && !pendingFor(id);
    function command(id, op, fields = {}, requireReady = true) {
      if (!shared?.linked) return false;
      if (requireReady && !shared.ready) throw new Error("Linked time controls require fresh hub state" + (shared.error ? ": " + shared.error : "."));
      if (removed(id) && !["ensure", "remove"].includes(op)) throw new Error("Time object was removed; declare it before using it again.");
      update(() => {});
      const state = getState()[TIME_KEY];
      const pending = state.pending || [];
      if (pending.length >= 64) throw new Error("Shared time command queue is full; reconnect before retrying.");
      const next = cloneJSON(state);
      next.serial = (next.serial || 0) + 1;
      if (!Number.isSafeInteger(next.serial)) throw new Error("Invalid shared time command serial.");
      next.pending = [...pending, { id, op, ...cloneJSON(fields), serial: next.serial, atMs: clock(), scope: shared.clusterId }];
      if (op === "remove" && next.ownTargets) delete next.ownTargets[id];
      if (op === "assign") {
        next.ownTargets ||= {};
        Object.defineProperty(next.ownTargets, id, { value: cloneJSON(fields.targets), enumerable: true, writable: true, configurable: true });
      }
      if (utf8Bytes(safeJSON({ ...getState(), [TIME_KEY]: next })) > LIMITS.stateBytes) throw new Error("Shared command exceeds the rule state limit.");
      getState()[TIME_KEY] = next; changed = true;
      return true;
    }
    function configure(context) {
      const previous = shared;
      // Journal recovery may precede transport recovery. An absent context is
      // not permission to turn a remembered shared budget into a local one.
      if (context === null && read().scope) context = { linked: true, ready: false, clusterId: read().scope };
      shared = context?.linked ? context : null;
      if (!shared && !previous && !read().scope && context?.detached !== true) return;
      let state = cloneJSON(read());
      if (context?.detached === true) {
        if (context.linked !== false || context.state?.version !== 1 || context.state.scope || !isPlainObject(context.state.objects)) throw new Error("Invalid detached time snapshot.");
        state = cloneJSON(context.state);
      }
      const nextTimers = new Set(timers), nextTrackers = new Set(trackers);
      if (!shared) {
        if (state.scope && context?.detached !== true) throw new Error("Final shared snapshot required before detaching.");
        state.scope = null; state.pending = [];
        for (const [id, value] of Object.entries(state.objects)) if (value.kind === "rolling") Object.assign(value, state.ownTargets?.[id] || { websites: [], apps: [] });
      } else {
        if (typeof shared.clusterId !== "string" || !shared.clusterId) throw new Error("Missing linked time identity.");
        const same = state.scope === shared.clusterId;
        state.scope = shared.clusterId;
        state.pending = same ? state.pending || [] : [];
        if (shared.ready) {
          if (!shared.state || shared.state.version !== 1 || !isPlainObject(shared.state.objects)) throw new Error("Unsupported shared time snapshot.");
          const old = state.objects;
          state.objects = cloneJSON(shared.state.objects);
          for (const [id, value] of Object.entries(state.objects)) {
            if (value.kind === "timer") {
              value.notified = old[id]?.incarnation === value.incarnation && old[id]?.generation === value.generation && old[id]?.notified === true;
              nextTimers.add(id);
            } else if (value.kind === "rolling") nextTrackers.add(id);
          }
          state.pending = state.pending.filter(item => item.serial > (shared.acknowledgedSerial || 0));
          state.serial = Math.max(state.serial || 0, shared.acknowledgedSerial || 0);
          for (const id of nextTimers) if (state.objects[id]?.kind !== "timer") nextTimers.delete(id);
          for (const id of nextTrackers) if (state.objects[id]?.kind !== "rolling") nextTrackers.delete(id);
        }
      }
      const json = safeJSON({ ...getState(), [TIME_KEY]: state });
      if (!json || utf8Bytes(json) > LIMITS.stateBytes) throw new Error("Shared snapshot exceeds the rule state limit.");
      getState()[TIME_KEY] = state; changed = true;
      for (const [id, value] of Object.entries(state.objects)) {
        if (value.kind === "timer") nextTimers.add(id);
        else if (value.kind === "rolling") nextTrackers.add(id);
      }
      for (const id of nextTimers) if (state.objects[id]?.kind !== "timer") nextTimers.delete(id);
      for (const id of nextTrackers) if (state.objects[id]?.kind !== "rolling") nextTrackers.delete(id);
      timers.clear(); trackers.clear();
      for (const id of nextTimers) timers.add(id);
      for (const id of nextTrackers) trackers.add(id);
      usageFloor = clock();
    }
    const ensure = (id, initial) => update(objects => {
      if (removed(id)) delete objects[id];
      if (own(objects, id)) {
        const old = objects[id];
        for (const key of Object.keys(initial)) {
          if (["kind", "direction", "durationMs", "windowMs", "limitMs"].includes(key) && old[key] !== initial[key]) throw new Error("Time object configuration changed: " + id + ". Use a new ID or remove it explicitly.");
        }
        return;
      }
      if (Object.keys(objects).length >= LIMITS.timeObjectsPerGroup) throw new Error("At most 32 time objects per rule.");
      Object.defineProperty(objects, id, { value: initial, enumerable: true, writable: true, configurable: true });
    });
    function elapsed(t, at) {
      if (!["up", "down"].includes(t.direction) || !Number.isSafeInteger(t.elapsedMs) || t.elapsedMs < 0 || !Number.isSafeInteger(t.generation) || t.generation < 0 || typeof t.notified !== "boolean" || typeof t.incarnation !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(t.incarnation) || (t.startedAtMs !== null && (!Number.isSafeInteger(t.startedAtMs) || t.startedAtMs < 0))) throw new Error("Invalid saved timer.");
      return Math.min(MAX_TIME_MS, t.elapsedMs + (t.startedAtMs === null ? 0 : Math.max(0, at - t.startedAtMs)));
    }
    function timerSnapshot(id, at = clock()) {
      const t = object(id, "timer"), raw = elapsed(t, at);
      const done = t.direction === "down" && raw >= t.durationMs;
      return { id, ready: ready(id), error: shared?.linked && !shared.ready ? shared.error || "shared-time-unavailable" : null, direction: t.direction, durationMs: t.durationMs, elapsedMs: t.direction === "down" ? Math.min(raw, t.durationMs) : raw,
        remainingMs: t.direction === "down" ? Math.max(0, t.durationMs - raw) : null, running: t.startedAtMs !== null && !done, completed: done };
    }
    function timer(id, options = {}) {
      id = timeID(id);
      const direction = options.direction === undefined ? "down" : options.direction;
      if (!["up", "down"].includes(direction)) throw new Error("Timer direction is up or down.");
      const durationMs = direction === "down" ? duration(options.durationMs, "durationMs") : 0;
      const existed = own(read().objects, id) && !removed(id);
      ensure(id, { kind: "timer", direction, durationMs, elapsedMs: 0, startedAtMs: null, notified: false, generation: 0, incarnation: clock().toString(36) + "-" + Math.random().toString(36).slice(2) });
      if (!existed) command(id, "ensure", { value: { kind: "timer", direction, durationMs } }, false);
      // Validate loaded values before activating the candidate.
      timerSnapshot(id); timers.add(id);
      const resume = () => { if (command(id, "resume")) return; update(objects => {
        const t = objects[id]; object(id, "timer");
        if (t.startedAtMs === null && !(t.direction === "down" && t.elapsedMs >= t.durationMs)) t.startedAtMs = clock();
      }); };
      return Object.freeze({
        id, start: resume, resume,
        pause: () => { if (command(id, "pause")) return; update(objects => {
          const t = objects[id]; object(id, "timer");
          t.elapsedMs = elapsed(t, clock());
          if (t.direction === "down") t.elapsedMs = Math.min(t.durationMs, t.elapsedMs);
          t.startedAtMs = null;
        }); },
        reset: () => { if (command(id, "reset")) return; update(objects => { const t = objects[id]; object(id, "timer"); t.elapsedMs = 0; t.startedAtMs = null; t.notified = false; t.generation = (t.generation || 0) + 1; }); },
        snapshot: () => { check(); return timerSnapshot(id); }
      });
    }
    function prune(t, at) {
      if (t.fault !== undefined && typeof t.fault !== "boolean") throw new Error("Invalid saved rolling capacity status.");
      if (!isPlainObject(t.bucketsMs) || !Array.isArray(t.segments) || !Number.isSafeInteger(t.accruedUntilMs) || t.accruedUntilMs < 0 || !Number.isSafeInteger(t.resetAtMs) || t.resetAtMs < 0) throw new Error("Invalid saved rolling tracker.");
      for (const [key, value] of Object.entries(t.bucketsMs)) {
        const minute = Number(key);
        if (!Number.isSafeInteger(minute) || minute < 0 || minute % MINUTE_MS || !Number.isFinite(value) || value <= 0) throw new Error("Invalid rolling usage bucket.");
        // Keep the ordinary bucket representation; interval expiry is exact.
        if (minute + MINUTE_MS <= at - t.windowMs) delete t.bucketsMs[key];
      }
      const floor = Math.max(0, at - t.windowMs);
      t.segments = unionSegments(t.segments).map(([from, to]) => [Math.max(from, floor), to]).filter(([from, to]) => to > from);
      rebuildBuckets(t);
    }
    function unionSegments(segments) {
      if (segments.length > 2048) throw new Error("Too many rolling usage segments.");
      const sorted = segments.map(pair => {
        if (!Array.isArray(pair) || pair.length !== 2 || !Number.isSafeInteger(pair[0]) || !Number.isSafeInteger(pair[1]) || pair[0] < 0 || pair[1] <= pair[0] || pair[1] - pair[0] > MAX_TIME_MS) throw new Error("Invalid rolling usage interval.");
        return pair.slice();
      }).sort((a, b) => a[0] - b[0]);
      const out = [];
      for (const [from, to] of sorted) {
        const last = out[out.length - 1];
        if (last && from <= last[1]) last[1] = Math.max(last[1], to);
        else out.push([from, to]);
      }
      return out;
    }
    function rebuildBuckets(t) {
      const buckets = {};
      for (const [from, to] of t.segments) {
        for (let at = from; at < to;) {
          check();
          const minute = Math.floor(at / MINUTE_MS) * MINUTE_MS;
          const end = Math.min(to, minute + MINUTE_MS);
          if (!own(buckets, String(minute)) && Object.keys(buckets).length >= 1024) throw new Error("Rolling history exceeds 1024 minute buckets; update refused.");
          buckets[String(minute)] = (buckets[String(minute)] || 0) + end - at;
          at = end;
        }
      }
      t.bucketsMs = buckets;
    }
    function addUsage(t, from, to) {
      if (to <= from) return;
      // An allowance controls availability, not whether observed use is retained.
      t.segments = unionSegments([...t.segments, [from, to]]);
      rebuildBuckets(t);
    }
    const used = t => Object.values(t.bucketsMs).reduce((total, value) => total + value, 0);
    function targetList(value, kind) {
      if (!Array.isArray(value) || value.length > 100 || value.some(x => typeof x !== "string" || !x || x.length > 32767)) throw new Error("Assign at most 100 " + kind + " targets.");
      return [...new Set(value.map(x => {
        if (kind !== "website") return normalizeTimeApp(x);
        // Domain targets include their subdomains, exactly like Website scopes.
        const domain = x.toLowerCase().replace(/\.$/, "");
        if (domain.length > 253 || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) || domain.includes("..")) throw new Error("Website targets must be hostnames, without a scheme or path.");
        return domain;
      }))];
    }
    function websiteMatches(t, value) {
      // URL is unavailable in JavaScriptCore; parse only HTTP(S) authorities.
      const input = String(value || "");
      const match = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(input.includes("://") ? input : "https://" + input);
      if (!match) return false;
      const host = match[1].split("@").pop().split(":")[0].toLowerCase().replace(/\.$/, "");
      return t.websites.some(domain => host === domain || host.endsWith("." + domain));
    }
    function appMatches(t, value) {
      const app = normalizeTimeApp(value);
      return t.apps.includes(app);
    }
    function trackerSnapshot(id) {
      const at = clock(); let snapshot;
      update(objects => {
        object(id, "rolling"); const t = objects[id]; prune(t, at);
        const usedMs = used(t), remainingMs = Math.max(0, t.limitMs - usedMs);
        const first = t.segments[0]?.[0];
        snapshot = { id, ready: ready(id) && !t.fault, error: t.fault ? "rolling-history-capacity" : shared?.linked && !shared.ready ? shared.error || "shared-time-unavailable" : null, windowMs: t.windowMs, limitMs: t.limitMs, usedMs, remainingMs, available: ready(id) && !t.fault && remainingMs > 0,
          nextReturnAtMs: first !== undefined ? first + t.windowMs + 1 : null };
      });
      return snapshot;
    }
    function rolling(id, options) {
      id = timeID(id);
      const windowMs = duration(options?.windowMs, "windowMs"), limitMs = duration(options?.limitMs, "limitMs", true);
      const existed = own(read().objects, id) && !removed(id);
      ensure(id, { kind: "rolling", windowMs, limitMs, websites: [], apps: [], bucketsMs: {}, segments: [], accruedUntilMs: 0, resetAtMs: clock(), fault: false });
      if (!existed) command(id, "ensure", { value: { kind: "rolling", windowMs, limitMs } }, false);
      const stored = object(id, "rolling"); targetList(stored.websites, "website"); targetList(stored.apps, "app");
      trackerSnapshot(id); trackers.add(id);
      return Object.freeze({
        id,
        assign: (targets) => {
          const websites = targetList(targets?.websites || [], "website"), apps = targetList(targets?.apps || [], "app");
          if (shared?.linked) {
            const ownTargets = read().ownTargets || {};
            if (safeJSON(ownTargets[id]) !== safeJSON({ websites, apps })) {
              command(id, "assign", { targets: { websites, apps } }, false);
            }
            return;
          }
          update((objects, state) => {
            object(id, "rolling"); Object.assign(objects[id], { websites, apps });
            state.ownTargets ||= {};
            Object.defineProperty(state.ownTargets, id, { value: { websites, apps }, enumerable: true, writable: true, configurable: true });
          });
        },
        snapshot: () => { check(); return trackerSnapshot(id); },
        available: (target) => {
          check(); const t = object(id, "rolling");
          return (target === undefined || websiteMatches(t, target) || appMatches(t, target)) && trackerSnapshot(id).available;
        },
        reset: () => { if (command(id, "reset")) return; update(objects => { object(id, "rolling"); objects[id].bucketsMs = {}; objects[id].segments = []; objects[id].accruedUntilMs = clock(); objects[id].resetAtMs = clock(); objects[id].fault = false; }); }
      });
    }
    function advance(event, emit) {
      const at = clock();
      if (!timers.size && !trackers.size) return;
      if (shared?.linked && !shared.ready) return;
      const ended = [];
      update(objects => {
        for (const id of timers) {
          if (!ready(id)) continue;
          const t = objects[id]; object(id, "timer");
          if (t.direction === "down" && elapsed(t, at) >= t.durationMs && !t.notified) {
            t.elapsedMs = t.durationMs; t.startedAtMs = null; t.notified = true;
            ended.push({ id, direction: "down", durationMs: t.durationMs, generation: t.generation || 0, incarnation: t.incarnation });
          }
        }
      });
      for (const id of trackers) {
        try {
          update(objects => {
            const t = objects[id]; object(id, "rolling"); prune(t, at);
            if (shared?.linked || t.fault) return; // The authenticated hub accounts first.
            if (event.trustedUsage === false) return; // v.emit is not observed usage.
            const data = event.data || {};
            const matches = event.type === "visible" ? websiteMatches(t, data.url) : event.type === "tick" && appMatches(t, data.usageAppId);
            const amount = Number(data.elapsedMs);
            if (!matches || !Number.isFinite(amount) || amount <= 0) return;
            const bounded = Math.min(5000, Math.round(amount));
            const from = Math.max(at - bounded, usageFloor, t.resetAtMs || 0);
            t.accruedUntilMs = Math.max(at, t.accruedUntilMs);
            addUsage(t, from, at);
          });
        } catch (error) {
          if (!/history exceeds|usage segments|state limit/.test(String(error.message || error))) throw error;
          // Preallocated false -> true cannot grow a valid current record. Keep
          // the last valid history and persist a fault, never a fresh allowance.
          update(objects => { objects[id].fault = true; });
        }
      }
      for (const data of ended) emit("timerEnded", data);
    }
    function hydrate(controls) {
      return controls.map(control => {
        if (control.type === "section") return { ...control, controls: hydrate(control.controls) };
        if (control.type !== "timer") return control;
        if (!timers.has(control.timerId) || !own(read().objects, control.timerId) || read().objects[control.timerId].kind !== "timer") return { ...control, type: "text", text: (control.label ? control.label + " " : "") + "—" };
        const status = timerSnapshot(control.timerId);
        if (!status.ready) return { ...control, type: "text", text: (control.label ? control.label + " " : "") + "—" };
        const seconds = status.direction === "down" ? Math.ceil(status.remainingMs / 1000) : Math.floor(status.elapsedMs / 1000);
        const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
        const display = (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
        // Use the existing native/browser text control; no parallel renderer.
        return { ...control, type: "text", text: (control.label ? control.label + " " : "") + display };
      });
    }
    configure(initialContext);
    return { timer, rolling, advance, hydrate, configure,
      pending: () => cloneJSON(read().pending || []),
      types: () => [...(timers.size || trackers.size ? ["tick"] : []), ...(trackers.size ? ["visible"] : [])],
      takeChanged: () => { const result = changed || timers.size > 0; changed = false; return result; },
      resetUsageBoundary: (at = clock()) => { usageFloor = at; },
      currentCompletion: data => {
        if (!timers.has(data?.id)) return false;
        const t = object(data.id, "timer");
        return t.notified && t.incarnation === data.incarnation && (t.generation || 0) === data.generation;
      },
      mergeSeed: seed => update(objects => {
        if (!seed || seed.version !== 1 || !isPlainObject(seed.objects)) throw new Error("Unsupported time seed.");
        for (const [id, value] of Object.entries(seed.objects)) {
          timeID(id);
          if (!value || !["timer", "rolling"].includes(value.kind)) throw new Error("Invalid time seed object.");
          if (own(objects, id)) {
            const old = objects[id];
            const keys = value.kind === "timer" ? ["kind", "direction", "durationMs"] : ["kind", "windowMs", "limitMs"];
            if (keys.some(key => old[key] !== value[key])) throw new Error("Incompatible linked time object: " + id);
            if (value.kind === "rolling") {
              old.websites = [...new Set([...old.websites, ...targetList(value.websites, "website")])];
              old.apps = [...new Set([...old.apps, ...targetList(value.apps, "app")])];
              old.segments = unionSegments([...old.segments, ...value.segments]);
              old.resetAtMs = Math.min(old.resetAtMs, value.resetAtMs);
              prune(old, clock());
            }
          } else {
            if (Object.keys(objects).length >= LIMITS.timeObjectsPerGroup) throw new Error("At most 32 linked time objects.");
            Object.defineProperty(objects, id, { value: cloneJSON(value), enumerable: true, writable: true, configurable: true });
          }
        }
        for (const [id, value] of Object.entries(objects)) {
          if (value.kind === "timer") {
            if (!["up", "down"].includes(value.direction)) throw new Error("Invalid timer direction.");
            duration(value.durationMs, "durationMs", value.direction === "up");
            elapsed(value, clock());
          } else {
            duration(value.windowMs, "windowMs"); duration(value.limitMs, "limitMs", true);
            targetList(value.websites, "website"); targetList(value.apps, "app"); prune(value, clock());
          }
        }
      }),
      remove: id => { id = timeID(id); if (command(id, "remove")) return; update((objects, state) => { delete objects[id]; if (state.ownTargets) delete state.ownTargets[id]; }); timers.delete(id); trackers.delete(id); }
    };
  }

  // Pure hub policy. Mac's JavaScriptCore and Windows' existing trusted policy
  // worker execute these exact functions; no second timer/accounting engine.
  // The host binds `member` to authenticated program + pinned group identity,
  // serializes transactions and persists state before returning an acknowledgment.
  function mergeTime(existing, sources, initiator, nowMs) {
    try {
      if (!Number.isSafeInteger(nowMs) || nowMs < 0 || !Array.isArray(sources) || sources.length > 16) throw new Error("Invalid shared time merge.");
      const state = existing ? cloneJSON(existing) : { version: 1, objects: {}, receipts: {}, targets: {}, revision: 0 };
      if (state.version !== 1 || !isPlainObject(state.objects) || !isPlainObject(state.receipts) || !isPlainObject(state.targets)) throw new Error("Unsupported shared time state.");
      const wrapper = { [TIME_KEY]: state };
      const tools = timeTools(() => wrapper, () => nowMs, () => {});
      // First creation takes the initiating member's timers. Existing shared
      // timers are already authoritative when a further member joins.
      const ordered = sources.slice().sort((a, b) => (a.member === initiator ? -1 : b.member === initiator ? 1 : 0));
      for (const source of ordered) {
        if (typeof source.member !== "string" || source.member.length > 200) throw new Error("Invalid time member.");
        const seed = cloneJSON(source.state || { version: 1, objects: {} });
        for (const [id, value] of Object.entries(seed.objects || {})) if (value?.kind === "rolling" && seed.ownTargets?.[id]) Object.assign(value, seed.ownTargets[id]);
        tools.mergeSeed(seed);
        const current = wrapper[TIME_KEY];
        for (const [id, value] of Object.entries(seed.objects)) if (value.kind === "rolling") {
          if (!own(current.targets, id)) Object.defineProperty(current.targets, id, { value: {}, enumerable: true, writable: true, configurable: true });
          current.targets[id][source.member] = { websites: value.websites, apps: value.apps };
        }
      }
      const out = wrapper[TIME_KEY];
      out.revision = timeRevision(existing, out);
      if (utf8Bytes(safeJSON(wrapper)) > LIMITS.stateBytes) throw new Error("Shared time storage limit exceeded.");
      return { ok: true, state: out };
    } catch (error) { return { ok: false, error: String(error.message || error) }; }
  }
  function reduceTime(existing, request) {
    try {
      if (!request || typeof request.member !== "string" || request.member.length > 200 || !Number.isSafeInteger(request.nowMs) || request.nowMs < 0 || !Array.isArray(request.commands) || request.commands.length > 64) throw new Error("Invalid shared time request.");
      const initial = mergeTime(existing, [], "", request.nowMs);
      if (!initial.ok) return initial;
      const wrapper = { [TIME_KEY]: initial.state };
      let clock = request.nowMs;
      const tools = timeTools(() => wrapper, () => clock, () => {});
      tools.resetUsageBoundary(0);
      const objects = new Map();
      const register = id => {
        const value = wrapper[TIME_KEY].objects[id];
        if (!value) throw new Error("Unknown shared time object: " + id);
        const handle = value.kind === "timer" ? tools.timer(id, value) : tools.rolling(id, value);
        objects.set(id, handle); return handle;
      };
      for (const id of Object.keys(wrapper[TIME_KEY].objects)) register(id);
      let receipt = wrapper[TIME_KEY].receipts[request.member] || 0;
      for (const command of request.commands) {
        if (!command || !Number.isSafeInteger(command.serial) || command.serial <= 0) throw new Error("Invalid time command serial.");
        if (command.serial <= receipt) continue;
        if (!Number.isSafeInteger(command.atMs) || command.atMs < 0 || command.atMs > request.nowMs + 1000) throw new Error("Invalid time command clock.");
        clock = Math.min(command.atMs, request.nowMs);
        const id = timeID(command.id);
        if (command.op === "ensure") {
          const value = command.value;
          if (!value || !["timer", "rolling"].includes(value.kind)) throw new Error("Invalid shared object declaration.");
          objects.set(id, value.kind === "timer" ? tools.timer(id, value) : tools.rolling(id, value));
        } else if (command.op === "remove") {
          tools.remove(id); objects.delete(id); delete wrapper[TIME_KEY].targets[id];
        } else {
          const handle = objects.get(id) || register(id);
          if (command.op === "assign") {
            // Validate the assignment through the same public implementation.
            handle.assign(command.targets);
            const state = wrapper[TIME_KEY];
            if (!own(state.targets, id)) Object.defineProperty(state.targets, id, { value: {}, enumerable: true, writable: true, configurable: true });
            state.targets[id][request.member] = cloneJSON(command.targets);
            const targets = Object.values(state.targets[id]);
            handle.assign({ websites: [...new Set(targets.flatMap(t => t.websites || []))], apps: [...new Set(targets.flatMap(t => t.apps || []))] });
          } else if (["start", "resume", "pause", "reset"].includes(command.op) && typeof handle[command.op] === "function") handle[command.op]();
          else throw new Error("Unsupported shared time command.");
        }
        receipt = command.serial;
      }
      if (request.usage) {
        if (!["visible", "tick"].includes(request.usage.type) || !Number.isSafeInteger(request.usage.now) || request.usage.now < 0 || request.usage.now > request.nowMs + 1000) throw new Error("Invalid shared usage event.");
        clock = Math.min(request.usage.now, request.nowMs);
        tools.advance(request.usage, () => {});
      }
      clock = request.nowMs;
      tools.advance({ type: "tick", data: {} }, () => {});
      wrapper[TIME_KEY].receipts[request.member] = receipt;
      if (utf8Bytes(safeJSON(wrapper)) > LIMITS.stateBytes) throw new Error("Shared time storage limit exceeded.");
      wrapper[TIME_KEY].revision = timeRevision(existing, wrapper[TIME_KEY]);
      return { ok: true, state: wrapper[TIME_KEY], acknowledgedSerial: receipt };
    } catch (error) { return { ok: false, error: String(error.message || error) }; }
  }
  function syncTime(existing, request) {
    try {
      if (!request || !Array.isArray(request.members) || request.members.length < 2 || request.members.length > 16 || !request.members.includes(request.member) || !request.members.includes(request.initiator)) throw new Error("Invalid linked time membership.");
      let merged = existing ? { ok: true, state: cloneJSON(existing) } : mergeTime(null, request.seeds || [], request.initiator, request.nowMs);
      if (!merged.ok) return merged;
      merged.state.confirmed ||= {};
      if (!merged.state.confirmed[request.member]) {
        const seed = request.seed || { version: 1, objects: {} };
        if (request.member === request.initiator) {
          // No control is admitted until all original seeds arrive. Refresh
          // preliminary roster timer values from the initiator's fresh state.
          for (const [id, value] of Object.entries(seed.objects || {})) if (value.kind === "timer") {
            const old = merged.state.objects[id];
            if (old && ["kind", "direction", "durationMs"].some(key => old[key] !== value[key])) throw new Error("Incompatible linked time object: " + id);
            Object.defineProperty(merged.state.objects, id, { value: cloneJSON(value), enumerable: true, writable: true, configurable: true });
          }
        }
        merged = mergeTime(merged.state, [{ member: request.member, state: seed }], request.initiator, request.nowMs);
        if (!merged.ok) return merged;
        merged.state.confirmed ||= {};
        merged.state.confirmed[request.member] = true;
      }
      // Membership owns target contributions; history remains shared after leave.
      for (const [id, ledger] of Object.entries(merged.state.targets || {})) {
        for (const member of Object.keys(ledger)) if (!request.members.includes(member)) delete ledger[member];
        const tracker = merged.state.objects[id];
        if (tracker?.kind === "rolling") {
          const targets = Object.values(ledger);
          tracker.websites = [...new Set(targets.flatMap(t => t.websites || []))];
          tracker.apps = [...new Set(targets.flatMap(t => t.apps || []))];
        }
      }
      const ready = request.members.every(member => merged.state.confirmed[member] === true);
      const result = reduceTime(merged.state, { member: request.member, commands: ready ? request.commands || [] : [], usage: ready ? request.usage : null, nowMs: request.nowMs });
      if (!result.ok) return result;
      result.state.revision = timeRevision(existing, result.state);
      return { ...result, ready };
    } catch (error) { return { ok: false, error: String(error.message || error) }; }
  }
  // Final state transfer uses the same validation/accounting as a live link.
  // Unconfirmed members contribute their untouched original history on return.
  function detachTime(seed, snapshot, member, initiator, clusterId, token, nowMs, acknowledged = false) {
    try {
      if (typeof clusterId !== "string" || !clusterId || typeof token !== "string" || !token || token.length > 128) throw new Error("Invalid detached time identity.");
      const local = cloneJSON(seed || { version: 1, objects: {} });
      if (acknowledged) {
        delete local.detachedReceipt;
        const validation = mergeTime(null, [{ member, state: local }], member, nowMs);
        if (!validation.ok) return validation;
        return { ok: true, state: local };
      }
      let final = mergeTime(snapshot, [], initiator, nowMs);
      if (!final.ok) return final;
      if (final.state.confirmed?.[member] !== true) {
        if (member === initiator) for (const [id, value] of Object.entries(local.objects || {})) if (value.kind === "timer") {
          const previous = final.state.objects[id];
          if (previous && ["kind", "direction", "durationMs"].some(key => previous[key] !== value[key])) throw new Error("Incompatible detached timer: " + id);
          final.state.objects[id] = cloneJSON(value);
        }
        final = mergeTime(final.state, [{ member, state: local }], initiator, nowMs);
        if (!final.ok) return final;
      }
      const old = local.objects || {};
      local.version = 1; local.objects = cloneJSON(final.state.objects);
      for (const [id, value] of Object.entries(local.objects)) {
        if (value.kind === "timer") value.notified = old[id]?.incarnation === value.incarnation && old[id]?.generation === value.generation && old[id]?.notified === true;
        else if (value.kind === "rolling") {
          const targets = local.ownTargets?.[id] || final.state.targets?.[id]?.[member] ||
            (old[id]?.kind === "rolling" ? old[id] : { websites: [], apps: [] });
          value.websites = cloneJSON(targets.websites || []); value.apps = cloneJSON(targets.apps || []);
        }
      }
      local.scope = null; local.pending = [];
      if (acknowledged) delete local.detachedReceipt;
      else local.detachedReceipt = { clusterId, token };
      // Validate all objects and size without replacing unrelated rule fields.
      const validation = mergeTime(null, [{ member, state: local }], member, nowMs);
      if (!validation.ok || utf8Bytes(safeJSON({ [TIME_KEY]: local })) > LIMITS.stateBytes) throw new Error(validation.error || "Detached time storage limit exceeded.");
      return { ok: true, state: local };
    } catch (error) { return { ok: false, error: String(error.message || error) }; }
  }
  function timeRevision(before, after) {
    const withoutRevision = value => ({ ...value, revision: 0 });
    return (before?.revision || 0) + (before && safeJSON(withoutRevision(before)) === safeJSON(withoutRevision(after)) ? 0 : 1);
  }

  // ── Compiling ────────────────────────────────────────────────────────────
  // One source form: a function expression `(on, v) => { … }`.
  function compile(source) {
    const text = String(source ?? "").trim().replace(/;+\s*$/, "");
    if (!text) return { fn: null, error: null };
    let fn;
    try {
      fn = new Function("return (" + text + ");")();
    } catch (error) {
      return { fn: null, error: "Compile failed: " + (error && error.message ? error.message : String(error)) };
    }
    if (typeof fn !== "function") return { fn: null, error: "A rule is one function: (on, v) => { … }" };
    return { fn, error: null };
  }

  // ── One group's rule ─────────────────────────────────────────────────────
  // `engineActions(act, check, requestId)` returns the engine's own actions;
  // `requestId()` names a request whose answer comes back as an event; `act(kind,
  // fields)` queues one. Registration runs once, now.
  function createRule(groupId, fn, { state, engineActions, timeContext = null, generation = Date.now().toString(36) + Math.random().toString(36).slice(2), now = () => Date.now() } = {}) {
    const handlers = new Map();
    let handlerCount = 0;
    let record = null;
    let deadline = 0;
    let stateObj = isPlainObject(state) ? state : {};
    let stateJSON = safeJSON(stateObj);
    const panels = new Map();
    let panelsChanged = false;
    const panelValues = new Map();
    let requestSeq = 0;
    let aiEpoch = 0;
    let contextRevision = "";
    let aiContext = Object.freeze({prompt:"",context:""});
    const requestToken = () => generation + ":" + aiEpoch + ":" + contextRevision;
    let eventNow = null;
    const requestId = () => groupId + ":" + (++requestSeq);

    const check = () => {
      if (deadline && now() > deadline) {
        const error = new Error("The rule ran longer than " + LIMITS.handlerMs + " ms.");
        error.__ruleBudget = true;
        throw error;
      }
    };
    const push = (list, item, cap) => {
      if (list.length < cap) list.push(item);
    };
    const act = (kind, fields) => {
      check();
      if (record) push(record.actions, { groupId, kind, ...fields }, LIMITS.actionsPerDispatch);
    };

    const time = timeTools(() => stateObj, () => eventNow ?? now(), check, timeContext);

    const v = {
      log(...args) {
        check();
        if (record) push(record.logs, { groupId, source: "v.log", level: "log", args: args.map(logValue) }, LIMITS.logsPerDispatch);
      },
      emit(type, data) {
        check();
        const name = String(type || "");
        if (!name || !record) return;
        push(record.emits, { type: name, data: cloneJSON(data) }, LIMITS.emitsPerDispatch);
      },
      timer: time.timer,
      rolling: time.rolling,
      removeTime: time.remove,
      // A panel on screen: `spec` replaces it, null removes it. The browser
      // shows it on every page, or one tab's (`tabId`).
      panel(id, spec, tabId) {
        check();
        const key = sanitizePanelId(id);
        if (!key) return;
        if (spec === null || spec === undefined) {
          if (panels.delete(key)) panelsChanged = true;
          return;
        }
        if (!panels.has(key) && panels.size >= LIMITS.panelsPerGroup) return;
        const panel = sanitizePanel({ ...spec, id: key }, panelValues.get(key));
        if (!panel) return;
        if (Number.isInteger(tabId)) panel.tabId = tabId;
        panels.set(key, panel);
        panelsChanged = true;
      },
      // A file in the user's chosen folder: op read | write | append | list |
      // exists; the answer comes as a "file" event with this request id.
      ai(options) {
        check();
        if (eventNow === null) throw new Error("v.ai must be called inside an event handler.");
        if (!isPlainObject(options) || Object.keys(options).some(key => !["prompt", "input"].includes(key))
          || typeof options.prompt !== "string" || !options.prompt.trim() || utf8Bytes(options.prompt) > 20000) throw new Error("Invalid AI request.");
        const payload = JSON.stringify(options);
        if (utf8Bytes(payload) > 48000 || (options.input !== undefined && utf8Bytes(JSON.stringify(options.input)) > 20000)) throw new Error("AI input is too large.");
        const id = requestId();
        act("ai", {payload, requestId: id, generation: requestToken()});
        return id;
      },
      store(options) {
        check();
        if (eventNow === null) throw new Error("v.store must be called inside an event handler.");
        if (!isPlainObject(options) || !["get","put","delete","list","clear"].includes(options.op)) throw new Error("Invalid store request.");
        const payload = JSON.stringify(options);
        if (utf8Bytes(payload) > 75000) throw new Error("Store request is too large.");
        const id = requestId();
        act("store", {payload, requestId:id, generation:requestToken()});
        return id;
      },
      // Browser content handle, not a selector or a mutable page/card ref.
      attach(tabId, item, attachmentId, spec) {
        check();
        if (eventNow === null) throw new Error("v.attach must be called inside an event handler.");
        if (!Number.isInteger(tabId) || !item || typeof item !== "object" ||
            typeof item.ref !== "string" || item.ref.length > 128 ||
            typeof item.contentId !== "string" || item.contentId.length > 2048 ||
            typeof item.instanceId !== "string" || item.instanceId.length > 128 ||
            typeof attachmentId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(attachmentId)) throw new Error("Invalid content attachment target.");
        const value = cloneJSON(spec);
        if (value !== null && (!isPlainObject(value) || utf8Bytes(JSON.stringify(value)) > 52000)) throw new Error("Invalid content attachment.");
        act("attach", {tabId, target:{ref:item.ref,contentId:item.contentId,instanceId:item.instanceId},attachmentId,spec:value});
      },
      file(op, path, payload) {
        const id = requestId();
        act("file", { op: String(op || ""), path: String(path || ""), payload: payload === undefined ? null : cloneJSON(payload), requestId: id });
        return id;
      },
      ...(typeof engineActions === "function" ? engineActions(act, check, requestId) : {})
    };
    // The group's memory: one JSON object, kept across restarts and Run.
    Object.defineProperty(v, "state", {
      enumerable: true,
      get: () => stateObj,
      set: (value) => { stateObj = isPlainObject(value) ? value : {}; }
    });
    Object.defineProperty(v, "context", {enumerable:true,get:()=>Object.freeze({revision:requestToken(),ai:aiContext})});
    Object.freeze(v);

    const on = (type, handler) => {
      const name = String(type || "");
      if (!name || typeof handler !== "function" || handlerCount >= LIMITS.handlersPerGroup) return false;
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(handler);
      handlerCount += 1;
      return true;
    };

    const begin = () => {
      record = { actions: [], logs: [], diagnostics: [], emits: [], overrun: false };
      deadline = now() + LIMITS.handlerMs;
    };
    const end = () => {
      const done = record;
      record = null;
      deadline = 0;
      return done;
    };
    const runGuarded = (call, where) => {
      try {
        call();
      } catch (error) {
        if (error && error.__ruleBudget) record.overrun = true;
        push(record.diagnostics, { groupId, level: "error", args: [where + ": " + (error && error.message ? error.message : String(error))] }, LIMITS.logsPerDispatch);
      }
    };

    // Registration.
    begin();
    let registrationError = null;
    try {
      fn(on, v);
    } catch (error) {
      registrationError = (error && error.__ruleBudget) ? "The rule ran longer than " + LIMITS.handlerMs + " ms while registering." : "Registration failed: " + (error && error.message ? error.message : String(error));
    }
    const registration = end();

    return {
      groupId,
      configureRevision: value => { if(value!==undefined) contextRevision=String(value); },
      configureAIContext: value => {
        aiContext=Object.freeze({
          prompt:typeof value?.prompt==="string"&&utf8Bytes(value.prompt)<=16000?value.prompt:"",
          context:typeof value?.context==="string"&&utf8Bytes(value.context)<=16000?value.context:""
        });
      },
      acceptsAI: value => value === requestToken(),
      invalidateAI: () => { aiEpoch++; },
      error: registrationError,
      registrationLogs: registration.logs,
      get handlerCount() { return handlerCount; },
      types: () => [...new Set([...handlers.keys(), ...time.types()])],
      handles: (type) => handlers.has(type) || time.types().includes(type),
      resetUsageBoundary: time.resetUsageBoundary,
      currentCompletion: time.currentCompletion,
      configureTime: context => { time.configure(context); if (context?.linked) stateJSON = null; },
      // Runs this group's handlers for one event. Returns its record.
      dispatch(event) {
        begin();
        eventNow = event.now;
        runGuarded(() => time.advance(event, (type, data) => {
          push(record.emits, { type, data, managedTimer: true }, LIMITS.emitsPerDispatch);
        }), "Managed time");
        if (event.type === "panel") {
          const data = event.data || {};
          const values = panelValues.get(data.panelId) || {};
          if (data.controlId) values[data.controlId] = data.value;
          if (data.values && typeof data.values === "object") Object.assign(values, data.values);
          panelValues.set(data.panelId, values);
        }
        const ev = Object.freeze({ type: event.type, now: event.now, origin: event.origin || "host", data: event.data ?? null });
        for (const handler of handlers.get(event.type) || []) {
          runGuarded(() => handler(ev), event.type + " handler");
          if (record.overrun) break;
        }
        eventNow = null;
        return end();
      },
      // The group's panels when they changed since the last call (else null).
      takePanels() {
        if (time.takeChanged()) panelsChanged = true;
        if (!panelsChanged) return null;
        panelsChanged = false;
        return [...panels.values()].map((panel) => ({ ...panel, groupId, controls: time.hydrate(panel.controls) }));
      },
      // The group's state when it changed since the last call (else undefined).
      // Over the size limit it is not kept, and the rule is told.
      takeState() {
        const json = safeJSON(stateObj);
        if (typeof json !== "string" || utf8Bytes(json) > LIMITS.stateBytes) return { ok: false, error: "v.state must be JSON and at most " + LIMITS.stateBytes + " bytes" };
        if (json === stateJSON) return { ok: true, value: undefined };
        stateJSON = json;
        return { ok: true, value: JSON.parse(json) };
      }
    };
  }

  // A rule's syntax and registration, without keeping it.
  // ── An engine: every group's rule, one event at a time ──────────────────
  // Both hosts run this: `engineActions` are the host's own actions (the
  // browser's or Mac Vault's), `beacon(groupId)` hears which group runs next
  // (the browser's sandbox blames a hung rule with it).
  const OVERRUN_LIMIT = 3;
  const OVERRUN_WINDOW_MS = 60000;
  const EMIT_DEPTH = 16;

  let engineSequence = 0;
  function createEngine(engineActions, { beacon = () => {} } = {}) {
    const incarnation = Date.now().toString(36) + ":" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + ":" + (++engineSequence);
    const rules = new Map(); // groupId -> rule
    const timeContexts = new Map();
    const overruns = new Map(); // groupId -> [time]
    // A disabled group's rule stays loaded but hears nothing (owner
    // 2026-09-27): enabling it resumes it as it was; only Run loads new code.
    const suppressed = new Set();

    // A rule over its time 3 times within a minute is quarantined.
    function overran(groupId) {
      const now = Date.now();
      const list = (overruns.get(groupId) || []).filter((t) => now - t < OVERRUN_WINDOW_MS);
      list.push(now);
      overruns.set(groupId, list);
      return list.length >= OVERRUN_LIMIT;
    }

    // Registers a group's rule. One that fails to load leaves the group's
    // old rule running; an empty source removes it. A loaded rule's panels
    // (those it showed while registering) replace the group's old ones.
    // At most one uncommitted candidate per group, with a bounded total.
    // Hosts can save memory/source before activating a prepared rule.
    const candidates = new Map();
    let nextToken = 0;
    function discardLoad(token) {
      candidates.delete(token);
      return { ok: true };
    }
    function discardGroup(groupId) {
      for (const [token, candidate] of candidates) if (candidate.groupId === groupId) candidates.delete(token);
    }
    function prepareLoad(groupId, source, state) {
      const compiled = compile(source);
      if (compiled.error) return { ok: false, handlers: 0, types: [], error: compiled.error, logs: [] };
      let rule = null;
      let result = { ok: true, handlers: 0, types: [], error: null, logs: [], panels: [], states: {} };
      if (compiled.fn) {
        beacon(groupId);
        try {
          rule = createRule(groupId, compiled.fn, { state: cloneJSON(state), engineActions, generation: incarnation + ":rule:" + (++nextToken), timeContext: timeContexts.get(groupId) ?? null });
        } catch (error) {
          return { ok: false, handlers: 0, types: [], error: "Registration failed: " + String(error.message || error), logs: [] };
        }
        if (rule.error) {
          const budget = /longer than/.test(rule.error);
          return { ok: false, handlers: 0, types: [], error: rule.error, logs: rule.registrationLogs, quarantine: budget ? { groupId, reason: "registration-deadline-overrun" } : null };
        }
        const memory = rule.takeState();
        if (!memory.ok) return { ok: false, handlers: 0, types: [], error: memory.error, logs: rule.registrationLogs };
        result = { ok: true, handlers: rule.handlerCount, types: rule.types(), error: null, logs: rule.registrationLogs, panels: rule.takePanels() || [], states: memory.value === undefined ? {} : { [groupId]: memory.value } };
      }
      discardGroup(groupId);
      while (candidates.size >= 64) candidates.delete(candidates.keys().next().value);
      const token = incarnation + ":" + (++nextToken);
      candidates.set(token, { groupId, rule, result });
      return { ...result, token };
    }
    function commitLoad(token, beforeCommit) {
      const candidate = candidates.get(token);
      if (!candidate) return { ok: false, error: "Prepared rule is no longer available.", logs: [] };
      try {
        if (typeof beforeCommit === "function") {
          const saved = beforeCommit(candidate.result.states);
          if (saved && typeof saved.then === "function") throw new Error("Rule beforeCommit must be synchronous.");
        }
      } catch (error) {
        candidates.delete(token);
        return { ok: false, handlers: 0, types: [], error: String(error && error.message ? error.message : error), logs: candidate.result.logs };
      }
      // A callback cannot activate a candidate superseded during its save.
      if (candidates.get(token) !== candidate) return { ok: false, error: "Prepared rule is no longer available.", logs: [] };
      candidates.delete(token);
      const { groupId, rule, result } = candidate;
      if (rule) {
        rules.set(groupId, rule);
        overruns.delete(groupId);
      } else unload(groupId);
      return result;
    }
    // Synchronous hosts may persist through beforeCommit; async hosts use
    // prepare/commit/discard. A rejected save never re-runs the old initializer.
    function load(groupId, source, state, beforeCommit) {
      const prepared = prepareLoad(groupId, source, state);
      if (!prepared.ok) return prepared;
      return commitLoad(prepared.token, beforeCommit);
    }

    function unload(groupId) {
      timeContexts.delete(groupId);
      discardGroup(groupId);
      rules.delete(groupId);
      overruns.delete(groupId);
      suppressed.delete(groupId);
    }

    function suppress(groupId, on) {
      if (suppressed.has(groupId) !== (on === true)) rules.get(groupId)?.resetUsageBoundary();
      if (on && !suppressed.has(groupId)) rules.get(groupId)?.invalidateAI();
      if (on) suppressed.add(groupId);
      else suppressed.delete(groupId);
    }

    // One event to every group that handles it (or to one group); what a
    // handler emits follows for that group, bounded. Returns the actions,
    // logs, changed panels ({ groupId: [panel] }), changed states
    // ({ groupId: state }) and a quarantine, if a rule earned one.
    function dispatch(descriptor) {
      const out = { ok: true, actions: [], logs: [], diagnostics: [], panels: {}, states: {}, types: {}, stateFailures: [], quarantine: null };
      const queue = [];
      for (const [groupId, rule] of rules) {
        if (descriptor.targetGroupId && descriptor.targetGroupId !== groupId) continue;
        if (suppressed.has(groupId)) continue;
        rule.configureRevision(descriptor.contextRevisions?.[groupId]);
        rule.configureAIContext(descriptor.aiContexts?.[groupId]);
        if (["ai", "record"].includes(descriptor.type) && !rule.acceptsAI(descriptor.data?.generation)) continue;
        if (rule.handles(descriptor.type)) queue.push({ rule, event: descriptor, depth: 0 });
      }
      while (queue.length > 0) {
        const { rule, event, depth } = queue.shift();
        if (event.managedTimer && !rule.currentCompletion(event.data)) continue;
        beacon(rule.groupId);
        const record = rule.dispatch({ type: event.type, now: event.now ?? Date.now(), data: event.data ?? null, origin:event.origin || "host", trustedUsage: event.trustedUsage !== false });
        out.actions.push(...record.actions);
        out.logs.push(...record.logs);
        out.diagnostics.push(...record.diagnostics);
        if (record.overrun && overran(rule.groupId) && !out.quarantine) {
          out.quarantine = { groupId: rule.groupId, reason: "deadline-overrun" };
        }
        if (depth < EMIT_DEPTH) {
          for (const emitted of record.emits) {
            if (rule.handles(emitted.type)) queue.push({ rule, event: { type: emitted.type, now: Date.now(), data: emitted.data, origin:"rule", managedTimer: emitted.managedTimer, trustedUsage: false }, depth: depth + 1 });
          }
        }
      }
      for (const [groupId, rule] of rules) {
        out.types[groupId] = rule.types();
        const panels = rule.takePanels();
        if (panels) out.panels[groupId] = panels;
        const state = rule.takeState();
        if (!state.ok) {
          out.diagnostics.push({ groupId, level: "error", args: [state.error] });
          out.stateFailures.push(groupId);
          out.actions = out.actions.filter(action => action.groupId !== groupId);
          out.logs = out.logs.filter(entry => entry.groupId !== groupId);
          delete out.panels[groupId];
        } else if (state.value !== undefined) out.states[groupId] = state.value;
      }
      return out;
    }

    function setTimeContext(groupId, context) {
      try {
        rules.get(groupId)?.configureTime(context);
        timeContexts.set(groupId, context);
        return { ok: true };
      } catch (error) {
        const unavailable = { linked: true, ready: false, clusterId: context?.clusterId || "unavailable" };
        timeContexts.set(groupId, unavailable);
        rules.get(groupId)?.configureTime(unavailable);
        return { ok: false, error: String(error.message || error) };
      }
    }
    return { acceptsRequest:(id,token)=>!suppressed.has(id)&&rules.get(id)?.acceptsAI(token)===true, load, prepareLoad, commitLoad, discardLoad, unload, suppress, dispatch, setTimeContext, types: (groupId) => (rules.has(groupId) ? rules.get(groupId).types() : []) };
  }

  // ── Values ───────────────────────────────────────────────────────────────
  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
  function utf8Bytes(text) {
    let bytes = 0;
    for (const character of text) {
      const code = character.codePointAt(0);
      bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    }
    return bytes;
  }
  function safeJSON(value) {
    try { return JSON.stringify(value); } catch (_) { return null; }
  }
  function cloneJSON(value) {
    const json = safeJSON(value);
    return json === null || json === undefined ? null : JSON.parse(json);
  }
  function logValue(value) {
    if (value === null || typeof value !== "object") return typeof value === "function" ? "[function]" : value;
    const json = safeJSON(value);
    return json === null ? String(value) : (json.length > 4000 ? json.slice(0, 4000) + "…" : JSON.parse(json));
  }
  function text(value, max) {
    const out = String(value ?? "");
    return out.length > max ? out.slice(0, max) : out;
  }

  // ── Panels ───────────────────────────────────────────────────────────────
  // The one panel spec both engines render (content.js / the Mac overlay).
  const PANEL_POSITIONS = new Set(["top-left", "top-right", "bottom-left", "bottom-right", "center"]);
  const PANEL_ALIGNS = new Set(["left", "center", "right"]);
  const PANEL_WIDTHS = new Set(["small", "medium", "large"]);
  const PANEL_LAYOUTS = new Set(["vertical", "compact", "comfortable", "spacious", "inline", "row", "wrap", "twoColumn", "grid", "split", "form", "toolbar", "stack"]);
  const PANEL_ROLES = new Set(["region", "dialog", "alert", "status", "form", "group"]);
  const CONTROL_TYPES = new Set(["text", "timer", "checkbox", "select", "textInput", "textarea", "button", "section", "numberInput", "range", "toggle", "radio", "date", "time", "color", "pin", "html"]);
  const BUTTON_ACTIONS = new Set(["submit", "cancel", "close"]);

  function sanitizePanelId(value) {
    return text(value, 80).trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  // Raw HTML for the "html" control, without its execution vectors.
  function sanitizeHtml(value) {
    let html = text(value, 20000);
    // Panel appearance belongs to Vault. Rules may format content, but cannot
    // inject a stylesheet or override its palette/font through HTML.
    html = html.replace(/<\s*style\b[\s\S]*?<\s*\/\s*style\s*>/gi, "")
      .replace(/<\s*(?:style|link)\b[^>]*>/gi, "")
      .replace(/<[^>]*>/g, (tag) => tag.replace(/\s(?:style|color|bgcolor|face|fill|stroke)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ""));
    html = html.replace(/<\s*script\b[\s\S]*?<\s*\/\s*script\s*>/gi, "").replace(/<\s*script\b[^>]*>/gi, "");
    html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "").replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "").replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
    return html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "$1=$2#$2");
  }
  function color(value) {
    const t = String(value ?? "").trim();
    if (!t || t.length > 64) return null;
    return /^#[0-9a-f]{3,8}$/i.test(t) || /^(rgba?|hsla?)\([\d\s.,%+-]+\)$/i.test(t) || /^[a-z]{3,32}$/i.test(t) ? t : null;
  }
  function size(value, minPx, maxPx) {
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(minPx, Math.min(maxPx, Math.round(value))) + "px";
    const match = String(value ?? "").trim().match(/^(\d+(?:\.\d+)?)px$/i);
    return match ? Math.max(minPx, Math.min(maxPx, Math.round(Number(match[1])))) + "px" : "";
  }
  function number(value, min, max) {
    const n = Number(value);
    const lo = Number.isFinite(Number(min)) ? Number(min) : -1e6;
    const hi = Number.isFinite(Number(max)) ? Number(max) : 1e6;
    return Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), Number.isFinite(n) ? n : 0));
  }
  function controlValue(type, value, control) {
    if (type === "checkbox" || type === "toggle") return value === true;
    if (type === "numberInput" || type === "range") return number(value, control.min, control.max);
    if (type === "textInput" || type === "textarea") return text(value, 2000);
    if (type === "date") return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) ? String(value) : "";
    if (type === "time") return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value ?? "")) ? String(value) : "";
    if (type === "color") return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : "#000000";
    if (type === "pin") return String(value ?? "").replace(/\D/g, "").slice(0, control.length || 6);
    if (type === "section") return "";
    return text(value, 512);
  }
  function sanitizeControl(raw, index, depth, values) {
    if (!isPlainObject(raw)) return null;
    let type = CONTROL_TYPES.has(raw.type) ? raw.type : "text";
    // A legacy unknown/malformed timer control remains harmless plain text.
    // A valid managed timer control supplies an explicit named object ID.
    if (type === "timer") { try { timeID(raw.timerId); } catch (_) { type = "text"; } }
    const id = sanitizePanelId(raw.id || "control-" + (index + 1));
    if (!id) return null;
    const out = { id, type, label: text(raw.label ?? "", 240), disabled: raw.disabled === true };
    if (type === "pin") {
      out.length = Math.max(3, Math.min(12, Math.floor(Number(raw.length)) || 6));
      out.masked = raw.masked !== false;
      if (raw.autoSubmit === true) out.autoSubmit = true;
    }
    if (type === "numberInput" || type === "range") {
      if (Number.isFinite(Number(raw.min))) out.min = number(raw.min);
      if (Number.isFinite(Number(raw.max))) out.max = number(raw.max);
      if (Number(raw.step) > 0) out.step = Math.min(1e6, Number(raw.step));
    }
    // A value the user entered stays unless the rule sets one.
    const entered = values && Object.prototype.hasOwnProperty.call(values, id) ? values[id] : undefined;
    out.value = controlValue(type, raw.value !== undefined ? raw.value : entered, out);
    if (PANEL_LAYOUTS.has(raw.layout)) out.layout = raw.layout;
    if (PANEL_ALIGNS.has(raw.align)) out.align = raw.align;
    if (raw.ariaLabel) out.ariaLabel = text(raw.ariaLabel, 240);
    if (raw.autoFocus === true) out.autoFocus = true;
    const width = raw.width === "full" || raw.width === "auto" ? raw.width : size(raw.width, 32, 520);
    const height = raw.height === "auto" ? "auto" : size(raw.height, 20, 360);
    if (width) out.width = width;
    if (height) out.height = height;
    if (Number.isFinite(Number(raw.rows))) out.rows = Math.max(1, Math.min(12, Math.floor(Number(raw.rows))));
    if (type === "text") out.text = text(raw.text ?? raw.label ?? "", 1000);
    if (type === "timer") out.timerId = timeID(raw.timerId);
    if (type === "html") out.html = sanitizeHtml(raw.html ?? raw.text ?? "");
    if (type === "textInput" || type === "textarea") out.placeholder = text(raw.placeholder ?? "", 500);
    if (type === "select" || type === "radio") {
      out.options = (Array.isArray(raw.options) ? raw.options : []).slice(0, LIMITS.optionsPerControl).map((option) => {
        const value = text(isPlainObject(option) ? option.value ?? option.label : option, 256);
        return value ? { value, label: text(isPlainObject(option) ? option.label ?? value : value, 256) } : null;
      }).filter(Boolean);
    }
    if (type === "section") {
      out.text = text(raw.text ?? "", 1000);
      out.role = PANEL_ROLES.has(raw.role) ? raw.role : "group";
      out.controls = depth < 3 ? (Array.isArray(raw.controls) ? raw.controls : []).slice(0, LIMITS.controlsPerPanel)
        .map((child, i) => sanitizeControl(child, i, depth + 1, values)).filter(Boolean) : [];
    }
    if (type === "button") {
      if (!out.label) out.label = text(raw.text ?? "Button", 120);
      if (BUTTON_ACTIONS.has(raw.action)) out.action = raw.action;
    }
    return out;
  }
  function sanitizePanel(spec, values) {
    if (!isPlainObject(spec)) return null;
    const id = sanitizePanelId(spec.id);
    if (!id) return null;
    return {
      id,
      title: text(spec.title ?? "", 240),
      description: text(spec.description ?? "", 1000),
      position: PANEL_POSITIONS.has(spec.position) ? spec.position : "bottom-right",
      align: PANEL_ALIGNS.has(spec.align) ? spec.align : "left",
      layout: PANEL_LAYOUTS.has(spec.layout) ? spec.layout : "vertical",
      width: PANEL_WIDTHS.has(spec.width) ? spec.width : size(spec.width, 180, 520),
      role: PANEL_ROLES.has(spec.role) ? spec.role : "region",
      controls: (Array.isArray(spec.controls) ? spec.controls : []).slice(0, LIMITS.controlsPerPanel)
        .map((control, i) => sanitizeControl(control, i, 0, values)).filter(Boolean)
    };
  }

  // ── The reference an AI writes rules from ────────────────────────────────
  const SHARED_REFERENCE = [
    "A rule is ONE JavaScript function expression: (on, v) => { … }. It runs once when the user presses Run: register handlers there. Run replaces the old handlers; deleting the group removes them. While the group is disabled no handler runs and what the rule did is lifted (its panels, style sheets, covers, blocks); enabling it resumes the rule as it was.",
    "on(type, handler) adds a handler; several per type are fine. handler(ev) gets ev = { type, now (ms since 1970), origin: host|user|rule, data }. Rendered control input has origin user; v.emit has origin rule. Handlers are synchronous and must finish within 1 s: no loops that wait, no network, no setTimeout/setInterval, no DOM of your own (you run in a sandbox).",
    "v.ai({prompt, input?}) calls the AI connection/model configured for this custom group. Call it inside an event handler; it returns a request ID immediately. The later ai event has data {requestId, ok, text, citations:[{url,title}], error}. Handle errors explicitly; no fallback or automatic retries. Text is at most48KB; prompt/input each20KB; each call waits for the provider without a fixed Vault deadline. Search is always enabled. Keys stay in connected Mac Vault; disconnected browsers report ai-unavailable. Disabled/replaced rules discard old replies. Linked groups share settings and the optional UTC daily request cap; failed submitted attempts count and linking/unlinking does not reset usage. AI output is data and is never executed automatically. Preserve visible clickable citations if displaying web-derived answers.",
    "v.state is the group's memory: one JSON object (≤ 64 KB), kept across restarts and across Run (a new version of the rule finds what the old one saved), deleted with the group. Change it freely inside handlers.",
    "v.store({op:get|put|delete|list|clear, key?, value?, version?, ifRevision?, prefix?, after?, limit?}) starts a group-owned JSON record request inside a handler and returns its request ID. Later record events carry {requestId, ok, op, key?, record?, entries?, next?, deleted?, error?}. get returns a record or null; put returns the saved record; list returns sorted headers without values and an after cursor. Each record has value, opaque revision, caller version and updatedAt. For put/delete, omit ifRevision for unconditional writes, pass null to require absence, or pass the expected revision to require an exact match. A mismatch is store-conflict with the current record. Caller code decides cache policy and user-feedback priority; v.context.revision is an opaque configuration marker that may be included in a caller-chosen version. No automatic retries. Records are private to the owning group, persist across Run/restart, and are deleted with the group. Linked groups keep separate records. Each value is at most64KB; the store at most16MB. A group may start32 requests per second, across all groups128; overload reports one store-busy error per group/second and drops further requests that second.",
    "v.log(...values) writes to the group's log in the editor.",
    "v.timer(id, {direction: down|up, durationMs?}) creates/returns a named managed timer (default down; durationMs required for down). It begins paused. start()/resume() are idempotent; pause() freezes; reset() clears elapsed and pauses; snapshot() gives ready/error, elapsedMs, remainingMs (null for up), running and completed. Running clocks continue while closed/disabled. timerEnded delivers {id, direction, durationMs, generation, incarnation} once per incarnation and generation to each enabled linked member when it next executes; Run does not replay it.",
    "v.rolling(id, {windowMs, limitMs}) creates/returns a named active-use tracker. assign({websites:[hostnames],apps:[native app IDs]}) replaces this member's targets; all assigned targets share the allowance. snapshot() gives ready/error, usedMs, remainingMs, available and nextReturnAtMs; available(target?) also checks assignment. reset() clears this object's usage. Browser visible intervals and native observed foreground samples count once across overlaps, not wall time or v.emit events.",
    "Managed time IDs: 1–80 ASCII letters/digits/_/-. Integer millisecond durations ≤365 days; at most32 objects and64KiB total rule JSON. A changed same-ID configuration is refused; removeTime(id) explicitly deletes it before recreation. $vaultTime is a reserved versioned state namespace; do not edit it. Run/restart preserve objects. Linked custom groups on one local hub share same-ID objects, combine tracker history/targets and retain initiating timers; disconnected shared trackers are unavailable and controls fail. Check ready. Unlinked groups are independent.",

    "v.emit(type, data) delivers a \"type\" event with that data to this group, right after the current one.",
    "v.panel(id, spec, tabId?) shows a panel (spec = { title, description, position: top-left|top-right|bottom-left|bottom-right|center, layout, width: small|medium|large, controls: [...] }); calling again replaces it; v.panel(id, null) removes it. Controls: { id, type, label, value, ... } with type text (text), timer (timerId; managed timer displayed as text), html (html, sanitized; inherits Vault colors/font and discards CSS), button (action submit|cancel|close), checkbox, toggle, select / radio (options), textInput / textarea (placeholder), numberInput / range (min, max, step), date, time, color, pin (length, masked), section (controls). Interactions arrive as \"panel\" events: data = { panelId, controlId, eventName, value, values }.",
    "v.file(op, path, payload?) uses the folder the user chose in Settings (.txt, .csv, .json; paths relative to it): op read | write | append | list | exists. It returns a request id; the answer arrives as a \"file\" event: data = { requestId, ok, op, path, text, entries, exists, error }.",
    "Other events: \"snooze\" (the user pressed the group's Snooze), plus every type you v.emit.",
    "Limits per event: 256 actions, 200 log entries, 64 emits; 24 panels of 32 controls per group."
  ];
  const ENGINE_REFERENCE = {
    browser: [
      "ENGINE: the browser extension. It controls the browser only (never apps).",
      "\"tick\" every second: data = { tabs: [{ tabId, url, active }] }.",
      "\"tab\" when a tab opens, goes to an address or closes: data = { kind: open | navigate | close, tabId, url, previousUrl }.",
      "\"visible\" while a page is visible: data = { tabId, url, elapsedMs } (the visible time since the last one).",
      "\"items\" as an accessible web page or supported feed (YouTube, Reddit, Bilibili, X…) shows items, each new or changed item once: data = { tabId, platform, items: [{ ref, url, title, authors, videoForm: short|long|post|unknown, tags: [{ name, confidence 1–5 }], tagsSettled, isPage }] }. The page itself is the item with isPage true (ref \"page\", title = the page's title); act on it with v.cover. tags come from the connected Mac Vault classifier; tagsSettled is false until it answered — decide nothing about tags before that.",
      "Items also contain contentId (saved content), instanceId (current appearance), and attachments (this group's saved attachment specs keyed by ID). v.attach(tabId,item,id,spec) saves a clickable pill {type:pill,text,tone?,tooltip?} or a passive HTML/CSS view {type:html,html,css?,label?}; null removes it. Pass the complete item, not its ref. IDs1–80 ASCII letters/digits/_/-. HTML is inert, sanitized and rendered in an isolated shadow root; scripts, event attributes, embeds, remote resources and unapproved CSS are removed. Named controls (data-control or id) send trusted attachment events with eventName click|input|change, controlId, value, values, tabId, attachmentId and the current item. ev.origin is user for actual control events; rule-emitted events are rule. Eight attachments per group/content,32 total/content,10000 contents/group,8MB UTF-8 document. Stale handles/limits/storage errors are logged; no automatic retry or eviction. Saved views survive navigation/restart/Run, hide on disable, return on reenable and disappear with group deletion. Linked groups keep separate attachments. Browser content only.",
      "v.item(tabId, ref, verdict) hides (\"hide\"), covers (\"dim\") or rescues (\"allow\") a feed item; null clears it. Groups higher in the list win.",
      "v.cover(tabId, on, message?) covers the page in place (or lifts it); a new address lifts it.",
      "v.go(tabId, url | \"back\" | \"forward\" | \"reload\") navigates. v.close(tabId) closes the tab.",
      "v.css(tabId | \"*\", id, css | null) adds (or removes) a style sheet: on a tab's page until the tab goes to another address, or (\"*\") on every page, pages opened later too.",
      "v.dom(tabId, selector, op, arg?) acts on the page's elements: op hide | show | click | setText (arg) | addClass (arg) | removeClass (arg) | scrollTo.",
      "v.query(tabId, selector) reads the page: it returns a request id; the answer arrives as a \"query\" event: data = { requestId, tabId, url, selector, matches: [{ tag, text, href, src, title, label, value }] (at most 50, text ≤ 1000 characters), error }. A tab without a web page never answers.",
      "EXAMPLE: (on, v) => { on(\"items\", (ev) => { for (const item of ev.data.items) if (item.tagsSettled && item.tags.some((t) => t.name === \"Gaming\" && t.confidence >= 4)) v.item(ev.data.tabId, item.ref, \"dim\"); }); }"
    ],
    mac: [
      "ENGINE: Mac Vault. It controls apps only (never websites).",
      "\"tick\" every second: data = { frontmost: { appId, name } | null, running: [{ appId, name }] } — every running app, menu-bar and background ones included.",
      "\"app\" when an app launches, quits, comes to the front or leaves it, hides or unhides: data = { kind: launch | quit | focus | blur | hide | unhide, appId, name, previousAppId (focus only) }.",
      "v.block(appId, on) blocks an app (asked to quit, again after Settings' retry interval) until v.block(appId, false), Run, or the group is disabled; v.quit(appId) asks it to quit once; v.open(appId) opens it. appId is a bundle identifier. On Mac Vault, Apple apps and whole browsers can be blocked; Vault's own bundle identity remains protected.",
      "EXAMPLE: (on, v) => { on(\"tick\", () => { const h = new Date().getHours(); v.block(\"com.valvesoftware.steam\", h >= 22 || h < 7); }); }"
    ]
  };
  function reference(engine) {
    return ["CUSTOM RULE API — use only what is listed; there are no other helpers.", ...SHARED_REFERENCE, ...(ENGINE_REFERENCE[engine] || [])].join("\n");
  }

  const api = Object.freeze({ LIMITS, compile, createRule, createEngine, sanitizePanel, reference, mergeTime, reduceTime, syncTime, detachTime });
  global.RuleCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
