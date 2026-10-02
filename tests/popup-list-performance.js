async () => {
  const checks = [], check = (value, label) => { if (!value) throw Error(label); checks.push(label); };
  const settled = () => new Promise(resolve => setTimeout(resolve, 120));
  state.groups = Array.from({length:10000}, (_,i)=>({...createDefaultGroup('site'),id:'large-'+i,name:'Group '+i,enabled:false}));
  state.selectedGroupId = 'large-0'; render(); await settled();
  check(groupList.querySelectorAll('.group-card').length === 40, '10,000 groups mount only 40 cards');
  const query = document.querySelector('[data-vui-search-input="vault-groups"]');
  query.value = 'Group 9999'; query.dispatchEvent(new InputEvent('input',{bubbles:true}));
  await settled();
  check(groupList.querySelector('.group-card')?.dataset.groupId === 'large-9999', 'search reaches the last stored group');
  query.value = ''; query.dispatchEvent(new InputEvent('input',{bubbles:true})); await settled();
  groupList.nextElementSibling.querySelectorAll('button')[1].click();
  check(groupList.querySelector('.group-card').dataset.groupId === 'large-40', 'next page reaches the original next identity');
  refreshGroupListInPlace(Date.now());
  check(groupList.querySelector('.group-card').dataset.groupId === 'large-40' && groupList.querySelectorAll('.group-card').length===40, 'timer tick preserves the current bounded page');
  blockedSitesField.value = Array.from({length:10000},(_,i)=>'site'+i+'.example').join('\n'); renderBlockedSites();
  check(blockedSitesList.querySelectorAll('.site-chip').length===40, '10,000 sites mount only 40 chips');
  const sites = document.querySelector('[data-vui-search-input="vault-sites"]');
  sites.value = 'site9999.example'; sites.dispatchEvent(new InputEvent('input',{bubbles:true})); await settled();
  check(blockedSitesList.querySelector('.site-chip-name')?.textContent==='site9999.example', 'site search reaches the final stored site');
  sites.value = 'site9998.example'; sites.dispatchEvent(new InputEvent('input',{bubbles:true}));
  sites.value = 'site9997.example'; sites.dispatchEvent(new InputEvent('input',{bubbles:true})); await settled();
  check(blockedSitesList.querySelector('.site-chip-name')?.textContent==='site9997.example', 'obsolete searches cannot replace the newest query');
  check(getDraftSites().length===10000, 'paging and search preserve every stored entry');
  return checks;
}
