#!/usr/bin/env node
"use strict";

/* Verify source documents and every generated localized document copy. */

const fs = require("node:fs");
const path = require("node:path");

const workspace = path.resolve(__dirname, "..", "..");
const locales = ["ar", "bn", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pa", "pl", "pt", "ru", "th", "tr", "vi", "zh"];
const skippedDirectories = new Set([".build", ".git", "DerivedData", "bin", "build", "dist", "i18n-docs", "node_modules", "obj", "release", "tests"]);

function walkMarkdown(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) walkMarkdown(path.join(directory, entry.name), files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md") && (path.basename(directory) !== "manual" || entry.name === "en.md")) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function sourceDocuments() {
  const files = ["customBlocker", "macosBlocker", "windowsBlocker"]
    .flatMap((root) => walkMarkdown(path.join(workspace, root)));
  const changelog = path.join(workspace, "CHANGELOG.md");
  if (fs.existsSync(changelog)) files.push(changelog);
  return files.sort((a, b) => a.localeCompare(b));
}

function localizedDocumentPath(source, locale) {
  const relative = path.relative(workspace, source);
  if (path.basename(source) === "en.md" && path.basename(path.dirname(source)) === "manual") {
    return path.join(path.dirname(source), `${locale}.md`);
  }
  if (relative === "CHANGELOG.md") return path.join(workspace, "i18n-docs", locale, relative);
  const [product, ...rest] = relative.split(path.sep);
  return path.join(workspace, product, "i18n-docs", locale, ...rest);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const manuals = [
  ["Vault extension", "customBlocker/manual"],
  ["Mac Vault", "macosBlocker/Sources/MacBlockerWebUI/WebAssets/manual"],
  ["Windows Vault", "windowsBlocker/src/WindowsBlocker/WebAssets/manual"]
];

for (const [product, relative] of manuals) {
  const directory = path.join(workspace, relative);
  const found = fs.readdirSync(directory).filter((name) => name.endsWith(".md")).sort();
  const expected = ["en", ...locales].map((locale) => `${locale}.md`).sort();
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    fail(`${product}: manuals must contain exactly ${expected.length} locale files.`);
  } else {
    console.log(`${product}: ${expected.length} manuals are present.`);
  }
}

const sources = sourceDocuments();
let localizedCount = 0;
for (const source of sources) {
  for (const locale of locales) {
    const translated = localizedDocumentPath(source, locale);
    if (!fs.existsSync(translated) || !fs.readFileSync(translated, "utf8").trim()) {
      fail(`Missing localized document: ${path.relative(workspace, translated)}`);
    } else {
      localizedCount += 1;
    }
  }
}
console.log(`${sources.length} English source documents have ${localizedCount} localized copies.`);

const rawPath = path.join(workspace, "customBlocker", "translation", "unified-raw.en.json");
if (fs.existsSync(rawPath)) fail("The obsolete unified raw translation handoff must not be present.");

const websiteManualMirrors = [
  ["extension", path.join(workspace, "customBlocker", "manual"), path.join(workspace, "blockerWebsite", "vendor", "ext", "manual")],
  ["desktop app", path.join(workspace, "macosBlocker", "Sources", "MacBlockerWebUI", "WebAssets", "manual"), path.join(workspace, "blockerWebsite", "vendor", "app", "manual")]
];

for (const [product, sourceDirectory, websiteDirectory] of websiteManualMirrors) {
  for (const locale of ["en", ...locales]) {
    const source = path.join(sourceDirectory, `${locale}.md`);
    const websiteCopy = path.join(websiteDirectory, `${locale}.md`);
    if (!fs.existsSync(websiteCopy)) {
      fail(`The website's vendored ${product} ${locale} manual is missing.`);
    } else if (fs.readFileSync(source, "utf8") !== fs.readFileSync(websiteCopy, "utf8")) {
      fail(`The website's vendored ${product} ${locale} manual must match its canonical source.`);
    }
  }
  console.log(`Website ${product} manuals match their canonical sources.`);
}

const macManual = path.join(workspace, "macosBlocker", "Sources", "MacBlockerWebUI", "WebAssets", "manual", "en.md");
const windowsManual = path.join(workspace, "windowsBlocker", "src", "WindowsBlocker", "WebAssets", "manual", "en.md");
if (fs.readFileSync(macManual, "utf8") !== fs.readFileSync(windowsManual, "utf8")) {
  fail("Mac and Windows desktop app manuals must share the same functional reference.");
}

module.exports = { locales, localizedDocumentPath, sourceDocuments };
