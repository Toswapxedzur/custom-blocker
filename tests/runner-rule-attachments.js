'use strict';
const assert=require('node:assert/strict');
global.VaultContentItems=require('../content-items.js');
const C=VaultContentItems,{createBroker,key:KEY}=require('../rule-attachments.js'),RuleCore=require('../rule-core.js');
assert.equal(C.contentId('youtube','https://www.youtube.com/watch?v=abc&si=tracking'),'youtube:video:abc');
assert.equal(C.contentId('youtube','https://youtube.com/shorts/abc'),'youtube:video:abc');
assert.equal(C.contentId('twitter','https://x.com/person/status/123/photo/1'),'twitter:status:123');
assert.equal(C.contentId('reddit','https://www.reddit.com/r/a/comments/abc/title/'),'reddit:post:abc');
assert.equal(C.contentId('bilibili','https://www.bilibili.com/video/BV123?spm=tracking'),'bilibili:video:BV123');
assert.equal(C.contentId('youtube','javascript:alert(1)'),null);
const item={ref:'i1',contentId:'youtube:video:abc',instanceId:'page:1',url:'https://youtube.com/watch?v=abc'};
const engine=RuleCore.createEngine(()=>({}));
assert.equal(engine.load('a',`(on,v)=>{on('items',e=>v.attach(e.data.tabId,e.data.items[0],'summary',{type:'pill',text:'Read',tone:'blue'}));}`,{}).ok,true);
const action=engine.dispatch({type:'items',data:{tabId:1,items:[item]}}).actions[0];
assert.equal(action.kind,'attach');assert.deepEqual(action.target,C.target(item));
assert.equal(engine.load('bad',`(on,v)=>{v.attach(1,{},'summary',null)}`,{}).ok,false);
let stored={blockedGroups:[{id:'a',groupType:'custom',enabled:true},{id:'b',groupType:'custom',enabled:true}]};
let queue=Promise.resolve(),generation=1,valid=true,failWrite=false,writes=0;
const messages=[],clicks=[];
const storage={get:async keys=>Object.fromEntries(keys.filter(k=>k in stored).map(k=>[k,structuredClone(stored[k])])),set:async changes=>{if(failWrite)throw Error('quota');writes++;Object.assign(stored,structuredClone(changes));}};
function broker(){return createBroker({storage,groupsKey:'blockedGroups',epoch:()=>10,
 serial:fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;},
 send:async(tabId,message)=>messages.push({tabId,message}),check:async()=>valid,
 isCurrent:(_,expected)=>expected===generation,click:async(...args)=>clicks.push(args)});}
const sender={tab:{id:1,url:'https://youtube.com/'},url:'https://youtube.com/',frameId:0,documentId:'document'};
const spec={type:'pill',text:'Read',tone:'blue'};
async function observe(b,target=item,token='page'){return b.observe(sender,{itemsEpoch:10,pageToken:token,platform:'youtube',items:[target]});}
(async()=>{
 let b=broker();await b.load();await observe(b);await b.applyLocked({...action,groupId:'a'},1);
 const saved=structuredClone(stored[KEY]);assert.equal(saved.groups.a[item.contentId].summary.spec.text,'Read');
 assert.equal(messages.at(-1).message.items[0].attachments.length,1);
 await b.applyLocked({...action,groupId:'b',spec:{...spec,text:'Other group'}},1);
 assert.equal(messages.at(-1).message.items[0].attachments.length,2);
 assert.equal(b.itemsForGroup('a',[item])[0].attachments.summary.text,'Read');
 assert.equal(b.itemsForGroup('b',[item])[0].attachments.summary.text,'Other group');
 // Actual persistence, not a runtime cache: reconstruct all broker state.
 b=broker();await b.load();await observe(b,{...item,instanceId:'return:1'},'return');
 let shown=messages.at(-1).message.items[0];assert.equal(shown.attachments.length,2);
 const record=shown.attachments.find(a=>a.groupId==='a');
 await b.handleClick(sender,{pageToken:'return',target:shown.target,groupId:'a',attachmentId:'summary',revision:'forged'},1);assert.equal(clicks.length,0);
 await b.handleClick(sender,{pageToken:'return',target:shown.target,groupId:'a',attachmentId:'summary',revision:record.revision},1);
 assert.equal(clicks.length,1);assert.equal(clicks[0][1].item.contentId,item.contentId);assert.equal(clicks[0][1].eventName,'click');
 await b.handleClick(sender,{pageToken:'return',target:shown.target,groupId:'a',attachmentId:'summary',revision:record.revision,value:{forged:true}},1);
 assert.equal(clicks.length,1);
 valid=false;await assert.rejects(()=>b.applyLocked({...action,groupId:'a',target:shown.target,spec:{...spec,text:'Wrong card'}},1),/stale-target/);valid=true;
 assert.equal(stored[KEY].groups.a[item.contentId].summary.spec.text,'Read');
 generation=2;await assert.rejects(()=>b.applyLocked({...action,groupId:'a',target:shown.target},1),/stale-target/);generation=1;
 stored.blockedGroups[0].enabled=false;await b.refresh();assert.equal(messages.at(-1).message.items[0].attachments.length,1);
 assert(stored[KEY].groups.a[item.contentId]);stored.blockedGroups[0].enabled=true;
 failWrite=true;await assert.rejects(()=>b.applyLocked({...action,groupId:'a',target:shown.target,spec:{...spec,text:'Unsaved'}},1),/quota/);failWrite=false;
 assert.equal(stored[KEY].groups.a[item.contentId].summary.spec.text,'Read');
 await b.applyLocked({...action,groupId:'a',target:shown.target,spec:null},1);assert(!stored[KEY].groups.a);
 const batch=Array.from({length:9},(_,i)=>({...action,groupId:'a',target:shown.target,attachmentId:'batch'+i})),beforeWrites=writes;
 const errors=await b.applyBatchLocked(batch,new Map([['a',1]]));
 assert.equal(errors.length,1);assert.match(errors[0].error.message,/item-limit/);
 assert.equal(Object.keys(stored[KEY].groups.a[item.contentId]).length,8);assert.equal(writes-beforeWrites,1,'one durable write per dispatch');
 await b.applyBatchLocked(batch.slice(0,8),new Map([['a',1]]));assert.equal(writes-beforeWrites,1,'identical specs do not rewrite storage');
 stored.blockedGroups=[];await b.load();assert.deepEqual(Object.keys(stored[KEY].groups),[]);
 stored[KEY]={version:999,groups:{keep:'future'}};await assert.rejects(()=>b.load(),/storage-unavailable/);assert.equal(stored[KEY].groups.keep,'future');
 for(const bad of [{version:1,groups:{a:'bad'}},{version:1,groups:{a:{content:[]}}},{version:1,groups:{a:{content:{note:{spec:{type:'html',text:'bad'},revision:'x'}}}}}]) {
  stored[KEY]=bad;const original=structuredClone(bad);await assert.rejects(()=>b.load(),/storage-unavailable/);
  assert.equal((await observe(b)).length,1,'metadata still reaches ordinary item rules');
  assert.equal(b.itemsForGroup('a',[item])[0].attachments,null,'unavailable is not an empty cache');
  assert.deepEqual(stored[KEY],original,'malformed nested records are preserved');
 }
 console.log('PASS content identity, rule action, durable per-group pills, reconstruction, click correlation, disabled groups, stale targets/generations, quota preservation and deletion');
})().catch(error=>{console.error(error);process.exitCode=1;});
