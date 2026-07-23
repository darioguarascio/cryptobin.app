#!/bin/sh
# CryptoBin CLI installer
# Usage: curl -fsSL https://cryptobin.app/install.sh | sh
#
# CRYPTOBIN_CLI=auto|c|node  (default auto: native C binary when build succeeds, else Node)
# CRYPTOBIN_PREFIX=$HOME/.local  install directory (bin is $PREFIX/bin)
set -eu

REPO="${CRYPTOBIN_GITHUB_REPO:-darioguarascio/cryptobin.app}"
INSTALL_URL="${CRYPTOBIN_INSTALL_URL:-https://cryptobin.app}"
CRYPTOBIN_CLI="${CRYPTOBIN_CLI:-auto}"

# Use a real ESC byte; plain \033 in variables is not interpreted by printf %s.
if [ -t 1 ]; then
  ESC=$(printf '\033')
  RED="${ESC}[0;31m"
  GREEN="${ESC}[0;32m"
  CYAN="${ESC}[0;36m"
  DIM="${ESC}[2m"
  BOLD="${ESC}[1m"
  RESET="${ESC}[0m"
else
  RED=''
  GREEN=''
  CYAN=''
  DIM=''
  BOLD=''
  RESET=''
fi

say() {
  printf '%b\n' "$*"
}

info() {
  say "${CYAN}→${RESET} $*"
}

success() {
  say "${GREEN}✔${RESET} $*"
}

die() {
  say "${RED}error:${RESET} $*" >&2
  exit 1
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    die "$1 is required but was not found in PATH"
  fi
}

c_cli_compiler() {
  if command -v cc >/dev/null 2>&1; then
    printf '%s' cc
    return 0
  fi
  if command -v gcc >/dev/null 2>&1; then
    printf '%s' gcc
    return 0
  fi
  return 1
}

c_cli_build_ready() {
  if [ ! -f "$TMP/packages/c-cli/Makefile" ]; then
    return 1
  fi
  if ! command -v make >/dev/null 2>&1; then
    return 1
  fi
  CC="$(c_cli_compiler)" || return 1
  if ! printf '%s\n' '#include <curl/curl.h>' '#include <openssl/evp.h>' | "$CC" -E -xc - -o /dev/null 2>/dev/null; then
    return 1
  fi
  return 0
}

c_cli_build_hint() {
  say "${DIM}Native CLI needs a C compiler plus libcurl and OpenSSL development headers.${RESET}"
  say "${DIM}Debian/Ubuntu:${RESET} sudo apt install build-essential libcurl4-openssl-dev libssl-dev"
  say "${DIM}Fedora/RHEL:${RESET} sudo dnf install gcc make libcurl-devel openssl-devel"
  say "${DIM}macOS:${RESET} xcode-select --install  ·  brew install curl openssl"
}

fetch_latest_release_tag() {
  curl -fsSL "https://api.github.com/repos/${REPO}/tags?per_page=1" 2>/dev/null \
    | sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n 1
}

resolve_install_ref() {
  if [ -n "${CRYPTOBIN_VERSION:-}" ]; then
    printf '%s' "$CRYPTOBIN_VERSION"
    return 0
  fi
  latest="$(fetch_latest_release_tag || true)"
  if [ -n "$latest" ]; then
    printf '%s' "$latest"
    return 0
  fi
  printf '%s' main
}

read_cli_package_version() {
  pkg="$TMP/packages/cli/package.json"
  if [ ! -f "$pkg" ]; then
    return 1
  fi
  if command -v node >/dev/null 2>&1; then
    node -p "require('${pkg}').version" 2>/dev/null && return 0
  fi
  sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$pkg" | head -n 1
}

cli_version_string() {
  bin="$1"
  line=""

  if [ -z "$bin" ] || [ ! -x "$bin" ]; then
    return 1
  fi

  line="$("$bin" -V 2>/dev/null | head -n 1 || true)"
  if [ -n "$line" ]; then
    printf '%s' "$line"
    return 0
  fi

  line="$("$bin" --version 2>/dev/null | head -n 1 || true)"
  if [ -n "$line" ]; then
    printf '%s' "$line"
    return 0
  fi

  return 1
}

format_installed_version() {
  cli_line="$1"
  pkg_version="$2"
  ref="$3"
  if [ -n "$cli_line" ]; then
    printf '%s · package %s · source %s' "$cli_line" "$pkg_version" "$ref"
  else
    printf 'package %s · source %s' "$pkg_version" "$ref"
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
      say ""
      say "${DIM}Add to your shell profile:${RESET}"
      printf '  %s\n' "export PATH=\"${bindir}:\$PATH\""
      ;;
  esac
}

print_quick_start() {
  say ""
  say "${BOLD}Quick start${RESET}"
  say "${DIM}Share a secret (prints a one-time URL):${RESET}"
  say "  ${CYAN}cryptobin secret \"your-secret-here\"${RESET}"
  say "${DIM}From stdin:${RESET}"
  say "  ${CYAN}echo \"token\" | cryptobin secret${RESET}"
  say "${DIM}Interactive (prompts for secret and expiry):${RESET}"
  say "  ${CYAN}cryptobin secret${RESET}"
  say "${DIM}Live stream (share URL on stderr when piped):${RESET}"
  say "  ${CYAN}tail -f log | cryptobin stream${RESET}"
  say "${DIM}Other commands:${RESET} cryptobin create (alias) · cryptobin config show · cryptobin --help"
  say "${DIM}Force Node CLI:${RESET} CRYPTOBIN_CLI=node … · ${DIM}Force C CLI:${RESET} CRYPTOBIN_CLI=c …"
  say ""
  say "${DIM}Pin a release:${RESET} CRYPTOBIN_VERSION=v0.6.7 curl -fsSL ${INSTALL_URL}/install.sh | sh"
  say ""
}

install_c_cli() {
  if ! c_cli_build_ready; then
    return 1
  fi

  info "Building native CLI (C)…"
  build_log="$(mktemp 2>/dev/null || mktemp -t cryptobin-build)"
  if ! (
    cd "$TMP/packages/c-cli"
    make clean all test >"$build_log" 2>&1
  ); then
    if [ -n "${CRYPTOBIN_VERBOSE:-}" ]; then
      cat "$build_log" >&2
    fi
    rm -f "$build_log"
    return 1
  fi
  rm -f "$build_log"

  bindir="$(ensure_bindir)"
  if ! install -m 755 "$TMP/packages/c-cli/cryptobin" "$bindir/cryptobin"; then
    die "Could not install to ${bindir}/cryptobin"
  fi

  BIN="$bindir/cryptobin"
  CLI_VERSION="$(cli_version_string "$BIN" || true)"
  success "Installed cryptobin $(format_installed_version "$CLI_VERSION" "$PKG_VERSION" "$REF") → ${BIN}"
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

  CLI_VERSION="$(cli_version_string "$BIN" || true)"
  success "Installed cryptobin $(format_installed_version "$CLI_VERSION" "$PKG_VERSION" "$REF") → ${BIN}"
  print_quick_start
}

need_cmd curl
need_cmd tar

REF="$(resolve_install_ref)"

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t cryptobin)"
cleanup() {
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

say ""
say "${BOLD}CryptoBin CLI installer${RESET}"
say ""
info "Release ref ${REF}"
info "Default server ${INSTALL_URL}"
info "Installer mode ${CRYPTOBIN_CLI}"

ARCHIVE="https://github.com/${REPO}/archive/${REF}.tar.gz"
info "Downloading source archive…"
if ! curl -fsSL "$ARCHIVE" | tar -xz -C "$TMP" --strip-components=1; then
  die "Could not download ${ARCHIVE}. Set CRYPTOBIN_VERSION to a tag (e.g. v0.6.3) or branch name."
fi

PKG_VERSION="$(read_cli_package_version || true)"
if [ -z "$PKG_VERSION" ]; then
  PKG_VERSION="$REF"
fi
info "Installing CLI release ${REF} (package ${PKG_VERSION})"

case "$CRYPTOBIN_CLI" in
  c)
    if ! install_c_cli; then
      c_cli_build_hint
      die "C CLI build failed."
    fi
    ;;
  node)
    install_node_cli
    ;;
  auto)
    if install_c_cli; then
      :
    else
      info "Native CLI skipped (no toolchain/dev headers); using Node CLI…"
      install_node_cli
    fi
    ;;
  *)
    die "Invalid CRYPTOBIN_CLI=${CRYPTOBIN_CLI} (use auto, c, or node)"
    ;;
esac
