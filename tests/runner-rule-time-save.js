"use strict";
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.join(__dirname,".."),background=fs.readFileSync(path.join(root,"background.js"),"utf8");
let now=1800000000000,fail=false;const closed=[],logs=[];const clone=x=>JSON.parse(JSON.stringify(x));
const FakeDate=class extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
const ctx=vm.createContext({console,Date:FakeDate});vm.runInContext(fs.readFileSync(path.join(root,"rule-core.js"),"utf8"),ctx);
const engine=ctx.RuleCore.createEngine(act=>({close:tabId=>act("close",{tabId})}));
const source=`(on,v)=>{const t=v.timer("clock",{durationMs:100});if(!v.state.started){t.start();v.state.started=true;}on("timerEnded",()=>{v.state.ends=(v.state.ends||0)+1;v.close(9);});}`;
const store={blockedGroups:[{id:"a",groupType:"custom",enabled:true,activeEventSource:source}],cbRuleState:{}};
const loaded=engine.load("a",source,{});assert(loaded.ok);store.cbRuleState.a=clone(loaded.states.a);
Object.assign(ctx,{BLOCKED_GROUPS_KEY:"blockedGroups",CB_RULE_STATE_KEY:"cbRuleState",cbRuleStateSaveRetries:new Set(),cbRuleTypes:new Map([["a",new Set(loaded.types)]]),cbRuleGenerations:new Map([["a",1]]),cbRuleSheets:new Map(),
 chrome:{storage:{local:{get:async defaults=>Object.fromEntries(Object.keys(defaults).map(k=>[k,clone(store[k]??defaults[k])])),set:async values=>{if(fail)throw Error("disk unavailable");Object.assign(store,clone(values));}}},tabs:{remove:async id=>closed.push(id)}},
 ensureStartupGate:async()=>{},cbRulesHandle:type=>ctx.cbRuleTypes.get("a")?.has(type),cbSerializeRuleMutation:fn=>fn(),cbWithDefinitionMutation:fn=>fn(),cbDebugError(){},pushLogFeedEntry:entry=>logs.push(entry),quarantineGroup:async()=>{},cbSetRulePanels(){},cbRunRuleFile:async()=>{},cbSaveRuleSheets(){},cbPushRuleSheets:async()=>{},cbSendToWebPages:async()=>{},trySendApply:async()=>{},enqueueApply(){},
 sendToEventSandbox:async payload=>engine.dispatch(payload.descriptor),
 unloadCustomGroupHandlers:async id=>{ctx.cbRuleTypes.delete(id);engine.unload(id);},
 cbLoadCustomGroupSource:async group=>{const r=engine.load(group.id,group.activeEventSource,store.cbRuleState[group.id]);if(r.ok){if(fail){engine.unload(group.id);throw Error("disk unavailable");}store.cbRuleState[group.id]=clone(r.states[group.id]||store.cbRuleState[group.id]);ctx.cbRuleTypes.set(group.id,new Set(r.types));}return r;}
});
vm.runInContext(background.slice(background.indexOf('async function dispatchRule(type,'),background.indexOf('// A rule\'s file request')),ctx);
(async()=>{
 now+=101;fail=true;
 await assert.rejects(ctx.dispatchRule("tick",{}),/disk unavailable/);assert.equal(closed.length,0);assert.equal(store.cbRuleState.a.ends,undefined);assert(ctx.cbRuleStateSaveRetries.has("a"));assert(logs.some(x=>x.message?.includes("no actions were performed")));
 console.log("PASS save failure performs no timer actions and preserves the prior saved completion");
 await ctx.dispatchRule("tick",{});assert.equal(closed.length,0);assert.equal(store.cbRuleState.a.ends,undefined);
 console.log("PASS continued storage failure cannot lose or acknowledge a completion");
 fail=false;await ctx.dispatchRule("tick",{});assert.deepEqual(closed,[9]);assert.equal(store.cbRuleState.a.ends,1);assert.equal(ctx.cbRuleStateSaveRetries.size,0);
 await ctx.dispatchRule("tick",{});assert.deepEqual(closed,[9]);assert.equal(store.cbRuleState.a.ends,1);
 console.log("PASS successful retry saves then delivers completion once without replaying prior actions");
 console.log(JSON.stringify({pass:true,cases:3}));
})().catch(e=>{console.error(e);process.exitCode=1;});
