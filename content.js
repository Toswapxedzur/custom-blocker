/* Custom Web Blocker — content script.
 *
 * Responsibilities (per page):
 *   - Heartbeat the background service worker so it can attribute usage
 *     time to site/timed groups.
 *   - Render the in-page timer overlay.
 *   - Apply feed-card filtering for legacy platform/Reddit groups
 *     (driven by `feedFilters` in the session payload).
 *   - Compile and run all enabled custom rules (which now live in the
 *     content script, not the background worker), using the helpers from
 *     helpers.js. Side effects:
 *       * mutate per-group timer / persistence buckets in memory and
 *         flush them back to the background on the next heartbeat,
 *       * register platform "intents" that this script then applies to
 *         the DOM (hide buttons, hide feed cards by predicate, page-level
 *         exit when blockPageOnVisit is true),
 *       * a rule returning `true` exits the page.
 *   - Exit the page when the background says so OR when any custom rule
 *     says so.
 */

const helperBundle = self.__customBlockerHelpers;

const PLATFORM_LIST = helperBundle?.PLATFORM_LIST ?? [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
  "twitch"
];

function normalizeHostname(hostname) {
  const trimmed = String(hostname ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith("www.") ? trimmed.slice(4) : trimmed;
}

function normalizeYouTubeCreatorInput(value) {
  let trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      trimmed = new URL(trimmed).pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("/@")) return trimmed.slice(2).split("/")[0] || null;
  if (trimmed.startsWith("@")) return trimmed.slice(1) || null;
  const pathLike = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const channelMatch = pathLike.match(/^channel\/([^/?#]+)/);
  const customMatch = pathLike.match(/^c\/([^/?#]+)/);
  const userMatch = pathLike.match(/^user\/([^/?#]+)/);
  if (channelMatch) return `channel:${channelMatch[1]}`;
  if (customMatch) return `c:${customMatch[1]}`;
  if (userMatch) return `user:${userMatch[1]}`;
  if (/^(channel|c|user):[a-z0-9._-]+$/i.test(pathLike)) return pathLike;
  return /^[a-z0-9._-]+$/i.test(pathLike) ? pathLike : null;
}

function normalizePlatformAuthorInput(value, groupType) {
  if (groupType === "youtube") return normalizeYouTubeCreatorInput(value);

  let trimmed = String(value ?? "").trim().toLowerCase();
  const extractFromPath = (pathLike) => {
    const path = String(pathLike || "").replace(/^\/+|\/+$/g, "");
    const first = path.split("/")[0] || "";

    if (groupType === "tiktok") {
      return first.startsWith("@")
        ? first.slice(1) || null
        : /^[a-z0-9._-]+$/i.test(first)
          ? first
          : null;
    }
    if (groupType === "instagram") {
      const reserved = new Set(["reel", "p", "tv", "explore", "accounts", "about"]);
      return !reserved.has(first) && /^[a-z0-9._]+$/i.test(first) ? first : null;
    }
    if (groupType === "facebook") {
      if (path.startsWith("profile.php")) return null;
      const reserved = new Set(["watch", "reel", "groups", "marketplace", "gaming", "video", "videos"]);
      return !reserved.has(first) && /^[a-z0-9.]+$/i.test(first) ? first : null;
    }
    if (groupType === "twitch") {
      const reserved = new Set([
        "directory", "videos", "settings", "downloads", "subscriptions",
        "search", "jobs", "drops", "inventory"
      ]);
      return !reserved.has(first) && /^[a-z0-9_]+$/i.test(first) ? first : null;
    }
    return null;
  };

  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
      if (groupType === "facebook" && path.startsWith("profile.php")) {
        const id = parsed.searchParams.get("id");
        return id ? `id:${id}` : null;
      }
      return extractFromPath(path);
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("/")) return extractFromPath(trimmed);
  trimmed = trimmed.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  if (groupType === "facebook" && trimmed.startsWith("id:")) return trimmed;
  return /^[a-z0-9._-]+$/i.test(trimmed) ? trimmed : null;
}

function normalizeRedditSubredditInput(value) {
  let trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      trimmed = new URL(trimmed).pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }
  trimmed = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  if (trimmed.startsWith("r/")) trimmed = trimmed.slice(2);
  return /^[a-z0-9_]+$/i.test(trimmed) ? trimmed : null;
}

function normalizeDiscordTargetInput(value, targetType = "server") {
  const normalizedTargetType = targetType === "channel" ? "channel" : "server";
  let trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      trimmed = new URL(trimmed).pathname.trim().toLowerCase();
    } catch {
      return null;
    }
  }
  trimmed = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  const channelsMatch = trimmed.match(/^channels\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (channelsMatch) {
    trimmed = normalizedTargetType === "channel" ? channelsMatch[2] ?? "" : channelsMatch[1];
  }
  if (trimmed === "@me") return null;
  return /^[0-9]{6,24}$/.test(trimmed) ? trimmed : null;
}

function isYouTubeHost(hostname) {
  return Boolean(
    hostname && (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be")
  );
}

function isRedditHost(hostname) {
  return Boolean(hostname && (hostname === "reddit.com" || hostname.endsWith(".reddit.com")));
}

function isDiscordHost(hostname) {
  return Boolean(
    hostname &&
      (hostname === "discord.com" ||
        hostname.endsWith(".discord.com") ||
        hostname === "discordapp.com" ||
        hostname.endsWith(".discordapp.com"))
  );
}

function parseRedditSubredditFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/r\/([^/?#]+)/);
  return match ? normalizeRedditSubredditInput(match[1]) : null;
}

function parseDiscordServerIdFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/channels\/([^/?#]+)/);
  if (!match || match[1] === "@me") return null;
  return normalizeDiscordTargetInput(match[1], "server");
}

function parseDiscordChannelIdFromPath(pathname) {
  const match = String(pathname ?? "").toLowerCase().match(/^\/channels\/([^/?#]+)\/([^/?#]+)/);
  if (!match || match[1] === "@me") return null;
  return normalizeDiscordTargetInput(match[2], "channel");
}

function detectVideoSiteContext(hostname, pathname) {
  const safePathname = String(pathname ?? "/");

  if (isYouTubeHost(hostname)) {
    if (safePathname.startsWith("/shorts/")) return { site: "youtube", form: "short" };
    if (
      safePathname.startsWith("/post/") ||
      /^\/(channel|c|user)\/[^/]+\/(community|posts)/.test(safePathname) ||
      /^\/@[^/]+\/(community|posts)/.test(safePathname)
    ) {
      return { site: "youtube", form: "post" };
    }
    if (
      hostname === "youtu.be" ||
      safePathname.startsWith("/watch") ||
      safePathname.startsWith("/live/") ||
      safePathname.startsWith("/embed/")
    ) {
      return { site: "youtube", form: "long" };
    }
    return { site: "youtube", form: "unknown" };
  }
  if (hostname === "tiktok.com" || hostname?.endsWith(".tiktok.com")) {
    if (safePathname.includes("/video/")) return { site: "tiktok", form: "short" };
    return { site: "tiktok", form: "unknown" };
  }
  if (hostname === "instagram.com" || hostname?.endsWith(".instagram.com")) {
    if (safePathname.startsWith("/reel/")) return { site: "instagram", form: "short" };
    if (safePathname.startsWith("/p/")) return { site: "instagram", form: "post" };
    if (safePathname.startsWith("/tv/")) return { site: "instagram", form: "long" };
    return { site: "instagram", form: "unknown" };
  }
  if (hostname === "facebook.com" || hostname?.endsWith(".facebook.com")) {
    if (safePathname.startsWith("/reel/") || safePathname.startsWith("/watch/reel/")) {
      return { site: "facebook", form: "short" };
    }
    if (safePathname.startsWith("/watch")) return { site: "facebook", form: "long" };
    if (safePathname.includes("/posts/") || safePathname.includes("/permalink/")) {
      return { site: "facebook", form: "post" };
    }
    return { site: "facebook", form: "unknown" };
  }
  if (hostname === "vimeo.com" || hostname?.endsWith(".vimeo.com")) {
    return /^\/\d+/.test(safePathname)
      ? { site: "vimeo", form: "long" }
      : { site: "vimeo", form: "unknown" };
  }
  if (hostname === "dailymotion.com" || hostname?.endsWith(".dailymotion.com") || hostname === "dai.ly") {
    return safePathname.includes("/video/") || hostname === "dai.ly"
      ? { site: "dailymotion", form: "long" }
      : { site: "dailymotion", form: "unknown" };
  }
  if (hostname === "clips.twitch.tv" || safePathname.includes("/clip/")) {
    return { site: "twitch", form: "short" };
  }
  if (hostname === "twitch.tv" || hostname?.endsWith(".twitch.tv")) {
    return safePathname.startsWith("/videos/")
      ? { site: "twitch", form: "long" }
      : { site: "twitch", form: "unknown" };
  }
  return { site: null, form: "unknown" };
}

function formatOverlayDurationMs(totalMs) {
  const totalSeconds = Math.max(0, Math.ceil(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function mountOverlay() {
  const container = document.createElement("div");
  container.id = "custom-web-blocker-timer";
  container.style.position = "fixed";
  container.style.top = "12px";
  container.style.left = "12px";
  container.style.zIndex = "2147483647";
  container.style.padding = "8px 10px";
  container.style.borderRadius = "10px";
  container.style.background = "rgba(15, 23, 42, 0.86)";
  container.style.color = "#f8fafc";
  container.style.fontFamily = "SFMono-Regular, Consolas, monospace";
  container.style.fontSize = "13px";
  container.style.lineHeight = "1.35";
  container.style.whiteSpace = "pre";
  container.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.28)";
  container.style.pointerEvents = "none";
  container.textContent = "00:00";
  document.documentElement.appendChild(container);
  return { container };
}

// ────────────────────────────────────────────────────────────────────────
// Debug overlay. Always-on for any page that has at least one custom rule
// in scope, so the user can see exactly which rules ran, what source the
// content script is using, and what each rule returned. Clicking the X
// dismisses it for the rest of this page session (gone until reload).
// ────────────────────────────────────────────────────────────────────────

function mountDebugOverlay() {
  const container = document.createElement("div");
  container.id = "custom-web-blocker-debug";
  Object.assign(container.style, {
    position: "fixed",
    bottom: "12px",
    right: "12px",
    zIndex: "2147483647",
    width: "min(520px, 45vw)",
    maxHeight: "60vh",
    display: "flex",
    flexDirection: "column",
    background: "rgba(15, 23, 42, 0.92)",
    color: "#f8fafc",
    fontFamily: "SFMono-Regular, Consolas, monospace",
    fontSize: "12px",
    lineHeight: "1.4",
    borderRadius: "10px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.28)",
    border: "1px solid rgba(148, 163, 184, 0.25)"
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 10px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.25)",
    background: "rgba(30, 41, 59, 0.6)",
    borderTopLeftRadius: "10px",
    borderTopRightRadius: "10px"
  });

  const title = document.createElement("span");
  title.textContent = "Custom Blocker — rule debug";
  title.style.fontWeight = "600";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u00d7";
  Object.assign(closeBtn.style, {
    background: "transparent",
    color: "#f8fafc",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    lineHeight: "1",
    padding: "0 4px"
  });
  closeBtn.addEventListener("click", () => {
    debugOverlayDismissed = true;
    removeDebugOverlay();
  });

  header.appendChild(title);
  header.appendChild(closeBtn);

  const body = document.createElement("div");
  Object.assign(body.style, {
    padding: "8px 10px",
    overflowY: "auto",
    flex: "1 1 auto"
  });

  container.appendChild(header);
  container.appendChild(body);
  document.documentElement.appendChild(container);
  return { container, body };
}

function removeDebugOverlay() {
  if (debugOverlay?.container?.isConnected) debugOverlay.container.remove();
  debugOverlay = null;
  lastDebugRenderKey = "";
}

function makeResultBadge(entry) {
  const span = document.createElement("span");
  span.style.marginLeft = "8px";
  span.style.fontWeight = "600";
  if (entry.error) {
    span.textContent = "ERROR: " + entry.error;
    span.style.color = "#fca5a5";
  } else if (entry.result === undefined) {
    span.textContent = "\u2192 undefined";
    span.style.color = "#fde68a";
  } else if (entry.result === -1) {
    span.textContent = "\u2192 -1 (block)";
    span.style.color = "#fca5a5";
  } else if (entry.result === 0) {
    span.textContent = "\u2192 0 (continue)";
    span.style.color = "#86efac";
  } else if (entry.result === 1) {
    span.textContent = "\u2192 1 (allow)";
    span.style.color = "#93c5fd";
  } else {
    let text;
    try { text = JSON.stringify(entry.result); }
    catch { text = String(entry.result); }
    span.textContent = "\u2192 " + (text === undefined ? String(entry.result) : text);
    span.style.color = typeof entry.result === "number" ? "#c4b5fd" : "#fde68a";
  }
  return span;
}

function summarizeIntents(intentsState) {
  if (!intentsState || typeof intentsState !== "object") return [];
  const lines = [];
  for (const platform of Object.keys(intentsState)) {
    const ps = intentsState[platform];
    if (!ps) continue;
    const parts = [];
    if (ps.shortButton) parts.push("shortButton=" + ps.shortButton);
    if (ps.homePage) parts.push("homePage=" + ps.homePage);
    if (Array.isArray(ps.shortsPredicates) && ps.shortsPredicates.length > 0) {
      parts.push("shortsPredicates=" + ps.shortsPredicates.length);
    }
    if (Array.isArray(ps.videosPredicates) && ps.videosPredicates.length > 0) {
      parts.push("videosPredicates=" + ps.videosPredicates.length);
    }
    if (Array.isArray(ps.postsPredicates) && ps.postsPredicates.length > 0) {
      parts.push("postsPredicates=" + ps.postsPredicates.length);
    }
    if (parts.length > 0) lines.push(platform + ": " + parts.join(", "));
  }
  return lines;
}

function updateDebugOverlay(ruleResults, intentsState) {
  if (debugOverlayDismissed) return;
  if (!Array.isArray(ruleResults) || ruleResults.length === 0) {
    if (debugOverlay) removeDebugOverlay();
    return;
  }

  const intentLines = summarizeIntents(intentsState);

  // Skip re-render when nothing actually changed. Heartbeats fire every
  // ~250 ms; tearing down the DOM that often is wasteful and looks janky
  // when the user tries to scroll.
  const renderKey = JSON.stringify({
    rules: ruleResults.map((r) => ({
      g: r.groupId,
      n: r.name,
      s: r.source,
      r: r.error ? null : r.result === undefined ? "__undef__" : r.result,
      e: r.error || null
    })),
    intents: intentLines
  });
  if (debugOverlay && renderKey === lastDebugRenderKey) return;
  lastDebugRenderKey = renderKey;

  if (!debugOverlay) debugOverlay = mountDebugOverlay();
  const body = debugOverlay.body;
  while (body.firstChild) body.removeChild(body.firstChild);

  for (const entry of ruleResults) {
    const card = document.createElement("div");
    Object.assign(card.style, {
      padding: "6px 8px",
      marginBottom: "8px",
      background: "rgba(30, 41, 59, 0.55)",
      border: "1px solid rgba(148, 163, 184, 0.18)",
      borderRadius: "6px"
    });

    const head = document.createElement("div");
    Object.assign(head.style, {
      display: "flex",
      alignItems: "baseline",
      flexWrap: "wrap",
      marginBottom: "4px"
    });
    const groupName = document.createElement("span");
    groupName.textContent = entry.name || entry.groupId;
    groupName.style.fontWeight = "600";
    head.appendChild(groupName);
    head.appendChild(makeResultBadge(entry));

    const code = document.createElement("pre");
    Object.assign(code.style, {
      margin: "0",
      padding: "6px 8px",
      background: "rgba(2, 6, 23, 0.55)",
      borderRadius: "4px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      maxHeight: "30vh",
      overflowY: "auto"
    });
    code.textContent = entry.source || "";

    card.appendChild(head);
    card.appendChild(code);
    body.appendChild(card);
  }

  // Aggregate intents across all rules in this heartbeat. Lets the user
  // verify that calls like helpers.getPlatformHelper().youtube()
  // .hideShortButton() actually registered, even when the rule body
  // returned false and the page wasn't blocked.
  if (intentLines.length > 0) {
    const intentsCard = document.createElement("div");
    Object.assign(intentsCard.style, {
      padding: "6px 8px",
      marginTop: "4px",
      background: "rgba(30, 41, 59, 0.55)",
      border: "1px solid rgba(148, 163, 184, 0.18)",
      borderRadius: "6px"
    });
    const intentsTitle = document.createElement("div");
    intentsTitle.textContent = "Active platform intents (this heartbeat)";
    intentsTitle.style.cssText = "font-weight:600;margin-bottom:4px;color:#cbd5f5;";
    intentsCard.appendChild(intentsTitle);
    const intentsPre = document.createElement("pre");
    Object.assign(intentsPre.style, {
      margin: "0",
      padding: "6px 8px",
      background: "rgba(2, 6, 23, 0.55)",
      borderRadius: "4px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      color: "#a5b4fc"
    });
    intentsPre.textContent = intentLines.join("\n");
    intentsCard.appendChild(intentsPre);
    body.appendChild(intentsCard);
  }
}

const DAY_NAMES = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
];

function getDayNameForDate(date) {
  const day = date.getDay();
  return DAY_NAMES[(day + 6) % 7];
}

function formatDayName(name) {
  return String(name).slice(0, 1).toUpperCase() + String(name).slice(1);
}

// ────────────────────────────────────────────────────────────────────────
// Module state.
// ────────────────────────────────────────────────────────────────────────

let overlay = null;
let debugOverlay = null;
let debugOverlayDismissed = false;
let lastDebugRenderKey = "";
let exitAttempted = false;
let heartbeatIntervalId = null;
let navigationPollIntervalId = null;
let lastHeartbeatAt = Date.now();
let lastKnownUrl = location.href;
let lastSessionRefreshAt = 0;
let refreshDebounceTimeoutId = null;
let feedObserver = null;
let feedApplyRafId = null;
let latestFeedFilters = [];
let extensionContextInvalid = false;
let sessionFallbackUrl = "";
let sessionSkipToNext = false;
let consecutiveSkipCount = 0;

// Custom-rule state cached locally between heartbeats. Compilation
// happens inside the sandbox iframe (the only context that can use
// `new Function` under our extension CSP), so we no longer keep a local
// compiled-function cache.
let latestCustomRules = []; // [{ groupId, name, source }]
let sandboxIframe = null;
let sandboxReadyPromise = null;
const sandboxPendingRequests = new Map(); // requestId -> { resolve, timeoutId }
let nextSandboxRequestId = 1;
let backgroundCustomTimers = {}; // { [groupId]: { [timerId]: state } }
let backgroundCustomPersistence = {}; // { [groupId]: { [key]: value } }
let pendingCustomTimers = null; // local mutations to flush back
let pendingCustomPersistence = null;
let pendingCustomTimersDirty = false;
let pendingCustomPersistenceDirty = false;
let activePlatformIntents = null; // last computed intents (for re-applying after DOM changes)
let activeFinalRuleState = 0; // last resolved custom-rule return state (-255..255)
let inScopeCustomTimers = []; // overlay items contributed by ticked custom timers

function isExtensionContextValid() {
  if (extensionContextInvalid) return false;
  try { return Boolean(chrome?.runtime?.id); } catch { return false; }
}

function isContextInvalidatedError(error) {
  const message = error?.message || (typeof error === "string" ? error : "");
  return /Extension context invalidated|context invalidated|Receiving end does not exist/i.test(message);
}

function shutdownContentScript() {
  if (extensionContextInvalid) return;
  extensionContextInvalid = true;
  stopHeartbeat();
  stopFeedObserver();
  restoreHiddenFeedCards();
  restoreHiddenPlatformIntentElements();

  if (refreshDebounceTimeoutId !== null) {
    window.clearTimeout(refreshDebounceTimeoutId);
    refreshDebounceTimeoutId = null;
  }
  if (navigationPollIntervalId !== null) {
    window.clearInterval(navigationPollIntervalId);
    navigationPollIntervalId = null;
  }
  if (overlay?.container?.parentNode) {
    overlay.container.parentNode.removeChild(overlay.container);
  }
  overlay = null;
  removeDebugOverlay();
  teardownSandboxIframe();
}

// ────────────────────────────────────────────────────────────────────────
// Sandbox iframe. Custom rules can't be compiled or run in the content
// script directly: the extension's default CSP forbids `new Function`,
// and that CSP applies to the content script's isolated world too. The
// sandbox page declared in manifest.sandbox.pages does get a relaxed
// CSP, so we host one off-screen iframe per page that loads it and
// route all rule execution through postMessage.
// ────────────────────────────────────────────────────────────────────────

function ensureSandboxIframe() {
  if (sandboxIframe?.isConnected && sandboxReadyPromise) return sandboxReadyPromise;

  let url;
  try {
    url = chrome.runtime.getURL("sandbox.html");
  } catch {
    return Promise.reject(new Error("chrome.runtime.getURL is unavailable."));
  }

  sandboxIframe = document.createElement("iframe");
  sandboxIframe.src = url;
  sandboxIframe.setAttribute("aria-hidden", "true");
  sandboxIframe.setAttribute("tabindex", "-1");
  sandboxIframe.style.cssText =
    "position:absolute !important;width:0 !important;height:0 !important;" +
    "border:0 !important;left:-9999px !important;top:-9999px !important;" +
    "visibility:hidden !important;pointer-events:none !important;";

  sandboxReadyPromise = new Promise((resolve, reject) => {
    let settled = false;
    sandboxIframe.addEventListener(
      "load",
      () => {
        if (settled) return;
        settled = true;
        resolve();
      },
      { once: true }
    );
    sandboxIframe.addEventListener(
      "error",
      (event) => {
        if (settled) return;
        settled = true;
        reject(new Error("Sandbox iframe failed to load (probably blocked by the page's frame-src CSP)."));
      },
      { once: true }
    );
  });

  (document.body || document.documentElement).appendChild(sandboxIframe);
  return sandboxReadyPromise;
}

function teardownSandboxIframe() {
  if (sandboxIframe?.parentNode) {
    sandboxIframe.parentNode.removeChild(sandboxIframe);
  }
  sandboxIframe = null;
  sandboxReadyPromise = null;
  for (const [, entry] of sandboxPendingRequests) {
    if (entry.timeoutId) clearTimeout(entry.timeoutId);
    entry.reject(new Error("Sandbox torn down."));
  }
  sandboxPendingRequests.clear();
}

function postToSandbox(message, timeoutMs = 5000) {
  return ensureSandboxIframe().then(
    () =>
      new Promise((resolve, reject) => {
        if (!sandboxIframe?.contentWindow) {
          reject(new Error("Sandbox iframe has no contentWindow."));
          return;
        }
        const id = nextSandboxRequestId++;
        const timeoutId = setTimeout(() => {
          if (sandboxPendingRequests.has(id)) {
            sandboxPendingRequests.delete(id);
            reject(new Error("Sandbox request timed out after " + timeoutMs + " ms."));
          }
        }, timeoutMs);
        sandboxPendingRequests.set(id, { resolve, reject, timeoutId });
        try {
          sandboxIframe.contentWindow.postMessage({ ...message, id }, "*");
        } catch (error) {
          clearTimeout(timeoutId);
          sandboxPendingRequests.delete(id);
          reject(error);
        }
      })
  );
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.source !== "custom-blocker-sandbox") return;
  const id = data.id;
  if (typeof id !== "number") return;
  const entry = sandboxPendingRequests.get(id);
  if (!entry) return;
  sandboxPendingRequests.delete(id);
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  entry.resolve(data);
});

function buildCustomStateUpdate() {
  if (!pendingCustomTimersDirty && !pendingCustomPersistenceDirty) {
    return undefined;
  }
  const update = {};
  if (pendingCustomTimersDirty && pendingCustomTimers) {
    update.customTimers = pendingCustomTimers;
  }
  if (pendingCustomPersistenceDirty && pendingCustomPersistence) {
    update.customPersistence = pendingCustomPersistence;
  }
  pendingCustomTimersDirty = false;
  pendingCustomPersistenceDirty = false;
  return update;
}

function safeSendMessage(message, callback) {
  if (!isExtensionContextValid()) {
    shutdownContentScript();
    return;
  }
  try {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime?.lastError;
      if (lastError) {
        if (isContextInvalidatedError(lastError)) shutdownContentScript();
        return;
      }
      if (typeof callback === "function") {
        try {
          callback(response);
        } catch (callbackError) {
          if (isContextInvalidatedError(callbackError)) {
            shutdownContentScript();
            return;
          }
          throw callbackError;
        }
      }
    });
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      shutdownContentScript();
      return;
    }
    throw error;
  }
}

function ensureOverlay() {
  if (!overlay) overlay = mountOverlay();
  return overlay;
}

function removeOverlay() {
  if (overlay?.container?.isConnected) overlay.container.remove();
  overlay = null;
}

// ────────────────────────────────────────────────────────────────────────
// DOM extraction helpers shared by feed-filter logic and platform intents.
// ────────────────────────────────────────────────────────────────────────

function extractCreatorFromHref(href) {
  if (!href) return null;
  try {
    return normalizeYouTubeCreatorInput(new URL(href, location.origin).href);
  } catch {
    return normalizeYouTubeCreatorInput(href);
  }
}

const POST_CARD_SELECTOR =
  "ytd-post-renderer, ytd-backstage-post-thread-renderer, ytd-backstage-post-renderer";

function getFeedCardElements(site) {
  if (site === "reddit") {
    const selectors = [
      "shreddit-post",
      "shreddit-ad-post",
      "article:has(shreddit-post)",
      "faceplate-tracker[source=\"search\"] shreddit-post",
      "div.thing[data-subreddit]"
    ];
    const containers = new Set();
    for (const selector of selectors) {
      let nodes = [];
      try { nodes = document.querySelectorAll(selector); } catch { continue; }
      for (const node of nodes) containers.add(node.closest?.("article") ?? node);
    }
    return [...containers];
  }

  if (site === "youtube") {
    // Modern YouTube uses several different wrappers for shorts cards
    // depending on surface and rollout: ytd-rich-item-renderer wraps the
    // home-feed shorts shelf entries, ytd-reel-item-renderer is the older
    // search/subs shelf entry, and yt-shorts-lockup-view-model /
    // ytm-shorts-lockup-view-model-v2 are the newer view-model wrappers
    // that sometimes appear standalone (and often hold the only useful
    // metadata for predicate evaluation). Including all of them ensures a
    // predicate-based hide can reach every short the user might see.
    return [
      ...document.querySelectorAll(
        [
          "ytd-rich-item-renderer",
          "ytd-video-renderer",
          "ytd-grid-video-renderer",
          "ytd-compact-video-renderer",
          "ytd-reel-item-renderer",
          "ytd-rich-grid-media",
          "yt-lockup-view-model",
          "yt-shorts-lockup-view-model",
          "ytm-shorts-lockup-view-model-v2",
          "ytd-post-renderer",
          "ytd-backstage-post-thread-renderer",
          "ytd-backstage-post-renderer"
        ].join(", ")
      )
    ];
  }

  const anchorSelectors =
    site === "tiktok"
      ? ['a[href*="/video/"]']
      : site === "instagram"
        ? ['a[href^="/reel/"]', 'a[href^="/p/"]', 'a[href^="/tv/"]']
      : site === "facebook"
        ? ['a[href*="/reel/"]', 'a[href*="/watch/"]', 'a[href*="/posts/"]', 'a[href*="/permalink/"]']
      : site === "twitch"
        ? ['a[href*="/clip/"]', 'a[href^="/videos/"]']
      : [];

  if (anchorSelectors.length === 0) return [];

  const containers = new Set();
  const containerSelector = [
    "article",
    '[role="article"]',
    '[data-e2e*="item"]',
    '[data-testid*="cell"]',
    '[data-pagelet]',
    "li"
  ].join(", ");

  for (const anchor of document.querySelectorAll(anchorSelectors.join(", "))) {
    const container = anchor.closest(containerSelector);
    if (container) containers.add(container);
  }
  return [...containers];
}

function isPostCard(card) {
  return Boolean(card.matches(POST_CARD_SELECTOR) || card.querySelector(POST_CARD_SELECTOR));
}

function getFeedCardHref(card, site) {
  if (site !== "youtube") {
    const preferredSelector =
      site === "tiktok"
        ? 'a[href*="/video/"]'
        : site === "instagram"
          ? 'a[href^="/reel/"], a[href^="/p/"], a[href^="/tv/"]'
        : site === "facebook"
          ? 'a[href*="/reel/"], a[href*="/watch/"], a[href*="/posts/"], a[href*="/permalink/"]'
        : site === "twitch"
          ? 'a[href*="/clip/"], a[href^="/videos/"]'
          : "a[href]";
    const href = card.querySelector(preferredSelector)?.getAttribute("href") ??
      card.querySelector("a[href]")?.getAttribute("href");
    return href || null;
  }

  const link = card.querySelector(
    [
      'a#thumbnail[href^="/watch"]',
      'a#thumbnail[href^="/shorts/"]',
      'a.ytd-thumbnail[href^="/watch"]',
      'a.ytd-thumbnail[href^="/shorts/"]',
      'a[href^="/watch"]:not([href*="list="])',
      'a[href^="/shorts/"]',
      'a[href^="/post/"]'
    ].join(", ")
  );
  return link?.getAttribute("href") ?? null;
}

function getPostCardElement(card) {
  if (card.matches(POST_CARD_SELECTOR)) return card;
  return card.querySelector(POST_CARD_SELECTOR);
}

function getFeedCardCreators(card) {
  const identifiers = new Set();
  const collectFromScope = (scope) => {
    if (!scope) return;
    const creatorSelectors = [
      "ytd-channel-name a[href]",
      "#channel-name a[href]",
      'a[href^="/@"]',
      'a[href*="/@"]',
      'a[href^="/channel/"]',
      'a[href*="/channel/"]',
      'a[href^="/c/"]',
      'a[href*="/c/"]',
      'a[href^="/user/"]',
      'a[href*="/user/"]'
    ];
    for (const selector of creatorSelectors) {
      for (const element of scope.querySelectorAll(selector)) {
        const identifier = extractCreatorFromHref(element.getAttribute("href"));
        if (identifier) identifiers.add(identifier);
      }
    }
  };
  const postElement = getPostCardElement(card);

  if (postElement) {
    const authorSelectors = [
      "#author-text a[href]",
      "ytd-channel-name#channel-name a[href]",
      "ytd-channel-name a[href]"
    ];
    for (const selector of authorSelectors) {
      const element = postElement.querySelector(selector);
      if (!element) continue;
      const identifier = extractCreatorFromHref(element.getAttribute("href"));
      if (identifier) {
        identifiers.add(identifier);
        break;
      }
    }
    return [...identifiers];
  }

  collectFromScope(card);

  if (identifiers.size === 0) {
    const fallbackContainer = card.closest(
      "ytd-reel-shelf-renderer, ytd-rich-section-renderer, ytd-item-section-renderer"
    );
    collectFromScope(fallbackContainer);
  }

  return [...identifiers];
}

function extractRedditSubredditFromCard(card) {
  if (!card) return null;
  const attrCandidates = [
    card.getAttribute?.("subreddit-name"),
    card.getAttribute?.("subreddit-prefixed-name"),
    card.getAttribute?.("data-subreddit"),
    card.getAttribute?.("data-subreddit-prefixed")
  ];
  for (const value of attrCandidates) {
    if (value) {
      const normalized = normalizeRedditSubredditInput(value);
      if (normalized) return normalized;
    }
  }
  const nestedSelectors = [
    "[subreddit-name]",
    "[subreddit-prefixed-name]",
    "[data-subreddit]",
    "[data-subreddit-prefixed]"
  ];
  for (const selector of nestedSelectors) {
    let element;
    try { element = card.querySelector(selector); } catch { continue; }
    if (!element) continue;
    const value =
      element.getAttribute("subreddit-name") ||
      element.getAttribute("subreddit-prefixed-name") ||
      element.getAttribute("data-subreddit") ||
      element.getAttribute("data-subreddit-prefixed");
    if (value) {
      const normalized = normalizeRedditSubredditInput(value);
      if (normalized) return normalized;
    }
  }
  let links = [];
  try { links = card.querySelectorAll('a[href*="/r/"]'); } catch { links = []; }
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const match = href.toLowerCase().match(/\/r\/([^/?#]+)/);
    if (match) {
      const normalized = normalizeRedditSubredditInput(match[1]);
      if (normalized) return normalized;
    }
  }
  return null;
}

function getCurrentFeedSite() {
  const hostname = normalizeHostname(location.hostname);
  const videoCtx = detectVideoSiteContext(hostname, location.pathname);
  if (videoCtx.site) return videoCtx.site;
  if (isRedditHost(hostname)) return "reddit";
  return null;
}

function getFeedCardData(card) {
  const currentSite = getCurrentFeedSite();
  if (currentSite === "reddit") {
    return { redditSubreddit: extractRedditSubredditFromCard(card) };
  }
  if (currentSite !== "youtube") {
    const href = getFeedCardHref(card, currentSite);
    if (!href) return null;
    let url;
    try { url = new URL(href, location.origin); } catch { return null; }
    const videoContext = detectVideoSiteContext(normalizeHostname(url.hostname), url.pathname);
    const creators = [
      ...new Set(
        [...card.querySelectorAll("a[href]")]
          .map((anchor) => normalizePlatformAuthorInput(anchor.getAttribute("href"), currentSite))
          .filter(Boolean)
      )
    ];
    return { videoForm: videoContext.form, creators };
  }
  if (isPostCard(card)) {
    return { videoForm: "post", creators: getFeedCardCreators(card) };
  }
  const href = getFeedCardHref(card, "youtube");
  if (!href) return null;
  let url;
  try { url = new URL(href, location.origin); } catch { return null; }
  const videoContext = detectVideoSiteContext(normalizeHostname(url.hostname), url.pathname);
  return { videoForm: videoContext.form, creators: getFeedCardCreators(card) };
}

function matchesFeedFilter(cardData, filter) {
  if (!cardData || !filter) return false;
  if (filter.site === "reddit") {
    if (!cardData.redditSubreddit) return false;
    const subreddits = Array.isArray(filter.subreddits) ? filter.subreddits : [];
    if (filter.redditMode === "include") return subreddits.includes(cardData.redditSubreddit);
    if (filter.redditMode === "exclude") return !subreddits.includes(cardData.redditSubreddit);
    return false;
  }
  if (filter.videoMode === "short" || filter.videoMode === "long" || filter.videoMode === "post") {
    if (cardData.videoForm !== filter.videoMode) return false;
  }
  if (filter.authorMode === "none") return true;
  const authors = Array.isArray(filter.authors) ? filter.authors : [];
  if (authors.length === 0) return false;
  const hasAuthorMatch = authors.some((author) => cardData.creators.includes(author));
  return filter.authorMode === "include" ? hasAuthorMatch : !hasAuthorMatch;
}

function restoreHiddenFeedCards() {
  for (const card of document.querySelectorAll('[data-custom-blocker-feed-hidden="true"]')) {
    if (card.dataset.customBlockerFeedPrevDisplay !== undefined) {
      card.style.display = card.dataset.customBlockerFeedPrevDisplay;
      delete card.dataset.customBlockerFeedPrevDisplay;
    } else {
      card.style.removeProperty("display");
    }
    card.removeAttribute("data-custom-blocker-feed-hidden");
    card.removeAttribute("aria-hidden");
  }
}

function hideElement(element) {
  if (!element || element.dataset.customBlockerFeedHidden === "true") return;
  element.dataset.customBlockerFeedHidden = "true";
  element.dataset.customBlockerFeedPrevDisplay = element.style.display || "";
  element.style.display = "none";
  element.setAttribute("aria-hidden", "true");
}

function collectNavElementsToHide(filter) {
  if (!filter || filter.authorMode !== "none") return [];
  const containers = new Set();
  let anchorSelectors = [];
  const containerSelectors = [
    "ytd-guide-entry-renderer",
    "ytd-mini-guide-entry-renderer",
    "ytd-pivot-bar-item-renderer",
    "tp-yt-paper-tab",
    "yt-tab-shape"
  ].join(", ");

  if (filter.videoMode === "short") {
    anchorSelectors = ['a[href="/shorts"]', 'a[href^="/shorts?"]', 'a[title="Shorts"]'];
  } else if (filter.videoMode === "post") {
    anchorSelectors = [
      'a[href$="/community"]',
      'a[href$="/posts"]',
      'a[href*="/community?"]',
      'a[href*="/posts?"]'
    ];
  } else {
    return [];
  }

  for (const anchor of document.querySelectorAll(anchorSelectors.join(", "))) {
    const container = anchor.closest(containerSelectors);
    if (container) containers.add(container);
  }
  return [...containers];
}

function collectFormShelvesToHide(filter) {
  if (!filter || filter.authorMode !== "none") return [];
  let shelfSelectors = [];
  if (filter.videoMode === "short") {
    shelfSelectors = [
      "ytd-reel-shelf-renderer",
      "ytd-rich-shelf-renderer[is-shorts]",
      "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
      "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)",
      "ytd-item-section-renderer:has(ytd-reel-shelf-renderer)",
      "ytd-shelf-renderer:has(a[href^='/shorts/'])"
    ];
  } else if (filter.videoMode === "post") {
    shelfSelectors = [
      "ytd-rich-section-renderer:has(ytd-post-renderer)",
      "ytd-rich-section-renderer:has(ytd-backstage-post-thread-renderer)",
      "ytd-rich-section-renderer:has(ytd-backstage-post-renderer)",
      "ytd-shelf-renderer:has(ytd-post-renderer)",
      "ytd-shelf-renderer:has(ytd-backstage-post-thread-renderer)",
      "ytd-shelf-renderer:has(ytd-backstage-post-renderer)",
      "ytd-item-section-renderer:has(ytd-post-renderer)",
      "ytd-item-section-renderer:has(ytd-backstage-post-thread-renderer)",
      "ytd-item-section-renderer:has(ytd-backstage-post-renderer)",
      "ytd-horizontal-card-list-renderer:has(ytd-post-renderer)",
      "ytd-horizontal-card-list-renderer:has(ytd-backstage-post-thread-renderer)"
    ];
  } else {
    return [];
  }
  let shelves = [];
  try { shelves = [...document.querySelectorAll(shelfSelectors.join(", "))]; } catch { shelves = []; }
  return shelves;
}

function applyFeedFilters() {
  feedApplyRafId = null;
  restoreHiddenFeedCards();

  const currentSite = getCurrentFeedSite();
  const activeFilters = latestFeedFilters.filter((filter) => filter?.site === currentSite);

  if (currentSite && activeFilters.length > 0) {
    for (const card of getFeedCardElements(currentSite)) {
      const cardData = getFeedCardData(card);
      if (!cardData) continue;
      if (!activeFilters.some((filter) => matchesFeedFilter(cardData, filter))) continue;
      hideElement(card);
    }

    if (currentSite === "youtube") {
      for (const filter of activeFilters) {
        for (const navElement of collectNavElementsToHide(filter)) hideElement(navElement);
        for (const shelfElement of collectFormShelvesToHide(filter)) hideElement(shelfElement);
      }
    }
  }

  // Re-apply platform intents (registered by custom rules) on every
  // observer fire, regardless of whether feed filters are active. SPAs
  // like YouTube tear down and re-render the side guide constantly; if
  // we only re-applied intents from the heartbeat (every 250 ms), the
  // freshly-rendered Shorts button would stay visible between
  // heartbeats. The "direct" intents (hide-short-button, home-page
  // detection) are synchronous and cheap. Predicate-based feed-card
  // hides require a sandbox round-trip, so we kick off requestFeedReapply
  // separately and let it complete asynchronously.
  if (activePlatformIntents) {
    applyDirectPlatformIntents(activePlatformIntents);
    void requestFeedReapply();
  }
}

function scheduleApplyFeedFilters() {
  if (feedApplyRafId !== null) return;
  feedApplyRafId = window.requestAnimationFrame(() => applyFeedFilters());
}

function updateFeedFilters(filters) {
  latestFeedFilters = Array.isArray(filters) ? filters : [];
  if (latestFeedFilters.length === 0 && !activePlatformIntents) {
    stopFeedObserver();
    restoreHiddenFeedCards();
    return;
  }
  ensureFeedObserver();
  scheduleApplyFeedFilters();
}

function ensureFeedObserver() {
  if (latestFeedFilters.length === 0 && !activePlatformIntents) {
    stopFeedObserver();
    restoreHiddenFeedCards();
    return;
  }
  if (feedObserver) return;
  feedObserver = new MutationObserver(() => scheduleApplyFeedFilters());
  const root = document.body || document.documentElement;
  if (!root) return;
  feedObserver.observe(root, { childList: true, subtree: true });
}

function stopFeedObserver() {
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }
  if (feedApplyRafId !== null) {
    window.cancelAnimationFrame(feedApplyRafId);
    feedApplyRafId = null;
  }
}

function collectYouTubeCreatorIdentifiers() {
  const identifiers = new Set();
  const isShortPage = String(location.pathname || "").startsWith("/shorts/");
  const pathIdentifier = normalizeYouTubeCreatorInput(location.pathname);
  if (pathIdentifier) identifiers.add(pathIdentifier);

  const selectors = isShortPage
    ? [
        'ytd-reel-video-renderer[is-active] ytd-channel-name a[href]',
        'ytd-reel-video-renderer[is-active] a[href^="/@"]',
        'ytd-reel-player-header-renderer ytd-channel-name a[href]',
        'ytd-reel-player-overlay-renderer ytd-channel-name a[href]',
        'ytd-reel-player-header-renderer a[href^="/@"]',
        'ytd-reel-player-overlay-renderer a[href^="/@"]'
      ]
    : [
        'ytd-watch-metadata ytd-channel-name a[href]',
        '#upload-info a[href]',
        'ytd-watch-metadata a[href^="/@"]',
        'ytd-watch-flexy ytd-channel-name a[href]',
        'link[rel="canonical"]'
      ];

  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const href = element.getAttribute("href") || element.getAttribute("content");
      const identifier = extractCreatorFromHref(href);
      if (identifier) identifiers.add(identifier);
    }
  }
  return [...identifiers];
}

function extractPrimaryAuthorFromPath(groupType, pathname) {
  const safePathname = String(pathname ?? "/");
  if (groupType === "youtube") return normalizeYouTubeCreatorInput(safePathname);
  if (groupType === "tiktok") {
    const match = safePathname.match(/^\/@([^/?#]+)/i);
    return match ? normalizePlatformAuthorInput(match[1], groupType) : null;
  }
  if (groupType === "instagram") {
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set(["reel", "p", "tv", "explore", "accounts", "about"]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], groupType);
  }
  if (groupType === "facebook") {
    try {
      const parsed = new URL(location.href);
      const id = parsed.searchParams.get("id");
      if (id) return normalizePlatformAuthorInput(`id:${id}`, groupType);
    } catch {}
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set(["watch", "reel", "groups", "marketplace", "gaming", "video", "videos"]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], groupType);
  }
  if (groupType === "twitch") {
    const match = safePathname.match(/^\/([^/?#]+)/i);
    if (!match) return null;
    const reserved = new Set([
      "directory", "videos", "settings", "downloads", "subscriptions",
      "search", "jobs", "drops", "inventory"
    ]);
    return reserved.has(match[1].toLowerCase())
      ? null
      : normalizePlatformAuthorInput(match[1], groupType);
  }
  return null;
}

function collectPlatformAuthors(pathname, isYouTubePage) {
  const map = { youtube: [], tiktok: [], facebook: [], instagram: [], twitch: [] };
  if (isYouTubePage) map.youtube = collectYouTubeCreatorIdentifiers();
  for (const groupType of ["youtube", "tiktok", "facebook", "instagram", "twitch"]) {
    const fromPath = extractPrimaryAuthorFromPath(groupType, pathname);
    if (fromPath && !map[groupType].includes(fromPath)) map[groupType].push(fromPath);
  }
  return map;
}

function buildPageContext() {
  const hostname = normalizeHostname(location.hostname);
  const isYouTubePage = isYouTubeHost(hostname);
  const videoContext = detectVideoSiteContext(hostname, location.pathname);
  const isRedditPage = isRedditHost(hostname);
  const isDiscordPage = isDiscordHost(hostname);
  const platformAuthors = collectPlatformAuthors(location.pathname, isYouTubePage);

  return {
    hostname,
    url: location.href,
    pathname: location.pathname,
    isYouTubePage,
    isYouTubeShort: location.pathname.startsWith("/shorts/"),
    platformAuthors,
    isRedditPage,
    redditSubreddit: isRedditPage ? parseRedditSubredditFromPath(location.pathname) : null,
    isDiscordPage,
    discordServerId: isDiscordPage ? parseDiscordServerIdFromPath(location.pathname) : null,
    discordChannelId: isDiscordPage ? parseDiscordChannelIdFromPath(location.pathname) : null,
    videoSite: videoContext.site,
    videoForm: videoContext.form
  };
}

function updateOverlay(items, showTimer) {
  const visibleItems = (items || []).filter((item) =>
    Number.isFinite(item.displayMs ?? item.remainingMs ?? item.currentMs)
  );
  if (!showTimer || visibleItems.length === 0) {
    removeOverlay();
    return;
  }
  const nextOverlay = ensureOverlay();
  nextOverlay.container.textContent = visibleItems
    .map((item) => {
      const value = item.displayMs ?? item.remainingMs ?? item.currentMs ?? 0;
      return `${item.name}: ${formatOverlayDurationMs(value)}`;
    })
    .join("\n");
}

function canScriptCloseWindow() {
  try { return Boolean(window.opener); } catch { return false; }
}

function getMainPageRedirectUrl() {
  const hostname = normalizeHostname(location.hostname);
  if (!hostname) return null;
  if (isYouTubeHost(hostname)) return "https://www.youtube.com/";
  if (isRedditHost(hostname)) return "https://www.reddit.com/";
  if (isDiscordHost(hostname)) return "https://discord.com/channels/@me";
  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) return "https://www.tiktok.com/";
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) return "https://www.instagram.com/";
  if (hostname === "facebook.com" || hostname.endsWith(".facebook.com")) return "https://www.facebook.com/";
  if (
    hostname === "twitch.tv" ||
    hostname.endsWith(".twitch.tv") ||
    hostname === "clips.twitch.tv"
  ) return "https://www.twitch.tv/";
  if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) return "https://vimeo.com/";
  if (hostname === "dailymotion.com" || hostname.endsWith(".dailymotion.com") || hostname === "dai.ly")
    return "https://www.dailymotion.com/";
  // Unknown hosts should fall back to about:blank. Redirecting to `${origin}/`
  // can trap us in a same-site reload loop when the entire host is blocked.
  return null;
}

function isMainPageView() {
  const hostname = normalizeHostname(location.hostname);
  const pathname = String(location.pathname || "/");
  const search = String(location.search || "");
  const hash = String(location.hash || "");
  if (isDiscordHost(hostname) && pathname === "/channels/@me" && search.length === 0 && hash.length === 0) return true;
  if (isYouTubeHost(hostname) && (pathname === "/" || pathname.startsWith("/feed/")) && search.length === 0 && hash.length === 0) return true;
  return pathname === "/" && search.length === 0 && hash.length === 0;
}

function tryRedirectToMainPage() {
  if (isMainPageView()) return false;
  const redirectUrl = getMainPageRedirectUrl();
  if (!redirectUrl) return false;
  try { location.replace(redirectUrl); } catch { location.href = redirectUrl; }
  return true;
}

function isScrollBasedVideoPage() {
  const hostname = normalizeHostname(location.hostname);
  const pathname = String(location.pathname || "/");
  if (isYouTubeHost(hostname) && pathname.startsWith("/shorts/")) return true;
  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) {
    return (
      (pathname.startsWith("/@") && pathname.includes("/video/")) ||
      pathname === "/" || pathname === "/following" || pathname === "/foryou"
    );
  }
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) {
    return pathname.startsWith("/reel/") || pathname === "/reels" || pathname.startsWith("/reels/");
  }
  return false;
}

function trySkipToNextVideo() {
  const hostname = normalizeHostname(location.hostname);
  const pathname = String(location.pathname || "/");

  if (isYouTubeHost(hostname) && pathname.startsWith("/shorts/")) {
    const nextBtn =
      document.querySelector("#navigation-button-down button") ||
      document.querySelector("ytd-shorts [aria-label*='Next']") ||
      document.querySelector("ytd-shorts [aria-label*='next']");
    if (nextBtn) { nextBtn.click(); return true; }
    const activeReel = document.querySelector("ytd-reel-video-renderer[is-active]");
    const nextAnchor = activeReel?.nextElementSibling?.querySelector("a#thumbnail, a.reel-item-endpoint");
    if (nextAnchor?.href) {
      try { location.replace(nextAnchor.href); } catch { location.href = nextAnchor.href; }
      return true;
    }
    return false;
  }
  if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) {
    const nextBtn =
      document.querySelector('[data-e2e="arrow-right"]') ||
      document.querySelector('[data-e2e="feed-go-to-next-video"]') ||
      document.querySelector('button[aria-label*="Next"]') ||
      document.querySelector('button[aria-label*="next"]');
    if (nextBtn) {
      nextBtn.click();
    } else {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    }
    return true;
  }
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) {
    const nextBtn =
      document.querySelector('button[aria-label="Next"]') ||
      document.querySelector('[aria-label*="Next reel"]');
    if (nextBtn) { nextBtn.click(); return true; }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    return true;
  }
  return false;
}

function attemptExitPage() {
  if (exitAttempted) return;
  exitAttempted = true;

  if (overlay) overlay.container.textContent = "0:00";

  if (sessionSkipToNext && isScrollBasedVideoPage() && consecutiveSkipCount < 10) {
    if (trySkipToNextVideo()) {
      consecutiveSkipCount++;
      exitAttempted = false;
      return;
    }
  }
  consecutiveSkipCount = 0;

  if (sessionFallbackUrl) {
    try { location.replace(sessionFallbackUrl); } catch { location.href = sessionFallbackUrl; }
    return;
  }

  if (tryRedirectToMainPage()) return;
  if (canScriptCloseWindow()) window.close();
  try { location.replace("about:blank"); } catch { location.href = "about:blank"; }
}

function stopHeartbeat() {
  if (heartbeatIntervalId !== null) {
    window.clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
}

function ensureHeartbeat() {
  if (heartbeatIntervalId !== null || exitAttempted || extensionContextInvalid) return;

  heartbeatIntervalId = window.setInterval(() => {
    if (extensionContextInvalid) {
      stopHeartbeat();
      return;
    }
    if (!isExtensionContextValid()) {
      shutdownContentScript();
      return;
    }
    const now = Date.now();
    if (document.hidden) {
      lastHeartbeatAt = now;
      return;
    }
    const elapsedMs = now - lastHeartbeatAt;
    lastHeartbeatAt = now;
    safeSendMessage(
      {
        type: "track-page-time",
        pageContext: buildPageContext(),
        elapsedMs,
        customStateUpdate: buildCustomStateUpdate()
      },
      // Pass the heartbeat-interval elapsedMs through to handleSession so
      // custom timers tick on the same clock as the default block group's
      // usage timer, not on the (much smaller, jittery) round-trip latency
      // of the get-page-session call.
      (session) => handleSession(session, elapsedMs)
    );
  }, 250);
}

// ────────────────────────────────────────────────────────────────────────
// Custom rule execution.
// ────────────────────────────────────────────────────────────────────────

// Run a heartbeat's worth of custom rules through the sandbox iframe.
// The iframe owns the actual `new Function` + execution; we just ferry
// state in and read mutations + intents back out.
function resolveFinalCustomRuleState(ruleResults) {
  let finalState = 0;
  for (const entry of ruleResults) {
    const value = entry?.result;
    if (typeof value === "number" && Number.isInteger(value) && value !== 0) {
      // Rules run bottom-to-top. The last non-zero state therefore
      // comes from the top-most rule that made a decision, which is
      // exactly the precedence model the user asked for.
      finalState = value;
    }
  }
  return finalState;
}

async function runCustomRulesAsync(rules, currentUrl, now, elapsedMs, initialRedirectUrl) {
  if (!helperBundle) {
    return {
      intentsState: null,
      finalRuleState: 0,
      redirectUrl: typeof initialRedirectUrl === "string" ? initialRedirectUrl.trim() : "",
      overlayItems: [],
      ruleResults: []
    };
  }

  // Seed per-group working state from the latest snapshot we have from
  // background. Each bucket is sent into the sandbox by structured
  // clone, mutated there, then shipped back so we can detect dirty
  // state and flush it.
  const localTimers = {};
  const localPersistence = {};
  for (const rule of rules) {
    localTimers[rule.groupId] = JSON.parse(
      JSON.stringify(backgroundCustomTimers[rule.groupId] ?? {})
    );
    localPersistence[rule.groupId] = JSON.parse(
      JSON.stringify(backgroundCustomPersistence[rule.groupId] ?? {})
    );
  }

  const date = new Date(now);
  const context = {
    currentUrl,
    now,
    elapsedMs,
    initialRedirectUrl: typeof initialRedirectUrl === "string" ? initialRedirectUrl.trim() : "",
    month: date.getMonth() + 1,
    dayOfMonth: date.getDate(),
    dayName: formatDayName(getDayNameForDate(date)),
    hour: date.getHours(),
    minute: date.getMinutes()
  };

  const batch = rules.map((rule) => ({
    groupId: rule.groupId,
    name: rule.name,
    source: rule.source,
    timersBucket: localTimers[rule.groupId],
    persistenceBucket: localPersistence[rule.groupId]
  }));

  // Predicates registered by custom rules cannot leave the sandbox —
  // their closures live there — so we collect feed items and page
  // items from the DOM up-front, ship them in with the rule batch, and
  // let the sandbox evaluate predicates locally. The sandbox returns
  // hide-keys and page-block decisions that we apply below.
  const platform = getPlatformForCurrentUrl(currentUrl);
  const { items: feedItems, cardsByKey } = platform
    ? collectFeedItemsForPlatform(platform, currentUrl)
    : { items: [], cardsByKey: [] };
  const pageItems = collectPageItemsForPlatform(platform);

  const emptyDecisions = { short: [], long: [], post: [] };
  const emptyPageBlocked = { short: false, long: false, post: false };

  let response;
  try {
    response = await postToSandbox({
      type: "execute",
      batch,
      context,
      platform,
      feedItems,
      pageItems
    });
  } catch (error) {
    return {
      intentsState: helperBundle.createEmptyIntentsState(),
      finalRuleState: 0,
      redirectUrl: typeof initialRedirectUrl === "string" ? initialRedirectUrl.trim() : "",
      overlayItems: [],
      platform,
      cardsByKey,
      feedDecisions: emptyDecisions,
      pageBlocked: emptyPageBlocked,
      ruleResults: rules.map((rule) => ({
        groupId: rule.groupId,
        name: rule.name,
        source: rule.source,
        result: undefined,
        error: "Sandbox error: " + ((error && error.message) || String(error))
      }))
    };
  }

  if (response?.error) {
    return {
      intentsState: helperBundle.createEmptyIntentsState(),
      finalRuleState: 0,
      redirectUrl: typeof initialRedirectUrl === "string" ? initialRedirectUrl.trim() : "",
      overlayItems: [],
      platform,
      cardsByKey,
      feedDecisions: emptyDecisions,
      pageBlocked: emptyPageBlocked,
      ruleResults: rules.map((rule) => ({
        groupId: rule.groupId,
        name: rule.name,
        source: rule.source,
        result: undefined,
        error: "Sandbox error: " + response.error
      }))
    };
  }

  const sandboxResults = Array.isArray(response?.results) ? response.results : [];
  const displayedTimersByGroup = {};
  const ruleResults = [];

  for (const r of sandboxResults) {
    const groupId = r?.groupId;
    if (groupId) {
      if (r.timersBucket && typeof r.timersBucket === "object") {
        localTimers[groupId] = r.timersBucket;
      }
      if (r.persistenceBucket && typeof r.persistenceBucket === "object") {
        localPersistence[groupId] = r.persistenceBucket;
      }
      // The overlay shows whatever the rule's `domain` predicate
      // matched (falling back to `scope` when domain wasn't set). The
      // sandbox computes this and returns the id list.
      if (Array.isArray(r.displayedTimerIds) && r.displayedTimerIds.length > 0) {
        const existing = displayedTimersByGroup[groupId] ?? [];
        const merged = new Set([...existing, ...r.displayedTimerIds]);
        displayedTimersByGroup[groupId] = [...merged];
      }
    }
    ruleResults.push({
      groupId: r?.groupId,
      name: r?.name,
      source: r?.source,
      result: r?.error ? undefined : r?.result,
      error: r?.error || null
    });
  }

  // Build overlay items for the timers that were "displayed" this
  // heartbeat (their domain predicate returned true, or scope did when
  // domain was omitted). Other timers stay hidden so the overlay is
  // contextual to where the user actually is.
  const overlayItems = [];
  for (const [groupId, ids] of Object.entries(displayedTimersByGroup)) {
    const bucket = localTimers[groupId] ?? {};
    for (const id of ids) {
      const t = bucket[id];
      if (!t) continue;
      overlayItems.push({
        id: `${groupId}:${id}`,
        name: t.displayName || id,
        currentMs: t.currentMs,
        direction: t.direction,
        isPaused: t.isPaused,
        groupType: "custom-timer"
      });
    }
  }

  // Mark mutations as dirty if anything changed. Cheap deep-equality via
  // JSON; perfectly fine for the small per-group buckets involved.
  const timersChanged =
    JSON.stringify(localTimers) !== JSON.stringify(backgroundCustomTimers);
  const persistenceChanged =
    JSON.stringify(localPersistence) !== JSON.stringify(backgroundCustomPersistence);

  if (timersChanged || persistenceChanged) {
    pendingCustomTimers = localTimers;
    pendingCustomPersistence = localPersistence;
    pendingCustomTimersDirty = pendingCustomTimersDirty || timersChanged;
    pendingCustomPersistenceDirty = pendingCustomPersistenceDirty || persistenceChanged;
    backgroundCustomTimers = localTimers;
    backgroundCustomPersistence = localPersistence;
  }

  const intentsState =
    response?.intents && typeof response.intents === "object"
      ? response.intents
      : helperBundle.createEmptyIntentsState();
  const feedDecisions =
    response?.feedDecisions && typeof response.feedDecisions === "object"
      ? response.feedDecisions
      : emptyDecisions;
  const pageBlocked =
    response?.pageBlocked && typeof response.pageBlocked === "object"
      ? response.pageBlocked
      : emptyPageBlocked;
  const finalRuleState = resolveFinalCustomRuleState(ruleResults);
  const redirectUrl =
    typeof response?.redirectUrl === "string"
      ? response.redirectUrl.trim()
      : (typeof initialRedirectUrl === "string" ? initialRedirectUrl.trim() : "");

  return {
    intentsState,
    finalRuleState,
    redirectUrl,
    overlayItems,
    ruleResults,
    platform,
    cardsByKey,
    feedDecisions,
    pageBlocked
  };
}

// ────────────────────────────────────────────────────────────────────────
// Platform intent application.
// ────────────────────────────────────────────────────────────────────────

const SHORT_BUTTON_HIDDEN_ATTR = "data-custom-blocker-short-button-hidden";
const HOME_HIDDEN_ATTR = "data-custom-blocker-platform-home-hidden";
const PREDICATE_HIDDEN_ATTR = "data-custom-blocker-predicate-hidden";

// Anchor selectors per platform for the "short-form button" itself.
// Each anchor is hidden along with the closest navigation-row container
// (see SHORT_BUTTON_CONTAINER_SELECTORS). YouTube additionally hides
// in-feed shorts *shelves* (the horizontal rows of shorts on home / subs
// / search), since "hide the Shorts entry point" without removing the
// shelves leaves an obvious back-door — and it's the behaviour the
// YouTube block group's `videoMode: short, authorMode: none` already
// exhibits, which is what `helpers.getPlatformHelper().youtube()
// .hideShortButton()` is supposed to mirror.
const SHORT_BUTTON_SELECTORS = {
  youtube: ['a[href="/shorts"]', 'a[href^="/shorts?"]', 'a[title="Shorts"]'],
  tiktok: ['a[href*="/foryou"]', 'a[data-e2e="nav-foryou"]'],
  instagram: ['a[href="/reels/"]', 'a[href^="/reels"]', 'a[aria-label*="Reels" i]'],
  facebook: ['a[href*="/reel/"]', 'a[aria-label*="Reels" i]'],
  twitch: ['a[href*="/clips"]', 'a[aria-label*="Clips" i]']
};

const SHORT_BUTTON_CONTAINER_SELECTORS = {
  youtube:
    "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-pivot-bar-item-renderer, tp-yt-paper-tab, yt-tab-shape, li",
  tiktok: 'div[data-e2e*="nav"], li',
  instagram: 'div[role="tablist"] > div, li',
  facebook: 'div[role="navigation"] li, li',
  twitch: "li"
};

// Extra structural elements to hide on top of the nav button itself.
// Currently only YouTube needs this (in-feed Shorts shelves on home /
// subscriptions / search results).
const SHORT_BUTTON_EXTRA_SELECTORS = {
  youtube: [
    "ytd-reel-shelf-renderer",
    "ytd-rich-shelf-renderer[is-shorts]",
    "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
    "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)",
    "ytd-item-section-renderer:has(ytd-reel-shelf-renderer)",
    "ytd-shelf-renderer:has(a[href^='/shorts/'])"
  ]
};

function restoreShortButtonHiddenElements() {
  for (const el of document.querySelectorAll(`[${SHORT_BUTTON_HIDDEN_ATTR}="true"]`)) {
    restoreElement(el);
    el.removeAttribute(SHORT_BUTTON_HIDDEN_ATTR);
  }
}

function restorePredicateHiddenElements() {
  for (const el of document.querySelectorAll(`[${PREDICATE_HIDDEN_ATTR}="true"]`)) {
    restoreElement(el);
    el.removeAttribute(PREDICATE_HIDDEN_ATTR);
  }
}

function restoreHiddenPlatformIntentElements() {
  restoreShortButtonHiddenElements();
  restorePredicateHiddenElements();
}

function restoreElement(element) {
  if (!element) return;
  if (element.dataset.customBlockerFeedPrevDisplay !== undefined) {
    element.style.display = element.dataset.customBlockerFeedPrevDisplay;
    delete element.dataset.customBlockerFeedPrevDisplay;
  } else {
    element.style.removeProperty("display");
  }
  element.removeAttribute("data-custom-blocker-feed-hidden");
  element.removeAttribute("aria-hidden");
}

function hideElementWithMark(element, markAttr) {
  if (!element) return;
  if (element.getAttribute(markAttr) === "true") return;
  element.setAttribute(markAttr, "true");
  hideElement(element);
}

function applyShortButtonHide(platform) {
  const anchorSelectors = SHORT_BUTTON_SELECTORS[platform];
  const containerSelector = SHORT_BUTTON_CONTAINER_SELECTORS[platform];
  if (anchorSelectors && containerSelector) {
    for (const selector of anchorSelectors) {
      let nodes = [];
      try { nodes = document.querySelectorAll(selector); } catch { continue; }
      for (const node of nodes) {
        const container = node.closest(containerSelector) || node;
        hideElementWithMark(container, SHORT_BUTTON_HIDDEN_ATTR);
      }
    }
  }
  const extras = SHORT_BUTTON_EXTRA_SELECTORS[platform];
  if (extras) {
    let extraNodes = [];
    try { extraNodes = document.querySelectorAll(extras.join(", ")); } catch { extraNodes = []; }
    for (const node of extraNodes) {
      hideElementWithMark(node, SHORT_BUTTON_HIDDEN_ATTR);
    }
  }
}

function applyShortButtonShow(platform) {
  for (const el of document.querySelectorAll(`[${SHORT_BUTTON_HIDDEN_ATTR}="true"]`)) {
    restoreElement(el);
    el.removeAttribute(SHORT_BUTTON_HIDDEN_ATTR);
  }
}

// Per-platform feed card classifier and metadata extractor. Returns the
// item shape that gets passed to predicates: `{ url, name, author, length,
// views, publishedAt, description, ...extra }`.

function parseDurationLabel(label) {
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  let seconds = 0;
  for (const part of parts) seconds = seconds * 60 + part;
  return Number.isFinite(seconds) ? seconds : null;
}

function parseViewLabel(label) {
  if (typeof label !== "string") return null;
  const match = label.match(/([\d.,]+)\s*([KkMmBb]?)/);
  if (!match) return null;
  const base = parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  const suffix = match[2].toLowerCase();
  const mult = suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : suffix === "b" ? 1e9 : 1;
  return Math.round(base * mult);
}

function textOf(scope, selector) {
  if (!scope) return null;
  let el;
  try { el = scope.querySelector(selector); } catch { return null; }
  const text = el?.textContent?.trim();
  return text || null;
}

// Aggressive author resolver for YouTube shorts feed cards. Modern
// shorts cards (yt-shorts-lockup-view-model) frequently render the
// channel handle as plain text or as an aria-label, not as a real
// <a href="/@..."> anchor — so the standard `getFeedCardCreators`
// scan returns []. Without this, the user's hideShorts(predicate)
// would short-circuit to false for almost every short and nothing
// would actually be hidden.
function extractYouTubeAuthorForShort(card, url, ops) {
  if (!card) return null;

  // 1. Real anchor inside the card (covers older DOM and the cases
  //    where YouTube *does* render a handle anchor).
  const creators = getFeedCardCreators(card);
  if (creators.length > 0) return creators[0];

  // 2. Author baked into the URL itself (rare for /shorts/ but free).
  if (url && ops && typeof ops.extractAuthor === "function") {
    const fromUrl = ops.extractAuthor(url);
    if (fromUrl) return fromUrl;
  }

  // 3. Aria labels on shorts links / containers usually contain
  //    "@handle …" or "<title> by @handle …". Pull the first @-token.
  const ariaSources = [
    card.getAttribute?.("aria-label"),
    card.querySelector?.("a[aria-label]")?.getAttribute("aria-label"),
    card.querySelector?.("[aria-label*='@']")?.getAttribute("aria-label")
  ];
  for (const src of ariaSources) {
    if (typeof src !== "string") continue;
    const m = src.match(/@([A-Za-z0-9._-]+)/);
    if (m) return m[1];
  }

  // 4. Any visible text inside the card containing an @handle.
  //    yt-shorts-lockup-view-model often renders the handle as a plain
  //    <span> in its metadata bar, with no anchor. Match cautiously
  //    (must be at least 2 chars and start with a letter/digit).
  let text;
  try { text = card.textContent ?? ""; } catch { text = ""; }
  const handleMatch = text.match(/@([A-Za-z0-9][A-Za-z0-9._-]+)/);
  if (handleMatch) return handleMatch[1];

  // 5. Walk up to the enclosing shelf as a last resort. Channel-
  //    specific shelves sometimes hold the handle one level up.
  const shelf = card.closest?.(
    "ytd-reel-shelf-renderer, ytd-rich-shelf-renderer, ytd-rich-section-renderer"
  );
  if (shelf) {
    const shelfCreators = getFeedCardCreators(shelf);
    if (shelfCreators.length > 0) return shelfCreators[0];
  }
  return null;
}

function extractItemFromCard(card, platform, kind, currentUrl) {
  const utility = helperBundle.createDomainUtility();
  const ops = helperBundle.platformUrlOps[platform];

  let href = null;
  if (platform === "youtube") {
    href = getFeedCardHref(card, "youtube");
  } else {
    href = getFeedCardHref(card, platform);
  }
  let url = null;
  if (href) {
    try { url = new URL(href, location.origin).toString(); } catch { url = href; }
  }

  const item = {
    url,
    name: null,
    author: null,
    length: null,
    views: null,
    publishedAt: null,
    description: null
  };

  if (platform === "youtube") {
    if (kind === "short") {
      // Shorts cards (modern yt-shorts-lockup-view-model and the older
      // ytd-reel-item-renderer) put their title in different places
      // than long-form video cards. Try them all.
      item.name =
        textOf(card, ".shortsLockupViewModelHostMetadataTitle") ||
        textOf(card, "h3.shortsLockupViewModelHostMetadataTitle span") ||
        textOf(card, "#video-title") ||
        textOf(card, "yt-formatted-string#video-title") ||
        textOf(card, "h3") ||
        null;

      // Shorts rarely surface a real <a href="/@..."> anchor inside the
      // card, so the standard creator scan often returns nothing. Try
      // the existing scan first; then fall back to extracting an
      // @handle from any text inside the card; then try the aria-label
      // (modern shorts use "@handle • title • view count" labels);
      // finally fall back to the parent shelf for the few channel-
      // specific shelves where the channel handle lives one level up.
      item.author = extractYouTubeAuthorForShort(card, url, ops);

      // Length / views / publishedAt usually aren't surfaced on
      // shorts cards. Leave them null (the predicate will honour
      // "innocent until proven guilty" if it asks).
      item.description = null;
    } else {
      item.name = textOf(card, "#video-title") || textOf(card, "yt-formatted-string#video-title");
      const creators = getFeedCardCreators(card);
      item.author = creators[0] ?? (url ? ops.extractAuthor(url) : null);
      item.length = parseDurationLabel(
        textOf(card, ".ytd-thumbnail-overlay-time-status-renderer") ||
        textOf(card, "ytd-thumbnail-overlay-time-status-renderer")
      );
      const meta = card.querySelectorAll("#metadata-line span, .inline-metadata-item");
      for (const node of meta) {
        const text = node.textContent?.trim() ?? "";
        if (/view/i.test(text)) item.views = parseViewLabel(text);
        else if (/ago|streamed/i.test(text)) item.publishedAt = text;
      }
      item.description =
        textOf(card, "#description-text") ||
        textOf(card, "yt-formatted-string#description-text") ||
        null;
    }
  } else {
    item.author = url ? ops.extractAuthor(url) : null;
    item.name = textOf(card, "[data-e2e='video-title']") || textOf(card, "h3") || textOf(card, "h2");
    item.description = textOf(card, "p") || null;
  }

  return item;
}

// Identify the platform of the current URL, if any. Used to scope item
// extraction to a single platform's feed cards (predicates only run when
// the user is *on* that platform).
function getPlatformForCurrentUrl(currentUrl) {
  if (!helperBundle) return null;
  for (const platform of helperBundle.PLATFORM_LIST) {
    const ops = helperBundle.platformUrlOps[platform];
    if (ops && ops.isPlatformUrl(currentUrl)) return platform;
  }
  return null;
}

// Walk visible feed cards for the given platform and extract a
// serializable `item` for each one. Returns the item list (sent to the
// sandbox by structured-clone) and a parallel array of DOM elements
// indexed by the same `key`, which we use later to apply hide
// decisions. Returning element references via a parallel array avoids
// having to make the DOM nodes themselves cloneable.
function collectFeedItemsForPlatform(platform, currentUrl) {
  const items = [];
  const cardsByKey = [];
  if (!platform) return { items, cardsByKey };

  for (const card of getFeedCardElements(platform)) {
    const data = getFeedCardData(card);
    if (!data) continue;
    const kind =
      data.videoForm === "short" ? "short" :
      data.videoForm === "long" ? "long" :
      data.videoForm === "post" ? "post" : null;
    if (!kind) continue;

    const item = extractItemFromCard(card, platform, kind, currentUrl);
    const key = items.length;
    items.push({ key, kind, item });
    cardsByKey.push(card);
  }
  return { items, cardsByKey };
}

// Build the per-kind page items for blockPageOnVisit predicates. Only
// fills the kind that matches the current URL (so we don't waste a
// closure-evaluation on a `short` predicate when the user is on a
// /watch/ page).
function collectPageItemsForPlatform(platform) {
  const out = {};
  if (!platform || !helperBundle) return out;
  const ops = helperBundle.platformUrlOps[platform];
  if (!ops) return out;
  const url = location.href;
  if (ops.isShortUrl(url)) out.short = extractCurrentPageItem(platform, "short");
  if (ops.isVideoUrl(url)) out.long = extractCurrentPageItem(platform, "long");
  if (ops.isPostUrl(url)) out.post = extractCurrentPageItem(platform, "post");
  return out;
}

// Apply the hide decisions returned by the sandbox to the DOM cards we
// extracted earlier. Restores any previously predicate-hidden cards
// before applying the new decision set so cards that no longer match
// come back automatically.
function applyFeedHideDecisions(decisions, cardsByKey) {
  restorePredicateHiddenElements();
  if (!decisions || !Array.isArray(cardsByKey) || cardsByKey.length === 0) return;
  for (const kind of ["short", "long", "post"]) {
    const keys = Array.isArray(decisions[kind]) ? decisions[kind] : [];
    for (const key of keys) {
      const card = cardsByKey[key];
      if (card) hideElementWithMark(card, PREDICATE_HIDDEN_ATTR);
    }
  }
}

function extractCurrentPageItem(platform, kind) {
  const ops = helperBundle.platformUrlOps[platform];
  const url = location.href;

  const item = {
    url,
    name: null,
    author: null,
    length: null,
    views: null,
    publishedAt: null,
    description: null
  };

  item.author = ops.extractAuthor(url);

  if (platform === "youtube") {
    item.name =
      document.querySelector("ytd-watch-metadata h1, h1.ytd-watch-metadata, ytd-reel-video-renderer[is-active] h2")
        ?.textContent?.trim() ||
      document.title?.replace(/\s*-\s*YouTube\s*$/, "") ||
      null;
    const lengthLabel =
      document.querySelector(".ytp-time-duration")?.textContent?.trim() ||
      document.querySelector("video")?.duration;
    if (typeof lengthLabel === "number" && Number.isFinite(lengthLabel)) {
      item.length = Math.round(lengthLabel);
    } else if (typeof lengthLabel === "string") {
      item.length = parseDurationLabel(lengthLabel);
    }
    const viewsText = textOf(document, "ytd-watch-info-text yt-formatted-string") ||
      textOf(document, "#info-container .view-count");
    if (viewsText) item.views = parseViewLabel(viewsText);
    item.description = textOf(document, "ytd-text-inline-expander, #description-inline-expander");

    const channelIdentifiers = collectYouTubeCreatorIdentifiers();
    if (channelIdentifiers.length > 0) item.author = channelIdentifiers[0];
  } else {
    item.name = document.title || null;
    const video = document.querySelector("video");
    if (video && Number.isFinite(video.duration)) item.length = Math.round(video.duration);
  }

  return item;
}

// Returns true iff any platform has predicate intents registered. Used
// to decide whether MutationObserver fires need to re-evaluate via the
// sandbox.
function intentsHavePredicates(intentsState) {
  if (!intentsState) return false;
  for (const platform of PLATFORM_LIST) {
    const ps = intentsState[platform];
    if (!ps) continue;
    if ((ps.shortsPredicates?.length || 0) > 0) return true;
    if ((ps.videosPredicates?.length || 0) > 0) return true;
    if ((ps.postsPredicates?.length || 0) > 0) return true;
  }
  return false;
}

// Apply the "direct" (synchronous, predicate-free) intents: hide-short-
// button, and detect home-page blocks. Predicate-driven feed-card
// hides and page-block decisions are NOT done here — those come from
// the sandbox and are handed in via applyFeedHideDecisions / the
// pageBlocked map. This split lets MutationObserver fire this function
// continuously (cheap, no postMessage round-trip) while predicate work
// stays async.
function applyDirectPlatformIntents(intentsState) {
  if (!intentsState) return false;
  const currentUrl = location.href;
  let pageBlocked = false;
  let hasAnyHideIntent = false;

  restoreShortButtonHiddenElements();

  for (const platform of PLATFORM_LIST) {
    const ps = intentsState[platform];
    const ops = helperBundle.platformUrlOps[platform];
    if (!ops || !ps) continue;

    if (ps.shortButton === "hide") {
      hasAnyHideIntent = true;
      if (ops.isPlatformUrl(currentUrl)) applyShortButtonHide(platform);
    }

    if (ps.homePage === "hide" && ops.isHomePage(currentUrl)) {
      pageBlocked = true;
    }

    if ((ps.shortsPredicates?.length || 0) > 0 ||
        (ps.videosPredicates?.length || 0) > 0 ||
        (ps.postsPredicates?.length || 0) > 0) {
      hasAnyHideIntent = true;
    }
  }

  if (hasAnyHideIntent) ensureFeedObserver();
  return pageBlocked;
}

// In-flight guard for sandbox-driven feed/page re-evaluation. The
// MutationObserver can fire many times per second on YouTube; we only
// want one round-trip outstanding at a time. If new mutations arrive
// while one is in flight we set the dirty flag and chain another call
// when the current one returns.
let reapplyInFlight = false;
let reapplyDirty = false;

async function requestFeedReapply() {
  if (!sandboxIframe || !activePlatformIntents) return;
  if (!intentsHavePredicates(activePlatformIntents)) return;
  if (reapplyInFlight) {
    reapplyDirty = true;
    return;
  }
  reapplyInFlight = true;
  try {
    const platform = getPlatformForCurrentUrl(location.href);
    if (!platform) return;

    const { items, cardsByKey } = collectFeedItemsForPlatform(platform, location.href);
    // Always include current pageItems too: a DOM mutation may have
    // populated the channel handle for a /shorts/ page that just
    // loaded, which means a `blockPageOnVisit` predicate that
    // returned `false` last heartbeat (because author was null) might
    // now return `true`. Re-checking page-block on every reapply is
    // what lets the user say "blocking should react to any change".
    const pageItems = collectPageItemsForPlatform(platform);

    let response;
    try {
      response = await postToSandbox({
        type: "reapply",
        platform,
        feedItems: items,
        pageItems
      });
    } catch {
      return;
    }

    if (items.length === 0) {
      restorePredicateHiddenElements();
    } else {
      applyFeedHideDecisions(response?.feedDecisions, cardsByKey);
    }

    const pb = response?.pageBlocked || {};
    if ((pb.short || pb.long || pb.post) && activeFinalRuleState !== 1) {
      attemptExitPage();
    }
  } finally {
    reapplyInFlight = false;
    if (reapplyDirty) {
      reapplyDirty = false;
      void requestFeedReapply();
    }
  }
}

// URL-change fast path. Skips the background round-trip and goes
// straight to the sandbox so a `blockPageOnVisit` predicate can fire
// inside ~10 ms after a SPA navigation, instead of waiting for the
// next heartbeat (~250 ms) or even the post-locationchange refresh
// session (~50–100 ms). Reuses requestFeedReapply because it already
// does the right thing — collects items, ships pageItems, exits if
// pageBlocked.
function requestPageBlockCheck() {
  void requestFeedReapply();
}

// ────────────────────────────────────────────────────────────────────────
// Top-level session handler. Called every heartbeat with the background's
// response.
// ────────────────────────────────────────────────────────────────────────

function handleSession(session, heartbeatElapsedMs) {
  if (!session) return;

  // Snapshot custom state from background. If the user just flushed
  // mutations this heartbeat, the response reflects them. Otherwise the
  // local cache stays intact.
  const incomingTimers = session.customTimers ?? {};
  const incomingPersistence = session.customPersistence ?? {};
  const sessionRules = Array.isArray(session.customRules) ? session.customRules : [];
  latestCustomRules = sessionRules;

  // Drop cached state for groups that no longer exist.
  const validGroupIds = new Set(sessionRules.map((rule) => rule.groupId));
  for (const groupId of Object.keys(backgroundCustomTimers)) {
    if (!validGroupIds.has(groupId)) delete backgroundCustomTimers[groupId];
  }
  for (const groupId of Object.keys(backgroundCustomPersistence)) {
    if (!validGroupIds.has(groupId)) delete backgroundCustomPersistence[groupId];
  }
  for (const groupId of validGroupIds) {
    backgroundCustomTimers[groupId] = incomingTimers[groupId] ?? backgroundCustomTimers[groupId] ?? {};
    backgroundCustomPersistence[groupId] = incomingPersistence[groupId] ?? backgroundCustomPersistence[groupId] ?? {};
  }

  const now = Number.isFinite(session.now) ? session.now : Date.now();
  // The heartbeat hands us the actual interval since the previous tick
  // (the same value the default block group's usage timer uses). Other
  // call sites — initial refreshSession, storage-change refresh — pass
  // 0, meaning "this isn't a tick, don't advance custom timers".
  const elapsedMs = Math.max(0, Math.min(5000, Number.isFinite(heartbeatElapsedMs) ? heartbeatElapsedMs : 0));
  lastSessionRefreshAt = now;

  // Rule execution is asynchronous (postMessage round-trip to the
  // sandbox iframe). Everything that depends on the rule result —
  // intents, overlay items, exit decision — runs in applyRuleResult
  // once the iframe responds. The empty-rules branch resolves
  // synchronously so the path is identical.
  const finalize = (ruleResult) => applyRuleResult(session, sessionRules, ruleResult);

  const emptyDecisions = { short: [], long: [], post: [] };
  const emptyPageBlocked = { short: false, long: false, post: false };

  if (sessionRules.length > 0) {
    runCustomRulesAsync(
      sessionRules,
      location.href,
      now,
      elapsedMs,
      typeof session.fallbackUrl === "string" ? session.fallbackUrl.trim() : ""
    )
      .then(finalize)
      .catch((error) => {
        console.error("[CustomBlocker] runCustomRulesAsync failed.", error);
        finalize({
          intentsState: helperBundle?.createEmptyIntentsState() ?? null,
          finalRuleState: 0,
          redirectUrl: typeof session.fallbackUrl === "string" ? session.fallbackUrl.trim() : "",
          overlayItems: [],
          platform: null,
          cardsByKey: [],
          feedDecisions: emptyDecisions,
          pageBlocked: emptyPageBlocked,
          ruleResults: sessionRules.map((rule) => ({
            groupId: rule.groupId,
            name: rule.name,
            source: rule.source,
            result: undefined,
            error: "Rule executor crashed: " + ((error && error.message) || String(error))
          }))
        });
      });
  } else {
    finalize({
      intentsState: helperBundle?.createEmptyIntentsState() ?? null,
      finalRuleState: 0,
      redirectUrl: typeof session.fallbackUrl === "string" ? session.fallbackUrl.trim() : "",
      overlayItems: [],
      platform: null,
      cardsByKey: [],
      feedDecisions: emptyDecisions,
      pageBlocked: emptyPageBlocked,
      ruleResults: []
    });
  }
}

function applyRuleResult(session, sessionRules, ruleResult) {
  if (extensionContextInvalid || exitAttempted) return;

  inScopeCustomTimers = ruleResult.overlayItems;
  activePlatformIntents = ruleResult.intentsState;
  updateDebugOverlay(ruleResult.ruleResults, ruleResult.intentsState);

  // Synchronous, predicate-free intents: hide-short-button + home-page
  // detection. Returns true if home-page intent matched the current URL.
  const directBlocksPage = applyDirectPlatformIntents(ruleResult.intentsState);
  // Predicate-driven feed-card hides come from the sandbox (it has the
  // closures); apply them now.
  applyFeedHideDecisions(ruleResult.feedDecisions, ruleResult.cardsByKey);
  // Page-block decisions for blockPageOnVisit predicates also come from
  // the sandbox, one boolean per content kind.
  const pb = ruleResult.pageBlocked || {};
  const predicateBlocksPage = Boolean(pb.short || pb.long || pb.post);
  const finalRuleState =
    typeof ruleResult.finalRuleState === "number" && Number.isInteger(ruleResult.finalRuleState)
      ? ruleResult.finalRuleState
      : 0;
  activeFinalRuleState = finalRuleState;
  // Meanings:
  //   -1 block
  //    0 continue / no decision
  //    1 allow
  // Other in-range integer states are currently opaque to the engine:
  // they are preserved for the debug overlay / future expansion but do
  // not block or allow by themselves.
  const shouldBlockFromRules = finalRuleState === -1;
  const shouldAllowFromRules = finalRuleState === 1;
  const intentBlocksPage = shouldAllowFromRules ? false : (directBlocksPage || predicateBlocksPage);

  const shouldExitFromBackground = Boolean(session.shouldExitPage);
  const shouldExitPage = shouldExitFromBackground || shouldBlockFromRules || intentBlocksPage;

  // Update overlay with the backend's timed items + this heartbeat's
  // in-scope custom timers.
  const items = [...(session.items || []), ...inScopeCustomTimers];
  updateOverlay(items, !shouldExitPage && (session.showTimer || items.length > 0));

  updateFeedFilters(session.feedFilters);

  sessionFallbackUrl =
    typeof ruleResult.redirectUrl === "string"
      ? ruleResult.redirectUrl.trim()
      : (typeof session.fallbackUrl === "string" ? session.fallbackUrl.trim() : "");
  sessionSkipToNext = Boolean(session.skipToNextOnBlock);

  if (!shouldExitPage) consecutiveSkipCount = 0;

  if (!session.showTimer && items.length === 0 && sessionRules.length === 0) {
    stopHeartbeat();
  } else {
    ensureHeartbeat();
  }

  if (shouldExitPage) attemptExitPage();
}

function scheduleRefreshSession(delayMs = 100) {
  if (exitAttempted || extensionContextInvalid) return;
  if (refreshDebounceTimeoutId !== null) window.clearTimeout(refreshDebounceTimeoutId);
  refreshDebounceTimeoutId = window.setTimeout(() => {
    refreshDebounceTimeoutId = null;
    if (extensionContextInvalid) return;
    refreshSession();
  }, delayMs);
}

function hookHistoryNavigation() {
  const dispatch = () => {
    try { window.dispatchEvent(new Event("custom-blocker:locationchange")); } catch {}
  };
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    if (typeof original !== "function" || original.__customBlockerWrapped) continue;
    const wrapped = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      dispatch();
      return result;
    };
    wrapped.__customBlockerWrapped = true;
    history[method] = wrapped;
  }
}

function refreshSession() {
  if (exitAttempted || extensionContextInvalid) return;
  if (!isExtensionContextValid()) {
    shutdownContentScript();
    return;
  }
  lastSessionRefreshAt = Date.now();
  safeSendMessage(
    {
      type: "get-page-session",
      pageContext: buildPageContext(),
      customStateUpdate: buildCustomStateUpdate()
    },
    handleSession
  );
}

if (/^https?:$/i.test(location.protocol)) {
  refreshSession();

  document.addEventListener("visibilitychange", () => {
    lastHeartbeatAt = Date.now();
    if (!document.hidden) scheduleRefreshSession(0);
  });

  window.addEventListener("focus", () => scheduleRefreshSession(0));
  window.addEventListener("pageshow", () => scheduleRefreshSession(0));
  // For URL-change events we kick off TWO things in parallel:
  //   1. requestPageBlockCheck() — goes straight to the sandbox with
  //      the cached predicates and the new page item; if any
  //      blockPageOnVisit predicate now returns true the page exits
  //      within ~10 ms, well before the heartbeat / refreshSession
  //      round-trip would have produced the same decision.
  //   2. refreshSession / scheduleRefreshSession(0) — the regular path,
  //      which also syncs timers, persistence, and feedFilters with
  //      the background service worker.
  window.addEventListener("popstate", () => {
    requestPageBlockCheck();
    refreshSession();
  });
  window.addEventListener("hashchange", () => {
    requestPageBlockCheck();
    refreshSession();
  });
  document.addEventListener("yt-navigate-finish", () => {
    requestPageBlockCheck();
    refreshSession();
  });

  hookHistoryNavigation();
  window.addEventListener("custom-blocker:locationchange", () => {
    lastKnownUrl = location.href;
    requestPageBlockCheck();
    scheduleRefreshSession(0);
  });

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (extensionContextInvalid) return;
      if (!isExtensionContextValid()) {
        shutdownContentScript();
        return;
      }
      if (
        areaName !== "local" ||
        (!changes.blockedGroups &&
          !changes.usageTimersMs &&
          !changes.usageResetAtMs &&
          !changes.groupSnoozes &&
          !changes.customTimers &&
          !changes.customPersistence)
      ) {
        return;
      }
      // The sandbox owns the compiled-rule cache (keyed by source); a
      // freshly edited rule has different source, so its first heartbeat
      // re-compiles automatically.
      scheduleRefreshSession();
    });
  } catch (error) {
    if (isContextInvalidatedError(error)) shutdownContentScript();
  }

  navigationPollIntervalId = window.setInterval(() => {
    if (extensionContextInvalid) {
      window.clearInterval(navigationPollIntervalId);
      navigationPollIntervalId = null;
      return;
    }
    if (!isExtensionContextValid()) {
      shutdownContentScript();
      return;
    }
    const currentUrl = location.href;
    const currentHost = normalizeHostname(location.hostname);
    const onYouTube = isYouTubeHost(currentHost);
    if (currentUrl !== lastKnownUrl) {
      lastKnownUrl = currentUrl;
      refreshSession();
      return;
    }
    if (onYouTube && heartbeatIntervalId === null && Date.now() - lastSessionRefreshAt > 2000) {
      lastKnownUrl = location.href;
      refreshSession();
    }
  }, 500);

  window.addEventListener(
    "pagehide",
    () => {
      stopHeartbeat();
      stopFeedObserver();
      restoreHiddenFeedCards();
      restoreHiddenPlatformIntentElements();
      if (refreshDebounceTimeoutId !== null) window.clearTimeout(refreshDebounceTimeoutId);
      if (navigationPollIntervalId !== null) window.clearInterval(navigationPollIntervalId);
    },
    { once: true }
  );
}
