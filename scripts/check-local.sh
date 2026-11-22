#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

python3 -m compileall backend
./scripts/test-backend.sh
./scripts/build-web.sh
./scripts/check-mobile.sh

echo "Local checks passed"
