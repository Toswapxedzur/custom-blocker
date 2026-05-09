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

OUT=$("$JSC" tests/runner.js 2>&1)
echo "$OUT"
if echo "$OUT" | grep -q "__CB_TEST_RESULT__: OK"; then
  exit 0
else
  exit 1
fi
