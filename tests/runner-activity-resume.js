// Exercise the real feeder lifecycle without a browser or private history.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function fixture(focused) {
  let now = 1000, enabled = false;
  const storage = {}, sent = [];
  const event = () => ({ addListener() {} });
  const context = vm.createContext({
    console, URL, Date: class extends Date { static now() { return now; } },
    crypto: { randomUUID: () => 'visit-' + now },
    cbClassifierHub: { async request(op, body) {
      if (op === 'activity-settings') return { settings: { byCategory: { 'web-visit': { enabled }, 'content-watched': { enabled: false } } } };
      if (op === 'activity-record') { sent.push(...body.records); return { ok: true }; }
      throw Error(op);
    } },
    chrome: {
      tabs: { onActivated: event(), onUpdated: event(), onRemoved: event(),
        async query() { return [{ id: 1, windowId: 2, active: true, url: 'https://audit.example/' }]; } },
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
  return { feeder, storage, sent, setEnabled(value) { enabled = value; }, advance(ms) { now += ms; }, setFocused(value) { focused = value; } };
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
  console.log('PASS recording resume, disabled-time exclusion, unchanged refresh and browser focus');
  console.log('__CB_TEST_RESULT__: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
