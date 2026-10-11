'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
const closed = [], logs = [], panels = [];
const store = {blockedGroups: [{id:'live',groupType:'custom',enabled:true},{id:'disabled',groupType:'custom',enabled:false},{id:'site',groupType:'site',enabled:true}], cbRuleState:{live:{before:true}}};
let nativeMessage;
const context = vm.createContext({console, Map, Set, Object,
  BLOCKED_GROUPS_KEY:'blockedGroups', CB_RULE_STATE_KEY:'cbRuleState', NATIVE_HOST_APPLICATION_ID:'safari-app',
  chrome:{storage:{local:{get:async defaults => Object.fromEntries(Object.keys(defaults).map(key=>[key,store[key] ?? defaults[key]])),set:async patch=>Object.assign(store,patch)}},runtime:{sendNativeMessage:async(host,message)=>{nativeMessage=message;return {ok:true,result:{ok:true}};}},tabs:{remove:async id=>closed.push(id)}},
  pushLogFeedEntry:entry=>logs.push(entry),cbDebugError(){},quarantineGroup:async()=>{throw new Error('stale quarantine');},cbSetRulePanels:(id,p)=>panels.push(id),cbRunRuleFile:async()=>{},cbRuleSheets:new Map(),cbSendToWebPages:async()=>{},trySendApply:async()=>true,enqueueApply(){},cbSaveRuleSheets(){},cbPushRuleSheets:async()=>{}
});
vm.runInContext(source.slice(source.indexOf('async function sendToEventSandboxNative'),source.indexOf('async function sendToEventSandbox(payload)')),context);
context.cbWithDefinitionMutation = operation => operation();
vm.runInContext(source.slice(source.indexOf('function applyRuleResult'),source.indexOf('// A rule\'s file request')),context);
(async()=>{
  await context.sendToEventSandboxNative({kind:'dispatch-event',groupIds:['deleted']});
  assert.deepEqual(Array.from(nativeMessage.payload.groupIds),['live','disabled']);
  console.log('PASS native request carries authoritative custom group IDs, including disabled groups');
  await context.applyRuleResult({logs:[{groupId:'deleted'},{groupId:'live'}],quarantine:{groupId:'deleted'},states:{deleted:{revived:true},site:{revived:true},live:{count:1}},panels:{deleted:[{}],live:[]},actions:[{groupId:'deleted',kind:'close',tabId:1},{groupId:'disabled',kind:'close',tabId:2},{groupId:'site',kind:'close',tabId:3},{groupId:'live',kind:'close',tabId:4}]},'tick');
  assert.deepEqual(closed,[4]); assert.deepEqual(logs.map(e=>e.groupId),['live']); assert.deepEqual(panels,['live']);
  assert.equal(store.cbRuleState.deleted,undefined); assert.equal(store.cbRuleState.site,undefined); assert.equal(store.cbRuleState.live.count,1);
  console.log('PASS stale/deleted/disabled group replies cannot revive state or act on tabs');
  console.log('__CB_TEST_RESULT__: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
