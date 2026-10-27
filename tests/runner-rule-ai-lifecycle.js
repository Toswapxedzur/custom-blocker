'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../background.js'),'utf8');
const first=source.indexOf('async function cbRunRuleAI('),last=source.indexOf('// A rule\'s file request',first);
assert(first>=0&&last>first);
function fixture() {
 let group={id:'g',enabled:true,groupType:'custom',activeEventSource:'code',ruleAI:{providerModel:'selected'}},reply;
 const events=[],connection={ws:{}},generations=new Map([['g',1]]);
 const context=vm.createContext({Promise,Map,JSON,globalThis:null,structuredClone,
  chrome:{storage:{local:{get:async()=>({blockedGroups:structuredClone([group])})}}},BLOCKED_GROUPS_KEY:'blockedGroups',cbRuleGenerations:generations,cbConnection:connection,
  CBGroupScopes:{definitionJSON:JSON.stringify},dispatchRule:async(type,data,options)=>events.push({type,data,options})});
 context.globalThis=context;context.CBRuleAIHub={request:()=>new Promise(resolve=>{reply=resolve;})};
 vm.runInContext(source.slice(first,last),context);
 return {events,connection,generations,group,async begin() {
  const task=context.cbRunRuleAI({groupId:'g',requestId:'r',generation:'original-instance',payload:'{}'});
  for(let i=0;i<100&&!reply;i++)await new Promise(resolve=>setImmediate(resolve));
  assert(reply,'request began');return {task,reply};
 },remove(){group={...group,enabled:false};}};
}
(async()=>{
 let f=fixture(),pending=await f.begin();pending.reply({ok:true,text:'answer'});await pending.task;
 assert.equal(f.events.length,1);assert.equal(f.events[0].data.requestId,'r');assert.equal(f.events[0].data.generation,'original-instance');
 for(const change of ['disable','run','model','delete']) {
  f=fixture();pending=await f.begin();
  if(change==='disable'||change==='delete')f.remove();
  else if(change==='run')f.generations.set('g',2);
  else f.group.ruleAI={providerModel:'replacement'};
  pending.reply({ok:true,text:'must not be delivered'});await pending.task;assert.equal(f.events.length,0,change);
 }
 f=fixture();pending=await f.begin();f.connection.ws={};pending.reply({ok:true,text:'old socket answer'});await pending.task;
 assert.equal(f.events.length,1);assert.equal(f.events[0].data.ok,false);assert.equal(f.events[0].data.error,'ai-unavailable');assert.equal(f.events[0].data.text,null);
 f=fixture();pending=await f.begin();pending.reply({ok:false,error:'ai-daily-limit'});await pending.task;
 assert.equal(f.events[0].data.error,'ai-daily-limit');
 console.log('PASS actual worker AI delivery, request identity, disable/Run/model/delete races, disconnect failure and daily-limit events');
})().catch(error=>{console.error(error);process.exitCode=1;});
