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
    global.VaultUI = Object.freeze({ enhance() {}, observe() {}, close() {}, focusDialog: () => () => {}, confirmClick: () => true, refreshList() {}, captureSearch: () => null, restoreSearch() {}, searchQuery: () => "" });
    return;
  }
  const dropdowns = new WeakMap(); // select -> { wrap, button, label }
  let menu = null;
  let openFor = null;
  const searchStates = new WeakMap(); // scope -> queries; display state only
  const searchableLists = new WeakMap();
  const SEARCH_THRESHOLD = 5;

  function searchState(list) {
    const scope = list.getRootNode();
    if (!searchStates.has(scope)) searchStates.set(scope, new Map());
    const states = searchStates.get(scope), key = list.dataset.vuiSearch;
    if (!states.has(key)) states.set(key, { query: "" });
    return states.get(key);
  }

  function searchControls(label, onInput) {
    const bar = document.createElement("div");
    bar.className = "vui-search";
    const input = document.createElement("input");
    input.type = "text"; // caret APIs work consistently in Chromium and WKWebView
    input.setAttribute("role", "searchbox");
    input.inputMode = "search";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = label;
    input.setAttribute("aria-label", label);
    bar.dataset.infoKey = "search:" + label;
    bar.dataset.infoCopy = "Find entries by name or identifier. Search changes only the displayed list.";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "vui-search-clear";
    clear.textContent = "×";
    clear.setAttribute("aria-label", "Clear search");
    const update = () => { clear.hidden = !input.value; onInput(input.value); };
    input.addEventListener("input", update);
    clear.addEventListener("click", () => { input.value = ""; update(); input.focus({ preventScroll: true }); });
    bar.append(input, clear);
    return { bar, input, clear };
  }

  function refreshList(list) {
    if (!list.isConnected || !list.dataset.vuiSearch) return;
    let entry = searchableLists.get(list);
    if (entry && entry.key !== list.dataset.vuiSearch) { entry.bar.remove(); entry = null; }
    const state = searchState(list);
    if (!entry) {
      entry = searchControls(list.dataset.vuiSearchLabel || "Search this list", (value) => {
        searchState(list).query = value;
        refreshList(list);
      });
      entry.key = list.dataset.vuiSearch;
      entry.bar.dataset.infoKey = "list-search:" + entry.key;
      if (list.dataset.vuiSearchCopy) entry.bar.dataset.infoCopy = list.dataset.vuiSearchCopy;
      entry.input.dataset.vuiSearchInput = entry.key;
      entry.empty = document.createElement("span");
      entry.empty.className = "vui-search-empty";
      entry.empty.textContent = "No matches";
      entry.empty.setAttribute("role", "status");
      entry.bar.appendChild(entry.empty);
      if (list.dataset.vuiSearchMode === "find") {
        entry.next = document.createElement("button");
        entry.next.type = "button";
        entry.next.textContent = "Next match";
        entry.next.dataset.vuiNextMatch = "";
        entry.empty.classList.add("vui-search-count");
        entry.next.className = "vui-search-clear";
        entry.next.addEventListener("click", () => {
          state.matchIndex = ((state.matchIndex || 0) + 1) % Math.max(1, entry.matches.length);
          refreshList(list);
          jumpToMatch(list, entry, state);
        });
        entry.bar.appendChild(entry.next);
      }
      list.before(entry.bar);
      searchableLists.set(list, entry);
      new MutationObserver(() => refreshList(list)).observe(list, { childList: true, subtree: true, characterData: true });
    }
    const find = list.dataset.vuiSearchMode === "find";
    const items = Array.from(find ? list.querySelectorAll(list.dataset.vuiSearchItems) : list.children).filter((item) =>
      list.dataset.vuiSearchItems ? item.matches(list.dataset.vuiSearchItems) : !item.hasAttribute("data-vui-search-ignore"));
    const query = state.query.trim().toLowerCase();
    entry.input.value = state.query;
    entry.clear.hidden = !state.query;
    entry.bar.hidden = items.length <= SEARCH_THRESHOLD && !state.query;
    let shown = 0;
    entry.matches = [];
    for (const item of items) {
      const text = item.dataset.vuiSearchText ?? ((item.textContent || "") + " " + (item.dataset.hint || ""));
      const hidden = !!query && !text.toLowerCase().includes(query);
      item.classList.toggle("vui-search-hidden", !find && hidden);
      item.classList.toggle("vui-search-match", find && !!query && !hidden);
      if (!hidden) { shown++; entry.matches.push(item); }
    }
    entry.empty.hidden = !query || shown > 0;
    if (find) {
      entry.next.hidden = !query || !shown;
      if (state.lastQuery !== query) {
        state.matchIndex = 0;
        if (query) jumpToMatch(list, entry, state);
      }
      if (query && shown) {
        entry.empty.hidden = false;
        entry.empty.textContent = `${(state.matchIndex || 0) % shown + 1} / ${shown} matches`;
      } else entry.empty.textContent = "No matches";
    }
    state.lastQuery = query;
    list.dispatchEvent(new CustomEvent("vui-search-filtered", { detail: { query, shown, total: items.length } }));
  }

  function jumpToMatch(list, entry, state) {
    const item = entry.matches[(state.matchIndex || 0) % entry.matches.length];
    if (!item) return;
    // Move only the canvas, leaving the page and search field in place.
    list.scrollLeft = Math.max(0, item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2);
    list.scrollTop = Math.max(0, item.offsetTop - (list.clientHeight - item.offsetHeight) / 2);
  }

  function enhanceLists(root) {
    if (root?.matches?.("[data-vui-search]")) refreshList(root);
    root?.querySelectorAll?.("[data-vui-search]").forEach(refreshList);
    if (root?.matches?.("[data-vui-find-text]")) enhanceTextFind(root);
    root?.querySelectorAll?.("[data-vui-find-text]").forEach(enhanceTextFind);
  }

  const textFinds = new WeakSet();
  function enhanceTextFind(field) {
    if (textFinds.has(field)) return;
    textFinds.add(field);
    let matches = [], index = 0;
    const controls = searchControls("Find tag rule", () => { index = 0; update(); });
    controls.bar.dataset.infoKey = "text-find:" + field.id;
    controls.bar.dataset.infoCopy = "Find a saved tag rule without changing the text. Next match moves to the matching line.";
    const next = document.createElement("button");
    next.type = "button";
    next.className = "vui-search-clear";
    next.textContent = "Next match";
    const status = document.createElement("span");
    status.className = "vui-search-empty";
    status.setAttribute("role", "status");
    function update() {
      const query = controls.input.value.trim().toLowerCase();
      let start = 0;
      matches = field.value.split("\n").flatMap((line) => {
        const offset = start;
        start += line.length + 1;
        return query && line.toLowerCase().includes(query) ? [{ start: offset, end: offset + line.length }] : [];
      });
      controls.bar.hidden = field.value.split("\n").filter(line => line.trim()).length <= SEARCH_THRESHOLD && !controls.input.value;
      index %= Math.max(1, matches.length);
      next.hidden = !matches.length;
      status.hidden = !query;
      status.textContent = matches.length ? `${index + 1} / ${matches.length} matches` : "No matches";
      if (matches.length) {
        field.setSelectionRange(matches[index].start, matches[index].end);
        field.scrollTop = field.value.slice(0, matches[index].start).split("\n").length * (parseFloat(global.getComputedStyle(field).lineHeight) || 18) - field.clientHeight / 2;
      }
    }
    next.addEventListener("click", () => { index++; update(); field.focus({ preventScroll: true }); });
    controls.bar.append(next, status);
    field.before(controls.bar);
    field.addEventListener("input", update);
    new MutationObserver(update).observe(field, { childList: true, attributes: true, attributeFilter: ["disabled"] });
    const native = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    Object.defineProperty(field, "value", { configurable: true, get() { return native.get.call(this); }, set(value) { native.set.call(this, value); update(); } });
    update();
  }

  // Scene renderers capture before replacing their DOM and restore afterward.
  function captureSearch(scope) {
    if (menu && openFor?.__vuiScope === scope && document.activeElement === menu.querySelector("input")) {
      const input = document.activeElement;
      return { menu: true, start: input.selectionStart, end: input.selectionEnd };
    }
    const input = scope.activeElement;
    if (!input?.dataset?.vuiSearchInput) return null;
    return { key: input.dataset.vuiSearchInput, start: input.selectionStart, end: input.selectionEnd };
  }
  function restoreSearch(scope, focus) {
    enhanceAll(scope);
    enhanceLists(scope);
    if (!focus) return;
    if (focus.menu) {
      const input = menu?.querySelector("input");
      if (input && openFor?.isConnected && openFor.__vuiScope === scope) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(focus.start, focus.end);
      }
      return;
    }
    const input = Array.from(scope.querySelectorAll("[data-vui-search-input]")).find((node) => node.dataset.vuiSearchInput === focus.key);
    if (input && !input.closest("[hidden]")) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(focus.start, focus.end);
    }
  }

  function selectKey(select) {
    return select.id || `${select.closest("[data-form-id]")?.dataset.formId || ""}:${select.dataset.field || select.getAttribute("aria-label") || ""}`;
  }

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
    if (!menu.querySelector(".vui-menu-options")) {
      const controls = searchControls("Search options", () => { renderMenu(select === openFor ? select : openFor); });
      menu.appendChild(controls.bar);
      const options = document.createElement("div");
      options.className = "vui-menu-options";
      menu.appendChild(options);
      menu.addEventListener("click", (event) => event.stopPropagation());
    }
    const search = menu.querySelector("input"), bar = menu.querySelector(".vui-search");
    const options = menu.querySelector(".vui-menu-options");
    const query = search.value.trim().toLowerCase();
    bar.querySelector(".vui-search-clear").hidden = !search.value;
    const available = Array.from(select.options).filter((option) => !option.hidden);
    bar.hidden = available.length <= SEARCH_THRESHOLD && !search.value;
    options.textContent = "";
    let group = null, count = 0;
    Array.from(select.options).forEach((option, index) => {
      if (option.hidden) return;
      if (query && !option.textContent.toLowerCase().includes(query)) return;
      const parent = option.parentElement;
      if (parent?.tagName === "OPTGROUP" && parent !== group) {
        const heading = document.createElement("div");
        heading.className = "vui-menu-group";
        heading.textContent = parent.label;
        options.appendChild(heading);
      }
      group = parent;
      const item = document.createElement("button");
      item.type = "button";
      const picked = select.multiple ? option.selected : index === select.selectedIndex;
      item.className = "vui-menu-item" + (picked ? " is-selected" : "");
      item.textContent = option.textContent.trim();
      item.disabled = option.disabled || (parent?.tagName === "OPTGROUP" && parent.disabled);
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        choose(select, index);
      });
      options.appendChild(item);
      count++;
    });
    if (!count) { const empty = document.createElement("div"); empty.className = "vui-menu-group"; empty.textContent = "No matches"; options.appendChild(empty); }
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
    const search = menu.querySelector(".vui-search:not([hidden]) input");
    if (search) search.focus({ preventScroll: true });
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
    // Snapshot renderers replace selects. Rebind the open menu without losing
    // its search input, query or focus.
    if (openFor && !openFor.isConnected && openFor.__vuiScope === select.getRootNode()
        && selectKey(openFor) !== ":" && selectKey(openFor) === selectKey(select)) {
      openFor = select;
      renderMenu(select);
      placeMenu(button);
    }
    select.__vuiScope = select.getRootNode();
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
    enhanceLists(scope);
    new MutationObserver((records) => {
      for (const record of records) record.addedNodes.forEach((node) => { enhanceAll(node); enhanceLists(node); });
      if (openFor && !openFor.isConnected) closeMenu();
    }).observe(scope === document ? document.body : scope, { childList: true, subtree: true });
    // Scrolling does not leave a shadow root, so close the menu from inside it too.
    if (scope !== document) scope.addEventListener("scroll", (event) => {
      if (menu && !menu.contains(event.target)) closeMenu();
    }, true);
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
  const dialogStack = [];
  function focusDialog(card, options = {}) {
    dialogStack.push(card);
    const root = card.getRootNode();
    const opener = options.returnFocus || root.activeElement;
    const controls = () => Array.from(card.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    )).filter((node) => !node.disabled && node.getClientRects().length);
    function onKey(event) {
      if (dialogStack[dialogStack.length - 1] !== card || !card.isConnected || !card.getClientRects().length) return;
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
      const index = dialogStack.lastIndexOf(card);
      if (index >= 0) dialogStack.splice(index, 1);
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

  global.VaultUI = Object.freeze({ enhance, observe, close: closeMenu, focusDialog, confirmClick, refreshList, captureSearch, restoreSearch,
    searchQuery: (list) => searchState(list).query });
})(typeof window !== "undefined" ? window : globalThis);
