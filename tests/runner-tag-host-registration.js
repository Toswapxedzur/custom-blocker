/* A retired private host must not retain the live correction navigation exemption. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
const registration = source.slice(source.indexOf("const cbPillHosts = new WeakSet();"), source.indexOf("// One capture-phase interceptor"));
const start = source.indexOf("function cbBlockNavEvent(");
const end = source.indexOf("function cbInstallClickInterceptor(", start);
const context = vm.createContext({ window: {}, cbContentBlockProfile: () => ({ links: /\/watch/ }) });
vm.runInContext(registration + source.slice(start, end), context);
const card = {}, link = { getAttribute: () => "/watch?v=ownedfixture" };
function blocked(host) {
  let prevented = false;
  const target = { parentElement: host, closest(selector) {
    if (selector === '[data-cb-content-blocked="true"]') return card;
    if (selector === "a[href]") return link;
    return null;
  } };
  context.cbBlockNavEvent({ target, preventDefault() { prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {} });
  return prevented;
}
const retired = { parentElement: null }, current = { parentElement: null };
assert.equal(blocked(retired), true);
context.window.cbRegisterPillHost(retired);
assert.equal(blocked(retired), false, "Live correction host retains its intended exemption");
context.window.cbUnregisterPillHost(retired);
assert.equal(blocked(retired), true, "Retired host is ordinary blocked-card content again");
context.window.cbRegisterPillHost(current);
assert.equal(blocked(current), false);
assert.equal(blocked(retired), true, "Registering a new owner does not revive the retired one");
context.window.cbUnregisterPillHost(current);
assert.equal(blocked(current), true);
console.log("PASS private host registration retirement preserves live correction and blocked-link behavior");
