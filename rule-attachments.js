/* Persistent, group-owned content attachments. The worker owns every write. */
(function(root){
  'use strict';
  const KEY='cbRuleAttachments',MAX_BYTES=8_000_000;
  const size=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
  function decode(value) {
    if(value===undefined)return {version:1,groups:Object.create(null)};
    if(!value||value.version!==1||!value.groups||Array.isArray(value.groups)||typeof value.groups!=='object'||size(value)>MAX_BYTES)throw Error('attachment-storage-unavailable');
    const copy=JSON.parse(JSON.stringify(value));copy.groups=Object.assign(Object.create(null),copy.groups);return copy;
  }
  function createBroker({storage,groupsKey,send,check,serial,isCurrent=()=>true,epoch=()=>0,click}) {
    const C=root.VaultContentItems,bindings=new Map(),savedGroups=new Set();let sequence=0,latestDoc={version:1,groups:{}};
    async function read(){const raw=await storage.get([groupsKey,KEY]);const doc=decode(raw[KEY]);latestDoc=doc;savedGroups.clear();for(const key of Object.keys(doc.groups))savedGroups.add(key);return {doc,groups:Array.isArray(raw[groupsKey])?raw[groupsKey]:[]};}
    function itemsForGroup(groupId,items){return items.map(item=>({...item,attachments:Object.fromEntries(Object.entries(latestDoc.groups[groupId]?.[item.contentId]||{}).map(([id,record])=>[id,C.spec(record.spec)]))}));}
    function active(groups,id){return groups.find(g=>g.id===id&&g.groupType==='custom'&&g.enabled===true);}
    function binding(tabId,value){const page=bindings.get(tabId),item=page?.items.get(value?.instanceId);return item&&item.contentId===value.contentId&&item.ref===value.ref?{page,item}:null;}
    async function publish(tabId,state) {
      const page=bindings.get(tabId);if(!page)return;
      const items=[];
      for(const item of page.items.values()) {
        const attachments=[];
        for(const group of state.groups)if(active(state.groups,group.id)) {
          const records=state.doc.groups[group.id]?.[item.contentId]||{};
          for(const [id,record] of Object.entries(records)) {
            if(!record||typeof record.revision!=='string')throw Error('attachment-storage-unavailable');
            attachments.push({groupId:group.id,id,revision:record.revision,spec:C.spec(record.spec)});
          }
        }
        items.push({target:C.target(item),attachments});
      }
      let batch=[],size=0;
      async function flush(){if(!batch.length)return;await send(tabId,{type:'rule-attachments',pageToken:page.token,itemsEpoch:page.epoch,sequence:++sequence,items:batch},page.documentId);batch=[];size=0;}
      for(const item of items){const bytes=JSON.stringify(item).length;if(size+bytes>150000)await flush();batch.push(item);size+=bytes;}
      await flush();
    }
    async function refreshLocked(){const state=await read();for(const tab of bindings.keys())await publish(tab,state);}
    async function applyBatchLocked(actions,generations) {
      const checked=[],errors=[],checks=new Map();
      for(const action of actions) {
        try {
          const target=C.target(action.target),tabId=action.tabId,id=action.attachmentId;
          if(!Number.isInteger(tabId)||typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw Error('attachment-invalid-input');
          const found=binding(tabId,target);if(!found)throw Error('attachment-stale-target');
          const checkKey=tabId+':'+target.instanceId;
          if(!checks.has(checkKey))checks.set(checkKey,await check(tabId,{type:'rule-attachment-check',pageToken:found.page.token,target},found.page.documentId));
          if(!checks.get(checkKey))throw Error('attachment-stale-target');
          checked.push({action,target,found,value:action.spec===null?null:C.spec(action.spec)});
        }catch(error){errors.push({action,error});}
      }
      const state=await read(),before=JSON.stringify(state.doc);
      for(const {action,target,found,value} of checked) {
        try {
          const {groupId,attachmentId:id,tabId}=action;
          if(!active(state.groups,groupId)||!isCurrent(groupId,generations?.get(groupId))||binding(tabId,target)?.page!==found.page)throw Error('attachment-stale-target');
          const byContent=Object.assign(Object.create(null),state.doc.groups[groupId]||{}),records=Object.assign(Object.create(null),byContent[target.contentId]||{});
          if(value===null)delete records[id];
          else {
            if(!records[id]&&Object.keys(records).length>=8)throw Error('attachment-item-limit');
            const total=Object.values(state.doc.groups).reduce((count,group)=>count+Object.keys(group[target.contentId]||{}).length,0);
            if(!records[id]&&total>=32)throw Error('attachment-item-limit');
            if(JSON.stringify(records[id]?.spec)!==JSON.stringify(value))records[id]={spec:value,revision:C.id()};
          }
          if(Object.keys(records).length)byContent[target.contentId]=records;else delete byContent[target.contentId];
          if(Object.keys(byContent).length>10000)throw Error('attachment-storage-limit');
          const candidate={version:1,groups:Object.assign(Object.create(null),state.doc.groups)};
          if(Object.keys(byContent).length)candidate.groups[groupId]=byContent;else delete candidate.groups[groupId];
          if(size(candidate)>MAX_BYTES)throw Error('attachment-storage-limit');
          state.doc=candidate;
        }catch(error){errors.push({action,error});}
      }
      if(JSON.stringify(state.doc)!==before) {
        // One atomic save and one set of tab snapshots for the whole dispatch.
        await storage.set({[KEY]:state.doc});
        latestDoc=state.doc;savedGroups.clear();for(const key of Object.keys(state.doc.groups))savedGroups.add(key);
        for(const tab of bindings.keys())await publish(tab,state);
      }
      return errors;
    }
    async function pruneLocked(groups){const state=await read(),ids=new Set(groups.filter(g=>g.groupType==='custom').map(g=>g.id));let changed=false;
        for(const key of Object.keys(state.doc.groups))if(!ids.has(key)){delete state.doc.groups[key];savedGroups.delete(key);changed=true;}
        if(changed){await storage.set({[KEY]:state.doc});latestDoc=state.doc;}
    }
    return {
      hasGroup:id=>savedGroups.has(id),
      itemsForGroup,
      load:()=>serial(async()=>pruneLocked((await read()).groups)),
      forget:tabId=>bindings.delete(tabId),
      async observe(sender,message) {
        return serial(async()=>{
          if(sender.frameId&&sender.frameId!==0)return [];
          const tabId=sender.tab?.id,token=message.pageToken;
          if(!Number.isInteger(tabId)||typeof token!=='string'||token.length>128||!Array.isArray(message.items)||message.itemsEpoch!==epoch())return [];
          if(sender.url&&sender.tab?.url&&sender.url.split('#')[0]!==sender.tab.url.split('#')[0])return [];
          let page=bindings.get(tabId);
          if(!page||page.token!==token||page.documentId!==sender.documentId||page.epoch!==message.itemsEpoch) {page={token,epoch:message.itemsEpoch,documentId:sender.documentId,items:new Map()};bindings.set(tabId,page);}
          const accepted=[];
          for(const raw of message.items.slice(0,500)) {
            let value;try{value=C.target(raw);}catch{continue;}
            if(!value.instanceId.startsWith(token+':'))continue;
            // Content identity is derived independently from the item's URL.
            if(C.contentId(message.platform,raw.url)!==value.contentId)continue;
            const item={...raw,...value};page.items.set(value.instanceId,item);accepted.push(item);
          }
          while(page.items.size>3000)page.items.delete(page.items.keys().next().value);
          await publish(tabId,await read());return accepted;
        });
      },
      applyBatchLocked,
      async applyLocked(action,generation) {
        const errors=await applyBatchLocked([action],new Map([[action.groupId,generation]]));
        if(errors.length)throw errors[0].error;
      },
      async handleClick(sender,message,generation) {
        const data=await serial(async()=>{
          const found=binding(sender.tab?.id,message.target);if(!found||found.page.token!==message.pageToken||found.page.documentId!==sender.documentId)return null;
          const state=await read(),record=state.doc.groups[message.groupId]?.[message.target.contentId]?.[message.attachmentId];
          if(!active(state.groups,message.groupId)||!isCurrent(message.groupId,generation)||!record||record.revision!==message.revision)return null;
          if(!await check(sender.tab.id,{type:'rule-attachment-check',pageToken:found.page.token,target:message.target},found.page.documentId))return null;
          return {eventName:'click',attachmentId:message.attachmentId,tabId:sender.tab.id,item:itemsForGroup(message.groupId,[found.item])[0],text:record.spec.text};
        });
        if(data)await click(message.groupId,data,generation);
      },
      refresh:()=>serial(refreshLocked)
    };
  }
  const api=Object.freeze({createBroker,decode,key:KEY});root.CBRuleAttachments=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
