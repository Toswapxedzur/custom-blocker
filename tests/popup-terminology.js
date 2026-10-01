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
  check(label.textContent === 'Pause duration (minutes)', 'Time snooze describes a pause');
  const draft = state.drafts[group.id] = getDraftForGroup(group.id);
  draft.snoozeKind = 'budget'; updateSnoozeUI(getSelectedGroup());
  check(label.textContent === 'Extra allowance (minutes)', 'Allowance snooze describes usable minutes');
  draft.mode = 'instant'; updateSnoozeUI(getSelectedGroup());
  check(label.textContent === 'Pause duration (minutes)', 'Immediate blocking cannot imply an extra allowance');
  check(document.querySelector('[data-i18n="freeze.pinLabel"]').textContent === 'PIN', 'Freeze uses PIN terminology');
  check(t('logFeed.hint').includes('this group'), 'Log explains group isolation');
  return results;
}
