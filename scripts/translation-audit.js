#!/usr/bin/env node
"use strict";

/*
 * Verify that every statically named UI translation key used by the three
 * editors exists in that product's English catalog and in every supported
 * locale catalog. This intentionally audits code and markup, never docs.
 */

const fs = require("node:fs");
const path = require("node:path");

const workspace = path.resolve(__dirname, "..", "..");
const locales = ["ar", "bn", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pa", "pl", "pt", "ru", "th", "tr", "vi", "zh"];
const products = [
  { id: "vaultExtension", name: "Vault extension", catalog: "customBlocker/translation/en.json" },
  { id: "macVault", name: "Mac Vault", catalog: "macosBlocker/Sources/MacBlockerWebUI/WebAssets/translation/en.json" },
  { id: "windowsVault", name: "Windows Vault", catalog: "windowsBlocker/src/WindowsBlocker/WebAssets/translation/en.json" }
];
const productSources = {
  vaultExtension: [
    "customBlocker/popup.html",
    "customBlocker/popup.js",
    "customBlocker/platform-profiles.js"
  ],
  macVault: [
    "macosBlocker/Sources/MacBlockerWebUI/WebAssets/popup.html",
    "macosBlocker/Sources/MacBlockerWebUI/WebAssets/popup.js"
  ],
  windowsVault: [
    "windowsBlocker/src/WindowsBlocker/WebAssets/popup.html",
    "windowsBlocker/src/WindowsBlocker/WebAssets/popup.js"
  ]
};

const keyPatterns = [
  /\bt\(\s*["']([A-Za-z0-9_.-]+)["']/g,
  /\b(?:label|placeholder|help|copy|title)Key\s*:\s*["']([A-Za-z0-9_.-]+)["']/g,
  /\bdata-i18n(?:-[A-Za-z-]+)?\s*=\s*["']([A-Za-z0-9_.-]+)["']/g
];

function collectKeys(file) {
  const source = fs.readFileSync(path.join(workspace, file), "utf8");
  const keys = new Set();
  for (const pattern of keyPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) keys.add(match[1]);
  }
  return keys;
}

function literalUiOutput(file) {
  const source = fs.readFileSync(path.join(workspace, file), "utf8");
  const output = [];
  const pattern = /(?:\.(?:textContent|innerText)\s*=|\bsetStatus\()\s*(["'`])([^\n]*?)\1/g;
  for (const match of source.matchAll(pattern)) {
    // Symbols and counters are not language. Any English words written directly
    // to a user-visible output surface must instead be read with t("key").
    const value = match[2].replace(/\\u[0-9a-fA-F]{4}/g, "");
    if (/[A-Za-z]/.test(value) && !/\bt\(/.test(value)) {
      const line = source.slice(0, match.index).split("\n").length;
      output.push(`${file}:${line}`);
    }
  }
  return output;
}

function literalUiAttribute(file) {
  const source = fs.readFileSync(path.join(workspace, file), "utf8");
  const output = [];
  const patterns = [
    /\.setAttribute\(\s*["'](?:title|aria-label|placeholder)["']\s*,\s*(["'`])([^\n]*?)\1/g,
    /\.(?:title|placeholder|ariaLabel)\s*=\s*(["'`])([^\n]*?)\1/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match[2].replace(/\\u[0-9a-fA-F]{4}/g, "");
      if (/[A-Za-z]/.test(value) && !/\bt\(/.test(value)) {
        const line = source.slice(0, match.index).split("\n").length;
        output.push(`${file}:${line}`);
      }
    }
  }
  return output;
}

function staticHtmlTextWithoutKey(file) {
  if (!file.endsWith(".html")) return [];
  const source = fs.readFileSync(path.join(workspace, file), "utf8");
  const output = [];
  const pattern = /<(button|label|p|h[1-6]|span|option|summary)([^>]*)>([^<]+)<\/\1>/g;
  for (const match of source.matchAll(pattern)) {
    const attributes = match[2];
    const text = match[3].trim();
    if (text && /[A-Za-z]/.test(text) && !/\bdata-i18n(?:-|=)/.test(attributes) && !/aria-hidden/.test(attributes)) {
      const line = source.slice(0, match.index).split("\n").length;
      output.push(`${file}:${line}`);
    }
  }
  return output;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

let usedKeyCount = 0;
for (const product of products) {
  const catalogPath = path.join(workspace, product.catalog);
  const catalogDirectory = path.dirname(catalogPath);
  const english = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const used = new Set();
  for (const file of productSources[product.id]) {
    for (const key of collectKeys(file)) used.add(key);
  }

  const missingEnglish = [...used].filter((key) => !Object.hasOwn(english, key)).sort();
  const literalOutput = productSources[product.id].flatMap(literalUiOutput);
  const literalAttribute = productSources[product.id].flatMap(literalUiAttribute);
  const staticHtmlOutput = productSources[product.id].flatMap(staticHtmlTextWithoutKey);
  if (missingEnglish.length) fail(`${product.name}: missing English keys: ${missingEnglish.join(", ")}`);
  if (literalOutput.length) fail(`${product.name}: hard-coded user output must use t(key): ${literalOutput.join(", ")}`);
  if (literalAttribute.length) fail(`${product.name}: hard-coded UI attributes must use t(key): ${literalAttribute.join(", ")}`);
  if (staticHtmlOutput.length) fail(`${product.name}: static UI text must have data-i18n: ${staticHtmlOutput.join(", ")}`);
  for (const locale of locales) {
    const localizedPath = path.join(catalogDirectory, `${locale}.json`);
    if (!fs.existsSync(localizedPath)) {
      fail(`${product.name}: missing ${locale} catalog.`);
      continue;
    }
    const localized = JSON.parse(fs.readFileSync(localizedPath, "utf8"));
    const missing = Object.keys(english).filter((key) => typeof localized[key] !== "string" || !localized[key]);
    const extra = Object.keys(localized).filter((key) => !Object.hasOwn(english, key));
    if (missing.length || extra.length) {
      fail(`${product.name}: ${locale} catalog differs from English keys (missing ${missing.length}, extra ${extra.length}).`);
    }
  }
  usedKeyCount += used.size;
  console.log(`${product.name}: ${used.size} static UI keys and ${locales.length} complete locale catalogs are covered.`);
}

if (!process.exitCode) {
  console.log(`Translation audit passed: ${usedKeyCount} static product-key references.`);
}
