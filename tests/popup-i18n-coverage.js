async () => {
  const checks = [];
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const settle = () => new Promise(resolve => setTimeout(resolve, 80));
  const group = createDefaultGroup('custom');
  group.id = 'language-test'; group.name = 'My group 我的分组';
  group.blockingRulesText = '(on, v) => on("tick", () => v.log("user code"));';
  state.groups = [group]; state.selectedGroupId = group.id;
  const saved = JSON.stringify(state.groups);
  for (const locale of Object.keys(getAvailableLanguages())) {
    const english = await ensureLanguageMessages('en'), catalog = await ensureLanguageMessages(locale);
    check(Object.keys(english).every(key => typeof catalog[key] === 'string' && catalog[key]), locale + ': complete catalog has no missing-key English fallback');
    await setLanguage(locale); await settle();
    check(document.documentElement.lang === locale && languageSelect.value === locale, locale + ': language selection is applied');
    check(document.documentElement.dir === (locale === 'ar' ? 'rtl' : 'ltr'), locale + ': interface direction is correct');
    check(timeUnitSuffix(1) === '' && timeUnitSuffix(2) === (locale === 'en' ? 's' : ''), locale + ': time units avoid English plural suffixes in translated text');
    check(document.getElementById('settingsButton').textContent === t('settings.button'), locale + ': visible controls use the selected catalog');
    check(document.querySelector('[data-info-key="groupName"]').dataset.infoCopy === t('info.groupName'), locale + ': field explanations use selected catalog');
    const stored = await chrome.storage.local.get('vaultUiLanguage');
    check(stored.vaultUiLanguage === locale, locale + ': page-label preference is published');
    check(JSON.stringify(state.groups) === saved, locale + ': names and persisted policy remain unchanged');
    check(getComputedStyle(document.getElementById('blockingRules')).direction === 'ltr', locale + ': JavaScript stays left to right');
    for (const kind of ['user', 'code']) {
      await fetchManualMarkdown(locale, kind);
      check(Boolean(state.manualCache[`${kind}:${locale}`]), locale + ': ' + kind + ' guide is bundled without English fallback');
    }
    openManual('user'); await settle();
    const link = manualContent.querySelector(`a[href="../code-manual/${locale}.md"]`);
    check(Boolean(link), locale + ': user guide links to its localized code guide');
    link.click(); await settle();
    check(state.manualKind === 'code' && manualContent.querySelector('pre'), locale + ': code guide opens inside the app');
    const back = manualContent.querySelector(`a[href="../manual/${locale}.md"]`);
    check(Boolean(back), locale + ': code guide links back to its localized user guide');
    back.click(); await settle();
    check(state.manualKind === 'user', locale + ': return link stays inside the app');
    closeManual();
  }
  await setLanguage('ar'); await settle();
  const resizer = document.getElementById('layoutResizer'), before = state.panelWidth;
  resizer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  check(state.panelWidth > before, 'RTL resize arrow grows the right-hand group panel');
  const info = document.querySelector('[data-info-key="groupName"]').querySelector('.vui-info-button');
  check(Boolean(info), 'Arabic keeps field Info available');
  info.click(); await settle();
  check(document.querySelector('.vui-info-popover')?.textContent.includes(t('info.groupName')), 'Arabic Info opens the localized explanation');
  await setLanguage('de'); await settle();
  check(document.querySelector('.vui-info-popover')?.textContent.includes(t('info.groupName')), 'Open Info updates after a language switch');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
  await setLanguage('en');
  return checks;
}
