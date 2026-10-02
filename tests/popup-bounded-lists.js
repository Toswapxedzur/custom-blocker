async () => {
  const results=[],wait=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const check=(c,label)=>{if(!c)throw Error(label);results.push(label)};
  const bounded=(node,label)=>{
    check(node && getComputedStyle(node).overflowY==='auto' && node.scrollHeight>node.clientHeight,label+' is bounded and scrollable');
    const h=node.clientHeight;node.scrollTop=node.scrollHeight;
    check(node.scrollTop>0 && node.clientHeight===h,label+' reaches the final entries');
  };
  state.groups=Array.from({length:100},(_,i)=>({...createDefaultGroup('site'),id:'box-group-'+i,name:'Group '+i}));
  state.selectedGroupId=state.groups[0].id;render();await wait();bounded(groupList,'groups');
  check(groupList.lastElementChild.getBoundingClientRect().bottom<=groupList.getBoundingClientRect().bottom+2,'last group fits inside scrolled viewport');
  blockedSitesField.value=Array.from({length:400},(_,i)=>'site'+i+'.example').join('\n');renderBlockedSites();await wait();bounded(blockedSitesList,'websites');
  check(blockedSitesList.querySelectorAll('.site-chip').length===400,'all websites remain available');
  document.body.classList.add('is-native-desktop');
  appsSettingsSection.classList.remove('hidden');
  blockedAppsData.value=JSON.stringify(Array.from({length:300},(_,i)=>({id:'test.app.'+i,name:'App '+i})));
  renderBlockedApps();await wait();bounded(blockedAppsList,'blocked applications');
  check(blockedAppsList.querySelectorAll('.app-chip').length===300,'all blocked applications remain available');
  platformRulesCard.classList.remove('hidden');platformVideoFields.classList.remove('hidden');
  document.getElementById('platformAuthorsBlock').classList.remove('hidden');
  platformAuthorsField.value=Array.from({length:400},(_,i)=>'@creator'+i).join('\n');refreshChipField(platformAuthorsField);await wait();
  bounded(platformAuthorsField.__cbChip ? document.querySelector("[data-vui-search=\"vault-chips:"+platformAuthorsField.id+"\"]") : null,'creator filters');
  const tags=document.getElementById('platformTagSuggestions');
  document.getElementById('platformTagFields').classList.remove('hidden');
  document.getElementById('platformTagListBlock').classList.remove('hidden');
  renderTagSuggestions(tags,document.getElementById('platformTags'),Array.from({length:400},(_,i)=>'Tag '+i));await wait();tags.querySelector('button').click();await wait();bounded(document.querySelector('.tag-chooser-list'),'tag suggestions');closeTagChooser();
  const sitesHeight=blockedSitesList.clientHeight;
  blockedSitesField.value='short.example';renderBlockedSites();await wait();
  check(blockedSitesList.clientHeight<sitesHeight,'short lists fit their contents');
  return results;
}
