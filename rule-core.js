// Custom rules — the one core both engines run (owner 2026-09-27).
//
// A rule is bare-bone: an AI writes it, not a person, so there is no helper
// library — only raw events in and a small set of actions out, one way to do
// each thing, and everything the program can do. The browser engine (the
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
    handlerMs: 1000
  });

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

    const v = {
      log(...args) {
        check();
        if (record) push(record.logs, { groupId, level: "log", args: args.map(logValue) }, LIMITS.logsPerDispatch);
      },
      emit(type, data) {
        check();
        const name = String(type || "");
        if (!name || !record) return;
        push(record.emits, { type: name, data: cloneJSON(data) }, LIMITS.emitsPerDispatch);
      },
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
      record = { actions: [], logs: [], emits: [], overrun: false };
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
        push(record.logs, { groupId, level: "error", args: [where + ": " + (error && error.message ? error.message : String(error))] }, LIMITS.logsPerDispatch);
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
      types: () => [...handlers.keys()],
      handles: (type) => handlers.has(type),
      // Runs this group's handlers for one event. Returns its record.
      dispatch(event) {
        begin();
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
        return end();
      },
      // The group's panels when they changed since the last call (else null).
      takePanels() {
        if (!panelsChanged) return null;
        panelsChanged = false;
        return [...panels.values()].map((panel) => ({ ...panel, groupId }));
      },
      // The group's state when it changed since the last call (else undefined).
      // Over the size limit it is not kept, and the rule is told.
      takeState() {
        const json = safeJSON(stateObj);
        if (json === stateJSON) return undefined;
        if (json === null || json.length > LIMITS.stateBytes) return { error: "v.state must be JSON and at most " + LIMITS.stateBytes + " bytes" };
        stateJSON = json;
        return JSON.parse(json);
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

  function createEngine(engineActions, { beacon = () => {} } = {}) {
    const rules = new Map(); // groupId -> rule
    const overruns = new Map(); // groupId -> [time]

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
    function load(groupId, source, state) {
      const compiled = compile(source);
      if (compiled.error) return { ok: false, handlers: 0, types: [], error: compiled.error, logs: [] };
      if (!compiled.fn) {
        unload(groupId);
        return { ok: true, handlers: 0, types: [], error: null, logs: [] };
      }
      beacon(groupId);
      const rule = createRule(groupId, compiled.fn, { state, engineActions });
      if (rule.error) {
        const budget = /longer than/.test(rule.error);
        return { ok: false, handlers: 0, types: [], error: rule.error, logs: rule.registrationLogs, quarantine: budget ? { groupId, reason: "registration-deadline-overrun" } : null };
      }
      rules.set(groupId, rule);
      overruns.delete(groupId);
      return { ok: true, handlers: rule.handlerCount, types: rule.types(), error: null, logs: rule.registrationLogs, panels: rule.takePanels() || [] };
    }

    function unload(groupId) {
      rules.delete(groupId);
      overruns.delete(groupId);
    }

    // One event to every group that handles it (or to one group); what a
    // handler emits follows for that group, bounded. Returns the actions,
    // logs, changed panels ({ groupId: [panel] }), changed states
    // ({ groupId: state }) and a quarantine, if a rule earned one.
    function dispatch(descriptor) {
      const out = { ok: true, actions: [], logs: [], panels: {}, states: {}, quarantine: null };
      const queue = [];
      for (const [groupId, rule] of rules) {
        if (descriptor.targetGroupId && descriptor.targetGroupId !== groupId) continue;
        if (rule.handles(descriptor.type)) queue.push({ rule, event: descriptor, depth: 0 });
      }
      while (queue.length > 0) {
        const { rule, event, depth } = queue.shift();
        beacon(rule.groupId);
        const record = rule.dispatch({ type: event.type, now: event.now ?? Date.now(), data: event.data ?? null });
        out.actions.push(...record.actions);
        out.logs.push(...record.logs);
        if (record.overrun && overran(rule.groupId) && !out.quarantine) {
          out.quarantine = { groupId: rule.groupId, reason: "deadline-overrun" };
        }
        if (depth < EMIT_DEPTH) {
          for (const emitted of record.emits) {
            if (rule.handles(emitted.type)) queue.push({ rule, event: { type: emitted.type, now: Date.now(), data: emitted.data }, depth: depth + 1 });
          }
        }
      }
      for (const [groupId, rule] of rules) {
        const panels = rule.takePanels();
        if (panels) out.panels[groupId] = panels;
        const state = rule.takeState();
        if (state && state.error) out.logs.push({ groupId, level: "error", args: [state.error] });
        else if (state !== undefined) out.states[groupId] = state;
      }
      return out;
    }

    return { load, unload, dispatch, types: (groupId) => (rules.has(groupId) ? rules.get(groupId).types() : []) };
  }

  // ── Values ───────────────────────────────────────────────────────────────
  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  const CONTROL_TYPES = new Set(["text", "checkbox", "select", "textInput", "textarea", "button", "section", "numberInput", "range", "toggle", "radio", "date", "time", "color", "pin", "html"]);
  const BUTTON_ACTIONS = new Set(["submit", "cancel", "close"]);

  function sanitizePanelId(value) {
    return text(value, 80).trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  // Raw HTML for the "html" control, without its execution vectors.
  function sanitizeHtml(value) {
    let html = text(value, 20000);
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
    const theme = {};
    const rawTheme = isPlainObject(spec.theme) ? spec.theme : {};
    for (const key of ["background", "foreground", "accent", "border", "muted"]) {
      const c = color(rawTheme[key]);
      if (c) theme[key] = c;
    }
    return {
      id,
      title: text(spec.title ?? "", 240),
      description: text(spec.description ?? "", 1000),
      position: PANEL_POSITIONS.has(spec.position) ? spec.position : "bottom-right",
      align: PANEL_ALIGNS.has(spec.align) ? spec.align : "left",
      layout: PANEL_LAYOUTS.has(spec.layout) ? spec.layout : "vertical",
      width: PANEL_WIDTHS.has(spec.width) ? spec.width : size(spec.width, 180, 520),
      role: PANEL_ROLES.has(spec.role) ? spec.role : "region",
      theme,
      controls: (Array.isArray(spec.controls) ? spec.controls : []).slice(0, LIMITS.controlsPerPanel)
        .map((control, i) => sanitizeControl(control, i, 0, values)).filter(Boolean)
    };
  }

  // ── The reference an AI writes rules from ────────────────────────────────
  const SHARED_REFERENCE = [
    "A rule is ONE JavaScript function expression: (on, v) => { … }. It runs once when the user presses Run: register handlers there. Run, disabling or deleting the group removes the old handlers.",
    "on(type, handler) adds a handler; several per type are fine. handler(ev) gets ev = { type, now (ms since 1970), data }. Handlers are synchronous and must finish within 1 s: no loops that wait, no network, no timers, no DOM of your own (you run in a sandbox).",
    "v.state is the group's memory: one JSON object (≤ 64 KB), kept across restarts and across Run (a new version of the rule finds what the old one saved), deleted with the group. Change it freely inside handlers.",
    "v.log(...values) writes to the group's log in the editor.",
    "v.emit(type, data) delivers a \"type\" event with that data to this group, right after the current one.",
    "v.panel(id, spec, tabId?) shows a panel (spec = { title, description, position: top-left|top-right|bottom-left|bottom-right|center, layout, width: small|medium|large, theme: { background, foreground, accent, border, muted }, controls: [...] }); calling again replaces it; v.panel(id, null) removes it. Controls: { id, type, label, value, ... } with type text (text), html (html, sanitized), button (action submit|cancel|close), checkbox, toggle, select / radio (options), textInput / textarea (placeholder), numberInput / range (min, max, step), date, time, color, pin (length, masked), section (controls). Interactions arrive as \"panel\" events: data = { panelId, controlId, eventName, value, values }.",
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
      "v.item(tabId, ref, verdict) hides (\"hide\"), blacks out (\"dim\") or rescues (\"allow\") a feed item; null clears it. Groups higher in the list win.",
      "v.cover(tabId, on, message?) covers the page in place (or lifts it); a new address lifts it.",
      "v.go(tabId, url | \"back\" | \"forward\" | \"reload\") navigates. v.close(tabId) closes the tab.",
      "v.css(tabId | \"*\", id, css | null) adds (or removes) a style sheet on a tab's page, or every page.",
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
