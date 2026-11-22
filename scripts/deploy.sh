#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  echo "Missing .venv. Run ./scripts/server-bootstrap.sh first."
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

if command -v git >/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Deploying revision: $(git rev-parse --short HEAD)"
fi

./scripts/check-env.sh

python -m pip install -r backend/requirements.txt

cd frontend
npm ci --omit=dev
cd ..

./scripts/test-backend.sh
./scripts/migrate.sh

if pm2 describe satsway-api >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi

./scripts/healthcheck.sh
pm2 save

echo "Deploy completed"
