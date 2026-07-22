#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres@127.0.0.1:5432/cryptobin_test}"
export TEST_DATABASE_URL
export DATABASE_URL="$TEST_DATABASE_URL"

teardown() {
  bash "$ROOT/scripts/test-db-teardown.sh" || true
}

trap teardown EXIT

bash "$ROOT/scripts/test-db-setup.sh"

npm --workspace @cryptobin/web run test:integration
