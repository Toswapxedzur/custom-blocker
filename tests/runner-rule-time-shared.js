"use strict";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
let now=1800000000000, cases=0;
const FakeDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
const ctx=vm.createContext({Date:FakeDate,console});vm.runInContext(fs.readFileSync(path.join(__dirname,"../rule-core.js"),"utf8"),ctx);
const core=ctx.RuleCore, clone=x=>JSON.parse(JSON.stringify(x));
const test=(name,fn)=>{fn();cases++;console.log("PASS "+name);};
const source=site=>`(on,v)=>{const r=v.rolling("shared",{windowMs:120000,limitMs:10000});r.assign({websites:["${site}"]});const t=v.timer("clock",{durationMs:10000});on("start",()=>t.start());on("reset",()=>t.reset());on("tick",()=>{v.state.status=r.snapshot();v.state.timer=t.snapshot();});on("timerEnded",()=>{v.state.ends=(v.state.ends||0)+1;});}`;
function member(id,site,saved={}){const engine=core.createEngine();let state=clone(saved);const remember=r=>{if(r.states?.[id])state=clone(r.states[id]);return r;};const load=()=>remember(engine.load(id,source(site),state));assert(load().ok);return {id,site,engine,load,get state(){return state;},send(type="tick",data={}){return remember(engine.dispatch({targetGroupId:id,type,now,data}));},context(context){return engine.setTimeContext(id,context);}};}
const a=member("a","youtube.com"),b=member("b","reddit.com");
now+=3000;a.send("visible",{url:"https://youtube.com",elapsedMs:3000});b.send("visible",{url:"https://reddit.com",elapsedMs:3000});
a.send("start");
let shared;
test("link unions overlapping original usage and target assignments, preserving initiating timer",()=>{
 const r=core.mergeTime(null,[{member:"chrome/a",state:a.state.$vaultTime},{member:"safari/b",state:b.state.$vaultTime}],"chrome/a",now);assert(r.ok,r.error);shared=clone(r.state);
 const t=shared.objects.shared;assert.equal(Object.values(t.bucketsMs).reduce((a,b)=>a+b,0),3000);assert.deepEqual(new Set(t.websites),new Set(["youtube.com","reddit.com"]));assert.equal(shared.objects.clock.startedAtMs,now);assert.equal(shared.objects.clock.incarnation,a.state.$vaultTime.objects.clock.incarnation);
});
test("incompatible same-ID configurations refuse link without mutating either seed",()=>{
 const bad=clone(b.state.$vaultTime);bad.objects.shared.limitMs=9999;const before=clone(shared);
 const r=core.mergeTime(shared,[{member:"edge/c",state:bad}],"chrome/a",now);assert.equal(r.ok,false);assert.match(r.error,/Incompatible/);assert.deepEqual(shared,before);
});
function reduce(member,commands=[],usage=null){const r=core.reduceTime(shared,{member,commands,usage,nowMs:now});assert(r.ok,r.error);shared=clone(r.state);return r;}
function adopt(m,program){const key=program+"/"+m.id;assert(m.context({linked:true,clusterId:"cluster-one",ready:true,state:shared,acknowledgedSerial:shared.receipts[key]||0}).ok);m.send();const commands=m.state.$vaultTime.pending||[];if(commands.length){reduce(key,commands);assert(m.context({linked:true,clusterId:"cluster-one",ready:true,state:shared,acknowledgedSerial:shared.receipts[key]||0}).ok);m.send();}}
test("member declarations adopt one authoritative allowance and timer",()=>{adopt(a,"chrome");adopt(b,"safari");assert.equal(a.state.status.usedMs,3000);assert.equal(b.state.status.usedMs,3000);assert.equal(a.state.timer.remainingMs,b.state.timer.remainingMs);});
test("concurrent and out-of-order browser intervals are unioned, never summed twice",()=>{
 now+=3000;reduce("chrome/a",[],{type:"visible",now,data:{url:"https://youtube.com",elapsedMs:3000}});reduce("safari/b",[],{type:"visible",now,data:{url:"https://reddit.com",elapsedMs:3000}});
 reduce("chrome/a",[],{type:"visible",now:now-1000,data:{url:"https://youtube.com",elapsedMs:3000}});adopt(a,"chrome");adopt(b,"safari");assert.equal(a.state.status.usedMs,6000);assert.equal(b.state.status.usedMs,6000);
});
test("control acknowledgments survive lost replies and repeated commands",()=>{
 const command={id:"clock",op:"reset",serial:(shared.receipts["chrome/a"]||0)+1,atMs:now};reduce("chrome/a",[command]);const generation=shared.objects.clock.generation;
 reduce("chrome/a",[command]);assert.equal(shared.objects.clock.generation,generation);
});
test("offline shared availability fails closed and timer control is rejected",()=>{
 assert(a.context({linked:true,clusterId:"cluster-one",ready:false}).ok);a.send();assert.equal(a.state.status.available,false);assert.equal(a.state.status.ready,false);
 const r=a.send("start");assert(r.diagnostics.some(d=>d.args.some(x=>/fresh hub/.test(x))));
});
test("fresh reconnect restores availability and controls without a private allowance",()=>{
 adopt(a,"chrome");assert.equal(a.state.status.usedMs,6000);a.send("start");assert(a.state.$vaultTime.pending.length);reduce("chrome/a",a.state.$vaultTime.pending);adopt(a,"chrome");adopt(b,"safari");assert.equal(a.state.timer.running,true);assert.equal(b.state.timer.running,true);
});
test("every linked member receives completion once for the same timer run",()=>{
 now+=11000;reduce("chrome/a");adopt(a,"chrome");adopt(b,"safari");assert.equal(a.state.ends,1);assert.equal(b.state.ends,1);adopt(a,"chrome");adopt(b,"safari");assert.equal(a.state.ends,1);assert.equal(b.state.ends,1);
});
test("unlink retains current usage and restores the member's own assigned targets",()=>{
 assert(b.context({linked:false}).ok);b.send();assert.equal(b.state.status.usedMs,6000);assert.deepEqual(b.state.$vaultTime.objects.shared.websites,["reddit.com"]);
});
test("malformed commands and newer shared formats preserve authoritative state",()=>{
 const before=clone(shared);
 for(const request of [{member:"chrome/a",commands:[{id:"clock",op:"reset",serial:-1,atMs:now}],nowMs:now},{member:"chrome/a",commands:[{id:"clock",op:"run",serial:999,atMs:now}],nowMs:now}])assert.equal(core.reduceTime(shared,request).ok,false);
 assert.equal(core.mergeTime({...shared,version:2},[],"",now).ok,false);assert.deepEqual(shared,before);
});
test("fresh-seed join barrier defers commands until every member confirms",()=>{
 const c=member("c","youtube.com"),d=member("d","reddit.com");
 const base={member:"chrome/c",members:["chrome/c","safari/d"],initiator:"chrome/c",seeds:[{member:"chrome/c",state:c.state.$vaultTime},{member:"safari/d",state:d.state.$vaultTime}],seed:c.state.$vaultTime,commands:[{id:"clock",op:"reset",serial:1,atMs:now}],nowMs:now};
 const first=core.syncTime(null,base);assert(first.ok,first.error);assert.equal(first.ready,false);assert.equal(first.acknowledgedSerial,0);assert.equal(first.state.objects.clock.generation,0);
 const second=core.syncTime(first.state,{...base,member:"safari/d",seed:d.state.$vaultTime,commands:[]});assert(second.ok,second.error);assert.equal(second.ready,true);
 const final=core.syncTime(second.state,base);assert(final.ok,final.error);assert.equal(final.acknowledgedSerial,1);assert.equal(final.state.objects.clock.generation,1);
 const read=core.syncTime(final.state,{...base,commands:[]});assert(read.ok,read.error);assert.equal(read.state.revision,final.state.revision);
});
test("shared history capacity is persistent and unavailable to every member",()=>{
 const at=Math.ceil(now/60000)*60000,from=at-1024*60000,buckets={};for(let t=from;t<at;t+=60000)buckets[t]=60000;
 const state={version:1,objects:{full:{kind:"rolling",windowMs:31536000000,limitMs:31536000000,websites:["example.org"],apps:[],bucketsMs:buckets,segments:[[from,at]],accruedUntilMs:at,resetAtMs:from,fault:false}},receipts:{},targets:{},revision:0};
 const result=core.reduceTime(state,{member:"chrome/a",commands:[],usage:{type:"visible",now:at+1000,data:{url:"https://example.org",elapsedMs:1000}},nowMs:at+1000});assert(result.ok,result.error);assert.equal(result.state.objects.full.fault,true);
 const second=core.reduceTime(result.state,{member:"safari/b",commands:[],nowMs:at+1000});assert(second.ok,second.error);assert.equal(second.state.objects.full.fault,true);
 const reset=core.reduceTime(second.state,{member:"safari/b",commands:[{id:"full",op:"reset",serial:1,atMs:at+1000}],nowMs:at+1000});assert(reset.ok,reset.error);assert.equal(reset.state.objects.full.fault,false);
});
test("reserved property names cannot corrupt object maps",()=>{
 for(const id of ["__proto__","prototype","constructor"]){const e=core.createEngine();assert.equal(e.load("bad",`(on,v)=>v.timer("${id}",{durationMs:1})`,{}).ok,false);}
});
console.log(JSON.stringify({pass:true,cases}));
