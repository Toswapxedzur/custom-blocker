// Authenticated local-hub coordination for managed custom-rule time objects.
// No user rule source executes here. All state writes retain the background's
// existing serialized rule writer; only the reserved namespace crosses the hub.
(function (global) {
  "use strict";
  const pending = new Map(), knownLinked = new Set(), knownScopes = new Map(), discoveries = new Map();
  let saveTail = Promise.resolve();
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
  function stateKey(value) {
    return JSON.stringify(value ?? null, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  }
  function persistDetached(groupId, seed, context, generation) {
    const operation = async () => {
      const store = await chrome.storage.local.get({ blockedGroups: [], cbRuleState: {} });
      if (generation !== cbRuleGenerations.get(groupId) || !store.blockedGroups.some(group => group?.id === groupId && group.groupType === "custom")) throw new Error("Detached rule changed before save.");
      const previous = store.cbRuleState?.[groupId] || {};
      if (stateKey(previous.$vaultTime) !== stateKey(seed)) throw new Error("Detached rule state changed; retry transfer.");
      const next = { ...previous, $vaultTime: context.state };
      if (unescape(encodeURIComponent(JSON.stringify(next))).length > 65536) throw new Error("Final time exceeds rule state capacity.");
      await chrome.storage.local.set({ cbRuleState: { ...store.cbRuleState, [groupId]: next } });
    };
    const next = saveTail.catch(() => {}).then(() => typeof cbWithDefinitionMutation === "function" ? cbWithDefinitionMutation(operation) : operation());
    saveTail = next;
    return next;
  }
  async function deliverContext(groupId, context, generation) {
    try {
      const result = await sendToEventSandbox({ kind: "time-context", groupId, context });
      if (result?.ok !== true) throw new Error(result?.error || "custom-time-context-refused");
    } catch (error) {
      // The saved handover may already have acknowledged the hub snapshot.
      // Retire the stale engine now; the existing next-tick recovery loads
      // saved state without replaying the event or re-entering its queue.
      if (generation === cbRuleGenerations.get(groupId)) {
        cbRuleStateSaveRetries.add(groupId);
        await unloadCustomGroupHandlers(groupId);
      }
      throw error;
    }
  }
  async function configureGroup(groupId, event = null, snapshot = null) {
    const generation = cbRuleGenerations.get(groupId), socket = cbConnection.ws;
    // A delayed handover may precede a new link. Complete/save/acknowledge it
    // before ever admitting a new cluster's availability or controls.
    for (let round = 0; round < 3; round++) {
      const store = round === 0 && snapshot || await chrome.storage.local.get({ blockedGroups: [], cbRuleState: {} });
      const group = store.blockedGroups.find(value => value?.id === groupId && value.groupType === "custom");
      if (!group || generation !== cbRuleGenerations.get(groupId)) return;
      const seed = store.cbRuleState?.[groupId]?.$vaultTime, link = cluster(groupId);
      const remembered = seed?.detachedReceipt?.clusterId || seed?.scope || knownScopes.get(groupId);
      let target = remembered ? { id: remembered } : link;
      const discover = !target && Object.keys(seed?.objects || {}).length > 0 && cbConnection.desktopRouteIsReady() && cbConnection.ruleTimeVersion === 1 && discoveries.get(groupId) !== socket;
      if (discover) target = { id: "" };
      if (!target) {
        knownLinked.delete(groupId); knownScopes.delete(groupId);
        await deliverContext(groupId, { linked: false }, generation);
        return;
      }
      if (target.id) { knownLinked.add(groupId); knownScopes.set(groupId, target.id); }
      let context = await request(groupId, target, seed, !remembered || remembered === link?.id ? group.enabled && ["visible", "tick"].includes(event?.type) ? event : null : null);
      if (generation !== cbRuleGenerations.get(groupId)) return;
      const redirectedHandover = context.linked === false && context.detached === true &&
        context.state?.detachedReceipt?.clusterId === context.clusterId && typeof context.state.detachedReceipt.token === "string";
      if (socket !== cbConnection.ws || target.id && context.clusterId && context.clusterId !== target.id && !redirectedHandover) context = unavailable(link?.id || target.id);
      if (discover && (context.linked === false || context.linked === true && context.ready === true)) discoveries.set(groupId, socket);
      if (context.detached === true && context.linked === false) {
        if (context.state?.version !== 1 || !context.state.objects) throw new Error("Invalid final shared snapshot.");
        await persistDetached(groupId, seed, context, generation);
        if (context.state.detachedReceipt) knownScopes.set(groupId, context.state.detachedReceipt.clusterId);
        else { knownScopes.delete(groupId); if (!cluster(groupId)) knownLinked.delete(groupId); }
        if (context.relinkClusterId || context.handoverPending || cluster(groupId)) continue;
      } else if (link && (context.linked !== true || context.clusterId !== link.id)) context = unavailable(link.id);
      else if (context.linked === false && seed?.scope) context = unavailable(target.id);
      await deliverContext(groupId, context, generation);
      return;
    }
    const target = cluster(groupId)?.id || knownScopes.get(groupId) || "unavailable";
    await deliverContext(groupId, unavailable(target), generation);
  }
  async function configureAll(event = null, targetGroupId = null) {
    const store = await chrome.storage.local.get({ blockedGroups: [], cbRuleState: {} });
    const ids = store.blockedGroups.filter(group => group?.groupType === "custom" && (!targetGroupId || group.id === targetGroupId)).map(group => group.id);
    const live = new Set(store.blockedGroups.filter(group => group?.groupType === "custom").map(group => group.id));
    for (const id of knownLinked) if (!live.has(id)) { knownLinked.delete(id); knownScopes.delete(id); discoveries.delete(id); }
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
    discoveries.clear();
  }
  function clustersChanged(previous, next) {
    const program = cbDetectProgramId();
    for (const link of previous || []) {
      const member = CBBridgeProtocol.localMember(link, program);
      if (member && !(next || []).some(value => value.id === link.id && CBBridgeProtocol.localMember(value, program)?.groupId === member.groupId)) {
        knownLinked.add(member.groupId); knownScopes.set(member.groupId, link.id); discoveries.delete(member.groupId);
      }
    }
  }
  function seedForRoster(state) {
    const seed = state?.$vaultTime;
    if (!seed) return undefined;
    // A roster is a preflight, not the usage handover. Every member confirms a
    // fresh full seed after linking before availability/control is admitted.
    const objects = Object.fromEntries(Object.entries(seed.objects || {}).map(([id, value]) => [id,
      value?.kind === "rolling" ? { ...value, bucketsMs: {}, segments: [] } : value]));
    return { version: seed.version, objects, scope: seed.scope, detachedReceipt: seed.detachedReceipt, ownTargets: seed.ownTargets };
  }
  function configurationKey(state) {
    return JSON.stringify(Object.entries(state?.$vaultTime?.objects || {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, value]) =>
      [id, value?.kind, value?.direction, value?.durationMs, value?.windowMs, value?.limitMs]));
  }
  global.CBRuleTime = Object.freeze({ configureGroup, configureAll, receive, disconnect, clustersChanged, seedForRoster, configurationKey,
    hasLinkedCustom: () => knownLinked.size > 0 || cbClusterCopy.some(link => CBBridgeProtocol.localMember(link, cbDetectProgramId())) });
})(typeof self === "undefined" ? globalThis : self);
