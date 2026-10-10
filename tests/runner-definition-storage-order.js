"use strict";
const assert = require("node:assert/strict");
const {setup, frame, cluster, state} = require("./runner-first-link.js");
let passed = 0;
function check(value, label) { assert.ok(value, label); passed++; console.log(`PASS ${label}`); }
async function deliver(env) {
  while (env.ctx.__storageChanges.length) {
    const change = env.ctx.__storageChanges.shift();
    for (const listener of env.ctx.__storageListeners) listener(change, "local");
  }
  await new Promise(resolve => setTimeout(resolve, 25));
}
const positiveDefinitions = env => env.ctx.__sent.filter(value => value.kind === "group-sync" && value.ts > 0);
(async () => {
  for (const program of ["chrome", "edge", "safari"]) {
    const env = await setup(program);
    await deliver(env);
    env.ctx.__sortStorageObjects = true;
    const shared = cluster(program, true);
    shared.shared.scopes.push({id:"site-1",surface:"site",platform:null,action:"block",sites:["safe.example"],sitesExcept:false},
      {id:"site-2",surface:"site",platform:null,action:"block",sites:["safe.example","also-safe.example"],sitesExcept:true,entryID:"site:linked_098155d79bbf813b2d3944ac"});
    await frame(env, shared);
    env.ctx.__sent.length = 0;
    const notification = env.ctx.__storageChanges[0].blockedGroups.newValue[0];
    check(Object.keys(notification.scopes[0]).join() !== Object.keys(shared.shared.scopes[0]).join(), `${program}: fixture reproduces actual storage property reordering`);
    await deliver(env);
    check(positiveDefinitions(env).length === 0, `${program}: own reordered adoption notification does not send a positive definition`);
    await frame(env, shared);
    check(env.ctx.__storageChanges.length === 0, `${program}: identical hub scopes do not rewrite reordered storage`);
    const stored = (await state(env)).blockedGroups;
    const originalKey = env.run("cbDefinitionKey")(stored[0]);
    // Reverse every object's insertion order, including nested Apps targets.
    const reverse = value => Array.isArray(value) ? value.map(reverse) : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).reverse().map(([key,item]) => [key,reverse(item)])) : value;
    check(env.run("cbDefinitionKey")(reverse(stored[0])) === originalKey, `${program}: nested property permutations preserve the definition key`);
    stored[0].allowedMinutes = 7;
    await env.ctx.chrome.storage.local.set({blockedGroups:stored});
    await deliver(env);
    check(positiveDefinitions(env).at(-1)?.scalars.allowedMinutes === 7, `${program}: real owner scalar edit still sends`);
    env.ctx.__sent.length = 0;
    stored[0].scopes = stored[0].scopes.filter(line => !line.entryID);
    await env.ctx.chrome.storage.local.set({blockedGroups:stored});
    await deliver(env);
    check(positiveDefinitions(env).length === 1 && !positiveDefinitions(env)[0].scopes.some(line => line.entryID), `${program}: explicit independent Website deletion still sends`);
    const reordered = structuredClone(stored[0]);
    reordered.scopes.reverse();
    check(env.run("cbDefinitionKey")(reordered) !== env.run("cbDefinitionKey")(stored[0]), `${program}: entry array order remains significant`);
    const retyped = structuredClone(stored[0]); retyped.allowedMinutes = "7";
    check(env.run("cbDefinitionKey")(retyped) !== env.run("cbDefinitionKey")(stored[0]), `${program}: scalar types remain significant`);
    env.ctx.__sent.length = 0;
    await env.ctx.chrome.storage.local.set({blockedGroups:[]});
    await deliver(env);
    check(env.ctx.__sent.some(value => value.kind === "groups-announce" && value.groups.length === 0), `${program}: owner group deletion still announces removal`);
  }
  console.log(`DEFINITION STORAGE ORDER ${passed} PASS`);
  console.log("__CB_TEST_RESULT__: OK");
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
