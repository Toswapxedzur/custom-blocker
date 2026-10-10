'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'rule-core.js'), 'utf8');
const background = fs.readFileSync(process.argv[2] || path.join(root, 'background.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const context = vm.createContext({console});
vm.runInContext(core, context);
const engine = context.RuleCore.createEngine();
const counter = '(on,v)=>{v.state.count=(v.state.count||0)+1;}';
let result = engine.load('rule', counter, {});
assert.equal(result.states.rule.count, 1);
result = engine.load('rule', counter, result.states.rule);
assert.equal(result.states.rule.count, 2);
assert.deepEqual(clone(engine.dispatch({type:'tick'}).states), {});
console.log('PASS initialization-only memory is exported once and retained across consecutive Runs');
assert.deepEqual(clone(engine.load('unchanged', '(on,v)=>{}', {count:7}).states), {});
assert.deepEqual(clone(engine.load('empty', '', {count:7}).states), {});
console.log('PASS unchanged and empty sources return an empty additive state map');
engine.load('good', '(on,v)=>{on("tick",()=>{v.state.count=(v.state.count||0)+1;});}', {count:7});
for (const source of ['(on,v)=>{v.state.big="x".repeat(70000);}', '(on,v)=>{v.state.self=v.state;}', '(on,v)=>{v.state.bad=true;throw new Error("registration failed");}', 'invalid syntax (']) {
  const failed = engine.load('good', source, {count:7});
  assert.equal(failed.ok, false);
  assert.equal(failed.states, undefined);
  assert.deepEqual(Array.from(engine.types('good')), ['tick']);
}
assert.equal(engine.dispatch({type:'tick'}).states.good.count, 8);
console.log('PASS oversized, cyclic, throwing and syntax-invalid registration retain the last working handler and state');
result=engine.load('errorField','(on,v)=>{v.state.error="ordinary user memory";on("tick",()=>{v.state.error="changed";});}',{});
assert.equal(result.states.errorField.error,'ordinary user memory');
assert.equal(engine.dispatch({type:'tick',targetGroupId:'errorField'}).states.errorField.error,'changed');
const staged=engine.prepareLoad('good','(on,v)=>{v.state.count=100;}',{count:8});
assert.equal(engine.dispatch({type:'tick',targetGroupId:'good'}).states.good.count,9);
engine.discardLoad(staged.token);assert.equal(engine.commitLoad(staged.token).ok,false);
result=engine.load('good','(on,v)=>{v.state.count=100;}',{count:9},()=>{throw new Error('disk-full');});
assert.equal(result.ok,false);assert.equal(engine.dispatch({type:'tick',targetGroupId:'good'}).states.good.count,10);
const first=engine.prepareLoad('replace','(on,v)=>{}',{});const second=engine.prepareLoad('replace','(on,v)=>{}',{});
assert.equal(engine.commitLoad(first.token).ok,false);assert.equal(engine.commitLoad(second.token).ok,true);
const cap=engine.prepareLoad('cap','(on,v)=>{}',{});
for(let n=0;n<64;n++)engine.prepareLoad('cap'+n,'(on,v)=>{}',{});
assert.equal(engine.commitLoad(cap.token).ok,false);
console.log('PASS user error fields, delayed/discarded candidates, throwing precommit, supersession and candidate bound');
for(const [character,under,over] of [['中',21841,21842],['😀',16381,16382]]) {
  const source=n=>`(on,v)=>{v.state.text=${JSON.stringify(character)}.repeat(${n});}`;
  assert.equal(engine.load('unicode',source(under),{}).ok,true);
  const failed=engine.load('unicode',source(over),{});assert.equal(failed.ok,false);assert.match(failed.error,/65536 bytes/);
}
const asyncRejected=engine.load('good','(on,v)=>{v.state.count=100;}',{},()=>Promise.resolve());
assert.equal(asyncRejected.ok,false);assert.match(asyncRejected.error,/synchronous/);
const superseded=engine.load('good','(on,v)=>{v.state.count=100;}',{},()=>{engine.prepareLoad('good','(on,v)=>{}',{});});
assert.equal(superseded.ok,false);assert.equal(engine.dispatch({type:'tick',targetGroupId:'good'}).states.good.count,11);
console.log('PASS UTF-8 Chinese/emoji byte boundaries, asynchronous callback refusal and callback supersession preserve runtime');
const oldIncarnation=context.RuleCore.createEngine();
const oldPrepared=oldIncarnation.prepareLoad('same','(on,v)=>{on("tick",()=>v.log("old"));}',{});
const freshContext=vm.createContext({console});vm.runInContext(core,freshContext);
const freshEngine=freshContext.RuleCore.createEngine();
const freshPrepared=freshEngine.prepareLoad('same','(on,v)=>{on("tick",()=>v.log("fresh"));}',{});
assert.notEqual(oldPrepared.token,freshPrepared.token);
assert.equal(freshEngine.commitLoad(oldPrepared.token).ok,false);freshEngine.discardLoad(oldPrepared.token);
assert.equal(freshEngine.commitLoad(freshPrepared.token).ok,true);
assert.equal(freshEngine.dispatch({type:'tick'}).logs[0].args[0],'fresh');
console.log('PASS old-engine commit/discard tokens cannot affect a fresh sandbox candidate');

async function browserFixture() {
  const store = {blockedGroups:[{id:'rule',groupType:'custom',enabled:true}],cbRuleState:{other:{keep:9}}};
  let sandbox = context.RuleCore.createEngine();
  let beforeReply = () => {};
  let failWrite = false;
  let failCommit = false;
  let heldWrite = null;
  let heldEntered = () => {};
  let duringCommit = () => {};
  let suppressed = null;
  const env = vm.createContext({console,Map,Set,Object,
    BLOCKED_GROUPS_KEY:'blockedGroups',CB_RULE_STATE_KEY:'cbRuleState',
    chrome:{storage:{local:{get:async defaults=>clone(Object.fromEntries(Object.keys(defaults).map(key=>[key,store[key] ?? defaults[key]]))),set:async patch=>{if(failWrite){failWrite=false;throw new Error("disk-full");}const stable=clone(patch);if(heldWrite){heldEntered();await heldWrite;}Object.assign(store,stable);}}}},
    cbRuleTypes:new Map(),cbRulePanels:new Map(),cbRuleItemsEpoch:1,lastReconcileSnapshot:new Map(),
    CBGroupActions:{isLocked:group=>Boolean(group.lockedAtMs)},cbEnforceOnly:()=>false,
    ensureStartupGate:async()=>{},cbRulesHandle:()=>true,cbRuleSheets:new Map(),
    cbRulePageNeeds:()=>'',cbSetRulePanels(){},pushLogFeedEntry(){},cbDebugError(){},
    quarantineGroup:async()=>{},cbSuppressRule:async(id,on)=>{suppressed=on;},broadcastSessionRefresh:async()=>{},
    unloadCustomGroupHandlers:async()=>{sandbox.unload('rule');return {ok:true};},
    sendToEventSandbox:async request=>{
      if(request.kind==='dispatch-event')return sandbox.dispatch(request.descriptor);
      if(request.kind==='prepare-source'){const reply=sandbox.prepareLoad(request.groupId,request.source,request.state);beforeReply();return reply;}
      if(request.kind==='commit-source'){duringCommit();return failCommit ? {ok:false,error:'journal-full'} : sandbox.commitLoad(request.token);}
      if(request.kind==='discard-source')return sandbox.discardLoad(request.token);
      throw new Error(request.kind);
    }
  });
  const start=background.indexOf('let cbRuleMutationQueue');
  const end=background.indexOf('async function unloadCustomGroupHandlers',start);
  vm.runInContext(background.slice(start,end),env);
  const dispatchStart=background.indexOf('async function dispatchRule');
  vm.runInContext(background.slice(dispatchStart,background.indexOf('// A rule\'s file request',dispatchStart)),env);
  const run=source=>env.loadCustomGroupSource({id:'rule',groupType:'custom',enabled:true,activeEventSource:source},{run:true});
  await run(counter);assert.equal(store.cbRuleState.rule.count,1);
  await run(counter);assert.equal(store.cbRuleState.rule.count,2);
  assert.equal(store.cbRuleState.other.keep,9);
  sandbox=context.RuleCore.createEngine();
  await run(counter);assert.equal(store.cbRuleState.rule.count,3);
  console.log('PASS browser persists initialization with no handlers, consecutive Runs and a fresh sandbox restart, preserving other groups');
  beforeReply=()=>{};
  await run('(on,v)=>{on("tick",()=>{v.state.count++;});}');
  const before=clone(store.cbRuleState);
  for(const source of ['(on,v)=>{v.state.big="x".repeat(70000);}', '(on,v)=>{v.state.self=v.state;}', '(on,v)=>{throw new Error("no");}', 'syntax (']) {
    const failed=await run(source);assert.equal(failed.ok,false);assert.deepEqual(store.cbRuleState,before);
    assert.deepEqual(Array.from(env.cbRuleTypes.get('rule')),['tick']);
  }
  assert.equal(sandbox.dispatch({type:'tick'}).states.rule.count,4);
  console.log('PASS failed browser registration leaves persisted memory and active handlers unchanged');
  failWrite=true;
  let failed=await run(counter);assert.equal(failed.ok,false);assert.deepEqual(store.cbRuleState,before);
  assert.equal(sandbox.dispatch({type:'tick'}).states.rule.count,5);
  failCommit=true;duringCommit=()=>{store.blockedGroups[0].enabled=false;};
  failed=await run(counter);assert.equal(failed.ok,false);assert.deepEqual(store.cbRuleState,before);
  assert.equal(sandbox.dispatch({type:'tick'}).states.rule.count,6);assert.equal(store.blockedGroups[0].enabled,false);failCommit=false;duringCommit=()=>{};store.blockedGroups[0].enabled=true;
  console.log('PASS failed browser storage or native journal commit preserves prior exact runtime and saved memory/source');
  await Promise.all([run(counter),run(counter)]);assert.equal(store.cbRuleState.rule.count,5);
  console.log('PASS concurrent Runs serialize initialization and persist source with memory atomically');
  const groupBefore=clone(store.blockedGroups);
  beforeReply=()=>{store.blockedGroups[0].enabled=false;};
  failed=await run(counter);assert.equal(failed.ok,false);assert.equal(store.blockedGroups[0].enabled,false);assert.equal(store.cbRuleState.rule.count,5);
  store.blockedGroups=clone(groupBefore);beforeReply=()=>{store.blockedGroups[0].lockedAtMs=123;};
  failed=await run(counter);assert.equal(failed.ok,false);assert.equal(store.blockedGroups[0].lockedAtMs,123);assert.equal(store.cbRuleState.rule.count,5);
  store.blockedGroups=clone(groupBefore);
  beforeReply=()=>{store.blockedGroups[0].blockingRulesText='newer draft';};
  failed=await run(counter);assert.equal(failed.ok,false);assert.equal(store.blockedGroups[0].blockingRulesText,'newer draft');assert.equal(store.cbRuleState.rule.count,5);
  store.blockedGroups=clone(groupBefore);
  console.log('PASS concurrent disable, lock and newer draft while preparing supersede Run without changing memory');
  // Hold an older event's persistence transaction. Registration must wait for
  // its full write, then initialize from the updated memory, never vice versa.
  beforeReply=()=>{};
  await run('(on,v)=>{on("tick",()=>{v.state.count++;});}');
  let release;heldWrite=new Promise(resolve=>{release=resolve;});
  const entered=new Promise(resolve=>{heldEntered=resolve;});
  const oldWrite=env.dispatchRule('tick',null);
  await entered;
  beforeReply=()=>{};const newer=run(counter);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(store.cbRuleState.rule.count,5);
  heldWrite=null;release();await oldWrite;await newer;assert.equal(store.cbRuleState.rule.count,7);
  console.log('PASS held older event write completes before newer initialization reads and commits memory');
  duringCommit=()=>{store.blockedGroups[0].enabled=false;};
  await run(counter);assert.equal(store.cbRuleState.rule.count,8);assert.equal(store.blockedGroups[0].enabled,false);assert.equal(suppressed,true);
  duringCommit=()=>{};
  console.log('PASS later disable during successful or failed commit wins over Run and rollback');
  beforeReply=()=>{store.blockedGroups=[];delete store.cbRuleState.rule;};
  await run(counter);assert.equal(store.cbRuleState.rule,undefined);
  console.log('PASS delayed initialization reply cannot recreate a deleted group’s saved memory');
}
const watchdog=setTimeout(()=>{console.error('FAIL initialization test did not finish its awaited transactions');process.exit(1);},5000);
browserFixture().then(()=>{clearTimeout(watchdog);console.log('__CB_TEST_RESULT__: OK');}).catch(error=>{clearTimeout(watchdog);console.error(error);process.exitCode=1;});
