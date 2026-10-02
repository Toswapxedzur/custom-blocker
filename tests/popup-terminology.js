async () => {
  const results = [];
  const check = (condition, label) => { if (!condition) throw Error(label); results.push(label); };
  const group = createDefaultGroup('site');
  group.id = 'terminology-test'; group.name = 'Terminology test';
  group.mode = 'after-minutes'; group.snoozeKind = 'time';
  await chrome.storage.local.set({ blockedGroups: [group] });
  const end = Date.now() + 10000;
  while (!state.groups.some(g => g.id === group.id)) {
    if (Date.now() > end) throw Error('Group did not load');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  state.selectedGroupId = group.id; render();
  const label = document.querySelector('label[for="snoozeMinutes"]');
  const labelText = node => [...node.childNodes].filter(n => !n.classList?.contains('vui-info-button')).map(n => n.textContent).join('');
  check(labelText(label) === 'Pause duration (minutes)', 'Time snooze describes a pause');
  const draft = state.drafts[group.id] = getDraftForGroup(group.id);
  draft.snoozeKind = 'budget'; updateSnoozeUI(getSelectedGroup());
  check(labelText(label) === 'Extra allowance (minutes)', 'Allowance snooze describes usable minutes');
  draft.mode = 'instant'; updateSnoozeUI(getSelectedGroup());
  check(labelText(label) === 'Pause duration (minutes)', 'Immediate blocking cannot imply an extra allowance');
  check(labelText(document.querySelector('[data-i18n="freeze.pinLabel"]')) === 'PIN', 'Freeze uses PIN terminology');
  check(t('logFeed.hint').includes('this group'), 'Log explains group isolation');
  return results;
}
