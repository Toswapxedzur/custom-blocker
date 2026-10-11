"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const ctx = vm.createContext({ console, crypto:globalThis.crypto, TextEncoder });
for (const file of ["platform-profiles.js", "parental-pin.js", "group-actions.js", "group-scopes.js"])
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"),ctx,{filename:file});
const S=ctx.CBGroupScopes, clone=value=>JSON.parse(JSON.stringify(value));
let passed=0;
function check(label,test) {test();passed++;console.log(`PASS ${label}`);}
const now=Date.UTC(2026,9,11,12);
const original=S.sanitizeGroups([{id:"linked",name:"Old20",enabled:true,allowedMinutes:20,scopes:[
  {surface:"apps",action:"block",apps:[{id:"old.app"}],appsExcept:false},
  {surface:"site",action:"block",sites:["example.com"],sitesExcept:false}
]}])[0];
const latest=S.sanitizeGroups([{...original,name:"New24",allowedMinutes:24,scopes:[...original.scopes,
  {surface:"site",entryID:"site:linked_0123456789abcdef01234567",action:"pause",sites:["safe.example"],sitesExcept:true}
]}])[0];
const appEdit={...original,scopes:S.mergeFlatIntoScopes(original.scopes,{apps:[{id:"new.app"}],appsAllowlist:false},"apps")};
const request={changes:[S.editorChange(original,appEdit,"desktop")]};
const apply=(groups,input,owner="desktop",context={})=>S.applyEditorRequest(groups,input,owner,{nowMs:now,...context}).groups;
const refusal=(groups,input,error,owner="desktop",context={})=>{
  const before=JSON.stringify(groups);
  assert.throws(()=>apply(groups,input,owner,context),error);
  assert.equal(JSON.stringify(groups),before,"refusal must leave input unchanged");
};
check("native Apps-only edit retains newer shared scalars and independent websites",()=>{
  const next=apply([latest],request)[0];
  assert.equal(next.name,"New24");assert.equal(next.allowedMinutes,24);
  assert.equal(next.scopes.filter(l=>l.surface==="site").length,2);
  assert.equal(next.scopes.find(l=>l.surface==="apps").apps[0].id,"new.app");
});
check("native intended scalar edit remains explicit while newer unrelated value survives",()=>{
  const next=apply([latest],{changes:[S.editorChange(original,{...original,name:"Owner rename"},"desktop")]})[0];
  assert.equal(next.name,"Owner rename");assert.equal(next.allowedMinutes,24);
});
check("native group creation admits Apps and refuses Website ownership",()=>{
  const own=S.newGroup("site",{name:"Native new"},"desktop");
  assert.equal(apply([],{changes:[S.editorChange(null,own,"desktop")]}).length,1);
  refusal([],{changes:[S.editorChange(null,original,"desktop")]},/invalid-group-create/);
});
check("custom native draft edit preserves newer policy and active source",()=>{
  const before=S.sanitizeGroups([{id:"custom",groupType:"custom",blockingRulesText:"draft old",activeEventSource:"active original",allowedMinutes:20,scopes:[]}])[0];
  const current={...before,allowedMinutes:24,activeEventSource:"active new"};
  const next=apply([current],{changes:[S.editorChange(before,{...before,blockingRulesText:"draft new"},"desktop")]})[0];
  assert.equal(next.blockingRulesText,"draft new");assert.equal(next.activeEventSource,"active new");assert.equal(next.allowedMinutes,24);
});
check("browser editing keeps desktop Apps and uses backend read-only context",()=>{
  const after={...original,scopes:S.mergeFlatIntoScopes(original.scopes,{sites:["owner.example"]},"site")};
  const intent={changes:[S.editorChange(original,after,"browser")]};
  const next=apply([latest],intent,"browser")[0];
  assert.equal(next.scopes.find(l=>l.surface==="apps").apps[0].id,"old.app");
  refusal([latest],{...intent,readOnlyGroupIds:[]},/desktop-unavailable/,"browser",{readOnlyGroupIds:["linked"]});
});
check("refused later operation cannot partially apply an earlier edit/create/delete",()=>{
  const newGroup=S.newGroup("site",{},"desktop");
  for(const first of [S.editorChange(original,{...original,name:"Must not commit"},"desktop"),S.editorChange(null,newGroup,"desktop"),S.editorChange(original,null,"desktop")])
    refusal([latest],{changes:[first,{id:"missing",lock:{},fields:{set:{name:"bad"},remove:[]}}]},/group-not-found/);
});
check("delayed ordinary edit and delete refuse current and legacy effective locks",()=>{
  for(const locked of [{...latest,lockedAtMs:now-1000,lockWaitHours:1,lockVersion:1},
    {...latest,lockedAtMs:undefined,freezeMode:"strict",frozenAtMs:now-1000,strictFreezeHours:1}]) {
    const view=S.editorEffectiveGroup(locked);
    refusal([locked],{changes:[S.editorChange(view,{...view,name:"Refused"},"desktop")]},/group-locked/);
    refusal([locked],{changes:[S.editorChange(view,null,"desktop")]},/group-locked/);
  }
});
check("stale lock unit refuses despite unchanged policy intent",()=>{
  refusal([{...latest,lockVersion:3}],request,/group-lock-changed/);
});
check("compatible omitted lock fields admit without rewriting untouched groups",()=>{
  const raw={id:"raw",name:"Compatible",scopes:[]};
  const untouched={id:"untouched",name:"Keep raw",scopes:[]};
  const view=S.sanitizeGroups([raw])[0];
  const out=apply([raw,untouched],{changes:[S.editorChange(view,{...view,name:"Saved"},"desktop")]});
  assert.equal(out[0].name,"Saved");assert.equal(out[1],untouched);assert.equal(Object.hasOwn(out[1],"lockWaitHours"),false);
});
check("lock intent preserves stricter-only and unlock wait gates",()=>{
  const locked={...latest,lockedAtMs:now-1000,lockWaitHours:1,lockVersion:2};
  const lockRequest=after=>({intent:"lock-fields",changes:[S.editorChange(locked,after,"desktop")]});
  assert.equal(apply([locked],lockRequest({...locked,lockWaitHours:2,lockVersion:3}))[0].lockWaitHours,2);
  refusal([locked],lockRequest({...locked,lockWaitHours:0,lockVersion:3}),/lock-not-stricter/);
  refusal([locked],lockRequest({...locked,lockedAtMs:null,lockWaitHours:0,lockVersion:3}),/group-unlock-wait/);
  refusal([locked],lockRequest({...locked,name:"Not lock data"}),/invalid-lock-edit/);
});
check("delete-all checks the latest wait and PIN union before any deletion",()=>{
  const held={...latest,lockedAtMs:now-1000,lockWaitHours:1};
  refusal([held],{intent:"delete-all",changes:[S.editorChange(held,null,"desktop")]},/group-delete-gates-changed/);
  const pinned={...latest,lockedAtMs:now-1000,lockWaitHours:0,parentalPasswordHash:"hash",parentalPasswordSalt:"salt"};
  const input={intent:"delete-all",changes:[S.editorChange(pinned,null,"desktop")]};
  refusal([pinned],input,/group-delete-gates-changed/);
  assert.equal(apply([pinned],{...input,coveredPinHashes:["hash"]}).length,0);
});
check("native reorder preserves new groups and refuses locked moved group",()=>{
  const other={id:"other",name:"Other",scopes:[]}, late={id:"late",name:"Late",scopes:[]};
  const input={changes:[],order:["other","linked"],movedId:"linked"};
  const result=apply([latest,other,late],input);
  assert.equal(result.map(g=>g.id).join(),"other,linked,late");assert.equal(result[0],other);
  refusal([{...latest,lockedAtMs:now},other],input,/group-not-editable/);
});
check("scope editing targets stable identity despite native line renumbering",()=>{
  const renumbered={...latest,scopes:latest.scopes.map((l,i)=>({...l,id:`renumbered-${i}`}))};
  const next=apply([renumbered],request)[0];
  assert.equal(next.scopes.find(l=>l.surface==="apps").apps[0].id,"new.app");
  assert.equal(next.scopes.filter(l=>l.surface==="site").length,2);
});
check("ambiguous repeated Apps identity safely refuses stale edit",()=>{
  const repeated={...latest,scopes:[...latest.scopes,clone(latest.scopes.find(l=>l.surface==="apps"))]};
  refusal([repeated],request,/ambiguous-scope-edit/);
});
check("native runtime state remains outside pure definition result",()=>{
  const result=S.applyEditorRequest([latest],request,"desktop",{nowMs:now});
  assert.equal(Object.keys(result).join(),"groups");assert.equal(Object.hasOwn(result,"usageTimersMs"),false);
});
console.log(`SHARED EDITOR INTENT TOTAL ${passed} PASS ${passed} FAIL 0\n__CB_TEST_RESULT__: OK`);
