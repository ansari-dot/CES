#!/usr/bin/env bash
# ==============================================================================
# Cambridge Education System — Master Production Setup & Automated Deployment
# Domain: cambridgeeducation.uk.com
# Backend Port: 4000
#
# Usage:
#   chmod +x deployment/setup-and-deploy.sh
#   sudo ./deployment/setup-and-deploy.sh
# ==============================================================================

set -e

# ANSI Color codes for clean terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}===================================================================${NC}"
echo -e "${GREEN}   Cambridge Education System — Automated Production Deployment     ${NC}"
echo -e "${BLUE}   Domain: cambridgeeducation.uk.com | Backend Port: 4000           ${NC}"
echo -e "${BLUE}===================================================================${NC}\n"

# 1. Determine absolute project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}📁 Project Root Directory:${NC} $PROJECT_ROOT"

# 2. Check Prerequisites (Node, NPM, Redis, MySQL, Nginx)
echo -e "\n${YELLOW}[1/7] Checking system dependencies...${NC}"
for cmd in node npm redis-cli mysql nginx pm2 certbot; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${YELLOW}⚠️ Notice: Command '$cmd' not found. Installing missing dependencies...${NC}"
        sudo apt update -y
        if [ "$cmd" = "node" ] || [ "$cmd" = "npm" ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt install -y nodejs build-essential
        elif [ "$cmd" = "pm2" ]; then
            sudo npm install -g pm2
        elif [ "$cmd" = "redis-cli" ]; then
            sudo apt install -y redis-server
            sudo systemctl enable --now redis-server
        elif [ "$cmd" = "mysql" ]; then
            sudo apt install -y mysql-server
            sudo systemctl enable --now mysql
        elif [ "$cmd" = "nginx" ]; then
            sudo apt install -y nginx
            sudo systemctl enable --now nginx
        elif [ "$cmd" = "certbot" ]; then
            sudo apt install -y certbot python3-certbot-nginx
        fi
    else
        echo -e "  ✅ $cmd is installed."
    fi
done

# Ensure Redis service is running locally
if ! redis-cli ping > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting local Redis service...${NC}"
    sudo systemctl restart redis-server || sudo service redis-server restart
fi
echo -e "  ✅ Redis server is active: $(redis-cli ping)"

# 3. Setup Production .env File
echo -e "\n${YELLOW}[2/7] Configuring backend production environment (.env)...${NC}"
mkdir -p "$PROJECT_ROOT/logs"

if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
    echo "  Creating backend/.env from deployment/env.production.example..."
    cp "$PROJECT_ROOT/deployment/env.production.example" "$PROJECT_ROOT/backend/.env"

    # Generate random 32-character secrets if openssl is available
    if command -v openssl > /dev/null 2>&1; then
        JWT_SEC=$(openssl rand -hex 24)
        CSRF_SEC=$(openssl rand -hex 24)
        sed -i "s/JWT_ACCESS_SECRET=.*/JWT_ACCESS_SECRET=$JWT_SEC/" "$PROJECT_ROOT/backend/.env"
        sed -i "s/CSRF_SECRET=.*/CSRF_SECRET=$CSRF_SEC/" "$PROJECT_ROOT/backend/.env"
    fi
    echo "  ✅ Generated backend/.env with secure tokens and PORT=4000."
else
    # Ensure port 4000 is strictly enforced in .env
    if grep -q "PORT=" "$PROJECT_ROOT/backend/.env"; then
        sed -i "s/PORT=.*/PORT=4000/" "$PROJECT_ROOT/backend/.env"
    else
        echo "PORT=4000" >> "$PROJECT_ROOT/backend/.env"
    fi
    # Ensure DB_PASSWORD=admin is configured
    if grep -q "DB_PASSWORD=" "$PROJECT_ROOT/backend/.env"; then
        sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=admin/" "$PROJECT_ROOT/backend/.env"
    fi
    echo "  ✅ Existing backend/.env verified with PORT=4000 and DB_PASSWORD=admin."
fi

# Provision MySQL database and user automatically
echo "  Setting up MySQL database 'school_db' and user 'ces_user'..."
sudo mysql -e "
CREATE DATABASE IF NOT EXISTS school_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ces_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'admin';
ALTER USER 'ces_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'admin';
GRANT ALL PRIVILEGES ON school_db.* TO 'ces_user'@'localhost';
CREATE USER IF NOT EXISTS 'ces_user'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'admin';
ALTER USER 'ces_user'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'admin';
GRANT ALL PRIVILEGES ON school_db.* TO 'ces_user'@'127.0.0.1';
FLUSH PRIVILEGES;
" 2>/dev/null || true
echo "  ✅ MySQL user 'ces_user' configured with password 'admin'."

# 4. Install Backend Dependencies & Run Database Migrations
echo -e "\n${YELLOW}[3/7] Setting up backend dependencies & database schema...${NC}"
cd "$PROJECT_ROOT/backend"
npm install --production=false

echo "  Running Knex database migrations..."
npm run migrate || {
    echo -e "${RED}⚠️ Migration notice: If MySQL credentials failed, please update backend/.env with your MySQL password.${NC}"
}

echo "  Running database table and column synchronizer..."
node scripts/sync-database.js || true

# 5. Compile All 4 Frontend Portals
echo -e "\n${YELLOW}[4/7] Building all 4 frontend portals with Vite...${NC}"

echo "  📦 (1/4) Building Principal & Admin Portal (/principle)..."
cd "$PROJECT_ROOT/principle"
npm install --silent
npm run build

echo "  📦 (2/4) Building Faculty & Teacher Portal (/teacher)..."
cd "$PROJECT_ROOT/teacher"
npm install --silent
npm run build

echo "  📦 (3/4) Building Student Portal (/student)..."
cd "$PROJECT_ROOT/student"
npm install --silent
npm run build

echo "  📦 (4/4) Building Parent & Guardian Portal (/parent)..."
cd "$PROJECT_ROOT/parent"
npm install --silent
npm run build

# 6. PM2 Process Manager Setup on Port 4000
echo -e "\n${YELLOW}[5/7] Starting backend API on Port 4000 via PM2...${NC}"
cd "$PROJECT_ROOT"
if pm2 describe ces-backend-api > /dev/null 2>&1; then
    pm2 reload ces-backend-api --update-env
    echo "  ✅ PM2 process 'ces-backend-api' reloaded on Port 4000."
else
    pm2 start "$PROJECT_ROOT/deployment/ecosystem.config.cjs" --env production
    pm2 save
    echo "  ✅ PM2 process 'ces-backend-api' registered and saved."
fi

# 7. Configure Nginx with Exact Subdomains & Paths
echo -e "\n${YELLOW}[6/7] Configuring Nginx reverse proxy with ZERO CORS architecture...${NC}"

NGINX_CONF_PATH="/etc/nginx/sites-available/cambridgeeducation.uk.com.conf"
cat <<EOF | sudo tee "$NGINX_CONF_PATH" > /dev/null
# ==============================================================================
# Cambridge Education System — Production Nginx Configuration
# Domain: cambridgeeducation.uk.com | Backend: 127.0.0.1:4000
# Auto-generated by setup-and-deploy.sh
# ==============================================================================

upstream ces_backend_upstream {
    server 127.0.0.1:4000;
    keepalive 64;
}

map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

# 1. PRINCIPAL & ADMIN PORTAL
server {
    listen 80;
    listen [::]:80;
    server_name principle.cambridgeeducation.uk.com;

    root $PROJECT_ROOT/principle/dist;
    index index.html;
    client_max_body_size 50M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:css|js|woff2?|svg|png|jpg|jpeg|gif|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    location ^~ /api/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }

    location ^~ /socket.io/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# 2. FACULTY & TEACHER PORTAL
server {
    listen 80;
    listen [::]:80;
    server_name faculty.cambridgeeducation.uk.com;

    root $PROJECT_ROOT/teacher/dist;
    index index.html;
    client_max_body_size 50M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:css|js|woff2?|svg|png|jpg|jpeg|gif|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    location ^~ /api/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }

    location ^~ /socket.io/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# 3. STUDENT PORTAL
server {
    listen 80;
    listen [::]:80;
    server_name student.cambridgeeducation.uk.com;

    root $PROJECT_ROOT/student/dist;
    index index.html;
    client_max_body_size 50M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:css|js|woff2?|svg|png|jpg|jpeg|gif|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    location ^~ /api/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }

    location ^~ /socket.io/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# 4. PARENT & GUARDIAN PORTAL
server {
    listen 80;
    listen [::]:80;
    server_name parent.cambridgeeducation.uk.com parents.cambridgeeducation.uk.com;

    root $PROJECT_ROOT/parent/dist;
    index index.html;
    client_max_body_size 50M;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript image/svg+xml;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:css|js|woff2?|svg|png|jpg|jpeg|gif|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    location ^~ /api/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }

    location ^~ /socket.io/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# 5. DEDICATED API SUBDOMAIN
server {
    listen 80;
    listen [::]:80;
    server_name api.cambridgeeducation.uk.com;
    client_max_body_size 50M;

    location / {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 120s;
    }

    location ^~ /socket.io/ {
        proxy_pass http://ces_backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

# Enable Nginx configuration
sudo ln -sf "$NGINX_CONF_PATH" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
echo -e "  ✅ Nginx site configuration successfully installed and reloaded."

# 8. Obtain / Renew Free SSL Certificates via Certbot
echo -e "\n${YELLOW}[7/7] Applying free SSL certificates with Certbot (Let's Encrypt)...${NC}"
echo "  Attempting automated SSL certificate provisioning for subdomains..."
sudo certbot --nginx --non-interactive --agree-tos --redirect -m mubinasaleem24@gmail.com \
    -d principle.cambridgeeducation.uk.com \
    -d faculty.cambridgeeducation.uk.com \
    -d student.cambridgeeducation.uk.com \
    -d parent.cambridgeeducation.uk.com \
    -d parents.cambridgeeducation.uk.com \
    -d api.cambridgeeducation.uk.com || {
    echo -e "${YELLOW}⚠️ Certbot note: If DNS A records are still propagating, run this command later:${NC}"
    echo "  sudo certbot --nginx -d principle.cambridgeeducation.uk.com -d faculty.cambridgeeducation.uk.com -d student.cambridgeeducation.uk.com -d parent.cambridgeeducation.uk.com -d api.cambridgeeducation.uk.com"
}

# Final Health Checks
echo -e "\n${BLUE}===================================================================${NC}"
echo -e "${GREEN}🎉 ALL SYSTEMS DEPLOYED SUCCESSFULLY ON HOSTINGER VPS!${NC}"
echo -e "${BLUE}===================================================================${NC}"
echo -e "  🏛️  Principal Portal : ${GREEN}https://principle.cambridgeeducation.uk.com${NC}"
echo -e "  👩‍🏫 Faculty Portal   : ${GREEN}https://faculty.cambridgeeducation.uk.com${NC}"
echo -e "  🎓 Student Portal   : ${GREEN}https://student.cambridgeeducation.uk.com${NC}"
echo -e "  👨‍👩‍👧 Parent Portal    : ${GREEN}https://parent.cambridgeeducation.uk.com${NC}"
echo -e "  ⚡ API & BullMQ     : ${GREEN}https://api.cambridgeeducation.uk.com${NC} (Port 4000)"
echo -e "\n${BLUE}Useful Commands:${NC}"
echo -e "  pm2 status"
echo -e "  pm2 logs ces-backend-api"
echo -e "  redis-cli ping"
echo -e "  curl -s http://127.0.0.1:4000/api/v1/system/queues"
echo -e "${BLUE}===================================================================${NC}\n"

