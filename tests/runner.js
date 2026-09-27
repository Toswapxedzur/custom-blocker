/* Custom rules — rule-core.js test runner (jsc-compatible).
 *
 * Run with:
 *   tests/run.sh
 *
 * rule-core.js is the rule contract both engines run (the browser's sandbox
 * and Mac Vault's JSC runtime): one source form `(on, v) => { … }`, raw
 * events in, a small set of actions out, no helper library.
 */

load("rule-core.js");
load("tests/log.js");

const R = globalThis.RuleCore;
const log = globalThis.__cbTestLog.makeLogger({ colour: true });

function assert(name, cond, data) {
  if (cond) log.pass(name, data);
  else log.fail(name, data);
  return Boolean(cond);
}

// The browser's engine actions, reduced to recording what was asked.
function engine(act) {
  return {
    item(tabId, ref, verdict) { act("item", { tabId, ref, verdict }); },
    cover(tabId, on) { act("cover", { tabId, on }); }
  };
}

function rule(source, options = {}) {
  const compiled = R.compile(source);
  if (compiled.error) return { compileError: compiled.error };
  return R.createRule("g1", compiled.fn, { engineActions: engine, ...options });
}

log.section("C1: one source form");
assert("an empty source compiles to no rule", R.compile("").fn === null && R.compile("  ").error === null);
assert("a function expression compiles", typeof R.compile("(on, v) => {}").fn === "function");
assert("a trailing semicolon is fine", typeof R.compile("(on, v) => {};").fn === "function");
assert("a non-function is refused", /one function/.test(R.compile("42").error || ""));
assert("a syntax error is reported", /Compile failed/.test(R.compile("(on, v) => {").error || ""));

log.section("C2: registration");
let r = rule(`(on, v) => { on("tab", () => {}); on("tab", () => {}); on("items", () => {}); v.log("hi"); }`);
assert("handlers are counted", r.handlerCount === 3);
assert("types are listed once", JSON.stringify(r.types().sort()) === JSON.stringify(["items", "tab"]));
assert("handles() answers per type", r.handles("tab") && !r.handles("tick"));
assert("registration logs are kept", r.registrationLogs.length === 1 && r.registrationLogs[0].args[0] === "hi");
r = rule(`(on) => { throw new Error("boom"); }`);
assert("a throwing registration is an error", /Registration failed: boom/.test(r.error || ""));
r = rule(`(on) => { on("", () => {}); on("x", 5); }`);
assert("a nameless type or a non-function handler is ignored", r.handlerCount === 0);

log.section("C3: dispatch → actions, logs, emits");
r = rule(`(on, v) => {
  on("items", (ev) => {
    for (const item of ev.data.items) if (item.title.includes("x")) v.item(ev.data.tabId, item.ref, "hide");
    v.log("seen", ev.data.items.length);
    v.emit("counted", { n: ev.data.items.length });
  });
}`);
let rec = r.dispatch({ type: "items", now: 1, data: { tabId: 7, items: [{ ref: "i1", title: "xa" }, { ref: "i2", title: "b" }] } });
assert("the handler's action is recorded with its group", rec.actions.length === 1 && rec.actions[0].groupId === "g1" && rec.actions[0].kind === "item" && rec.actions[0].ref === "i1");
assert("v.log values are recorded", rec.logs.length === 1 && rec.logs[0].args[1] === 2);
assert("v.emit is recorded", rec.emits.length === 1 && rec.emits[0].type === "counted" && rec.emits[0].data.n === 2);
rec = r.dispatch({ type: "tick", now: 2, data: {} });
assert("an event nobody handles does nothing", rec.actions.length === 0 && rec.logs.length === 0);

log.section("C4: a throwing handler");
r = rule(`(on, v) => { on("tab", () => { throw new Error("bad"); }); on("tab", () => v.log("second")); }`);
rec = r.dispatch({ type: "tab", now: 1, data: {} });
assert("its error is logged", rec.logs.some((l) => l.level === "error" && /tab handler: bad/.test(l.args[0])));
assert("the next handler still runs", rec.logs.some((l) => l.args[0] === "second"));

log.section("C5: the time limit");
let clock = 0;
r = rule(`(on, v) => { on("tick", () => { for (let i = 0; i < 10; i++) v.log(i); }); }`, { now: () => (clock += 400) });
rec = r.dispatch({ type: "tick", now: 1, data: {} });
assert("a handler past its time is stopped and marked overrun", rec.overrun === true && rec.logs.some((l) => /longer than/.test(String(l.args[0]))));

log.section("C6: limits per event");
r = rule(`(on, v) => { on("tick", () => { for (let i = 0; i < 1000; i++) { v.log(i); v.item(1, "r" + i, "hide"); v.emit("e"); } }); }`);
rec = r.dispatch({ type: "tick", now: 1, data: {} });
assert("actions are capped", rec.actions.length === R.LIMITS.actionsPerDispatch);
assert("logs are capped", rec.logs.length === R.LIMITS.logsPerDispatch);
assert("emits are capped", rec.emits.length === R.LIMITS.emitsPerDispatch);

log.section("C7: state");
r = rule(`(on, v) => { on("tick", () => { v.state.n = (v.state.n || 0) + 1; }); }`, { state: { n: 5 } });
assert("an unchanged state is not reported", r.takeState() === undefined);
r.dispatch({ type: "tick", now: 1, data: {} });
assert("a changed state is reported once", r.takeState().n === 6 && r.takeState() === undefined);
r = rule(`(on, v) => { on("tick", () => { v.state = { big: "x".repeat(70000) }; }); }`);
r.dispatch({ type: "tick", now: 1, data: {} });
assert("an oversized state is refused", /at most/.test((r.takeState() || {}).error || ""));
r = rule(`(on, v) => { v.state = 5; on("tick", () => {}); }`);
assert("a non-object state becomes {}", JSON.stringify(r.takeState() ?? {}) === "{}");

log.section("C8: panels");
r = rule(`(on, v) => {
  v.panel("p", { title: "Hi", position: "nowhere", controls: [{ id: "b", type: "button", label: "Go" }, { id: "t", type: "timer" }] });
  on("panel", (ev) => { if (ev.data.controlId === "b") v.panel("p", null); });
}`);
let panels = r.takePanels();
assert("a panel is reported with its group", panels.length === 1 && panels[0].groupId === "g1" && panels[0].title === "Hi");
assert("an unknown position falls back", panels[0].position === "bottom-right");
assert("an unknown control type shows as text", panels[0].controls.length === 2 && panels[0].controls[1].type === "text");
assert("unchanged panels are not reported again", r.takePanels() === null);
r.dispatch({ type: "panel", now: 1, data: { panelId: "p", controlId: "b", eventName: "click" } });
assert("v.panel(id, null) removes it", JSON.stringify(r.takePanels()) === "[]");
r = rule(`(on, v) => { v.panel("p", { controls: [{ id: "h", type: "html", html: '<a href="javascript:alert(1)">x</a><script>x</script>' }] }, 4); }`);
panels = r.takePanels();
assert("a tab's panel keeps its tab", panels[0].tabId === 4);
assert("html is sanitized", !/javascript:|<script/i.test(panels[0].controls[0].html || ""));

log.section("C9: files");
r = rule(`(on, v) => { on("tick", () => { v.state.id = v.file("read", "notes.txt"); }); }`);
rec = r.dispatch({ type: "tick", now: 1, data: {} });
assert("v.file queues a request with its id", rec.actions.length === 1 && rec.actions[0].kind === "file" && rec.actions[0].op === "read" && rec.actions[0].requestId === r.takeState().id);

log.section("C10: the frozen action set");
r = rule(`(on, v) => { on("tick", () => { v.extra = 1; v.log(typeof v.extra, typeof v.getPlatformHelper); }); }`);
rec = r.dispatch({ type: "tick", now: 1, data: {} });
assert("v can't be extended and has no helpers", rec.logs.some((l) => l.args[0] === "undefined" && l.args[1] === "undefined"));

log.section("C11: the reference an AI writes from");
const browserRef = R.reference("browser");
const macRef = R.reference("mac");
assert("both references share the contract", /\(on, v\) =>/.test(browserRef) && /\(on, v\) =>/.test(macRef));
assert("the browser's lists browser actions only", /v\.item/.test(browserRef) && !/v\.block/.test(browserRef));
assert("Mac Vault's lists app actions only", /v\.block/.test(macRef) && !/v\.item|v\.cover|v\.css/.test(macRef));
assert("neither mentions helpers", !/helpers\.\w/.test(browserRef + macRef));

const counts = log.counts();
log.summary("─".repeat(60));
log.summary(`pass=${counts.pass} fail=${counts.fail}`);
if (counts.fail > 0) {
  log.summary("FAILED");
  print("__CB_TEST_RESULT__: FAILED");
} else {
  log.summary("OK");
  print("__CB_TEST_RESULT__: OK");
}
