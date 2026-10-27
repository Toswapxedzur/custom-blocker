/* Persistent, group-owned content attachments. The worker owns every write. */
(function(root){
  'use strict';
  const KEY='cbRuleAttachments',MAX_BYTES=8_000_000;
  function decode(value) {
    if(value===undefined)return {version:1,groups:Object.create(null)};
    if(!value||value.version!==1||!value.groups||Array.isArray(value.groups)||typeof value.groups!=='object'||JSON.stringify(value).length>MAX_BYTES)throw Error('attachment-storage-unavailable');
    const copy=JSON.parse(JSON.stringify(value));copy.groups=Object.assign(Object.create(null),copy.groups);return copy;
  }
  function createBroker({storage,groupsKey,send,check,serial,isCurrent=()=>true,epoch=()=>0,click}) {
    const C=root.VaultContentItems,bindings=new Map(),savedGroups=new Set();let sequence=0;
    async function read(){const raw=await storage.get({[groupsKey]:[],[KEY]:undefined});const doc=decode(raw[KEY]);savedGroups.clear();for(const key of Object.keys(doc.groups))savedGroups.add(key);return {doc,groups:Array.isArray(raw[groupsKey])?raw[groupsKey]:[]};}
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
      await send(tabId,{type:'rule-attachments',pageToken:page.token,itemsEpoch:page.epoch,sequence:++sequence,items},page.documentId);
    }
    async function refreshLocked(){const state=await read();for(const tab of bindings.keys())await publish(tab,state);}
    return {
      hasGroup:id=>savedGroups.has(id),
      load:()=>serial(read),
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
      // Caller holds the definition queue; generation is checked both before
      // awaiting the page and immediately before the authoritative save.
      async applyLocked(action,generation) {
        const target=C.target(action.target),tabId=action.tabId,id=action.attachmentId,groupId=action.groupId;
        if(!Number.isInteger(tabId)||typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw Error('attachment-invalid-input');
        const found=binding(tabId,target);if(!found)throw Error('attachment-stale-target');
        if(!await check(tabId,{type:'rule-attachment-check',pageToken:found.page.token,target},found.page.documentId))throw Error('attachment-stale-target');
        const state=await read();
        if(!active(state.groups,groupId)||!isCurrent(groupId,generation)||binding(tabId,target)?.page!==found.page)throw Error('attachment-stale-target');
        const value=action.spec===null?null:C.spec(action.spec);
        const byContent=Object.assign(Object.create(null),state.doc.groups[groupId]||{}),records=Object.assign(Object.create(null),byContent[target.contentId]||{});
        if(value===null)delete records[id];
        else {
          if(!records[id]&&Object.keys(records).length>=8)throw Error('attachment-item-limit');
          if(JSON.stringify(records[id]?.spec)!==JSON.stringify(value))records[id]={spec:value,revision:C.id()};
        }
        if(Object.keys(records).length)byContent[target.contentId]=records;else delete byContent[target.contentId];
        if(Object.keys(byContent).length>10000)throw Error('attachment-storage-limit');
        if(Object.keys(byContent).length)state.doc.groups[groupId]=byContent;else delete state.doc.groups[groupId];
        if(JSON.stringify(state.doc).length>MAX_BYTES)throw Error('attachment-storage-limit');
        await storage.set({[KEY]:state.doc});
        savedGroups.clear();for(const key of Object.keys(state.doc.groups))savedGroups.add(key);
        // Other tabs displaying the same content update immediately, too.
        for(const tab of bindings.keys())await publish(tab,state);
      },
      async handleClick(sender,message,generation) {
        const data=await serial(async()=>{
          const found=binding(sender.tab?.id,message.target);if(!found||found.page.token!==message.pageToken||found.page.documentId!==sender.documentId)return null;
          const state=await read(),record=state.doc.groups[message.groupId]?.[message.target.contentId]?.[message.attachmentId];
          if(!active(state.groups,message.groupId)||!isCurrent(message.groupId,generation)||!record||record.revision!==message.revision)return null;
          if(!await check(sender.tab.id,{type:'rule-attachment-check',pageToken:found.page.token,target:message.target},found.page.documentId))return null;
          return {eventName:'click',attachmentId:message.attachmentId,tabId:sender.tab.id,item:found.item,text:record.spec.text};
        });
        if(data)await click(message.groupId,data,generation);
      },
      refresh:()=>serial(refreshLocked),
      async pruneLocked(groups){const state=await read(),ids=new Set(groups.filter(g=>g.groupType==='custom').map(g=>g.id));let changed=false;
        for(const key of Object.keys(state.doc.groups))if(!ids.has(key)){delete state.doc.groups[key];savedGroups.delete(key);changed=true;}
        if(changed)await storage.set({[KEY]:state.doc});
      }
    };
  }
  const api=Object.freeze({createBroker,decode,key:KEY});root.CBRuleAttachments=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
