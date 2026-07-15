/* Shared, side-effect-free helpers for the web-app bridge protocol. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.CBBridgeProtocol = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PROTOCOL_VERSION = 2;
  var DESKTOP_PROGRAMS = ["macapp", "windowsapp"];
  var REMOTE_PROGRAMS = ["chrome", "edge", "firefox", "safari", "opera", "browser"];

  function normalizePairingKey(value) {
    var key = typeof value === "string" ? value.trim().toLowerCase() : "";
    return /^[0-9a-f]{64}$/.test(key) ? key : "";
  }

  function isDesktopProgram(program) {
    return DESKTOP_PROGRAMS.indexOf(String(program || "")) >= 0;
  }

  function isRemoteProgram(program) {
    return REMOTE_PROGRAMS.indexOf(String(program || "")) >= 0;
  }

  function nativeProgramId(value) {
    return isDesktopProgram(value) ? String(value) : "macapp";
  }

  function hubProgramFromStatus(status) {
    var program = status && status.hubProgram;
    return isDesktopProgram(program) ? program : "";
  }

  function localMember(cluster, program) {
    var members = cluster && Array.isArray(cluster.members) ? cluster.members : [];
    return members.find(function (member) {
      return member && member.program === program;
    }) || null;
  }

  // A member carrying a pinned group id must resolve by id or not at all. Name
  // fallback is only for pre-id-pinning cluster snapshots.
  function groupForCluster(groups, cluster, program) {
    var list = Array.isArray(groups) ? groups : [];
    var member = localMember(cluster, program);
    if (!member) return null;
    if (member.groupId) {
      return list.find(function (group) {
        return group && group.id === member.groupId;
      }) || null;
    }
    var name = member.groupName || (cluster && cluster.groupName) || "";
    return list.find(function (group) {
      return group && group.name === name;
    }) || null;
  }

  function clusterForGroup(clusters, group, program) {
    if (!group) return null;
    var list = Array.isArray(clusters) ? clusters : [];
    return list.find(function (cluster) {
      var member = localMember(cluster, program);
      if (!member) return false;
      return member.groupId ? member.groupId === group.id : member.groupName === group.name;
    }) || null;
  }

  return {
    PROTOCOL_VERSION: PROTOCOL_VERSION,
    DESKTOP_PROGRAMS: DESKTOP_PROGRAMS.slice(),
    REMOTE_PROGRAMS: REMOTE_PROGRAMS.slice(),
    normalizePairingKey: normalizePairingKey,
    isDesktopProgram: isDesktopProgram,
    isRemoteProgram: isRemoteProgram,
    nativeProgramId: nativeProgramId,
    hubProgramFromStatus: hubProgramFromStatus,
    localMember: localMember,
    groupForCluster: groupForCluster,
    clusterForGroup: clusterForGroup
  };
});
