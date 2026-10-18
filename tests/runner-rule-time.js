"use strict";
const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict"), path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../rule-core.js"), "utf8");
let at = 1800000000000, passed = 0;
const FakeDate = class extends Date { constructor(...args) { super(...(args.length ? args : [at])); } static now() { return at; } };
const context = vm.createContext({ Date: FakeDate, console }); vm.runInContext(source, context);
const core = context.RuleCore;
const clone = x => JSON.parse(JSON.stringify(x));
const memory = new Map(); let engine = core.createEngine();
function load(id, text, saved = memory.get(id) || {}) {
  const result = engine.load(id, text, saved); if (result.ok) retain(result); return result;
}
function retain(result) { for (const [id, state] of Object.entries(result.states || {})) memory.set(id, clone(state)); }
function send(id, type = "tick", data = {}, delta = 0) {
  at += delta; const result = engine.dispatch({ type, now: at, data, targetGroupId: id }); retain(result); return result;
}
function test(label, run) { run(); ++passed; console.log("PASS " + label); }
const timerRule = `(on,v)=>{
  const timer=v.timer("focus",{direction:"down",durationMs:10000});
  const up=v.timer("elapsed",{direction:"up"});
  v.panel("clock",{controls:[{id:"remaining",type:"timer",timerId:"focus",label:"Focus"},{type:"section",controls:[{id:"up",type:"timer",timerId:"elapsed"}]}]});
  on("control", ev=>{if(ev.data.op==="reset")timer.reset();else if(ev.data.op==="remove")v.removeTime("focus");else timer[ev.data.op]();});
  on("countUp", ev=>up[ev.data.op]());
  on("tick",()=>{v.state.timer=timer.snapshot();v.state.up=up.snapshot();});
  on("timerEnded",ev=>{v.state.ends=(v.state.ends||0)+1;v.state.endedID=ev.data.id;});
}`;
test("named countdown starts paused and publishes an existing text control",()=>{
 const r=load("timers",timerRule);assert.equal(r.ok,true,r.error);assert(r.types.includes("tick"));
 assert.equal(r.panels[0].controls[0].type,"text");assert.equal(r.panels[0].controls[0].text,"Focus 0:10");
 send("timers");assert.equal(memory.get("timers").timer.running,false);
});
test("start is idempotent; pause/resume preserve elapsed time",()=>{
 send("timers","control",{op:"start"});send("timers","tick",{},3000);assert.equal(memory.get("timers").timer.remainingMs,7000);
 send("timers","control",{op:"start"});send("timers","tick",{},1000);assert.equal(memory.get("timers").timer.remainingMs,6000);
 send("timers","control",{op:"pause"});send("timers","tick",{},50000);assert.equal(memory.get("timers").timer.remainingMs,6000);
 send("timers","control",{op:"resume"});send("timers","tick",{},2000);assert.equal(memory.get("timers").timer.remainingMs,4000);
});
test("countdown ends once, reaches zero, and reset cancels the old completion",()=>{
 const r=send("timers","tick",{},5000);assert.equal(memory.get("timers").ends,1);assert.equal(memory.get("timers").timer.remainingMs,0);assert.equal(memory.get("timers").endedID,"focus");
 assert.equal(r.panels.timers[0].controls[0].text,"Focus 0:00");
 send("timers","tick",{},5000);assert.equal(memory.get("timers").ends,1);
 send("timers","control",{op:"reset"});send("timers");assert.equal(memory.get("timers").timer.remainingMs,10000);assert.equal(memory.get("timers").timer.running,false);
});
test("count-up supports pause/reset and does not emit countdown completion",()=>{
 send("timers","countUp",{op:"start"});send("timers","tick",{},65000);assert.equal(memory.get("timers").up.elapsedMs,65000);
 send("timers","countUp",{op:"pause"});send("timers","tick",{},2000);assert.equal(memory.get("timers").up.elapsedMs,65000);
 send("timers","countUp",{op:"reset"});send("timers");assert.equal(memory.get("timers").up.elapsedMs,0);assert.equal(memory.get("timers").ends,1);
});
test("Run and a fresh engine preserve timers, including elapsed time while closed",()=>{
 send("timers","control",{op:"start"});send("timers","tick",{},1000);
 assert.equal(load("timers",timerRule).ok,true);send("timers");assert.equal(memory.get("timers").timer.remainingMs,9000);
 engine=core.createEngine();at+=20000;assert.equal(load("timers",timerRule).ok,true);send("timers");assert.equal(memory.get("timers").ends,2);
 send("timers");assert.equal(memory.get("timers").ends,2);
});
test("disabled timers keep wall-clock time and deliver completion after re-enable",()=>{
 send("timers","control",{op:"reset"});send("timers","control",{op:"start"});engine.suppress("timers",true);
 send("timers","tick",{},20000);assert.equal(memory.get("timers").ends,2);
 engine.suppress("timers",false);send("timers");assert.equal(memory.get("timers").ends,3);
});
const trackerRule=`(on,v)=>{
 const shared=v.rolling("leisure",{windowMs:120000,limitMs:6000});shared.assign({websites:["youtube.com","reddit.com"],apps:["org.example.game"]});
 const other=v.rolling("separate",{windowMs:120000,limitMs:2000});other.assign({websites:["reddit.com"]});
 on("tick",()=>{v.state.shared=shared.snapshot();v.state.other=other.snapshot();v.state.site=shared.available("youtube.com");v.state.unassigned=shared.available("example.org");});
 on("clear",()=>shared.reset());
}`;
test("multiple targets share one allowance and overlapping browser intervals count once",()=>{
 at=Math.ceil(at/60000)*60000;assert.equal(load("trackers",trackerRule).ok,true);at+=1000;
 send("trackers","visible",{url:"https://www.youtube.com/watch",elapsedMs:1000});
 send("trackers","visible",{url:"https://reddit.com/r/test",elapsedMs:1000});send("trackers");
 assert.equal(memory.get("trackers").shared.usedMs,1000);assert.equal(memory.get("trackers").other.usedMs,1000);
 send("trackers","visible",{url:"https://reddit.com",elapsedMs:2000},2000);send("trackers");
 assert.equal(memory.get("trackers").shared.usedMs,3000);assert.equal(memory.get("trackers").other.usedMs,2000);
 assert.equal(memory.get("trackers").site,true);assert.equal(memory.get("trackers").unassigned,false);
});
test("native observed foreground usage shares that same tracker budget",()=>{
 send("trackers","tick",{usageAppId:"org.example.game",elapsedMs:2000},2000);assert.equal(memory.get("trackers").shared.usedMs,5000);
 send("trackers","tick",{usageAppId:"org.example.game",elapsedMs:2000},2000);assert.equal(memory.get("trackers").shared.usedMs,6000);assert.equal(memory.get("trackers").shared.available,false);
});
test("hidden/blocked/unknown targets do not accrue and heartbeat amounts are bounded",()=>{
 send("trackers","clear");send("trackers","visible",{url:"https://youtube.com.evil.example",elapsedMs:5000},5000);send("trackers");assert.equal(memory.get("trackers").shared.usedMs,0);
 send("trackers","tick",{frontmost:{appId:"org.example.game"},elapsedMs:5000},5000);assert.equal(memory.get("trackers").shared.usedMs,0);
 send("trackers","visible",{url:"https://youtube.com",elapsedMs:999999},5000);send("trackers");assert.equal(memory.get("trackers").shared.usedMs,5000);
});
test("ordinary minute-bucket expiry restores allowance without a fixed reset",()=>{
 const state=memory.get("trackers");const bucket=Object.keys(state.$vaultTime.objects.leisure.bucketsMs)[0];
 at=Number(bucket)+60000+120000-1;send("trackers");assert.equal(memory.get("trackers").shared.usedMs,5000);
 at++;send("trackers");assert.equal(memory.get("trackers").shared.usedMs,0);assert.equal(memory.get("trackers").shared.available,true);
});
test("disabled/restarted rules do not manufacture usage during the gap",()=>{
 engine.suppress("trackers",true);send("trackers","visible",{url:"https://youtube.com",elapsedMs:5000},5000);
 engine.suppress("trackers",false);send("trackers","visible",{url:"https://youtube.com",elapsedMs:5000});send("trackers");assert.equal(memory.get("trackers").shared.usedMs,0);
 engine=core.createEngine();assert.equal(load("trackers",trackerRule).ok,true);send("trackers","visible",{url:"https://youtube.com",elapsedMs:5000});send("trackers");assert.equal(memory.get("trackers").shared.usedMs,0);
});
test("configuration collisions and unsupported saved formats refuse replacement",()=>{
 const before=clone(memory.get("trackers"));const bad=load("trackers",trackerRule.replace("limitMs:6000","limitMs:7000"));assert.equal(bad.ok,false);assert.deepEqual(memory.get("trackers"),before);
 for(const state of [{$vaultTime:{version:2,objects:{}}},{$vaultTime:"user field"}]) {const r=load("bad","(on,v)=>v.timer(\"x\",{durationMs:100})",state);assert.equal(r.ok,false);}
});
test("invalid durations, names, targets and object exhaustion are explicit errors",()=>{
 for(const expression of ["v.timer('x',{durationMs:0})","v.timer('x',{durationMs:Infinity})","v.timer('bad id',{durationMs:1})","v.rolling('x',{windowMs:-1,limitMs:1})","v.rolling('x',{windowMs:1000,limitMs:1}).assign({websites:['https://example.org/path']})","for(let i=0;i<33;i++)v.timer('t'+i,{durationMs:1})"]) assert.equal(load("invalid",`(on,v)=>{${expression}}`,{}).ok,false,expression);
});
test("a timer created by an event requests future host ticks",()=>{
 assert.equal(load("dynamic",`(on,v)=>{on("create",()=>{v.timer("later",{durationMs:100}).start();});on("timerEnded",()=>v.state.done=true);}`).ok,true);
 const r=send("dynamic","create");assert(r.types.dynamic.includes("tick"));send("dynamic","tick",{},101);assert.equal(memory.get("dynamic").done,true);
});
test("a full rolling history fails closed instead of ignoring new observed usage",()=>{
 at=Math.ceil(at/60000)*60000;
 const from=at-1024*60000, buckets={};for(let t=from;t<at;t+=60000)buckets[t]=60000;
 const saved={$vaultTime:{version:1,objects:{full:{kind:"rolling",windowMs:31536000000,limitMs:31536000000,websites:["example.org"],apps:[],bucketsMs:buckets,segments:[[from,at]],accruedUntilMs:at,resetAtMs:from,fault:false}}}};
 assert(load("full",`(on,v)=>{const r=v.rolling("full",{windowMs:31536000000,limitMs:31536000000});on("tick",()=>v.state.status=r.snapshot());on("reset",()=>r.reset());}`,saved).ok);
 send("full","visible",{url:"https://example.org",elapsedMs:1000},1000);send("full");
 assert.equal(memory.get("full").status.available,false,"usage capacity failure must not leave allowance available");
 assert.equal(memory.get("full").status.error,"rolling-history-capacity");
 engine=core.createEngine();assert(load("full",`(on,v)=>{const r=v.rolling("full",{windowMs:31536000000,limitMs:31536000000});on("tick",()=>v.state.status=r.snapshot());on("reset",()=>r.reset());}`).ok);send("full");assert.equal(memory.get("full").status.available,false);
 send("full","reset");send("full");assert.equal(memory.get("full").status.available,true);
});
test("unpersistable event state cannot deliver completion actions",()=>{
 const e=core.createEngine(act=>({close:tabId=>act("close",{tabId})}));
 assert(e.load("overflow",`(on,v)=>{const t=v.timer("clock",{durationMs:1});t.start();on("timerEnded",()=>{v.state.overflow="x".repeat(70000);v.close(1);});}`,{}).ok);
 at+=2;const result=e.dispatch({type:"tick",targetGroupId:"overflow",now:at,data:{}});
 assert.deepEqual(Array.from(result.stateFailures),["overflow"]);assert.equal(result.actions.length,0);assert.equal(result.states.overflow,undefined);
});
test("user-emitted visibility events cannot manufacture recorded time",()=>{
 const e=core.createEngine();const loaded=e.load("fabrication",`(on,v)=>{const r=v.rolling("actual",{windowMs:120000,limitMs:10000});r.assign({websites:["example.org"]});on("fabricate",()=>v.emit("visible",{url:"https://example.org",elapsedMs:5000}));on("visible",()=>v.state.status=r.snapshot());}`,{});assert(loaded.ok);
 at+=5000;const r=e.dispatch({type:"fabricate",now:at,targetGroupId:"fabrication",data:{}});assert.equal(r.states.fabrication.status.usedMs,0);
});
console.log(JSON.stringify({pass:true,cases:passed}));
