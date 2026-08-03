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
      } else if (operation === "source-tags") {
        resolve(inExtensionRealm({
          platformID: body.platformID,
          sourceID: body.sourceID,
          tags: [{
            id: "games",
            name: "Games",
            lightColorHex: "#9EC5E8",
            darkColorHex: "#1A4775"
          }]
        }));
      } else if (operation === "source-tags-batch") {
        resolve(inExtensionRealm({
          platformID: body.platformID,
          results: (body.items || []).map((item) => ({
            sourceID: item.sourceID,
            tags: [{ id: "games", name: "Games", lightColorHex: "#9EC5E8", darkColorHex: "#1A4775" }]
          }))
        }));
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

  const sourceTags = await dispatch({
    type: "vault-classifier-source-tags",
    platform: "youtube",
    sourceID: "youtube:channel:UC1234567890123456789012"
  }, trustedSender);
  assert("routes a bounded source-tag lookup and returns human-readable tags", sourceTags.value?.ok === true
    && sourceTags.value?.tags?.[0]?.name === "Games"
    && sourceTags.value?.tags?.[0]?.lightColorHex === "#9EC5E8"
    && sourceTags.value?.tags?.[0]?.darkColorHex === "#1A4775", sourceTags);
  const forgedSourceTags = await dispatch({
    type: "vault-classifier-source-tags",
    platform: "reddit",
    sourceID: "reddit:subreddit:games"
  }, trustedSender);
  assert("rejects a source-tag platform that does not match the sender origin", !forgedSourceTags.waiting, forgedSourceTags);

  const sourceTagsBatch = await dispatch({
    type: "vault-classifier-source-tags-batch",
    platform: "youtube",
    items: [{ sourceID: "youtube:channel:UC1234567890123456789012" }, { sourceID: "youtube:handle:@another" }]
  }, trustedSender);
  assert("routes a batched source-tag lookup and returns per-source tags", sourceTagsBatch.value?.ok === true
    && Array.isArray(sourceTagsBatch.value?.results)
    && sourceTagsBatch.value.results.length === 2
    && sourceTagsBatch.value.results[0]?.sourceID === "youtube:channel:UC1234567890123456789012"
    && sourceTagsBatch.value.results[0]?.tags?.[0]?.name === "Games", sourceTagsBatch);
  const forgedSourceTagsBatch = await dispatch({
    type: "vault-classifier-source-tags-batch",
    platform: "reddit",
    items: [{ sourceID: "reddit:subreddit:games" }]
  }, trustedSender);
  assert("rejects a batched lookup whose platform does not match the sender origin", !forgedSourceTagsBatch.waiting, forgedSourceTagsBatch);

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

  const removedPolicyBridge = await dispatch({
    type: "vault-classifier-classify",
    entry: entry("dQw4w9WgXcQ", "No browser policy")
  }, trustedSender);
  assert("does not expose browser-side classifier policy actions", !removedPolicyBridge.waiting, removedPolicyBridge);

  localStorage.vaultClassifierSettings = { collectionEnabled: false };
  storageListeners.forEach((listener) => listener({
    vaultClassifierSettings: { newValue: localStorage.vaultClassifierSettings }
  }, "local"));
  const collectionDisabled = await dispatch({ type: "vault-classifier-collection-info" }, trustedSender);
  const tagsDisabled = await dispatch({
    type: "vault-classifier-source-tags",
    platform: "youtube",
    sourceID: "youtube:channel:UC1234567890123456789012"
  }, trustedSender);
  await waitFor(async () => (await context.CBVaultClassifierCollectionQueueStatus()).pendingCount === 0);
  assert("browser-side collection opt-out clears queued data and prevents routing", collectionDisabled.value?.ok === true
    && collectionDisabled.value?.enabled === false
    && tagsDisabled.value?.ok === true
    && tagsDisabled.value?.tags?.length === 0, { collectionDisabled, tagsDisabled });

  console.log(`__CB_TEST_RESULT__: ${failures === 0 ? "OK" : "FAIL"} (${failures} failures)`);
  if (failures !== 0) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  console.log("__CB_TEST_RESULT__: FAIL (runner error)");
  process.exitCode = 1;
});
