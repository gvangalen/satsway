#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8000}"

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$API_BASE_URL/health" >/dev/null && curl -fsS "$API_BASE_URL/health/db" >/dev/null; then
    echo "Satsway API healthy"
    exit 0
  fi

  sleep 2
done

echo "Satsway API healthcheck failed"
exit 1
