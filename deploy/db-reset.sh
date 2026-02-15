#!/usr/bin/env bash
set -euo pipefail

VM_IP="${1:?Usage: ./deploy/db-reset.sh <VM_IP> [SSH_USER]}"
SSH_USER="${2:-$(whoami)}"

echo "WARNING: This will drop and re-create all tables on $VM_IP."
read -rp "Are you sure? (y/N) " confirm
if [[ "$confirm" != [yY] ]]; then
  echo "Aborted."
  exit 0
fi

echo ">>> Resetting database on $VM_IP..."
ssh "$SSH_USER@$VM_IP" bash -s <<'EOF'
set -euo pipefail
cd /opt/boafo
set -a
source /etc/boafo/.env
set +a
npm run db:reset
EOF

echo ">>> Database reset complete."
echo ">>> Remember to run ./deploy/sync-embeddings.sh $VM_IP to restore embeddings."
