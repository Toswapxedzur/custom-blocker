/* Real DOM focus/scroll regression; caller owns the isolated Playwright context.
 * Synthetic tag transport only. Loads the actual closed-shadow product renderer.
 */
"use strict";
const path = require("node:path");
const assert = require("node:assert/strict");

async function runFixture(context, sourceRoot, openingOnly) {
  const page = await context.newPage();
  const errors = [], checks = [];
  page.on("pageerror", error => errors.push(String(error)));
  let session;
  try {
    await page.setContent(`<style>body{margin:30px;font:16px Arial}article{width:700px}h3{margin:0;width:700px;height:${openingOnly ? 28 : 240}px;overflow:auto;white-space:nowrap;font:16px Arial}a{display:inline-block}button{font:inherit}</style><article><h3><a id="video-title" href="https://www.youtube.com/watch?v=EK32jo7i5LQ">Owned focus fixture</a><span style="display:block;height:300px" aria-hidden="true"></span></h3></article>`);
    await page.evaluate(() => {
      const tags = [
        { id: "block", name: "Block", lightColorHex: "#D4D4D4", darkColorHex: "#4A4A4A" },
        { id: "extra", name: "Extra", lightColorHex: "#D4D4D4", darkColorHex: "#4A4A4A" }
      ];
      window.chrome = { runtime: { id: "owned-offline-test", lastError: null, onMessage: { addListener() {} }, sendMessage(message, callback) {
        let reply = { ok: true, platformID: "youtube", entryID: message.entryID, tags: [tags[0]], predicted: false, pending: false };
        if (message.type === "vault-classifier-video-tags-batch") reply.items = message.items.map(item => ({ ...reply, entryID: item.entryID }));
        if (message.type === "vault-classifier-classifier-taxonomy") reply = { ok: true, types: [{ typeID: "fixture", tags }] };
        setTimeout(() => callback(reply), 0);
      } } };
    });
    await page.addScriptTag({ path: path.join(sourceRoot, "vault-classifier-contract.js") });
    await page.addScriptTag({ path: path.join(sourceRoot, "vault-classifier-tag-ui.js") });
    await page.evaluate(() => VaultClassifierTagUI.observe({ platform: "youtube", entryID: "youtube:video:EK32jo7i5LQ", creatorID: "youtube:channel:fixture", title: "Owned focus fixture", root: document.querySelector("article"), anchor: document.querySelector("a") }));
    session = await context.newCDPSession(page);
    await session.send("DOM.enable"); await session.send("Runtime.enable");
    async function control(cls) {
      const document = await session.send("DOM.getDocument", { depth: -1, pierce: true });
      const found = [];
      function walk(node) {
        const attributes = node.attributes || [];
        for (let i = 0; i < attributes.length; i += 2) if (attributes[i] === "class" && attributes[i + 1].split(/\s+/).includes(cls)) found.push(node);
        for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) walk(child);
      }
      walk(document.root);
      assert.equal(found.length, 1, "One actual closed-shadow " + cls);
      return (await session.send("DOM.resolveNode", { backendNodeId: found[0].backendNodeId })).object.objectId;
    }
    let plus;
    for (let i = 0; i < 50; i++) {
      try { plus = await control("add-btn"); break; } catch { await page.waitForTimeout(20); }
    }
    assert.ok(plus, "Actual tag renderer mounted");
    const panel = await control("panel");
    await session.send("Runtime.callFunctionOn", { objectId: panel, functionDeclaration: `function(){
      const panel=this,host=this.getRootNode().host;panel.__focusFixture={mutations:[],scrolls:[]};
      new MutationObserver(records=>{for(const record of records)panel.__focusFixture.mutations.push({oldValue:record.oldValue,open:panel.classList.contains('open')});}).observe(panel,{attributes:true,attributeOldValue:true,attributeFilter:['class']});
      document.addEventListener('scroll',event=>panel.__focusFixture.scrolls.push({trusted:event.isTrusted,target:event.target.tagName,includesHost:event.composedPath().includes(host),open:panel.classList.contains('open')}),true);
    }` });
    async function state() {
      const response = await session.send("Runtime.callFunctionOn", { objectId: panel, arguments: [{ objectId: plus }], returnByValue: true, functionDeclaration: `function(plus){const root=this.getRootNode(),r=this.getBoundingClientRect();return {railActiveClass:plus.getRootNode().activeElement?.className||null,open:this.classList.contains('open'),display:getComputedStyle(this).display,rootMode:root.mode,activeClass:root.activeElement?.className||null,rows:this.querySelectorAll('.panel-item').length,ancestorScrollTop:document.querySelector('h3').scrollTop,rect:{x:r.x,y:r.y,width:r.width,height:r.height},...this.__focusFixture};}` });
      return response.result.value;
    }
    async function open() {
      plus = await control("add-btn");
      const response = await session.send("Runtime.callFunctionOn", { objectId: plus, returnByValue: true, functionDeclaration: "function(){const r=this.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}" });
      await page.mouse.click(response.result.value.x, response.result.value.y);
      await page.waitForTimeout(120);
      return state();
    }
    const focused = await open();
    if (!focused.open || focused.ancestorScrollTop !== 0) {
      const failure = new Error("Search focus scrolled the title ancestor and dismissed Add Tag");
      failure.details = focused;
      throw failure;
    }
    assert.equal(focused.rootMode, "closed"); assert.equal(focused.activeClass, "panel-search"); assert.equal(focused.rows, 1);
    checks.push(openingOnly ? "Clipped ancestor opening only: search focus does not scroll or dismiss" : "Visible input receives focus while Add Tag remains open");
    if (openingOnly) { assert.deepEqual(errors, []); return { fixture: "clipped-opening-only", checks, focused, pageErrors: errors, qualification: "No typing or row visibility acceptance in the deliberately clipped fixture" }; }
    await page.keyboard.type("Extra");
    assert.equal((await state()).open, true); assert.equal((await state()).rows, 1);
    checks.push("Typing into the focused search keeps the chooser open");
    await page.keyboard.press("Escape");
    assert.equal((await state()).open, false); assert.match((await state()).railActiveClass, /add-btn/);
    checks.push("Escape still dismisses and returns focus to Add Tag");
    assert.equal((await open()).open, true);
    await page.mouse.click(1100, 800); assert.equal((await state()).open, false);
    checks.push("Genuine outside pointerdown still dismisses");
    assert.equal((await open()).open, true);
    await page.mouse.move(600, 40); await page.mouse.wheel(0, 80); await page.waitForTimeout(120);
    const scrolled = await state();
    assert.equal(scrolled.open, false); assert.ok(scrolled.scrolls.some(event => event.trusted && event.target === "H3" && !event.includesHost));
    checks.push("Genuine user ancestor scrolling still dismisses");
    assert.deepEqual(errors, []);
    return { fixture: "visible-interaction", checks, focused, scrolled, pageErrors: errors };
  } finally {
    if (session) await session.detach();
    await page.close();
  }
}

module.exports = async function run(context, sourceRoot = path.resolve(__dirname, "..")) {
  const clippedOpening = await runFixture(context, sourceRoot, true);
  const visibleInteraction = await runFixture(context, sourceRoot, false);
  return { clippedOpening, visibleInteraction, checks: [...clippedOpening.checks, ...visibleInteraction.checks] };
};
