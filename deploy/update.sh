#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/boafo"
ENV_FILE="/etc/boafo/.env"

cd "$APP_DIR"

set -a
source "$ENV_FILE"
set +a

echo ">>> Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo ">>> Installing dependencies..."
npm ci

echo ">>> Building frontend..."
npm run build

echo ">>> Running database setup..."
npm run db:setup

echo ">>> Reloading PM2 (zero-downtime)..."
pm2 reload boafo

echo ">>> Deploy complete."
pm2 status
