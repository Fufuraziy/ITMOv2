# shellcheck shell=bash
# Подключается через `source scripts/env.sh`.
# Если go/node нет в PATH, берёт портативные из .tools/ (scripts/bootstrap-go.sh, scripts/bootstrap-node.sh).
# Кэши Go и npm держит в .tools/, чтобы проверки не писали за пределы репозитория.

ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TOOLS="$ROOT/.tools"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) TOOLS_OS=windows ;;
  Darwin) TOOLS_OS=darwin ;;
  *) TOOLS_OS=linux ;;
esac

if ! command -v go >/dev/null 2>&1 && [ -d "$TOOLS/go-$TOOLS_OS/bin" ]; then
  export PATH="$TOOLS/go-$TOOLS_OS/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1 && [ -d "$TOOLS/node-$TOOLS_OS/bin" ]; then
  export PATH="$TOOLS/node-$TOOLS_OS/bin:$PATH"
fi

export GOPATH="${GOPATH:-$TOOLS/gopath}"
export GOCACHE="${GOCACHE:-$TOOLS/gocache-$TOOLS_OS}"
export GOMODCACHE="${GOMODCACHE:-$TOOLS/gopath/pkg/mod}"
export GOTOOLCHAIN="${GOTOOLCHAIN:-local}"
export npm_config_cache="${npm_config_cache:-$TOOLS/npm-cache}"
export npm_config_update_notifier=false
export npm_config_fund=false
export npm_config_audit=false

# Телеметрия Go пишет счётчики в os.UserConfigDir(); направляем её в .tools.
go() {
  APPDATA="$TOOLS/appdata" XDG_CONFIG_HOME="$TOOLS/appdata" command go "$@"
}
