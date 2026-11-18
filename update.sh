#!/usr/bin/env bash
# Root-level shortcut for deployment/deploy.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/deployment/deploy.sh"
