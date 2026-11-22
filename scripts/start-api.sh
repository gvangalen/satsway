#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

python3 -m uvicorn backend.main:app --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
