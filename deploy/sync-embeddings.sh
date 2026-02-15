#!/usr/bin/env bash
set -euo pipefail

VM_IP="${1:?Usage: ./deploy/sync-embeddings.sh <VM_IP> [SSH_USER]}"
SSH_USER="${2:-$(whoami)}"
DUMP_FILE="/tmp/guideline_chunks.dump"
REMOTE_DUMP="/tmp/guideline_chunks.dump"
LOCAL_DB="${DATABASE:-cb}"
REMOTE_DB="${DATABASE:-cb}"

echo ">>> Dumping guideline_chunks from local database '$LOCAL_DB'..."
pg_dump --table=guideline_chunks --data-only --format=custom "$LOCAL_DB" > "$DUMP_FILE"

echo ">>> Uploading dump to $SSH_USER@$VM_IP..."
scp "$DUMP_FILE" "$SSH_USER@$VM_IP:$REMOTE_DUMP"

echo ">>> Restoring on remote..."
ssh "$SSH_USER@$VM_IP" bash -s <<EOF
set -euo pipefail
sudo -u postgres psql -d $REMOTE_DB -c "TRUNCATE guideline_chunks;"
sudo -u postgres pg_restore --data-only --single-transaction -d $REMOTE_DB "$REMOTE_DUMP"
rm -f "$REMOTE_DUMP"
echo ">>> Remote restore complete."
sudo -u postgres psql -d $REMOTE_DB -c "SELECT COUNT(*) AS remote_count FROM guideline_chunks;"
EOF

rm -f "$DUMP_FILE"
echo ">>> Sync complete."
