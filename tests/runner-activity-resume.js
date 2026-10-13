// Exact-source worker/page callbacks in owned offline fixtures, not provider acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const epoch = 'f9e22cb3-6d62-4251-a995-d8cf84e75c79';
const otherEpoch = 'f9e22cb3-6d62-4251-a995-d8cf84e75c78';
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const snapshot = (revision, web, content, changedAtMs, identity = epoch) => ({ epoch: identity, revision, changedAtMs,
  settings: { byCategory: { 'web-visit': { enabled: web }, 'content-watched': { enabled: content } } } });
let checks = 0;
function check(label, predicate) { assert(predicate, label); checks++; console.log('PASS ' + label); }
async function fixture(focused = true, supported = true) {
  let now = 1000, serial = 0, settings = snapshot(0, false, false, now), heldSettings = null, heldActive = null, holdFanout = false, response = null;
  const storage = {}, sent = [], pushes = [], requests = [], fanouts = [];
  const event = () => ({ addListener() {} });
  const context = vm.createContext({ console, URL, Date: class extends Date { static now() { return now; } },
    crypto: { randomUUID: () => 'visit-' + (++serial) }, cbConnection: { activitySettingsNotifications: supported },
    cbClassifierHub: { async request(op, body) {
      requests.push(op);
      if (op === 'activity-settings') return heldSettings || structuredClone(settings);
      if (op === 'activity-record') { sent.push(...structuredClone(body.records));
        return response ? response(body) : { stored: 0, acceptedIDs: body.records.map(r => r.id), rejectedIDs: [], pendingIDs: [] }; }
      throw Error(op);
    } },
    chrome: { runtime: { lastError: null },
      tabs: { onActivated: event(), onUpdated: event(), onRemoved: event(),
        async query(_query, callback) { const tabs = [{ id: 1, windowId: 2, active: true, url: 'https://audit.example/' }]; if (callback) { if (holdFanout) fanouts.push(() => callback(tabs)); else callback(tabs); } else if (heldActive) return heldActive; return tabs; },
        sendMessage(_id, message, callback) { pushes.push(structuredClone(message)); callback(); } },
      windows: { WINDOW_ID_NONE: -1, onFocusChanged: event(), async get() { return { id: 2, focused }; } },
      alarms: { create() {} }, storage: { local: {
        async get(key) { return { [key]: structuredClone(storage[key]) }; },
        async set(values) { Object.assign(storage, structuredClone(values)); }, async remove(key) { delete storage[key]; },
      } },
    },
  });
  vm.runInContext(source('vault-activity.js'), context);
  const feeder = vm.runInContext('cbActivity', context);
  await feeder.init(); await feeder.sessionTail;
  return { feeder, storage, sent, pushes, requests, context,
    now: () => now, at(value) { now = value; }, setFocused(value) { focused = value; },
    supported(value) { context.cbConnection.activitySettingsNotifications = value; },
    holdSettings(value) { heldSettings = value; }, holdActive(value) { heldActive = value; },
    holdFanout(value) { holdFanout = value; }, deliverFanouts() { for (const call of fanouts.splice(0)) call(); }, reply(value) { response = value; },
    async apply(value) { settings = value; await feeder.applyNativeSettingsSnapshot(value, feeder.settingsConnectionGeneration); await feeder.sessionTail; },
    async drain() { await feeder.sessionTail; await feeder.bufferTail; await feeder.flush(); },
  };
}
function pageFixture() {
  let now = 1000, serial = 0, listener, interval, initial, playing = true, reply = { ok: true }, watched = [];
  const location = { href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', hostname: 'www.youtube.com' };
  const document = { visibilityState: 'visible', title: 'Song - YouTube', addEventListener() {},
    querySelectorAll() { return [{ paused: !playing, ended: false, readyState: 3, currentTime: 1 }]; } };
  const context = vm.createContext({ URL, console, location, document, window: { addEventListener() {} },
    Date: class extends Date { static now() { return now; } }, crypto: { randomUUID: () => 'content-' + (++serial) },
    getPlatformGroupTypeForHost: () => 'youtube',
    VaultClassifierExtensionContract: { youtubeVideoIDFromURL: href => new URL(href).searchParams.get('v') },
    setInterval(fn) { interval = fn; }, chrome: { runtime: { id: 'owned-extension', lastError: null,
      onMessage: { addListener(fn) { listener = fn; } }, sendMessage(message, callback) {
        if (message.kind === 'vault-activity-config') { initial = callback; return; }
        watched.push(structuredClone(message.record)); callback(reply);
      } } },
  });
  vm.runInContext(source('vault-activity-content.js'), context);
  return { watched, at(value) { now = value; }, tick(value) { now = value; interval?.(); }, location,
    playing(value) { playing = value; }, reply(value) { reply = value; }, initial(value) { initial(value); },
    push(value, sender = { id: 'owned-extension' }) { listener({ kind: 'vault-activity-settings-updated', config: value }, sender); } };
}
function config(generation, content, changedAtMs, options = {}) {
  return { token: 'worker-token', generation, paused: false, flags: { 'content-watched': content },
    authority: { epoch, revision: generation, changedAtMs }, contentCutoff: null, cutoffMs: changedAtMs, ...options };
}
(async () => {
  // Regression premise: startup OFF, then an ordinary supported native commit
  // notification reaches the unchanged actual connection receiver methods.
  const premise = await fixture();
  const bgSource = source('background.js'), receiverBegin = bgSource.indexOf('const cbConnection = {'), receiverEnd = bgSource.indexOf('\n};\n\n// Classifier requests share', receiverBegin);
  assert(receiverBegin >= 0 && receiverEnd > receiverBegin);
  const premiseContext = vm.createContext({ cbActivity: premise.feeder, CB_FIXED_ADDRESS: 'ws://fixture', WebSocket: { OPEN: 1 }, navigator: { userAgent: 'Chrome' }, console });premiseContext.self = premiseContext;
  vm.runInContext(bgSource.slice(receiverBegin, receiverEnd + 3) + ';globalThis.connection = cbConnection;', premiseContext);
  const premiseReceiver = premiseContext.connection;
  Object.assign(premiseReceiver, { ws: { readyState: 1 }, handshakeComplete: true, activitySettingsConnectionGeneration: 0,
    activitySettingsNotifications: true, status: { state: 'connected', hubProgram: 'macapp', peers: [{ program: 'macapp', connected: true }] } });
  premiseReceiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(1, true, false, 1000) });
  await new Promise(resolve => setImmediate(resolve));
  check('startup OFF to ordinary native ON notification changes exact current feeder without polling', premise.feeder.enabled['web-visit']);
  const f = await fixture();
  check('startup OFF has no live browser session', !f.storage.cbActivitySession);
  f.at(61000); await f.apply(snapshot(1, true, false, 61000));
  check('native ON starts existing active tab after disabled time', f.storage.cbActivitySession.startMs === 61000);
  f.at(71000); await f.feeder.refreshSettings();
  check('unchanged GET preserves live session', f.storage.cbActivitySession.startMs === 61000);
  await f.feeder.closeSession('window-blur'); await f.drain();
  check('stored:0 with accepted duplicate IDs acknowledges ten-second visit', f.sent[0]?.seconds === 10 && !f.storage.cbActivityBuffer.length);
  const background = await fixture(false);
  await background.apply(snapshot(1, true, false, 1000));
  check('native ON does not fabricate browser foreground', !background.storage.cbActivitySession);
  background.setFocused(true); await background.feeder.resolveActive('focus');
  background.at(6000); background.setFocused(false); await background.feeder.resolveActive('event');
  check('background tab events close the focused visit', !background.storage.cbActivitySession);
  background.setFocused(true); await background.feeder.resolveActive('refocus');background.at(6500);await background.feeder.closeSession('blur');await background.drain();
  check('fresh refocused tiny episode does not inherit eligibility across blur', background.sent.length === 1);
  const ordered = await fixture(); let deliverOld;
  ordered.holdSettings(new Promise(resolve => { deliverOld = resolve; }));
  const delayed = ordered.feeder.refreshSettings();
  await ordered.apply(snapshot(1, true, true, 1000)); deliverOld(snapshot(0, false, false, 1000)); await delayed;
  check('late startup GET cannot overwrite accepted native push', ordered.feeder.enabled['web-visit']);
  const native = await fixture(); await native.apply(snapshot(1, true, true, 1000));
  check('ordinary page fanout carries committed authority/config', native.pushes.at(-1).config.authority.revision === 1);
  await native.feeder.applyNativeSettingsSnapshot(snapshot(0, false, false, 1000), 0);
  await native.feeder.applyNativeSettingsSnapshot(snapshot(2, false, false, 1000), 9);
  check('stale revision and old socket cannot change consent', native.feeder.enabled['web-visit']);
  await native.feeder.applyNativeSettingsSnapshot(snapshot(1, false, false, 1000), 0);
  check('conflicting current revision fails closed', native.feeder.capturePaused);
  await native.apply(snapshot(1, true, true, 1000));
  check('valid unchanged authoritative GET resumes after fail-closed pause', !native.feeder.capturePaused);
  await native.feeder.applyNativeSettingsSnapshot(snapshot(2, true, true, 1000, otherEpoch), 0);
  check('new epoch on same socket fails closed', native.feeder.capturePaused);
  await native.apply(snapshot(1, true, true, 1000));
  await native.feeder.applyNativeSettingsSnapshot({ ...snapshot(2, true, true, 1000), changedAtMs: Infinity }, 0);
  check('malformed current authority fails closed', native.feeder.capturePaused);
  const delayedFanout = await fixture();delayedFanout.holdFanout(true);
  await delayedFanout.apply(snapshot(1, true, true, 1000));await delayedFanout.apply(snapshot(2, false, false, 1000));
  delayedFanout.deliverFanouts();
  check('delayed tabs query cannot send obsolete ON after newer OFF', delayedFanout.pushes.at(-1).config.flags['content-watched'] === false && delayedFanout.pushes.filter(p => p.config.flags['content-watched']).length === 0);
  const missedOFF = await fixture(false);missedOFF.holdFanout(true);
  await missedOFF.apply(snapshot(1, false, true, 1000));missedOFF.at(5000);await missedOFF.apply(snapshot(2, false, false, 4500));
  missedOFF.at(7000);await missedOFF.apply(snapshot(3, false, true, 6000));missedOFF.deliverFanouts();
  check('actual worker latest ON carries prior committed content OFF boundary', missedOFF.pushes.at(-1).config.contentCutoff.revision === 2 && missedOFF.pushes.at(-1).config.contentCutoff.changedAtMs === 4500);
  const slowFocus = await fixture();let releaseFocus;
  slowFocus.holdActive(new Promise(resolve => { releaseFocus = resolve; }));
  const enabling = slowFocus.apply(snapshot(1, true, false, 1000));await new Promise(resolve => setImmediate(resolve));
  const disabling = slowFocus.apply(snapshot(2, false, false, 1000));
  releaseFocus([{ id: 1, windowId: 2, active: true, url: 'https://audit.example/' }]);await enabling;await disabling;
  check('delayed active-tab resolution cannot reopen capture after OFF', !slowFocus.storage.cbActivitySession);
  const cutoff = await fixture(); await cutoff.apply(snapshot(1, true, true, 1000));
  cutoff.at(5000); await cutoff.apply(snapshot(2, true, true, 4000));
  check('continuous ON revision preserves measured tail at native boundary', cutoff.storage.cbActivitySession.startMs === 4000);
  cutoff.at(6000); await cutoff.apply(snapshot(3, false, false, 4500)); await cutoff.drain();
  check('already eligible episode retains positive subthreshold cutoff fragment', cutoff.sent.some(r => r.startedAtMs === 4000 && r.observedEndedAtMs === 4500 && r.seconds === .5));
  check('OFF excludes every observed interval after authoritative cutoff', cutoff.sent.every(r => r.observedEndedAtMs <= 4500));
  const tiny = await fixture(); await tiny.apply(snapshot(1, true, false, 1000)); tiny.at(1500);
  await tiny.apply(snapshot(2, false, false, 1500)); await tiny.drain();
  check('new tiny website episode keeps ordinary two-second eligibility threshold', !tiny.sent.length);
  const lateTiny = await fixture();await lateTiny.apply(snapshot(1, true, false, 1000));lateTiny.at(6000);
  await lateTiny.apply(snapshot(2, false, false, 1500));await lateTiny.drain();
  check('delayed OFF cached disabled time cannot qualify tiny pre-OFF website episode', !lateTiny.sent.length);
  const disconnect = await fixture(); await disconnect.apply(snapshot(1, true, true, 1000)); disconnect.at(6000);
  disconnect.supported(false); disconnect.feeder.beginSettingsConnection(1); await disconnect.feeder.sessionTail;
  check('disconnect pauses and retains genuinely observed authorized prefix', disconnect.feeder.capturePaused && disconnect.storage.cbActivityBuffer[0].observedEndedAtMs === 6000);
  disconnect.at(20000); disconnect.supported(true); await disconnect.apply(snapshot(1, true, true, 1000));
  check('fresh supported snapshot resumes without bridging disconnect gap', disconnect.storage.cbActivitySession.startMs === 20000);
  const unsupported = await fixture(true, false); await unsupported.feeder.refreshSettings();
  unsupported.feeder.onAlarm({ name: 'cb-activity-flush' }); await unsupported.drain();
  check('unsupported native pauses and alarm does not poll settings', unsupported.feeder.capturePaused && !unsupported.requests.length);
  const awaiting = await fixture(true, false);
  const waitingRow = { id: 'page-after-worker-restart', key: 'youtube:measured', category: 'content-watched', startedAtMs: 1000, observedEndedAtMs: 5000, seconds: 4, authorization: { epoch, revision: 1 } };
  awaiting.at(5000);
  check('page callback before first fresh supported snapshot remains retryable', (await awaiting.feeder.recordWatched(waitingRow)).permanent === false);
  awaiting.supported(true);await awaiting.apply(snapshot(2, false, true, 5000));
  check('same-epoch page callback from prior worker buffers unchanged for native admission', (await awaiting.feeder.recordWatched(waitingRow)).ok);
  const buffered = await fixture(); await buffered.apply(snapshot(1, false, true, 1000)); buffered.at(5000);
  const row = { id: 'stable-watch', key: 'youtube:measured', category: 'content-watched', startedAtMs: 1000, observedEndedAtMs: 5000, seconds: 4, authorization: { epoch, revision: 1 } };
  buffered.reply(body => ({ acceptedIDs: [], rejectedIDs: [], pendingIDs: body.records.map(r => r.id) }));
  check('ordinary page callback buffers valid measured record', (await buffered.feeder.recordWatched(row)).ok); await buffered.drain();
  check('native write failure pending IDs retains bytes for alarm retry', buffered.storage.cbActivityBuffer.length === 1);
  buffered.reply(() => ({ stored: 0 })); await buffered.drain();
  check('legacy stored count cannot silently delete buffered records', buffered.storage.cbActivityBuffer.length === 1);
  buffered.reply(body => ({ stored: 0, acceptedIDs: body.records.map(r => r.id), rejectedIDs: [], pendingIDs: [] })); await buffered.drain();
  check('exact accepted IDs delete acknowledged record', !buffered.storage.cbActivityBuffer.length);
  buffered.storage.cbActivityPendingIcons = { 'audit.example': 'data:image/png;base64,a' };
  await buffered.feeder.recordWatched({ ...row, id: 'duplicate-with-icon' });await buffered.drain();
  check('accepted duplicate stored:0 keeps icon pending because native did not store it', !!buffered.storage.cbActivityPendingIcons['audit.example']);
  buffered.reply(body => ({ stored: body.records.length, acceptedIDs: body.records.map(r => r.id), rejectedIDs: [], pendingIDs: [] }));
  await buffered.feeder.recordWatched({ ...row, id: 'new-with-icon' });await buffered.drain();
  check('positive new stored receipt releases pending native icon', !buffered.storage.cbActivityPendingIcons['audit.example']);
  check('missing or forged grant is permanently rejected', (await buffered.feeder.recordWatched({ ...row, id: 'bad', authorization: { epoch, revision: 999 } })).permanent);
  check('known native grant cannot authorize pre-enable observed time', (await buffered.feeder.recordWatched({ ...row, id: 'before-enable', startedAtMs: 0, seconds: 5 })).permanent);
  buffered.storage.cbActivityBuffer = [null, { id: 'legacy' }, { ...row, id: 'prior-worker', authorization: { epoch, revision: 0 } }];
  await buffered.drain();
  check('same-epoch persisted old revision reaches authoritative native admission; malformed buffer excluded', buffered.sent.at(-1).id === 'prior-worker' && !buffered.storage.cbActivityBuffer.length);
  buffered.storage.cbActivityBuffer = [row]; buffered.feeder.beginSettingsConnection(2); buffered.at(10000);
  await buffered.apply(snapshot(0, false, true, 10000, otherEpoch)); await buffered.drain();
  check('fresh new native epoch discards stale-epoch pending bytes', !buffered.storage.cbActivityBuffer.length);
  // Actual production receiver methods, with no socket/app/browser launched.
  const bg = source('background.js'), begin = bg.indexOf('const cbConnection = {'), end = bg.indexOf('\n};\n\n// Classifier requests share', begin);
  assert(begin >= 0 && end > begin);
  const rx = vm.createContext({ cbActivity: ordered.feeder, CB_FIXED_ADDRESS: 'ws://fixture', WebSocket: { OPEN: 1 }, navigator: { userAgent: 'Chrome' }, console }); rx.self = rx;
  vm.runInContext(bg.slice(begin, end + 3) + ';globalThis.connection = cbConnection;', rx);
  const receiver = rx.connection;receiver.ws = { readyState: 1 };receiver.handshakeComplete = true;
  receiver.activitySettingsConnectionGeneration = 0;receiver.activitySettingsNotifications = true;
  receiver.status = { state: 'connected', hubProgram: 'classifier', peers: [{ program: 'macapp', connected: true }] };
  receiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(2, false, false, 1000) });
  check('classifier-origin cannot authorize Activity settings', ordered.feeder.enabled['web-visit']);
  receiver.status.hubProgram = 'macapp';receiver.activitySettingsNotifications = false;
  receiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(2, false, false, 1000) });
  check('missing welcome capability cannot authorize Activity push', ordered.feeder.enabled['web-visit']);
  receiver.activitySettingsNotifications = true; receiver.status.state = 'disconnected';
  receiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(2, false, false, 1000) });
  check('disconnected frames cannot authorize settings', ordered.feeder.enabled['web-visit']);
  receiver.status.state = 'connected';receiver.handleMessage({ kind: 'activity-settings-updated', body: snapshot(2, false, false, 1000) });
  await ordered.feeder.sessionTail;
  check('authenticated current desktop push applies OFF immediately', !ordered.feeder.enabled['web-visit']);
  const page = pageFixture(); page.push(config(1, true, 1000)); page.initial(config(0, false, 1000));
  page.tick(5000); page.tick(9000); page.push(config(2, false, 6000));
  check('held initial content GET cannot override fresh push; native OFF saves only measured prefix', page.watched.length === 1 && page.watched[0].startedAtMs === 1000 && page.watched[0].observedEndedAtMs === 6000);
  page.tick(13000); check('content OFF captures no disabled interval', page.watched.length === 1);
  page.at(17000);page.push(config(3, true, 15000));page.tick(21000);page.tick(25000);page.push(config(4, false, 23000));
  check('content ON starts fresh and never backfills disabled gap', page.watched.at(-1).startedAtMs === 17000 && page.watched.at(-1).observedEndedAtMs === 23000);
  const collapsed = pageFixture();collapsed.push(config(1, true, 1000));collapsed.tick(5000);collapsed.at(7000);
  collapsed.push(config(3, true, 6000, { contentCutoff: { epoch, revision: 2, changedAtMs: 4500 } }));
  check('latest ON retains worker native OFF cutoff when intermediate page fanout was superseded', collapsed.watched[0].observedEndedAtMs === 4500);
  collapsed.tick(7500);collapsed.push(config(4, false, 7500, { contentCutoff: { epoch, revision: 4, changedAtMs: 7500 } }));
  check('collapsed OFF/ON resets episode eligibility and excludes tiny new episode', collapsed.watched.length === 1);
  const collapsedTiny = pageFixture();collapsedTiny.push(config(1, true, 1000));collapsedTiny.tick(5000);
  collapsedTiny.push(config(3, true, 6000, { contentCutoff: { epoch, revision: 2, changedAtMs: 1500 } }));
  check('collapsed OFF/ON cannot qualify old tiny episode using disabled cached ticks', !collapsedTiny.watched.length);
  const tail = pageFixture();tail.push(config(1, true, 1000));tail.tick(5000);tail.tick(9000);tail.push(config(2, true, 6000));
  check('continuous ON content revision preserves both measured boundary fragments', tail.watched.length === 2 && tail.watched[0].seconds === 5 && tail.watched[1].seconds === 3 && tail.watched[1].authorization.revision === 2);
  tail.tick(9500);tail.push(config(3, false, 9500));
  check('eligible content episode retains later positive half-second fragment', tail.watched.at(-1).seconds === .5);
  const little = pageFixture();little.push(config(1, true, 1000));little.tick(2000);little.push(config(2, false, 2000));
  check('new tiny content episode retains ordinary three-second threshold', !little.watched.length);
  const lateLittle = pageFixture();lateLittle.push(config(1, true, 1000));lateLittle.tick(5000);lateLittle.push(config(2, false, 1500));
  check('delayed OFF cached disabled ticks cannot qualify tiny pre-OFF content episode', !lateLittle.watched.length);
  const gaps = pageFixture();gaps.push(config(1, true, 1000));gaps.tick(10000);gaps.at(11000);gaps.push(config(2, false, 11000, { paused: true }));
  check('capped tick records only last observed five seconds, not unobserved gap or flush-now', gaps.watched[0].startedAtMs === 5000 && gaps.watched[0].observedEndedAtMs === 10000);
  gaps.at(20000);gaps.push(config(3, true, 1000));gaps.tick(24000);gaps.push(config(4, false, 24000));
  check('content reconnect begins at fresh observation and excludes disconnected gap', gaps.watched.at(-1).startedAtMs === 20000);
  const pages = pageFixture();pages.reply({ ok: false, permanent: false });pages.push(config(1, true, 1000));pages.tick(5000);pages.push(config(2, false, 5000));pages.tick(9000);
  check('delayed worker failure retries the same page record ID', pages.watched.length === 2 && pages.watched[0].id === pages.watched[1].id);
  pages.reply({ ok: true });pages.tick(13000);pages.tick(17000);
  check('page stops retrying only after explicit successful buffering acknowledgement', pages.watched.length === 3);
  const forged = pageFixture();forged.push(config(1, true, 1000), { id: 'foreign' });forged.push(config(1, true, 1000), { id: 'owned-extension', tab: { id: 4 } });forged.push(config(1, true, 1000, { authority: null }));forged.tick(5000);
  check('foreign/content-origin/malformed configuration cannot start capture', !forged.watched.length);
  const pause = pageFixture();pause.push(config(1, true, 1000));pause.tick(5000);pause.playing(false);pause.tick(6000);pause.playing(true);pause.tick(7000);pause.tick(7500);pause.push(config(2, false, 7500));
  check('fresh tiny replay episode does not inherit eligibility across playback pause', pause.watched.length === 1);
  const navigation = pageFixture();navigation.push(config(1, true, 1000));navigation.tick(5000);navigation.location.href = 'https://www.youtube.com/watch?v=abcdefghijk';navigation.tick(9000);
  check('content navigation flushes prior eligible episode before resetting new episode', navigation.watched[0].key === 'youtube:dQw4w9WgXcQ');
  console.log(`__CB_TEST_RESULT__: OK (${checks} exact-source offline controls; no native provider/browser acceptance)`);
})().catch(error => { console.error(error); process.exitCode = 1; });
