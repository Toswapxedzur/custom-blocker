/* Web-app bridge protocol regression tests (jsc-compatible). */

load("bridge-protocol.js");
load("tests/log.js");

const log = globalThis.__cbTestLog.makeLogger({ colour: true });
const bridge = globalThis.CBBridgeProtocol;

function assert(name, condition, data) {
  if (condition) log.pass(name, data);
  else log.fail(name, data);
  return Boolean(condition);
}

function assertEqual(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    log.pass(name);
    return true;
  }
  log.fail(name, { expected, actual });
  return false;
}

log.section("P1: fixed local hub protocol");
assertEqual("protocol version is v3", bridge.PROTOCOL_VERSION, 3);
assert("browser programs may connect", bridge.isRemoteProgram("firefox"));
assert("desktop identities may not impersonate a remote peer", !bridge.isRemoteProgram("windowsapp"));
assert("Mac Vault is a recognised local hub", bridge.isHubProgram("macapp"));

log.section("P2: distinct desktop identities");
assertEqual("Mac identity remains macapp", bridge.nativeProgramId("macapp"), "macapp");
assertEqual("Windows identity remains windowsapp", bridge.nativeProgramId("windowsapp"), "windowsapp");
assertEqual("Classifier remains a desktop peer identity", bridge.nativeProgramId("classifier"), "classifier");
assertEqual("client learns Windows hub identity", bridge.hubProgramFromStatus({ hubProgram: "windowsapp" }), "windowsapp");
assertEqual("client learns Classifier hub identity", bridge.hubProgramFromStatus({ hubProgram: "classifier" }), "classifier");
assertEqual("public broker identity is no longer accepted", bridge.hubProgramFromStatus({ hubProgram: "vault-broker" }), "");

log.section("P3: pinned group identity");
const groups = [
  { id: "old-id", name: "Focus" },
  { id: "new-id", name: "Focus" }
];
const pinned = {
  groupName: "Focus",
  members: [{ program: "chrome", groupName: "Focus", groupId: "old-id" }]
};
assertEqual("pinned cluster resolves the exact group", bridge.groupForCluster(groups, pinned, "chrome").id, "old-id");
assertEqual("missing pinned id never re-adopts a same-named group", bridge.groupForCluster([groups[1]], pinned, "chrome"), null);
assertEqual(
  "legacy cluster without an id still falls back by name",
  bridge.groupForCluster([groups[1]], { groupName: "Focus", members: [{ program: "chrome", groupName: "Focus" }] }, "chrome").id,
  "new-id"
);
assertEqual("cluster lookup uses pinned id", bridge.clusterForGroup([pinned], groups[0], "chrome"), pinned);
assertEqual("same-name replacement does not inherit cluster", bridge.clusterForGroup([pinned], groups[1], "chrome"), null);

const counts = log.counts();
log.summary("BRIDGE PROTOCOL TOTAL " + counts.total + "  PASS " + counts.pass + "  FAIL " + counts.fail);
if (counts.fail > 0) {
  log.summary("__CB_TEST_RESULT__: FAIL");
  throw new Error("bridge protocol tests failed");
}
log.summary("__CB_TEST_RESULT__: OK");
