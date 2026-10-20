"use strict";
const assert = require("node:assert/strict");
const { setup, frame, cluster, state } = require("./runner-first-link.js");
const copy = value => JSON.parse(JSON.stringify(value));
let passed = 0;
const check = (value, label) => { assert(value, label); passed++; console.log(`PASS ${label}`); };
const usageSeeds = env => env.ctx.__sent.filter(message => message.ts === 0 && (Object.hasOwn(message, "usageMs") || Object.hasOwn(message, "usageBucketsSeed")));
const acks = env => env.ctx.__sent.filter(message => message.browserIdentitySnapshotApplied);
(async () => {
  for (const program of ["chrome", "edge", "safari"]) for (const rolling of [false, true]) {
    const label = `${program} ${rolling ? "rolling" : "fixed"}`;
    const env = await setup(program, rolling);
    const minute = Math.floor(Date.now() / 60000) * 60000;
    const originalBuckets = { [minute - 2 * 60000]: 180000, [minute]: 300000 };
    await env.ctx.chrome.storage.local.set({ usageTimersMs: { L: 480000 }, usageBucketsMs: { L: originalBuckets } });
    const original = await state(env);
    const pending = cluster(program, false, rolling);
    pending.shared.scalars = { name: "Canonical", allowedMinutes: 17, enabled: true, mode: "after-minutes", rollingLimit: rolling };
    pending.shared.scopes = [{ id: "site-shared", surface: "site", action: "block", sites: ["shared.example"], sitesExcept: false }];
    pending.shared.usageMs = 300000;
    pending.shared.usageBuckets = { [minute]: 300000 };
    pending.shared.browserIdentityStatus = { state: "ready", generation: "pending-original", canonicalEnabled: true, affectsBrowserBudget: false };
    // Native config may already be complete. While its separate original-usage
    // capture is pending, the contract intentionally keeps wire contributed=false.
    const set = env.ctx.chrome.storage.local.set;
    let failOriginal = true;
    env.ctx.chrome.storage.local.set = writes => failOriginal && writes.blockedGroups && writes.usageTimersMs
      ? Promise.reject(Error("fixture original retention refused")) : set(writes);
    await assert.rejects(frame(env, pending, "clusters"), /original retention refused/);
    check(JSON.stringify(await state(env)) === JSON.stringify(original) && !acks(env).length && !usageSeeds(env).length,
      `${label}: failed durable original retention refuses ACK/seed and preserves 8 minutes against partial 5`);
    failOriginal = false;
    let enteredResolve, release;
    const entered = new Promise(resolve => { enteredResolve = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    let holdOriginal = true;
    env.ctx.chrome.storage.local.set = async writes => {
      if (holdOriginal && writes.blockedGroups && writes.usageTimersMs) { holdOriginal = false; enteredResolve(); await held; }
      return set(writes);
    };
    const adopting = frame(env, pending);
    await entered;
    check(!acks(env).length && !usageSeeds(env).length, `${label}: held original save cannot announce completion or send seed`);
    release(); await adopting;
    const seeds = usageSeeds(env);
    check(seeds.length === 1 && (rolling ? JSON.stringify(seeds[0].usageBucketsSeed) === JSON.stringify(originalBuckets) : seeds[0].usageMs === 480000),
      `${label}: retry sends exact original fixed total or rolling buckets`);
    check(JSON.stringify(await state(env)) === JSON.stringify(original), `${label}: config-complete usage-pending wire still cannot adopt canonical definition/5-minute history`);
    // The first send may have reached the socket without a committed server
    // receipt. A fresh authenticated welcome must permit the retained seed again.
    env.run("cbConnection.invalidateActivitySettingsConnection();cbConnection.ws={replacement:true};cbConnection.handleMessage({kind:'welcome',v:4,hubProgram:'macapp',browserIdentityVersion:1})");
    await frame(env, pending, "clusters");
    check(usageSeeds(env).length === 2 && (rolling ? JSON.stringify(usageSeeds(env)[1].usageBucketsSeed) === JSON.stringify(originalBuckets) : usageSeeds(env)[1].usageMs === 480000),
      `${label}: socket replacement retries unacknowledged original rather than stranding it in cbJoinsSent`);
    const completed = copy(pending);
    completed.members.forEach(member => { member.contributed = true; });
    completed.shared.browserIdentityStatus.generation = "complete-original";
    completed.shared.usageMs = 480000;
    completed.shared.usageBuckets = originalBuckets;
    await frame(env, completed);
    const accepted = await state(env);
    check(accepted.usageTimersMs.L === 480000 && (!rolling || JSON.stringify(accepted.usageBucketsMs.L) === JSON.stringify(originalBuckets))
      && accepted.blockedGroups[0].allowedMinutes === 17 && acks(env).at(-1)?.browserIdentitySnapshotApplied.generation === "complete-original",
      `${label}: completed original usage adopts canonical settings/history and ACKs full generation`);
    await frame(env, completed, "clusters");
    check(usageSeeds(env).length === 2, `${label}: completed repeated snapshots never resend the original seed`);
  }
  console.log(`Original usage bootstrap: ${passed} checks passed`);
  process.exit(0);
})().catch(error => { console.error(error); process.exit(1); });
