#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../mobile"

npx tsc --noEmit
npx expo-doctor
