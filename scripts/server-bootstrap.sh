#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v python3 >/dev/null; then
  echo "python3 is required. Install it first."
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "npm is required. Install Node.js/npm first."
  exit 1
fi

if ! command -v pm2 >/dev/null; then
  echo "pm2 is required. Install with: sudo npm install -g pm2"
  exit 1
fi

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

if [ ! -f .env ]; then
  cp .env.production.example .env
  echo "Created .env from .env.production.example. Fill it in, then run:"
  echo "  ./scripts/deploy.sh"
  exit 0
fi

./scripts/deploy.sh
