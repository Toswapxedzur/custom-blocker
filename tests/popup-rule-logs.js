async () => {
  const results = [];
  const check = (condition,label) => {if(!condition)throw Error(label); results.push(label);};
  const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const until = async predicate => {const end=Date.now()+10000; while(!predicate()){if(Date.now()>end)throw Error('Timed out'); await delay(25);}};
  const a = createDefaultGroup('custom'), b = createDefaultGroup('custom');
  a.id='log-test-a'; b.id='log-test-b'; a.name=b.name='Same display name';
  await chrome.storage.local.set({blockedGroups:[a,b]});
  await until(()=>state.groups.some(group=>group.id===a.id));
  state.selectedGroupId=a.id; render();
  const run = (groupId,source) => chrome.runtime.sendMessage({type:'run-custom-group',groupId,source});
  const firstRun=await run(a.id,'(on,v)=>{v.log("A only");}');
  check(firstRun?.loadResult?.ok===true,'Run A loads successfully: '+JSON.stringify(firstRun));
  await until(()=>logFeedCount.textContent==='1');
  check(logFeedList.textContent.includes('A only'),'v.log reaches its selected rule');
  await run(b.id,'(on,v)=>{v.log("B only");}');
  await delay(100);
  check(logFeedCount.textContent==='1' && !logFeedList.textContent.includes('B only'),'other rule stays out despite identical names');
  state.selectedGroupId=b.id; render();
  await until(()=>logFeedList.textContent.includes('B only'));
  check(!logFeedList.textContent.includes('A only'),'switching loads only the selected rule');
  document.getElementById('logFeedClear').click();
  await delay(100);
  check((await chrome.runtime.sendMessage({type:'get-log-feed',groupId:a.id})).entries.length===1,'Clear preserves the other rule');
  check((await chrome.runtime.sendMessage({type:'get-log-feed',groupId:b.id})).entries.length===0,'Clear removes the selected rule');
  await run(b.id,'(on,v)=>{throw Error("registration failure");}');
  await delay(100);
  check(logFeedCount.textContent==='0','registration failure is not user log output');
  state.selectedGroupId=a.id; render();
  await until(()=>logFeedList.textContent.includes('A only'));
  let download;
  const createURL=URL.createObjectURL, click=HTMLAnchorElement.prototype.click;
  URL.createObjectURL=blob=>{download=blob; return 'blob:test'};
  HTMLAnchorElement.prototype.click=function(){};
  document.getElementById('logFeedDownload').click();
  URL.createObjectURL=createURL; HTMLAnchorElement.prototype.click=click;
  const text=await download.text();
  check(text.includes('A only') && !text.includes('B only'),'Download contains only the selected rule');
  let nativeExport;
  window.__cbSaveRuleLog = async (filename, text) => {nativeExport={filename,text};return {ok:true};};
  document.getElementById('logFeedDownload').click(); await delay(25);
  check(nativeExport.filename.startsWith('blocker-logs-') && nativeExport.filename.endsWith('.txt'),'native download uses a plain-text rule log filename');
  check(nativeExport.text===text,'native export preserves the same selected-rule bytes as the browser download');
  delete window.__cbSaveRuleLog;
  // Live output after a snapshot, then stale in-flight snapshots and Clear.
  const original=chrome.runtime.sendMessage;
  let release;
  chrome.runtime.sendMessage=message=>message.type==='get-log-feed'
    ? new Promise(resolve=>release=()=>resolve({ok:true,entries:[{id:'stale',source:'v.log',groupId:a.id,message:'stale A'}]}))
    : original(message);
  loadLogFeedSnapshot(); clearLogFeed(); release(); await delay(50);
  check(logFeedCount.textContent==='0','Clear rejects an older pending snapshot');
  loadLogFeedSnapshot(); const olderRelease=release;
  state.selectedGroupId=b.id; render(); olderRelease(); await delay(50);
  check(!logFeedList.textContent.includes('stale A'),'group switching rejects an older snapshot');
  chrome.runtime.sendMessage=original;
  return results;
}
