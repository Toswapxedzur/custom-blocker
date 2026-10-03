#!/usr/bin/env node
"use strict";

// Audit the user/code guides shipped inside apps. Website and engineering
// documents are outside the owner's release translation scope.
const fs = require("node:fs");
const path = require("node:path");
const workspace = path.resolve(__dirname, "..", "..");
const locales = ["ar", "bn", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "nl", "pa", "pl", "pt", "ru", "th", "tr", "vi", "zh"];
const products = [
  ["Vault extension", "customBlocker"],
  ["Mac Vault", "macosBlocker/Sources/MacBlockerWebUI/WebAssets"],
  ["Windows Vault", "windowsBlocker/src/WindowsBlocker/WebAssets"],
  ["Safari Vault", "safariBlocker/extension"]
];
const fenceBlocks = text => [...text.matchAll(/^```[^\n]*\n[\s\S]*?^```\s*$/gm)].map(match => match[0]);
const inlineCode = text => [...text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, "").matchAll(/`([^`\n]+)`/g)].map(match => match[1]);
function fail(message) { console.error(message); process.exitCode = 1; }
function sourceDocuments() {
  return products.flatMap(([, root]) => ["manual", "code-manual"].map(kind => path.join(workspace, root, kind, "en.md")));
}
function localizedDocumentPath(source, locale) { return path.join(path.dirname(source), `${locale}.md`); }
let count = 0;
for (const [name, root] of products) {
  for (const kind of ["manual", "code-manual"]) {
    const directory = path.join(workspace, root, kind);
    const englishPath = path.join(directory, "en.md");
    if (!fs.existsSync(englishPath)) { fail(`${name}: missing English ${kind}.`); continue; }
    const english = fs.readFileSync(englishPath, "utf8");
    if (kind === "manual" && fenceBlocks(english).length) fail(`${name}: user guide must keep code tutorials in the separate code guide.`);
    const expected = ["en", ...locales].map(locale => `${locale}.md`).sort();
    const found = fs.readdirSync(directory).filter(file => file.endsWith(".md")).sort();
    if (JSON.stringify(found) !== JSON.stringify(expected)) fail(`${name}: ${kind} must contain exactly ${expected.length} locale guides.`);
    for (const locale of locales) {
      const file = localizedDocumentPath(englishPath, locale);
      if (!fs.existsSync(file)) { fail(`${name}: missing ${locale} ${kind}.`); continue; }
      const translated = fs.readFileSync(file, "utf8");
      if (!translated.trim() || translated === english) fail(`${name}: ${locale} ${kind} is empty or still English.`);
      if (JSON.stringify(fenceBlocks(translated)) !== JSON.stringify(fenceBlocks(english))) fail(`${name}: ${locale} ${kind} changes literal code blocks.`);
      if (JSON.stringify(inlineCode(translated)) !== JSON.stringify(inlineCode(english))) fail(`${name}: ${locale} ${kind} changes inline API/code identifiers.`);
      const headings = text => [...text.matchAll(/^(#{1,6})\s+/gm)].map(match => match[1]);
      if (JSON.stringify(headings(translated)) !== JSON.stringify(headings(english))) fail(`${name}: ${locale} ${kind} changes the section structure used by scene help links.`);
      const other = kind === "manual" ? "code-manual" : "manual";
      if (!translated.includes(`../${other}/${locale}.md`)) fail(`${name}: ${locale} ${kind} must link to its localized companion guide.`);
      count++;
    }
  }
}
const obsolete = path.join(workspace, "customBlocker/translation/unified-raw.en.json");
if (fs.existsSync(obsolete)) fail("The obsolete unified raw translation handoff must not be present.");
if (!process.exitCode) console.log(`Documentation audit passed: ${count} localized in-app guides; website excluded.`);
module.exports = { locales, localizedDocumentPath, sourceDocuments };
