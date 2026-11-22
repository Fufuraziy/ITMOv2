#!/usr/bin/env bash
# Ставит портативный Linux Node (с npm) в .tools/node-linux, если в PATH нет node.
# Версия 20 LTS: Linux-сборки Node 22+ не запускаются на ядре WSL1 (Exec format error).
# На WSL2 и обычном Linux можно поставить новее: NODE_VERSION=v24.11.0 bash scripts/bootstrap-node.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/.tools"
NODE_VERSION="${NODE_VERSION:-v20.20.2}"
DEST="$TOOLS/node-linux"

if [ "$(uname -s)" != Linux ]; then
  echo "только для Linux/WSL; в Windows поставьте Node с nodejs.org" >&2
  exit 1
fi
if command -v node >/dev/null 2>&1; then
  echo "node уже есть в PATH: $(node --version)"
  exit 0
fi
if [ -x "$DEST/bin/node" ]; then
  echo "портативный Node уже установлен: $("$DEST/bin/node" --version)"
  exit 0
fi

FILE="node-$NODE_VERSION-linux-x64.tar.xz"
BASE="https://nodejs.org/dist/$NODE_VERSION"
mkdir -p "$TOOLS"
echo "скачиваю $FILE"
curl -fsSL -o "$TOOLS/$FILE" "$BASE/$FILE"
(cd "$TOOLS" && curl -fsSL "$BASE/SHASUMS256.txt" | grep " $FILE\$" | sha256sum -c -)
mkdir -p "$DEST"
tar -C "$DEST" --strip-components=1 -xJf "$TOOLS/$FILE"
rm "$TOOLS/$FILE"
"$DEST/bin/node" --version
