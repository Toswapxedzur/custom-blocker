'use strict';
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
function rig(initial, version = '3.1.5', url = 'chrome-extension://fixture/') {
  let state = structuredClone(initial), writes = 0, fail = false;
  const local = {
    async get(keys) { if (keys == null) return structuredClone(state); if (typeof keys === 'string') keys = [keys]; if (Array.isArray(keys)) return Object.fromEntries(keys.filter(k => k in state).map(k => [k, structuredClone(state[k])])); return Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, structuredClone(k in state ? state[k] : v)])); },
    async set(values) { if (fail) { fail = false; throw Error('disk unavailable'); } writes++; Object.assign(state, structuredClone(values)); },
    async remove(keys) { for (const k of [].concat(keys)) delete state[k]; },
    async clear() { state = {}; }
  };
  const context = vm.createContext({ chrome: { storage: { local }, runtime: { getManifest: () => ({ version }), getURL: () => url, lastError: null } }, browser: {}, console, structuredClone });
  vm.runInContext(fs.readFileSync('storage-schema.js', 'utf8'), context);
  return { context, api: context.chrome.storage.local, data: () => structuredClone(state), writes: () => writes, fail: () => { fail = true; } };
}
(async () => {
  const alpha = { schemaVersion: 2, blockedGroups: [{ id: 'g', name: 'Keep', scopes: [{ surface: 'site', action: 'block', sites: ['example.com'] }] }], usageTimersMs: { g: 100 }, cbOfflineTransfers: { receipt: { id: 'receipt' } } };
  const r = rig(alpha);
  await r.api.get(null);
  assert.equal(r.data().schemaVersion, 3);
  assert.equal(r.data().storageMetadata.writtenByAppVersion, '3.1.5');
  for (const k of ['blockedGroups', 'usageTimersMs', 'cbOfflineTransfers']) assert.deepEqual(r.data()[k], alpha[k]);
  const first = r.data(); await r.api.get(null); assert.deepEqual(r.data(), first); assert.equal(r.writes(), 1);
  await r.api.set({ extra: true }); assert.equal(r.data().extra, true);
  const safari = rig({}, '3.1.5', 'safari-web-extension://fixture/');
  await safari.api.get(null); assert.equal(safari.data().storageMetadata.product, 'safari');
  // Chrome also exposes browser; the URL scheme, not namespace presence, owns identity.
  assert.equal(r.data().storageMetadata.product, 'browser');
  const policy = r.context.CBStorageSchema;
  const header = (v, app) => ({ schemaVersion: v, storageMetadata: { format: 'vault.web-store', schemaVersion: v, product: 'browser', writtenByAppVersion: app } });
  policy.validate(header(2, '1.0.0'), { product: 'browser', appVersion: '2.0.0' });
  assert.throws(() => policy.validate(header(2, '1.0.0'), { product: 'browser', appVersion: '3.0.0' }), /expired/);
  policy.validate(header(2, '2.0.0'), { product: 'browser', appVersion: '3.0.0' });
  policy.validate(header(3, '1.0.0'), { product: 'browser', appVersion: '5.0.0' }); // no transform needed
  assert.throws(() => policy.validate({}, { product: 'browser', appVersion: '5.0.0' }), /expired/);
  for (const schemaVersion of [4, -1, 1.5, true, '3', null]) {
    const q = rig({ schemaVersion, private: { preserve: true } }); const before = q.data();
    for (const action of [() => q.api.get(null), () => q.api.set({ private: false }), () => q.api.remove('private'), () => q.api.clear()]) await assert.rejects(action);
    assert.deepEqual(q.data(), before); assert.equal(q.writes(), 0);
  }
  const interrupted = rig(alpha); interrupted.fail(); await assert.rejects(() => interrupted.api.get(null)); assert.deepEqual(interrupted.data(), alpha);
  await interrupted.api.get(null); assert.equal(interrupted.data().schemaVersion, 3);
  const incoming = rig(first); await assert.rejects(() => incoming.api.set({ schemaVersion: 99, blockedGroups: [] })); assert.deepEqual(incoming.data(), first);
  await r.api.remove(['schemaVersion', 'storageMetadata', 'extra']); assert.equal(r.data().schemaVersion, 3); assert.equal(r.data().extra, undefined);
  await r.api.clear(); assert.deepEqual(Object.keys(r.data()).sort(), ['schemaVersion', 'storageMetadata']);
  const cb = rig({ schemaVersion: 99 });
  await new Promise(resolve => cb.api.get(null, result => { assert.equal(result, undefined); assert.match(cb.context.chrome.runtime.lastError.message, /preserved/); resolve(); }));
  assert.equal(cb.context.chrome.runtime.lastError, null);
  console.log('PASS storage migrations, app-major expiry, idempotence, interruption, callbacks and destination preservation');
  console.log('__CB_TEST_RESULT__: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
