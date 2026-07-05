#!/bin/sh
# CryptoBin CLI installer
# Usage: curl -fsSL https://cryptobin.app/install.sh | sh
set -eu

REPO="${CRYPTOBIN_GITHUB_REPO:-darioguarascio/cryptobin.app}"
REF="${CRYPTOBIN_VERSION:-main}"
INSTALL_URL="${CRYPTOBIN_INSTALL_URL:-https://cryptobin.app}"

if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  CYAN='\033[0;36m'
  DIM='\033[2m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED=''
  GREEN=''
  CYAN=''
  DIM=''
  BOLD=''
  RESET=''
fi

info() {
  printf '%s\n' "${CYAN}→${RESET} $*"
}

success() {
  printf '%s\n' "${GREEN}✔${RESET} $*"
}

die() {
  printf '%s\n' "${RED}error:${RESET} $*" >&2
  exit 1
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    die "$1 is required but was not found in PATH"
  fi
}

need_cmd curl
need_cmd tar
need_cmd node
need_cmd npm

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 22 ]; then
  die "Node.js 22+ is required (found $(node -v))"
fi

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t cryptobin)"
cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

printf '\n%s\n\n' "${BOLD}CryptoBin CLI installer${RESET}"
info "Source ${REPO}@${REF}"
info "Default server ${INSTALL_URL}"

ARCHIVE="https://github.com/${REPO}/archive/${REF}.tar.gz"
info "Downloading source archive…"
if ! curl -fsSL "$ARCHIVE" | tar -xz -C "$TMP" --strip-components=1; then
  die "Could not download ${ARCHIVE}. Set CRYPTOBIN_VERSION to a tag (e.g. v0.4.0) or branch name."
fi

if [ ! -f "$TMP/packages/cli/package.json" ]; then
  die "packages/cli was not found in the downloaded archive"
fi

info "Installing CLI dependencies…"
(
  cd "$TMP/packages/cli"
  npm install --no-fund --no-audit >/dev/null
)

info "Building CLI…"
(
  cd "$TMP/packages/cli"
  npm run build >/dev/null
)

info "Installing cryptobin globally…"
if ! (
  cd "$TMP/packages/cli"
  npm install -g . --no-fund --no-audit >/dev/null
); then
  die "Global install failed. If you see EACCES, run: mkdir -p \"\$HOME/.local\" && npm config set prefix \"\$HOME/.local\" && export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

BIN="$(command -v cryptobin || true)"
if [ -z "$BIN" ]; then
  die "cryptobin was installed but is not on PATH. Add your npm global bin directory to PATH."
fi

VERSION="$(cryptobin --version 2>/dev/null || true)"
success "Installed cryptobin ${VERSION} → ${BIN}"
printf '\n%s\n' "${DIM}Try:${RESET} cryptobin create"
printf '%s\n\n' "${DIM}Pin a release:${RESET} CRYPTOBIN_VERSION=v0.4.0 curl -fsSL ${INSTALL_URL}/install.sh | sh"
