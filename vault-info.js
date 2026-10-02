/* Static English explanations. Sources remain in the DOM for translations and
 * dynamic copy updates; operational notices are never selected implicitly. */
(function (global) {
  "use strict";
  const doc = global.document;
  if (!doc || typeof MutationObserver === "undefined" || !doc.createElement) {
    global.VaultInfo = Object.freeze({ watch() {}, refresh() {}, close() {} });
    return;
  }
  const scopes = new Map();
  let open = null, sequence = 0;
  const copy = source => (source.dataset.infoCopy || source.textContent).trim().replace(/^[·\s]+/, "");
  function close(restore = false) {
    if (!open) return;
    const button = open.button;
    button.setAttribute("aria-expanded", "false");
    button.removeAttribute("aria-controls");
    button.removeAttribute("aria-describedby");
    open.card.remove(); open = null;
    if (restore && button.isConnected) button.focus({ preventScroll: true });
  }
  function place() {
    if (!open) return;
    const box = open.button.getBoundingClientRect(), card = open.card;
    if (!box.width || !box.height) return close();
    card.style.maxHeight = `${Math.min(280, Math.max(80, global.innerHeight - 16))}px`;
    const height = card.offsetHeight, width = card.offsetWidth;
    card.style.left = `${Math.max(8, Math.min(box.left, global.innerWidth - width - 8))}px`;
    const below = box.bottom + 6;
    card.style.top = `${Math.max(8, Math.min(below + height <= global.innerHeight - 8 ? below : box.top - height - 6, global.innerHeight - height - 8))}px`;
  }
  function content(entry) {
    open.card.replaceChildren();
    for (const text of entry.texts) {
      const paragraph = doc.createElement("p"); paragraph.textContent = text;
      open.card.appendChild(paragraph);
    }
  }
  function show(entry) {
    if (open?.button === entry.button) return close();
    close();
    const card = doc.createElement("div");
    card.className = "vui-info-popover"; card.id = `vault-info-${++sequence}`;
    card.setAttribute("role", "note"); card.setAttribute("aria-label", entry.label);
    card.setAttribute("popover", "manual");
    // Keep the card inside an enclosing dialog so focus traps and assistive
    // technology retain its relationship to the dialog. Top layer avoids clips.
    (entry.button.closest('[role="dialog"],.vui-menu,.tree-popover,.date-picker') || doc.body).appendChild(card);
    open = { ...entry, card }; content(entry);
    entry.button.setAttribute("aria-expanded", "true");
    entry.button.setAttribute("aria-controls", card.id);
    entry.button.setAttribute("aria-describedby", card.id);
    if (typeof card.showPopover === "function") card.showPopover();
    place();
  }
  function anchorFor(source, scope) {
    if (source.dataset.infoTarget) {
      const target = scope.querySelector(source.dataset.infoTarget);
      if (target) return target;
    }
    if (source.hasAttribute('data-info-copy')) return source;
    if (source.parentElement?.matches('.field-label')) return source.parentElement;
    const selector = 'h1,h2,h3,h4,legend,summary,.label,.field-label,.chart-title,.feeds-title,.dial-card-name,.strictness-option-name';
    let node = source;
    while (node && node !== scope && node !== doc.body) {
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.matches(selector)) return sibling;
        if (sibling.matches('label')) return sibling.querySelector('span:not(.vui-info-source)') || sibling;
        const labels = sibling.querySelectorAll(selector);
        if (labels.length) return labels[labels.length - 1];
      }
      node = node.parentElement;
    }
    return source.parentElement;
  }
  function available(source) {
    if (!copy(source)) return false;
    for (let node = source; node && node !== doc.body; node = node.parentElement) {
      if (node.hidden || node.classList.contains('hidden')) return false;
    }
    return true;
  }
  function refresh(scope) {
    const config = scopes.get(scope); if (!config) return;
    const enabled = config.enabled();
    const grouped = new Map();
    scope.querySelectorAll(config.selector + ',[data-info-copy]').forEach(source => {
      if (!source.hasAttribute('data-info-copy')) source.classList.toggle('vui-info-source', enabled);
      if (!enabled || !available(source)) return;
      let anchor = anchorFor(source, scope);
      // Static help beside a hidden title label shares its field's visible anchor.
      if (anchor?.dataset.infoTarget) anchor = scope.querySelector(anchor.dataset.infoTarget) || anchor;
      if (anchor?.closest('button')) anchor = anchor.closest('button').parentElement;
      if (!anchor) return;
      if (!grouped.has(anchor)) grouped.set(anchor, []);
      grouped.get(anchor).push(source);
    });
    const oldButtons = new Set(scope.querySelectorAll('.vui-info-button'));
    const entries = [];
    grouped.forEach((sources, anchor) => {
      const texts = [...new Set(sources.map(copy))];
      const key = sources.map(source => [source.closest('[data-form-id]')?.dataset.formId || '', source.dataset.infoKey || source.dataset.info || source.dataset.i18n || source.id || copy(source)].join(':')).join('|');
      let button = Array.from(anchor.children).find(node => node.classList.contains('vui-info-button'));
      if (!button) {
        button = doc.createElement('button'); button.type = 'button';
        button.className = 'vui-info-button'; button.textContent = 'i';
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('pointerdown', event => event.stopPropagation());
        button.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          show(button.infoEntry);
        });
        anchor.appendChild(button);
      }
      oldButtons.delete(button);
      const labelNode = anchor.cloneNode(true);
      labelNode.querySelectorAll('.vui-info-button,.vui-info-source').forEach(node => node.remove());
      const label = `Info: ${sources.find(source => source.dataset.infoLabel)?.dataset.infoLabel || anchor.dataset.infoLabel || labelNode.textContent.trim().slice(0, 120) || 'About this setting'}`;
      if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      const entry = { button, texts, key, scope, label }; button.infoEntry = entry; entries.push(entry);
    });
    oldButtons.forEach(button => button.remove());
    if (open?.scope === scope) {
      const entry = entries.find(entry => entry.key === open.key);
      if (!entry) return close();
      if (open.button !== entry.button) {
        open.button = entry.button;
        entry.button.setAttribute('aria-expanded', 'true');
        entry.button.setAttribute('aria-controls', open.card.id);
        entry.button.setAttribute('aria-describedby', open.card.id);
      }
      if (open.texts.join('\n') !== entry.texts.join('\n')) { open.texts = entry.texts; content(entry); }
      // A snapshot can replace the dialog that contained the open card.
      if (!open.card.isConnected) {
        (entry.button.closest('[role="dialog"],.vui-menu,.tree-popover,.date-picker') || doc.body).appendChild(open.card);
        if (typeof open.card.showPopover === 'function') open.card.showPopover();
      }
      place();
    }
  }
  function watch(scope, options = {}) {
    if (scopes.has(scope)) return refresh(scope);
    const config = { selector: options.selector || '[data-info]', enabled: options.enabled || (() => doc.documentElement.lang === 'en') };
    scopes.set(scope, config);
    let queued = false;
    const observer = new MutationObserver(records => {
      // Popover updates and button attributes must not schedule themselves.
      if (records.every(record => record.target.closest?.('.vui-info-popover,.vui-info-button'))) return;
      if (queued) return;
      queued = true;
      global.requestAnimationFrame(() => { queued = false; refresh(scope); });
    });
    observer.observe(scope === doc ? doc.body : scope, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class','hidden','lang','data-info-copy'] });
    scope.addEventListener('scroll', event => {
      if (open?.scope === scope && !event.target.closest?.('.vui-info-popover')) close();
    }, true);
    refresh(scope);
  }
  doc.addEventListener('pointerdown', event => {
    if (open && !event.composedPath().includes(open.button) && !event.composedPath().includes(open.card)) close();
  }, true);
  doc.addEventListener('keydown', event => {
    if (open && event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); close(true);
    }
  }, true);
  global.addEventListener('resize', place);
  new MutationObserver(() => scopes.forEach((_, scope) => refresh(scope)))
    .observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });
  global.VaultInfo = Object.freeze({ watch, refresh, close });
})(typeof window !== 'undefined' ? window : globalThis);
