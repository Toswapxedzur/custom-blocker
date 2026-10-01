/* Vault UI — no native controls (owner 2026-09-28). Every <select> on the page
 * gets our own dropdown; the <select> stays (hidden) as the value the page's
 * code reads and writes, so no page logic changes: setting .value /
 * .selectedIndex, changing its options, disabling or hiding it all show up in
 * the dropdown, and choosing an item sets the select and fires "input" and
 * "change" as a user's pick would. Canonical here; sync-webui.sh copies it.
 */
(function (global) {
  "use strict";

  const document = global.document;
  // Only a real page has selects to replace (not a test's stand-in DOM).
  if (!document || typeof HTMLSelectElement === "undefined" || typeof MutationObserver === "undefined") {
    global.VaultUI = Object.freeze({ enhance() {}, observe() {}, close() {}, focusDialog: () => () => {}, confirmClick: () => true });
    return;
  }
  const dropdowns = new WeakMap(); // select -> { wrap, button, label }
  let menu = null;
  let openFor = null;

  function selectedText(select) {
    if (select.multiple) {
      return Array.from(select.selectedOptions, (option) => option.textContent.trim()).join(", ") || "—";
    }
    const option = select.options[select.selectedIndex];
    return option ? option.textContent.trim() : "";
  }

  function sync(select) {
    const entry = dropdowns.get(select);
    if (!entry) return;
    entry.label.textContent = selectedText(select) || " ";
    entry.button.disabled = select.disabled;
    entry.wrap.hidden = select.hidden || select.classList.contains("hidden");
    const title = select.getAttribute("aria-label") || select.title || "";
    if (title) entry.button.setAttribute("aria-label", title);
    if (openFor === select) renderMenu(select);
  }

  function closeMenu() {
    if (!menu) return;
    menu.remove();
    menu = null;
    openFor = null;
  }

  // A multiple select keeps its menu open and toggles the picked item.
  function choose(select, index) {
    if (select.multiple) {
      const option = select.options[index];
      option.selected = !option.selected;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    closeMenu();
    if (index === select.selectedIndex) return;
    select.selectedIndex = index;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function renderMenu(select) {
    menu.textContent = "";
    Array.from(select.options).forEach((option, index) => {
      if (option.hidden) return;
      const item = document.createElement("button");
      item.type = "button";
      const picked = select.multiple ? option.selected : index === select.selectedIndex;
      item.className = "vui-menu-item" + (picked ? " is-selected" : "");
      item.textContent = option.textContent.trim();
      item.disabled = option.disabled;
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        choose(select, index);
      });
      menu.appendChild(item);
    });
  }

  function placeMenu(button) {
    const box = button.getBoundingClientRect();
    menu.style.minWidth = Math.max(160, box.width) + "px";
    const below = global.innerHeight - box.bottom;
    const height = Math.min(menu.scrollHeight, 320);
    menu.style.left = Math.max(8, Math.min(box.left, global.innerWidth - menu.offsetWidth - 8)) + "px";
    menu.style.top = (below < height + 12 && box.top > below ? box.top - height - 4 : box.bottom + 4) + "px";
  }

  function openMenu(select) {
    const entry = dropdowns.get(select);
    if (!entry) return;
    if (openFor === select) return closeMenu();
    closeMenu();
    menu = document.createElement("div");
    menu.className = "vui-menu";
    menu.setAttribute("role", "listbox");
    openFor = select;
    renderMenu(select);
    document.body.appendChild(menu);
    placeMenu(entry.button);
    const current = menu.querySelector(".is-selected");
    if (current) current.scrollIntoView({ block: "nearest" });
  }

  // Page code sets .value / .selectedIndex directly (no event): watch both.
  function watchValue(select) {
    for (const property of ["value", "selectedIndex"]) {
      const native = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, property);
      Object.defineProperty(select, property, {
        configurable: true,
        get() { return native.get.call(this); },
        set(value) { native.set.call(this, value); sync(this); }
      });
    }
  }

  function enhance(select) {
    if (!(select instanceof HTMLSelectElement) || dropdowns.has(select)) return;
    const wrap = document.createElement("span");
    wrap.className = "vui-select";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vui-select-button";
    const label = document.createElement("span");
    label.className = "vui-select-label";
    button.appendChild(label);
    wrap.appendChild(button);
    select.classList.add("vui-native");
    select.after(wrap);
    dropdowns.set(select, { wrap, button, label });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openMenu(select);
    });
    watchValue(select);
    select.addEventListener("change", () => sync(select));
    new MutationObserver(() => sync(select)).observe(select, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["disabled", "hidden", "class", "aria-label", "selected"]
    });
    // A <label for> pointing at the select opens the dropdown.
    if (select.id) {
      select.getRootNode().querySelectorAll(`label[for="${CSS.escape(select.id)}"]`).forEach((forLabel) => {
        forLabel.addEventListener("click", (event) => { event.preventDefault(); button.focus(); });
      });
    }
    sync(select);
  }

  function enhanceAll(root) {
    if (root instanceof HTMLSelectElement) return enhance(root);
    if (root && root.querySelectorAll) root.querySelectorAll("select").forEach(enhance);
  }

  // Enhances every select under `scope` (the document, or a section's shadow
  // root) now and whenever one is added.
  function observe(scope) {
    enhanceAll(scope);
    new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach((node) => enhanceAll(node));
    }).observe(scope === document ? document.body : scope, { childList: true, subtree: true });
    // Scrolling does not leave a shadow root, so close the menu from inside it too.
    if (scope !== document) scope.addEventListener("scroll", closeMenu, true);
  }

  // Hints (owner 2026-09-30: no system tooltips): any element with data-hint,
  // in the page or a section's shadow root, shows it in a small card while
  // hovered or focused.
  let hint = null;
  function hintTarget(event) {
    return event.composedPath().find((node) => node instanceof Element && node.dataset && node.dataset.hint) || null;
  }
  function showHint(target) {
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "vui-hint";
      hint.setAttribute("role", "tooltip");
      document.body.appendChild(hint);
    }
    hint.textContent = target.dataset.hint;
    hint.hidden = false;
    const box = target.getBoundingClientRect();
    const width = hint.offsetWidth;
    const height = hint.offsetHeight;
    const below = box.bottom + 6 + height <= global.innerHeight;
    hint.style.top = `${below ? box.bottom + 6 : Math.max(4, box.top - 6 - height)}px`;
    hint.style.left = `${Math.max(4, Math.min(box.left, global.innerWidth - width - 4))}px`;
  }
  function hideHint() {
    if (hint) hint.hidden = true;
  }
  function watchHints() {
    const on = (event) => { const target = hintTarget(event); if (target) showHint(target); else hideHint(); };
    document.addEventListener("mouseover", on);
    document.addEventListener("focusin", on);
    document.addEventListener("mouseout", (event) => { if (!event.relatedTarget) hideHint(); });
    document.addEventListener("focusout", hideHint);
    document.addEventListener("scroll", hideHint, true);
  }

  function start() {
    observe(document);
    watchHints();
    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
    global.addEventListener("resize", closeMenu);
    document.addEventListener("scroll", (event) => { if (menu && !menu.contains(event.target)) closeMenu(); }, true);
  }

  // Dialog focus stays within its controls and returns to the opener on close.
  // This also works inside Mac Vault's scene shadow roots.
  function focusDialog(card, options = {}) {
    const root = card.getRootNode();
    const opener = options.returnFocus || root.activeElement;
    const controls = () => Array.from(card.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    )).filter((node) => !node.disabled && node.getClientRects().length);
    function onKey(event) {
      if (!card.isConnected || !card.getClientRects().length) return;
      if (event.key === "Escape" && options.onEscape) {
        event.preventDefault(); event.stopPropagation(); options.onEscape();
      } else if (event.key === "Tab") {
        const items = controls(), active = root.activeElement;
        if (!items.length) { event.preventDefault(); card.focus(); return; }
        const index = items.indexOf(active);
        if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === items.length - 1)) {
          event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus();
        }
      }
    }
    card.tabIndex = -1;
    document.addEventListener("keydown", onKey, true);
    (options.initialFocus || controls()[0] || card).focus({ preventScroll: true });
    return (restore = true) => {
      document.removeEventListener("keydown", onKey, true);
      if (!restore) return;
      if (typeof opener === "function") opener()?.focus({ preventScroll: true });
      else if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }

  // One way to confirm a delete in every section (owner 2026-09-30): the first
  // click arms the button (it shows `prompt` for a few seconds); a second click
  // while armed confirms → true. No dialog.
  const ARMED_MS = 4000;
  function disarm(button) {
    if (button.dataset.armedLabel !== undefined) button.textContent = button.dataset.armedLabel;
    delete button.dataset.armed;
    delete button.dataset.armedLabel;
  }
  function confirmClick(button, prompt) {
    const timer = Number(button.dataset.armed);
    if (timer) {
      clearTimeout(timer);
      disarm(button);
      return true;
    }
    button.dataset.armedLabel = button.textContent;
    button.textContent = prompt;
    button.dataset.armed = String(setTimeout(() => disarm(button), ARMED_MS));
    return false;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  global.VaultUI = Object.freeze({ enhance, observe, close: closeMenu, focusDialog, confirmClick });
})(typeof window !== "undefined" ? window : globalThis);
