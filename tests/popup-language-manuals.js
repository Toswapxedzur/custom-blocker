async () => {
  const results = [];
  const check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const delay = () => new Promise(resolve => setTimeout(resolve, 100));
  await setLanguage('en');
  const group = createDefaultGroup('custom');
  group.id = 'code-guide-test'; group.name = 'Code guide test';
  group.blockingRulesText = '(on, v) => {\n  // <img src=x onerror=alert(1)>\n  on("tick", () => v.log(42));\n}';
  state.groups = [group]; state.selectedGroupId = group.id; render(); await delay();
  const field = document.getElementById('blockingRules');
  field.value = group.blockingRulesText; updateBlockingRulesEditor();
  const layer = document.getElementById('blockingRulesHighlight');
  check(!layer.querySelector('img') && layer.textContent.includes('<img'), 'Highlighting escapes HTML without changing source');
  check(layer.querySelector('.token-api')?.textContent === 'on', 'Current on/v API is colored');
  check(getComputedStyle(field).color === 'rgba(0, 0, 0, 0)', 'Textarea reveals the syntax layer');
  const token = layer.querySelector('.token-keyword');
  // Arrow source has no keyword; check string and numeric tokens instead.
  check(getComputedStyle(layer.querySelector('.token-string')).color !== getComputedStyle(layer.querySelector('.token-number')).color, 'JavaScript token classes have distinct colors');
  for (const property of ['fontSize', 'fontFamily', 'lineHeight', 'padding', 'letterSpacing']) {
    check(getComputedStyle(field)[property] === getComputedStyle(layer)[property], 'Editor layers align: ' + property);
  }
  let copied;
  Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async text => { copied=text; }}});
  document.getElementById('copyCodeDocsButton').click(); await delay();
  check(copied?.startsWith('# Vault browser extension code manual'), 'Copy code docs uses the browser guide');
  check(copied.includes('v.item') && !copied.includes('USER_REQUEST_BEGIN') && !copied.includes('onerror=alert'), 'Copied docs contain supported API without current rule or AI prompt');
  check(!document.getElementById('aiPromptPanel'), 'Retired AI prompt controls are removed');
  const docs = copied, realFetch = window.fetch;
  delete state.manualCache['code:en'];
  let resolveFetch, writeStarted = false;
  window.fetch = url => String(url).includes('code-manual/') ? new Promise(resolve => { resolveFetch = resolve; }) : realFetch(url);
  Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{write:async items => {
    writeStarted = true;
    copied = await (await items[0].getType('text/plain')).text();
  }}});
  document.getElementById('copyCodeDocsButton').click();
  check(writeStarted && resolveFetch, 'Clipboard write starts in the click before the guide fetch resolves');
  resolveFetch(new Response(docs)); await delay();
  check(copied === docs, 'Deferred clipboard item resolves to the complete code guide');
  window.fetch = realFetch;

  document.getElementById('manualButton').click(); await delay();
  const content = document.getElementById('manualContent');
  check(!content.textContent.includes('v.log') && !content.querySelector('pre'), 'User manual contains no code tutorial');
  const codeLink = content.querySelector('a[href="../code-manual/en.md"]');
  codeLink.click(); await delay();
  check(document.getElementById('manualDialogTitle').textContent === 'Code manual' && content.textContent.includes('v.log'), 'Code link opens the separate guide in the same dialog');
  content.querySelector('a[href="../manual/en.md"]').click(); await delay();
  check(document.getElementById('manualDialogTitle').textContent === 'User manual', 'Back link returns to the user guide');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
  check(document.getElementById('manualModal').classList.contains('hidden'), 'Escape dismisses the manual');
  return results;
}
