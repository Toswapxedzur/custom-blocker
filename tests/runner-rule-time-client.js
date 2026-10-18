"use strict";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.join(__dirname,"..");let cases=0;
const clone=x=>JSON.parse(JSON.stringify(x));
async function test(name,fn){await fn();cases++;console.log("PASS "+name);}
async function main(){
 const coreContext=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(root,"rule-core.js"),"utf8"),coreContext);const core=coreContext.RuleCore;
 const engine=core.createEngine();
 const source=`(on,v)=>{const t=v.timer("clock",{durationMs:10000});const r=v.rolling("budget",{windowMs:120000,limitMs:5000});r.assign({websites:["youtube.com"]});on("start",()=>t.start());on("tick",()=>{v.state.clock=t.snapshot();v.state.budget=r.snapshot();});}`;
 const initial=engine.load("a",source,{});assert(initial.ok,initial.error);
 const store={blockedGroups:[{id:"a",groupType:"custom",enabled:true}],cbRuleState:{a:{...clone(initial.states.a),privateField:"NEVER_TRANSMIT"}}};
 let link={id:"cluster",members:[{program:"chrome",groupId:"a"},{program:"safari",groupId:"b"}]};
 const generations=new Map([["a",1]]),sent=[],contexts=[],timers=new Map();let timerID=0,held=null,hold=false,server=null;
 const peerSeed=clone(initial.states.a.$vaultTime);
 let env, failSave=false, retired=[];
 const connection={ws:{identity:"socket-one"},ruleTimeVersion:1,desktopRouteIsReady:()=>true,sendWS(frame){sent.push(clone(frame));if(hold){held=frame;return true;}Promise.resolve().then(()=>reply(frame));return true;}};
 function reply(frame,override={}){
  if(retired.length) {
   const receipt=frame.seed?.detachedReceipt;
   const entry=receipt ? retired.find(value=>value.id===receipt.clusterId) : retired[0];
   if(entry) {
    const acknowledged=receipt?.token===entry.token;
    const result=core.detachTime(frame.seed,entry.state,"chrome/a","chrome/a",entry.id,entry.token,Date.now(),acknowledged);assert(result.ok,result.error);
    if(acknowledged)retired=retired.filter(value=>value!==entry);
    env.CBRuleTime.receive({kind:"rule-time-response",requestID:frame.requestID,groupId:frame.groupId,body:{linked:false,detached:true,clusterId:entry.id,state:result.state,relinkClusterId:env.cbClusterCopy[0]?.id||"",handoverPending:retired.some(value=>value!==entry)},...override});return;
   }
  }
  if(!env.cbClusterCopy.length) {env.CBRuleTime.receive({kind:"rule-time-response",requestID:frame.requestID,groupId:frame.groupId,body:{linked:false},...override});return;}
  let result=core.syncTime(server,{member:"chrome/a",members:["chrome/a","safari/b"],initiator:"chrome/a",seeds:[{member:"chrome/a",state:frame.seed},{member:"safari/b",state:peerSeed}],seed:frame.seed,commands:frame.commands,usage:frame.usage,nowMs:Date.now()});assert(result.ok,result.error);server=clone(result.state);
  if(!result.ready){const other=core.syncTime(server,{member:"safari/b",members:["chrome/a","safari/b"],initiator:"chrome/a",seed:peerSeed,commands:[],nowMs:Date.now()});assert(other.ok,other.error);server=clone(other.state);result=core.syncTime(server,{member:"chrome/a",members:["chrome/a","safari/b"],initiator:"chrome/a",seed:frame.seed,commands:frame.commands,nowMs:Date.now()});assert(result.ok,result.error);server=clone(result.state);}
  env.CBRuleTime.receive({kind:"rule-time-response",requestID:frame.requestID,groupId:frame.groupId,body:{linked:true,ready:true,clusterId:"cluster",state:server,acknowledgedSerial:result.acknowledgedSerial},...override});
 }
 env=vm.createContext({console,Date,URL,Map,Set,Promise,cbConnection:connection,cbRuleGenerations:generations,cbClusterCopy:[link],cbDetectProgramId:()=>"chrome",chrome:{storage:{local:{get:async()=>clone(store),set:async values=>{if(failSave)throw new Error("injected storage failure");Object.assign(store,clone(values));}}}},setTimeout(fn){timers.set(++timerID,fn);return timerID;},clearTimeout(id){timers.delete(id);},sendToEventSandbox:async payload=>{assert.equal(payload.kind,"time-context");contexts.push(clone(payload.context));return engine.setTimeContext(payload.groupId,payload.context);}});
 env.self=env;vm.runInContext(fs.readFileSync(path.join(root,"bridge-protocol.js"),"utf8"),env);vm.runInContext(fs.readFileSync(path.join(root,"rule-time-client.js"),"utf8"),env);
 async function heldRequest(){for(let attempt=0;attempt<20&&!held;attempt++)await new Promise(setImmediate);assert(held,"bounded request entry");}
 function persist(type="tick") {const r=engine.dispatch({type,now:Date.now(),targetGroupId:"a",data:{}});if(r.states.a)store.cbRuleState.a=clone(r.states.a);return r;}
 await test("client sends only reserved time data through the authenticated route",async()=>{await env.CBRuleTime.configureGroup("a");persist();assert(!JSON.stringify(sent).includes("NEVER_TRANSMIT"));assert.equal(store.cbRuleState.a.budget.ready,true);assert.equal(contexts.at(-1).clusterId,"cluster");});
 await test("controls persist first and flush with stable scoped serials",async()=>{persist("start");const command=clone(store.cbRuleState.a.$vaultTime.pending[0]);assert.equal(command.scope,"cluster");assert.equal(command.op,"resume");await env.CBRuleTime.configureGroup("a");persist();assert.equal(store.cbRuleState.a.$vaultTime.pending.length,0);assert.equal(store.cbRuleState.a.clock.running,true);});
 await test("socket loss promptly makes shared availability fail closed",async()=>{hold=true;const waiting=env.CBRuleTime.configureGroup("a");await heldRequest();connection.ws={identity:"socket-two"};env.CBRuleTime.disconnect();await waiting;persist();assert.equal(store.cbRuleState.a.budget.available,false);assert.equal(timers.size,0);reply(held);assert.equal(contexts.at(-1).ready,false);});
 await test("older native capability cannot fork a linked local allowance",async()=>{hold=false;connection.ruleTimeVersion=0;await env.CBRuleTime.configureGroup("a");persist();assert.equal(store.cbRuleState.a.budget.available,false);const r=persist("start");assert(r.diagnostics.some(d=>JSON.stringify(d).includes("fresh hub")));});
 await test("fresh supported reconnect recovers the same authoritative timer",async()=>{connection.ruleTimeVersion=1;await env.CBRuleTime.configureGroup("a");persist();assert.equal(store.cbRuleState.a.clock.running,true);assert.equal(store.cbRuleState.a.budget.ready,true);});
 await test("wrong-group responses cannot resolve another group's request",async()=>{hold=true;held=null;const waiting=env.CBRuleTime.configureGroup("a");await heldRequest();const before=contexts.length;reply(held,{groupId:"different"});await Promise.resolve();assert.equal(contexts.length,before);reply(held);await waiting;assert.equal(contexts.length,before+1);});
 await test("source generation changes reject an in-flight context reply",async()=>{held=null;const waiting=env.CBRuleTime.configureGroup("a");await heldRequest();const before=contexts.length;generations.set("a",2);reply(held);await waiting;assert.equal(contexts.length,before);});
 await test("request deadline retains fail-closed state and clears its resources",async()=>{held=null;const waiting=env.CBRuleTime.configureGroup("a");await heldRequest();for(const fn of [...timers.values()])fn();await waiting;persist();assert.equal(timers.size,0);assert.equal(store.cbRuleState.a.budget.available,false);});
 await test("roster preflight strips usage history without exposing other rule fields",async()=>{const seed=env.CBRuleTime.seedForRoster(store.cbRuleState.a);assert.equal(seed.objects.budget.segments.length,0);assert(!JSON.stringify(seed).includes("NEVER_TRANSMIT"));assert(env.CBRuleTime.configurationKey(store.cbRuleState.a).includes("budget"));});
 await test("usage transport strips paths, queries, fragments and native-only fields",async()=>{
  hold=false;connection.ruleTimeVersion=1;
  await env.CBRuleTime.configureGroup("a",{type:"visible",now:Date.now(),data:{url:"https://www.youtube.com/watch?v=PRIVATE_VIDEO#PRIVATE_FRAGMENT",elapsedMs:1,usageAppId:"PRIVATE_APP",title:"PRIVATE_TITLE"}});
  const sample=sent.at(-1).usage;assert.deepEqual(Object.keys(sample.data).sort(),["elapsedMs","url"]);assert.equal(sample.data.url,"https://www.youtube.com");assert(!JSON.stringify(sample).includes("PRIVATE"));
 });
 await test("final transfer is saved before ACK and retains unrelated rule data",async()=>{
  persist();store.cbRuleState.a.privateField="NEVER_TRANSMIT";retired=[{id:"cluster",token:"final-one",state:clone(server)}];
  env.CBRuleTime.clustersChanged(env.cbClusterCopy,[]);env.cbClusterCopy=[];
  await env.CBRuleTime.configureGroup("a");
  assert.equal(store.cbRuleState.a.$vaultTime.detachedReceipt.token,"final-one");assert.equal(retired.length,1);
  assert.equal(store.cbRuleState.a.privateField,"NEVER_TRANSMIT");
  await env.CBRuleTime.configureGroup("a");persist();assert.equal(retired.length,0);assert.equal(store.cbRuleState.a.$vaultTime.detachedReceipt,undefined);assert.equal(store.cbRuleState.a.budget.ready,true);
 });
 await test("failed final save retains hub snapshot and sends no acknowledgment",async()=>{
  retired=[{id:"failed-save",token:"retryable",state:clone(server)}];env.CBRuleTime.clustersChanged([{id:"failed-save",members:[{program:"chrome",groupId:"a"}]}],[]);
  const before=clone(store.cbRuleState.a);failSave=true;
  await assert.rejects(()=>env.CBRuleTime.configureGroup("a"),/injected storage failure/);
  assert.deepEqual(store.cbRuleState.a,before);assert.equal(retired.length,1);
  failSave=false;await env.CBRuleTime.configureGroup("a");assert.equal(retired.length,1);
  await env.CBRuleTime.configureGroup("a");assert.equal(retired.length,0);
 });
 await test("multiple offline handovers drain oldest first without rolling back the latest timer",async()=>{
  const older=clone(server),newer=clone(server);older.confirmed={"chrome/a":true};newer.confirmed={"chrome/a":true};older.objects.clock.generation=10;newer.objects.clock.generation=11;
  retired=[{id:"older",token:"old-token",state:older},{id:"newer",token:"new-token",state:newer}];
  // The browser remembers the newest link; the hub redirects to the oldest.
  env.CBRuleTime.clustersChanged([{id:"newer",members:[{program:"chrome",groupId:"a"}]}],[]);
  await env.CBRuleTime.configureGroup("a");
  assert.equal(store.cbRuleState.a.$vaultTime.objects.clock.generation,11);
  assert.equal(store.cbRuleState.a.$vaultTime.detachedReceipt.clusterId,"newer");
  await env.CBRuleTime.configureGroup("a");persist();assert.equal(retired.length,0);assert.equal(store.cbRuleState.a.$vaultTime.objects.clock.generation,11);
 });
 await test("a newly connected client discovers a link removed before its first poll",async()=>{
  retired=[{id:"short-link",token:"discovered",state:clone(server)}];
  env.CBRuleTime.disconnect();connection.ruleTimeVersion=1;connection.ws={identity:"fresh-discovery"};
  await env.CBRuleTime.configureGroup("a");assert.equal(store.cbRuleState.a.$vaultTime.detachedReceipt.clusterId,"short-link");
  await env.CBRuleTime.configureGroup("a");assert.equal(retired.length,0);
 });
 await test("deleting a group during transfer cannot recreate its saved state",async()=>{
  retired=[{id:"deleted-link",token:"deleted",state:clone(server)}];env.CBRuleTime.clustersChanged([{id:"deleted-link",members:[{program:"chrome",groupId:"a"}]}],[]);
  hold=true;held=null;const waiting=env.CBRuleTime.configureGroup("a");await heldRequest();
  store.blockedGroups=[];delete store.cbRuleState.a;reply(held);
  await assert.rejects(()=>waiting,/changed before save/);assert.equal(store.cbRuleState.a,undefined);assert.equal(retired.length,1);
 });
 console.log(JSON.stringify({pass:true,cases}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
