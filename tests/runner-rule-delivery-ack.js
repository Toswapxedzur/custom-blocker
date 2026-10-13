'use strict';
// Screen-free, actual extracted worker/content protocol; inert page/API data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.env.RULE_DELIVERY_SOURCE_ROOT || path.resolve(__dirname, '..');
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const contentSource = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
function section(source, start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert(first >= 0 && last > first, `missing actual source section: ${start}`);
  return source.slice(first, last);
}
function fixture() {
  const pending = new Map(), broadcasts = [], queryReplies = [], covers = [];
  let clicks = 0, mode = 'receiver', listener;
  const goodNode = {click() { clicks++; }, classList: {add(token) {
    if (/\s/.test(token)) throw new DOMException('Invalid class token', 'InvalidCharacterError');
  }}};
  const doc = {querySelectorAll(selector) {
    if (selector === '#button') return [goodNode];
    if (selector === '#query') return [{tagName:'DIV',textContent:'test',getAttribute:()=>null}];
    if (selector === '#broken-query') return [{tagName:'DIV',getAttribute() {throw Error('query getter failed');}}];
    return [];
  }};
  const content = vm.createContext({document:doc, DOMException, cbRuleRefs:new Map(),
    cbSetCardVerdict(){},cbApplyCard(){},cbSetRuleCover:v=>covers.push(v),
    safeSendMessage:v=>queryReplies.push(v),cbDebugWarn(){},
    chrome:{runtime:{onMessage:{addListener:v=>{listener=v;}}}}
  });
  vm.runInContext(section(contentSource, 'function cbRuleDomOp(', '// A rule\'s v.query'), content);
  vm.runInContext(section(contentSource, 'function cbRuleQuery(', '// The rules\' style sheets'), content);
  vm.runInContext(section(contentSource, 'function cbApplyRuleMessage(', '// ────────────────────────────────────────────────────────────────────────\n// Feed replenishment'), content);
  const listenerStart = contentSource.indexOf('if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {', contentSource.indexOf('function __cb_announceContentReady('));
  assert(listenerStart > 0);
  vm.runInContext(contentSource.slice(listenerStart, contentSource.indexOf('globalThis.VaultContentI18n?.onChange', listenerStart)), content);
  assert.equal(typeof listener, 'function');
  const store = {blockedGroups:[{id:'g',groupType:'custom',enabled:true},{id:'other',groupType:'custom',enabled:true},{id:'disabled',groupType:'custom',enabled:false}],cbRuleState:{}};
  const worker = vm.createContext({console, Date, Map, Set, Object, pendingApplyByTab:pending,
    PENDING_APPLY_MAX_PER_TAB:32,scheduleSessionFlush(){},BLOCKED_GROUPS_KEY:'blockedGroups',CB_RULE_STATE_KEY:'cbRuleState',
    cbWithDefinitionMutation:op=>op(),cbRuleGenerations:new Map(),cbDebugError(){},quarantineGroup:async()=>{},
    cbSetRulePanels(){},cbRunRuleFile:async()=>{},cbRuleSheets:new Map(),cbSaveRuleSheets(){},cbPushRuleSheets:async()=>{},
    chrome:{storage:{local:{get:async()=>store,set:async patch=>Object.assign(store,patch)}},runtime:{sendMessage:v=>{broadcasts.push(v);return Promise.resolve();}},
      tabs:{query:async()=>[{id:44,url:'https://example.test/'},{id:45,url:'chrome://settings'}],sendMessage:async(id,message)=>{
        if (mode==='unavailable') throw Error('Could not establish connection. Receiving end does not exist.');
        if (mode==='unknown-error') throw Error('Unknown transport failure');
        let reply;
        listener(message, {}, value=>{reply=value;});
        if (mode==='missing-ack') return undefined;
        if (mode==='closed-port') throw Error('The message port closed before a response was received.');
        if (mode==='malformed-ack') return {ok:1};
        return reply;
      }} }
  });
  worker.self = worker;
  vm.runInContext(section(background, 'const LOG_FEED_MAX_ENTRIES', '// Quarantine:'), worker);
  vm.runInContext(section(background, 'function applyRuleResult(', '// A rule\'s file request'), worker);
  vm.runInContext(section(background, 'function enqueueApply(', '// ── Push on change'), worker);
  vm.runInContext(section(background, 'async function cbSendToWebPages(', '// Asks every open page'), worker);
  const ready = section(background, '  if (message.type === "content-ready")', '  if (message.type === "reset-group-runtime")');
  content.chrome.runtime.sendMessage = async message => {
    assert.equal(message.type, 'content-ready');
    worker.message=message;worker.sender={tab:{id:44}};
    let response;worker.sendResponse=v=>{response=v;};
    vm.runInContext('(function(){'+ready+'})()',worker);
    return response;
  };
  vm.runInContext(section(contentSource, 'function __cb_announceContentReady(', 'if (document.readyState === "loading")'),content);
  const feed = groupId => broadcasts.filter(v=>v.type==='log-feed-entry' && v.entry.groupId===groupId).map(v=>v.entry);
  return {worker,pending,queryReplies,covers,feed,clicks:()=>clicks,setMode:v=>{mode=v;},
    dispatch:actions=>worker.applyRuleResult({actions},'tab'),
    ready:async()=>{content.__cb_announceContentReady();await new Promise(resolve=>setImmediate(resolve));}};
}
const action = (op,arg,groupId='g',tabId=44)=>({kind:'dom',groupId,tabId,selector:'#button',op,arg});
(async()=>{
  let f=fixture();
  await f.dispatch([action('click'),action('addClass','invalid token')]);
  assert.equal(f.clicks(),1,'actual DOM click precedes actual class operation failure');
  assert.equal(f.pending.size,0,'receiver failure never queues whole message');
  assert.equal(f.feed('g').length,1,'receiver failure must be reported to affected rule');
  assert.equal(f.feed('g')[0].source,'page-error');
  assert.equal(f.feed('g')[0].level,'error');
  assert.match(f.feed('g')[0].message,/Invalid class token/);
  assert.match(f.feed('g')[0].message,/not replayed/);
  await f.ready();assert.equal(f.clicks(),1,'content-ready cannot duplicate partial click');
  console.log('PASS actual partial click/negative ACK reported, never queued/replayed');
  for (const response of [undefined,null,true,false,{}, {ok:1},{ok:'true'}]) {
    f=fixture();f.worker.chrome.tabs.sendMessage=async()=>response;
    assert.equal((await f.worker.trySendApply(44,{type:'rule-apply'})).status,'unacknowledged');
  }
  f=fixture();f.worker.chrome.tabs.sendMessage=async()=>({ok:false,error:'Actual receiver error'});
  const negative = await f.worker.trySendApply(44,{type:'rule-apply'});
  assert.equal(negative.status,'receiver-error');assert.equal(negative.error,'Actual receiver error');
  for(const mode of ['missing-ack','malformed-ack','closed-port']) {
    f=fixture();f.setMode(mode);await f.dispatch([action('click')]);
    assert.equal(f.clicks(),1);assert.equal(f.pending.size,0);assert.equal(f.feed('g').length,1);
    await f.ready();assert.equal(f.clicks(),1,mode+' must not repeat executed action');
  }
  f=fixture();f.setMode('unknown-error');await f.dispatch([action('click')]);
  assert.equal(f.clicks(),0);assert.equal(f.pending.size,0);assert.equal(f.feed('g').length,1);
  console.log('PASS missing/malformed ACK and ambiguous transport never replay');
  f=fixture();await f.dispatch([action('click')]);
  assert.equal(f.clicks(),1);assert.equal(f.pending.size,0);assert.equal(f.feed('g').length,0);
  assert.equal((await f.worker.trySendApply(44,{type:'rule-apply',items:[],dom:[],queries:[]})).status,'delivered');
  console.log('PASS explicit successful ACK has no error or pending message');
  f=fixture();f.setMode('unavailable');await f.dispatch([action('click')]);
  assert.equal(f.clicks(),0);assert.equal(f.pending.get(44).length,1);assert.equal(f.feed('g').length,0);
  f.setMode('receiver');await f.ready();assert.equal(f.clicks(),1);assert.equal(f.pending.size,0);
  await f.ready();assert.equal(f.clicks(),1);
  for(let n=0;n<35;n++)f.worker.enqueueApply(44,{n});
  assert.equal(f.pending.get(44).length,32);assert.equal(f.pending.get(44)[0].n,3);
  console.log('PASS proven absent receiver retains one-shot existing queue/cap32');
  f=fixture();await f.dispatch([action('click',null,'other'),action('addClass','invalid token','g')]);
  assert.equal(f.feed('g').length,1);assert.equal(f.feed('other').length,1);assert.equal(f.feed('disabled').length,0);
  assert.match(f.feed('other')[0].message,/batch containing this rule/);
  f=fixture();await f.dispatch([action('click',null,'g','*'),action('addClass','invalid token','g','*')]);
  assert.equal(f.clicks(),1);assert.equal(f.pending.size,0);assert.equal(f.feed('g').length,1);
  f=fixture();f.setMode('unavailable');await f.dispatch([action('click',null,'g','*')]);
  assert.equal(f.pending.size,0,'broadcast does not acquire targeted queue semantics');
  f=fixture();f.worker.chrome.tabs.sendMessage=async()=>undefined;
  await f.worker.cbSendToWebPages({type:'session-refresh'});
  assert.equal(f.pending.size,0);assert.equal(f.feed('g').length,0);
  console.log('PASS shared batch attribution and broadcast report/noqueue boundaries');
  f=fixture();await f.dispatch([{kind:'query',groupId:'g',tabId:44,requestId:'q1',selector:'#query'},{kind:'query',groupId:'g',tabId:44,requestId:'q2',selector:'#broken-query'}]);
  assert.equal(f.queryReplies.length,1);assert.equal(f.feed('g').length,1);assert.equal(f.pending.size,0);
  await f.ready();assert.equal(f.queryReplies.length,1,'partial query replies never repeated');
  console.log('PASS earlier query response not repeated after later query failure');
  console.log('__CB_TEST_RESULT__: OK');
})().catch(error=>{console.error(error);console.log('__CB_TEST_RESULT__: FAIL');process.exitCode=1;});
