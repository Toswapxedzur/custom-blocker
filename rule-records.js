/* Generic, group-owned JSON records. No content, label or AI semantics. */
(function(root){
  'use strict';
  const KEY='cbRuleRecords',MAX_BYTES=16*1024*1024,MAX_VALUE=64*1024;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const bytes=v=>new TextEncoder().encode(JSON.stringify(v)).length;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const map=v=>Object.assign(Object.create(null),v||{});
  const fail=message=>{throw Error(message);};
  function data(value,depth=0){
    if(depth>32)fail('store-value-depth');
    if(value===null||typeof value==='string'||typeof value==='boolean')return;
    if(typeof value==='number'&&Number.isFinite(value))return;
    if(Array.isArray(value)){for(const entry of value)data(entry,depth+1);return;}
    if(object(value)){for(const entry of Object.values(value))data(entry,depth+1);return;}
    fail('store-invalid-value');
  }
  function decode(raw){
    if(raw===undefined)return {version:1,groups:map()};
    try{
      if(!object(raw)||raw.version!==1||!object(raw.groups)||Object.keys(raw).some(k=>!['version','groups'].includes(k))||bytes(raw)>MAX_BYTES)fail();
      const doc={version:1,groups:map()};
      for(const [group,entries] of Object.entries(raw.groups)){
        if(!group||group.length>512||!object(entries)||Object.keys(entries).length>10000)fail();
        const records=map();
        for(const [key,record] of Object.entries(entries)){
          if(!key||key.length>2048||!object(record)||Object.keys(record).some(k=>!['value','revision','version','updatedAt'].includes(k))||!Object.hasOwn(record,'value')||typeof record.revision!=='string'||!record.revision||record.revision.length>128||typeof record.version!=='string'||record.version.length>128||!Number.isSafeInteger(record.updatedAt)||record.updatedAt<0||bytes(record.value)>MAX_VALUE)fail();
          data(record.value);records[key]=clone(record);
        }
        doc.groups[group]=records;
      }
      return doc;
    }catch{fail('store-unavailable');}
  }
  function request(raw){
    if(!object(raw)||!['get','put','delete','list','clear'].includes(raw.op))fail('store-invalid-request');
    const keys={get:['op','key'],put:['op','key','value','ifRevision','version'],delete:['op','key','ifRevision'],list:['op','prefix','after','limit'],clear:['op','prefix']}[raw.op];
    if(Object.keys(raw).some(k=>!keys.includes(k)))fail('store-invalid-request');
    if(['get','put','delete'].includes(raw.op)&&(typeof raw.key!=='string'||!raw.key||raw.key.length>2048))fail('store-invalid-key');
    if(Object.hasOwn(raw,'ifRevision')&&raw.ifRevision!==null&&(typeof raw.ifRevision!=='string'||!raw.ifRevision||raw.ifRevision.length>128))fail('store-invalid-revision');
    for(const key of ['prefix','after'])if(raw[key]!==undefined&&(typeof raw[key]!=='string'||raw[key].length>2048))fail('store-invalid-request');
    if(raw.limit!==undefined&&(!Number.isSafeInteger(raw.limit)||raw.limit<1||raw.limit>100))fail('store-invalid-request');
    if(raw.op==='put'){
      if(!Object.hasOwn(raw,'value')||bytes(raw.value)>MAX_VALUE)fail('store-value-limit');
      data(raw.value);
      if(raw.version!==undefined&&(typeof raw.version!=='string'||raw.version.length>128))fail('store-invalid-version');
    }
    return raw;
  }
  function transact(raw,group,options,now,revision){
    if(typeof group!=='string'||!group||group.length>512||!Number.isSafeInteger(now)||now<0||typeof revision!=='string'||!revision||revision.length>128)fail('store-invalid-request');
    const doc=decode(raw),q=request(options),records=map(doc.groups[group]);
    const old=records[q.key],reply={ok:true,op:q.op};let changed=false;
    if(q.key!==undefined)reply.key=q.key;
    if(q.op==='get')reply.record=old||null;
    else if(q.op==='list'){
      const rows=[];let budget=0,next=null;
      for(const key of Object.keys(records).sort().filter(k=>k.startsWith(q.prefix||'')&&k>(q.after||''))){
        const {value,...header}=records[key],row={key,...header},cost=bytes(row);
        if(rows.length>=(q.limit||50)||budget+cost>96000){next=rows.at(-1)?.key||null;break;}
        rows.push(row);budget+=cost;
      }
      reply.entries=rows;reply.next=next;
    }else if(q.op==='clear'){
      let count=0;for(const key of Object.keys(records))if(key.startsWith(q.prefix||'')){delete records[key];count++;}
      reply.deleted=count;changed=count>0;
    }else{
      if(Object.hasOwn(q,'ifRevision')&&(q.ifRevision===null?!!old:old?.revision!==q.ifRevision))return {document:doc,changed:false,reply:{ok:false,op:q.op,key:q.key,error:'store-conflict',record:old||null}};
      if(q.op==='delete'){changed=!!old;delete records[q.key];reply.record=null;}
      else{
        const version=q.version||'';
        changed=!old||old.version!==version||JSON.stringify(old.value)!==JSON.stringify(q.value);
        if(changed)records[q.key]={value:clone(q.value),revision,version,updatedAt:now};
        reply.record=records[q.key];
      }
    }
    if(changed){
      if(Object.keys(records).length>10000)fail('store-entry-limit');
      if(Object.keys(records).length)doc.groups[group]=records;else delete doc.groups[group];
      if(bytes(doc)>MAX_BYTES)fail('store-quota');
    }
    return {document:doc,changed,reply};
  }
  function prune(raw,ids){const doc=decode(raw),keep=new Set(ids);let changed=false;for(const group of Object.keys(doc.groups))if(!keep.has(group)){delete doc.groups[group];changed=true;}return {document:doc,changed};}
  const budgets=new Map();let budgetStart=0,budgetTotal=0;
  function admit(group,now){
    if(now<budgetStart||now-budgetStart>=1000){budgetStart=now;budgetTotal=0;budgets.clear();}
    const entry=budgets.get(group)||{count:0,notified:false};entry.count++;budgetTotal++;budgets.set(group,entry);
    if(entry.count<=32&&budgetTotal<=128)return 'ok';
    if(!entry.notified){entry.notified=true;return 'busy';}return 'drop';
  }
  function createBroker({storage,groupsKey,serial,isCurrent,reply}){
    async function run(action,generation){
      if(!isCurrent(action.groupId,generation))return;
      const admission=admit(action.groupId,Date.now());
      if(admission!=='ok'){
        if(admission==='busy')await reply(action.groupId,{ok:false,error:'store-busy',requestId:action.requestId,generation:action.generation},generation);
        return;
      }
      const answer=await serial(async()=>{
        const raw=await storage.get([KEY,groupsKey]);
        if(!(raw[groupsKey]||[]).some(g=>g.id===action.groupId&&g.groupType==='custom'&&g.enabled===true)||!isCurrent(action.groupId,generation))return null;
        try{
          const result=transact(raw[KEY],action.groupId,JSON.parse(action.payload),Date.now(),root.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
          if(!isCurrent(action.groupId,generation))return null;
          if(result.changed)await storage.set({[KEY]:result.document});
          return result.reply;
        }catch(error){return {ok:false,error:String(error?.message||'store-unavailable')};}
      });
      if(answer&&isCurrent(action.groupId,generation))await reply(action.groupId,{...answer,requestId:action.requestId,generation:action.generation},generation);
    }
    async function pruneLocked(groups){const raw=await storage.get(KEY),result=prune(raw[KEY],groups.filter(g=>g.groupType==='custom').map(g=>g.id));if(result.changed)await storage.set({[KEY]:result.document});}
    return {run,pruneLocked};
  }
  root.VaultRuleRecords=Object.freeze({key:KEY,decode,request,transact,prune,admit,createBroker});
  if(typeof module!=='undefined')module.exports=root.VaultRuleRecords;
})(typeof globalThis!=='undefined'?globalThis:this);
