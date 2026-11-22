#!/usr/bin/env bash
set -euo pipefail

SERVER="${SATSWAY_SERVER:-ubuntu@134.98.148.12}"
KEY_PATH="${SATSWAY_SSH_KEY:-$HOME/Documents/market_dashboard/Oracle_Keys/ssh-key-2025-05-06.pem}"
REMOTE_DIR="${SATSWAY_REMOTE_DIR:-/opt/satsway}"

cd "$(dirname "$0")/.."

NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://134.98.148.12}" ./scripts/build-web.sh

ssh -i "$KEY_PATH" "$SERVER" "sudo mkdir -p '$REMOTE_DIR' && sudo chown -R ubuntu:ubuntu '$REMOTE_DIR'"

rsync -az --delete \
  --exclude ".git/" \
  --exclude ".env" \
  --exclude ".venv/" \
  --exclude "venv/" \
  --exclude "*.db" \
  --exclude "__pycache__/" \
  --exclude ".pytest_cache/" \
  --exclude "frontend/node_modules/" \
  --exclude "frontend/.next/cache/" \
  -e "ssh -i $KEY_PATH" \
  ./ "$SERVER:$REMOTE_DIR/"

ssh -i "$KEY_PATH" "$SERVER" "cd '$REMOTE_DIR' && ./scripts/deploy.sh"
