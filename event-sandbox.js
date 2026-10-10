/* The browser's custom-rule engine: rule-core.js's engine with the browser's
 * own actions (the scope line: nothing about apps).
 *
 * Lives in an iframe of offscreen.html, whose sandbox CSP permits
 * new Function(). Every enabled custom group's rule is registered here on
 * Run and handles events until it is Run again, disabled or deleted.
 *
 * Messages from the offscreen relay: { source: "custom-blocker-offscreen", id, payload }
 *   payload.kind:
 *     "load-source"    { groupId, source, state }  → { ok, handlers, types, error, logs, panels, states, quarantine }
 *                      (a rule that fails to load leaves the group's old one)
 *     "unload-group"   { groupId }                 → { ok }
 *     "suppress-group" { groupId, on }             → { ok }   (a disabled group's rule hears nothing)
 *     "dispatch-event" { descriptor: { type, now, data, targetGroupId? } }
 *                      → { ok, actions, logs, panels, states, quarantine }
 *       actions: [{ groupId, kind, … }], panels: { groupId: [panel] } (groups
 *       whose panels changed), states: { groupId: state } (changed states).
 */

function browserActions(act, _check, requestId) {
  const tab = (value) => (value === "*" ? "*" : Number.isInteger(value) ? value : null);
  return {
    item(tabId, ref, verdict) {
      const v = verdict === "hide" || verdict === "dim" || verdict === "allow" ? verdict : null;
      if (Number.isInteger(tabId)) act("item", { tabId, ref: String(ref ?? ""), verdict: v });
    },
    cover(tabId, on, message) {
      if (Number.isInteger(tabId)) act("cover", { tabId, on: on !== false, message: String(message ?? "").slice(0, 500) });
    },
    go(tabId, target) {
      if (Number.isInteger(tabId) && target) act("go", { tabId, target: String(target).slice(0, 4096) });
    },
    close(tabId) {
      if (Number.isInteger(tabId)) act("close", { tabId });
    },
    css(tabId, id, css) {
      if (tab(tabId) !== null && id) act("css", { tabId: tab(tabId), id: String(id).slice(0, 80), css: css === null || css === undefined ? null : String(css).slice(0, 100000) });
    },
    query(tabId, selector) {
      if (!Number.isInteger(tabId) || !selector) return null;
      const id = requestId();
      act("query", { tabId, selector: String(selector).slice(0, 1000), requestId: id });
      return id;
    },
    dom(tabId, selector, op, arg) {
      const ops = ["hide", "show", "click", "setText", "addClass", "removeClass", "scrollTo"];
      if (Number.isInteger(tabId) && selector && ops.includes(op)) {
        act("dom", { tabId, selector: String(selector).slice(0, 1000), op, arg: arg === undefined ? null : String(arg).slice(0, 2000) });
      }
    }
  };
}

// Tells the offscreen relay which group runs, so a rule that hangs the
// iframe is blamed in its hard-timeout reply.
function beacon(groupId) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: "custom-blocker-event-sandbox", type: "handler-start", groupId }, "*");
    }
  } catch (_) {}
}

const engine = RuleCore.createEngine(browserActions, { beacon });

function reply(target, id, result) {
  if (target && typeof target.postMessage === "function") {
    target.postMessage({ source: "custom-blocker-event-sandbox", type: "reply", id, result }, "*");
  }
}

window.addEventListener("message", (msg) => {
  const data = msg.data;
  if (!data || typeof data !== "object" || data.source !== "custom-blocker-offscreen") return;
  const id = data.id;
  const payload = data.payload || {};
  switch (payload.kind) {
    case "prepare-source":
      return reply(msg.source, id, engine.prepareLoad(String(payload.groupId), payload.source, payload.state));
    case "commit-source":
      return reply(msg.source, id, engine.commitLoad(payload.token));
    case "discard-source":
      return reply(msg.source, id, engine.discardLoad(payload.token));
    case "load-source":
      return reply(msg.source, id, engine.load(String(payload.groupId), payload.source, payload.state));
    case "unload-group":
      engine.unload(String(payload.groupId));
      return reply(msg.source, id, { ok: true });
    case "suppress-group":
      engine.suppress(String(payload.groupId), payload.on === true);
      return reply(msg.source, id, { ok: true });
    case "dispatch-event":
      return reply(msg.source, id, engine.dispatch(payload.descriptor || {}));
    default:
      return reply(msg.source, id, { ok: false, error: "unknown payload kind" });
  }
});

// Ready for messages.
if (window.parent && window.parent !== window) {
  window.parent.postMessage({ source: "custom-blocker-event-sandbox", type: "ready" }, "*");
}
