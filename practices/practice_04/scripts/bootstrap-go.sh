#!/usr/bin/env bash
# Ставит портативный Go в .tools/go-<ос>, если в PATH нет go.
# Ничего не пишет за пределами репозитория: архив, кэши и GOPATH живут в .tools/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/.tools"
GO_VERSION="${GO_VERSION:-go1.27.1}"

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) OS=windows; EXT=zip ;;
  Linux) OS=linux; EXT=tar.gz ;;
  Darwin) OS=darwin; EXT=tar.gz ;;
  *) echo "неизвестная ОС: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  arm64|aarch64) ARCH=arm64 ;;
  *) echo "неизвестная архитектура: $(uname -m)" >&2; exit 1 ;;
esac
DEST="$TOOLS/go-$OS"

if command -v go >/dev/null 2>&1; then
  echo "go уже есть в PATH: $(go version)"
  exit 0
fi
if [ -d "$DEST/bin" ]; then
  echo "портативный Go уже установлен: $DEST"
  exit 0
fi

FILE="$GO_VERSION.$OS-$ARCH.$EXT"
mkdir -p "$TOOLS"
echo "скачиваю $FILE"
curl -fL --progress-bar -o "$TOOLS/$FILE" "https://go.dev/dl/$FILE"
# Официальная контрольная сумма лежит рядом с архивом.
SHA=$(curl -fsSL "https://dl.google.com/go/$FILE.sha256")
echo "$SHA  $TOOLS/$FILE" | sha256sum -c -

TMP="$TOOLS/go-unpack"
rm -rf "$TMP" && mkdir -p "$TMP"
if [ "$EXT" = zip ]; then unzip -q "$TOOLS/$FILE" -d "$TMP"; else tar -C "$TMP" -xzf "$TOOLS/$FILE"; fi
mv "$TMP/go" "$DEST" && rm -rf "$TMP" "$TOOLS/$FILE"
"$DEST/bin/go" version
