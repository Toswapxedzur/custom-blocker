// Content-world labels only. User taxonomy and custom-rule text are never translated.
(function (global) {
  "use strict";
  const messages = global.VaultContentMessages || {};
  let language = String(global.navigator?.language || "en").toLowerCase().split("-")[0];
  if (!messages[language]) language = "en";
  const listeners = new Set();
  function select(value) {
    const next = messages[value] ? value : "en";
    if (language === next) return;
    language = next;
    for (const listener of listeners) listener();
  }
  function t(key, fallback, values = {}) {
    let text = messages[language]?.[key] ?? messages.en?.[key] ?? fallback ?? key;
    for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  }
  global.VaultContentI18n = Object.freeze({ t, get language() { return language; }, onChange(fn) { listeners.add(fn); } });
  try {
    global.chrome?.storage?.local?.get?.("vaultUiLanguage", stored => {
      if (typeof stored?.vaultUiLanguage === "string") select(stored.vaultUiLanguage);
    });
    global.chrome?.storage?.onChanged?.addListener?.((changes, area) => {
      if (area === "local" && changes.vaultUiLanguage) select(changes.vaultUiLanguage.newValue);
    });
  } catch (_) {}
})(typeof globalThis !== "undefined" ? globalThis : this);
