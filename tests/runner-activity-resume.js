// Exercise the real feeder lifecycle without a browser or private history.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function fixture(focused) {
  let now = 1000, enabled = false, heldSettings = null;
  const storage = {}, sent = [], settingsPushes = [];
  const event = () => ({ addListener() {} });
  const context = vm.createContext({
    console, URL, Date: class extends Date { static now() { return now; } },
    crypto: { randomUUID: () => 'visit-' + now },
    cbClassifierHub: { async request(op, body) {
      if (op === 'activity-settings' && heldSettings) return heldSettings;
      if (op === 'activity-settings') return { settings: { byCategory: { 'web-visit': { enabled }, 'content-watched': { enabled: false } } } };
      if (op === 'activity-record') { sent.push(...body.records); return { ok: true }; }
      throw Error(op);
    } },
    chrome: {
      runtime: { lastError: null },
      tabs: { onActivated: event(), onUpdated: event(), onRemoved: event(),
        async query(_query, callback) { const tabs = [{ id: 1, windowId: 2, active: true, url: 'https://audit.example/' }]; if (callback) callback(tabs); return tabs; },
        sendMessage(_id, message, callback) { settingsPushes.push(message); callback(); } },
      windows: { WINDOW_ID_NONE: -1, onFocusChanged: event(), async get() { return { id: 2, focused }; } },
      alarms: { create() {} },
      storage: { local: {
        async get(key) { return { [key]: structuredClone(storage[key]) }; },
        async set(values) { Object.assign(storage, structuredClone(values)); },
        async remove(key) { delete storage[key]; },
      } },
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'vault-activity.js'), 'utf8'), context);
  const feeder = vm.runInContext('cbActivity', context);
  await feeder.init();
  await new Promise(resolve => setImmediate(resolve));
  return { feeder, storage, sent, settingsPushes, holdSettings(promise) { heldSettings = promise; }, setEnabled(value) { enabled = value; }, advance(ms) { now += ms; }, setFocused(value) { focused = value; } };
}

(async () => {
  const f = await fixture(true);
  assert.equal(f.storage.cbActivitySession, undefined);
  f.advance(60000); f.setEnabled(true);
  await f.feeder.refreshSettings();
  assert.equal(f.storage.cbActivitySession?.domain, 'audit.example', 'enabling recording starts the already-active tab');
  assert.equal(f.storage.cbActivitySession.startMs, 61000, 'disabled time is excluded');
  f.advance(10000);
  await f.feeder.refreshSettings();
  assert.equal(f.storage.cbActivitySession.startMs, 61000, 'unchanged settings preserve the live session');
  await f.feeder.closeSession('window-blur');
  await f.feeder.flush();
  assert.equal(f.sent[0]?.seconds, 10, 'the resumed visit reaches the real flush path');
  f.setEnabled(false); await f.feeder.refreshSettings();
  assert.equal(f.storage.cbActivitySession, undefined);

  const background = await fixture(false);
  background.setEnabled(true); await background.feeder.refreshSettings();
  assert.equal(background.storage.cbActivitySession, undefined, 'enabling from another app does not record an unfocused browser');
  background.setFocused(true); await background.feeder.resolveActive('window-focus');
  assert.equal(background.storage.cbActivitySession?.domain, 'audit.example');
  background.advance(5000); background.setFocused(false);
  await background.feeder.resolveActive('tab-activated');
  assert.equal(background.storage.cbActivitySession, undefined, 'background tab events cannot keep recording');
  const ordered = await fixture(true);
  let deliverOld;
  ordered.holdSettings(new Promise(resolve => { deliverOld = resolve; }));
  const delayedGET = ordered.feeder.refreshSettings();
  await ordered.feeder.applySettingsSnapshot({ byCategory: { 'web-visit': { enabled: true }, 'content-watched': { enabled: false } } });
  deliverOld({ settings: { byCategory: { 'web-visit': { enabled: false }, 'content-watched': { enabled: false } } } });
  await delayedGET;
  assert.equal(ordered.feeder.enabled['web-visit'], true, 'startup GET cannot overwrite a newer accepted native snapshot');
  assert.equal(ordered.storage.cbActivitySession.startMs, 1000, 'stale GET does not destroy the resumed session');
  const generation = ordered.feeder.settingsGeneration;
  assert.equal(await ordered.feeder.applySettingsSnapshot({ byCategory: { 'web-visit': { enabled: 'true' }, 'content-watched': { enabled: false } } }), false);
  assert.equal(ordered.feeder.settingsGeneration, generation, 'malformed consent does not advance the accepted generation');
  assert.equal(ordered.feeder.enabled['web-visit'], true, 'malformed snapshot cannot replace valid consent');
  const native = await fixture(true);
  const epoch = 'f9e22cb3-6d62-4251-a995-d8cf84e75c79';
  const snapshot = (revision, web, identity = epoch) => ({ epoch: identity, revision, changedAtMs: 1000 + revision,
    settings: { byCategory: { 'web-visit': { enabled: web }, 'content-watched': { enabled: false } } } });
  native.feeder.beginSettingsConnection(7);
  assert.equal(await native.feeder.applyNativeSettingsSnapshot(snapshot(1, true), 7), true);
  assert.equal(native.settingsPushes.at(-1).revision, 1, 'accepted snapshot fans out via ordinary page messaging');
  assert.equal(await native.feeder.applyNativeSettingsSnapshot(snapshot(0, false), 7), false, 'older revision is ignored');
  assert.equal(await native.feeder.applyNativeSettingsSnapshot(snapshot(1, false), 7), false, 'conflicting equal revision is refused');
  assert.equal(await native.feeder.applyNativeSettingsSnapshot(snapshot(2, false), 6), false, 'previous connection generation is refused');
  assert.equal(await native.feeder.applyNativeSettingsSnapshot(snapshot(2, false, 'f9e22cb3-6d62-4251-a995-d8cf84e75c78'), 7), false, 'epoch cannot change inside an authenticated connection');
  assert.equal(await native.feeder.applyNativeSettingsSnapshot({ ...snapshot(2, false), revision: Number.MAX_SAFE_INTEGER + 1 }, 7), false);
  assert.equal(await native.feeder.applyNativeSettingsSnapshot({ ...snapshot(2, false), changedAtMs: Infinity }, 7), false);
  assert.equal(native.feeder.enabled['web-visit'], true, 'invalid or stale native metadata cannot change recording consent');
  const bg = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const begin = bg.indexOf('const cbConnection = {'), end = bg.indexOf('\n};\n\n// Classifier requests share', begin);
  assert(begin >= 0 && end > begin);
  const receiverContext = vm.createContext({ cbActivity: native.feeder, CB_FIXED_ADDRESS: 'ws://fixture', WebSocket: { OPEN: 1 },
    navigator: { userAgent: 'Chrome' }, console });receiverContext.self = receiverContext;
  vm.runInContext(bg.slice(begin, end + 3) + ';globalThis.connection = cbConnection;', receiverContext);
  const receiver = receiverContext.connection;receiver.ws = { readyState: 1 };receiver.handshakeComplete = true;
  receiver.activitySettingsConnectionGeneration = 7;receiver.activitySettingsNotifications = true;
  receiver.status = { state: 'connected', hubProgram: 'classifier', peers: [{ program: 'macapp', connected: true }] };
  receiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(2, false) });
  assert.equal(native.feeder.enabled['web-visit'], true, 'classifier hub cannot originate Activity consent');
  receiver.status.hubProgram = 'macapp';receiver.activitySettingsNotifications = false;
  receiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(2, false) });
  assert.equal(native.feeder.enabled['web-visit'], true, 'unadvertised notification capability cannot authorize a push');
  receiver.activitySettingsNotifications = true;receiver.status.state = 'disconnected';
  receiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(2, false) });
  assert.equal(native.feeder.enabled['web-visit'], true, 'disconnected frames cannot authorize recording changes');
  receiver.status.state = 'connected';receiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(2, false) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(native.feeder.enabled['web-visit'], false, 'authenticated desktop push applies the current revision');
  console.log('PASS native metadata ordering, page fanout and desktop-only receiver trust; cutoff/unsupported/disconnect capture policy not exercised');
  console.log('PASS exact feeder stale GET suppression and strict settings types; notification transport/cutoff policy not exercised');
  console.log('PASS recording resume, disabled-time exclusion, unchanged refresh and browser focus');
  console.log('__CB_TEST_RESULT__: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
