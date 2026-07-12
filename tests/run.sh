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
