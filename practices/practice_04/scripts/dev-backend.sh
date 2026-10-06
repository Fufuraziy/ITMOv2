#!/usr/bin/env bash
# Запускает бэкенд подборок (нужен MCP vv-collections и фронтенду).
#   sh scripts/dev-backend.sh            # 127.0.0.1:8080
#   ADDR=:9090 sh scripts/dev-backend.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/env.sh
. "$ROOT/scripts/env.sh"
cd "$ROOT/backend"
ADDR="${ADDR:-127.0.0.1:8080}" go run ./cmd/api
