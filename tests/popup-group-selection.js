// Run against the production popup, with Chrome storage or the Mac native shim.
async function runGroupSelectionTests() {
  let checks = 0;
  const nativeStore = {};
  const nativeWrites = [];
  const isNativeShim = typeof window.__cbApplyNativeStore === 'function';
  if (isNativeShim) window.webkit = {messageHandlers:{cbBridge:{postMessage(message) {
    if (message.kind === 'persist-store') {
      Object.assign(nativeStore, message.changes);
      nativeWrites.push(message.changes);
    }
  }}}};
  const check = (value, message) => { if (!value) throw new Error(message); checks++; };
  const wait = async (predicate) => {
    for (let i = 0; i < 100; i++) { if (await predicate()) return; await new Promise(r => setTimeout(r, 20)); }
    throw new Error('selection did not settle');
  };
  const groups = ['First', 'Second', 'Third'].map(name => ({...createDefaultGroup(), name, enabled:false}));
  const [first, second, third] = groups;
  await chrome.storage.local.set({blockedGroups:groups.map(toStoredGroup), globalSettings:{...DEFAULT_GLOBAL_SETTINGS,quickAddEnabled:true},quickAddGroupId:second.id});
  await loadGroups();
  check(state.selectedGroupId === second.id, 'restore the saved card rather than first card');
  const click = id => {
    const at = state.groups.findIndex(g => g.id === id);
    document.querySelectorAll('#groupList .group-card')[at].click();
  };
  allowedMinutesField.value='27';
  // This edit belongs to the current (second) group and must survive selection.
  allowedMinutesField.dispatchEvent(new Event('input',{bubbles:true}));
  click(third.id);
  await wait(() => state.selectedGroupId === third.id);
  check((await chrome.storage.local.get('quickAddGroupId')).quickAddGroupId === third.id,'card click saves + destination');
  check((await chrome.storage.local.get('blockedGroups')).blockedGroups.find(g=>g.id===second.id).allowedMinutes === 27,'flush the old draft before switching');
  await chrome.storage.local.set({globalSettings:{...DEFAULT_GLOBAL_SETTINGS,quickAddEnabled:false}});
  await selectGroup(first.id);
  check((await chrome.storage.local.get('quickAddGroupId')).quickAddGroupId === first.id,'remember when + is disabled');
  await Promise.all([selectGroup(second.id),selectGroup(third.id),selectGroup(first.id)]);
  check(state.selectedGroupId === first.id && state.quickAddGroupId === first.id,'last rapid selection wins');
  await chrome.storage.local.set({quickAddGroupId:second.id});
  await wait(() => state.selectedGroupId === second.id);
  check(true,'external target changes select the same card');
  await addGroup();
  const added = state.selectedGroupId;
  check(state.quickAddGroupId === added,'creation selects and remembers the new group');
  await deleteSelectedGroup();
  check(state.selectedGroupId === first.id && state.quickAddGroupId === first.id,'delete repairs the chosen destination');
  await chrome.storage.local.set({blockedGroups:groups.slice(1).map(toStoredGroup)});
  await wait(() => state.selectedGroupId === second.id && state.quickAddGroupId === second.id);
  check(true,'external deletion repairs the choice');
  await clearAllGroups();
  check((await chrome.storage.local.get('quickAddGroupId')).quickAddGroupId === '' && state.selectedGroupId === null,'empty group list clears the choice');
  await chrome.storage.local.set({blockedGroups:groups.map(toStoredGroup),quickAddGroupId:'deleted-id',globalSettings:{...DEFAULT_GLOBAL_SETTINGS,quickAddEnabled:true}});
  await loadGroups();
  check(state.selectedGroupId === first.id && state.quickAddGroupId === first.id,'stale saved identity safely falls back');
  await selectGroup(third.id);
  if (isNativeShim) {
    check(nativeStore.quickAddGroupId === third.id && nativeWrites.some(change=>change.quickAddGroupId===third.id), 'Mac shim sends the remembered choice through the native bridge');
    window.__cbApplyNativeStore(JSON.stringify(nativeStore));
    await loadGroups();
    check(state.selectedGroupId === third.id, 'Mac editor restores the choice from the native store');
  }
  return {checks,chosen:third.id,other:first.id};
}
