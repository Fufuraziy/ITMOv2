#!/usr/bin/env bash
# Единый runner проверок проекта. Его вызывают агент, hook после правки и git pre-commit.
#
#   sh scripts/check.sh            # всё
#   sh scripts/check.sh backend    # gofmt, go vet, go test
#   sh scripts/check.sh frontend   # tsc --noEmit, vitest
#   sh scripts/check.sh mcp        # node --test для MCP vv-collections
#   sh scripts/check.sh skill      # node --test для скриптов skill tdd-go
#   sh scripts/check.sh hooks      # node --test для логики hook после правки
#
# Код выхода 0 — всё зелёное, 1 — есть падения. Последняя строка — итог.
set -uo pipefail
export NO_COLOR=1 FORCE_COLOR=0

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/env.sh
. "$ROOT/scripts/env.sh"

SCOPES=("$@")
[ ${#SCOPES[@]} -eq 0 ] && SCOPES=(backend frontend mcp skill hooks)

FAILED=()

step() { # step <имя> <каталог> <команда...>
  local name="$1" dir="$2"
  shift 2
  local out
  if out=$(cd "$dir" && "$@" 2>&1); then
    echo "  ok   $name"
  else
    echo "  FAIL $name"
    echo "$out" | sed 's/^/       /' | tail -n 40
    FAILED+=("$name")
  fi
}

check_backend() {
  echo "[backend]"
  if ! command -v go >/dev/null 2>&1; then
    echo "  FAIL go не найден: запустите sh scripts/bootstrap-go.sh"
    FAILED+=("backend:go-missing")
    return
  fi
  local unformatted
  unformatted=$(cd "$ROOT/backend" && command gofmt -l . 2>&1)
  if [ -n "$unformatted" ]; then
    echo "  FAIL gofmt (запустите: gofmt -w backend)"
    echo "$unformatted" | sed 's/^/       /'
    FAILED+=("gofmt")
  else
    echo "  ok   gofmt"
  fi
  step "go vet" "$ROOT/backend" go vet ./...
  step "go test" "$ROOT/backend" go test ./...
}

need_node_modules() { # need_node_modules <каталог> <имя шага>
  if [ ! -d "$1/node_modules" ]; then
    echo "  FAIL $2: нет node_modules, выполните: (cd ${1#"$ROOT"/} && npm ci)"
    FAILED+=("$2:deps")
    return 1
  fi
}

check_frontend() {
  echo "[frontend]"
  need_node_modules "$ROOT/frontend" frontend || return
  step "tsc --noEmit" "$ROOT/frontend" npx --no-install tsc --noEmit
  step "vitest" "$ROOT/frontend" npx --no-install vitest run --reporter=dot
}

check_mcp() {
  echo "[mcp]"
  need_node_modules "$ROOT/mcp/vv-collections" mcp || return
  step "node --test (vv-collections)" "$ROOT/mcp/vv-collections" node --test
}

check_skill() {
  echo "[skill]"
  step "node --test (tdd-go)" "$ROOT/.claude/skills/tdd-go/scripts" node --test
}

check_hooks() {
  echo "[hooks]"
  step "node --test (scripts/hooks)" "$ROOT/scripts/hooks" node --test
}

for scope in "${SCOPES[@]}"; do
  case "$scope" in
    backend) check_backend ;;
    frontend) check_frontend ;;
    mcp) check_mcp ;;
    skill) check_skill ;;
    hooks) check_hooks ;;
    *) echo "неизвестная область проверки: $scope" >&2; exit 2 ;;
  esac
done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "CHECK FAIL (${SCOPES[*]}): ${FAILED[*]}"
  exit 1
fi
echo "CHECK PASS (${SCOPES[*]})"
