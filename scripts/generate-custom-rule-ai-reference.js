#!/usr/bin/env node
"use strict";

/*
 * Produces the prompt reference consumed by "Let AI Code". Event names,
 * platform capabilities, and limits come from the canonical rule engine;
 * the remaining lines describe its public API contract.
 */

const fs = require("node:fs");
const path = require("node:path");

const workspace = path.resolve(__dirname, "..", "..");
const runtimePath = path.join(workspace, "customBlocker", "event-sandbox.js");
const helpersPath = path.join(workspace, "customBlocker", "helpers.js");
const targets = [
  path.join(workspace, "customBlocker", "custom-rule-ai-reference.js"),
  path.join(workspace, "blockerWebsite", "vendor", "ext", "custom-rule-ai-reference.js")
];
const integrations = [
  {
    html: path.join(workspace, "customBlocker", "popup.html"),
    script: path.join(workspace, "customBlocker", "popup.js")
  },
  {
    html: path.join(workspace, "blockerWebsite", "vendor", "ext", "popup.html"),
    script: path.join(workspace, "blockerWebsite", "vendor", "ext", "popup.js")
  }
];

function fail(message) {
  throw new Error("custom-rule-ai-reference: " + message);
}

function extractArrayBody(source, name) {
  const marker = "const " + name + " = [";
  const start = source.indexOf(marker);
  if (start < 0) fail("could not find " + name);
  const bodyStart = start + marker.length;
  let depth = 1;
  let quote = "";
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === String.fromCharCode(96)) {
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(bodyStart, index);
    }
  }
  fail("could not close " + name);
}

function quotedStrings(source) {
  const withoutLineComments = source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  return [...withoutLineComments.matchAll(/["']([^"'\\]*(?:\\.[^"'\\]*)*)["']/g)]
    .map((match) => match[1].replace(/\\(["'])/g, "$1"));
}

function unique(values) {
  return [...new Set(values)];
}

function numberConstant(source, name) {
  const match = source.match(new RegExp("const " + name + "\\s*=\\s*(\\d+)"));
  if (!match) fail("could not find " + name);
  return Number(match[1]);
}

function platformBlock(source, name) {
  const specStart = source.indexOf("const PLATFORM_API_SPEC = {");
  const start = source.indexOf("    " + name + ": [", specStart);
  let end = source.indexOf("\n    ],", start);
  if (end < 0) end = source.indexOf("\n    ]\n", start);
  if (start < 0 || end < 0) fail("could not parse " + name + " platform API");
  return source.slice(start, end);
}

function platformMatrix(helperSource, platformNames) {
  return platformNames.map((name) => {
    const source = platformBlock(helperSource, name);
    const slots = unique([...source.matchAll(/kind:\s*"predicate",\s*slot:\s*"([^"]+)"/g)].map((match) => match[1]));
    const surfaces = unique(
      [...source.matchAll(/kind:\s*"intent",\s*intentKind:\s*"([^"]+)"/g)]
        .map((match) => match[1] === "homePage" ? "home" : match[1])
    );
    const timerSlots = unique(
      [...source.matchAll(/kind:\s*"subsectionTimer",\s*slot:\s*"([^"]+)"/g)].map((match) => match[1])
    );
    return name + ": slots=" + (slots.join(", ") || "none") +
      "; surfaces=" + (surfaces.join(", ") || "none") +
      "; timerSlots=" + (timerSlots.join(", ") || "none") + ".";
  });
}

function assertSurface(helperSource, eventSource) {
  const helpers = [
    "getLogHelper", "getDomainHelper", "getTimerHelper", "getPanelHelper",
    "getPersistenceHelper", "getRedirectionHelper", "getDOMHelper",
    "getNavigationHelper", "getStorageHelper", "getLocalFolderHelper",
    "getTabHelper", "getWindowHelper", "getPlatformHelper", "platform: (name)"
  ];
  const events = [
    "BUILTIN_EVENT_TYPES", "preventDefault()", "stopPropagation()",
    "setResult(value)", "setRedirectLink(url)", "MAX_HANDLERS_PER_GROUP"
  ];
  for (const name of helpers) {
    if (!helperSource.includes(name)) fail("public helper marker disappeared: " + name);
  }
  for (const name of events) {
    if (!eventSource.includes(name)) fail("event API marker disappeared: " + name);
  }
}

function assertIntegrations() {
  for (const integration of integrations) {
    const html = fs.readFileSync(integration.html, "utf8");
    const script = fs.readFileSync(integration.script, "utf8");
    if (!html.includes("custom-rule-ai-reference.js")) {
      fail(path.relative(workspace, integration.html) + " does not load the generated reference");
    }
    if (!script.includes("function buildCustomRuleAiPrompt") || !script.includes("CUSTOM_RULE_AI_REFERENCE")) {
      fail(path.relative(workspace, integration.script) + " does not consume the generated reference");
    }
  }
}

function buildReference(eventSource, helperSource) {
  assertSurface(helperSource, eventSource);
  assertIntegrations();
  const events = unique(quotedStrings(extractArrayBody(eventSource, "BUILTIN_EVENT_TYPES")));
  const platforms = unique(quotedStrings(extractArrayBody(helperSource, "PLATFORM_LIST")));
  const caps = {
    handlers: numberConstant(eventSource, "MAX_HANDLERS_PER_GROUP"),
    logs: numberConstant(helperSource, "HELPERS_MAX_LOGS_PER_DISPATCH"),
    domOps: numberConstant(helperSource, "HELPERS_MAX_DOM_OPS_PER_DISPATCH"),
    intents: numberConstant(helperSource, "HELPERS_MAX_INTENTS_PER_DISPATCH"),
    panels: numberConstant(helperSource, "HELPERS_MAX_PANELS_PER_GROUP"),
    controls: numberConstant(helperSource, "HELPERS_MAX_PANEL_CONTROLS")
  };

  return [
    "CUSTOM_RULE_API_REFERENCE",
    "Use only the current API below. Do not invent helpers or use legacy convenience methods.",
    "SOURCE_FORM: Return one JavaScript rule source. Prefer (events, helpers) => { /* register handlers */ }. Bare source may use events or legacy event.",
    "LIFECYCLE: Top-level code runs once on Run; register handlers there. Run/disable/delete unloads prior handlers. Re-running clears rule timers, panels, persistence, and platform predicates.",
    "SAFETY: No busy loops, polling loops, fetch/network calls, external packages, browser globals, chrome APIs, eval, or imports. Keep predicates and handlers synchronous, pure, bounded, and fast.",
    "LIMITS: " + caps.handlers + " handlers/group, " + caps.logs + " logs/dispatch, " + caps.domOps + " DOM operations/dispatch, " + caps.intents + " intents/dispatch, " + caps.panels + " panels/group, " + caps.controls + " controls/panel.",
    "BUILT_IN_EVENTS: " + events.join(", ") + ".",
    "EVENTS: events.on(type,id,handler,{priority?,intervalMs?}) registers/replaces and returns boolean; register is an alias. events.off/unregister(type,id), unregisterAll(type), getEvent(type,id), getEvents(type), countRegistered(type), emit/post(type,data,{scope:'group'|'global'}) are available. Higher priority runs first. intervalMs throttles a tickEvent handler. Names beginning with _ are reserved.",
    "EVENT_OBJECT: ev.type, ev.groupId, ev.tabId, ev.pageId, ev.url, ev.hostname, ev.time, ev.data. ev.preventDefault() blocks/exits current page; call ev.setRedirectLink(url) first for a target. ev.stopPropagation() stops later handlers. ev.setResult(string) redirects if the dispatch is not blocked; ev.setResult(1) cancels an accumulated block; other numeric results do not navigate. ev.getResult(), ev.post(), ev.getRedirectLink(), ev.close(tabIdOrUrl?), ev.block(hostPattern?), ev.unblock(hostPattern?), ev.open() are available; open is a browser-extension no-op.",
    "EVENT_DETAILS: webChangedEvent data includes previousUrl, previousHostname, isFirstLoad, isReload, sameDomain. timerEnded data: timerId, displayName, direction, currentMs. panelEvent also exposes panelId, controlId, eventName, value, values, key, code, keyInfo on ev. localFileEvent also exposes eventName, action, path, directoryPath, requestId, ok, text, value, entries, exists, bytes, error. pageHeartbeatEvent carries visible-page elapsedMs.",
    "HELPERS_ROOT: helpers.now, helpers.currentUrl, helpers.groupId; helpers.log/warn/error, logScreen/warnScreen/errorScreen, logPopup/warnPopup/errorPopup; getLogHelper(), getDomainHelper()/getDomainUtility(), getTimerHelper(), getPanelHelper(), getPersistenceHelper(), getRedirectionHelper(), getDOMHelper(), getNavigationHelper(), getStorageHelper(), getLocalFolderHelper(), getTabHelper(), getWindowHelper(), getPlatformHelper(), platform(name?).",
    "LOG: ordinary log/warn/error writes popup log and follows page-toast Settings. *Screen is page only; *Popup is popup only.",
    "DOMAIN: d.hostnameOf(url), pathnameOf(url), matches(host,site), getPlatform(url), isYouTubeHost/isTikTokHost/isInstagramHost/isFacebookHost/isTwitchHost/isRedditHost/isDiscordHost, isEmptyStartPage(url), matchesAny(url,patterns), pathStartsWith(url,path), queryHas(url,key,value?), queryGet(url,key), isSearchPage(url), isInfiniteFeedUrl(url), sameSection(a,b). d.youtube()/tiktok()/instagram()/facebook()/twitch() expose isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId.",
    "TIMER: tm.create(options) resets; tm.getOrCreateTimer(options) creates only when missing. Options: id, displayName, direction forward|backward, currentMs, minMs, maxMs, stepMs, overlayStyle, scope(url), domain(url), accrueWhen(url). scope controls visible-time accrual; domain controls overlay display and defaults to scope; accrueWhen is an extra gate. Methods: delete, pause, resume, setDirection, setCurrentMs, addMs, subMs, setBounds, setStep, setOverlayStyle, setDisplayName, getCurrentMs, isExpired, isPaused, getDirection, getDisplayName, exists, getState, list. Timers never block by themselves: explicitly preventDefault when expired.",
    "PANEL: pn.create(config), getOrCreatePanel(config), update, delete, show, hide, setValue, updateControl, enable, disable, setOptions, setText, setTheme, setTitle, setDescription, getValue, getValues, getState, list, notice, confirm, checklist, form. Config supports id/title/description/body/position/align/layout/priority/width/textSize/fontSize/ariaLabel/role/autoFocus/theme/colors/controls/visible/scope/domain and inline onEvent/onChange/onClick/onInput/onFocus/onBlur/onSubmit/onClose/onMount/onUnmount/onKey/onKeyDown handlers.",
    "PANEL_CONTROLS: text, checkbox, select, textInput, textarea, button, section, timer, numberInput, range, toggle, radio, date, time, color, pin, html. Use id/type/label/value/options/min/max/step/placeholder/disabled/layout/priority/width/height/rows as needed. section nests controls; timer uses timerId or a snapshot; html is sanitized (no script, inline handlers, or javascript URLs).",
    "PERSISTENCE: p.get(key,defaultValue), set(key,jsonValue), delete(key), has(key), keys(), entries(), clear(), size(). Values are JSON-only. Storage helper additionally provides requestAsyncGet/requestAsyncSet; do not assume a synchronous result event.",
    "ACTIONS: r.get/getRedirectLink, r.set/setRedirectLink(url), r.createMessageUrl(message). dom.hide/show, addClass/removeClass, setText, click, injectCss/removeInjectedCss, scrollTo. nav.back/forward/reload/goTo/closeTab. tabs.list/getActiveTab/getById/countOpen/requestRefresh. win.current/all/close/closeTab/block/unblock/isBlocked/getBlocked. Actions are queued and bounded.",
    "LOCAL_FOLDER: lf.requestRead/requestWrite/requestAppend/requestList/requestExists/requestReadJson/requestWriteJson are asynchronous and require a user-granted Local File Folder. Paths are relative to that root; file operations allow .txt, .csv, .json only. Correlate results with localFileEvent.requestId.",
    "PLATFORM: helpers.platform(name) or helpers.platform().youtube(). Raw methods: hide(slot,predicate,opts?), hide(predicate,opts?), allow(slot,predicate,opts?), allow(predicate,opts?), show(slot?), surface(name,'hide'|'show'), timer(slot,opts), rescan(), snapshot(), slots(), surfaces(), timerSlots(), plus URL classifiers. One predicate owns group/platform/slot; later calls replace it. allow creates a rescue/exception verdict. opts supports blockPageOnVisit. Call rescan after state affecting an existing-card predicate changes.",
    "PLATFORM_MATRIX: " + platformMatrix(helperSource, platforms).join(" "),
    "PREDICATE_ITEM: url, name/title, author, channelId, length, views, publishedAt, description, live, sponsored, algorithmic, videoForm. Many fields may be null; null-check and fail open.",
    "SAFE_PATTERN: Whole-page block = handler for openWebEvent/webChangedEvent, test URL, optionally set redirect/message URL, then ev.preventDefault(). Feed filtering = install platform predicate during registration; call rescan after predicate state changes.",
    "END_CUSTOM_RULE_API_REFERENCE"
  ].join("\n");
}

function render(reference) {
  return [
    "/* Generated by customBlocker/scripts/generate-custom-rule-ai-reference.js. Do not edit by hand. */",
    "(function exposeCustomRuleAiReference(global) {",
    "  global.CUSTOM_RULE_AI_REFERENCE = " + JSON.stringify(reference) + ";",
    "})(globalThis);",
    ""
  ].join("\n");
}

const check = process.argv.includes("--check");
const expected = render(buildReference(fs.readFileSync(runtimePath, "utf8"), fs.readFileSync(helpersPath, "utf8")));
for (const target of targets) {
  const actual = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  if (check) {
    if (actual !== expected) fail(path.relative(workspace, target) + " is stale; run the generator.");
  } else {
    fs.writeFileSync(target, expected);
    console.log("Generated " + path.relative(workspace, target));
  }
}
