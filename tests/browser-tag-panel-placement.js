/* Real DOM placement/lifecycle callback. Caller supplies an owned context and
 * the same pinned top-frame hit helper used by the actual replay. Transport is
 * synthetic; renderer, closed roots, focus, clicks, clipping and layout are real.
 */
"use strict";
const path = require("node:path");
const assert = require("node:assert/strict");

module.exports = async function run(context, sourceRoot, { targetHitGeometry, selectedOwnedPanelControl, legacy = false, only = null, expectContainingBlockFailure = false, expectBodyOffset = false } = {}) {
  assert.equal(typeof targetHitGeometry, "function", "Caller supplies the shared hit helper");
  assert.ok(legacy || typeof selectedOwnedPanelControl === "function", "Candidate uses the exact selected-owner helper");
  const contract = Object.freeze({ entryID: "youtube:video:EK32jo7i5LQ", videoID: "EK32jo7i5LQ", watchURL: "https://www.youtube.com/watch?v=EK32jo7i5LQ" });
  const findings = [];
  async function scene(name, { height = 28, outerStyle = "", bodyStyle = "", htmlStyle = "", noPopover = false, edge = false, mode = "normal" } = {}) {
    const page = await context.newPage(); let session;
    const hitProofs = [], errors = [], wheelObservations = [], milestones = [];
    page.on("pageerror", error => errors.push(String(error)));
    try {
      await page.setContent(`<style>html{${htmlStyle}}body{margin:30px;font:16px Arial;${bodyStyle}}#fixture-wrapper{${outerStyle}${edge ? "position:fixed;right:8px;bottom:8px" : ""}}ytd-video-renderer{display:block}article{width:700px}h3{margin:0;width:700px;height:${height}px;overflow:auto;white-space:nowrap;font:16px Arial}a{display:inline-block}</style><div id="fixture-wrapper"><ytd-video-renderer><article><h3><a id="video-title" href="https://www.youtube.com/watch?v=EK32jo7i5LQ">Owned placement fixture</a><span style="display:block;height:300px" aria-hidden="true"></span></h3></article></ytd-video-renderer></div>`);
      await page.evaluate(({ noPopover, deferred, paging }) => {
        if (noPopover) Object.defineProperty(HTMLElement.prototype, "showPopover", { configurable: true, value: undefined });
        const block = { id: "block", name: "Block", lightColorHex: "#D4D4D4", darkColorHex: "#4A4A4A" };
        const extra = { id: "extra", name: "Extra", lightColorHex: "#D4D4D4", darkColorHex: "#4A4A4A" };
        window.fixture = { privateHosts: [], registered: new Set(), callbacks: [], listeners: [], deferred, corrections: [], nextExtraName: "Extra", inputObservations: [] };
        for (const type of ["wheel", "scroll"]) document.addEventListener(type, event => {
          if (fixture.inputObservations.length >= 128) { fixture.inputObservationOverflow = true; return; }
          const h3 = document.querySelector("h3");
          fixture.inputObservations.push({ type, trusted: event.isTrusted, at: performance.now(),
            clientX: event.clientX, clientY: event.clientY, deltaX: event.deltaX, deltaY: event.deltaY,
            h3ScrollTop: h3?.scrollTop, h3ScrollHeight: h3?.scrollHeight, h3ClientHeight: h3?.clientHeight,
            path: event.composedPath().map(node => ({ tag: node.tagName || node.nodeName || null,
              id: node.id || null, cls: typeof node.className === "string" ? node.className : null,
              registeredHost: fixture.registered.has(node) })) });
        }, { capture: true, passive: true });
        window.cbRegisterPillHost = host => { fixture.privateHosts.push(host); fixture.registered.add(host); };
        window.cbUnregisterPillHost = host => fixture.registered.delete(host);
        window.chrome = { runtime: { id: "owned-placement-fixture", lastError: null,
          onMessage: { addListener(listener) { fixture.listeners.push(listener); } },
          sendMessage(message, callback) {
            let response = { ok: true, platformID: "youtube", entryID: message.entryID, tags: [block], predicted: false, pending: false };
            if (message.type === "vault-classifier-video-tags-batch") response.items = message.items.map(item => ({ ...response, entryID: item.entryID }));
            if (message.type === "vault-classifier-classifier-taxonomy") {
              response = { ok: true, types: [{ typeID: "fixture", tags: paging ? [block, ...Array.from({ length: 41 }, (_, index) => ({ ...extra, id: "extra-" + index, name: "Extra " + String(index).padStart(3, "0") }))] : [block, { ...extra, name: fixture.nextExtraName }] }] };
              if (fixture.deferred) { fixture.callbacks.push(() => callback(response)); return; }
            }
            if (message.type === "vault-classifier-submit-correction") fixture.corrections.push(message);
            setTimeout(() => callback(response), 0);
          }
        } };
      }, { noPopover, deferred: mode === "stale-taxonomy" || mode === "taxonomy-invalidation", paging: mode === "paging" });
      await page.addScriptTag({ path: path.join(sourceRoot, "vault-classifier-contract.js") });
      await page.addScriptTag({ path: path.join(sourceRoot, "vault-classifier-tag-ui.js") });
      async function observe(entryID = "youtube:video:EK32jo7i5LQ") {
        await page.evaluate(entryID => VaultClassifierTagUI.observe({ platform: "youtube", entryID, creatorID: "youtube:channel:fixture", title: "Owned placement fixture", root: document.querySelector("article"), anchor: document.querySelector("a") }), entryID);
      }
      await observe();
      session = await context.newCDPSession(page); await session.send("DOM.enable"); await session.send("Runtime.enable");
      async function control(cls) {
        if (!legacy && cls.startsWith("panel")) { const owned = await selectedOwnedPanelControl(session, contract, cls); assert.ok(owned.objectId, "Owned " + cls); return owned.objectId; }
        const tree = (await session.send("DOM.getDocument", { depth: -1, pierce: true })).root;
        const found = [];
        function walk(node) { const attrs = node.attributes || []; for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === "class" && attrs[i + 1].split(/\s+/).includes(cls)) found.push(node); for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) walk(child); }
        walk(tree); assert.equal(found.length, 1, "Unique closed-root " + cls);
        return (await session.send("DOM.resolveNode", { backendNodeId: found[0].backendNodeId })).object.objectId;
      }
      async function waitControl(cls) { let object; for (let i = 0; i < 50; i++) { try { object = await control(cls); break; } catch { await page.waitForTimeout(20); } } assert.ok(object, cls + " mounted"); return object; }
      let plus = await waitControl("add-btn"), panel = await control("panel");
      async function call(objectId, functionDeclaration, args = []) { return (await session.send("Runtime.callFunctionOn", { objectId, functionDeclaration, arguments: args, returnByValue: true })).result.value; }
      async function state() { return call(panel, `function(plus){const root=this.getRootNode(),r=this.getBoundingClientRect();return {open:this.classList.contains('open'),connected:this.isConnected,rootMode:root.mode,railRootMode:plus.getRootNode().mode,sameOwner:this.dataset.owner===plus.dataset.owner,owner:this.dataset.owner,activeClass:root.activeElement?.className||null,railFocused:plus.getRootNode().activeElement===plus,value:this.querySelector('.panel-search')?.value||'',heads:this.querySelectorAll('.panel-head').length,rows:this.querySelectorAll('.panel-item').length,rect:{x:r.x,y:r.y,width:r.width,height:r.height},topLayer:this.matches(':popover-open'),ancestorScrollTop:document.querySelector('h3')?.scrollTop};}`, [{ objectId: plus }]); }
      async function hit(objectId, stage) { const r = await call(objectId, "function(){const r=this.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}"); const point = { x: r.x + r.width / 2, y: r.y + r.height / 2 }; return targetHitGeometry(session, page, objectId, point, stage, proof => { if (!hitProofs.includes(proof)) hitProofs.push(proof); }); }
      async function open() { const h = await hit(plus, "plus"); assert.ok(h.hitAccepted); await page.mouse.click(h.point.x, h.point.y); await page.waitForTimeout(100); return state(); }
      const opened = await open(); assert.ok(opened.open); assert.equal(opened.activeClass, "panel-search");
      milestones.push({ stage: "opened", state: opened });
      if (mode === "paging") {
        assert.equal(opened.rows, 40);
        const list = await control("panel-list"), listHit = await hit(list, "internal-list-scroll"); assert.ok(listHit.hitAccepted);
        await page.mouse.move(listHit.point.x, listHit.point.y); await page.mouse.wheel(0, 100); await page.waitForTimeout(80);
        assert.ok(await call(list, "function(){return this.scrollTop > 0;}")); assert.equal((await state()).open, true);
        const nextHit = await hit(await control("panel-next"), "next-page"); assert.ok(nextHit.hitAccepted);
        await page.mouse.click(nextHit.point.x, nextHit.point.y); await page.waitForTimeout(80);
        const next = await state(); assert.equal(next.open, true); assert.equal(next.rows, 1);
        assert.equal(await call(await control("panel-item"), "function(){return this.textContent;}"), "Extra 040");
        const previousHit = await hit(await control("panel-previous"), "previous-page"); assert.ok(previousHit.hitAccepted);
        await page.mouse.click(previousHit.point.x, previousHit.point.y); await page.waitForTimeout(80);
        const previous = await state(); assert.equal(previous.open, true); assert.equal(previous.rows, 40);
        const closeHit = await hit(await control("panel-dismiss"), "dismiss-button"); assert.ok(closeHit.hitAccepted);
        await page.mouse.click(closeHit.point.x, closeHit.point.y); await page.waitForTimeout(80);
        const dismissed = await state(); assert.equal(dismissed.open, false); assert.equal(dismissed.railFocused, true);
        assert.equal(await page.evaluate(() => fixture.registered.size), 1, "Dismiss revokes the portal, preserving the rail registration");
        assert.deepEqual(await page.evaluate(() => fixture.corrections), []);
        findings.push({ name, accepted: true, opened, next, previous, dismissed, hitProofs }); return;
      } else if (mode === "stale-taxonomy") {
        await page.keyboard.press("Escape"); await open();
        await page.evaluate(() => fixture.callbacks.splice(0).forEach(callback => callback()));
        await page.waitForTimeout(100);
        const current = await state(); assert.equal(current.heads, 2, "Retired open cannot append its stale pager"); assert.equal(current.rows, 1);
      } else if (mode === "taxonomy-invalidation") {
        const previousOwner = opened.owner;
        await page.evaluate(() => {
          fixture.nextExtraName = "Fresh Extra";
          fixture.listeners.forEach(listener => listener({ type: "vault-classifier-state-updated", platform: "youtube" }, { id: chrome.runtime.id }));
        });
        await observe(); await page.waitForTimeout(100);
        plus = await control("add-btn"); panel = await control("panel"); await open();
        assert.notEqual((await state()).owner, previousOwner);
        assert.equal(await page.evaluate(() => fixture.callbacks.length), 2);
        await page.evaluate(() => fixture.callbacks[1]()); await page.waitForTimeout(80);
        await page.evaluate(() => fixture.callbacks[0]()); await page.waitForTimeout(80);
        await page.keyboard.press("Escape"); await open();
        assert.equal(await page.evaluate(() => fixture.callbacks.length), 2, "Current taxonomy remains cached after retired response");
        const row = await control("panel-item");
        assert.equal(await call(row, "function(){return this.textContent;}"), "Fresh Extra", "Retired taxonomy cannot replace current cache");
      } else if (mode === "removed-subtree" || mode === "remount") {
        if (mode === "removed-subtree") {
          await page.evaluate(() => document.querySelector("#fixture-wrapper").remove()); await page.waitForTimeout(100);
          assert.equal((await state()).connected, false); assert.equal(await page.evaluate(() => fixture.privateHosts.filter(host => host.isConnected).length), 0);
          assert.equal(await page.evaluate(() => fixture.registered.size), 0, "Subtree removal revokes both private registrations");
        } else {
          const owner = opened.owner;
          await page.evaluate(() => fixture.privateHosts.find(host => document.querySelector("article").contains(host)).remove()); await page.waitForTimeout(100);
          assert.equal((await state()).connected, false);
          plus = await control("add-btn"); panel = await control("panel"); const remounted = await open();
          assert.notEqual(remounted.owner, owner); assert.equal(remounted.sameOwner, true);
          assert.equal(await page.evaluate(() => fixture.registered.size), 2, "Retired rail/portal registrations are removed");
        }
        findings.push({ name, accepted: true, opened, hitProofs }); return;
      }
      if (mode === "owner-guards") {
        const original = await selectedOwnedPanelControl(session, contract, "panel-search");
        async function foreign(owner) { await page.evaluate(owner => {
          document.querySelector('#foreign-owner-fixture')?.remove();
          const host=document.createElement('span');host.id='foreign-owner-fixture';
          const shadow=host.attachShadow({mode:'closed'});const panel=document.createElement('div');panel.className='panel';panel.dataset.owner=owner;
          const input=document.createElement('input');input.className='panel-search';panel.append(input);shadow.append(panel);document.body.append(host);
        }, owner); }
        await foreign("different-owner");
        const ignoringForeign = await selectedOwnedPanelControl(session, contract, "panel-search");
        assert.equal(ignoringForeign.controlBackendNodeId, original.controlBackendNodeId, "Foreign owner cannot replace selected control");
        await foreign(opened.owner);
        await assert.rejects(() => selectedOwnedPanelControl(session, contract, "panel-search"), /Exact owned panel ambiguous/);
        await page.evaluate(() => document.querySelector('#foreign-owner-fixture').remove());
      }
      const search = await control("panel-search"), searchHit = await hit(search, "focused-search");
      if (mode === "fallback-body-offset") {
        assert.equal(searchHit.hitAccepted, true, "Viewport-propagated BODY overflow leaves the actual input usable");
        const placement = await call(panel, `function(){const r=this.getBoundingClientRect(),body=this.ownerDocument.body.getBoundingClientRect();return {
          requested:{left:parseFloat(this.style.left),top:parseFloat(this.style.top)},
          actual:{left:r.left,top:r.top},body:{left:body.left,top:body.top},
          delta:{x:r.left-parseFloat(this.style.left),y:r.top-parseFloat(this.style.top)}};}`);
        assert.ok(Math.abs(placement.delta.x) > 1 && Math.abs(placement.delta.y) > 1, "Containing block causes a measurable viewport-placement offset");
        assert.ok(Math.abs(placement.delta.x - placement.body.left) <= 1 && Math.abs(placement.delta.y - placement.body.top) <= 1);
        await page.keyboard.type("Extra"); const typed = await state();
        assert.equal(typed.open, true); assert.equal(typed.value, "Extra"); assert.equal(typed.rows, 1);
        assert.ok((await hit(await control("panel-item"), "offset-fallback-typed-extra-row")).hitAccepted);
        await page.keyboard.press("Escape"); assert.equal((await state()).open, false);
        findings.push({ name, accepted: true, qualification: "Measured fallback anchor offset despite usable input; not generic viewport-placement acceptance", opened, typed, placement, searchHit, hitProofs }); return;
      }
      if (mode === "fixed-negative" || mode === "fallback-body-limit") {
        assert.equal(searchHit.hitAccepted, false, "Meaningful containing-block/clipping negative is retained");
        findings.push({ name, accepted: true, qualification: "Expected real clipping/containing-block limitation; not usable-input acceptance", opened, searchHit, hitProofs }); return;
      }
      let viewportPlacement;
      if (mode === "fallback-body-anchor") {
        viewportPlacement = await call(panel, `function(){const r=this.getBoundingClientRect(),host=this.getRootNode().host;return {
          requested:{left:parseFloat(this.style.left),top:parseFloat(this.style.top)},actual:{left:r.left,top:r.top},
          delta:{x:r.left-parseFloat(this.style.left),y:r.top-parseFloat(this.style.top)},
          parentIsDocumentElement:host.parentElement===this.ownerDocument.documentElement,
          insideBody:this.ownerDocument.body.contains(host),connected:host.isConnected};}`);
        assert.ok(Math.abs(viewportPlacement.delta.x) <= 1 && Math.abs(viewportPlacement.delta.y) <= 1, "Root portal preserves requested viewport placement");
        assert.equal(viewportPlacement.parentIsDocumentElement, true); assert.equal(viewportPlacement.insideBody, false); assert.equal(viewportPlacement.connected, true);
      }
      if (!searchHit.hitAccepted) { const error = new Error("Clipped focused search is not the current hit target"); error.details = searchHit; throw error; }
      assert.equal(opened.rootMode, "closed"); assert.equal(opened.railRootMode, "closed"); assert.equal(opened.sameOwner, true);
      await page.keyboard.type("Extra"); const typed = await state(); assert.equal(typed.open, true); assert.equal(typed.value, "Extra"); assert.equal(typed.rows, 1); assert.equal(typed.ancestorScrollTop, 0);
      assert.ok((await hit(await control("panel-item"), "typed-extra-row")).hitAccepted);
      milestones.push({ stage: "typed-extra-visible-row", state: typed });
      if (edge) {
        const anchor = await call(plus, "function(){return {top:this.getBoundingClientRect().top};}");
        assert.ok(typed.rect.x >= 8 && typed.rect.x + typed.rect.width <= 1272);
        assert.ok(typed.rect.y >= 8 && typed.rect.y + typed.rect.height <= 892);
        assert.ok(typed.rect.y < anchor.top, "Bottom-edge panel is placed above its Plus");
      }
      await page.keyboard.press("Escape"); const escaped = await state(); assert.equal(escaped.open, false); assert.equal(escaped.railFocused, true);
      milestones.push({ stage: "escaped-focus-returned", state: escaped });
      await open(); await page.mouse.click(1100, 800); assert.equal((await state()).open, false);
      milestones.push({ stage: "outside-dismissed", state: await state() });
      await open();
      const h3 = await page.locator("h3").boundingBox();
      const wheelPoint = { x: h3.x + 8, y: h3.y + h3.height / 2 };
      const h3Object = (await session.send("Runtime.evaluate", { expression: "document.querySelector('h3')" })).result.objectId;
      const wheelBefore = await page.evaluate(() => {
        const h3 = document.querySelector("h3");
        return { scrollTop: h3.scrollTop, scrollHeight: h3.scrollHeight, clientHeight: h3.clientHeight,
          capturedEventCount: fixture.inputObservations.length };
      });
      const wheelHit = await targetHitGeometry(session, page, h3Object, wheelPoint, "ancestor-wheel-point", proof => {
        if (!hitProofs.includes(proof)) hitProofs.push(proof);
      });
      const resolvedWheelHit = await session.send("DOM.resolveNode", { backendNodeId: wheelHit.hitProtocol.backendNodeId });
      wheelHit.fixtureOwnership = await call(resolvedWheelHit.object.objectId, `function(){
        let node=this;
        for(let i=0;node&&i<16;i++){
          if(fixture.registered.has(node))return {registeredHostInHitPath:true,boundReached:false};
          node=node.parentElement||node.getRootNode?.().host||null;
        }
        return {registeredHostInHitPath:false,boundReached:!!node};
      }`);
      assert.equal(wheelHit.hitAccepted, true, "Wheel point must hit the actual ancestor or its composed descendant");
      assert.equal(wheelHit.fixtureOwnership.boundReached, false);
      assert.equal(wheelHit.fixtureOwnership.registeredHostInHitPath, false, "Wheel point must exclude the registered rail and portal");
      await page.mouse.move(wheelPoint.x, wheelPoint.y); await page.mouse.wheel(0, 80); await page.waitForTimeout(100);
      const wheelAfter = await page.evaluate(() => {
        const h3 = document.querySelector("h3");
        return { scrollTop: h3.scrollTop, scrollHeight: h3.scrollHeight, clientHeight: h3.clientHeight,
          capturedEvents: fixture.inputObservations, captureOverflow: !!fixture.inputObservationOverflow };
      });
      wheelObservations.push({ point: wheelPoint, before: wheelBefore, after: wheelAfter, hit: wheelHit, panel: await state() });
      assert.equal(wheelAfter.captureOverflow, false);
      assert.ok(wheelAfter.scrollTop > wheelBefore.scrollTop, "Actual ancestor must scroll before asserting dismissal");
      const newEvents = wheelAfter.capturedEvents.slice(wheelBefore.capturedEventCount);
      assert.ok(newEvents.some(event => event.type === "wheel" && event.trusted && event.path.some(node => node.tag === "H3") && event.path.every(node => !node.registeredHost)), "Trusted wheel must reach the ancestor outside registered rail and portal");
      assert.ok(newEvents.some(event => event.type === "scroll" && event.trusted && event.path.some(node => node.tag === "H3")), "Trusted changed ancestor scroll must be recorded");
      assert.equal((await state()).open, false);
      await page.evaluate(() => document.querySelector('h3').scrollTop = 0); await page.waitForTimeout(80); await open();
      await page.setViewportSize({ width: 1180, height: 800 }); await page.waitForTimeout(100); assert.equal((await state()).open, false);
      assert.deepEqual(await page.evaluate(() => fixture.corrections), []); assert.deepEqual(errors, []);
      findings.push({ name, accepted: true, opened, typed, escaped, hitProofs, wheelObservations, milestones, viewportPlacement });
    } catch (error) {
      error.fixtureObservation = { name, mode, completedFindings: findings, hitProofs, wheelObservations, errors, milestones,
        currentDOM: await page.evaluate(() => ({ inputObservations: window.fixture?.inputObservations,
          inputObservationOverflow: !!window.fixture?.inputObservationOverflow,
          connectedPrivateHosts: window.fixture?.privateHosts.filter(host => host.isConnected).length,
          registeredHosts: window.fixture?.registered.size })).catch(() => null) };
      throw error;
    } finally { if (session) await session.detach(); await page.close(); }
  }
  const scenes = [
    ["full-clipped-ancestor-visible-search-typing-row", {}],
    ["visible-input-dismissals-scroll-resize", { height: 240 }],
    ["transformed-card-ancestor-escape", { outerStyle: "transform:translateZ(0);height:80px;overflow:hidden" }],
    ["filtered-card-ancestor-escape", { outerStyle: "filter:blur(0);height:80px;overflow:hidden" }],
    ["body-containing-block-top-layer-escape", { bodyStyle: "transform:translateZ(0);height:60px;overflow:hidden" }],
    ["filtered-body-top-layer-escape", { bodyStyle: "filter:blur(0);height:60px;overflow:hidden" }],
    ["html-containing-block-top-layer-escape", { htmlStyle: "transform:translateZ(0);contain:paint;height:60px;overflow:hidden" }],
    ["popover-absent-body-portal-card-escape", { noPopover: true, outerStyle: "transform:translateZ(0);height:80px;overflow:hidden" }],
    ["popover-absent-body-anchor-position-hit-typing", { noPopover: true, bodyStyle: "transform:translateZ(0);height:60px;overflow:hidden", mode: "fallback-body-anchor" }],
    ["popover-absent-body-paint-containment-escape", { noPopover: true, bodyStyle: "transform:translateZ(0);contain:paint;height:60px;overflow:hidden" }],
    ["popover-absent-filtered-body-escape", { noPopover: true, bodyStyle: "filter:blur(0);height:60px;overflow:hidden" }],
    ["popover-absent-html-containing-block-limit", { noPopover: true, htmlStyle: "transform:translateZ(0);contain:paint;height:60px;overflow:hidden", mode: "fallback-body-limit" }],
    ["foreign-owner-ignored-matching-owner-ambiguity-refused", { height: 240, mode: "owner-guards" }],
    ["paging-next-previous-stays-open-dismiss-still-closes", { height: 240, mode: "paging" }],
    ["bottom-right-edge-flips-and-clamps", { edge: true }],
    ["retired-taxonomy-response-cannot-replace-current-cache", { height: 240, mode: "taxonomy-invalidation" }],
    ["removed-containing-subtree-releases-portal", { mode: "removed-subtree" }],
    ["rail-remount-retires-owner-and-portal", { mode: "remount" }],
    ["closed-reopened-pending-taxonomy-keeps-current-generation", { height: 240, mode: "stale-taxonomy" }]
  ];
  assert.ok(!expectContainingBlockFailure || only, "Expected-negative mode requires one explicit scene");
  assert.ok(!expectBodyOffset || only === "popover-absent-body-anchor-position-hit-typing", "Old BODY-offset characterization requires its exact explicit scene");
  for (const [name, options] of scenes) if (!only || only === name) await scene(name, expectContainingBlockFailure ? { ...options, mode: "fixed-negative" } : expectBodyOffset ? { ...options, mode: "fallback-body-offset" } : options);
  return { findings, accepted: findings.length > 0 && findings.every(finding => finding.accepted) };
};
