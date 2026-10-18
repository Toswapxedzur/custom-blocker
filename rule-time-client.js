// Authenticated local-hub coordination for managed custom-rule time objects.
// No user rule source executes here. All state writes retain the background's
// existing serialized rule writer; only the reserved namespace crosses the hub.
(function (global) {
  "use strict";
  const pending = new Map(), knownLinked = new Set();
  let sequence = 0;
  function cluster(groupId) {
    return CBBridgeProtocol.clusterForGroup(cbClusterCopy, { id: groupId }, cbDetectProgramId());
  }
  const unavailable = id => ({ linked: true, ready: false, clusterId: id });
  function usageSample(event) {
    if (!event) return null;
    const data = event.data || {};
    if (event.type === "visible") {
      let host;
      try { const url = new URL(data.url); if (!["http:", "https:"].includes(url.protocol)) return null; host = url.hostname; } catch (_) { return null; }
      return { type: "visible", now: event.now, data: { url: "https://" + host, elapsedMs: data.elapsedMs } };
    }
    return event.type === "tick" ? { type: "tick", now: event.now, data: {} } : null;
  }
  function request(groupId, link, seed, usage) {
    if (!cbConnection.desktopRouteIsReady() || cbConnection.ruleTimeVersion !== 1) return Promise.resolve(unavailable(link.id));
    if (pending.size >= 32) return Promise.resolve(unavailable(link.id));
    const socket = cbConnection.ws, requestID = "rule-time-" + Date.now().toString(36) + "-" + (++sequence);
    return new Promise(resolve => {
      const finish = body => { const record = pending.get(requestID); if (!record) return; clearTimeout(record.timeout); pending.delete(requestID); resolve(body); };
      const timeout = setTimeout(() => finish(unavailable(link.id)), 3000);
      pending.set(requestID, { socket, groupId, clusterId: link.id, finish, timeout });
      const commands = seed?.scope === link.id && Array.isArray(seed.pending) ? seed.pending : [];
      if (!cbConnection.sendWS({ kind: "rule-time-request", requestID, groupId, clusterId: link.id,
        seed: seed || { version: 1, objects: {} }, commands, usage: usageSample(usage) })) finish(unavailable(link.id));
    });
  }
  async function configureGroup(groupId, event = null, snapshot = null) {
    const store = snapshot || await chrome.storage.local.get({ blockedGroups: [], cbRuleState: {} });
    const group = store.blockedGroups.find(value => value?.id === groupId && value.groupType === "custom");
    if (!group) return;
    const seed = store.cbRuleState?.[groupId]?.$vaultTime;
    const link = cluster(groupId);
    if (!link) {
      if (seed?.scope || knownLinked.has(groupId)) {
        knownLinked.delete(groupId);
        await sendToEventSandbox({ kind: "time-context", groupId, context: { linked: false } });
      }
      return;
    }
    knownLinked.add(groupId);
    const generation = cbRuleGenerations.get(groupId);
    const socket = cbConnection.ws;
    let context = await request(groupId, link, seed, group.enabled && ["visible", "tick"].includes(event?.type) ? event : null);
    const current = cluster(groupId);
    if (!current || current.id !== link.id || generation !== cbRuleGenerations.get(groupId)) return;
    if (socket !== cbConnection.ws || context.linked !== true || context.clusterId !== link.id) context = unavailable(link.id);
    const result = await sendToEventSandbox({ kind: "time-context", groupId, context });
    if (result?.ok === false) throw new Error(result.error || "custom-time-context-refused");
  }
  async function configureAll(event = null, targetGroupId = null) {
    const store = await chrome.storage.local.get({ blockedGroups: [], cbRuleState: {} });
    const ids = store.blockedGroups.filter(group => group?.groupType === "custom" && (!targetGroupId || group.id === targetGroupId)).map(group => group.id);
    const live = new Set(store.blockedGroups.filter(group => group?.groupType === "custom").map(group => group.id));
    for (const id of knownLinked) if (!live.has(id)) knownLinked.delete(id);
    // One peer has a bounded number of in-flight requests. Batch fanout avoids
    // multiplying a failed peer's timeout by every custom group.
    for (let start = 0; start < ids.length; start += 16) await Promise.all(ids.slice(start, start + 16).map(id => configureGroup(id, event, store)));
  }
  function receive(message) {
    const record = pending.get(message?.requestID);
    if (!record || record.socket !== cbConnection.ws || message.groupId !== record.groupId) return;
    record.finish(message.body || unavailable(record.clusterId));
  }
  function disconnect() {
    for (const record of [...pending.values()]) record.finish(unavailable(record.clusterId));
    cbConnection.ruleTimeVersion = 0;
  }
  function seedForRoster(state) {
    const seed = state?.$vaultTime;
    if (!seed) return undefined;
    // A roster is a preflight, not the usage handover. Every member confirms a
    // fresh full seed after linking before availability/control is admitted.
    const objects = Object.fromEntries(Object.entries(seed.objects || {}).map(([id, value]) => [id,
      value?.kind === "rolling" ? { ...value, bucketsMs: {}, segments: [] } : value]));
    return { version: seed.version, objects };
  }
  function configurationKey(state) {
    return JSON.stringify(Object.entries(state?.$vaultTime?.objects || {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) =>
      [id, value?.kind, value?.direction, value?.durationMs, value?.windowMs, value?.limitMs]));
  }
  global.CBRuleTime = Object.freeze({ configureGroup, configureAll, receive, disconnect, seedForRoster, configurationKey,
    hasLinkedCustom: () => cbClusterCopy.some(link => CBBridgeProtocol.localMember(link, cbDetectProgramId())) });
})(typeof self === "undefined" ? globalThis : self);
