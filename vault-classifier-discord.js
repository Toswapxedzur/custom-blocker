// Discord is server-scoped. It deliberately never reads a direct message:
// only an open /channels/<server>/<channel> route can produce a bounded local
// collection record, grouped by the numeric server identity.
(function (global) {
  "use strict";
  const core = global.VaultClassifierCollectorCore;
  if (!core) return;

  function route(location) {
    const match = String(location?.pathname || "").match(/^\/channels\/([0-9]{6,24})\/([0-9]{6,24})(?:\/([0-9]{6,24}))?\/?$/);
    return match ? { serverID: match[1], channelID: match[2], messageID: match[3] || null } : null;
  }

  function matchesPage(location) {
    return /(^|\.)discord(?:app)?\.com$/i.test(location?.hostname || "") && Boolean(route(location));
  }

  function serverName(document, serverID) {
    const server = document.querySelector(`[data-list-item-id="guildsnav___${serverID}"]`);
    return core.compactText(server?.getAttribute("aria-label"), 256)
      || core.compactText(server?.querySelector?.("img")?.getAttribute("alt"), 256)
      || `Discord server ${serverID}`;
  }

  function serverElement(document, serverID) {
    return document.querySelector(`[data-list-item-id="guildsnav___${serverID}"]`);
  }

  core.start({
    platform: "discord",
    matchesPage,
    scan({ document, collect }) {
      const activeRoute = route(global.location);
      if (!activeRoute) return;
      const messages = core.uniqueElements([
        ...core.selectorElements(document, 'li[id^="chat-messages-"]'),
        ...core.selectorElements(document, '[role="listitem"][id^="chat-messages-"]')
      ]).slice(0, 80);
      const server = serverElement(document, activeRoute.serverID);
      for (const message of messages) {
        const match = String(message.id || "").match(/^chat-messages-([0-9]{6,24})$/);
        const messageID = match?.[1];
        const title = core.firstText(message, ['[id^="message-content-"]', '[class*="markup"]', '[data-slate-editor="true"]']);
        if (!messageID || !title) continue;
        collect({
          presentationRoot: message,
          sourceKind: "server",
          sourceID: `discord:server:${activeRoute.serverID}`,
          sourceName: serverName(document, activeRoute.serverID),
          sourceURL: `https://discord.com/channels/${activeRoute.serverID}/${activeRoute.channelID}`,
          entryURL: `https://discord.com/channels/${activeRoute.serverID}/${activeRoute.channelID}/${messageID}`,
          title,
          text: title,
          sourceIconURL: core.sourceIconFromVerifiedSource("discord", server, global.location.href),
          entryType: "message"
        });
      }
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
