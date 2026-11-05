// Exercises the production feed and engine; no extension state or network.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let clock = 0;
const broadcasts = [];
const stored = new Map();
const context = vm.createContext({Date: {now: () => clock}, console, TextEncoder, structuredClone,
  cbDebugLog() {}, cbDebugWarn() {}, cbDebugError() {},
  chrome: {runtime: {sendMessage: message => {broadcasts.push(message); return Promise.resolve();}},
    storage: {local: {
      get: async key => stored.has(key) ? {[key]: structuredClone(stored.get(key))} : {},
      set: async changes => { for (const [key, value] of Object.entries(changes)) stored.set(key, structuredClone(value)); }
    }}}});
context.self = context;
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
vm.runInContext(background.slice(background.indexOf('const LOG_FEED_MAX_ENTRIES'),
  background.indexOf('// Quarantine:')), context);
const push = entry => context.pushLogFeedEntry(entry);
const entry = (groupId, message) => ({source:'v.log', groupId, message});
const requestStart = background.indexOf('  if (message.type === "get-log-feed")');
const requestEnd = background.indexOf('  if (message.type === "offscreen-tick")', requestStart);
const request = (type, groupId) => new Promise(resolve => {
  context.message = {type, groupId};
  context.sendResponse = value => resolve(JSON.parse(JSON.stringify(value)));
  vm.runInContext('(function(){' + background.slice(requestStart, requestEnd) + '})()', context);
});
(async () => {
push(entry('b', 'B kept'));
for (let n=0; n<240; n++) {clock += 30; push(entry('a', `A ${n}`));}
assert.equal((await request('get-log-feed','a')).entries.length,200);
assert.deepEqual((await request('get-log-feed','b')).entries.map(e=>e.message),['B kept']);
const revived = vm.createContext({Date: {now: () => clock}, console, TextEncoder, structuredClone,
  cbDebugLog() {}, cbDebugWarn() {}, cbDebugError() {}, chrome: context.chrome});
revived.self = revived;
vm.runInContext(background.slice(background.indexOf('const LOG_FEED_MAX_ENTRIES'),
  background.indexOf('// Quarantine:')), revived);
assert.equal((await revived.persistedLogFeed('a')).length,200,'new worker reads persisted group log');
push({groupId:'a',message:'engine error',level:'error'});
push({source:'v.log',message:'missing group'});
context.recordVaultClassifierDiagnostic({event:'collection-queued',platform:'bridge',outcome:'session'});
assert.equal((await request('get-log-feed','a')).entries.length,200);
assert.deepEqual((await request('get-log-feed')).entries,[]);
await request('clear-log-feed','a');
assert.deepEqual((await request('get-log-feed','a')).entries,[]);
assert.equal((await request('get-log-feed','b')).entries.length,1);
await request('clear-log-feed');
assert.equal((await request('get-log-feed','b')).entries.length,1);
clock += 2000;
for(let n=0;n<80;n++)push(entry('a',`noisy ${n}`));
push(entry('b','B still accepted'));
assert.equal((await request('get-log-feed','b')).entries.length,2);
vm.runInContext(fs.readFileSync(path.join(root,'rule-core.js'),'utf8'),context);
const engine = context.RuleCore.createEngine(() => ({}));
engine.load('throwing','(on,v)=>{on("tick",()=>{throw Error("bad")});}',{});
let result=engine.dispatch({type:'tick',targetGroupId:'throwing'});
assert.equal(result.logs.length,0);
assert.match(result.diagnostics[0].args[0],/bad/);
engine.load('logging','(on,v)=>{on("tick",()=>v.log("my output"));}',{});
result=engine.dispatch({type:'tick',targetGroupId:'logging'});
assert.equal(result.logs[0].source,'v.log');
assert.equal(result.logs[0].groupId,'logging');
clock += 2000;
push({source:'page-error',groupId:'delivery',level:'log',message:'Failed page action; not replayed'});
const delivery = (await request('get-log-feed','delivery')).entries;
assert.equal(delivery.length,1);
assert.equal(delivery[0].source,'page-error');
assert.equal(delivery[0].level,'error');
push({source:'engine-error',groupId:'delivery',message:'Excluded engine error'});
assert.equal((await request('get-log-feed','delivery')).entries.length,1);

// The actual popup filter must show the narrow error source without admitting
// other diagnostics or another rule's output. No browser/extension state.
const popup = fs.readFileSync(path.join(root,'popup.js'),'utf8');
const element = () => ({children:[],textContent:'',setAttribute(){},
  appendChild(child){this.children.push(child);}});
const list = element();
const renderer = vm.createContext({document:{createElement:element},
  logFeedList:list,logFeedSeenIds:new Set(),state:{selectedGroupId:'delivery'},
  logFeedGroupId:'delivery',LOG_FEED_MAX_RENDER:200,
  formatLogFeedTime:()=>'',updateLogFeedVisibleCount(){}});
vm.runInContext(popup.slice(popup.indexOf('function renderLogFeedEntry('),
  popup.indexOf('function updateLogFeedVisibleCount(')),renderer);
renderer.renderLogFeedEntry(delivery[0]);
assert.equal(list.children.length,1);
assert.match(list.children[0].children[0].textContent,/ERROR/);
assert.equal(list.children[0].children[1].textContent,'Failed page action; not replayed');
renderer.renderLogFeedEntry({...delivery[0],id:'foreign',groupId:'other'});
renderer.renderLogFeedEntry({...delivery[0],id:'diagnostic',source:'engine-error'});
assert.equal(list.children.length,1);
await context.prunePersistedLogFeeds(new Set(['b','delivery']));
assert.deepEqual((await request('get-log-feed','a')).entries,[],'deleted group log is removed from disk');
const oversized={version:1,groups:{}};
for(let n=0;n<650;n++){
  const id='g'+Math.floor(n/200);
  (oversized.groups[id]??=[]).push({id:String(n),ts:n,source:'v.log',level:'log',groupId:id,eventType:'',message:'x'.repeat(4000)});
}
context.trimLogFeedDocument(oversized);
assert(new TextEncoder().encode(JSON.stringify(oversized)).length<=2*1024*1024);
assert(Number(oversized.groups.g0[0].id)>0,'global cap removes oldest entries first');
const unordered={version:1,groups:{a:[
  {id:'newer',ts:3,source:'v.log',level:'log',groupId:'a',eventType:'',message:'x'.repeat(1024*1024)},
  {id:'oldest',ts:1,source:'v.log',level:'log',groupId:'a',eventType:'',message:'x'.repeat(1024*1024)}
]}};
context.trimLogFeedDocument(unordered);
assert.equal(unordered.groups.a[0].id,'newer','oldest timestamp is evicted even when stored entries are out of order');
const future={version:999,groups:{keep:'future'}};
stored.set('cbRuleLog',future);
assert.equal((await request('get-log-feed','b')).ok,false);
assert.equal((await request('clear-log-feed','b')).ok,false);
assert.deepEqual(stored.get('cbRuleLog'),future,'unsupported stored logs are not replaced');
console.log('PASS separate retention/Clear/bursts, v.log origin and narrow visible page-error source');
console.log('__CB_TEST_RESULT__: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
