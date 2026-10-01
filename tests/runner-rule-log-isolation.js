// Exercises the production feed and engine; no extension state or network.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let clock = 0;
const broadcasts = [];
const context = vm.createContext({Date: {now: () => clock}, console,
  cbDebugLog() {}, cbDebugWarn() {}, cbDebugError() {},
  chrome: {runtime: {sendMessage: message => {broadcasts.push(message); return Promise.resolve();}}}});
context.self = context;
const background = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
vm.runInContext(background.slice(background.indexOf('const LOG_FEED_MAX_ENTRIES'),
  background.indexOf('// Quarantine:')), context);
const push = entry => context.pushLogFeedEntry(entry);
const entry = (groupId, message) => ({source:'v.log', groupId, message});
const requestStart = background.indexOf('  if (message.type === "get-log-feed")');
const requestEnd = background.indexOf('  if (message.type === "offscreen-tick")', requestStart);
const request = (type, groupId) => {
  context.message = {type, groupId};
  let reply;
  context.sendResponse = value => reply = value;
  vm.runInContext('(function(){' + background.slice(requestStart, requestEnd) + '})()', context);
  return JSON.parse(JSON.stringify(reply));
};
push(entry('b', 'B kept'));
for (let n=0; n<240; n++) {clock += 30; push(entry('a', `A ${n}`));}
assert.equal(request('get-log-feed','a').entries.length,200);
assert.deepEqual(request('get-log-feed','b').entries.map(e=>e.message),['B kept']);
push({groupId:'a',message:'engine error',level:'error'});
push({source:'v.log',message:'missing group'});
context.recordVaultClassifierDiagnostic({event:'collection-queued',platform:'bridge',outcome:'session'});
assert.equal(request('get-log-feed','a').entries.length,200);
assert.deepEqual(request('get-log-feed').entries,[]);
request('clear-log-feed','a');
assert.deepEqual(request('get-log-feed','a').entries,[]);
assert.equal(request('get-log-feed','b').entries.length,1);
request('clear-log-feed');
assert.equal(request('get-log-feed','b').entries.length,1);
clock += 2000;
for(let n=0;n<80;n++)push(entry('a',`noisy ${n}`));
push(entry('b','B still accepted'));
assert.equal(request('get-log-feed','b').entries.length,2);
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
console.log('PASS separate retention, Clear, burst limits, diagnostics exclusion and v.log origin');
console.log('__CB_TEST_RESULT__: OK');
