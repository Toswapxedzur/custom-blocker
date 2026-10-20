"use strict";
const assert = require("node:assert/strict");
const { setup, frame, cluster, state } = require("./runner-first-link.js");
const clone = value => JSON.parse(JSON.stringify(value));
let passed = 0;
const check = (value, label) => { assert(value, label); passed++; console.log(`PASS ${label}`); };
function snapshot({ ready = true, contributed = true, affected = true, generation = "full-canonical" } = {}) {
  const c = cluster("chrome", contributed);
  c.shared.browserIdentityStatus = { state: ready ? "ready" : "upgrade-required", generation, canonicalEnabled: true, affectsBrowserBudget: affected };
  c.shared.scalars.enabled = ready;
  c.shared.scalars.allowedMinutes = 17;
  c.shared.usageMs = 234000;
  c.shared.scopes.push({ id: "site-1", surface: "site", action: "block", sites: ["example.com"], sitesExcept: false });
  return c;
}
const conn = env => env.run("cbConnection");
const group = async env => (await state(env)).blockedGroups[0];
const deleteRequest = async env => ({ changes: [env.run("CBGroupScopes.editorChange")(await group(env), null, "browser")] });
const unlinkFrames = env => env.ctx.__sent.filter(f => f.kind === "group-unlink");
async function sendRemoval(env, c, request, { ok = true, error } = {}) {
  if (ok) env.run("cbConnection").handleMessage({ kind: "cluster-updated", cluster: { ...clone(c), members: [] } });
  env.run("cbConnection").handleMessage({ kind: "group-unlink-response", requestID: request.requestID, groupId: request.groupId, ok, ...(error ? { error } : {}) });
}
async function readyEnv() {
  const env = await setup();
  conn(env).browserIdentityVersion = 1;
  const old = await group(env);
  await env.ctx.chrome.storage.local.set({ blockedGroups: [{ ...old, enabled: false }] });
  const c = snapshot();
  await frame(env, c);
  check((await group(env)).enabled === true && env.ctx.__sent.some(f => f.browserIdentitySnapshotApplied?.generation === c.shared.browserIdentityStatus.generation), "stale effective disabled bootstrap saves canonical enabled before current ACK");
  return { env, c };
}
(async () => {
  const blocked = await setup();
  blocked.ctx.__c = snapshot();
  blocked.run("cbConnection.clusters=[__c];cbSaveClusterCopy([__c])");
  await blocked.run("cbConnection.membershipApplyTail");
  const original = await state(blocked);
  await assert.rejects(blocked.run("cbApplyEditorRequest")(await deleteRequest(blocked)), /browser-sync-required/);
  await assert.rejects(blocked.run('cbBrowserRequestBody("settings-delete-group",{id:"L"})'), /browser-sync-required/);
  check(JSON.stringify(await state(blocked)) === JSON.stringify(original) && !unlinkFrames(blocked).length, "unacknowledged affected editor/tool deletion refuses before definition or usage writes");
  await frame(blocked, snapshot({ contributed: false, generation: "original-only" }));
  await assert.rejects(blocked.run("cbApplyEditorRequest")(await deleteRequest(blocked)), /browser-sync-required/);
  check(!unlinkFrames(blocked).length && (await state(blocked)).blockedGroups.length === 1, "original-retention ACK cannot authorize deletion before complete canonical bootstrap");
  await frame(blocked, snapshot({ ready: false }));
  await assert.rejects(blocked.run("cbApplyEditorRequest")(await deleteRequest(blocked)), /browser-upgrade-required/);
  check((await state(blocked)).blockedGroups.length === 1, "legacy affected deletion preserves the local group and returns upgrade refusal");

  const ordinary = await setup();
  ordinary.ctx.__c = snapshot({ affected: false });
  ordinary.run("cbConnection.clusters=[__c];cbSaveClusterCopy([__c])");
  await ordinary.run("cbConnection.membershipApplyTail");
  await ordinary.run("cbApplyEditorRequest")(await deleteRequest(ordinary));
  check((await state(ordinary)).blockedGroups.length === 0 && !unlinkFrames(ordinary).length, "unaffected online deletion keeps its existing path without a new ACK prerequisite");

  const offline = await setup();
  await frame(offline, snapshot({ affected: false }));
  conn(offline).desktopRouteIsReady = () => false;
  const offlineBefore = await state(offline);
  await assert.rejects(offline.run('cbBrowserRequestBody("settings-delete-all",{})'), /desktop-vault-away/);
  await assert.rejects(offline.run("cbApplyEditorRequest")(await deleteRequest(offline)), /desktop-unavailable/);
  check(JSON.stringify(await state(offline)) === JSON.stringify(offlineBefore), "unaffected linked browser budgets retain existing offline read-only deletion rule");

  const { env: live, c } = await readyEnv();
  const first = conn(live).unlinkBrowserBudgetGroup(await group(live));
  const duplicate = conn(live).unlinkBrowserBudgetGroup(await group(live));
  check(first === duplicate && unlinkFrames(live).length === 1 && unlinkFrames(live)[0].requestID.length <= 128, "duplicate current unlink requests share one bounded correlation");
  const request = unlinkFrames(live)[0];
  const realSet = live.ctx.chrome.storage.local.set;
  let enteredResolve, release;
  const entered = new Promise(resolve => { enteredResolve = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  let once = true, finished = false;
  live.ctx.chrome.storage.local.set = async writes => {
    if (once && writes.blockedGroups && writes.cbClusterCopy && writes.blockedGroups[0]?.scopes.every(line => line.surface !== "apps")) {
      once = false; enteredResolve(); await held;
    }
    return realSet(writes);
  };
  first.then(() => { finished = true; });
  await sendRemoval(live, c, request);
  await entered;
  check(!finished && (await group(live)).scopes.some(line => line.surface === "apps"), "native success waits for actual durable own-scope cleanup rather than raw FIFO receipt");
  release(); await first;
  const unlinked = await group(live);
  const saved = await state(live);
  check(unlinked.enabled === true && unlinked.allowedMinutes === 17 && unlinked.scopes.every(line => line.surface !== "apps") && saved.usageTimersMs.L === 234000, "admitted unlink retains canonical enable/settings/usage and only browser-owned scopes");

  const { env: deletion, c: dc } = await readyEnv();
  const deleting = deletion.run("cbApplyEditorRequest")(await deleteRequest(deletion));
  while (!unlinkFrames(deletion).length) await new Promise(resolve => setImmediate(resolve));
  check((await state(deletion)).blockedGroups.length === 1, "affected local deletion remains uncommitted until native unlink admission");
  await sendRemoval(deletion, dc, unlinkFrames(deletion)[0]);
  await deleting;
  check((await state(deletion)).blockedGroups.length === 0, "confirmed native unlink plus durable adoption permits the revalidated editor deletion");

  const { env: ordered, c: oc } = await readyEnv();
  const ordering = conn(ordered).unlinkBrowserBudgetGroup(await group(ordered));
  let startPrior, releasePrior;
  const priorStarted = new Promise(resolve => { startPrior = resolve; });
  const priorHeld = new Promise(resolve => { releasePrior = resolve; });
  const orderSet = ordered.ctx.chrome.storage.local.set;
  let holdPrior = true;
  ordered.ctx.chrome.storage.local.set = async writes => {
    if (holdPrior && writes.blockedGroups?.[0]?.allowedMinutes === 19) {
      holdPrior = false; startPrior(); await priorHeld;
    }
    return orderSet(writes);
  };
  const prior = clone(oc); prior.shared.scalars.allowedMinutes = 19;
  conn(ordered).handleMessage({ kind: "cluster-updated", cluster: prior });
  await priorStarted;
  const subsequent = clone(oc); subsequent.shared.scalars.allowedMinutes = 21;
  conn(ordered).handleMessage({ kind: "cluster-updated", cluster: subsequent });
  await sendRemoval(ordered, oc, unlinkFrames(ordered)[0]);
  releasePrior(); await ordering;
  check((await group(ordered)).allowedMinutes === 21 && (await group(ordered)).scopes.every(line => line.surface !== "apps"), "held prior plus queued canonical snapshot finish before removal without reintroducing Apps");

  const { env: editing, c: ec } = await readyEnv();
  const editUnlink = conn(editing).unlinkBrowserBudgetGroup(await group(editing));
  const editBefore = await group(editing);
  await editing.run("cbApplyEditorRequest")({ changes: [editing.run("CBGroupScopes.editorChange")(editBefore, { ...editBefore, allowedMinutes: 29 }, "browser")] });
  await sendRemoval(editing, ec, unlinkFrames(editing)[0]); await editUnlink;
  check((await group(editing)).allowedMinutes === 29 && (await group(editing)).scopes.every(line => line.surface !== "apps"), "fresh allowed edit during unlink admission survives own-scope cleanup");

  const { env: all, c: ac } = await readyEnv();
  const allDeleting = all.run('cbBrowserRequestBody("settings-delete-all",{})');
  while (!unlinkFrames(all).length) await new Promise(resolve => setImmediate(resolve));
  check((await state(all)).blockedGroups.length === 1, "delete-all releases queue while awaiting native admission and keeps saved group");
  const allBefore = await group(all);
  await all.ctx.chrome.storage.local.set({ blockedGroups: [{ ...allBefore, lockedAtMs: Date.now(), lockWaitHours: 2 }] });
  await sendRemoval(all, ac, unlinkFrames(all)[0]);
  await assert.rejects(allDeleting, /group-delete-gates-changed/);
  check((await state(all)).blockedGroups.length === 1, "delete-all revalidates changed lock gates after native admission");

  const { env: retry, c: rc } = await readyEnv();
  const retrySet = retry.ctx.chrome.storage.local.set;
  let failRemoval = true;
  retry.ctx.chrome.storage.local.set = writes => {
    if (failRemoval && writes.blockedGroups && writes.cbClusterCopy && writes.blockedGroups[0]?.scopes.every(line => line.surface !== "apps")) {
      failRemoval = false; return Promise.reject(Error("browser-sync-required"));
    }
    return retrySet(writes);
  };
  const retryPending = conn(retry).unlinkBrowserBudgetGroup(await group(retry));
  const retryRejected = assert.rejects(retryPending, /browser-sync-required/);
  await sendRemoval(retry, rc, unlinkFrames(retry)[0]);
  // A repeated removal queued before the failed save settles must still clean
  // from durable membership, rather than treating the failed removal as saved.
  conn(retry).handleMessage({ kind: "cluster-updated", cluster: { ...clone(rc), members: [] } });
  await retryRejected;
  await conn(retry).sharedApplyTail.catch(() => {});
  const retrySaved = await retry.ctx.chrome.storage.local.get({ blockedGroups: [], cbClusterCopy: [] });
  check(retrySaved.cbClusterCopy.some(c => c.members.some(m => m.groupId === "L")) || retrySaved.blockedGroups[0].scopes.every(line => line.surface !== "apps"), "queued removal after failed save cannot persist unlinked membership with shared Apps");
  check(!retry.run("cbBrowserIdentityConfigReady")((await group(retry))) || (await group(retry)).scopes.every(line => line.surface !== "apps"), "failed membership save cannot reuse stale ACK for linked shared configuration");

  const { env: deleteAll, c: dac } = await readyEnv();
  const deleteAllResult = deleteAll.run('cbBrowserRequestBody("settings-delete-all",{})');
  while (!unlinkFrames(deleteAll).length) await new Promise(resolve => setImmediate(resolve));
  await sendRemoval(deleteAll, dac, unlinkFrames(deleteAll)[0]);
  check((await deleteAllResult).deleted === 1 && (await state(deleteAll)).blockedGroups.length === 0, "admitted delete-all completes after durable own-scope adoption without holding the mutation queue");

  for (const mode of ["refused", "success-without-removal", "failed-save", "timeout", "replaced", "relinked"]) {
    const { env, c: active } = await readyEnv();
    conn(env).browserUnlinkTimeoutMs = 30;
    const before = await state(env);
    const pending = conn(env).unlinkBrowserBudgetGroup(await group(env));
    const refused = assert.rejects(pending, /browser-(sync|connect|upgrade)-required/);
    const frame = unlinkFrames(env)[0];
    if (mode === "refused") await sendRemoval(env, active, frame, { ok: false, error: "browser-upgrade-required" });
    if (mode === "success-without-removal") conn(env).handleMessage({ kind: "group-unlink-response", requestID: frame.requestID, groupId: "L", ok: true });
    if (mode === "failed-save") {
      const set = env.ctx.chrome.storage.local.set;
      env.ctx.chrome.storage.local.set = writes => writes.blockedGroups && writes.cbClusterCopy ? Promise.reject(Error("browser-sync-required")) : set(writes);
      await sendRemoval(env, active, frame);
    }
    if (mode === "timeout") conn(env).handleMessage({ kind: "group-unlink-response", requestID: frame.requestID, groupId: "wrong-group", ok: true });
    if (mode === "relinked") {
      conn(env).handleMessage({ kind: "cluster-updated", cluster: { ...clone(active), members: [] } });
      conn(env).handleMessage({ kind: "cluster-updated", cluster: clone(active) });
      conn(env).receiveBrowserUnlink({kind:"group-unlink-response",requestID:frame.requestID,groupId:"L",ok:true});
    }
    if (mode === "replaced") { conn(env).invalidateActivitySettingsConnection(); conn(env).ws = { replacement: true }; conn(env).receiveBrowserUnlink({kind:"group-unlink-response",requestID:frame.requestID,groupId:"L",ok:true}); }
    await refused;
    await conn(env).sharedApplyTail.catch(() => {});
    const after = await state(env);
    const comparable = value => mode === "relinked" ? { ...value, blockedGroups: env.run("sanitizeGroups")(value.blockedGroups) } : value;
    check(JSON.stringify(comparable(after)) === JSON.stringify(comparable(before)) && conn(env).pendingBrowserUnlinks.size === 0, `${mode}: no false success, local deletion, settings/usage loss or pending request leak`);
    if (mode === "failed-save") check(!env.run("cbBrowserIdentityConfigReady")(await group(env)) && conn(env).browserIdentityApplied.size === 0,
      "failed removal save restores saved membership and refuses configuration without a fresh ACK");
  }
  console.log(`Browser identity unlink consumer: ${passed} checks passed`);
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
