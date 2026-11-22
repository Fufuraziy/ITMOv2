#!/usr/bin/env bash
# Запускает сервис целиком: бэкенд в фоне (127.0.0.1:8080) и страницу Vite (http://localhost:5173).
# Ctrl+C останавливает оба.
#   bash scripts/dev.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/env.sh
. "$ROOT/scripts/env.sh"

bash "$ROOT/scripts/dev-backend.sh" &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null' EXIT INT TERM

cd "$ROOT/frontend"
npx --no-install vite --host 127.0.0.1
