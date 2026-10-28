// Example policy, not a built-in feature: cached AI labels, user feedback,
// filtering and a small usage report, all implemented in rule code.
(on,v)=>{
  const pending=new Map(),seen=new Map(),tickets=new Map();
  const labels=['Study','Leisure','Dim'];
  const version=()=>JSON.stringify(labels)+':'+v.context.revision;
  const key=item=>'answer:'+item.contentId;
  const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function request(options,details){const id=v.store(options);pending.set(id,details);}
  function render(tabId,item,record){
    const answer=record?.value||{},label=answer.label||'Waiting';
    const entry=seen.get(item.contentId);if(entry)entry.record=record;
    v.item(tabId,item.ref,label==='Dim'?'dim':null);
    v.attach(tabId,item,'editor',{type:'html',label:'Example annotation',
      html:`<section class="note"><strong>${esc(label)}</strong><input id="answer" value="${esc(label)}" aria-label="Your annotation"><button data-control="save">Save feedback</button><button data-control="refresh">Refresh example</button><button data-control="reset">Reset feedback</button><input type="checkbox" id="check" aria-label="Example checkbox"><button data-control="report">Usage report</button></section>`,
      css:'.note{display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:#CFFAFE;color:#155e75;border-radius:10px;padding:8px}.note input{max-width:120px}.note button{border:0;border-radius:8px;padding:4px 7px;background:#E9EEFC;color:#1E3A8A}'
    });
    v.state.lastLabel=label;
  }
  function load(tabId,item){seen.set(item.contentId,{tabId,item,record:seen.get(item.contentId)?.record});request({op:'get',key:key(item)},{kind:'read',tabId,item,ticket:tickets.get(item.contentId)||0});}
  on('items',({data})=>{
    for(const item of data.items)if(['youtube','reddit','bilibili','twitter'].includes(data.platform)&&!item.isPage)load(data.tabId,item);
  });
  on('record',({data})=>{
    const job=pending.get(data.requestId);if(!job)return;pending.delete(data.requestId);
    if(!data.ok){v.state.lastStoreError=data.error;return;}
    if(job.ticket!==(tickets.get(job.item.contentId)||0))return;
    if(job.kind==='read'){
      const record=data.record;
      render(job.tabId,job.item,record);
      if(record?.value.origin==='user'||record?.version===version())return;
      const id=v.ai({prompt:'Choose exactly one label from '+JSON.stringify(labels)+'. Return JSON {"label":"..."}. User feedback is authoritative.',input:{title:job.item.title}});
      pending.set(id,{...job,kind:'ai',revision:record?.revision??null,version:version()});
    }else if(job.kind==='write'){
      // A newer user interaction invalidates older presentation callbacks.
      if(job.ticket!==(tickets.get(job.item.contentId)||0))return;
      render(job.tabId,job.item,data.record);
    }else if(job.kind==='reset')load(job.tabId,job.item);
  });
  on('ai',({data})=>{
    const job=pending.get(data.requestId);if(!job)return;pending.delete(data.requestId);
    if(!data.ok)return;
    let answer;try{answer=JSON.parse(data.text);}catch{return;}
    if(!labels.includes(answer.label))return;
    request({op:'put',key:key(job.item),value:{label:answer.label,origin:'automatic'},ifRevision:job.revision,version:job.version},{...job,kind:'write'});
  });
  on('attachment',event=>{
    const {data}=event;if(data.attachmentId!=='editor'||event.origin!=='user')return;
    v.state.lastOrigin=event.origin;
    if(data.controlId==='check'){v.state.checkbox=data.value;return;}
    if(data.eventName!=='click')return;
    const ticket=(tickets.get(data.item.contentId)||0)+1;tickets.set(data.item.contentId,ticket);
    const job={kind:'write',tabId:data.tabId,item:data.item,ticket};
    if(data.controlId==='save')request({op:'put',key:key(data.item),value:{label:String(data.values.answer||''),origin:'user'},version:version()},job);
    else if(data.controlId==='refresh'){
      const record=seen.get(data.item.contentId)?.record;if(record?.value.origin==='user')return;
      const id=v.ai({prompt:'Choose a label. Return JSON {"label":"..."}.',input:{title:data.item.title}});
      pending.set(id,{...job,kind:'ai',revision:record?.revision??null,version:version()});
    }else if(data.controlId==='reset')request({op:'delete',key:key(data.item)},{...job,kind:'reset'});
    else if(data.controlId==='report')v.panel('example-report',{title:'Rule usage',controls:[{type:'html',html:'<p>Observed visible time: '+Math.round((v.state.visibleMs||0)/1000)+' seconds</p>'}]});
  });
  on('visible',({data})=>{
    if(![...seen.values()].some(entry=>entry.tabId===data.tabId))return;
    v.state.visibleMs=(v.state.visibleMs||0)+Math.max(0,Math.min(data.elapsedMs||0,5000));
    // This is the rule's own report data, independent of Activity.
    v.store({op:'put',key:'usage:visible',value:{milliseconds:v.state.visibleMs}});
  });
  on('tick',()=>{
    const current=version();if(v.state.exampleVersion&&v.state.exampleVersion!==current)for(const entry of seen.values())load(entry.tabId,entry.item);
    v.state.exampleVersion=current;v.state.ticks=(v.state.ticks||0)+1;
  });
}
