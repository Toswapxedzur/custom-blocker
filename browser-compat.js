/* browser-compat.js — cross-engine WebExtension namespace bridge.
 *
 * This codebase calls the `chrome.*` API in BOTH promise style
 * (`await chrome.storage.local.get(...)`) and callback style
 * (`chrome.storage.local.get("k", (r) => ...)`).
 *
 *   - Chromium (Chrome/Edge/Brave/Opera/…): `chrome.*` already supports both
 *     promises and callbacks, and the `browser` global does not exist. This
 *     file is a no-op there.
 *   - Firefox / Safari: there are two namespaces — `chrome.*` is callback
 *     based and `browser.*` is promise based, and NEITHER natively supports
 *     both styles. We expose a single `chrome` that does, by proxying the
 *     promise-based `browser` and adapting the listed async leaf methods so
 *     they also accept a trailing Chrome-style callback. Event objects
 *     (`onX.addListener`) and synchronous methods (`runtime.getURL`,
 *     `i18n.getMessage`, …) are passed through untouched.
 *
 * Load this FIRST, before any other extension script, in every context that
 * touches the extension APIs (background, content scripts, popup, offscreen,
 * message page).
 */
(function () {
  "use strict";

  var g = (typeof globalThis !== "undefined")
    ? globalThis
    : (typeof self !== "undefined" ? self : this);

  // Only engines that expose a separate promise-based `browser` need bridging.
  if (typeof g.browser === "undefined" || !g.browser || !g.browser.runtime) {
    return;
  }
  if (g.__cbBrowserCompatInstalled) return;
  g.__cbBrowserCompatInstalled = true;

  // Fully-qualified leaf methods that follow the Node-style async contract
  // (return a value / accept a trailing callback). Anything not listed here
  // is passed through verbatim so event emitters and sync getters keep their
  // native behavior.
  var ASYNC_METHODS = {
    "storage.local.get": 1, "storage.local.set": 1, "storage.local.remove": 1, "storage.local.clear": 1,
    "storage.session.get": 1, "storage.session.set": 1, "storage.session.remove": 1, "storage.session.clear": 1,
    "storage.sync.get": 1, "storage.sync.set": 1, "storage.sync.remove": 1, "storage.sync.clear": 1,
    "storage.managed.get": 1,
    "runtime.sendMessage": 1, "runtime.sendNativeMessage": 1, "runtime.getPlatformInfo": 1,
    "runtime.openOptionsPage": 1, "runtime.setUninstallURL": 1, "runtime.getBackgroundPage": 1,
    "tabs.query": 1, "tabs.sendMessage": 1, "tabs.create": 1, "tabs.update": 1, "tabs.remove": 1,
    "tabs.get": 1, "tabs.getCurrent": 1, "tabs.reload": 1, "tabs.executeScript": 1, "tabs.insertCSS": 1,
    "tabs.captureVisibleTab": 1,
    "windows.create": 1, "windows.update": 1, "windows.remove": 1, "windows.get": 1,
    "windows.getCurrent": 1, "windows.getAll": 1, "windows.getLastFocused": 1,
    "declarativeNetRequest.updateDynamicRules": 1, "declarativeNetRequest.getDynamicRules": 1,
    "declarativeNetRequest.updateSessionRules": 1, "declarativeNetRequest.getSessionRules": 1,
    "declarativeNetRequest.getEnabledRulesets": 1, "declarativeNetRequest.updateEnabledRulesets": 1,
    "declarativeNetRequest.getAvailableStaticRuleCount": 1, "declarativeNetRequest.getMatchedRules": 1,
    "alarms.get": 1, "alarms.getAll": 1, "alarms.clear": 1, "alarms.clearAll": 1, "alarms.create": 1,
    "permissions.contains": 1, "permissions.request": 1, "permissions.getAll": 1, "permissions.remove": 1,
    "scripting.executeScript": 1, "scripting.insertCSS": 1, "scripting.removeCSS": 1,
    "scripting.registerContentScripts": 1, "scripting.unregisterContentScripts": 1,
    "scripting.getRegisteredContentScripts": 1, "scripting.updateContentScripts": 1,
    "action.setBadgeText": 1, "action.getBadgeText": 1, "action.setBadgeBackgroundColor": 1,
    "action.setTitle": 1, "action.getTitle": 1, "action.setIcon": 1, "action.setPopup": 1,
    "action.getPopup": 1, "action.enable": 1, "action.disable": 1,
    "webNavigation.getFrame": 1, "webNavigation.getAllFrames": 1,
    "offscreen.createDocument": 1, "offscreen.closeDocument": 1, "offscreen.hasDocument": 1
  };

  function adaptAsync(fn, ctx, path) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var last = args.length ? args[args.length - 1] : undefined;
      if (typeof last === "function") {
        var cb = last;
        var rest = args.slice(0, -1);
        Promise.resolve()
          .then(function () { return fn.apply(ctx, rest); })
          .then(
            function (result) { try { cb(result); } catch (_) {} },
            function (err) {
              try {
                if (g.chrome && g.chrome.runtime) {
                  g.chrome.runtime.lastError = {
                    message: String((err && err.message) || err)
                  };
                }
              } catch (_) {}
              try { cb(undefined); } catch (_) {}
            }
          );
        return undefined;
      }
      return fn.apply(ctx, args);
    };
  }

  function makeProxy(target, path) {
    return new Proxy(target, {
      get: function (obj, prop) {
        var value = obj[prop];
        if (typeof prop === "symbol") return value;
        var childPath = path ? path + "." + prop : prop;
        if (typeof value === "function") {
          if (ASYNC_METHODS[childPath]) return adaptAsync(value, obj, childPath);
          return value.bind(obj);
        }
        if (value && typeof value === "object" && !(value instanceof Date)) {
          return makeProxy(value, childPath);
        }
        return value;
      }
    });
  }

  try {
    g.chrome = makeProxy(g.browser, "");
  } catch (error) {
    try {
      console.warn("[CustomBlocker] browser-compat could not alias chrome:", error);
    } catch (_) {}
  }
})();
