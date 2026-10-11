"use strict";
const assert = require("node:assert/strict");
const {setup, frame, cluster, state, boot} = require("./runner-first-link.js");
let passed = 0;
const check = (value, label) => { assert.ok(value, label); passed++; console.log(`PASS ${label}`); };
const clone = value => JSON.parse(JSON.stringify(value));
const positive = env => env.ctx.__sent.filter(value => value.kind === "group-sync" && value.ts > 0);
const edit = (env, before, after) => env.run("CBGroupScopes.editorChange")(before, after, "browser");
const commit = (env, changes, extra = {}) => env.run("cbApplyEditorRequest")({changes, ...extra});
async function settle(env) {
  await env.run("cbDefinitionTail");
  if (env.run("cbDefinitionRefreshTask")) await env.run("cbDefinitionRefreshTask");
  await env.run("cbDefinitionTail");
}
async function deliver(env, events) {
  for (const event of events) for (const listener of env.ctx.__storageListeners) listener(event, "local");
  await settle(env);
}
const sites = group => group.scopes.filter(line => line.surface === "site");
async function runQueueControls() {
  const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
  const good='(on,v)=>{on("tick",()=>{v.state.count=(v.state.count||0)+1;});}';
  const candidate='(on,v)=>{v.state.count=(v.state.count||0)+1;}';
  for(const mutation of ['disable','lock','delete','name','storage-failure','sandbox-failure']) {
    const ctx=boot('chrome'), run=code=>vm.runInContext(code,ctx), env={ctx,run};
    ctx.chrome.tabs={query:async()=>[],sendMessage:async()=>{}};
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../rule-core.js'),'utf8'),ctx);
    const sandbox=ctx.RuleCore.createEngine();
    let holdPrepare=false, enteredResolve, release, failCommit=false;
    const entered=new Promise(resolve=>{enteredResolve=resolve;});
    const hold=new Promise(resolve=>{release=resolve;});
    ctx.__transport=async request=>{
      if(request.kind==='prepare-source') {
        const reply=sandbox.prepareLoad(request.groupId,request.source,request.state);
        if(holdPrepare) {holdPrepare=false;enteredResolve();await hold;}
        return reply;
      }
      if(request.kind==='commit-source')return failCommit ? {ok:false,error:'journal-full'} : sandbox.commitLoad(request.token);
      if(request.kind==='discard-source')return sandbox.discardLoad(request.token);
      if(request.kind==='unload-group') {sandbox.unload(request.groupId);return {ok:true};}
      if(request.kind==='suppress-group') {sandbox.suppress(request.groupId,request.on);return {ok:true};}
      throw new Error(request.kind);
    };
    run('sendToEventSandbox=__transport');
    await run('cbSharingReady');await run('ensureStartupGate()');
    const group=run('sanitizeGroups([{id:"R",name:"Original rule",groupType:"custom",enabled:true}])[0]');
    group.activeEventSource=good;group.blockingRulesText=good;
    await ctx.chrome.storage.local.set({cbRuleState:{R:{count:2},other:{keep:9}}});
    await commit(env,[run('CBGroupScopes.editorChange')(null,group,'browser')]);await settle(env);
    const before=clone((await state(env)).blockedGroups[0]);
    holdPrepare=true;
    const running=ctx.cbRunCustomGroup('R',candidate);
    await entered;
    if(mutation==='delete')await commit(env,[edit(env,before,null)]);
    else if(mutation==='disable' || mutation==='name')await commit(env,[edit(env,before,{...before,...(mutation==='disable'?{enabled:false}:{name:'Owner changed name'})})]);
    else if(mutation==='lock')await commit(env,[edit(env,before,{...before,lockedAtMs:Date.now(),lockWaitHours:1,lockVersion:1})],{intent:'lock-fields'});
    else if(mutation==='storage-failure') {
      const set=ctx.chrome.storage.local.set;let fail=true;
      ctx.chrome.storage.local.set=async patch=>{if(fail && Object.hasOwn(patch,'blockedGroups')){fail=false;throw Error('disk-full');}return set(patch);};
    } else failCommit=true;
    release();const result=await running;await settle(env);
    const current=(await state(env)).blockedGroups.find(group=>group.id==='R');
    const states=(await ctx.chrome.storage.local.get({cbRuleState:{}})).cbRuleState;
    if(mutation==='name')check(result.ok && current.name==='Owner changed name' && current.activeEventSource===candidate && states.R.count===3,'actual worker Run commits initialization while preserving a concurrent unrelated owner field');
    else if(mutation==='delete') {
      await ctx.applyRuleResult({states:{R:{count:99}},logs:[{groupId:'R',args:['stale']}],actions:[]},'tick');
      const after=(await ctx.chrome.storage.local.get({cbRuleState:{}})).cbRuleState;
      check(!result.ok && !current && !after.R && after.other.keep===9 && !run('logFeeds.has("R")'),'actual worker deleted group rejects prepared Run and delayed event memory/log revival');
    } else {
      check(!result.ok && current.activeEventSource===good && states.R.count===2 && states.other.keep===9,`actual worker ${mutation} during prepared Run preserves prior source and memory`);
      if(mutation==='disable')check(current.enabled===false,'actual worker later Disable wins over explicit Run enabling');
      if(mutation==='lock')check(current.lockedAtMs>0,'actual worker lock admitted during preparation remains active after Run refusal');
      if(mutation.endsWith('failure'))check(Array.from(sandbox.types('R')).includes('tick'),'actual worker persistence/commit failure retains prior exact handler without reinitializing it');
    }
  }
  const oldSource='(on,v)=>{v.state.url="chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/blocked.html";}';
  const migratedStore=new Map([['blockedGroups',[{id:'migrated-rule',name:'Saved rule',groupType:'custom',enabled:true,activeEventSource:oldSource,blockingRulesText:oldSource}]]]);
  const migrated=boot('chrome',migratedStore);
  migrated.chrome.tabs={query:async()=>[],sendMessage:async()=>{}};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../rule-core.js'),'utf8'),migrated);
  const engine=migrated.RuleCore.createEngine(), loaded=[];
  migrated.__transport=async request=>{
    if(request.kind==='prepare-source'){loaded.push(request.source);return engine.prepareLoad(request.groupId,request.source,request.state);}
    if(request.kind==='commit-source')return engine.commitLoad(request.token);
    if(request.kind==='discard-source')return engine.discardLoad(request.token);
    if(request.kind==='suppress-group'){engine.suppress(request.groupId,request.on);return {ok:true};}
    throw new Error(request.kind);
  };
  vm.runInContext('sendToEventSandbox=__transport',migrated);
  await vm.runInContext('ensureStartupGate()',migrated);
  check(loaded.length===1 && !loaded[0].includes('aaaaaaaa') && migratedStore.get('cbRuleState')['migrated-rule'].url==='chrome-extension://t/blocked.html','startup compiles the repaired saved source after migration, retaining initializer memory without a stale-load refusal');
  const compatibleRun=await migrated.cbRunCustomGroup('migrated-rule','(on,v)=>{v.state.runs=(v.state.runs||0)+1;}');
  check(compatibleRun.ok && migratedStore.get('cbRuleState')['migrated-rule'].runs===1,'explicit Run admits compatible unlocked omitted-lock-field storage and preserves initializer memory');
}
(async () => {
  const contractStore=new Map([['one',{nested:1}],['two',2]]);
  const contract=boot('chrome',contractStore).chrome.storage.local;
  const selected=await contract.get(['one','missing']);
  selected.one.nested=99;
  check(Object.keys(selected).join()==='one' && contractStore.get('one').nested===1,'storage fixture array-get selects existing requested keys and returns detached values');
  const all=await contract.get(null), defaults=await contract.get({one:null,missing:7});
  check(all.two===2 && defaults.one.nested===1 && defaults.missing===7,'storage fixture null-get and object-default semantics match the Chrome API');
  for(const kind of ['missing','legacy-strict','current-wait','current-pin']) {
    const raw={id:'compatible',name:'Compatible group',groupType:'site',enabled:true,scopes:[{id:'site-1',surface:'site',action:'block',sites:['compatible.example'],sitesExcept:false}]};
    if(kind==='legacy-strict')Object.assign(raw,{freezeMode:'strict',frozenAtMs:Date.now(),strictFreezeHours:1});
    if(kind==='current-wait')Object.assign(raw,{lockedAtMs:Date.now(),lockWaitHours:1});
    if(kind==='current-pin')Object.assign(raw,{lockedAtMs:Date.now(),lockWaitHours:0,parentalPasswordHash:'a'.repeat(64),parentalPasswordSalt:'b'.repeat(32)});
    const untouched={id:'untouched',name:'Untouched',groupType:'site',enabled:false,scopes:[]};
    const store=new Map([['blockedGroups',[clone(raw),clone(untouched)]]]);
    const ctx=boot('chrome',store),env={ctx,run:code=>require('node:vm').runInContext(code,ctx)};
    await env.run('cbSharingReady');
    const view=env.run('CBGroupScopes.sanitizeGroups')([raw])[0];
    const change=edit(env,view,{...view,name:'Owner saved compatible group'});
    if(kind==='missing') {
      await commit(env,[change]);await settle(env);
      check(store.get('blockedGroups')[0].name==='Owner saved compatible group' && JSON.stringify(store.get('blockedGroups')[1])===JSON.stringify(untouched),'compatible omitted lock fields admit the normalized UI edit without normalizing untouched groups');
    } else {
      await assert.rejects(commit(env,[change]),/group-locked/);
      await assert.rejects(commit(env,[edit(env,view,null)]),/group-locked/);
      await assert.rejects(commit(env,[],{order:['untouched','compatible'],movedId:'compatible'}),/group-not-editable/);
      await assert.rejects(commit(env,[edit(env,view,null),edit(env,untouched,null)],{intent:'delete-all',coveredPinHashes:[]}),/group-delete-gates-changed/);
      check(JSON.stringify(store.get('blockedGroups'))===JSON.stringify([raw,untouched]),`${kind}: effective lock protects edit/delete/reorder/delete-all and leaves raw stored groups untouched`);
    }
  }
  for(const kind of ['legacy-strict','current-wait','current-pin']) {
    const frozenRule={id:'frozen-rule',name:'Frozen rule',groupType:'custom',enabled:true,activeEventSource:'(on,v)=>{}'};
    Object.assign(frozenRule,kind==='legacy-strict'?{freezeMode:'strict',frozenAtMs:Date.now(),strictFreezeHours:1}:kind==='current-wait'?{lockedAtMs:Date.now(),lockWaitHours:1}:{lockedAtMs:Date.now(),lockWaitHours:0,parentalPasswordHash:'a'.repeat(64),parentalPasswordSalt:'b'.repeat(32)});
    const frozenStore=new Map([['blockedGroups',[clone(frozenRule)]]]);
    const frozenContext=boot('chrome',frozenStore);
    await require('node:vm').runInContext('cbSharingReady',frozenContext);
    await assert.rejects(frozenContext.cbRunCustomGroup('frozen-rule','(on,v)=>{v.state.mustNotPersist=true;}'),/group-locked/);
    check(JSON.stringify(frozenStore.get('blockedGroups'))===JSON.stringify([frozenRule]) && !frozenStore.get('cbRuleState')?.['frozen-rule']?.mustNotPersist,`${kind}: explicit Run protects effective lock without rewriting untouched raw storage`);
  }
  for (const program of ["chrome", "edge", "safari"]) {
    const env = await setup(program);
    const one = cluster(program, true);
    one.shared.scopes.push({id:"site-1",surface:"site",platform:null,action:"block",sites:["first.example"],sitesExcept:false});
    await frame(env, one); await settle(env);
    const initial = clone((await state(env)).blockedGroups[0]);
    const two = clone(one);
    two.shared.scopes.push({id:"site-2",surface:"site",platform:null,action:"pause",pauseSeconds:15,sites:["second.example"],sitesExcept:true,entryID:"site:linked_second"});
    const originalSet = env.ctx.chrome.storage.local.set;
    let enteredResolve, release;
    const entered = new Promise(resolve => { enteredResolve = resolve; });
    const hold = new Promise(resolve => { release = resolve; });
    let held = true;
    env.ctx.chrome.storage.local.set = async writes => {
      if (held && Object.hasOwn(writes, "blockedGroups")) { held=false; enteredResolve(); await hold; }
      return originalSet(writes);
    };
    const adoption = frame(env, two);
    await entered;
    const desired = clone(initial); desired.allowedMinutes=17;
    const localEdit = commit(env, [edit(env, initial, desired)]);
    release(); await adoption; await localEdit; await settle(env);
    const result = (await state(env)).blockedGroups[0];
    check(result.allowedMinutes === 17 && sites(result).length === 2, `${program}: queued owner field edit survives held adoption read-to-set without removing newer alias`);
    check(result.scopes.some(line => line.surface === "apps"), `${program}: editor patch preserves peer Apps`);
    check(positive(env).at(-1)?.scalars.allowedMinutes === 17 && positive(env).at(-1)?.scopes.length === 2, `${program}: successful owner edit explicitly publishes current two-site definition`);
    env.ctx.__sent.length=0;
    const delayed=env.ctx.__storageChanges.splice(0);
    await deliver(env, [...delayed].reverse()); await deliver(env, delayed); await deliver(env, delayed);
    check(positive(env).length === 0, `${program}: delayed reversed duplicate historical notifications emit no positive definition`);
    check(sites((await state(env)).blockedGroups[0]).length === 2, `${program}: current storage retains newer alias after old notifications`);
    const beforeRestore = clone((await state(env)).blockedGroups[0]);
    const restored = clone(beforeRestore); restored.allowedMinutes=initial.allowedMinutes;
    await commit(env, [edit(env,beforeRestore,restored)]); await settle(env);
    check(positive(env).length === 1 && positive(env)[0].scalars.allowedMinutes === initial.allowedMinutes, `${program}: deliberate owner restoration matching historical state is published`);
    env.ctx.__sent.length=0;
    await deliver(env, [...env.ctx.__storageChanges.splice(0), ...delayed]);
    check(positive(env).length === 0, `${program}: restoration acknowledgement does not echo`);
    const beforeRenumber=clone((await state(env)).blockedGroups[0]);
    const renumbered=clone(two);renumbered.shared.scalars.allowedMinutes=beforeRenumber.allowedMinutes;
    const alias=clone(renumbered.shared.scopes.find(line=>line.entryID));alias.id="site-1";
    const base=clone(renumbered.shared.scopes.find(line=>line.surface==="site" && !line.entryID));base.id="site-2";
    renumbered.shared.scopes=renumbered.shared.scopes.filter(line=>line.surface!=="site").concat([alias,base]);
    await frame(env,renumbered);await settle(env);
    const editedAlias=clone(beforeRenumber);editedAlias.scopes.find(line=>line.entryID).sites=["changed-alias.example"];
    await commit(env,[edit(env,beforeRenumber,editedAlias)]);await settle(env);
    check((await state(env)).blockedGroups[0].scopes.find(line=>line.entryID).sites.join()==="changed-alias.example" && (await state(env)).blockedGroups[0].scopes.find(line=>line.surface==="site" && !line.entryID).sites.join()==="first.example",`${program}: entry-targeted queued edit survives hub line-ID renumbering without editing another Website`);
    const beforeAmbiguous=clone((await state(env)).blockedGroups[0]);
    const ambiguous=clone(renumbered);
    ambiguous.shared.scopes.push({...clone(base),id:"site-3",action:"pause",sites:["other-branch.example"],sitesExcept:true});
    await frame(env,ambiguous);await settle(env);
    const ambiguousEdit=clone(beforeAmbiguous);ambiguousEdit.scopes.find(line=>line.surface==="site" && !line.entryID).sites=["must-not-target-wrong-branch.example"];
    await assert.rejects(commit(env,[edit(env,beforeAmbiguous,ambiguousEdit)]), /ambiguous-scope-edit/);
    check(!(await state(env)).blockedGroups[0].scopes.some(line=>line.sites?.includes("must-not-target-wrong-branch.example")),`${program}: a reordered repeated entry/surface cannot receive an ambiguous old-view edit`);
    await frame(env,renumbered);await settle(env);
    const beforeDelete = clone((await state(env)).blockedGroups[0]);
    const deleted = clone(beforeDelete); deleted.scopes=deleted.scopes.filter(line => !line.entryID);
    await commit(env,[edit(env,beforeDelete,deleted)]); await settle(env);
    check(sites((await state(env)).blockedGroups[0]).length === 1 && positive(env).at(-1)?.scopes.length === 1, `${program}: explicit alias deletion changes current state and publishes intent`);
    const noOp = clone((await state(env)).blockedGroups[0]);
    env.ctx.__sent.length=0; env.ctx.__storageChanges.length=0;
    await commit(env,[edit(env,noOp,noOp)]); await settle(env);
    check(env.ctx.__storageChanges.length === 0 && positive(env).length === 0, `${program}: no-op completes without waiting for an onChanged event`);
    let fail=true;
    env.ctx.chrome.storage.local.set=async writes => { if (fail && Object.hasOwn(writes,"blockedGroups")) {fail=false;throw new Error("disk-full");} return originalSet(writes); };
    const failed=clone(noOp); failed.enabled=false;
    await assert.rejects(commit(env,[edit(env,noOp,failed)]), /disk-full/);
    check((await state(env)).blockedGroups[0].enabled === noOp.enabled && positive(env).length === 0, `${program}: failed write neither changes state nor publishes intent`);
    await commit(env,[edit(env,noOp,failed)]); await settle(env);
    check((await state(env)).blockedGroups[0].enabled === false && positive(env).length === 1, `${program}: queue recovers after failed write and publishes next successful edit`);
    const added=await env.run("cbBrowserRequestBody")("settings-create-group",{groupType:"site",patch:{name:"Independent order control",enabled:false,sites:["order.example"]}});
    await commit(env,[],{order:[added.group.id,"L"],movedId:added.group.id}); await settle(env);
    check((await state(env)).blockedGroups.map(group=>group.id).join()===`${added.group.id},L`, `${program}: queued reorder changes only local order`);
    await env.run("cbBrowserRequestBody")("settings-delete-group",{id:added.group.id});await settle(env);
    const beforeLock=clone((await state(env)).blockedGroups[0]);
    const lockFrame=clone(two); lockFrame.shared.lock={lockedAtMs:Date.now(),lockWaitHours:1,parentalPasswordHash:null,parentalPasswordSalt:null,lockVersion:1};
    await frame(env,lockFrame); await settle(env);
    await assert.rejects(commit(env,[edit(env,beforeLock,{...beforeLock,enabled:true})]), /group-lock-changed/);
    check((await state(env)).blockedGroups[0].lockedAtMs > 0, `${program}: latest lock rejects a stale editor enable`);
    const lockedBefore=clone((await state(env)).blockedGroups[0]);
    await assert.rejects(commit(env,[edit(env,lockedBefore,{...lockedBefore,allowedMinutes:31})]), /group-locked/);
    await assert.rejects(commit(env,[edit(env,lockedBefore,null)]), /group-locked/);
    check((await state(env)).blockedGroups[0].allowedMinutes !== 31, `${program}: matching active lock metadata cannot admit ordinary policy or delete requests`);
    const tightened = env.run("CBGroupActions.tighten")(lockedBefore,{waitHours:2}).group;
    await commit(env,[edit(env,lockedBefore,tightened)],{intent:"lock-fields"}); await settle(env);
    check((await state(env)).blockedGroups[0].lockWaitHours === 2, `${program}: existing explicit lock-gate tightening still works`);
    const lockedCurrent=clone((await state(env)).blockedGroups[0]);
    await assert.rejects(commit(env,[edit(env,lockedCurrent,env.run("CBGroupActions.unlock")(lockedCurrent))],{intent:"lock-fields"}), /group-unlock-wait/);
    await assert.rejects(commit(env,[edit(env,lockedCurrent,null)],{intent:"delete-all",coveredPinHashes:[]}), /group-delete-gates-changed/);
    check((await state(env)).blockedGroups.length === 1, `${program}: current wait gate protects explicit unlock and delete-all flows`);
    const unlocked=clone(lockFrame); unlocked.shared.lock={lockedAtMs:null,lockWaitHours:0,parentalPasswordHash:null,parentalPasswordSalt:null,lockVersion:3};
    await frame(env,unlocked); await settle(env);
    const beforeRemove=clone((await state(env)).blockedGroups[0]);
    await env.ctx.chrome.storage.local.set({cbRuleState:{L:{keepUntilDelete:true},other:{keep:9}},usageTimersMs:{L:45,other:90},groupSnoozes:{L:{kind:"time",startsAtMs:1,untilMs:2},other:{kind:"time",startsAtMs:1,untilMs:2}}});
    let attemptedDelete;
    env.ctx.chrome.storage.local.set=async writes => { if(Object.hasOwn(writes,"blockedGroups")) attemptedDelete=clone(writes);return originalSet(writes); };
    await commit(env,[edit(env,beforeRemove,null)]); await settle(env);
    const cleaned=await env.ctx.chrome.storage.local.get({cbRuleState:{},usageTimersMs:{},groupSnoozes:{}});
    check(attemptedDelete.blockedGroups.length === 0 && attemptedDelete.cbRuleState && !Object.hasOwn(attemptedDelete.cbRuleState,"L") && !cleaned.cbRuleState.L && cleaned.cbRuleState.other.keep === 9 && cleaned.usageTimersMs.other === 90, `${program}: deletion and associated state cleanup commit atomically, preserving other groups`);
    await assert.rejects(commit(env,[edit(env,beforeRemove,{...beforeRemove,name:"resurrect"})]), /group-not-found/);
    check((await state(env)).blockedGroups.length === 0, `${program}: late field edit cannot resurrect deleted group`);
    await deliver(env,env.ctx.__storageChanges.splice(0));
    check((await state(env)).blockedGroups.length === 0, `${program}: deletion survives delayed historical notifications`);
  }
  const seedEnv=await setup();
  const forbidden = {type:'editor-definition-edit',changes:[{id:'untrusted',create:{id:'untrusted',name:'wrong context'}}]};
  let rejected;
  for (const listener of seedEnv.ctx.__messageListeners) listener(forbidden,{id:'t',url:'https://example.com/'},reply=>{rejected=reply;});
  check(rejected?.error==='editor-only' && !(await state(seedEnv)).blockedGroups.some(group=>group.id==='untrusted'), 'actual runtime listener refuses editor mutation from a content-page sender');
  const startupGroup=clone((await state(seedEnv)).blockedGroups[0]);
  const startupStore=new Map([["blockedGroups",[startupGroup]],["globalSettings",{defaultFallbackUrl:"chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/blocked.html"}]]);
  const restarted=boot("chrome",startupStore);
  const desired={...startupGroup,allowedMinutes:43};
  // Submit before startup migration has resolved its asynchronous reads.
  const request=restarted.CBGroupScopes.editorChange(startupGroup,desired,"browser");
  await restarted.cbApplyEditorRequest({changes:[request]});
  const migrated=startupStore.get("blockedGroups")[0];
  check(migrated.allowedMinutes===43 && migrated.fallbackUrl==="chrome-extension://t/blocked.html" && !Object.hasOwn(startupStore.get("globalSettings"),"defaultFallbackUrl"),"startup migration completes before admission and edited field preserves inherited URL repair");
  const second=boot("chrome",startupStore);await require("node:vm").runInContext("cbSharingReady",second);
  check(startupStore.get("blockedGroups")[0].allowedMinutes===43 && require("node:vm").runInContext("cbDefinitionSeen.get('L')===cbDefinitionKey(cbCommittedDefinitionGroups[0])",second),"worker restart establishes current seen baseline without persisted origin fields");
  await runQueueControls();
  console.log(`DEFINITION WORKER QUEUE ${passed} PASS`);
  console.log("__CB_TEST_RESULT__: OK");
  process.exit(0);
})().catch(error => {console.error(error);process.exit(1);});
