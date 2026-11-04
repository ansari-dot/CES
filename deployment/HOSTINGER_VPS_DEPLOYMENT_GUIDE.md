# Hostinger VPS Production Deployment Guide
## Cambridge Education System — Complete Multi-Portal & BullMQ Setup

This step-by-step guide explains how to deploy the **Cambridge Education System** on a **Hostinger Ubuntu 22.04 / 24.04 LTS VPS** with:
- **Zero CORS / Zero Cookie Issues**: All portals proxy `/api/` and `/socket.io/` directly via Nginx, so all browser requests are strictly same-origin.
- **Node.js Express REST Backend & Socket.IO**: Running on Port 5000 via **PM2**.
- **Redis Server & BullMQ**: Running locally on `127.0.0.1:6379` for asynchronous event dispatching, email delivery, and schedulers.
- **MySQL 8 Database**: Relational database with automated migrations.
- **4 Vite React TypeScript Frontends**: Compiled into static HTML/JS/CSS bundles served directly by Nginx.
- **Free Automated SSL (HTTPS)**: Powered by Let's Encrypt / Certbot.

---

## 🏛️ Production Architecture

```
Internet (HTTPS 443)
       │
       ▼
 ┌─────────── Nginx Reverse Proxy & Static File Server ───────────┐
 │                                                                │
 │  admin.yourdomain.com   ──► Serves /principle/dist (SPA)      │
 │  teacher.yourdomain.com ──► Serves /teacher/dist (SPA)        │
 │  student.yourdomain.com ──► Serves /student/dist (SPA)        │
 │  parent.yourdomain.com  ──► Serves /parent/dist (SPA)         │
 │                                                                │
 │  All Subdomains Proxy:                                         │
 │   - /api/        ─────────► http://127.0.0.1:5000/api/         │
 │   - /socket.io/  ─────────► http://127.0.0.1:5000/socket.io/   │
 └───────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   PM2: Node.js API    │ (Port 5000)
                     │     ces-backend-api   │
                     └───────────┬───────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
         ┌─────────────────────┐   ┌─────────────────────┐
         │       MySQL 8       │   │    Redis Server     │
         │   Database (3306)   │   │  DB 0: Cache / Pub  │
         │     'school_db'     │   │  DB 1: BullMQ Queue │
         └─────────────────────┘   └─────────────────────┘
```

> [!IMPORTANT]
> **Why this architecture completely eliminates CORS and Cookie bugs:**
> In every portal (`teacher`, `student`, `admin`, `parent`), all API calls use relative paths (`fetch('/api/v1/...')`) and WebSockets connect to (`io('/')`). Because Nginx proxies `/api/` on each subdomain, the browser communicates strictly with the **same origin**. Preflight `OPTIONS` requests and cross-site cookie restrictions (`SameSite`) are completely bypassed.

---

## 📋 Step 1: Initial Server Setup & Firewall

Log into your Hostinger VPS via SSH as `root`:
```bash
ssh root@YOUR_VPS_IP
```

Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
```

Configure the UFW firewall to permit SSH, HTTP, and HTTPS:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 📋 Step 2: Install Node.js 20 LTS, Redis, MySQL & Nginx

### 1. Install Node.js 20.x & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
sudo npm install -g pm2
```
Verify versions:
```bash
node -v   # Should show v20.x.x
npm -v
pm2 -v
```

### 2. Install & Start Redis Server
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```
Verify Redis is responding locally:
```bash
redis-cli ping
# Output must be: PONG
```

### 3. Install & Secure MySQL 8
```bash
sudo apt install -y mysql-server
sudo systemctl enable mysql
sudo systemctl start mysql
```

### 4. Install Nginx & Certbot (SSL)
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 📋 Step 3: Configure MySQL Database

Open the MySQL shell:
```bash
sudo mysql
```

Run the following SQL commands (replace `YourStrongSecretPassword123!` with your own secure password):
```sql
CREATE DATABASE school_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'ces_user'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'YourStrongSecretPassword123!';
GRANT ALL PRIVILEGES ON school_db.* TO 'ces_user'@'127.0.0.1';

CREATE USER 'ces_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'YourStrongSecretPassword123!';
GRANT ALL PRIVILEGES ON school_db.* TO 'ces_user'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

Test connecting as the new user:
```bash
mysql -u ces_user -p -h 127.0.0.1 school_db
# Enter your password to verify access, then type 'exit'.
```

---

## 📋 Step 4: Clone Codebase & Configure `.env`

Create the deployment folder and clone your repository:
```bash
sudo mkdir -p /var/www/ces
sudo chown -R $USER:$USER /var/www/ces
cd /var/www/ces

# Clone your GitHub repository (replace with your repo URL)
git clone https://github.com/your-username/Cambridge-Education-system-.git .
```

Create the production `.env` file for the backend:
```bash
cp deployment/env.production.example backend/.env
nano backend/.env
```

Ensure these key variables are set:
```ini
NODE_ENV=production
PORT=5000
APP_BASE_URL=https://api.yourdomain.com

ALLOWED_ORIGINS=https://admin.yourdomain.com,https://teacher.yourdomain.com,https://student.yourdomain.com,https://parent.yourdomain.com,https://api.yourdomain.com

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=school_db
DB_USER=ces_user
DB_PASSWORD=YourStrongSecretPassword123!
DB_SSL=false

JWT_ACCESS_SECRET=your_super_long_secret_key_at_least_32_characters_here!
CSRF_SECRET=your_super_long_csrf_secret_at_least_32_characters_here!

COOKIE_SECURE=true
COOKIE_SAMESITE=lax

REDIS_CACHE_URL=redis://127.0.0.1:6379/0
REDIS_QUEUE_URL=redis://127.0.0.1:6379/1

SCHOOL_TIMEZONE=Asia/Karachi
FEE_SCHEDULER_ENABLED=true

# Zoom & Brevo SMTP credentials
ZOOM_ACCOUNT_ID=5AqiKI-1ScuOXxGmnzoXoA
ZOOM_CLIENT_ID=d0MFfNdnQHCfTGRunQYe4g
ZOOM_CLIENT_SECRET=i6Te7ciQmRkTiVUpdwwR6cBKb1LYXSIX
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=b24400001@smtp-brevo.com
SMTP_PASS=xsmtpsib-5080e6663158598f0b3abe5bcb80eaadb49ff78412c78df689ec0ad1230d2b15-Pm30r1ZDqdnYjgGs
SMTP_FROM="EduPulse School Management <mubinasaleem24@gmail.com>"

TEACHER_PORTAL_URL=https://teacher.yourdomain.com
STUDENT_PORTAL_URL=https://student.yourdomain.com
PARENT_PORTAL_URL=https://parent.yourdomain.com
```

---

## 📋 Step 5: Install Dependencies, Migrate Database & Seed Data

### 1. Install Backend & Run Database Setup
```bash
cd /var/www/ces/backend
npm install

# Run database migrations
npm run migrate

# Run sync script to ensure all indexes, enums, and tables are consistent
node scripts/sync-database.js

# (Optional) Seed initial Principal and academic accounts if database is fresh
npm run seed
```

### 2. Build All 4 Frontend Portals
```bash
cd /var/www/ces/principle && npm install && npm run build
cd /var/www/ces/teacher && npm install && npm run build
cd /var/www/ces/student && npm install && npm run build
cd /var/www/ces/parent && npm install && npm run build
```

---

## 📋 Step 6: Start Backend with PM2

From `/var/www/ces`:
```bash
cd /var/www/ces
mkdir -p logs

# Start using the production ecosystem file
pm2 start deployment/ecosystem.config.cjs --env production

# Save PM2 process list so it automatically restarts on server reboot
pm2 save
pm2 startup
```
*(Copy and paste the `sudo env PATH=...` command that PM2 outputs if prompted).*

Check backend logs to verify connection to MySQL & local Redis BullMQ:
```bash
pm2 logs ces-backend-api --lines 50
```
You should see:
```
✅ Connected to MySQL database successfully.
✅ Connected to local Redis server successfully (DB 0: Cache, DB 1: BullMQ).
🐂 BullMQ Queue Manager initialized successfully on Redis (DB 1).
   - Realtime Events Queue active
   - Notifications & Email Queue active
   - Zoom Webhooks Queue active
   - Distributed Schedulers (Fees & Zoom) active
🚀 School Backend API server running on port 5000 [production]
⚡ Real-time WebSocket server initialized.
```

---

## 📋 Step 7: Configure Nginx & Eliminate CORS

### 1. DNS Records Setup (In Hostinger or Cloudflare DNS)
Add these `A` records pointing to your **VPS IP Address**:
- `admin.yourdomain.com` ➔ `YOUR_VPS_IP`
- `teacher.yourdomain.com` ➔ `YOUR_VPS_IP`
- `student.yourdomain.com` ➔ `YOUR_VPS_IP`
- `parent.yourdomain.com` ➔ `YOUR_VPS_IP`
- `api.yourdomain.com` ➔ `YOUR_VPS_IP`

### 2. Install Nginx Configuration
Copy the subdomains configuration file to Nginx `sites-available`:
```bash
sudo cp /var/www/ces/deployment/nginx/school_subdomains.conf /etc/nginx/sites-available/ces.conf
```

Edit `/etc/nginx/sites-available/ces.conf` to replace `yourdomain.com` with your real domain:
```bash
sudo nano /etc/nginx/sites-available/ces.conf
```
*(Use `Ctrl + \` in nano to search for `yourdomain.com` and replace all with your actual domain, e.g. `edupulse.edu.pk`).*

Enable the site configuration and disable the default Nginx welcome page:
```bash
sudo ln -s /etc/nginx/sites-available/ces.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

Test Nginx configuration for syntax errors:
```bash
sudo nginx -t
```
If it reports `syntax is ok` and `test is successful`:
```bash
sudo systemctl reload nginx
```

---

## 📋 Step 8: Install Free SSL Certificates (HTTPS) with Certbot

Run Certbot to automatically obtain and install SSL certificates for all subdomains:
```bash
sudo certbot --nginx -d admin.yourdomain.com -d teacher.yourdomain.com -d student.yourdomain.com -d parent.yourdomain.com -d api.yourdomain.com
```

- Enter your email address for renewal notifications.
- Agree to the Terms of Service.
- Certbot will automatically verify the domains, configure SSL in Nginx, and enable automatic HTTP-to-HTTPS redirect!

Verify the auto-renewal timer:
```bash
sudo systemctl status certbot.timer
```

---

## 📋 Step 9: Production Verification & Health Checks

1. **Verify BullMQ & Redis Queue System:**
   In your browser or via curl:
   ```bash
   curl -s https://admin.yourdomain.com/api/v1/system/queues | jq
   ```
   Should return:
   ```json
   {
     "success": true,
     "bullMqInitialized": true,
     "redis": {
       "connected": true,
       "version": "7.x.x"
     },
     "queues": {
       "realtimeEvents": { "waiting": 0, "active": 0, "completed": 0, "failed": 0 },
       "notifications": { "waiting": 0, "active": 0, "completed": 0, "failed": 0 },
       "schedulers": { "waiting": 0, "active": 0, "completed": 2, "failed": 0 }
     }
   }
   ```

2. **Verify Frontend Portals:**
   - **Principal Portal**: `https://admin.yourdomain.com`
   - **Teacher Portal**: `https://teacher.yourdomain.com`
   - **Student Portal**: `https://student.yourdomain.com`
   - **Parent Portal**: `https://parent.yourdomain.com`

---

## 📋 Step 10: Future Updates (One-Command Deployment)

Whenever you push new code to your repository, simply run the automated deploy script on your VPS:
```bash
cd /var/www/ces
chmod +x deployment/deploy.sh
./deployment/deploy.sh
```
This script automatically:
1. Pulls the latest code
2. Installs dependencies
3. Runs Knex database migrations & schema sync
4. Rebuilds all 4 frontend portals
5. Gracefully reloads the backend PM2 process with zero downtime
6. Reloads Nginx

---

## 💡 Troubleshooting Cheatsheet

| Issue | Cause | Quick Fix |
|---|---|---|
| **`413 Request Entity Too Large`** | Uploading large PDFs or slips | Ensure `client_max_body_size 50M;` is inside `server {}` block in Nginx. |
| **`403 CSRF_INVALID`** | Missing CSRF token or cookie mismatch | Ensure `COOKIE_SECURE=true` in `backend/.env` because the site is on HTTPS. |
| **WebSocket disconnects every 60s** | Default Nginx proxy timeout | Ensure `proxy_read_timeout 86400s;` is in `location /socket.io/`. |
| **404 on page refresh (e.g. `/timetable`)** | Missing SPA fallback | Ensure `try_files $uri $uri/ /index.html;` is in `location /`. |
| **Redis connection refused** | Redis service stopped | Run `sudo systemctl restart redis-server`. |
| **PM2 logs error** | Database connection or env variable | Run `pm2 logs ces-backend-api --lines 100`. |

