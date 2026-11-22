#!/usr/bin/env bash
# Готовит проект с нуля на этой машине: Go, Node (на Linux), зависимости npm, проверка.
#   bash scripts/setup.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

bash "$ROOT/scripts/bootstrap-go.sh"
if [ "$(uname -s)" = Linux ]; then bash "$ROOT/scripts/bootstrap-node.sh"; fi

# shellcheck source=scripts/env.sh
. "$ROOT/scripts/env.sh"
command -v node >/dev/null || { echo "нет node: поставьте Node 20+ (nodejs.org)" >&2; exit 1; }

# node_modules платформенные (esbuild, rollup): после переноса между ОС ставим заново.
for dir in frontend mcp/vv-collections; do
  echo "npm ci в $dir"
  (cd "$ROOT/$dir" && rm -rf node_modules && npm ci --no-audit --no-fund --loglevel=error)
done

bash "$ROOT/scripts/check.sh"
