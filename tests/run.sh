#!/usr/bin/env bash
# Test runner shim — invokes JavaScriptCore's `jsc` (shipped with macOS)
# from the workspace root so that `load("helpers.js")` resolves.

set -euo pipefail

JSC=${JSC:-/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc}
if [ ! -x "$JSC" ]; then
  echo "jsc not found at $JSC. Set JSC=<path-to-jsc> and retry." >&2
  exit 127
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

run_suite() {
  local label="$1"
  local script="$2"
  local out
  out=$("$JSC" "$script" 2>&1)
  echo "$out"
  if ! echo "$out" | grep -q "__CB_TEST_RESULT__: OK"; then
    echo "[run.sh] suite '$label' FAILED" >&2
    return 1
  fi
}

failed=0
run_suite "platform-helpers" tests/runner.js || failed=1
run_suite "platform-profiles" tests/runner-platform-profiles.js || failed=1
node_out=$(node tests/runner-manifest.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'manifest-routes' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-service-worker-wrapper.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'service-worker-wrapper' FAILED" >&2
  failed=1
fi
run_suite "bridge-protocol" tests/runner-bridge-protocol.js || failed=1
run_suite "vault-classifier-extension-contract" tests/runner-vault-classifier.js || failed=1
node_out=$(node tests/runner-vault-classifier-youtube.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-youtube-collector' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-youtube-alias.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-youtube-alias' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-youtube-channel-page.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-youtube-channel-page' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-youtube-hydration.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-youtube-hydration' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-youtube-nested.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-youtube-nested' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-youtube-collab.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-youtube-collab' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-youtube-yorder.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-youtube-yorder' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-generic-collector.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-generic-collector' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-reddit.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-reddit-collector' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-platform-safety.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-platform-safety' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-bridge.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-native-bridge' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-vault-classifier-tag-ui.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'vault-classifier-tag-ui' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-local-hub-target-status.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'local-hub-target-status' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-classifier-hub-relay.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'classifier-hub-relay' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-local-hub-auth.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'local-hub-authentication' FAILED" >&2
  failed=1
fi
node_out=$(node tests/runner-local-hub-environment.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'local-hub-environment' FAILED" >&2
  failed=1
fi
run_suite "markdown-renderer" tests/runner-markdown.js || failed=1
run_suite "event-sandbox-stress" tests/runner-event-sandbox-stress.js || failed=1
node scripts/documentation-audit.js || failed=1
node scripts/translation-audit.js --check || failed=1
node scripts/generate-custom-rule-ai-reference.js --check || failed=1
node_out=$(node tests/runner-local-file-broker.js 2>&1) || failed=1
echo "$node_out"
if ! echo "$node_out" | grep -q "__CB_TEST_RESULT__: OK"; then
  echo "[run.sh] suite 'local-folder-broker' FAILED" >&2
  failed=1
fi

exit "$failed"
