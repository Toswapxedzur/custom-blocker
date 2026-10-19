"use strict";
// Execute the published timer example with actual panel focus/blur/click events.
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.join(__dirname,".."),manual=fs.readFileSync(path.join(root,"code-manual/en.md"),"utf8");
const example=[...manual.matchAll(/```js\n([\s\S]*?)\n```/g)].map(x=>x[1]).find(x=>x.includes('v.timer("focus"'));
assert(example,"Published managed timer example missing");
let now=1800000000000;
const FakeDate=class extends Date {constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
const c=vm.createContext({Date:FakeDate,console});vm.runInContext(fs.readFileSync(path.join(root,"rule-core.js"),"utf8"),c);
const engine=c.RuleCore.createEngine();const loaded=engine.load("manual",example,{});assert(loaded.ok);
const clone=x=>JSON.parse(JSON.stringify(x));let state=clone(loaded.states.manual);
function panel(controlId,eventName,elapsed){now+=elapsed;const r=engine.dispatch({type:"panel",targetGroupId:"manual",now,data:{panelId:"focus",controlId,eventName}});assert.equal(r.diagnostics.length,0);if(r.states.manual)state=clone(r.states.manual);return state.$vaultTime.objects.focus;}
assert.equal(panel("start","focus",0).startedAtMs,null,"Focus must not start the timer");
const start=panel("start","click",0).startedAtMs;assert.equal(start,now);
assert.equal(panel("reset","blur",1000).startedAtMs,start,"Blur of Reset must not reset running time");
const paused=panel("pause","click",1000);assert.equal(paused.elapsedMs,2000);assert.equal(paused.startedAtMs,null);
assert.equal(panel("start","focus",1000).startedAtMs,null,"Focus must not resume a paused timer");
assert.equal(panel("reset","key",1000).elapsedMs,2000,"Key metadata must not reset the timer");
const reset=panel("reset","click",0);assert.equal(reset.elapsedMs,0);assert.equal(reset.startedAtMs,null);
console.log("PASS actual published timer example ignores focus/blur/key and runs only real click controls");
console.log("__CB_TEST_RESULT__: OK");
