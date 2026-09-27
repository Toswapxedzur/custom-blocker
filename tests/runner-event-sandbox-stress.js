/* The browser's custom-rule engine (event-sandbox.js on rule-core.js). */

globalThis.self = globalThis;
globalThis.window = globalThis;
window.parent = window;
window.postMessage = function () {};
window.addEventListener = function () {};

load("rule-core.js");
load("event-sandbox.js");
load("tests/log.js");

const log = globalThis.__cbTestLog.makeLogger({ colour: true });

function assert(name, condition, data) {
  if (condition) log.pass(name, data);
  else log.fail(name, data);
}

const loadSource = (groupId, source, state) => engine.load(groupId, source, state);
const send = (type, data, targetGroupId) => engine.dispatch({ type, now: 1_800_000_000_000, data, targetGroupId });

log.section("E1: a rule sees raw events and answers with browser actions");
let loaded = loadSource("shorts", `(on, v) => {
  on("tab", (ev) => { if (/youtube\\.com\\/shorts\\//.test(ev.data.url)) v.cover(ev.data.tabId, true, "No Shorts"); });
}`, {});
assert("E1 loads with its types", loaded.ok && loaded.handlers === 1 && loaded.types.join() === "tab");
let result = send("tab", { kind: "navigate", tabId: 3, url: "https://m.youtube.com/shorts/abc" });
assert("E1 a Shorts address is covered", result.actions.length === 1 && result.actions[0].kind === "cover" && result.actions[0].tabId === 3 && result.actions[0].message === "No Shorts");
result = send("tab", { kind: "navigate", tabId: 3, url: "https://www.youtube.com/watch?v=abc" });
assert("E1 a watch page is not", result.actions.length === 0);

log.section("E2: the browser's actions are checked");
loadSource("acts", `(on, v) => {
  on("tick", () => {
    v.item(1, "i1", "hide"); v.item(1, "i2", "bogus"); v.item("x", "i3", "hide");
    v.css("*", "s", "a{}"); v.css(2, "s", null);
    v.dom(1, "#x", "click"); v.dom(1, "#x", "remove");
    v.go(1, "back"); v.close(1);
  });
}`, {});
result = send("tick", { tabs: [] }, "acts");
const kinds = result.actions.map((a) => a.kind + ":" + (a.verdict ?? a.op ?? a.target ?? a.css ?? ""));
assert("E2 a verdict outside hide/dim/allow clears", result.actions[1].kind === "item" && result.actions[1].verdict === null);
assert("E2 a non-tab id is ignored", !result.actions.some((a) => a.ref === "i3"));
assert("E2 css to every page and removal are kept", result.actions.some((a) => a.kind === "css" && a.tabId === "*") && result.actions.some((a) => a.kind === "css" && a.css === null));
assert("E2 an unknown element op is ignored", !kinds.includes("dom:remove") && kinds.includes("dom:click"));
assert("E2 go and close are kept", kinds.includes("go:back") && result.actions.some((a) => a.kind === "close"));
assert("E2 Mac Vault's actions don't exist here", loadSource("mac", `(on, v) => { v.block("com.x", true); }`, {}).ok === false);

log.section("E3: one event reaches every rule that handles it, or one group");
loadSource("a", `(on, v) => { on("visible", () => v.log("a")); }`, {});
loadSource("b", `(on, v) => { on("visible", () => v.log("b")); }`, {});
result = send("visible", { tabId: 1, elapsedMs: 250 });
assert("E3 both groups ran", result.logs.map((l) => l.args[0]).sort().join() === "a,b");
result = send("visible", { tabId: 1, elapsedMs: 250 }, "b");
assert("E3 a target group runs alone", result.logs.map((l) => l.args[0]).join() === "b");

log.section("E4: emits follow, bounded");
loadSource("loop", `(on, v) => { on("ping", (ev) => { v.state.n = (v.state.n || 0) + 1; v.emit("ping"); }); }`, {});
result = send("ping", null, "loop");
assert("E4 an emit loop stops after 16 rounds", result.states.loop && result.states.loop.n === 17);

log.section("E5: state and panels come back only when changed");
loaded = loadSource("st", `(on, v) => { v.panel("p", { title: "T" }); on("tick", () => { v.state.t = 1; }); }`, { t: 0 });
assert("E5 the panel set at registration comes with the load", loaded.panels.length === 1 && loaded.panels[0].groupId === "st");
result = send("tick", {}, "st");
assert("E5 the changed state is reported", result.states.st && result.states.st.t === 1);
result = send("tick", {}, "st");
assert("E5 nothing changed, nothing reported", !result.panels.st && !result.states.st);

log.section("E6: a rule that doesn't load leaves the old one running");
loadSource("keep", `(on, v) => { on("tick", () => v.log("old")); }`, {});
loaded = loadSource("keep", `(on, v) => { on("tick", `, {});
assert("E6 the compile error is reported", loaded.ok === false && /Compile failed/.test(loaded.error));
result = send("tick", {}, "keep");
assert("E6 the old rule still runs", result.logs.some((l) => l.args[0] === "old"));
loaded = loadSource("keep", "", {});
result = send("tick", {}, "keep");
assert("E6 an empty source removes it", loaded.ok && loaded.handlers === 0 && result.logs.length === 0);

log.section("E7: a rule over its time three times in a minute is quarantined");
let calls = 0;
const realNow = Date.now;
loadSource("slow", `(on, v) => { on("tick", () => { for (let i = 0; i < 5; i++) v.log(i); }); }`, {});
Date.now = () => realNow() + (calls++) * 600;
let quarantine = null;
for (let i = 0; i < 3 && !quarantine; i++) quarantine = send("tick", {}, "slow").quarantine;
Date.now = realNow;
assert("E7 quarantined", quarantine && quarantine.groupId === "slow" && quarantine.reason === "deadline-overrun");

log.section("E8: v.query reads a page; its answer comes back as an event");
loadSource("q", `(on, v) => {
  on("tab", (ev) => { v.state.id = v.query(ev.data.tabId, "#description"); v.state.none = v.query("x", "#a"); });
  on("query", (ev) => { v.state.text = ev.data.matches.map((m) => m.text).join(); });
}`, {});
result = send("tab", { kind: "navigate", tabId: 5, url: "https://www.youtube.com/watch?v=a" }, "q");
const query = result.actions.find((a) => a.kind === "query");
assert("E8 the query goes to its tab with a request id", query && query.tabId === 5 && query.selector === "#description" && query.requestId === result.states.q.id, result.actions);
assert("E8 no tab, no query", result.states.q.none === null && result.actions.filter((a) => a.kind === "query").length === 1);
result = send("query", { requestId: query.requestId, tabId: 5, selector: "#description", matches: [{ text: "about cats" }], error: "" }, "q");
assert("E8 the rule reads the answer", result.states.q.text === "about cats");

log.section("E9: a disabled group's rule stays loaded and hears nothing");
loadSource("sup", `(on, v) => { on("tick", () => { v.state.n = (v.state.n || 0) + 1; }); }`, {});
send("tick", {}, "sup");
engine.suppress("sup", true);
result = send("tick", {});
assert("E9 suppressed: no handler runs, even for a broadcast event", !result.states.sup);
result = send("tick", {}, "sup");
assert("E9 …nor for an event aimed at it", !result.states.sup);
engine.suppress("sup", false);
result = send("tick", {}, "sup");
assert("E9 enabled again: it resumes where it was (its memory kept)", result.states.sup && result.states.sup.n === 2, result.states);

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
