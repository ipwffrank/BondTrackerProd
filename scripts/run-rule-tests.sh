#!/usr/bin/env bash
# firebase CLI is a pkg-bundled binary that prepends its own embedded
# Node 20 to PATH for child commands. That node can't require() vitest's
# ESM .mjs entry, so PATH lookups for `node` here would still hit the
# wrong binary. We probe the common system locations directly.
#
# On Apple Silicon the universal node binary default-runs as x86_64;
# force arm64 so rollup's native bindings (rollup-darwin-arm64) load.
#
# Override with NODE_BIN=/path/to/node if your node is elsewhere.
set -euo pipefail

# Find a system node that's NOT firebase's pkg-bundled one.
if [ -n "${NODE_BIN:-}" ]; then
  : # use as-is
elif [ -x "/usr/local/bin/node" ]; then
  NODE_BIN="/usr/local/bin/node"
elif [ -x "/opt/homebrew/bin/node" ]; then
  NODE_BIN="/opt/homebrew/bin/node"
elif [ -x "/usr/bin/node" ]; then
  NODE_BIN="/usr/bin/node"
else
  echo "scripts/run-rule-tests.sh: no system node found. Set NODE_BIN=." >&2
  exit 1
fi

VITEST="node_modules/vitest/vitest.mjs"

# Detect Apple Silicon by capability, not current arch — firebase's
# emulators:exec child runs under x86_64, so `uname -m` returns x86_64
# even on M-series machines. sysctl reports the hardware truth.
if [ "$(uname -s)" = "Darwin" ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then
  exec arch -arm64 "$NODE_BIN" "$VITEST" "$@"
else
  exec "$NODE_BIN" "$VITEST" "$@"
fi
