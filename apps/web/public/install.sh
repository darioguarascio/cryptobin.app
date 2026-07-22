#!/bin/sh
# CryptoBin CLI installer
# Usage: curl -fsSL https://cryptobin.app/install.sh | sh
#
# CRYPTOBIN_CLI=auto|c|node  (default auto: native C binary when build succeeds, else Node)
# CRYPTOBIN_PREFIX=$HOME/.local  install directory (bin is $PREFIX/bin)
set -eu

REPO="${CRYPTOBIN_GITHUB_REPO:-darioguarascio/cryptobin.app}"
REF="${CRYPTOBIN_VERSION:-main}"
INSTALL_URL="${CRYPTOBIN_INSTALL_URL:-https://cryptobin.app}"
CRYPTOBIN_CLI="${CRYPTOBIN_CLI:-auto}"

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

install_prefix() {
  if [ -n "${CRYPTOBIN_PREFIX:-}" ]; then
    printf '%s' "$CRYPTOBIN_PREFIX"
    return 0
  fi
  printf '%s' "$HOME/.local"
}

install_bindir() {
  prefix="$(install_prefix)"
  printf '%s/bin' "$prefix"
}

ensure_bindir() {
  bindir="$(install_bindir)"
  if ! mkdir -p "$bindir" 2>/dev/null; then
    die "Could not create ${bindir}. Set CRYPTOBIN_PREFIX to a writable directory."
  fi
  printf '%s' "$bindir"
}

path_hint() {
  bindir="$(install_bindir)"
  case ":$PATH:" in
    *:"$bindir":*) ;;
    *)
      printf '\n%s\n' "${DIM}Add to your shell profile:${RESET}"
      printf '  %s\n' "export PATH=\"${bindir}:\$PATH\""
      ;;
  esac
}

print_quick_start() {
  printf '\n%s\n' "${BOLD}Quick start${RESET}"
  printf '%s\n' "${DIM}Share a secret (prints a one-time URL):${RESET}"
  printf '  %s\n' "${CYAN}cryptobin secret \"your-secret-here\"${RESET}"
  printf '%s\n' "${DIM}From stdin:${RESET}"
  printf '  %s\n' "${CYAN}echo \"token\" | cryptobin secret${RESET}"
  printf '%s\n' "${DIM}Interactive (prompts for secret and expiry):${RESET}"
  printf '  %s\n' "${CYAN}cryptobin secret${RESET}"
  printf '%s\n' "${DIM}Other commands:${RESET} cryptobin create (alias) · cryptobin config show · cryptobin --help"
  printf '%s\n' "${DIM}Force Node CLI:${RESET} CRYPTOBIN_CLI=node … · ${DIM}Force C CLI:${RESET} CRYPTOBIN_CLI=c …"
  printf '\n%s\n\n' "${DIM}Pin a release:${RESET} CRYPTOBIN_VERSION=v0.4.0 curl -fsSL ${INSTALL_URL}/install.sh | sh"
}

install_c_cli() {
  if [ ! -f "$TMP/packages/c-cli/Makefile" ]; then
    return 1
  fi
  if ! command -v make >/dev/null 2>&1; then
    return 1
  fi
  if ! command -v cc >/dev/null 2>&1 && ! command -v gcc >/dev/null 2>&1; then
    return 1
  fi

  info "Building native CLI (C)…"
  if ! (
    cd "$TMP/packages/c-cli"
    make clean all test >/dev/null
  ); then
    return 1
  fi

  bindir="$(ensure_bindir)"
  if ! install -m 755 "$TMP/packages/c-cli/cryptobin" "$bindir/cryptobin"; then
    die "Could not install to ${bindir}/cryptobin"
  fi

  BIN="$bindir/cryptobin"
  VERSION="$("$BIN" --version 2>/dev/null || true)"
  success "Installed cryptobin ${VERSION} → ${BIN}"
  path_hint
  print_quick_start
  return 0
}

install_node_cli() {
  need_cmd node
  need_cmd npm

  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$NODE_MAJOR" -lt 22 ]; then
    die "Node.js 22+ is required (found $(node -v))"
  fi

  if [ ! -f "$TMP/packages/cli/package.json" ]; then
    die "packages/cli was not found in the downloaded archive"
  fi

  info "Installing CLI dependencies…"
  (
    cd "$TMP/packages/cli"
    npm install --no-fund --no-audit >/dev/null
  )

  info "Building CLI (Node)…"
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
  print_quick_start
}

need_cmd curl
need_cmd tar

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t cryptobin)"
cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

printf '\n%s\n\n' "${BOLD}CryptoBin CLI installer${RESET}"
info "Source ${REPO}@${REF}"
info "Default server ${INSTALL_URL}"
info "Installer mode ${CRYPTOBIN_CLI}"

ARCHIVE="https://github.com/${REPO}/archive/${REF}.tar.gz"
info "Downloading source archive…"
if ! curl -fsSL "$ARCHIVE" | tar -xz -C "$TMP" --strip-components=1; then
  die "Could not download ${ARCHIVE}. Set CRYPTOBIN_VERSION to a tag (e.g. v0.4.0) or branch name."
fi

case "$CRYPTOBIN_CLI" in
  c)
    if ! install_c_cli; then
      die "C CLI build failed. Install a C toolchain and libcurl/OpenSSL dev packages (e.g. build-essential libcurl4-openssl-dev libssl-dev on Debian/Ubuntu)."
    fi
    ;;
  node)
    install_node_cli
    ;;
  auto)
    if install_c_cli; then
      :
    else
      info "Native build unavailable; falling back to Node CLI…"
      install_node_cli
    fi
    ;;
  *)
    die "Invalid CRYPTOBIN_CLI=${CRYPTOBIN_CLI} (use auto, c, or node)"
    ;;
esac
