/* Content-world language preference, interpolation and safe fallback contract. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const english = JSON.parse(fs.readFileSync(path.join(root, "translation/en.json"), "utf8"));
let storageRead, storageChange;
const context = vm.createContext({
  navigator: { language: "de-DE" },
  // Deliberately small test locale distinguishes selected language from English fallback.
  VaultContentMessages: { en: english, de: { "contentTag.tagging": "Wird getaggt", "contentPage.blockedBy": "Gesperrt durch {group}" }, ar: { "contentTag.tagging": "جارٍ وضع العلامات" } },
  chrome: { storage: { local: { get(key, callback) { assert.equal(key, "vaultUiLanguage"); storageRead = callback; } },
    onChanged: { addListener(callback) { storageChange = callback; } } } }
});
vm.runInContext(fs.readFileSync(path.join(root, "vault-content-i18n.js"), "utf8"), context);
const ui = context.VaultContentI18n;
assert.equal(ui.t("contentTag.tagging"), "Wird getaggt");
assert.equal(ui.t("contentPage.blockedBy", "", { group: "<my group>" }), "Gesperrt durch <my group>");
assert.equal(ui.t("contentTag.untagged"), english["contentTag.untagged"]);
let changes = 0; ui.onChange(() => changes++);
storageRead({ vaultUiLanguage: "ar" });
assert.equal(ui.language, "ar"); assert.equal(changes, 1);
assert.equal(ui.t("contentTag.tagging"), "جارٍ وضع العلامات");
storageChange({ vaultUiLanguage: { newValue: "de" } }, "sync");
assert.equal(ui.language, "ar");
storageChange({ vaultUiLanguage: { newValue: "de" } }, "local");
assert.equal(ui.language, "de"); assert.equal(changes, 2);
storageChange({ vaultUiLanguage: { newValue: "de" } }, "local"); assert.equal(changes, 2);
storageChange({ vaultUiLanguage: { newValue: "not-a-locale" } }, "local");
assert.equal(ui.language, "en"); assert.equal(ui.t("contentTag.tagging"), "Tagging");
assert.equal(ui.t("unknown", "Safe fallback"), "Safe fallback");
// Exercise the shipped compact payload too, so a stale generated catalog cannot
// silently make every real webpage fall back to English.
const shipped = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, "content-messages.js"), "utf8"), shipped);
const localeFiles = fs.readdirSync(path.join(root, "translation")).filter(file => file.endsWith(".json"));
assert.equal(Object.keys(shipped.VaultContentMessages).length, localeFiles.length);
for (const file of localeFiles) {
  const locale = file.slice(0, -5);
  const full = JSON.parse(fs.readFileSync(path.join(root, "translation", file), "utf8"));
  const page = vm.createContext({ navigator: {language: locale}, VaultContentMessages: shipped.VaultContentMessages });
  vm.runInContext(fs.readFileSync(path.join(root, "vault-content-i18n.js"), "utf8"), page);
  assert.equal(page.VaultContentI18n.language, locale);
  for (const [key, value] of Object.entries(full).filter(([key]) => key.startsWith("contentTag.") || key.startsWith("contentPage."))) {
    assert.equal(page.VaultContentI18n.t(key), value, `${locale}/${key}: generated webpage text is stale`);
  }
}
console.log("PASS content labels follow locale/persisted preference, preserve user values, notify existing pages and fall back safely");
console.log(`PASS shipped webpage catalogs match all ${localeFiles.length} interface languages`);
console.log("__CB_TEST_RESULT__: OK");
