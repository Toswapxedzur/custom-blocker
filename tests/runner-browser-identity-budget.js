"use strict";
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { setup, frame, cluster, state, boot } = require("./runner-first-link.js");
const clone = value => JSON.parse(JSON.stringify(value));
let passed = 0;
const check = (condition, label) => { assert(condition, label); passed++; console.log(`PASS ${label}`); };
const ack = env => env.ctx.__sent.filter(f => f.browserIdentitySnapshotApplied && !f.scalars);
const definitions = env => env.ctx.__sent.filter(f => f.scalars);
function snapshot({ ready = false, generation = "opaque-1", contributed = true, enabled = true, rolling = false } = {}) {
  const c = cluster("chrome", contributed, rolling);
  c.shared.browserIdentityStatus = { state: ready ? "ready" : "upgrade-required", generation, canonicalEnabled: enabled };
  c.shared.scalars.enabled = ready && enabled;
  c.shared.scopes.push({ id: "site-1", surface: "site", action: "block", sites: ["example.com"], sitesExcept: false });
  return c;
}
async function edit(env, fields) {
  const before = (await state(env)).blockedGroups[0];
  const change = env.run("CBGroupScopes.editorChange")(before, { ...before, ...fields }, "browser");
  return env.run("cbApplyEditorRequest")({ changes: [change] });
}
async function restore(env) {
  const all = await env.ctx.chrome.storage.local.get(null);
  const store = new Map(Object.entries(all));
  const ctx = boot("chrome", store), run = code => vm.runInContext(code, ctx);
  await run("cbSharingReady");
  ctx.__sent = [];
  run('cbConnection.status={state:"connected",hubProgram:"macapp",peers:[]}; cbConnection.desktopRouteIsReady=()=>true; cbConnection.sendWS=f=>{__sent.push(JSON.parse(JSON.stringify(f)));return true}');
  return { ctx, run, store };
}
(async () => {
  const paused = await setup();
  await frame(paused, snapshot());
  let saved = await state(paused);
  paused.ctx.__group = saved.blockedGroups[0];
  check(saved.blockedGroups[0].enabled === true && saved.usageTimersMs.L === 120000, "paused wire enabled=false preserves canonical enabled and authoritative usage");
  check(paused.run('!cbGroupActive(__group,{},Date.now()) && !getExposedTimedGroups(["L"],[__group],[],{},Date.now()).length'), "paused budget neither enforces pages nor counts exposed feeds");
  paused.ctx.__sent.length = 0;
  await paused.run('applyElapsedTime({hostname:"example.com",pathname:"/"},1000,[])');
  saved = await state(paused);
  check(saved.usageTimersMs.L === 120000 && !paused.ctx.__sent.some(f => f.usageDeltaMs), "paused heartbeat preserves usage without reporting fresh time");
  await assert.rejects(edit(paused, { allowedMinutes: 19 }), /browser-identity-upgrade-required/);
  check((await state(paused)).blockedGroups[0].allowedMinutes === 10, "explicit affected-budget edit fails before its definition is persisted");
  const ready = snapshot({ ready: true, generation: "opaque-ready" });
  await frame(paused, ready);
  check(paused.run('cbGroupActive(__group,{},Date.now())') && ack(paused).some(f => f.browserIdentitySnapshotApplied.generation === "opaque-ready"), "ready generation resumes only after canonical snapshot persistence and ACK");
  await edit(paused, { name: "Actual edit" });
  check(definitions(paused).at(-1)?.browserIdentitySnapshotApplied.generation === "opaque-ready", "every later config carries its current connection generation");
  await frame(paused, snapshot({ ready: true, generation: "disabled", enabled: false }));
  check((await state(paused)).blockedGroups[0].enabled === false, "canonical disabled remains disabled when readiness returns");

  const joining = await setup();
  const original = clone((await state(joining)).blockedGroups[0]);
  await joining.ctx.chrome.storage.local.set({ blockedGroups: [{ ...original, enabled: false }] });
  const sends = joining.run("cbConnection.sendWS");
  let originalAtAck;
  joining.ctx.__observe = f => {
    if (f.browserIdentitySnapshotApplied && !f.scalars) originalAtAck = joining.ctx.chrome.storage.local.get(null);
    return sends(f);
  };
  joining.run("cbConnection.sendWS=__observe");
  await frame(joining, snapshot({ contributed: false }));
  const beforeContribution = await originalAtAck;
  const contribution = definitions(joining)[0];
  check(joining.ctx.__sent.indexOf(ack(joining)[0]) < joining.ctx.__sent.indexOf(contribution), "firstjoin ACK precedes any initial contribution");
  check(beforeContribution.blockedGroups[0].enabled === false && beforeContribution.blockedGroups[0].name === original.name && beforeContribution.usageTimersMs.L === 300000, "firstjoin durably retains original definition and usage before ACK");
  check(contribution.scalars.enabled === true && contribution.usageMs === 300000 && contribution.scopes.some(l => l.surface === "site") && !contribution.scopes.some(l => l.surface === "apps"), "firstjoin contributes original own scopes/history with canonical shared enable");
  check((await state(joining)).usageTimersMs.L === 300000, "uncontributed shared partial total cannot overwrite original history");

  const failed = await setup();
  const normalSet = failed.ctx.chrome.storage.local.set;
  let fail = true;
  failed.ctx.chrome.storage.local.set = async writes => {
    if (fail && writes.usageTimersMs?.L === 120000) throw Error("fixture durable usage refusal");
    return normalSet(writes);
  };
  await frame(failed, snapshot({ ready: true }));
  check(ack(failed).length === 0 && failed.run('cbBrowserIdentityPaused({id:"L"})'), "failed canonical usage persistence emits no ACK and keeps runtime paused");
  const restarted = await restore(failed);
  check(restarted.run('cbBrowserIdentityPaused({id:"L"})'), "worker restart retains pending readiness instead of resuming an unapplied snapshot");
  fail = false;
  await frame(restarted, snapshot({ ready: true }));
  check(ack(restarted).length === 1 && !restarted.run('cbBrowserIdentityPaused({id:"L"})'), "reconnect retries persistence then acknowledges its own snapshot");

  const joinFailure = await setup();
  const joinSet = joinFailure.ctx.chrome.storage.local.set;
  let refuseOriginal = true;
  joinFailure.ctx.chrome.storage.local.set = writes => refuseOriginal && writes.blockedGroups && writes.usageTimersMs
    ? Promise.reject(Error("fixture original retention failure")) : joinSet(writes);
  await assert.rejects(frame(joinFailure, snapshot({ contributed: false })), /original retention failure/);
  check(ack(joinFailure).length === 0 && definitions(joinFailure).length === 0 && (await state(joinFailure)).usageTimersMs.L === 300000, "failed firstjoin retention sends neither ACK nor original seed");
  refuseOriginal = false;
  await frame(joinFailure, snapshot({ contributed: false }));
  check(ack(joinFailure).length === 1 && definitions(joinFailure)[0]?.usageMs === 300000, "failed firstjoin retention retries the untouched original");

  const switched = await setup();
  const switchSet = switched.ctx.chrome.storage.local.set;
  let enteredResolve, release;
  const entered = new Promise(resolve => { enteredResolve = resolve; });
  const hold = new Promise(resolve => { release = resolve; });
  let held = true;
  switched.ctx.chrome.storage.local.set = async writes => {
    if (held && writes.usageTimersMs?.L === 120000) { held = false; enteredResolve(); await hold; }
    return switchSet(writes);
  };
  const stale = frame(switched, snapshot({ ready: true, generation: "old" }));
  await entered;
  switched.run('cbConnection.ws={replacement:true}; cbConnection.activitySettingsConnectionGeneration++');
  release(); await stale;
  check(ack(switched).length === 0 && definitions(switched).length === 0, "replaced socket cannot ACK or bootstrap from an old in-flight snapshot");
  await frame(switched, snapshot({ ready: true, generation: "new" }));
  check(ack(switched)[0]?.browserIdentitySnapshotApplied.generation === "new", "replacement connection adopts and acknowledges only its fresh generation");

  const pending = await setup();
  const local = clone((await state(pending)).blockedGroups[0]);
  const waiting = snapshot({ ready: true });
  pending.ctx.__waiting = waiting;
  pending.ctx.__local = local;
  pending.run('cbConnection.clusters=[__waiting]; cbSaveClusterCopy([__waiting]); cbDefinitionSeen.set("L",cbDefinitionKey(__local))');
  await edit(pending, { allowedMinutes: 25 });
  check(definitions(pending).length === 0 && (await pending.ctx.chrome.storage.local.get("cbBrowserIdentityDefinitionIntents")).cbBrowserIdentityDefinitionIntents.L.change.fields.set.allowedMinutes === 25, "finite bootstrap barrier durably retains actual field intent without sending config");
  const pendingRestart = await restore(pending);
  const canonical = snapshot({ ready: true });
  canonical.shared.scalars.name = "Independent native name";
  await frame(pendingRestart, canonical);
  saved = await state(pendingRestart);
  check(saved.blockedGroups[0].allowedMinutes === 25 && saved.blockedGroups[0].name === "Independent native name" && saved.blockedGroups[0].scopes.some(l => l.surface === "apps"), "restart replays only the real local field patch over canonical definition and native scopes");
  check(definitions(pendingRestart).at(-1)?.scalars.allowedMinutes === 25 && ack(pendingRestart).length === 1 && !Object.keys((await pendingRestart.ctx.chrome.storage.local.get("cbBrowserIdentityDefinitionIntents")).cbBrowserIdentityDefinitionIntents).length, "real edit publishes after ACK and bounded retained intent clears after send");

  const locked = await setup();
  locked.ctx.__waiting = snapshot({ ready: true });
  locked.run('cbConnection.clusters=[__waiting]; cbSaveClusterCopy([__waiting])');
  await edit(locked, { name: "Before lock" });
  const frozen = snapshot({ ready: true });
  frozen.shared.lock = { lockedAtMs: Date.now(), lockWaitHours: 1, lockVersion: 1 };
  await assert.rejects(frame(locked, frozen), /group-lock-changed/);
  check((await state(locked)).blockedGroups[0].name === "Mac target" && definitions(locked).length === 0 && (await locked.ctx.chrome.storage.local.get("cbBrowserIdentityDefinitionIntents")).cbBrowserIdentityDefinitionIntents.L, "replay revalidates current lock, reports refusal and retains the unapplied intent");

  const bad = await setup();
  const malformed = snapshot({ ready: true });
  malformed.shared.browserIdentityStatus.canonicalEnabled = "true";
  await frame(bad, malformed);
  check(ack(bad).length === 0 && bad.run('cbBrowserIdentityPaused({id:"L"})'), "malformed advertised readiness cannot downgrade into a legacy ACK");
  console.log(`Browser identity budget consumer: ${passed} checks passed`);
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
