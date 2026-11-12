#!/usr/bin/env bash
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then echo "Node.js 20+ required" >&2; exit 1; fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CONTEXTSQUIRREL_SOURCE="$SCRIPT_DIR"
node "$SCRIPT_DIR/scripts/install-claude.mjs"
