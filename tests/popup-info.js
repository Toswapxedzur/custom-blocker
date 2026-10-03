async () => {
  const results = [];
  const check = (ok, label) => { if (!ok) throw Error(label); results.push(label); };
  const delay = () => new Promise(resolve => setTimeout(resolve, 80));
  await setLanguage('en');
  document.getElementById('settingsButton').click(); await delay();
  const source = document.querySelector('[data-info="settings.quickAddHelp"]');
  const buttonFor = key => [...document.querySelectorAll('.vui-info-button')].find(button => button.infoEntry.key.includes(key));
  let button = buttonFor('settings.quickAddHelp');
  check(button && button.getClientRects().length && getComputedStyle(source).display === 'none', 'English help becomes a visible circled Info button');
  const style = getComputedStyle(button), size = button.getBoundingClientRect();
  check(size.width === 10 && size.height === 10 && style.color === 'rgb(148, 163, 184)', 'Info uses the compact shared blue-gray appearance');
  check(getComputedStyle(button, '::before').left === '-7px', 'Small icon retains its larger invisible hit area');
  check(buttonFor('language.label'), 'Language field has its own explanation');
  const group = createDefaultGroup('site'); group.id = 'info-field-test'; group.name = 'Field test'; group.mode = 'after-minutes';
  state.groups = [group]; state.selectedGroupId = group.id; render(); await delay();
  for (const id of ['groupName','groupEnabled','blockMode','allowedMinutes','resetIntervalHours','scheduleWindows','allowSnooze','snoozeMinutes','snoozeActivationDelay','snoozeCooldown','snoozeConfirmations','lockWaitHours']) {
    const field = document.getElementById(id);
    const anchor = field.closest('[data-info-copy]') || document.querySelector(`label[for="${id}"]`)?.querySelector('[data-info-copy]') || document.querySelector(`label[for="${id}"]`);
    check(anchor?.querySelector('.vui-info-button'), `${id} has a field explanation`);
  }
  // Settings survives unrelated editor renders; re-find its Info control.
  button = buttonFor('settings.quickAddHelp');
  const toggle = document.getElementById('settingsQuickAdd'), checked = toggle.checked;
  const dialog = document.querySelector('.settings-modal-card');
  const before = dialog.getBoundingClientRect();
  button.click(); await delay();
  let card = document.querySelector('.vui-info-popover');
  const popupStyle = getComputedStyle(card);
  check(popupStyle.fontSize === '12px' && popupStyle.padding === '8px 10px' && card.getBoundingClientRect().width <= 260, 'Description uses compact 12px typography, padding and width');
  check(card?.textContent.includes('quick-add') || card?.textContent.includes('tiny'), 'Click reveals the complete explanation');
  check(toggle.checked === checked, 'Info inside a checkbox label does not toggle its setting');
  check(Math.abs(before.height - dialog.getBoundingClientRect().height) < 1, 'Popover leaves panel height unchanged');
  const box = card.getBoundingClientRect();
  check(box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight, 'Popover fits the viewport');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); await delay();
  check(!document.querySelector('.vui-info-popover') && !document.getElementById('settingsModal').classList.contains('hidden'), 'Escape closes Info while leaving Settings open');
  buttonFor('settings.quickAddHelp').click(); await delay();
  buttonFor('settings.copy').click(); await delay();
  check(document.querySelectorAll('.vui-info-popover').length === 1, 'Opening another explanation replaces the first');
  document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); await delay();
  check(!document.querySelector('.vui-info-popover'), 'Outside click dismisses Info');
  await setLanguage('zh'); await delay();
  check(buttonFor('settings.quickAddHelp')?.getClientRects().length && getComputedStyle(source).display === 'none', 'Chinese retains field Info instead of dropping explanations');
  await setLanguage('en'); await delay();
  button = buttonFor('settings.quickAddHelp');
  check(button?.getClientRects().length, 'Switching back to English restores Info');
  button.click(); await delay(); button.click(); await delay();
  check(!document.querySelector('.vui-info-popover'), 'A second click closes the explanation');
  return results;
}
