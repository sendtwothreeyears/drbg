#!/usr/bin/env bash
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
REPO_URL="https://github.com/sendtwothreeyears/drbg.git"
APP_DIR="/opt/boafo"
ENV_DIR="/etc/boafo"
BRANCH="main"

# ── System packages ─────────────────────────────────────────────────
sudo apt-get update
sudo apt-get install -y curl git nginx postgresql-client \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2 libnspr4 libnss3

# ── Node.js 20 ──────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# ── PostgreSQL 18 + pgvector ────────────────────────────────────────
sudo apt-get install -y postgresql-18 postgresql-server-dev-18 build-essential
cd /tmp
git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git
cd pgvector
make PG_CONFIG=/usr/lib/postgresql/18/bin/pg_config
sudo make PG_CONFIG=/usr/lib/postgresql/18/bin/pg_config install
cd /
rm -rf /tmp/pgvector

# ── Configure PostgreSQL ────────────────────────────────────────────
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE cb;" || true
sudo -u postgres psql -d cb -c "CREATE EXTENSION IF NOT EXISTS vector;"

# ── PM2 ──────────────────────────────────────────────────────────────
sudo npm install -g pm2

# ── Log directory ────────────────────────────────────────────────────
sudo mkdir -p /var/log/boafo

# ── Clone repo ──────────────────────────────────────────────────────
sudo rm -rf "$APP_DIR"
sudo git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"
sudo npm ci

# ── Environment file ────────────────────────────────────────────────
sudo mkdir -p "$ENV_DIR"
if [ ! -f "$ENV_DIR/.env" ]; then
  sudo tee "$ENV_DIR/.env" > /dev/null <<'ENVFILE'
NODE_ENV=production
DATABASE=cb
PG_USER=postgres
PG_PASSWORD=postgres
PG_PORT=5432
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
PORT=3000
ENVFILE
  echo ">>> Edit /etc/boafo/.env with your real API keys before starting the app."
fi

# ── Build frontend ──────────────────────────────────────────────────
sudo npm run build

# ── Database setup (schema + embed guidelines) ──────────────────────
set -a
source "$ENV_DIR/.env"
set +a
cd "$APP_DIR"
sudo -E npm run db:setup

# ── PM2 process manager ─────────────────────────────────────────────
pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
pm2 startup systemd -u "$(whoami)" --hp "$HOME"
pm2 save

# ── Nginx ───────────────────────────────────────────────────────────
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/boafo
sudo ln -sf /etc/nginx/sites-available/boafo /etc/nginx/sites-enabled/boafo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo ">>> Boafo is running. Access via http://$(curl -s ifconfig.me)"
