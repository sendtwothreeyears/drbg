#!/usr/bin/env bash
set -euo pipefail

gcloud compute ssh boafo \
  --project=boafo-prod \
  --zone=us-central1-a \
  --command="sudo bash /opt/boafo/deploy/update.sh"
