/* Offscreen document — long-lived host for the event sandbox.
 *
 * The custom-rule event registry lives in event-sandbox.html (a sandboxed
 * page, so new Function() works there). This offscreen document keeps
 * that iframe alive across page navigations and tab switches and acts as
 * a relay between background.js and the sandbox iframe.
 */

const sandboxFrame = document.getElementById("eventSandbox");
const pendingReplies = new Map();
let nextRequestId = 1;
let sandboxReady = false;
const queuedToSandbox = [];

function postToSandbox(message) {
  if (!sandboxFrame || !sandboxFrame.contentWindow) {
    return;
  }
  if (!sandboxReady) {
    queuedToSandbox.push(message);
    return;
  }
  sandboxFrame.contentWindow.postMessage(message, "*");
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") {
    return;
  }
  if (data.source !== "custom-blocker-event-sandbox") {
    return;
  }

  if (data.type === "ready") {
    sandboxReady = true;
    while (queuedToSandbox.length > 0) {
      sandboxFrame.contentWindow.postMessage(queuedToSandbox.shift(), "*");
    }
    return;
  }

  if (data.type === "reply" && pendingReplies.has(data.id)) {
    const resolver = pendingReplies.get(data.id);
    pendingReplies.delete(data.id);
    resolver(data.result || null);
    return;
  }

  if (data.type === "intents") {
    // Forward any sandbox-originated intents (e.g. from a handler that
    // calls helpers.getDOMHelper().hide(...)) to background, which in
    // turn dispatches them to the right tab(s).
    chrome.runtime.sendMessage({
      type: "event-sandbox-intents",
      payload: data.payload
    }).catch(() => {});
    return;
  }

  if (data.type === "log") {
    chrome.runtime.sendMessage({
      type: "event-sandbox-log",
      payload: data.payload
    }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }
  if (message.type !== "event-sandbox-request") {
    return false;
  }

  const requestId = nextRequestId++;
  pendingReplies.set(requestId, (result) => sendResponse({ ok: true, result }));
  postToSandbox({
    source: "custom-blocker-offscreen",
    id: requestId,
    payload: message.payload
  });
  return true;
});

// Drive the shared 1 s tickEvent from this long-lived document. The
// service-worker alarm has a 1-minute floor, so we ping background here
// instead. Background then fans the tick out to every open tab.
setInterval(() => {
  chrome.runtime.sendMessage({ type: "offscreen-tick" }).catch(() => {});
}, 1000);
