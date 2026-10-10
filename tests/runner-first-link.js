"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function makeContext(program = "chrome") {
  const storage = new Map();
  const inert = () => new Proxy(function () {}, { get: (_t, p) => (p === "addListener" || p === "removeListener" || p === "hasListener") ? () => {} : inert(), apply: () => Promise.resolve(undefined) });
  const chrome = new Proxy({
    storage: {
      local: {
        get: (keys, cb) => { const out = {}; if (keys && typeof keys === "object" && !Array.isArray(keys)) for (const [k, d] of Object.entries(keys)) out[k] = storage.has(k) ? storage.get(k) : d; else if (typeof keys === "string") out[keys] = storage.get(keys); const copy = JSON.parse(JSON.stringify(out)); if (cb) cb(copy); return Promise.resolve(copy); },
        set: (obj, cb) => { for (const [k, v] of Object.entries(obj)) storage.set(k, JSON.parse(JSON.stringify(v))); if (cb) cb(); return Promise.resolve(); },
        remove: () => Promise.resolve(), getBytesInUse: () => Promise.resolve(0)
      },
      session: { get: () => Promise.resolve({}), set: () => Promise.resolve(), remove: () => Promise.resolve() },
      onChanged: { addListener() {}, removeListener() {}, hasListener: () => false }
    },
    alarms: { clear: () => Promise.resolve(), create: () => Promise.resolve(), onAlarm: { addListener() {} } },
    runtime: new Proxy({ id: "t", getManifest: () => ({ version: "0" }), getURL: (p) => `chrome-extension://t/${p}`, lastError: null }, { get: (t, p) => (p in t ? t[p] : inert()) })
  }, { get: (t, p) => (p in t ? t[p] : inert()) });
  const ctx = vm.createContext({
    chrome, console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    TextEncoder, TextDecoder, URL, URLSearchParams, crypto: globalThis.crypto, fetch: () => Promise.reject(new Error("offline")),
    WebSocket: class { constructor() { this.readyState = 3; } close() {} send() {} },
    importScripts() {}, location: { href: "chrome-extension://t/background.js" },
    navigator: { userAgent: program === "edge" ? "Chrome/999 Edg/999" : program === "safari" ? "Version/26 Safari/999" : "Chrome/999", userAgentData: { brands: [{ brand: "Google Chrome", version: "999" }] } },
    structuredClone: (v) => JSON.parse(JSON.stringify(v)),
    atob: (s) => Buffer.from(s, "base64").toString("binary"), btoa: (s) => Buffer.from(s, "binary").toString("base64")
  });
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = ctx;
  return ctx;
}
function boot(program = "chrome") {
const context = makeContext(program);
for (const file of ["platform-profiles.js", "group-scopes.js", "parental-pin.js", "group-actions.js", "local-hub-environment.js", "local-hub-auth.js", "bridge-protocol.js", "vault-classifier-contract.js", "vault-classifier-bridge.js", "background.js"]) {
  const p = path.join(root, file); if (!fs.existsSync(p)) continue;
  vm.runInContext(fs.readFileSync(p, "utf8"), context, { filename: file });
}


return context;
}

let passed = 0;
const assert = (condition, label) => { if (!condition) throw Error(label); passed++; console.log(`PASS ${label}`); };
const anchor = Date.now() - 60000;
function cluster(program = "chrome", complete = false, rolling = false) {
  return { id: "c1", members: [
    {program, groupId:"L", contributed:complete},
    {program:"macapp",groupId:"m1",contributed:true}
  ], shared: {scalars:{name:"Mac target",allowedMinutes:10,rollingLimit:rolling},ts:0,
    scopes:[{id:"apps",surface:"apps",action:"block",apps:[{id:"test"}]}],
    usageMs:120000,usageResetAtMs:anchor,usageBuckets:{[Math.floor(Date.now()/60000)]:120000}} };
}
async function setup(program = "chrome", rolling = false) {
  const ctx = boot(program), run = code => vm.runInContext(code, ctx);
  await run("cbSharingReady");
  const groups = run(`sanitizeGroups([{id:"L",name:"Browser initiator",groupType:"site",sites:["example.com"],enabled:true,mode:"after-minutes",allowedMinutes:20,rollingLimit:${rolling}}])`);
  const buckets = {[Math.floor(Date.now()/60000)]:300000};
  await ctx.chrome.storage.local.set({blockedGroups:groups,usageTimersMs:{L:300000},usageResetAtMs:{L:anchor},usageBucketsMs:{L:buckets}});
  ctx.__sent = [];
  run(`cbConnection.status={state:"connected",hubProgram:"macapp",peers:[]}; cbConnection.desktopRouteIsReady=()=>true; cbConnection.sendWS=frame=>{__sent.push(JSON.parse(JSON.stringify(frame)));return true;};`);
  return {ctx,run,groups,buckets};
}
async function frame(env, c, kind = "cluster-updated") {
  env.ctx.__frame = kind === "clusters" ? {kind,clusters:[c]} : {kind,cluster:c};
  env.run("cbConnection.handleMessage(__frame)");
  await env.run("cbConnection.sharedApplyTail");
}
const state = env => env.ctx.chrome.storage.local.get({blockedGroups:[],usageTimersMs:{},usageBucketsMs:{}});
(async () => {
  // Both legal first-message orders retain the initiator before its receipt.
  for (const reconnect of [false,true]) {
    const env = await setup();
    const partial = cluster();
    if (!reconnect) {
      const empty = {...partial}; delete empty.shared;
      env.ctx.__frames = [{kind:"cluster-updated",cluster:empty},{kind:"cluster-updated",cluster:partial}];
      env.run("for(const frame of __frames) cbConnection.handleMessage(frame)");
      await env.run("cbConnection.sharedApplyTail");
    } else await frame(env,partial,"clusters");
    const contribution = env.ctx.__sent.find(f=>f.scalars);
    const stored = await state(env);
    const order = reconnect ? "interrupted reconnect" : "consecutive initial frames";
    assert(contribution?.scalars.name === "Browser initiator" && contribution.scalars.allowedMinutes === 20, `${order}: original settings contributed`);
    assert(contribution?.usageMs === 300000 && contribution.usageResetAtMs === anchor, `${order}: original usage seeded with definition`);
    assert(contribution?.scopes.some(l=>l.surface === "site"), `${order}: Website contribution retained`);
    assert(stored.blockedGroups[0].name === "Browser initiator" && stored.usageTimersMs.L === 300000, `${order}: incomplete frame does not overwrite local state`);
    assert(env.ctx.__sent.filter(f=>f.scalars).length === 1, `${order}: duplicate snapshots submit one contribution`);
    // Receipt allows all ordinary shared updates and rebases only then.
    const complete = cluster("chrome",true);
    complete.shared.usageMs = 300000;
    complete.shared.scalars.allowedMinutes = 20;
    complete.shared.scopes.push(...contribution.scopes);
    await frame(env,complete);
    const adopted = await state(env);
    assert(adopted.blockedGroups[0].name === "Mac target" && adopted.blockedGroups[0].scopes.some(l=>l.surface==="apps") && adopted.blockedGroups[0].scopes.some(l=>l.surface==="site"), `${order}: acknowledged union is adopted`);
    env.ctx.__sent.length=0; env.ctx.__groups=adopted.blockedGroups;
    env.run(`cbReportClusterUsage(__groups,{L:300000},{L:${anchor}})`);
    assert(env.ctx.__sent.length === 0, `${order}: accepted seed is not double counted`);
    env.run(`cbReportClusterUsage(__groups,{L:301000},{L:${anchor}})`);
    assert(env.ctx.__sent[0]?.usageDeltaMs === 1000, `${order}: subsequent local accrual reports one delta`);
    complete.shared.scalars.allowedMinutes = 7;
    await frame(env,complete);
    assert((await state(env)).blockedGroups[0].allowedMinutes === 7, `${order}: later shared edit still applies`);
  }
  // Failed socket submission is retried from original persisted data.
  const failed = await setup();
  failed.run("cbConnection.sendWS=()=>false");
  await frame(failed,cluster());
  assert((await state(failed)).usageTimersMs.L === 300000, "failed send preserves pre-link usage");
  failed.run("cbConnection.sendWS=f=>{__sent.push(f);return true}");
  await frame(failed,cluster(),"clusters");
  assert(failed.ctx.__sent[0]?.scalars.allowedMinutes === 20 && failed.ctx.__sent[0].usageMs === 300000,"failed send retries original definition and usage");
  // Restart after an unacknowledged socket write: no hidden in-memory original
  // is required; persisted data remains untouched and the seed is repeatable.
  const restarted = await setup();
  const saved = await state(failed);
  await restarted.ctx.chrome.storage.local.set(saved);
  await frame(restarted,cluster(),"clusters");
  assert(restarted.ctx.__sent[0]?.scalars.allowedMinutes === 20 && restarted.ctx.__sent[0].usageMs === 300000,"worker restart retries untouched original state");
  const accrual = await setup();
  accrual.ctx.__partial = cluster(); accrual.ctx.__groups = accrual.groups;
  accrual.run("cbConnection.clusters=[__partial]; cbSaveClusterCopy([__partial]); cbReportClusterUsage(__groups,{L:300000},{L:"+anchor+"})");
  assert(accrual.ctx.__sent.length===0,"ordinary usage cannot precede original contribution");
  await frame(accrual,cluster());
  accrual.run("cbReportClusterUsage(__groups,{L:301000},{L:"+anchor+"})");
  assert(accrual.ctx.__sent.at(-1)?.usageDeltaMs===1000,"accrual after seed and before acknowledgment reports only fresh delta");
  const offlineJoin = await setup();
  await offlineJoin.ctx.chrome.storage.local.set({usageTimersMs:{L:315000},cbOfflineUsage:{L:{anchorMs:anchor,ms:15000,buckets:{}}}});
  await frame(offlineJoin,cluster(),"clusters");
  assert(offlineJoin.ctx.__sent[0]?.usageMs===300000,"initial reconnect seed excludes separately handed-over offline usage");
  assert((await state(offlineJoin)).usageTimersMs.L===315000,"unacknowledged reconnect retains seed plus offline total");
  // Rolling history is captured before adopting a smaller shared history.
  const rolling = await setup("chrome",true);
  await frame(rolling,cluster("chrome",false,true));
  assert(JSON.stringify(rolling.ctx.__sent[0]?.usageBucketsSeed) === JSON.stringify(rolling.buckets),"rolling link seeds original buckets");
  assert((await state(rolling)).usageTimersMs.L === 300000,"rolling partial snapshot preserves local history");
  // A second browser joining a cluster must preserve its own definition, even
  // after the initiator/desktop already completed their contributions.
  for (const program of ["edge","safari"]) {
    const env = await setup(program);
    const c = cluster(program); c.members.push({program:"chrome",groupId:"other",contributed:true});
    await frame(env,c,"clusters");
    assert(env.ctx.__sent[0]?.program === program && env.ctx.__sent[0].usageMs === 300000 && env.ctx.__sent[0].scalars.allowedMinutes === 20,`${program}: joining existing link contributes own original`);
    assert((await state(env)).blockedGroups[0].scopes.some(l=>l.surface==="site"),`${program}: incomplete union cannot erase own Website`);
  }
  // The actual three-peer failure had distinct lists, not merely two Website
  // surfaces. The browser sends the third member's untouched original; the
  // desktop hub owns first-join aggregation. This fixture pins the wire and
  // adoption/enforcement contract without pretending to execute that hub.
  for (const program of ["edge", "safari"]) {
    const first = await setup("chrome");
    const pair = cluster("chrome", true);
    pair.shared.scalars = {name:"Pair origin",allowedMinutes:20,enabled:true,mode:"after-minutes"};
    pair.shared.usageMs = 300000;
    pair.shared.scopes.push(...first.groups[0].scopes);
    await frame(first, pair);
    const joining = await setup(program);
    const original = joining.run('sanitizeGroups([{id:"L",name:"Third original",groupType:"site",sites:["example.org"],enabled:true,mode:"after-minutes",allowedMinutes:30}])');
    await joining.ctx.chrome.storage.local.set({blockedGroups:original,usageTimersMs:{L:480000}});
    const partial = JSON.parse(JSON.stringify(pair));
    partial.members.push({program,groupId:"L",contributed:false});
    await frame(first, partial);
    joining.run("cbConnection.sendWS=()=>false");
    await frame(joining, partial);
    const saved = await joining.ctx.chrome.storage.local.get({blockedGroups:[],usageTimersMs:{},usageResetAtMs:{},usageBucketsMs:{}});
    assert(saved.blockedGroups[0].scopes.find(l=>l.surface==="site").sites.join() === "example.org" && saved.usageTimersMs.L === 480000, `${program}: disconnected third member retains distinct original site and usage`);
    const resumed = await setup(program);
    await resumed.ctx.chrome.storage.local.set(saved);
    await frame(resumed, partial, "clusters");
    const contribution = resumed.ctx.__sent.find(f=>f.scalars);
    assert(contribution?.usageMs === 480000 && contribution.scalars.allowedMinutes === 30, `${program}: resumed third member sends original seed and settings`);
    assert(contribution.scopes.length === 1 && contribution.scopes[0].sites.join() === "example.org" && contribution.scopes[0].sitesExcept === false && contribution.scopes[0].action === "block", `${program}: third contribution sends its exact own site predicate, excluding peer Apps and sites`);
    assert((await state(first)).blockedGroups[0].scopes.find(l=>l.surface==="site").sites.join() === "example.com", `${program}: existing Chrome member retains its site while third contribution is incomplete`);
    const complete = JSON.parse(JSON.stringify(partial));
    complete.members.forEach(m=>m.contributed=true);
    complete.shared.usageMs = 480000;
    complete.shared.scopes.find(l=>l.surface==="site").sites = ["example.com", "example.org"];
    for (const browser of [first, resumed]) {
      await frame(browser, complete);
      await frame(browser, complete, "clusters");
      const adopted = await state(browser);
      const group = adopted.blockedGroups[0];
      assert(group.scopes.find(l=>l.surface==="site").sites.join() === "example.com,example.org" && group.scopes.some(l=>l.surface==="apps"), `${program}: complete three-peer union retains both distinct sites and Apps`);
      assert(group.name === "Pair origin" && group.allowedMinutes === 20 && adopted.usageTimersMs.L === 480000, `${program}: complete three-peer union adopts initiating settings and shared seed`);
      browser.ctx.__evalGroups = adopted.blockedGroups;
      for (const hostname of ["example.com", "example.org"]) {
        const context = {url:`https://${hostname}/`,hostname,pathname:"/"};
        assert(browser.run(`cbPageLead(normalizePageContext(${JSON.stringify(context)}),__evalGroups,{L:1200000},{},Date.now())?.id`) === "L", `${program}: adopted site ${hostname} enforces from shared budget`);
      }
      // Subsequent deliberate entry edits are replacements, not perpetual
      // unions: a removed target must not come back from local history.
      const edited = JSON.parse(JSON.stringify(complete));
      edited.shared.scopes.find(l=>l.surface==="site").sites = ["example.org"];
      await frame(browser, edited);
      assert((await state(browser)).blockedGroups[0].scopes.find(l=>l.surface==="site").sites.join() === "example.org", `${program}: acknowledged Website edit replaces rather than re-unions removed site`);
    }
  }
  // An explicitly empty owned list is meaningful, rather than absent.
  const empty = await setup();
  const emptyGroups = empty.groups.map(g=>({...g,scopes:[]}));
  await empty.ctx.chrome.storage.local.set({blockedGroups:emptyGroups});
  await frame(empty,cluster());
  assert(Array.isArray(empty.ctx.__sent[0]?.scopes) && empty.ctx.__sent[0].scopes.length===0,"empty owned scope list still contributes explicitly");
  const snooze = await setup();
  const snoozeCluster = cluster(); const now = Date.now();
  await snooze.ctx.chrome.storage.local.set({groupSnoozes:{L:{kind:"time",startsAtMs:now-10000,untilMs:now+300000,cooldownUntilMs:now+300000,changedAtMs:now-10000}}});
  snoozeCluster.shared.snoozeTs = now;
  snoozeCluster.shared.snooze = {kind:"time",startsAtMs:now-10000,untilMs:now,cooldownUntilMs:now,changedAtMs:now};
  await frame(snooze,snoozeCluster);
  assert((await snooze.ctx.chrome.storage.local.get({groupSnoozes:{}})).groupSnoozes.L.untilMs===now,"shared End Snooze remains authoritative before definition acknowledgment");
  // Queued snapshots must wait for the original read even when ack comes fast.
  const queued = await setup();
  const get = queued.ctx.chrome.storage.local.get; let release;
  queued.ctx.chrome.storage.local.get = async (keys,cb) => {
    const value = await get(keys,cb);
    if (!release && keys && Object.hasOwn(keys,"usageBucketsMs")) await new Promise(resolve=>{release=resolve});
    return value;
  };
  queued.ctx.__partial=cluster(); queued.ctx.__complete=cluster("chrome",true); queued.ctx.__complete.shared.usageMs=300000;
  queued.run('cbConnection.handleMessage({kind:"clusters",clusters:[__partial]})');
  while(!release) await new Promise(resolve=>setImmediate(resolve));
  queued.run('cbConnection.handleMessage({kind:"cluster-updated",cluster:__complete})');
  release(); await queued.run("cbConnection.sharedApplyTail");
  assert(queued.ctx.__sent[0]?.scalars.allowedMinutes===20 && queued.ctx.__sent[0].usageMs===300000,"slow storage read captures original before queued acknowledgment");
  assert((await state(queued)).blockedGroups[0].allowedMinutes===10,"queued acknowledgment remains latest local definition");
  console.log(`FIRST LINK TOTAL ${passed} PASS ${passed} FAIL 0\n__CB_TEST_RESULT__: OK`);
  process.exit(0);
})().catch(error=>{console.error(error.stack);console.log("__CB_TEST_RESULT__: FAIL");process.exit(1)});
