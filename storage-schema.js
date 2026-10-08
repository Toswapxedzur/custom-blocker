/* Local storage format registry. Product majors expire transformations; schema
 * numbers describe data only. All consumers use the guarded chrome API below. */
(function (g) {
  'use strict';
  const SCHEMA = 3, FORMAT = 'vault.web-store';
  function product() {
    const id = g.__CB_DESKTOP_PROGRAM_ID;
    const url = typeof g.chrome?.runtime?.getURL === 'function' ? g.chrome.runtime.getURL('') : '';
    return id === 'windowsapp' ? 'windows' : id === 'macapp' ? 'mac' : /^safari-web-extension:\/\//.test(url) ? 'safari' : 'browser';
  }
  function major(version) { return /^\d+(?:\.\d+)*$/.test(version || '') ? Number(version.split('.')[0]) : -1; }
  function identity() { return { product: product(), appVersion: g.chrome.runtime.getManifest().version }; }
  function validate(root, writer = identity()) {
    const v = root.schemaVersion === undefined ? 0 : root.schemaVersion;
    if (!Number.isInteger(v) || v < 0 || v > SCHEMA) throw new Error('Unsupported storage schema ' + v + '. Saved data is preserved.');
    const m = root.storageMetadata;
    const appMajor = major(writer.appVersion);
    if (appMajor < 0) throw new Error('Storage product version is unavailable.');
    if (m !== undefined) {
      if (!m || m.format !== FORMAT || m.schemaVersion !== v || !m.product || major(m.writtenByAppVersion) < 0) throw new Error('Unsupported or inconsistent storage metadata. Saved data is preserved.');
      if (v < SCHEMA && m.product === writer.product && major(m.writtenByAppVersion) < Math.max(0, appMajor - 1)) throw new Error('This app-major storage migration has expired. Saved data is preserved.');
    } else {
      const alphaMajor = writer.product === 'mac' ? 2 : writer.product === 'windows' ? 0 : 3;
      if (appMajor > alphaMajor + 1) throw new Error('Alpha storage import has expired. Saved data is preserved.');
    }
  }
  function metadata(writer = identity()) { return { format: FORMAT, schemaVersion: SCHEMA, product: writer.product, writtenByAppVersion: writer.appVersion }; }
  g.CBStorageSchema = Object.freeze({ currentSchema: SCHEMA, format: FORMAT, validate, metadata, major });
  if (!g.chrome?.storage?.local || g.__cbStorageSchemaInstalled) return;
  g.__cbStorageSchemaInstalled = true;
  const api = g.chrome, local = api.storage.local;
  const raw = Object.fromEntries(['get', 'set', 'remove', 'clear'].filter(k => typeof local[k] === 'function').map(k => [k, local[k].bind(local)]));
  let queue = Promise.resolve(), callbackError = null;
  function serial(body) { const next = queue.then(body); queue = next.catch(() => {}); return next; }
  async function ensure() {
    const header = await raw.get(['schemaVersion', 'storageMetadata']);
    validate(header);
    if (header.schemaVersion === SCHEMA && header.storageMetadata) return;
    // Metadata and payload commit together. Failed writes leave the old schema
    // intact; a retry therefore reruns this idempotent transformation.
    const root = await raw.get(null);
    validate(root);
    const writes = { schemaVersion: SCHEMA, storageMetadata: metadata() };
    if (Array.isArray(root.blockedGroups) && g.CBGroupScopes) writes.blockedGroups = g.CBGroupScopes.sanitizeGroups(root.blockedGroups).map(g.CBGroupScopes.withoutFlatScopeFields);
    await raw.set(writes);
  }
  function run(name, args) {
    const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
    const task = serial(async () => {
      await ensure();
      if (name === 'set') {
        const changes = { ...args[0] };
        if ('schemaVersion' in changes || 'storageMetadata' in changes) validate(changes);
        // Metadata is owned by the registry, never by an imported UI snapshot.
        delete changes.schemaVersion; delete changes.storageMetadata;
        changes.schemaVersion = SCHEMA; changes.storageMetadata = metadata();
        return raw.set(changes);
      }
      if (name === 'remove') {
        args[0] = [].concat(args[0]).filter(k => k !== 'schemaVersion' && k !== 'storageMetadata');
        return raw.remove(...args);
      }
      if (name === 'clear') {
        // Preserve the schema barrier during clear: another writer must never
        // mistake the cleared document for a legacy import.
        const root = await raw.get(null);
        await raw.remove(Object.keys(root).filter(k => k !== 'schemaVersion' && k !== 'storageMetadata'));
        return raw.set({ schemaVersion: SCHEMA, storageMetadata: metadata() });
      }
      return raw.get(...args);
    });
    if (!callback) return task;
    task.then(value => callback(value), error => {
      callbackError = { message: error.message };
      try { callback(undefined); } finally { callbackError = null; }
    });
    return undefined;
  }
  const guarded = new Proxy(local, { get(o, k) { return k in raw ? (...args) => run(k, args) : typeof o[k] === 'function' ? o[k].bind(o) : o[k]; } });
  const storage = new Proxy(api.storage, { get(o, k) { return k === 'local' ? guarded : o[k]; } });
  const runtime = new Proxy(api.runtime, { get(o, k) { return k === 'lastError' && callbackError ? callbackError : typeof o[k] === 'function' ? o[k].bind(o) : o[k]; } });
  g.chrome = new Proxy(api, { get(o, k) { return k === 'storage' ? storage : k === 'runtime' ? runtime : o[k]; } });
})(typeof globalThis !== 'undefined' ? globalThis : this);
