async () => {
  const results = [];
  const check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const settle = () => new Promise(resolve => setTimeout(resolve, 100));
  const group = createDefaultGroup('custom'); group.id = 'rtl-layout'; group.name = 'My group 我的分组';
  group.blockingRulesText = '(on, v) => on("tick", () => v.log("user code"));';
  state.groups = [group]; state.selectedGroupId = group.id; render();
  const saved = JSON.stringify(state.groups);
  await setLanguage('ar'); await settle();
  check(document.documentElement.dir === 'rtl', 'Arabic layout is RTL');
  check(document.getElementById('settingsButton').textContent === t('settings.button'), 'Settings button reads the Arabic catalog');
  check(getComputedStyle(document.getElementById('blockingRules')).direction === 'ltr', 'JavaScript editor remains LTR');
  check(JSON.stringify(state.groups) === saved, 'Language switch preserves group names and rule source');
  const before = state.panelWidth;
  layoutResizer.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowLeft', bubbles:true}));
  check(state.panelWidth > before, 'RTL left arrow grows the right-side group panel');
  const groupBox = document.querySelector('.groups-panel').getBoundingClientRect();
  const editorBox = document.querySelector('.editor-panel').getBoundingClientRect();
  check(groupBox.left > editorBox.left, 'Groups appear on the right in Arabic');
  check(document.documentElement.scrollWidth <= innerWidth + 1, 'Arabic interface fits the viewport');
  check(Boolean(document.querySelector('.vui-info-button')), 'Arabic retains available Info buttons');
  await setLanguage('en'); await settle();
  check(document.documentElement.dir === 'ltr', 'English restores LTR layout');
  return results;
}
