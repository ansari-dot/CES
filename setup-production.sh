#!/usr/bin/env bash
# ==============================================================================
# Cambridge Education System — Root Shortcut to Master Production Deployment
#
# Usage on Hostinger VPS (from project folder):
#   chmod +x setup-production.sh
#   sudo ./setup-production.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$SCRIPT_DIR/deployment/setup-and-deploy.sh"
exec "$SCRIPT_DIR/deployment/setup-and-deploy.sh" "$@"

