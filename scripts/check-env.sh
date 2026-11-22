#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env file. Create one with: cp .env.example .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

errors=0

require() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ]; then
    echo "Missing required env: $name"
    errors=$((errors + 1))
  fi
}

reject_placeholder() {
  local name="$1"
  local value="${!name:-}"
  local placeholder="$2"
  if [ "$value" = "$placeholder" ]; then
    echo "Replace placeholder env: $name"
    errors=$((errors + 1))
  fi
}

require "DATABASE_URL"
require "AUTH_TOKEN_SECRET"
require "NEXT_PUBLIC_API_BASE_URL"
require "CORS_ORIGINS"
require "CELERY_BROKER_URL"
require "CELERY_RESULT_BACKEND"
require "STRIPE_SECRET_KEY"
require "STRIPE_WEBHOOK_SECRET"
require "FRONTEND_SUCCESS_URL"
require "FRONTEND_CANCEL_URL"

reject_placeholder "AUTH_TOKEN_SECRET" "change-this-long-random-secret"
reject_placeholder "STRIPE_SECRET_KEY" "sk_test_your_key"
reject_placeholder "STRIPE_WEBHOOK_SECRET" "whsec_your_secret"

if [ "${DATABASE_URL:-}" = "sqlite:///./satsway.db" ]; then
  echo "Production should use PostgreSQL DATABASE_URL, not local SQLite"
  errors=$((errors + 1))
fi

if [[ "${NEXT_PUBLIC_API_BASE_URL:-}" == http://127.0.0.1* ]] || [[ "${NEXT_PUBLIC_API_BASE_URL:-}" == http://localhost* ]]; then
  echo "NEXT_PUBLIC_API_BASE_URL still points to localhost"
  errors=$((errors + 1))
fi

if [[ "${CORS_ORIGINS:-}" == *"localhost"* ]] || [[ "${CORS_ORIGINS:-}" == *"127.0.0.1"* ]]; then
  echo "CORS_ORIGINS still includes local development origins"
  errors=$((errors + 1))
fi

if [ -z "${RIVER_API_KEY:-}" ] || [ -z "${RIVER_ACCOUNT_ID:-}" ] || [ -z "${RIVER_WEBHOOK_SECRET:-}" ]; then
  echo "Warning: River env is incomplete. Bitcoin payments will stay in mock/dev mode."
fi

if [ "$errors" -gt 0 ]; then
  echo "Environment check failed with $errors issue(s)."
  exit 1
fi

echo "Environment check passed"
