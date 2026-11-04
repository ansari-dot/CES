#!/usr/bin/env bash
# ==============================================================================
# Cambridge Education System - One-Command VPS Deployment & Update Script
#
# Usage:
#   chmod +x deployment/deploy.sh
#   ./deployment/deploy.sh
# ==============================================================================

set -e

echo "====================================================="
echo "   Cambridge Education System - Production Deploy   "
echo "====================================================="

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. Pull latest code (if using git on server)
if [ -d ".git" ]; then
    echo -e "\n📥 [1/6] Pulling latest code from git repository..."
    git pull origin main || echo "Git pull skipped or already up to date."
fi

# 2. Setup and install Backend dependencies
echo -e "\n📦 [2/6] Installing backend dependencies..."
cd "$PROJECT_ROOT/backend"
npm install --production=false

# 3. Database migrations and sync
echo -e "\n🗄️ [3/6] Running database migrations..."
npm run migrate
node scripts/sync-database.js || true

# 4. Build all 4 Vite Frontend Portals
echo -e "\n🏗️ [4/6] Building all 4 frontend portals for production..."

echo "  -> Building Principal & Admin Portal (/principle)..."
cd "$PROJECT_ROOT/principle"
npm install
npm run build

echo "  -> Building Teacher & Faculty Portal (/teacher)..."
cd "$PROJECT_ROOT/teacher"
npm install
npm run build

echo "  -> Building Student Portal (/student)..."
cd "$PROJECT_ROOT/student"
npm install
npm run build

echo "  -> Building Parent & Guardian Portal (/parent)..."
cd "$PROJECT_ROOT/parent"
npm install
npm run build

# 5. Restart PM2 Process
echo -e "\n🚀 [5/6] Starting / Reloading backend with PM2..."
cd "$PROJECT_ROOT"
mkdir -p logs
if pm2 describe ces-backend-api > /dev/null 2>&1; then
    pm2 reload ces-backend-api --update-env
    echo "  ✅ PM2 process 'ces-backend-api' reloaded with zero downtime."
else
    pm2 start deployment/ecosystem.config.cjs --env production
    pm2 save
    echo "  ✅ PM2 process 'ces-backend-api' started and saved."
fi

# 6. Test Nginx Configuration & Reload
echo -e "\n🌐 [6/6] Reloading Nginx web server..."
if command -v nginx > /dev/null 2>&1; then
    sudo nginx -t
    sudo systemctl reload nginx
    echo "  ✅ Nginx reloaded successfully."
else
    echo "  ⚠️ Nginx not installed or not in PATH. Please install and configure Nginx."
fi

echo -e "\n====================================================="
echo "🎉 Deployment completed successfully!"
echo "   Backend API & BullMQ Queues: http://127.0.0.1:5000"
echo "   Monitor status with: pm2 status"
echo "   Monitor logs with:   pm2 logs ces-backend-api"
echo "=====================================================\n"

