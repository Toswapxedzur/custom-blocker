async function runMenuLayeringTests() {
  const results = [], check = (ok, name) => { if (!ok) throw Error(name); results.push(name); };
  const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const modal = document.getElementById('settingsModal'), card = modal.querySelector('[role="dialog"]');
  const select = document.getElementById('languageSelect');
  const trigger = () => select.nextElementSibling.querySelector('button');
  const hit = node => { const b = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)); };
  await setLanguage('en');
  document.getElementById('settingsButton').click(); await wait();
  trigger().scrollIntoView({block:'center'}); await wait();
  trigger().click(); await wait();
  let menu = document.querySelector('.vui-menu');
  await new Promise(resolve => setTimeout(resolve,500));
  check(menu?.isConnected, 'Unrelated editor updates leave the Settings menu open');
  check(menu && menu.matches(':popover-open'), 'Settings language menu uses the floating overlay layer');
  check(hit(menu.querySelector('.vui-menu-item')), 'Language options receive clicks above the Settings backdrop and card');
  const box = menu.getBoundingClientRect();
  check(box.left >= 7 && box.right <= innerWidth - 7 && box.top >= 7 && box.bottom <= innerHeight - 7, 'Long language menu stays inside the viewport');
  const search = menu.querySelector('input'); search.value = 'Deutsch'; search.dispatchEvent(new InputEvent('input',{bubbles:true}));
  check(menu.querySelectorAll('.vui-menu-item').length === 1 && hit(menu.querySelector('.vui-menu-item')), 'Filtered options remain visible and clickable');
  search.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
  check(card.contains(document.activeElement), 'Menu search remains inside dialog keyboard scope');
  search.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); await wait();
  check(!document.querySelector('.vui-menu') && !modal.classList.contains('hidden') && document.activeElement === trigger(), 'Escape closes Language first and restores its trigger');
  // A transformed/overflow-clipped dialog reproduces the other ancestor failure.
  card.style.transform = 'translateZ(0)';
  trigger().click(); await wait(); menu = document.querySelector('.vui-menu');
  check(hit(menu.querySelector('.vui-menu-item')), 'Menu escapes transformed and clipped ancestors');
  menu.querySelector('input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  card.style.removeProperty('transform');
  // Older hosts keep the z-order fallback without requiring the Popover API.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
  Object.defineProperty(HTMLElement.prototype, 'showPopover', {configurable:true,value:undefined});
  try {
    trigger().click(); await wait(); menu = document.querySelector('.vui-menu');
    // Remove the attribute: in an old host it has no built-in display:none rule.
    menu.removeAttribute('popover'); await wait();
    check(hit(menu.querySelector('.vui-menu-item')), 'Fallback menu remains above the dialog');
    VaultUI.close();
  } finally { Object.defineProperty(HTMLElement.prototype, 'showPopover', descriptor); }
  trigger().click(); await wait();
  menu = document.querySelector('.vui-menu');
  menu.querySelector('input').value = 'English'; menu.querySelector('input').dispatchEvent(new InputEvent('input',{bubbles:true}));
  menu.querySelector('.vui-menu-item').click(); await wait();
  check(!document.querySelector('.vui-menu') && select.value === 'en', 'Picking an option closes the overlay normally');
  trigger().click(); await wait();
  closeSettings(); await wait();
  check(!document.querySelector('.vui-menu') && modal.classList.contains('hidden'), 'Closing Settings leaves no menu overlay');
  return results;
}
