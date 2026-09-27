/* Shared, side-effect-free helpers for the web-app bridge protocol. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (root) root.CBBridgeProtocol = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PROTOCOL_VERSION = 4;
  // A desktop Vault app owns the fixed local hub. Desktop identities can also
  // be the hub identity when they win the loopback listener.
  var DESKTOP_PROGRAMS = ["macapp", "windowsapp", "classifier"];
  var HUB_PROGRAMS = DESKTOP_PROGRAMS.slice();
  // The authenticated local hub is currently Chromium-only. Firefox and
  // Safari do not have this registered host bootstrap and therefore must not
  // fall back to an unauthenticated loopback identity.
  var REMOTE_PROGRAMS = ["chrome", "edge"];

  function isDesktopProgram(program) {
    return DESKTOP_PROGRAMS.indexOf(String(program || "")) >= 0;
  }

  function isHubProgram(program) {
    return HUB_PROGRAMS.indexOf(String(program || "")) >= 0;
  }

  function isRemoteProgram(program) {
    return REMOTE_PROGRAMS.indexOf(String(program || "")) >= 0;
  }

  function nativeProgramId(value) {
    return isDesktopProgram(value) ? String(value) : "macapp";
  }

  // The browser program a user agent names (the popup and the worker agree).
  function browserProgramId(userAgent) {
    var ua = String(userAgent || "");
    if (/\bEdg\//.test(ua)) return "edge";
    if (/\bFirefox\//.test(ua)) return "firefox";
    if (/\bOPR\//.test(ua) || /\bOpera\//.test(ua)) return "opera";
    if (/\bChrome\//.test(ua)) return "chrome";
    if (/\bSafari\//.test(ua)) return "safari";
    return "browser";
  }

  function hubProgramFromStatus(status) {
    var program = status && status.hubProgram;
    return isHubProgram(program) ? program : "";
  }

  function localMember(cluster, program) {
    var members = cluster && Array.isArray(cluster.members) ? cluster.members : [];
    return members.find(function (member) {
      return member && member.program === program;
    }) || null;
  }

  // A member resolves by its pinned group id or not at all.
  function groupForCluster(groups, cluster, program) {
    var list = Array.isArray(groups) ? groups : [];
    var member = localMember(cluster, program);
    if (!member) return null;
    // Links are by group id (made by the user), never by name.
    return list.find(function (group) {
      return group && member.groupId && group.id === member.groupId;
    }) || null;
  }

  function clusterForGroup(clusters, group, program) {
    if (!group) return null;
    var list = Array.isArray(clusters) ? clusters : [];
    return list.find(function (cluster) {
      var member = localMember(cluster, program);
      if (!member) return false;
      return Boolean(member.groupId) && member.groupId === group.id;
    }) || null;
  }

  return {
    PROTOCOL_VERSION: PROTOCOL_VERSION,
    DESKTOP_PROGRAMS: DESKTOP_PROGRAMS.slice(),
    HUB_PROGRAMS: HUB_PROGRAMS.slice(),
    REMOTE_PROGRAMS: REMOTE_PROGRAMS.slice(),
    isDesktopProgram: isDesktopProgram,
    isHubProgram: isHubProgram,
    isRemoteProgram: isRemoteProgram,
    nativeProgramId: nativeProgramId,
    browserProgramId: browserProgramId,
    hubProgramFromStatus: hubProgramFromStatus,
    localMember: localMember,
    groupForCluster: groupForCluster,
    clusterForGroup: clusterForGroup
  };
});
