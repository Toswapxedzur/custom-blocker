/* Shared-localhost-hub and bounded session-queue tests. */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const localStorage = { vaultClassifierSettings: {} };
const sessionStorage = {};
const listeners = [];
const storageListeners = [];
const hubRequests = [];
const diagnostics = [];
let hubAvailable = false;
let enabledPlatformIDs = ["youtube", "reddit", "discord"];

const hub = {
  request(operation, body) {
    if (!hubAvailable) return Promise.reject(new Error("hub unavailable"));
    hubRequests.push({ operation, body });
    return new Promise((resolve) => setTimeout(() => {
      if (operation === "collection-info") {
        resolve(inExtensionRealm({ enabledPlatformIDs }));
      } else if (operation === "collect") {
        resolve(inExtensionRealm({ accepted: true, inserted: true }));
      } else if (operation === "diagnostic") {
        resolve(inExtensionRealm({ accepted: true }));
      } else if (operation === "video-tags") {
        resolve(inExtensionRealm({
          platformID: body.platformID,
          entryID: body.entryID,
          feedAction: "dim",
          pageAction: "block",
          tags: [{
            id: "games",
            name: "Games",
            lightColorHex: "#9EC5E8",
            darkColorHex: "#1A4775"
          }]
        }));
      } else if (operation === "classifier-taxonomy") {
        const tag = (id, name) => ({ id, name, lightColorHex: "#9EC5E8", darkColorHex: "#1A4775" });
        resolve(inExtensionRealm({ platformID: body.platformID, types: [
          { typeID: "t1", name: "Topics", tags: [tag("a", "Gaming"), tag("b", "Science & Education")] },
          { typeID: "t2", name: "Mood", tags: [tag("c", "gaming"), tag("d", "Drama")] }
        ] }));
      } else {
        resolve(inExtensionRealm({ accepted: false, inserted: false }));
      }
    }, 5));
  }
};

function storageArea(values) {
  return {
    get(keys, callback) {
      const defaults = keys && typeof keys === "object" && !Array.isArray(keys) ? keys : {};
      const requested = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(defaults);
      const result = { ...defaults };
      for (const key of requested) {
        if (Object.prototype.hasOwnProperty.call(values, key)) result[key] = values[key];
      }
      callback(result);
    },
    set(next, callback) {
      Object.assign(values, JSON.parse(JSON.stringify(next)));
      callback?.();
    }
  };
}

const chrome = {
  runtime: {
    id: "vault-classifier-test-extension",
    lastError: null,
    getURL(resource) { return "chrome-extension://vault-classifier-test-extension/" + (resource || ""); },
    onMessage: { addListener(listener) { listeners.push(listener); } }
  },
  storage: {
    local: storageArea(localStorage),
    session: storageArea(sessionStorage),
    onChanged: { addListener(listener) { storageListeners.push(listener); } }
  }
};

const context = vm.createContext({
  console,
  chrome,
  TextEncoder,
  URL,
  setTimeout,
  clearTimeout,
  CBClassifierHub: hub,
  CBRecordVaultClassifierDiagnostic(entry) { diagnostics.push(entry); }
});
context.self = context;
context.globalThis = context;

function inExtensionRealm(value) {
  context.__hubResponse = JSON.stringify(value);
  return vm.runInContext("JSON.parse(__hubResponse)", context);
}

vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-contract.js"), "utf8"), context, { filename: "vault-classifier-contract.js" });
vm.runInContext(fs.readFileSync(path.join(root, "vault-classifier-bridge.js"), "utf8"), context, { filename: "vault-classifier-bridge.js" });

function dispatch(message, sender) {
  return new Promise((resolve, reject) => {
    let waiting = false;
    let settled = false;
    const timer = setTimeout(() => reject(new Error("bridge test message timed out")), 1_500);
    const respond = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ waiting, value });
    };
    const bridgedMessage = inExtensionRealm(message);
    const bridgedSender = inExtensionRealm(sender);
    for (const listener of listeners) {
      if (listener(bridgedMessage, bridgedSender, respond) === true) waiting = true;
    }
    if (!waiting) {
      settled = true;
      clearTimeout(timer);
      resolve({ waiting: false, value: undefined });
    }
  });
}

async function waitFor(predicate, timeoutMilliseconds = 1_500) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
}

function entry(id, title, extras = {}) {
  return {
    platform: "youtube",
    entryID: `youtube:video:${id}`,
    sourceID: "youtube:channel:UC1234567890123456789012",
    surface: extras.surface || "feed",
    evidence: {
      title,
      text: extras.text || null,
      suppliedTags: extras.suppliedTags || [],
      metadata: {
        sourceName: "Local test channel",
        ...(extras.sourceIconURL ? { sourceIconURL: extras.sourceIconURL } : {})
      }
    }
  };
}

function redditEntry(id, title) {
  return {
    platform: "reddit",
    entryID: `reddit:post:${id}`,
    sourceID: "reddit:subreddit:gaming",
    surface: "feed",
    evidence: {
      title,
      metadata: {
        sourceName: "r/gaming",
        sourceKind: "subreddit",
        entryType: "post",
        canonicalURL: `https://www.reddit.com/r/gaming/comments/${id}/post/`
      }
    }
  };
}

function discordEntry(id, title) {
  return {
    platform: "discord",
    entryID: `discord:message:${id}`,
    sourceID: "discord:server:123456",
    surface: "feed",
    evidence: {
      title,
      metadata: {
        sourceName: "Testing server",
        sourceKind: "server",
        entryType: "message",
        canonicalURL: `https://discord.com/channels/123456/234567/${id}`
      }
    }
  };
}

const trustedSender = { id: "vault-classifier-test-extension", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
const untrustedSender = { id: "vault-classifier-test-extension", url: "https://youtube.com.evil/watch?v=dQw4w9WgXcQ" };
const trustedRedditSender = { id: "vault-classifier-test-extension", url: "https://www.reddit.com/r/gaming/" };
const trustedDiscordSender = { id: "vault-classifier-test-extension", url: "https://discord.com/channels/123456/234567" };
const directMessageDiscordSender = { id: "vault-classifier-test-extension", url: "https://discord.com/channels/@me/234567" };
let failures = 0;

function assert(name, condition, detail) {
  if (condition) console.log(`PASS ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  }
}

(async () => {
  const untrustedCollection = await dispatch({
    type: "vault-classifier-collect",
    entry: entry("dQw4w9WgXcQ", "Untrusted collection")
  }, untrustedSender);
  assert("rejects collection from a non-YouTube runtime sender", !untrustedCollection.waiting && hubRequests.length === 0);

  hubAvailable = true;
  const collectionInfo = await dispatch({ type: "vault-classifier-collection-info" }, trustedSender);
  assert("browser collection defaults on when the app enables YouTube", collectionInfo.waiting && collectionInfo.value?.ok === true && collectionInfo.value.enabled === true, collectionInfo);

  hubAvailable = false;
  const queuedInitial = await dispatch({
    type: "vault-classifier-collect",
    entry: entry("dQw4w9WgXcQ", "Visible non-ad card")
  }, trustedSender);
  const queuedEnriched = await dispatch({
    type: "vault-classifier-collect",
    entry: entry("dQw4w9WgXcQ", "Visible non-ad card", {
      surface: "page",
      text: "Full rendered description",
      suppliedTags: ["guide"],
      sourceIconURL: "https://yt3.ggpht.com/source-icon=s88"
    })
  }, trustedSender);
  const offlineStatus = await context.CBVaultClassifierCollectionQueueStatus();
  assert("queues authorized rendered evidence in session storage while disconnected", queuedInitial.value?.accepted === true
    && queuedInitial.value?.queued === true
    && queuedEnriched.value?.accepted === true
    && offlineStatus.pendingCount === 1
    && Object.keys(sessionStorage).length === 1, { queuedInitial, queuedEnriched, offlineStatus, sessionStorage });

  hubAvailable = true;
  await context.CBFlushVaultClassifierCollectionQueue();
  const flushedRequest = hubRequests.filter((request) => request.operation === "collect").at(-1);
  const flushedStatus = await context.CBVaultClassifierCollectionQueueStatus();
  assert("flushes oldest-first with merged evidence and preserved observations only after acknowledgement", flushedRequest?.body?.entry?.surface === "page"
    && flushedRequest?.body?.entry?.evidence?.text === "Full rendered description"
    && flushedRequest?.body?.entry?.evidence?.metadata?.sourceIconURL === "https://yt3.ggpht.com/source-icon=s88"
    && flushedRequest?.body?.observationCount === 2
    && flushedRequest?.body?.firstObservedAtMilliseconds <= flushedRequest?.body?.lastObservedAtMilliseconds
    && flushedStatus.pendingCount === 0, { flushedRequest, flushedStatus });

  const videoTags = await dispatch({
    type: "vault-classifier-video-tags",
    platform: "youtube",
    entryID: "youtube:video:abc123",
    creatorID: "youtube:channel:UC1234567890123456789012",
    title: "A classified video"
  }, trustedSender);
  assert("routes a bounded per-video lookup and returns human-readable tags", videoTags.value?.ok === true
    && videoTags.value?.tags?.[0]?.name === "Games"
    && videoTags.value?.tags?.[0]?.lightColorHex === "#9EC5E8"
    && videoTags.value?.tags?.[0]?.darkColorHex === "#1A4775", videoTags);
  // The classifier is a pure tagging service: content-block policy lives in the
  // extension. A stale app that still sends a verdict must not leak through.
  assert("drops any classifier-sent feedAction/pageAction at the bridge",
    videoTags.value?.feedAction === undefined && videoTags.value?.pageAction === undefined, videoTags);
  // Tag-name suggestions for the popup's tag-filter editor: read-only, answered
  // ONLY to this extension's own pages (no tab, our origin), de-duplicated.
  const ownPage = { id: "vault-classifier-test-extension", url: "chrome-extension://vault-classifier-test-extension/popup.html" };
  const tagNames = await dispatch({ type: "vault-classifier-tag-names", platform: "youtube" }, ownPage);
  assert("serves de-duplicated classifier tag names to the extension's own popup",
    tagNames.value?.ok === true && JSON.stringify(tagNames.value?.names) === JSON.stringify(["Gaming", "Science & Education", "Drama"]), tagNames);
  const fromContentScript = await dispatch({ type: "vault-classifier-tag-names", platform: "youtube" }, trustedSender);
  // The editor opened as a full TAB is still our own page and must be served.
  const fromTabbedOwnPage = await dispatch({ type: "vault-classifier-tag-names", platform: "youtube" }, { ...ownPage, tab: { id: 1 } });
  // A content script: our extension id and a tab, but its sender.url is the WEB page.
  const fromContentScriptInTab = await dispatch({ type: "vault-classifier-tag-names", platform: "youtube" }, { ...trustedSender, tab: { id: 2 } });
  const fromOtherExtension = await dispatch({ type: "vault-classifier-tag-names", platform: "youtube" }, { id: "someone-else", url: ownPage.url });
  assert("serves the editor when it is opened as a full tab", fromTabbedOwnPage.value?.ok === true && fromTabbedOwnPage.value?.names?.length === 3, fromTabbedOwnPage);
  assert("refuses tag names to content scripts (with or without a tab) and to other extensions",
    fromContentScript.waiting === false && fromContentScriptInTab.waiting === false && fromOtherExtension.waiting === false,
    { fromContentScript, fromContentScriptInTab, fromOtherExtension });
  // No cover URL ever reaches the hub (thumbnail OCR evidence was removed
  // 2026-09-22), whatever host it names and even if a page still supplies one.
  const trustedThumb = await dispatch({
    type: "vault-classifier-video-tags", platform: "youtube", entryID: "youtube:video:thumb1",
    creatorID: "youtube:channel:UC1234567890123456789012", title: "With cover",
    thumbnailURL: "https://i.ytimg.com/vi/thumb1/hqdefault.jpg"
  }, trustedSender);
  const trustedThumbRequest = hubRequests.filter((request) => request.operation === "video-tags").at(-1);
  assert("never forwards a thumbnailURL to the hub, even from the platform's own image host",
    trustedThumb.value?.ok === true && trustedThumbRequest?.body?.entryID === "youtube:video:thumb1" && trustedThumbRequest?.body?.thumbnailURL === undefined, trustedThumbRequest);
  await dispatch({
    type: "vault-classifier-video-tags", platform: "youtube", entryID: "youtube:video:thumb2",
    creatorID: "youtube:channel:UC1234567890123456789012", title: "Evil cover",
    thumbnailURL: "https://evil.example/i.ytimg.com/hqdefault.jpg"
  }, trustedSender);
  const untrustedThumbRequest = hubRequests.filter((request) => request.operation === "video-tags").at(-1);
  assert("never forwards a thumbnailURL from an untrusted host either",
    untrustedThumbRequest?.body?.entryID === "youtube:video:thumb2" && untrustedThumbRequest?.body?.thumbnailURL === undefined, untrustedThumbRequest);
  const forgedVideoTags = await dispatch({
    type: "vault-classifier-video-tags",
    platform: "reddit",
    entryID: "reddit:post:abc123",
    creatorID: "reddit:subreddit:games",
    title: "Forged platform"
  }, trustedSender);
  assert("rejects a video-tag platform that does not match the sender origin", !forgedVideoTags.waiting, forgedVideoTags);

  const diagnostic = await dispatch({
    type: "vault-classifier-diagnostic",
    platform: "youtube",
    event: "collector-started"
  }, trustedSender);
  assert("forwards fixed diagnostics without page metadata", diagnostic.value?.accepted === true
    && diagnostics.some((item) => item.event === "collector-started" && item.platform === "youtube"), { diagnostic, diagnostics });
  const forgedDiagnostic = await dispatch({
    type: "vault-classifier-diagnostic",
    platform: "youtube",
    event: "raw-page-title"
  }, trustedSender);
  assert("rejects diagnostic text outside the fixed privacy-safe vocabulary", !forgedDiagnostic.waiting, forgedDiagnostic);

  const redditCollectionInfo = await dispatch({
    type: "vault-classifier-collection-info",
    platform: "reddit"
  }, trustedRedditSender);
  const redditCollected = await dispatch({
    type: "vault-classifier-collect",
    entry: redditEntry("123", "Visible Reddit card")
  }, trustedRedditSender);
  assert("gives subreddit-scoped collection the same queue lifecycle", redditCollectionInfo.value?.enabled === true
    && redditCollected.value?.accepted === true
    && redditCollected.value?.queued === true, { redditCollectionInfo, redditCollected });

  const mismatchedCollection = await dispatch({
    type: "vault-classifier-collect",
    entry: redditEntry("124", "Forged platform")
  }, trustedSender);
  assert("rejects a collection platform that does not match the sender origin", !mismatchedCollection.waiting, mismatchedCollection);

  const discordCollectionInfo = await dispatch({
    type: "vault-classifier-collection-info",
    platform: "discord"
  }, trustedDiscordSender);
  const discordCollected = await dispatch({
    type: "vault-classifier-collect",
    entry: discordEntry("345678", "Visible server message")
  }, trustedDiscordSender);
  const directMessageCollection = await dispatch({
    type: "vault-classifier-collection-info",
    platform: "discord"
  }, directMessageDiscordSender);
  assert("enables server collection but rejects direct-message Discord routes", discordCollectionInfo.value?.enabled === true
    && discordCollected.value?.accepted === true
    && !directMessageCollection.waiting, { discordCollectionInfo, discordCollected, directMessageCollection });

  hubAvailable = false;
  await dispatch({
    type: "vault-classifier-collect",
    entry: entry("offline00001", "Queued before platform disable")
  }, trustedSender);
  enabledPlatformIDs = ["reddit", "discord"];
  hubAvailable = true;
  await context.CBFlushVaultClassifierCollectionQueue();
  const disabledStatus = await context.CBVaultClassifierCollectionQueueStatus();
  assert("drops queued evidence when the app no longer enables its platform and exposes the drop count", disabledStatus.pendingCount === 0
    && disabledStatus.droppedCount >= 1
    && diagnostics.some((item) => item.event === "collection-dropped" && item.outcome === "disabled"), { disabledStatus, diagnostics });

  localStorage.vaultClassifierSettings = { collectionEnabled: false };
  storageListeners.forEach((listener) => listener({
    vaultClassifierSettings: { newValue: localStorage.vaultClassifierSettings }
  }, "local"));
  const collectionDisabled = await dispatch({ type: "vault-classifier-collection-info" }, trustedSender);
  const tagsDisabled = await dispatch({
    type: "vault-classifier-video-tags",
    platform: "youtube",
    entryID: "youtube:video:disabled",
    creatorID: "youtube:channel:UC1234567890123456789012",
    title: "Collection disabled"
  }, trustedSender);
  await waitFor(async () => (await context.CBVaultClassifierCollectionQueueStatus()).pendingCount === 0);
  assert("browser-side collection opt-out clears queued data and prevents routing", collectionDisabled.value?.ok === true
    && collectionDisabled.value?.enabled === false
    && tagsDisabled.value?.ok === true
    && tagsDisabled.value?.tags?.length === 0
    && tagsDisabled.value?.pending === false, { collectionDisabled, tagsDisabled });

  // Tagging schedule: tagging can be off while collection stays on.
  localStorage.vaultClassifierSettings = { collectionEnabled: true, taggingMode: "paused" };
  storageListeners.forEach((listener) => listener({ vaultClassifierSettings: { newValue: localStorage.vaultClassifierSettings } }, "local"));
  enabledPlatformIDs = ["youtube", "reddit", "discord"];
  const pausedInfo = await dispatch({ type: "vault-classifier-collection-info", platform: "youtube" }, trustedSender);
  const pausedTags = await dispatch({
    type: "vault-classifier-video-tags", platform: "youtube", entryID: "youtube:video:paused",
    creatorID: "youtube:channel:UC1234567890123456789012", title: "Paused"
  }, trustedSender);
  assert("paused tagging keeps collection on but sends nothing for tags", pausedInfo.value?.enabled === true
    && pausedInfo.value?.tagging === false && pausedTags.value?.ok === true && pausedTags.value?.tags?.length === 0, { pausedInfo, pausedTags });

  localStorage.vaultClassifierSettings = { collectionEnabled: true, taggingMode: "whenFiltering" };
  context.cbHasActiveTagFilter = async (platform) => platform === "reddit";
  const ytInfo = await dispatch({ type: "vault-classifier-collection-info", platform: "youtube" }, trustedSender);
  const redditInfo = await dispatch({ type: "vault-classifier-collection-info", platform: "reddit" }, trustedRedditSender);
  assert("whenFiltering follows the background's active-tag-filter answer per platform",
    ytInfo.value?.enabled === true && ytInfo.value?.tagging === false && redditInfo.value?.tagging === true, { ytInfo, redditInfo });

  localStorage.vaultClassifierSettings = { collectionEnabled: true, taggingMode: "always" };
  const alwaysInfo = await dispatch({ type: "vault-classifier-collection-info", platform: "youtube" }, trustedSender);
  delete context.cbHasActiveTagFilter;
  localStorage.vaultClassifierSettings = { collectionEnabled: true };
  const defaultInfo = await dispatch({ type: "vault-classifier-collection-info", platform: "youtube" }, trustedSender);
  assert("always ignores the schedule; without the background hook tagging follows collection",
    alwaysInfo.value?.tagging === true && defaultInfo.value?.tagging === true, { alwaysInfo, defaultInfo });

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
