'use strict';
// Real RuleCore dispatch -> production result application -> production Log feed.
// Debug mode remains OFF; no browser, network, usage or saved user state.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const broadcasts = [], closes = [], debugConsole = [];
const store = {blockedGroups:[{id:'live',groupType:'custom',enabled:true}], cbRuleState:{live:{kept:true}}};
let failSave = false;
const c = vm.createContext({console:{log(){},warn(){},error:(...args)=>debugConsole.push(args)}, cbDebugMode:false,
  cbDebugLog(){},cbDebugWarn(){},BLOCKED_GROUPS_KEY:'blockedGroups',CB_RULE_STATE_KEY:'cbRuleState',
  chrome:{runtime:{sendMessage:message=>{broadcasts.push(message);return Promise.resolve();}},
    storage:{local:{get:async defaults=>Object.fromEntries(Object.keys(defaults).map(k=>[k,store[k]??defaults[k]])),
      set:async patch=>{if(failSave)throw Error('write refused');Object.assign(store,patch);}}},
    tabs:{remove:async id=>closes.push(id)}},
  cbRuleTypes:new Map(),cbRuleGenerations:new Map([['live',7]]), cbWithDefinitionMutation:operation=>operation(),
  quarantineGroup:async()=>{throw Error('Unexpected quarantine');},cbSetRulePanels(){},cbRunRuleFile:async()=>{},
  cbRuleSheets:new Map(),cbSendToWebPages:async()=>{},trySendApply:async()=>true,enqueueApply(){},
  cbSaveRuleSheets(){},cbPushRuleSheets:async()=>{}
});
c.self=c;
vm.runInContext(source.match(/^function cbDebugError.*$/m)[0],c);
vm.runInContext(source.slice(source.indexOf('const LOG_FEED_MAX_ENTRIES'),source.indexOf('// Quarantine:')),c);
vm.runInContext(source.slice(source.indexOf('function applyRuleResult'),source.indexOf('// A rule\'s file request')),c);
vm.runInContext(fs.readFileSync(path.join(root,'rule-core.js'),'utf8'),c);
const plain = value=>JSON.parse(JSON.stringify(value));
const feed = id=>plain(vm.runInContext(`logFeeds.get(${JSON.stringify(id)})||[]`,c));
(async()=>{
  const engine=c.RuleCore.createEngine(act=>({close:tabId=>act("close",{tabId})}));
  const loaded=engine.load('live','(on,v)=>{on("panel",()=>{v.log("before error");v.close(71);throw Error("first failure")});on("panel",()=>{throw Error("second failure")});}',{});
  assert.equal(loaded.ok,true);
  const result=engine.dispatch({type:'panel',targetGroupId:'live',now:100,data:{}});
  assert.equal(result.diagnostics.length,2);
  await c.applyRuleResult(result,'panel',new Map([['live',7]]));
  const first=feed('live');
  assert.equal(first.length,3,'Both execution errors and v.log must be visible with debug OFF');
  assert.deepEqual(first.filter(e=>e.source==='page-error').map(e=>[e.level,e.eventType,e.groupId]),
    [['error','panel','live'],['error','panel','live']]);
  assert.match(first[0].message,/first failure/);assert.match(first[1].message,/second failure/);
  assert.equal(first[2].source,'v.log');assert.equal(first[2].message,'before error');
  assert.deepEqual(closes,[71],'Reporting must not replay the action batch');
  assert.equal(debugConsole.length,0,'No need to enable the debug console');
  assert.equal(broadcasts.filter(x=>x.type==='log-feed-entry').length,3);
  // Render these actual production-feed entries through the popup's own code.
  const popup = fs.readFileSync(path.join(root,'popup.js'),'utf8');
  const element = () => ({children:[],textContent:'',setAttribute(){},appendChild(child){this.children.push(child);}});
  const list = element();
  const renderer = vm.createContext({document:{createElement:element},logFeedList:list,
    logFeedSeenIds:new Set(),state:{selectedGroupId:'live'},logFeedGroupId:'live',
    LOG_FEED_MAX_RENDER:200,formatLogFeedTime:()=>'',updateLogFeedVisibleCount(){}});
  vm.runInContext(popup.slice(popup.indexOf('function renderLogFeedEntry('),
    popup.indexOf('function updateLogFeedVisibleCount(')),renderer);
  first.forEach(entry=>renderer.renderLogFeedEntry(entry));
  assert.equal(list.children.length,3);
  assert.match(list.children[0].children[0].textContent,/ERROR/);
  assert.match(list.children[0].children[1].textContent,/first failure/);
  assert.match(list.children[1].children[0].textContent,/ERROR/);
  assert.match(list.children[1].children[1].textContent,/second failure/);
  console.log('PASS actual handler exceptions render as ERROR rows alongside v.log with debug OFF');

  c.cbRuleGenerations.set('live',8);
  await c.applyRuleResult(result,'panel',new Map([['live',7]]));
  assert.equal(feed('live').length,3);assert.deepEqual(closes,[71]);
  store.blockedGroups=[];
  await c.applyRuleResult(result,'panel');
  assert.equal(feed('live').length,3);assert.deepEqual(closes,[71]);
  console.log('PASS stale-generation and deleted-group diagnostics cannot leak into the feed or replay actions');

  store.blockedGroups=[{id:'live',groupType:'custom',enabled:true}];
  const before=plain(store.cbRuleState);
  const invalid={diagnostics:[{groupId:'live',args:['handler failed before invalid state']}],
    stateFailures:['live'],states:{live:{bad:true}},actions:[{groupId:'live',kind:'close',tabId:72}]};
  await assert.rejects(c.applyRuleResult(invalid,'tick'),/state exceeds its limit/);
  assert.deepEqual(store.cbRuleState,before);assert.deepEqual(closes,[71]);
  assert.equal(feed('live').length,4);assert.equal(feed('live')[3].eventType,'tick');
  console.log('PASS failed-state diagnostic is visible while invalid state and actions remain refused');

  failSave=true;
  await assert.rejects(c.applyRuleResult({diagnostics:[{groupId:'live',args:['handler failed before disk error']}],
    states:{live:{later:true}},actions:[{groupId:'live',kind:'close',tabId:73}]},'visible'),/write refused/);
  assert.deepEqual(store.cbRuleState,before);assert.deepEqual(closes,[71]);
  assert.equal(feed('live').length,5);assert.equal(feed('live')[4].level,'error');
  console.log('PASS save failure does not execute actions or hide an already observed execution error');
  console.log('__CB_TEST_RESULT__: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
