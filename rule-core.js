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
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function duration(value, name, zero = false) {
    if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1) || value > MAX_TIME_MS) throw new Error("Invalid " + name + " (integer milliseconds, at most 365 days).");
    return value;
  }
  function timeID(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new Error("Time object IDs use 1–80 letters, digits, _ or -.");
    return value;
  }
  function timeTools(getState, clock, check) {
    const timers = new Set(), trackers = new Set();
    let changed = false;
    let usageFloor = clock();
    const read = () => {
      const state = getState();
      if (!own(state, TIME_KEY)) return { version: 1, objects: {} };
      const saved = state[TIME_KEY];
      if (!isPlainObject(saved) || saved.version !== 1 || !isPlainObject(saved.objects)) throw new Error("Unsupported or invalid " + TIME_KEY + " state; saved data was preserved.");
      return saved;
    };
    const update = (fn) => {
      check();
      const saved = cloneJSON(read());
      const result = fn(saved.objects);
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
    const ensure = (id, initial) => update(objects => {
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
      if (!["up", "down"].includes(t.direction) || !Number.isFinite(t.elapsedMs) || t.elapsedMs < 0 || (t.startedAtMs !== null && !Number.isFinite(t.startedAtMs))) throw new Error("Invalid saved timer.");
      return Math.min(MAX_TIME_MS, t.elapsedMs + (t.startedAtMs === null ? 0 : Math.max(0, at - t.startedAtMs)));
    }
    function timerSnapshot(id, at = clock()) {
      const t = object(id, "timer"), raw = elapsed(t, at);
      const done = t.direction === "down" && raw >= t.durationMs;
      return { id, direction: t.direction, durationMs: t.durationMs, elapsedMs: t.direction === "down" ? Math.min(raw, t.durationMs) : raw,
        remainingMs: t.direction === "down" ? Math.max(0, t.durationMs - raw) : null, running: t.startedAtMs !== null && !done, completed: done };
    }
    function timer(id, options = {}) {
      id = timeID(id);
      const direction = options.direction === undefined ? "down" : options.direction;
      if (!["up", "down"].includes(direction)) throw new Error("Timer direction is up or down.");
      const durationMs = direction === "down" ? duration(options.durationMs, "durationMs") : 0;
      ensure(id, { kind: "timer", direction, durationMs, elapsedMs: 0, startedAtMs: null, notified: false, generation: 0 });
      // Validate loaded values before activating the candidate.
      timerSnapshot(id); timers.add(id);
      const resume = () => update(objects => {
        const t = objects[id]; object(id, "timer");
        if (t.startedAtMs === null && !(t.direction === "down" && t.elapsedMs >= t.durationMs)) t.startedAtMs = clock();
      });
      return Object.freeze({
        id, start: resume, resume,
        pause: () => update(objects => {
          const t = objects[id]; object(id, "timer");
          t.elapsedMs = elapsed(t, clock());
          if (t.direction === "down") t.elapsedMs = Math.min(t.durationMs, t.elapsedMs);
          t.startedAtMs = null;
        }),
        reset: () => update(objects => { const t = objects[id]; object(id, "timer"); t.elapsedMs = 0; t.startedAtMs = null; t.notified = false; t.generation = (t.generation || 0) + 1; }),
        snapshot: () => { check(); return timerSnapshot(id); }
      });
    }
    function prune(t, at) {
      if (!isPlainObject(t.bucketsMs) || !Array.isArray(t.segments) || !Number.isFinite(t.accruedUntilMs) || t.accruedUntilMs < 0) throw new Error("Invalid saved rolling tracker.");
      for (const [key, value] of Object.entries(t.bucketsMs)) {
        const minute = Number(key);
        if (!Number.isSafeInteger(minute) || minute < 0 || minute % MINUTE_MS || !Number.isFinite(value) || value <= 0) throw new Error("Invalid rolling usage bucket.");
        // Same minute-bucket representation and expiry as ordinary rolling groups.
        if (minute + MINUTE_MS <= at - t.windowMs) delete t.bucketsMs[key];
      }
      const floor = Math.floor((at - t.windowMs) / MINUTE_MS) * MINUTE_MS;
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
      let room = Math.max(0, t.limitMs - used(t));
      if (room <= 0 || to <= from) return;
      const additions = [];
      let cursor = from;
      for (const [start, end] of t.segments) {
        if (end <= cursor) continue;
        if (start >= to) break;
        if (start > cursor) {
          const amount = Math.min(start - cursor, room);
          additions.push([cursor, cursor + amount]); room -= amount;
          if (!room) break;
        }
        cursor = Math.max(cursor, end);
      }
      if (room > 0 && cursor < to) additions.push([cursor, cursor + Math.min(to - cursor, room)]);
      t.segments = unionSegments([...t.segments, ...additions]);
      rebuildBuckets(t);
    }
    const used = t => Object.values(t.bucketsMs).reduce((total, value) => total + value, 0);
    function targetList(value, kind) {
      if (!Array.isArray(value) || value.length > 100 || value.some(x => typeof x !== "string" || !x || x.length > 32767)) throw new Error("Assign at most 100 " + kind + " targets.");
      return [...new Set(value.map(x => {
        if (kind !== "website") return windowsTimeIdentities ? x.toLowerCase() : x;
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
      const app = windowsTimeIdentities ? String(value || "").toLowerCase() : value;
      return t.apps.includes(app);
    }
    function trackerSnapshot(id) {
      const at = clock(); let snapshot;
      update(objects => {
        object(id, "rolling"); const t = objects[id]; prune(t, at);
        const usedMs = used(t), remainingMs = Math.max(0, t.limitMs - usedMs);
        const minutes = Object.keys(t.bucketsMs).map(Number);
        snapshot = { id, windowMs: t.windowMs, limitMs: t.limitMs, usedMs, remainingMs, available: remainingMs > 0,
          nextReturnAtMs: minutes.length ? Math.min(...minutes) + MINUTE_MS + t.windowMs : null };
      });
      return snapshot;
    }
    function rolling(id, options) {
      id = timeID(id);
      const windowMs = duration(options?.windowMs, "windowMs"), limitMs = duration(options?.limitMs, "limitMs", true);
      ensure(id, { kind: "rolling", windowMs, limitMs, websites: [], apps: [], bucketsMs: {}, segments: [], accruedUntilMs: 0, resetAtMs: clock() });
      const stored = object(id, "rolling"); targetList(stored.websites, "website"); targetList(stored.apps, "app");
      trackerSnapshot(id); trackers.add(id);
      return Object.freeze({
        id,
        assign: (targets) => {
          const websites = targetList(targets?.websites || [], "website"), apps = targetList(targets?.apps || [], "app");
          update(objects => { object(id, "rolling"); Object.assign(objects[id], { websites, apps }); });
        },
        snapshot: () => { check(); return trackerSnapshot(id); },
        available: (target) => {
          check(); const t = object(id, "rolling");
          return (target === undefined || websiteMatches(t, target) || appMatches(t, target)) && trackerSnapshot(id).available;
        },
        reset: () => update(objects => { object(id, "rolling"); objects[id].bucketsMs = {}; objects[id].segments = []; objects[id].accruedUntilMs = clock(); objects[id].resetAtMs = clock(); })
      });
    }
    function advance(event, emit) {
      const at = clock();
      if (!timers.size && !trackers.size) return;
      const ended = [];
      update(objects => {
        for (const id of timers) {
          const t = objects[id]; object(id, "timer");
          if (t.direction === "down" && elapsed(t, at) >= t.durationMs && !t.notified) {
            t.elapsedMs = t.durationMs; t.startedAtMs = null; t.notified = true;
            ended.push({ id, direction: "down", durationMs: t.durationMs, generation: t.generation || 0 });
          }
        }
        for (const id of trackers) {
          const t = objects[id]; object(id, "rolling"); prune(t, at);
          const data = event.data || {};
          const matches = event.type === "visible" ? websiteMatches(t, data.url) : event.type === "tick" && appMatches(t, data.usageAppId);
          const amount = Number(data.elapsedMs);
          if (!matches || !Number.isFinite(amount) || amount <= 0) continue;
          const bounded = Math.min(5000, Math.round(amount));
          const from = Math.max(at - bounded, usageFloor, t.resetAtMs || 0);
          t.accruedUntilMs = Math.max(at, t.accruedUntilMs);
          addUsage(t, from, at);
        }
      });
      for (const data of ended) emit("timerEnded", data);
    }
    function hydrate(controls) {
      return controls.map(control => {
        if (control.type === "section") return { ...control, controls: hydrate(control.controls) };
        if (control.type !== "timer") return control;
        if (!timers.has(control.timerId)) return { ...control, type: "text", text: (control.label ? control.label + " " : "") + "—" };
        const status = timerSnapshot(control.timerId);
        const seconds = Math.ceil((status.direction === "down" ? status.remainingMs : status.elapsedMs) / 1000);
        const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
        const display = (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
        // Use the existing native/browser text control; no parallel renderer.
        return { ...control, type: "text", text: (control.label ? control.label + " " : "") + display };
      });
    }
    return { timer, rolling, advance, hydrate,
      types: () => [...(timers.size || trackers.size ? ["tick"] : []), ...(trackers.size ? ["visible"] : [])],
      takeChanged: () => { const result = changed || timers.size > 0; changed = false; return result; },
      resetUsageBoundary: (at = clock()) => { usageFloor = at; },
      currentCompletion: data => {
        if (!timers.has(data?.id)) return false;
        const t = object(data.id, "timer");
        return t.notified && (t.generation || 0) === data.generation;
      },
      remove: id => { id = timeID(id); update(objects => { delete objects[id]; }); timers.delete(id); trackers.delete(id); }
    };
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
  function createRule(groupId, fn, { state, engineActions, now = () => Date.now() } = {}) {
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

    const time = timeTools(() => stateObj, () => eventNow ?? now(), check);

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
      error: registrationError,
      registrationLogs: registration.logs,
      get handlerCount() { return handlerCount; },
      types: () => [...new Set([...handlers.keys(), ...time.types()])],
      handles: (type) => handlers.has(type) || time.types().includes(type),
      resetUsageBoundary: time.resetUsageBoundary,
      currentCompletion: time.currentCompletion,
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
        const ev = Object.freeze({ type: event.type, now: event.now, data: event.data ?? null });
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
        rule = createRule(groupId, compiled.fn, { state: cloneJSON(state), engineActions });
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
      discardGroup(groupId);
      rules.delete(groupId);
      overruns.delete(groupId);
      suppressed.delete(groupId);
    }

    function suppress(groupId, on) {
      if (suppressed.has(groupId) !== (on === true)) rules.get(groupId)?.resetUsageBoundary();
      if (on) suppressed.add(groupId);
      else suppressed.delete(groupId);
    }

    // One event to every group that handles it (or to one group); what a
    // handler emits follows for that group, bounded. Returns the actions,
    // logs, changed panels ({ groupId: [panel] }), changed states
    // ({ groupId: state }) and a quarantine, if a rule earned one.
    function dispatch(descriptor) {
      const out = { ok: true, actions: [], logs: [], diagnostics: [], panels: {}, states: {}, types: {}, quarantine: null };
      const queue = [];
      for (const [groupId, rule] of rules) {
        if (descriptor.targetGroupId && descriptor.targetGroupId !== groupId) continue;
        if (suppressed.has(groupId)) continue;
        if (rule.handles(descriptor.type)) queue.push({ rule, event: descriptor, depth: 0 });
      }
      while (queue.length > 0) {
        const { rule, event, depth } = queue.shift();
        if (event.managedTimer && !rule.currentCompletion(event.data)) continue;
        beacon(rule.groupId);
        const record = rule.dispatch({ type: event.type, now: event.now ?? Date.now(), data: event.data ?? null });
        out.actions.push(...record.actions);
        out.logs.push(...record.logs);
        out.diagnostics.push(...record.diagnostics);
        if (record.overrun && overran(rule.groupId) && !out.quarantine) {
          out.quarantine = { groupId: rule.groupId, reason: "deadline-overrun" };
        }
        if (depth < EMIT_DEPTH) {
          for (const emitted of record.emits) {
            if (rule.handles(emitted.type)) queue.push({ rule, event: { type: emitted.type, now: Date.now(), data: emitted.data, managedTimer: emitted.managedTimer }, depth: depth + 1 });
          }
        }
      }
      for (const [groupId, rule] of rules) {
        out.types[groupId] = rule.types();
        const panels = rule.takePanels();
        if (panels) out.panels[groupId] = panels;
        const state = rule.takeState();
        if (!state.ok) out.diagnostics.push({ groupId, level: "error", args: [state.error] });
        else if (state.value !== undefined) out.states[groupId] = state.value;
      }
      return out;
    }

    return { load, prepareLoad, commitLoad, discardLoad, unload, suppress, dispatch, types: (groupId) => (rules.has(groupId) ? rules.get(groupId).types() : []) };
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
    const type = CONTROL_TYPES.has(raw.type) ? raw.type : "text";
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
    "on(type, handler) adds a handler; several per type are fine. handler(ev) gets ev = { type, now (ms since 1970), data }. Handlers are synchronous and must finish within 1 s: no loops that wait, no network, no timers, no DOM of your own (you run in a sandbox).",
    "v.state is the group's memory: one JSON object (≤ 64 KB), kept across restarts and across Run (a new version of the rule finds what the old one saved), deleted with the group. Change it freely inside handlers.",
    "v.log(...values) writes to the group's log in the editor.",
    "v.emit(type, data) delivers a \"type\" event with that data to this group, right after the current one.",
    "v.panel(id, spec, tabId?) shows a panel (spec = { title, description, position: top-left|top-right|bottom-left|bottom-right|center, layout, width: small|medium|large, controls: [...] }); calling again replaces it; v.panel(id, null) removes it. Controls: { id, type, label, value, ... } with type text (text), html (html, sanitized; inherits Vault colors/font and discards CSS), button (action submit|cancel|close), checkbox, toggle, select / radio (options), textInput / textarea (placeholder), numberInput / range (min, max, step), date, time, color, pin (length, masked), section (controls). Interactions arrive as \"panel\" events: data = { panelId, controlId, eventName, value, values }.",
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
      "\"items\" as a platform page (YouTube, Reddit, Bilibili, X…) shows items, each new or changed item once: data = { tabId, platform, items: [{ ref, url, title, authors, videoForm: short|long|post|unknown, tags: [{ name, confidence 1–5 }], tagsSettled, isPage }] }. The page itself is the item with isPage true (ref \"page\", title = the page's title); act on it with v.cover. tags come from Mac Vault's local classifier; tagsSettled is false until it answered — decide nothing about tags before that.",
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
      "v.block(appId, on) blocks an app (asked to quit, again after Settings' retry interval) until v.block(appId, false), Run, or the group is disabled; v.quit(appId) asks it to quit once; v.open(appId) opens it. appId is a bundle identifier. Apple's own apps (com.apple.*), browsers (their extension controls them) and Mac Vault are never blocked or quit.",
      "EXAMPLE: (on, v) => { on(\"tick\", () => { const h = new Date().getHours(); v.block(\"com.valvesoftware.steam\", h >= 22 || h < 7); }); }"
    ]
  };
  function reference(engine) {
    return ["CUSTOM RULE API — use only what is listed; there are no other helpers.", ...SHARED_REFERENCE, ...(ENGINE_REFERENCE[engine] || [])].join("\n");
  }

  const api = Object.freeze({ LIMITS, compile, createRule, createEngine, sanitizePanel, reference });
  global.RuleCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
