/* Shared content identity and attachment mounting for classifier/custom pills. */
(function(root) {
  'use strict';
  const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
  const id=()=>root.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
  function contentId(platform,raw) {
    try {
      const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;
      const host=u.hostname.toLowerCase(),is=s=>host===s||host.endsWith('.'+s);
      let match;
      if(platform==='youtube'&&(is('youtube.com')||is('youtu.be'))) {
        const video=is('youtu.be')?u.pathname.split('/')[1]:u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1];
        if(video&&/^[\w-]{1,128}$/.test(video))return 'youtube:video:'+video;
        if((match=u.pathname.match(/^\/post\/([^/]+)/)))return 'youtube:post:'+match[1];
      }
      if(platform==='twitter'&&(is('x.com')||is('twitter.com'))&&(match=u.pathname.match(/\/status\/(\d+)/)))return 'twitter:status:'+match[1];
      if(platform==='reddit'&&is('reddit.com')&&(match=u.pathname.match(/\/comments\/([a-z0-9]+)/i)))return 'reddit:post:'+match[1].toLowerCase();
      if(platform==='bilibili'&&is('bilibili.com')&&(match=u.pathname.match(/\/video\/(BV[\w]+|av\d+)/i)))return 'bilibili:video:'+match[1];
      u.hash='';
      for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','gclid','spm','si','feature'].includes(key))u.searchParams.delete(key);
      u.searchParams.sort();
      const value=platform+':url:'+u.href;return value.length<=2048?value:null;
    } catch{return null;}
  }
  function target(value) {
    if(!value||!text(value.ref,128)||!text(value.contentId,2048)||!text(value.instanceId,128))throw Error('attachment-invalid-target');
    return {ref:value.ref,contentId:value.contentId,instanceId:value.instanceId};
  }
  function spec(value) {
    if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(k=>!['type','text','tone','tooltip'].includes(k))||value.type!=='pill'||!text(value.text,240)||!value.text.trim()||
      (value.tone!==undefined&&!['blue','cyan','gold','pink','red'].includes(value.tone))||(value.tooltip!==undefined&&(typeof value.tooltip!=='string'||value.tooltip.length>1000)))throw Error('attachment-invalid-spec');
    return {type:'pill',text:value.text,tone:value.tone||'blue',tooltip:value.tooltip||''};
  }
  const hosts=new WeakMap();
  function unmount(host) {try{root.cbUnregisterPillHost?.(host);}catch{}host?.remove?.();}
  function mount({element,anchor,owner,identity,host}) {
    let slots=hosts.get(element);if(!slots){slots=new Map();hosts.set(element,slots);}
    const previous=slots.get(owner);if(previous?.host!==host)unmount(previous?.host);
    slots.set(owner,{identity,host});
    try{root.cbRegisterPillHost?.(host);}catch{}
    if(anchor?.parentNode&&element.contains(anchor))anchor.insertAdjacentElement('afterend',host);
    else element.appendChild(host);
    return host;
  }
  const palette={blue:['#E9EEFC','#1E3A8A'],cyan:['#CFFAFE','#155e75'],gold:['#FEF3C7','#a16207'],pink:['#FCE7F3','#9d174d'],red:['#FEE2E2','#991B1B']};
  function createPage({onClick}) {
    const token=id(),items=new Map(),mounted=new Map();let cards=new WeakMap();
    let serial=0,enabled=true,lastSequence=0,itemsEpoch=0;
    function remove(instanceId){unmount(mounted.get(instanceId)?.host);mounted.delete(instanceId);items.delete(instanceId);}
    function observe(element,{ref,platform,url,anchor,isPage=false,getURL=null}) {
      const identity=contentId(platform,url);if(!identity)return null;
      let item=cards.get(element);
      if(!item||item.contentId!==identity||item.isPage!==isPage) {
        if(item)remove(item.instanceId);
        item={ref,contentId:identity,instanceId:token+':'+(++serial),element,anchor,isPage};cards.set(element,item);
      }
      item.ref=ref;item.anchor=anchor;item.platform=platform;item.getURL=getURL;items.set(item.instanceId,item);
      // Detached DOM is never retained indefinitely by a long feed session.
      for(const [key,value] of items)if(!value.element.isConnected)remove(key);
      if(items.size>3000)for(const key of items.keys()){if(key!==item.instanceId)remove(key);if(items.size<=3000)break;}
      return target(item);
    }
    function current(value){try{const item=items.get(value?.instanceId);return !!(enabled&&item&&item.element.isConnected&&item.contentId===value.contentId&&item.ref===value.ref&&(!item.getURL||contentId(item.platform,item.getURL())===item.contentId));}catch{return false;}}
    function snapshot(message) {
      if(message.pageToken!==token||message.itemsEpoch!==itemsEpoch||!Number.isSafeInteger(message.sequence)||message.sequence<=lastSequence)return;
      lastSequence=message.sequence;
      const keep=new Set();
      for(const entry of message.items||[]) {
        if(!current(entry.target))continue;
        const item=items.get(entry.target.instanceId),key=item.instanceId;
        if(!Array.isArray(entry.attachments)||!entry.attachments.length)continue;
        keep.add(key);
        let mountedItem=mounted.get(key);
        const signature=JSON.stringify(entry.attachments);
        if(mountedItem?.signature===signature&&mountedItem.host.isConnected)continue;
        if(mountedItem)unmount(mountedItem.host);
        const host=item.element.ownerDocument.createElement('span');
        host.style.cssText='all:initial;display:inline-block;vertical-align:middle;max-width:100%;margin-inline-start:6px;position:relative;z-index:1';
        const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style'),rail=document.createElement('span');
        style.textContent=':host{all:initial;display:inline-block;max-width:100%;contain:layout style}.rail{display:inline-flex;flex-wrap:wrap;gap:4px;max-width:100%;vertical-align:middle}button{font:600 12px/1.4 Arial,sans-serif;border:0;border-radius:999px;padding:4px 8px;max-width:100%;overflow-wrap:anywhere;cursor:pointer}button:focus-visible{outline:3px solid #2563EB;outline-offset:2px}';
        rail.className='rail';
        for(const attachment of entry.attachments) {
          let value;try{value=spec(attachment.spec);}catch{continue;}
          const button=document.createElement('button');button.type='button';button.textContent=value.text;button.title=value.tooltip;
          button.style.backgroundColor=palette[value.tone][0];button.style.color=palette[value.tone][1];
          button.addEventListener('click',event=>{
            event.preventDefault();event.stopImmediatePropagation();
            if(event.isTrusted&&current(entry.target))onClick({pageToken:token,target:entry.target,groupId:attachment.groupId,attachmentId:attachment.id,revision:attachment.revision});
          });
          rail.append(button);
        }
        // Card links must never consume pointer/key activation within the rail.
        for(const name of ['pointerdown','pointerup','mousedown','mouseup','keydown','keyup'])shadow.addEventListener(name,event=>event.stopPropagation());
        shadow.append(style,rail);mount({element:item.element,anchor:item.anchor,owner:'custom',identity:item.contentId,host});
        mounted.set(key,{host,signature});
      }
      for(const [key,value] of mounted)if(!keep.has(key)){unmount(value.host);mounted.delete(key);}
    }
    return {token,observe,current,snapshot,clear(){for(const key of [...items.keys()])remove(key);cards=new WeakMap();},setEpoch(value){if(itemsEpoch!==value){lastSequence=0;itemsEpoch=value;}const on=!!value;enabled=on;if(!on)for(const value of mounted.values())unmount(value.host);if(!on)mounted.clear();}};
  }
  const api=Object.freeze({id,contentId,target,spec,mount,unmount,createPage});root.VaultContentItems=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
